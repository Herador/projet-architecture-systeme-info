import logging
from datetime import date
from decimal import Decimal, InvalidOperation
from uuid import UUID

from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Query, Session

from app.auth import UserIdentity
from app.response import ErrorCode, error_response
from shared.config import (
    BOOKABLE_STATUSES,
    BOOKING_STATUS_LABELS,
    BOOKING_STATUS_VALUES,
    PROPERTY_STATUS_VALUES,
    STATUS_TRANSITIONS,
    USER_ROLE_VALUES,
    can_transition,
    is_valid_booking_status,
    is_valid_user_role,
)
from shared.models import Booking, Review

PUBLISHED_PROPERTY_STATUS = (
    PROPERTY_STATUS_VALUES[1] if len(PROPERTY_STATUS_VALUES) > 1 else "published"
)
PAID_BOOKING_STATUS = BOOKABLE_STATUSES[2]
CANCELLED_BOOKING_STATUS = BOOKING_STATUS_VALUES[4]
TERMINAL_CANCELLATION_STATUSES = {"refused", CANCELLED_BOOKING_STATUS}


def log_action(
    logger: logging.Logger,
    action: str,
    user_id: str,
    resource_id: str | None = None,
    details: dict | None = None,
):
    log_data = {"action": action, "user_id": user_id}
    if resource_id:
        log_data["resource_id"] = resource_id
    if details:
        log_data.update(details)
    logger.info("[ACTION] %s", log_data)


def ensure_authenticated(user: UserIdentity | None) -> JSONResponse | None:
    if not user:
        return error_response(
            ErrorCode.UNAUTHORIZED,
            "Authentification requise",
            401,
            retry_possible=False,
        )

    if not is_valid_user_role(user.get("role", "")):
        return error_response(
            ErrorCode.INVALID_ROLE,
            f"Rôle invalide. Valeurs possibles: {', '.join(USER_ROLE_VALUES)}",
            400,
            field="role",
        )

    return None


def ensure_booking_access(
    booking: Booking,
    user: UserIdentity,
    message: str = "Vous n'avez pas accès à cette réservation",
) -> JSONResponse | None:
    if (
        str(booking.tenant_id) != str(user["user_id"])
        and str(booking.owner_id) != str(user["user_id"])
        and user["role"] != "admin"
    ):
        return error_response(
            ErrorCode.FORBIDDEN,
            message,
            403,
            retry_possible=False,
        )

    return None


def validate_property_for_booking(
    property_data: dict | None,
    user: UserIdentity,
    property_id: UUID,
) -> JSONResponse | None:
    if not property_data:
        return error_response(
            ErrorCode.RESOURCE_NOT_FOUND,
            "Propriété introuvable — vérifiez votre sélection",
            404,
            field="property_id",
            details={"property_id": str(property_id)},
        )

    if property_data.get("status") != PUBLISHED_PROPERTY_STATUS:
        return error_response(
            ErrorCode.PROPERTY_NOT_AVAILABLE,
            "Cette propriété n'est pas disponible à la location",
            400,
            field="property_id",
        )

    owner_id = property_data.get("owner_id")
    if not owner_id:
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Les données de cette propriété sont incomplètes",
            500,
        )

    if str(owner_id) == str(user["user_id"]):
        return error_response(
            ErrorCode.SELF_BOOKING_NOT_ALLOWED,
            "Vous ne pouvez pas réserver votre propre propriété",
            400,
            field="property_id",
        )

    return None


def validate_booking_dates(check_in: date, check_out: date) -> JSONResponse | None:
    if check_in >= check_out:
        return error_response(
            ErrorCode.INVALID_DATES,
            "La date d'arrivée doit être avant la date de départ",
            400,
            field="check_out",
        )

    if check_in < date.today():
        return error_response(
            ErrorCode.PAST_DATE_NOT_ALLOWED,
            "La date d'arrivée ne peut pas être dans le passé",
            400,
            field="check_in",
        )

    return None


def validate_blocked_dates(blocked_dates: set[date]) -> JSONResponse | None:
    if not blocked_dates:
        return None

    blocked = min(blocked_dates)
    return error_response(
        ErrorCode.DATE_UNAVAILABLE,
        f"La date du {blocked.strftime('%d/%m/%Y')} n'est pas disponible",
        409,
        field="check_in",
        retry_possible=False,
    )


def get_overlapping_booking(
    db: Session,
    property_id: UUID,
    check_in: date,
    check_out: date,
    logger: logging.Logger,
) -> tuple[Booking | None, JSONResponse | None]:
    try:
        booking = (
            db.query(Booking)
            .filter(
                Booking.property_id == property_id,
                Booking.status.in_(BOOKABLE_STATUSES),
                Booking.check_in < check_out,
                Booking.check_out > check_in,
            )
            .first()
        )
        return booking, None
    except SQLAlchemyError:
        logger.exception("Erreur lors de la vérification des chevauchements")
        return None, error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de vérifier les réservations existantes, veuillez réessayer",
            500,
        )


def build_overlap_error(overlapping: Booking) -> JSONResponse:
    return error_response(
        ErrorCode.BOOKING_OVERLAP,
        "Ces dates chevauchent une réservation existante "
        f"(du {overlapping.check_in.strftime('%d/%m/%Y')} au {overlapping.check_out.strftime('%d/%m/%Y')})",
        409,
        field="check_in",
        retry_possible=False,
    )


def calculate_total_price(
    price_per_night: object,
    num_nights: int,
) -> tuple[Decimal | None, JSONResponse | None]:
    try:
        return Decimal(str(price_per_night)) * num_nights, None
    except (InvalidOperation, TypeError):
        return None, error_response(
            ErrorCode.VALIDATION_ERROR,
            "Le prix de cette propriété est invalide, contactez le propriétaire",
            400,
            field="price_per_night",
        )


def parse_property_owner_id(
    property_data: dict,
) -> tuple[UUID | None, JSONResponse | None]:
    try:
        return UUID(str(property_data["owner_id"])), None
    except (KeyError, ValueError):
        return None, error_response(
            ErrorCode.INTERNAL_ERROR,
            "Le propriétaire de cette propriété est invalide",
            500,
        )


def get_booking_or_error(
    db: Session,
    booking_id: UUID,
    logger: logging.Logger,
) -> tuple[Booking | None, JSONResponse | None]:
    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
    except SQLAlchemyError:
        logger.exception("Erreur lors de la récupération de la réservation")
        return None, error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de charger la réservation, veuillez réessayer",
            500,
        )

    if not booking:
        return None, error_response(
            ErrorCode.RESOURCE_NOT_FOUND,
            "Réservation introuvable",
            404,
            retry_possible=False,
        )

    return booking, None


def build_bookings_query(
    db: Session,
    user: UserIdentity,
    status: str | None,
) -> tuple[Query | None, JSONResponse | None]:
    query = db.query(Booking)
    if user["role"] == "owner":
        query = query.filter(Booking.owner_id == user["user_id"])
    else:
        query = query.filter(Booking.tenant_id == user["user_id"])

    if not status:
        return query, None

    if not is_valid_booking_status(status):
        return None, error_response(
            ErrorCode.INVALID_STATUS,
            f"Statut invalide. Valeurs possibles : {', '.join(BOOKING_STATUS_VALUES)}",
            400,
            field="status",
        )

    return query.filter(Booking.status == status), None


def validate_status_update(
    booking: Booking,
    user: UserIdentity,
    new_status: str,
) -> JSONResponse | None:
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

    current_status = booking.status
    if can_transition(role, current_status, new_status):
        return None

    status_label = BOOKING_STATUS_LABELS.get(current_status, current_status)
    new_label = BOOKING_STATUS_LABELS.get(new_status, new_status)
    available = STATUS_TRANSITIONS.get(role, {}).get(current_status, [])
    return error_response(
        ErrorCode.INVALID_STATUS_TRANSITION,
        f"Impossible de passer de « {status_label} » à « {new_label} »",
        400,
        field="status",
        retry_possible=False,
        details={
            "current_status": current_status,
            "requested_status": new_status,
            "available_transitions": available,
        },
    )


def validate_cancellation(
    booking: Booking,
    user: UserIdentity,
) -> JSONResponse | None:
    if str(booking.tenant_id) != str(user["user_id"]) and user["role"] != "admin":
        return error_response(
            ErrorCode.FORBIDDEN,
            "Seul le locataire ou un administrateur peut annuler cette réservation",
            403,
            retry_possible=False,
        )

    if booking.status in TERMINAL_CANCELLATION_STATUSES:
        return error_response(
            ErrorCode.ALREADY_TERMINAL,
            "Cette réservation est déjà terminée et ne peut plus être annulée",
            400,
            field="status",
            retry_possible=False,
        )

    if booking.status == PAID_BOOKING_STATUS and user["role"] != "admin":
        return error_response(
            ErrorCode.CANNOT_CANCEL_PAID,
            "Impossible d'annuler une réservation déjà payée — contactez le support",
            400,
            retry_possible=False,
        )

    return None


def validate_review_creation(
    booking: Booking,
    user: UserIdentity,
) -> JSONResponse | None:
    if booking.status != PAID_BOOKING_STATUS:
        return error_response(
            ErrorCode.REVIEW_ONLY_PAID,
            "Vous ne pouvez laisser un avis que sur une réservation payée",
            400,
            field="booking_status",
            retry_possible=False,
        )

    return ensure_booking_access(
        booking,
        user,
        "Vous n'êtes pas concerné par cette réservation",
    )


def get_existing_review_or_error(
    db: Session,
    booking_id: UUID,
    reviewer_id: UUID,
    target_type: str,
    logger: logging.Logger,
) -> tuple[Review | None, JSONResponse | None]:
    try:
        review = (
            db.query(Review)
            .filter_by(
                booking_id=booking_id,
                reviewer_id=reviewer_id,
                target_type=target_type,
            )
            .first()
        )
        return review, None
    except SQLAlchemyError:
        logger.exception("Erreur lors de la vérification des avis existants")
        return None, error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de vérifier vos avis existants, veuillez réessayer",
            500,
        )
