from fastapi import FastAPI
import time
import os
import requests

from shared.database import engine
from shared.models import Base

app = FastAPI()

# -----------------------------
# DB INIT (only here!)
# -----------------------------
def init_db():
    max_retries = 10
    for i in range(max_retries):
        try:
            Base.metadata.create_all(bind=engine)
            print("✅ Database initialized")
            return
        except Exception as e:
            print(f"⏳ DB not ready yet ({i+1}/{max_retries})...")
            time.sleep(2)
    print("❌ Could not connect to DB")


@app.on_event("startup")
def startup():
    init_db()


# -----------------------------
# HEALTH CHECK
# -----------------------------
@app.get("/")
def root():
    return {"message": "Gateway is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


# -----------------------------
# SIMPLE PROXY EXAMPLE
# -----------------------------

IDENTITY_SERVICE_URL = "http://identity-service:8000"

@app.post("/auth/login")
def login(payload: dict):
    try:
        response = requests.post(
            f"{IDENTITY_SERVICE_URL}/login",
            json=payload
        )
        return response.json()
    except Exception as e:
        return {"error": str(e)}


@app.post("/auth/register")
def register(payload: dict):
    try:
        response = requests.post(
            f"{IDENTITY_SERVICE_URL}/register",
            json=payload
        )
        return response.json()
    except Exception as e:
        return {"error": str(e)}