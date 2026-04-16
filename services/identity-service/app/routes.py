from fastapi import APIRouter, Depends, HTTPException, Request
from app.schemas import CreateAccount, Login, UserInfo
from app.security import get_current_user, verify_no_connection
from shared.models import User, VerificationToken
from shared.database import SessionLocal
from datetime import datetime, timedelta
from passlib.context import CryptContext
import uuid
import jwt
import os

router = APIRouter(prefix="/auth")
pwd_context = CryptContext(schemes=["bcrypt"])

JWT_SECRET_KEY = os.getenv("JWT_SECRET")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def generate_token(user_id: uuid.UUID) -> str:
    return jwt.encode({"user_id": str(user_id)}, JWT_SECRET_KEY, algorithm="HS256")


# register
@router.post("/register", response_model=UserInfo)
def register_account(data: CreateAccount, user=Depends(verify_no_connection)):
    session = SessionLocal()
    try:
        user = User(
            id=uuid.uuid4(),
            username=data.username,
            email=data.email,
            hashed_password=hash_password(data.password),
            role="tenant",
            is_verified=False
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        token = generate_token(user.id)
        verification_token = VerificationToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )
        session.add(verification_token)
        session.commit()

        return UserInfo(
            id=str(user.id),
            username=user.username,
            email=user.email,
            role=user.role,
            is_verified=user.is_verified,
            token=token
        )
    finally:
        session.close()


# login
@router.post("/login", response_model=UserInfo)
def login_account(data: Login, user=Depends(verify_no_connection)):
    session = SessionLocal()
    try:
        user = session.query(User).filter(
            (User.username == data.registration_input) | (User.email == data.registration_input)
        ).first()

        if not user:
            raise HTTPException(status_code=401, detail="Invalid username or email")

        if not verify_password(data.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid password")

        token = generate_token(user.id)
        verification_token = VerificationToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )
        session.add(verification_token)
        session.commit()

        return UserInfo(
            id=str(user.id),
            username=user.username,
            email=user.email,
            role=user.role,
            is_verified=user.is_verified,
            token=token
        )
    finally:
        session.close()


# logout
@router.post("/logout")
def logout_account(request: Request, user=Depends(get_current_user)):
    auth_header = request.headers.get("Authorization")
    current_token = auth_header.replace("Bearer ", "") if auth_header else None
    session = SessionLocal()
    try:
        session.query(VerificationToken).filter(VerificationToken.token == current_token).delete()
        session.commit()
    finally:
        session.close()
    return {"message": "Logged out successfully"}


# verify account
@router.post("/verify")
def verify_account(user=Depends(get_current_user)):
    session = SessionLocal()
    try:
        db_user = session.query(User).filter(User.id == user.id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        db_user.is_verified = True
        session.commit()
    finally:
        session.close()
    return {"message": "Account verified successfully"}


# get current user
@router.get("/getInfo", response_model=UserInfo)
def get_current_user_info(user=Depends(get_current_user)):
    return UserInfo(
        id=str(user.id),
        username=user.username,
        email=user.email,
        role=user.role,
        is_verified=user.is_verified,
        token=None
    )


# update user info
@router.put("/update", response_model=UserInfo)
def update_user_info(data: CreateAccount, user=Depends(get_current_user)):
    session = SessionLocal()
    try:
        db_user = session.query(User).filter(User.id == user.id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        db_user.username = data.username
        db_user.email = data.email
        db_user.hashed_password = hash_password(data.password)
        session.commit()
        session.refresh(db_user)

        return UserInfo(
            id=str(db_user.id),
            username=db_user.username,
            email=db_user.email,
            role=db_user.role,
            is_verified=db_user.is_verified,
            token=None
        )
    finally:
        session.close()


# devenir propriétaire
@router.post("/become-owner")
def become_owner(user=Depends(get_current_user)):
    session = SessionLocal()
    try:
        db_user = session.query(User).filter(User.id == user.id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        if db_user.role == "owner":
            raise HTTPException(status_code=400, detail="Already an owner")
        db_user.role = "owner"
        session.commit()
    finally:
        session.close()
    return {"message": "You are now an owner"}


# delete account
@router.delete("/delete")
def delete_account(user=Depends(get_current_user)):
    session = SessionLocal()
    try:
        session.query(VerificationToken).filter(VerificationToken.user_id == user.id).delete()
        session.query(User).filter(User.id == user.id).delete()
        session.commit()
    finally:
        session.close()
    return {"message": "Account deleted successfully"}
