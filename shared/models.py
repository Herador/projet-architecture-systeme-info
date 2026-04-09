import uuid
from sqlalchemy import (
    Column, String, Boolean, Float, Integer,
    Text, Date, DateTime, Numeric, ForeignKey, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


def new_uuid():
    return str(uuid.uuid4())


# ── IDENTITY SERVICE ──────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email            = Column(String(255), unique=True, nullable=False)
    hashed_password  = Column(String(255), nullable=False)
    role             = Column(String(20), nullable=False, default="tenant")  # tenant / owner / admin
    is_verified      = Column(Boolean, default=False)

    # relations
    properties           = relationship("Property", back_populates="owner", foreign_keys="Property.owner_id")
    bookings_as_tenant   = relationship("Booking", back_populates="tenant", foreign_keys="Booking.tenant_id")
    bookings_as_owner    = relationship("Booking", back_populates="owner",  foreign_keys="Booking.owner_id")
    sent_messages        = relationship("Message", back_populates="sender")
    verification_tokens  = relationship("VerificationToken", back_populates="user")


class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token       = Column(String(255), nullable=False)
    expires_at  = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="verification_tokens")


# ── CATALOG SERVICE ───────────────────────────────────────────────────────────

class Property(Base):
    __tablename__ = "properties"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title            = Column(String(255), nullable=False)
    description      = Column(Text)
    city             = Column(String(100))
    address          = Column(String(255))
    latitude         = Column(Float)
    longitude        = Column(Float)
    price_per_night  = Column(Numeric(10, 2))
    num_rooms        = Column(Integer)
    amenities        = Column(Text)          # ex: "wifi,parking,piscine"
    status           = Column(String(20), default="draft")  # draft / published / archived
    created_at       = Column(DateTime, server_default=func.now())
    updated_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())

    owner           = relationship("User", back_populates="properties", foreign_keys=[owner_id])
    availabilities  = relationship("Availability", back_populates="property")
    bookings        = relationship("Booking", back_populates="property")
    conversations   = relationship("Conversation", back_populates="property")


class Availability(Base):
    __tablename__ = "availabilities"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id  = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    date         = Column(Date, nullable=False)
    is_blocked   = Column(Boolean, default=False)

    property = relationship("Property", back_populates="availabilities")


# ── BOOKING SERVICE ───────────────────────────────────────────────────────────

class Booking(Base):
    __tablename__ = "bookings"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    property_id  = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    owner_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    check_in     = Column(Date, nullable=False)
    check_out    = Column(Date, nullable=False)
    total_price  = Column(Numeric(10, 2))
    status       = Column(String(20), default="pending")  # pending / accepted / refused / paid / cancelled
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    tenant   = relationship("User", back_populates="bookings_as_tenant", foreign_keys=[tenant_id])
    owner    = relationship("User", back_populates="bookings_as_owner",  foreign_keys=[owner_id])
    property = relationship("Property", back_populates="bookings")
    reviews  = relationship("Review", back_populates="booking")


# ── INTERACTION SERVICE ───────────────────────────────────────────────────────

class Conversation(Base):
    __tablename__ = "conversations"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id  = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    tenant_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    owner_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at   = Column(DateTime, server_default=func.now())

    property = relationship("Property", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id  = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    sender_id        = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content          = Column(Text, nullable=False)
    is_read          = Column(Boolean, default=False)
    created_at       = Column(DateTime, server_default=func.now())

    conversation = relationship("Conversation", back_populates="messages")
    sender       = relationship("User", back_populates="sent_messages")


class Review(Base):
    __tablename__ = "reviews"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id   = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False)
    reviewer_id  = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reviewed_id  = Column(UUID(as_uuid=True), nullable=False)   # user_id ou property_id
    target_type  = Column(String(20), nullable=False)            # property / user
    rating       = Column(Integer, nullable=False)               # 1 à 5
    comment      = Column(Text)
    created_at   = Column(DateTime, server_default=func.now())

    booking  = relationship("Booking", back_populates="reviews")
    reviewer = relationship("User", foreign_keys=[reviewer_id])


# ── ADMIN SERVICE ─────────────────────────────────────────────────────────────

class Ticket(Base):
    __tablename__ = "tickets"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reported_by  = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    target_type  = Column(String(20), nullable=False)   # user / property / review
    target_id    = Column(UUID(as_uuid=True), nullable=False)
    reason       = Column(Text, nullable=False)
    status       = Column(String(20), default="open")   # open / in_review / closed
    resolved_by  = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at   = Column(DateTime, server_default=func.now())

    reporter = relationship("User", foreign_keys=[reported_by])
    resolver = relationship("User", foreign_keys=[resolved_by])


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action       = Column(String(100), nullable=False)  # ban_user / delete_property / ...
    target_type  = Column(String(20), nullable=False)   # user / property / review
    target_id    = Column(UUID(as_uuid=True), nullable=False)
    created_at   = Column(DateTime, server_default=func.now())

    admin = relationship("User", foreign_keys=[admin_id])
