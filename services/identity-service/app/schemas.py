from pydantic import BaseModel
from datetime import date

class CreateAccount(BaseModel):      # What the client SENDS
    username: str
    email: str
    password: str
    confirm_password: str

class Login(BaseModel):         # What the API RETURNS
    registration_input: str    # can be either username or email
    password: str
    
class UserInfo(BaseModel):
    id: str
    username: str
    email: str
    role: str
    is_verified: bool
    token: str
    