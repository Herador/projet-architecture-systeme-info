from fastapi import Request
from shared.database import SessionLocal
from shared.models import User
import jwt
import os

JWT_SECRET_KEY = os.getenv("JWT_SECRET")


def get_optional_user(request: Request):
    """Retourne l'utilisateur si le token est valide, sinon None (auth optionnelle)."""
    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split("Bearer ")[1]

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")
    except jwt.InvalidTokenError:
        return None

    session = SessionLocal()
    try:
        user = session.query(User).filter(User.id == user_id).first()
        return user
    finally:
        session.close()
