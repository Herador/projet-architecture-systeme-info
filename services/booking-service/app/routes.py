import logging
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from uuid import UUID


from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from shared.database import get_db
from shared.models import Booking, Property, Review, Availability
from shared.config import (
    BOOKING_STATUS_VALUES,
    BOOKING_STATUS_LABELS,
    STATUS_TRANSITIONS,
    BOOKABLE_STATUSES,
    PROPERTY_STATUS_VALUES,
    USER_ROLE_VALUES,
    is_valid_booking_status,
    is_valid_user_role,
    can_transition,
    build_frontend_config,
)
from app.schemas import (
    BookingCreate, BookingOut, BookingStatusUpdate,
    ReviewCreate, ReviewOut, PropertyOut, ConfigOut,
)
from app.events import publish_event
from app.response import ApiResponse, ErrorCode, error_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _get_user_id(x_user_id: str = Header(...), x_user_role: str = Header(...)) -> dict:
    try:
        user_id = UUID(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Identifiant utilisateur invalide",
                    "field": "user_id",
                    "retry_possible": True,
                }
            }
        )
    
    if not is_valid_user_role(x_user_role):
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_ROLE",
                    "message": f"Rôle invalide. Valeurs possibles: {', '.join(USER_ROLE_VALUES)}",
                    "field": "role",
                    "retry_possible": True,
                }
            }
        )
    
    return {"user_id": user_id, "role": x_user_role}


def _date_range(start: date, end: date) -> list[date]:
    days = (end - start).days
    return [start + timedelta(days=i) for i in range(days)]


def _log_action(action: str, user_id: str, resource_id: str = None, details: dict = None):
    log_data = {"action": action, "user_id": user_id}
    if resource_id:
        log_data["resource_id"] = resource_id
    if details:
        log_data.update(details)
    logger.info(f"[ACTION] {log_data}")


@router.get("/properties", response_model=ApiResponse[list[PropertyOut]])
def list_available_properties(db: Session = Depends(get_db)):
    try:
        published_status = PROPERTY_STATUS_VALUES[1] if len(PROPERTY_STATUS_VALUES) > 1 else "published"
        properties = (
            db.query(Property)
            .filter(Property.status == published_status)
            .order_by(Property.created_at.desc())
            .all()
        )
        return ApiResponse.ok(
            properties,
            action="list_properties",
            meta={"count": len(properties)},
        )
    except SQLAlchemyError:
        logger.exception("Erreur lors du chargement des propriétés")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de charger les propriétés, veuillez réessayer",
            500,
        )


@router.post("/", response_model=ApiResponse[BookingOut], status_code=201)
async def create_booking(
    payload: BookingCreate,
    user: dict = Depends(_get_user_id),
    db: Session = Depends(get_db),
):
    prop = db.query(Property).filter(Property.id == payload.property_id).first()
    if not prop:
        return error_response(
            ErrorCode.RESOURCE_NOT_FOUND,
            "Propriété introuvable — vérifiez votre sélection",
            404,
            field="property_id",
            details={"property_id": str(payload.property_id)},
        )

    published_status = PROPERTY_STATUS_VALUES[1] if len(PROPERTY_STATUS_VALUES) > 1 else "published"
    if prop.status != published_status:
        return error_response(
            ErrorCode.PROPERTY_NOT_AVAILABLE,
            "Cette propriété n'est pas disponible à la location",
            400,
            field="property_id",
        )

    if str(prop.owner_id) == str(user["user_id"]):
        return error_response(
            ErrorCode.SELF_BOOKING_NOT_ALLOWED,
            "Vous ne pouvez pas réserver votre propre propriété",
            400,
            field="property_id",
        )

    if payload.check_in >= payload.check_out:
        return error_response(
            ErrorCode.INVALID_DATES,
            "La date d'arrivée doit être avant la date de départ",
            400,
            field="check_out",
        )

    if payload.check_in < date.today():
        return error_response(
            ErrorCode.PAST_DATE_NOT_ALLOWED,
            "La date d'arrivée ne peut pas être dans le passé",
            400,
            field="check_in",
        )

    requested_dates = _date_range(payload.check_in, payload.check_out)

    try:
        blocked = (
            db.query(Availability)
            .filter(
                Availability.property_id == payload.property_id,
                Availability.date.in_(requested_dates),
                Availability.is_blocked == True,
            )
            .first()
        )
    except SQLAlchemyError:
        logger.exception("Erreur lors de la vérification des disponibilités")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de vérifier les disponibilités, veuillez réessayer",
            500,
        )

    if blocked:
        return error_response(
            ErrorCode.DATE_UNAVAILABLE,
            f"La date du {blocked.date.strftime('%d/%m/%Y')} n'est pas disponible",
            409,
            field="check_in",
            retry_possible=False,
        )

    try:
        overlapping = (
            db.query(Booking)
            .filter(
                Booking.property_id == payload.property_id,
                Booking.status.in_(BOOKABLE_STATUSES),
                Booking.check_in < payload.check_out,
                Booking.check_out > payload.check_in,
            )
            .first()
        )
    except SQLAlchemyError:
        logger.exception("Erreur lors de la vérification des chevauchements")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de vérifier les réservations existantes, veuillez réessayer",
            500,
        )

    if overlapping:
        return error_response(
            ErrorCode.BOOKING_OVERLAP,
            f"Ces dates chevauchent une réservation existante "
            f"(du {overlapping.check_in.strftime('%d/%m/%Y')} au {overlapping.check_out.strftime('%d/%m/%Y')})",
            409,
            field="check_in",
            retry_possible=False,
        )

    num_nights = (payload.check_out - payload.check_in).days
    try:
        total_price = Decimal(str(prop.price_per_night)) * num_nights
    except (InvalidOperation, TypeError):
        return error_response(
            ErrorCode.VALIDATION_ERROR,
            "Le prix de cette propriété est invalide, contactez le propriétaire",
            400,
            field="price_per_night",
        )

    try:
        booking = Booking(
            tenant_id=user["user_id"],
            property_id=payload.property_id,
            owner_id=prop.owner_id,
            check_in=payload.check_in,
            check_out=payload.check_out,
            total_price=total_price,
            status=BOOKING_STATUS_VALUES[0],
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Erreur lors de la création de la réservation")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de créer la réservation, veuillez réessayer",
            500,
        )

    _log_action(
        "booking_created",
        str(user["user_id"]),
        str(booking.id),
        {"property_id": str(payload.property_id), "total_price": str(total_price)},
    )

    try:
        await publish_event("booking_events", "booking.created", {
            "booking_id": str(booking.id),
            "tenant_id": str(booking.tenant_id),
            "owner_id": str(booking.owner_id),
            "property_id": str(booking.property_id),
            "check_in": str(booking.check_in),
            "check_out": str(booking.check_out),
            "total_price": str(booking.total_price),
        })
    except Exception:
        logger.warning("Impossible de publier l'événement booking.created (RabbitMQ)")

    return ApiResponse.ok(
        booking,
        action="create_booking",
        meta={"status": booking.status, "num_nights": num_nights},
    )


@router.get("/config", response_model=ApiResponse[ConfigOut])
def get_config():
    return ApiResponse.ok(build_frontend_config(), action="get_config")


@router.get("/", response_model=ApiResponse[list[BookingOut]])
def list_bookings(
    status: str | None = None,
    user: dict = Depends(_get_user_id),
    db: Session = Depends(get_db),
):
    auth_error = _check_user(user)
    if auth_error:
        return auth_error

    try:
        query = db.query(Booking)

        if user["role"] == "owner":
            query = query.filter(Booking.owner_id == user["user_id"])
        else:
            query = query.filter(Booking.tenant_id == user["user_id"])

        if status:
            if not is_valid_booking_status(status):
                return error_response(
                    ErrorCode.INVALID_STATUS,
                    f"Statut invalide. Valeurs possibles : {', '.join(BOOKING_STATUS_VALUES)}",
                    400,
                    field="status",
                )
            query = query.filter(Booking.status == status)

        bookings = query.order_by(Booking.created_at.desc()).all()
        return ApiResponse.ok(
            bookings,
            action="list_bookings",
            meta={"count": len(bookings), "filter": status},
        )
    except SQLAlchemyError:
        logger.exception("Erreur lors du chargement des réservations")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de charger vos réservations, veuillez réessayer",
            500,
        )


@router.get("/{booking_id}", response_model=ApiResponse[BookingOut])
def get_booking(
    booking_id: UUID,
    user: dict = Depends(_get_user_id),
    db: Session = Depends(get_db),
):
    auth_error = _check_user(user)
    if auth_error:
        return auth_error

    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
    except SQLAlchemyError:
        logger.exception("Erreur lors de la récupération de la réservation")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de charger la réservation, veuillez réessayer",
            500,
        )

    if not booking:
        return error_response(
            ErrorCode.RESOURCE_NOT_FOUND,
            "Réservation introuvable",
            404,
            retry_possible=False,
        )

    if (
        str(booking.tenant_id) != str(user["user_id"])
        and str(booking.owner_id) != str(user["user_id"])
        and user["role"] != "admin"
    ):
        return error_response(
            ErrorCode.FORBIDDEN,
            "Vous n'avez pas accès à cette réservation",
            403,
            retry_possible=False,
        )

    return ApiResponse.ok(booking, action="get_booking")


@router.patch("/{booking_id}/status", response_model=ApiResponse[BookingOut])
async def update_booking_status(
    booking_id: UUID,
    payload: BookingStatusUpdate,
    user: dict = Depends(_get_user_id),
    db: Session = Depends(get_db),
):
    auth_error = _check_user(user)
    if auth_error:
        return auth_error

    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
    except SQLAlchemyError:
        logger.exception("Erreur lors de la récupération de la réservation")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de charger la réservation, veuillez réessayer",
            500,
        )

    if not booking:
        return error_response(
            ErrorCode.RESOURCE_NOT_FOUND,
            "Réservation introuvable",
            404,
            retry_possible=False,
        )

    new_status = payload.status
    current = booking.status
    role = user["role"]

    if role == "owner" and str(booking.owner_id) != str(user["user_id"]):
        return error_response(
            ErrorCode.FORBIDDEN,
            "Cette réservation ne concerne pas vos propriétés",
            403,
            retry_possible=False,
        )
    if role == "tenant" and str(booking.tenant_id) != str(user["user_id"]):
        return error_response(
            ErrorCode.FORBIDDEN,
            "Cette réservation ne vous appartient pas",
            403,
            retry_possible=False,
        )

    if not can_transition(role, current, new_status):
        status_label = BOOKING_STATUS_LABELS.get(current, current)
        new_label = BOOKING_STATUS_LABELS.get(new_status, new_status)
        available = STATUS_TRANSITIONS.get(role, {}).get(current, [])
        return error_response(
            ErrorCode.INVALID_STATUS_TRANSITION,
            f"Impossible de passer de « {status_label} » à « {new_label} »",
            400,
            field="status",
            retry_possible=False,
            details={"current_status": current, "requested_status": new_status, "available_transitions": available},
        )

    try:
        booking.status = new_status
        db.commit()
        db.refresh(booking)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Erreur lors de la mise à jour du statut")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de mettre à jour la réservation, veuillez réessayer",
            500,
        )

    _log_action(
        "status_changed",
        str(user["user_id"]),
        str(booking.id),
        {"from": current, "to": new_status, "role": role},
    )

    try:
        await publish_event("booking_events", f"booking.{new_status}", {
            "booking_id": str(booking.id),
            "tenant_id": str(booking.tenant_id),
            "owner_id": str(booking.owner_id),
            "property_id": str(booking.property_id),
            "status": new_status,
        })
    except Exception:
        logger.warning(f"Impossible de publier l'événement booking.{new_status} (RabbitMQ)")

    return ApiResponse.ok(
        booking,
        action="update_status",
        meta={"previous_status": current, "new_status": new_status},
    )


@router.delete("/{booking_id}", status_code=204)
async def cancel_booking(
    booking_id: UUID,
    user: dict = Depends(_get_user_id),
    db: Session = Depends(get_db),
):
    auth_error = _check_user(user)
    if auth_error:
        return auth_error

    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
    except SQLAlchemyError:
        logger.exception("Erreur lors de la récupération de la réservation")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de charger la réservation, veuillez réessayer",
            500,
        )

    if not booking:
        return error_response(
            ErrorCode.RESOURCE_NOT_FOUND,
            "Réservation introuvable",
            404,
            retry_possible=False,
        )

    if str(booking.tenant_id) != str(user["user_id"]) and user["role"] != "admin":
        return error_response(
            ErrorCode.FORBIDDEN,
            "Seul le locataire ou un administrateur peut annuler cette réservation",
            403,
            retry_possible=False,
        )

    terminal_statuses = BOOKING_STATUS_VALUES[2:4]
    if booking.status in terminal_statuses:
        return error_response(
            ErrorCode.ALREADY_TERMINAL,
            "Cette réservation est déjà terminée et ne peut plus être annulée",
            400,
            field="status",
            retry_possible=False,
        )

    if booking.status == BOOKABLE_STATUSES[2]:
        return error_response(
            ErrorCode.CANNOT_CANCEL_PAID,
            "Impossible d'annuler une réservation déjà payée — contactez le support",
            400,
            retry_possible=False,
        )

    previous_status = booking.status
    try:
        booking.status = BOOKING_STATUS_VALUES[4]
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Erreur lors de l'annulation")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible d'annuler la réservation, veuillez réessayer",
            500,
        )

    _log_action(
        "booking_cancelled",
        str(user["user_id"]),
        str(booking.id),
        {"previous_status": previous_status},
    )

    try:
        await publish_event("booking_events", "booking.cancelled", {
            "booking_id": str(booking.id),
            "tenant_id": str(booking.tenant_id),
            "owner_id": str(booking.owner_id),
            "property_id": str(booking.property_id),
        })
    except Exception:
        logger.warning("Impossible de publier l'événement booking.cancelled (RabbitMQ)")

    return ApiResponse.ok(
        None,
        action="cancel_booking",
        meta={"booking_id": str(booking_id), "previous_status": previous_status},
    )


@router.post("/{booking_id}/reviews", response_model=ApiResponse[ReviewOut], status_code=201)
def create_review(
    booking_id: UUID,
    payload: ReviewCreate,
    user: dict = Depends(_get_user_id),
    db: Session = Depends(get_db),
):
    auth_error = _check_user(user)
    if auth_error:
        return auth_error

    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
    except SQLAlchemyError:
        logger.exception("Erreur lors de la récupération de la réservation")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de charger la réservation, veuillez réessayer",
            500,
        )

    if not booking:
        return error_response(
            ErrorCode.RESOURCE_NOT_FOUND,
            "Réservation introuvable",
            404,
            retry_possible=False,
        )

    if booking.status != BOOKABLE_STATUSES[2]:
        return error_response(
            ErrorCode.REVIEW_ONLY_PAID,
            "Vous ne pouvez laisser un avis que sur une réservation payée",
            400,
            field="booking_status",
            retry_possible=False,
        )

    if (
        str(booking.tenant_id) != str(user["user_id"])
        and str(booking.owner_id) != str(user["user_id"])
    ):
        return error_response(
            ErrorCode.FORBIDDEN,
            "Vous n'êtes pas concerné par cette réservation",
            403,
            retry_possible=False,
        )

    try:
        existing = (
            db.query(Review)
            .filter(
                Review.booking_id == booking_id,
                Review.reviewer_id == user["user_id"],
                Review.target_type == payload.target_type,
            )
            .first()
        )
    except SQLAlchemyError:
        logger.exception("Erreur lors de la vérification des avis existants")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de vérifier vos avis existants, veuillez réessayer",
            500,
        )

    if existing:
        return error_response(
            ErrorCode.ALREADY_REVIEWED,
            "Vous avez déjà laissé un avis de ce type pour cette réservation",
            409,
            field="target_type",
            retry_possible=False,
        )

    try:
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
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Erreur lors de la création de l'avis")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible d'enregistrer votre avis, veuillez réessayer",
            500,
        )

    _log_action(
        "review_created",
        str(user["user_id"]),
        str(review.id),
        {"booking_id": str(booking_id), "rating": payload.rating, "target_type": payload.target_type},
    )

    return ApiResponse.ok(review, action="create_review", meta={"rating": payload.rating})


@router.get("/{booking_id}/reviews", response_model=ApiResponse[list[ReviewOut]])
def list_reviews(
    booking_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
    except SQLAlchemyError:
        logger.exception("Erreur lors de la récupération de la réservation")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de charger la réservation, veuillez réessayer",
            500,
        )

    if not booking:
        return error_response(
            ErrorCode.RESOURCE_NOT_FOUND,
            "Réservation introuvable",
            404,
            retry_possible=False,
        )

    try:
        reviews = db.query(Review).filter(Review.booking_id == booking_id).all()
        return ApiResponse.ok(
            reviews,
            action="list_reviews",
            meta={"count": len(reviews), "booking_id": str(booking_id)},
        )
    except SQLAlchemyError:
        logger.exception("Erreur lors du chargement des avis")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de charger les avis, veuillez réessayer",
            500,
        )
