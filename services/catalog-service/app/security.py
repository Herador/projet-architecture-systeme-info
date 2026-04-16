from fastapi import HTTPException, Request
from shared.database import SessionLocal
from shared.models import User, VerificationToken
import jwt
import os

JWT_SECRET_KEY = os.getenv("JWT_SECRET")


def get_current_user(request: Request):
    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header missing or invalid")

    token = authorization.split("Bearer ")[1]

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    session = SessionLocal()
    try:
        db_token = session.query(VerificationToken).filter(VerificationToken.token == token).first()
        if not db_token:
            raise HTTPException(status_code=401, detail="Token not found or revoked")

        user = session.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return user
    finally:
        session.close()
