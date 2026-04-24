import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = os.getenv("SMTP_HOST", "mailhog")
SMTP_PORT = int(os.getenv("SMTP_PORT", "1025"))
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@rentalapp.local")

STATUS_LABELS = {
    "pending":   "En attente",
    "accepted":  "Acceptée",
    "refused":   "Refusée",
    "paid":      "Payée",
    "cancelled": "Annulée",
}


def _send(to: str, subject: str, body: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(body, "html", "utf-8"))
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.sendmail(SMTP_FROM, to, msg.as_string())
    print(f"[Email] Sent '{subject}' → {to}")


def send_booking_status_changed(payload: dict) -> None:
    new_status = payload.get("new_status", "")
    label = STATUS_LABELS.get(new_status, new_status)
    booking_id = payload.get("booking_id", "")[:8]

    if payload.get("tenant_email"):
        _send(
            to=payload["tenant_email"],
            subject=f"Votre réservation #{booking_id} — {label}",
            body=f"""
            <p>Bonjour {payload.get('tenant_name', '')},</p>
            <p>Le statut de votre réservation <strong>#{booking_id}</strong>
               est passé à <strong>{label}</strong>.</p>
            <p>— L'équipe RentalApp</p>
            """,
        )

    if payload.get("owner_email") and new_status in ("pending", "cancelled"):
        action = "une nouvelle demande de réservation" if new_status == "pending" else "une annulation de réservation"
        _send(
            to=payload["owner_email"],
            subject=f"Réservation #{booking_id} — {label}",
            body=f"""
            <p>Bonjour {payload.get('owner_name', '')},</p>
            <p>Vous avez reçu {action} pour votre bien (réservation <strong>#{booking_id}</strong>).</p>
            <p>— L'équipe RentalApp</p>
            """,
        )


def send_new_message(payload: dict) -> None:
    recipient_email = payload.get("recipient_email")
    if not recipient_email:
        return
    sender = payload.get("sender_name", "Quelqu'un")
    preview = payload.get("content", "")[:100]
    _send(
        to=recipient_email,
        subject=f"Nouveau message de {sender}",
        body=f"""
        <p>Bonjour {payload.get('recipient_name', '')},</p>
        <p><strong>{sender}</strong> vous a envoyé un message :</p>
        <blockquote>{preview}</blockquote>
        <p>— L'équipe RentalApp</p>
        """,
    )
