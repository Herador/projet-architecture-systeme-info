from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field
from typing import Optional


# ── Booking ──────────────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    property_id: UUID
    check_in: date
    check_out: date


class BookingStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(accepted|refused|cancelled|paid)$")


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


# ── Review ───────────────────────────────────────────────────────────────────

# ── Property (lecture seule, pour le listing) ────────────────────────────────

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


# ── Review ───────────────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    target_type: str = Field(..., pattern="^(property|user)$")
    reviewed_id: UUID
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


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
