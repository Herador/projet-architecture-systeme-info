import json
import os
import time
import uuid
import pika
from sqlalchemy.orm import Session
from shared.database import SessionLocal
from shared.models import Notification
from app.email_sender import send_booking_status_changed, send_new_message

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
EXCHANGE = "notifications"
QUEUE    = "in_app_notifications"

STATUS_LABELS = {
    "pending":   "En attente",
    "accepted":  "Acceptée",
    "refused":   "Refusée",
    "paid":      "Payée",
    "cancelled": "Annulée",
}


def _store(db: Session, user_id: str, type_: str, title: str, body: str):
    notif = Notification(
        id=uuid.uuid4(),
        user_id=user_id,
        type=type_,
        title=title,
        body=body,
    )
    db.add(notif)
    db.commit()


def handle_booking_status_changed(payload: dict):
    new = payload.get("new_status", "")
    label = STATUS_LABELS.get(new, new)
    booking_short = str(payload.get("booking_id", ""))[:8]
    db = SessionLocal()
    try:
        from shared.models import User
        if payload.get("tenant_email"):
            tenant = db.query(User).filter(User.email == payload["tenant_email"]).first()
            if tenant:
                _store(db, str(tenant.id), "booking_status",
                       f"Réservation #{booking_short} — {label}",
                       f"Le statut de votre réservation est passé à « {label} ».")

        if payload.get("owner_email") and new in ("pending", "cancelled"):
            owner = db.query(User).filter(User.email == payload["owner_email"]).first()
            if owner:
                action = "nouvelle demande" if new == "pending" else "annulation"
                _store(db, str(owner.id), "booking_status",
                       f"Réservation #{booking_short} — {action}",
                       f"Vous avez reçu une {action} pour votre bien.")
    finally:
        db.close()

    send_booking_status_changed(payload)


def handle_new_message(payload: dict):
    recipient_email = payload.get("recipient_email")
    if not recipient_email:
        return
    db = SessionLocal()
    try:
        from shared.models import User
        recipient = db.query(User).filter(User.email == recipient_email).first()
        if recipient:
            sender = payload.get("sender_name", "Quelqu'un")
            preview = payload.get("content", "")[:80]
            _store(db, str(recipient.id), "new_message",
                   f"Nouveau message de {sender}",
                   preview)
    finally:
        db.close()

    send_new_message(payload)


HANDLERS = {
    "booking.status_changed": handle_booking_status_changed,
    "message.received":       handle_new_message,
}


def on_message(channel, method, properties, body):
    try:
        payload = json.loads(body)
        handler = HANDLERS.get(method.routing_key)
        if handler:
            handler(payload)
        channel.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as exc:
        print(f"[Consumer] Error: {exc}")
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def start_consumer():
    while True:
        try:
            params = pika.URLParameters(RABBITMQ_URL)
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            channel.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)
            channel.queue_declare(queue=QUEUE, durable=True)
            channel.queue_bind(queue=QUEUE, exchange=EXCHANGE, routing_key="#")
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=QUEUE, on_message_callback=on_message)
            print("[Consumer] Waiting for messages…")
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError:
            print("[Consumer] RabbitMQ not ready, retrying in 5s…")
            time.sleep(5)
        except Exception as exc:
            print(f"[Consumer] Unexpected error: {exc}, retrying in 5s…")
            time.sleep(5)
