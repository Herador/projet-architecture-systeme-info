import logging
from uuid import UUID

from fastapi import APIRouter, Depends
from httpx import HTTPError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import UserIdentity, get_user_identity
from app.booking_helpers import (
    CANCELLED_BOOKING_STATUS,
    build_bookings_query,
    build_overlap_error,
    calculate_total_price,
    ensure_authenticated,
    ensure_booking_access,
    get_booking_or_error,
    get_existing_review_or_error,
    get_overlapping_booking,
    log_action,
    parse_property_owner_id,
    validate_blocked_dates,
    validate_booking_dates,
    validate_cancellation,
    validate_property_for_booking,
    validate_review_creation,
    validate_status_update,
)
from app.catalog_client import fetch_property, list_blocked_dates, list_published_properties
from app.response import ApiResponse, ErrorCode, error_response
from app.schemas import (
    BookingCreate,
    BookingOut,
    BookingStatusUpdate,
    ConfigOut,
    PropertyOut,
    ReviewCreate,
    ReviewOut,
)
from shared.config import BOOKING_STATUS_VALUES, build_frontend_config
from shared.database import get_db
from shared.models import Booking, Review

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("/properties", response_model=ApiResponse[list[PropertyOut]])
async def list_available_properties():
    try:
        properties = [
            prop
            for prop in await list_published_properties()
            if prop.get("price_per_night") is not None
        ]
    except HTTPError:
        logger.exception("Erreur lors du chargement des propriétés via catalog-service")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de charger les propriétés du catalogue, veuillez réessayer",
            503,
        )

    return ApiResponse.ok(
        properties,
        action="list_properties",
        meta={"count": len(properties)},
    )


@router.post("/", response_model=ApiResponse[BookingOut], status_code=201)
async def create_booking(
    payload: BookingCreate,
    user: UserIdentity = Depends(get_user_identity),
    db: Session = Depends(get_db),
):
    auth_error = ensure_authenticated(user)
    if auth_error:
        return auth_error

    try:
        property_data = await fetch_property(payload.property_id)
    except HTTPError:
        logger.exception("Erreur lors de la récupération de la propriété via catalog-service")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Le service catalogue est momentanément indisponible",
            503,
        )

    property_error = validate_property_for_booking(property_data, user, payload.property_id)
    if property_error:
        return property_error

    dates_error = validate_booking_dates(payload.check_in, payload.check_out)
    if dates_error:
        return dates_error

    try:
        blocked_dates = await list_blocked_dates(
            payload.property_id,
            payload.check_in,
            payload.check_out,
        )
    except (HTTPError, TypeError, ValueError):
        logger.exception("Erreur lors de la vérification des disponibilités via catalog-service")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de vérifier les disponibilités du catalogue, veuillez réessayer",
            503,
        )

    blocked_error = validate_blocked_dates(blocked_dates)
    if blocked_error:
        return blocked_error

    overlapping, overlapping_error = get_overlapping_booking(
        db,
        payload.property_id,
        payload.check_in,
        payload.check_out,
        logger,
    )
    if overlapping_error:
        return overlapping_error
    if overlapping:
        return build_overlap_error(overlapping)

    num_nights = (payload.check_out - payload.check_in).days
    total_price, price_error = calculate_total_price(
        property_data.get("price_per_night"),
        num_nights,
    )
    if price_error:
        return price_error

    owner_uuid, owner_error = parse_property_owner_id(property_data)
    if owner_error:
        return owner_error

    try:
        booking = Booking(
            tenant_id=user["user_id"],
            property_id=payload.property_id,
            owner_id=owner_uuid,
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

    log_action(
        logger,
        "booking_created",
        str(user["user_id"]),
        str(booking.id),
        {"property_id": str(payload.property_id), "total_price": str(total_price)},
    )

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
    user: UserIdentity = Depends(get_user_identity),
    db: Session = Depends(get_db),
):
    auth_error = ensure_authenticated(user)
    if auth_error:
        return auth_error

    query, query_error = build_bookings_query(db, user, status)
    if query_error:
        return query_error

    try:
        bookings = query.order_by(Booking.created_at.desc()).all()
    except SQLAlchemyError:
        logger.exception("Erreur lors du chargement des réservations")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de charger vos réservations, veuillez réessayer",
            500,
        )

    return ApiResponse.ok(
        bookings,
        action="list_bookings",
        meta={"count": len(bookings), "filter": status},
    )


@router.get("/{booking_id}", response_model=ApiResponse[BookingOut])
def get_booking(
    booking_id: UUID,
    user: UserIdentity = Depends(get_user_identity),
    db: Session = Depends(get_db),
):
    auth_error = ensure_authenticated(user)
    if auth_error:
        return auth_error

    booking, booking_error = get_booking_or_error(db, booking_id, logger)
    if booking_error:
        return booking_error

    access_error = ensure_booking_access(booking, user)
    if access_error:
        return access_error

    return ApiResponse.ok(booking, action="get_booking")


@router.patch("/{booking_id}/status", response_model=ApiResponse[BookingOut])
async def update_booking_status(
    booking_id: UUID,
    payload: BookingStatusUpdate,
    user: UserIdentity = Depends(get_user_identity),
    db: Session = Depends(get_db),
):
    auth_error = ensure_authenticated(user)
    if auth_error:
        return auth_error

    booking, booking_error = get_booking_or_error(db, booking_id, logger)
    if booking_error:
        return booking_error

    status_error = validate_status_update(booking, user, payload.status)
    if status_error:
        return status_error

    previous_status = booking.status
    try:
        booking.status = payload.status
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

    log_action(
        logger,
        "status_changed",
        str(user["user_id"]),
        str(booking.id),
        {"from": previous_status, "to": payload.status, "role": user["role"]},
    )

    return ApiResponse.ok(
        booking,
        action="update_status",
        meta={"previous_status": previous_status, "new_status": payload.status},
    )


@router.delete("/{booking_id}")
async def cancel_booking(
    booking_id: UUID,
    user: UserIdentity = Depends(get_user_identity),
    db: Session = Depends(get_db),
):
    auth_error = ensure_authenticated(user)
    if auth_error:
        return auth_error

    booking, booking_error = get_booking_or_error(db, booking_id, logger)
    if booking_error:
        return booking_error

    cancellation_error = validate_cancellation(booking, user)
    if cancellation_error:
        return cancellation_error

    previous_status = booking.status
    try:
        booking.status = CANCELLED_BOOKING_STATUS
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Erreur lors de l'annulation")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible d'annuler la réservation, veuillez réessayer",
            500,
        )

    log_action(
        logger,
        "booking_cancelled",
        str(user["user_id"]),
        str(booking.id),
        {"previous_status": previous_status},
    )

    return ApiResponse.ok(
        None,
        action="cancel_booking",
        meta={"booking_id": str(booking_id), "previous_status": previous_status},
    )


@router.post("/{booking_id}/reviews", response_model=ApiResponse[ReviewOut], status_code=201)
def create_review(
    booking_id: UUID,
    payload: ReviewCreate,
    user: UserIdentity = Depends(get_user_identity),
    db: Session = Depends(get_db),
):
    auth_error = ensure_authenticated(user)
    if auth_error:
        return auth_error

    booking, booking_error = get_booking_or_error(db, booking_id, logger)
    if booking_error:
        return booking_error

    review_access_error = validate_review_creation(booking, user)
    if review_access_error:
        return review_access_error

    existing_review, existing_review_error = get_existing_review_or_error(
        db,
        booking_id,
        user["user_id"],
        payload.target_type,
        logger,
    )
    if existing_review_error:
        return existing_review_error
    if existing_review:
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

    log_action(
        logger,
        "review_created",
        str(user["user_id"]),
        str(review.id),
        {"booking_id": str(booking_id), "rating": payload.rating, "target_type": payload.target_type},
    )

    return ApiResponse.ok(review, action="create_review", meta={"rating": payload.rating})


@router.get("/{booking_id}/reviews", response_model=ApiResponse[list[ReviewOut]])
def list_reviews(
    booking_id: UUID,
    user: UserIdentity = Depends(get_user_identity),
    db: Session = Depends(get_db),
):
    auth_error = ensure_authenticated(user)
    if auth_error:
        return auth_error

    booking, booking_error = get_booking_or_error(db, booking_id, logger)
    if booking_error:
        return booking_error

    access_error = ensure_booking_access(
        booking,
        user,
        "Vous n'avez pas accès aux avis de cette réservation",
    )
    if access_error:
        return access_error

    try:
        reviews = db.query(Review).filter(Review.booking_id == booking_id).all()
    except SQLAlchemyError:
        logger.exception("Erreur lors du chargement des avis")
        return error_response(
            ErrorCode.INTERNAL_ERROR,
            "Impossible de charger les avis, veuillez réessayer",
            500,
        )

    return ApiResponse.ok(
        reviews,
        action="list_reviews",
        meta={"count": len(reviews), "booking_id": str(booking_id)},
    )
