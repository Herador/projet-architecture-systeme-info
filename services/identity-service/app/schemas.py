from pydantic import BaseModel
from typing import Optional


class CreateAccount(BaseModel):
    username: str
    email: str
    password: str
    confirm_password: str

class Login(BaseModel):
    registration_input: str  # username ou email
    password: str

class UserInfo(BaseModel):
    id: str
    username: str
    email: str
    role: str
    is_verified: bool
    token: Optional[str] = None