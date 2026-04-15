from fastapi import FastAPI, Request, Response, Query, HTTPException
from typing import List
from fastapi.openapi.utils import get_openapi
from fastapi.middleware.cors import CORSMiddleware
import time
import os
import jwt
import requests

from shared.database import engine, SessionLocal
from shared.models import Base, VerificationToken, User

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
SEARCH_SERVICE_URL   = "http://search-service:8000"
BOOKING_SERVICE_URL = "http://booking-service:8000"

JWT_SECRET_KEY = os.getenv("JWT_SECRET")


# -----------------------------
# JWT HELPER
# -----------------------------
def _decode_token(request: Request) -> dict:
    """Decode JWT and return user info (user_id, role). Raises HTTPException on failure."""
    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header missing or invalid")

    token = authorization.split("Bearer ")[1]

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Vérifier que le token existe en base (non révoqué)
    session = SessionLocal()
    try:
        db_token = session.query(VerificationToken).filter(VerificationToken.token == token).first()
        if not db_token:
            raise HTTPException(status_code=401, detail="Token not found or revoked")

        user = session.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return {"user_id": str(user.id), "role": user.role}
    finally:
        session.close()


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

def _forward(method: str, path: str, request: Request, payload: dict = None, base_url: str = None):
    """Forward a request to a service, preserving status code and headers."""
    if base_url is None:
        base_url = IDENTITY_SERVICE_URL

    headers = {}
    auth = request.headers.get("Authorization")
    if auth:
        headers["Authorization"] = auth

    try:
        response = requests.request(
            method,
            f"{base_url}{path}",
            json=payload,
            headers=headers,
            params=list(request.query_params.multi_items()),
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

@app.get("/search")
def search(
    request: Request,
    keyword: str = None,
    city: str = None,
    min_price: float = None,
    max_price: float = None,
    num_rooms: int = None,
    check_in: str = None,
    check_out: str = None,
    amenities: List[str] = Query(default=None),
    lat: float = None,
    lng: float = None,
    radius_km: float = None,
):
    return _forward("GET", "/search", request, base_url=SEARCH_SERVICE_URL)

@app.get("/search/map")
def search_map(request: Request):
    return _forward("GET", "/search/map", request, base_url=SEARCH_SERVICE_URL)

@app.get("/search/{property_id}")
def search_detail(property_id: str, request: Request):
    return _forward("GET", f"/search/{property_id}", request, base_url=SEARCH_SERVICE_URL)

# -----------------------------
# BOOKING SERVICE PROXY
# -----------------------------

def _forward_booking(method: str, path: str, request: Request, payload: dict = None):
    """Forward a request to the booking service with user identity headers."""
    user = _decode_token(request)

    headers = {
        "x-user-id": user["user_id"],
        "x-user-role": user["role"],
        "Content-Type": "application/json",
    }

    try:
        response = requests.request(
            method,
            f"{BOOKING_SERVICE_URL}{path}",
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


# Routes statiques en premier (avant les routes avec paramètres dynamiques)
@app.get("/bookings/config")
def get_config(request: Request):
    try:
        response = requests.get(f"{BOOKING_SERVICE_URL}/bookings/config")
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type="application/json",
        )
    except Exception as e:
        return {"error": str(e)}


# Properties (lecture des propriétés disponibles)
@app.get("/bookings/properties")
def list_properties():
    try:
        response = requests.get(f"{BOOKING_SERVICE_URL}/bookings/properties")
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type="application/json",
        )
    except Exception as e:
        return {"error": str(e)}


# Bookings CRUD
@app.post("/bookings")
def create_booking(payload: dict, request: Request):
    return _forward_booking("POST", "/bookings/", request, payload)


@app.get("/bookings")
def list_bookings(request: Request):
    return _forward_booking("GET", f"/bookings/?{request.query_params}", request)


# Reviews (avant /{booking_id} pour éviter le conflit de routing)
@app.post("/bookings/{booking_id}/reviews")
def create_review(booking_id: str, payload: dict, request: Request):
    return _forward_booking("POST", f"/bookings/{booking_id}/reviews", request, payload)


@app.get("/bookings/{booking_id}/reviews")
def list_reviews(booking_id: str, request: Request):
    return _forward_booking("GET", f"/bookings/{booking_id}/reviews", request)


@app.patch("/bookings/{booking_id}/status")
def update_booking_status(booking_id: str, payload: dict, request: Request):
    return _forward_booking("PATCH", f"/bookings/{booking_id}/status", request, payload)


@app.delete("/bookings/{booking_id}")
def cancel_booking(booking_id: str, request: Request):
    return _forward_booking("DELETE", f"/bookings/{booking_id}", request)


@app.get("/bookings/{booking_id}")
def get_booking(booking_id: str, request: Request):
    return _forward_booking("GET", f"/bookings/{booking_id}", request)
