from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from shared.database import get_db
from shared.models import Booking, Property, Review, Availability
from app.schemas import (
    BookingCreate, BookingOut, BookingStatusUpdate,
    ReviewCreate, ReviewOut, PropertyOut,
)
from app.events import publish_event

router = APIRouter(prefix="/bookings", tags=["bookings"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_user_id(x_user_id: str = Header(...), x_user_role: str = Header("tenant")) -> dict:
    return {"user_id": UUID(x_user_id), "role": x_user_role}


def _date_range(start: date, end: date) -> list[date]:
    days = (end - start).days
    return [start + timedelta(days=i) for i in range(days)]


# ── GET /bookings/properties – lister les propriétés disponibles ──────────────

@router.get("/properties", response_model=list[PropertyOut])
def list_available_properties(db: Session = Depends(get_db)):
    return (
        db.query(Property)
        .filter(Property.status == "published")
        .order_by(Property.created_at.desc())
        .all()
    )


# ── POST /bookings – créer une réservation ───────────────────────────────────

@router.post("/", response_model=BookingOut, status_code=201)
async def create_booking(
    payload: BookingCreate,
    user: dict = Depends(_get_user_id),
    db: Session = Depends(get_db),
):
    # Vérifier que la propriété existe et est publiée
    prop = db.query(Property).filter(Property.id == payload.property_id).first()
    if not prop:
        raise HTTPException(404, "Propriété introuvable")
    if prop.status != "published":
        raise HTTPException(400, "Cette propriété n'est pas disponible à la location")

    # Un propriétaire ne peut pas réserver son propre bien
    if str(prop.owner_id) == str(user["user_id"]):
        raise HTTPException(400, "Vous ne pouvez pas réserver votre propre propriété")

    # Vérifier les dates
    if payload.check_in >= payload.check_out:
        raise HTTPException(400, "La date d'arrivée doit être avant la date de départ")
    if payload.check_in < date.today():
        raise HTTPException(400, "La date d'arrivée ne peut pas être dans le passé")

    # Vérifier la disponibilité (pas de dates bloquées ni de réservations existantes)
    requested_dates = _date_range(payload.check_in, payload.check_out)

    blocked = (
        db.query(Availability)
        .filter(
            Availability.property_id == payload.property_id,
            Availability.date.in_(requested_dates),
            Availability.is_blocked == True,
        )
        .first()
    )
    if blocked:
        raise HTTPException(409, "Certaines dates ne sont pas disponibles")

    overlapping = (
        db.query(Booking)
        .filter(
            Booking.property_id == payload.property_id,
            Booking.status.in_(["pending", "accepted", "paid"]),
            Booking.check_in < payload.check_out,
            Booking.check_out > payload.check_in,
        )
        .first()
    )
    if overlapping:
        raise HTTPException(409, "Un chevauchement existe avec une réservation existante")

    # Calculer le prix total
    num_nights = (payload.check_out - payload.check_in).days
    total_price = Decimal(str(prop.price_per_night)) * num_nights

    booking = Booking(
        tenant_id=user["user_id"],
        property_id=payload.property_id,
        owner_id=prop.owner_id,
        check_in=payload.check_in,
        check_out=payload.check_out,
        total_price=total_price,
        status="pending",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    # Publier un événement RabbitMQ
    await publish_event("booking_events", "booking.created", {
        "booking_id": str(booking.id),
        "tenant_id": str(booking.tenant_id),
        "owner_id": str(booking.owner_id),
        "property_id": str(booking.property_id),
        "check_in": str(booking.check_in),
        "check_out": str(booking.check_out),
        "total_price": str(booking.total_price),
    })

    return booking


# ── GET /bookings – lister les réservations de l'utilisateur ─────────────────

@router.get("/", response_model=list[BookingOut])
def list_bookings(
    status: str | None = None,
    user: dict = Depends(_get_user_id),
    db: Session = Depends(get_db),
):
    query = db.query(Booking)

    # Un locataire voit ses réservations, un propriétaire celles de ses biens
    if user["role"] == "owner":
        query = query.filter(Booking.owner_id == user["user_id"])
    else:
        query = query.filter(Booking.tenant_id == user["user_id"])

    if status:
        query = query.filter(Booking.status == status)

    return query.order_by(Booking.created_at.desc()).all()


# ── GET /bookings/{id} – détail d'une réservation ───────────────────────────

@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: UUID,
    user: dict = Depends(_get_user_id),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Réservation introuvable")

    # Seuls le locataire, le propriétaire ou un admin peuvent voir la réservation
    if (
        str(booking.tenant_id) != str(user["user_id"])
        and str(booking.owner_id) != str(user["user_id"])
        and user["role"] != "admin"
    ):
        raise HTTPException(403, "Accès refusé")

    return booking


# ── PATCH /bookings/{id}/status – changer le statut ─────────────────────────

@router.patch("/{booking_id}/status", response_model=BookingOut)
async def update_booking_status(
    booking_id: UUID,
    payload: BookingStatusUpdate,
    user: dict = Depends(_get_user_id),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Réservation introuvable")

    new_status = payload.status
    current = booking.status

    # Règles de transition
    allowed_transitions: dict[str, dict[str, list[str]]] = {
        "owner": {
            "pending": ["accepted", "refused"],
        },
        "tenant": {
            "pending": ["cancelled"],
            "accepted": ["paid", "cancelled"],
        },
        "admin": {
            "pending": ["cancelled"],
            "accepted": ["cancelled"],
            "paid": ["cancelled"],
        },
    }

    role = user["role"]
    # Vérifier que l'utilisateur a le droit de modifier ce booking
    if role == "owner" and str(booking.owner_id) != str(user["user_id"]):
        raise HTTPException(403, "Accès refusé")
    if role == "tenant" and str(booking.tenant_id) != str(user["user_id"]):
        raise HTTPException(403, "Accès refusé")

    transitions = allowed_transitions.get(role, {})
    if current not in transitions or new_status not in transitions[current]:
        raise HTTPException(
            400,
            f"Transition de '{current}' vers '{new_status}' non autorisée pour le rôle '{role}'",
        )

    booking.status = new_status
    db.commit()
    db.refresh(booking)

    # Publier l'événement
    await publish_event("booking_events", f"booking.{new_status}", {
        "booking_id": str(booking.id),
        "tenant_id": str(booking.tenant_id),
        "owner_id": str(booking.owner_id),
        "property_id": str(booking.property_id),
        "status": new_status,
    })

    return booking


# ── DELETE /bookings/{id} – annuler (raccourci) ─────────────────────────────

@router.delete("/{booking_id}", status_code=204)
async def cancel_booking(
    booking_id: UUID,
    user: dict = Depends(_get_user_id),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Réservation introuvable")

    if str(booking.tenant_id) != str(user["user_id"]) and user["role"] != "admin":
        raise HTTPException(403, "Seul le locataire ou un admin peut annuler")

    if booking.status in ("refused", "cancelled"):
        raise HTTPException(400, "Cette réservation est déjà terminée")

    booking.status = "cancelled"
    db.commit()

    await publish_event("booking_events", "booking.cancelled", {
        "booking_id": str(booking.id),
        "tenant_id": str(booking.tenant_id),
        "owner_id": str(booking.owner_id),
        "property_id": str(booking.property_id),
    })


# ── POST /bookings/{id}/reviews – laisser un avis ───────────────────────────

@router.post("/{booking_id}/reviews", response_model=ReviewOut, status_code=201)
def create_review(
    booking_id: UUID,
    payload: ReviewCreate,
    user: dict = Depends(_get_user_id),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Réservation introuvable")

    # Seul un booking payé / terminé peut être évalué
    if booking.status != "paid":
        raise HTTPException(400, "Vous ne pouvez évaluer qu'une réservation payée")

    # Seuls le locataire ou le propriétaire concernés peuvent évaluer
    if (
        str(booking.tenant_id) != str(user["user_id"])
        and str(booking.owner_id) != str(user["user_id"])
    ):
        raise HTTPException(403, "Accès refusé")

    # Vérifier qu'il n'a pas déjà laissé un avis du même type
    existing = (
        db.query(Review)
        .filter(
            Review.booking_id == booking_id,
            Review.reviewer_id == user["user_id"],
            Review.target_type == payload.target_type,
        )
        .first()
    )
    if existing:
        raise HTTPException(409, "Vous avez déjà laissé un avis pour cette cible")

    review = Review(
        booking_id=booking_id,
        reviewer_id=user["user_id"],
        reviewed_id=payload.reviewed_id,
        target_type=payload.target_type,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


# ── GET /bookings/{id}/reviews – voir les avis d'une réservation ────────────

@router.get("/{booking_id}/reviews", response_model=list[ReviewOut])
def list_reviews(
    booking_id: UUID,
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Réservation introuvable")
    return db.query(Review).filter(Review.booking_id == booking_id).all()
