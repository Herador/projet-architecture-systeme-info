from fastapi import FastAPI, Request, Response
from fastapi.openapi.utils import get_openapi
from fastapi.middleware.cors import CORSMiddleware
import time
import requests

from shared.database import engine
from shared.models import Base

app = FastAPI(title="Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(title=app.title, version="1.0.0", routes=app.routes)
    schema.setdefault("components", {})["securitySchemes"] = {
        "BearerAuth": {"type": "http", "scheme": "bearer"}
    }
    for path in schema.get("paths", {}).values():
        for operation in path.values():
            operation["security"] = [{"BearerAuth": []}]
    app.openapi_schema = schema
    return app.openapi_schema


app.openapi = custom_openapi

IDENTITY_SERVICE_URL = "http://identity-service:8000"


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
        except Exception:
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
# IDENTITY SERVICE PROXY
# -----------------------------

def _forward(method: str, path: str, request: Request, payload: dict = None):
    """Forward a request to the identity service, preserving status code and headers."""
    headers = {}
    auth = request.headers.get("Authorization")
    if auth:
        headers["Authorization"] = auth

    try:
        response = requests.request(
            method,
            f"{IDENTITY_SERVICE_URL}{path}",
            json=payload,
            headers=headers,
        )
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type="application/json",
        )
    except Exception as e:
        return {"error": str(e)}


# Public endpoints (no token required)
@app.post("/auth/register")
def register(payload: dict, request: Request):
    return _forward("POST", "/auth/register", request, payload)


@app.post("/auth/login")
def login(payload: dict, request: Request):
    return _forward("POST", "/auth/login", request, payload)


# Authenticated endpoints (token forwarded automatically by _forward)
@app.post("/auth/logout")
def logout(request: Request):
    return _forward("POST", "/auth/logout", request)


@app.post("/auth/verify")
def verify(request: Request):
    return _forward("POST", "/auth/verify", request)


@app.get("/auth/getInfo")
def get_info(request: Request):
    return _forward("GET", "/auth/getInfo", request)


@app.put("/auth/update")
def update(payload: dict, request: Request):
    return _forward("PUT", "/auth/update", request, payload)


@app.delete("/auth/delete")
def delete(request: Request):
    return _forward("DELETE", "/auth/delete", request)
