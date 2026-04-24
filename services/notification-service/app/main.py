import threading
from fastapi import FastAPI, Header, HTTPException
from sqlalchemy.orm import Session
from shared.database import SessionLocal, engine
from shared.models import Base, Notification
from app.consumer import start_consumer
import jwt, os

app = FastAPI(title="Notification Service")
JWT_SECRET = os.getenv("JWT_SECRET", "supersecret")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    t = threading.Thread(target=start_consumer, daemon=True)
    t.start()


def _get_user_id(authorization: str) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split("Bearer ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload["user_id"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.get("/notifications")
def list_notifications(authorization: str = Header(None)):
    user_id = _get_user_id(authorization)
    db: Session = SessionLocal()
    try:
        notifs = (
            db.query(Notification)
            .filter(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(30)
            .all()
        )
        return [
            {
                "id":         str(n.id),
                "type":       n.type,
                "title":      n.title,
                "body":       n.body,
                "is_read":    n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifs
        ]
    finally:
        db.close()


@app.patch("/notifications/{notif_id}/read")
def mark_read(notif_id: str, authorization: str = Header(None)):
    user_id = _get_user_id(authorization)
    db: Session = SessionLocal()
    try:
        notif = db.query(Notification).filter(
            Notification.id == notif_id,
            Notification.user_id == user_id,
        ).first()
        if not notif:
            raise HTTPException(status_code=404, detail="Not found")
        notif.is_read = True
        db.commit()
        return {"ok": True}
    finally:
        db.close()


@app.patch("/notifications/read-all")
def mark_all_read(authorization: str = Header(None)):
    user_id = _get_user_id(authorization)
    db: Session = SessionLocal()
    try:
        db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False,
        ).update({"is_read": True})
        db.commit()
        return {"ok": True}
    finally:
        db.close()
