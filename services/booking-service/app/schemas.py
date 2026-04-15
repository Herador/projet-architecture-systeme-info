from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
from typing import Optional

from shared.config import (
    BOOKING_STATUS_VALUES,
    BOOKING_STATUS_LABELS,
    REVIEW_TARGET_TYPES,
    REVIEW_RATING_MIN,
    REVIEW_RATING_MAX,
    build_frontend_config,
)


class BookingCreate(BaseModel):
    property_id: UUID
    check_in: date
    check_out: date


class BookingStatusUpdate(BaseModel):
    status: str = Field(..., description=f"Statut de réservation. Valeurs possibles: {', '.join(BOOKING_STATUS_VALUES)}")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in BOOKING_STATUS_VALUES:
            valid = ", ".join(BOOKING_STATUS_VALUES)
            raise ValueError(f"Statut invalide. Valeurs possibles: {valid}")
        return v


class BookingOut(BaseModel):
    id: UUID
    tenant_id: UUID
    property_id: UUID
    owner_id: UUID
    check_in: date
    check_out: date
    total_price: Optional[Decimal] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PropertyOut(BaseModel):
    id: UUID
    owner_id: UUID
    title: str
    city: Optional[str] = None
    address: Optional[str] = None
    price_per_night: Optional[Decimal] = None
    num_rooms: Optional[int] = None

    class Config:
        from_attributes = True


class ReviewCreate(BaseModel):
    target_type: str = Field(..., description=f"Type de cible. Valeurs possibles: {', '.join(REVIEW_TARGET_TYPES)}")
    reviewed_id: UUID
    rating: int = Field(..., ge=REVIEW_RATING_MIN, le=REVIEW_RATING_MAX)
    comment: Optional[str] = None

    @field_validator("target_type")
    @classmethod
    def validate_target_type(cls, v: str) -> str:
        if v not in REVIEW_TARGET_TYPES:
            raise ValueError(f"Type invalide. Valeurs possibles: {', '.join(REVIEW_TARGET_TYPES)}")
        return v


class ReviewOut(BaseModel):
    id: UUID
    booking_id: UUID
    reviewer_id: UUID
    reviewed_id: UUID
    target_type: str
    rating: int
    comment: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BookingStatusSchema(BaseModel):
    value: str
    label: str
    label_en: str


class UserRoleSchema(BaseModel):
    value: str
    label: str


class PropertyStatusSchema(BaseModel):
    value: str
    label: str


class RatingRangeSchema(BaseModel):
    min: int
    max: int


class ConfigOut(BaseModel):
    booking_statuses: list[BookingStatusSchema]
    user_roles: list[UserRoleSchema]
    property_statuses: list[PropertyStatusSchema]
    review_target_types: list[str]
    review_rating_range: RatingRangeSchema
    status_transitions: dict[str, dict[str, list[str]]]
