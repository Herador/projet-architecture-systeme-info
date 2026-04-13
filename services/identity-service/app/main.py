from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Identity Service")


# --- Simple health check ---
@app.get("/health")
def health():
    return {"status": "ok", "service": "identity"}


# --- Fake user database (for testing only) ---
fake_users = {
    "test@example.com": {
        "email": "test@example.com",
        "password": "1234"  # DO NOT do this in real apps
    }
}


# --- Login request model ---
class LoginRequest(BaseModel):
    email: str
    password: str


# --- Login endpoint ---
@app.post("/login")
def login(data: LoginRequest):
    user = fake_users.get(data.email)

    if not user:
        return {"success": False, "message": "User not found"}

    if user["password"] != data.password:
        return {"success": False, "message": "Invalid password"}

    return {
        "success": True,
        "message": "Login successful",
        "token": "fake-jwt-token-123"
    }