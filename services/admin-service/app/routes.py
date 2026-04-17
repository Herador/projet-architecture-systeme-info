from fastapi import APIRouter, Header, HTTPException, Query
from typing import Optional
from shared.models import User, Property, Booking, VerificationToken, Availability, Review, Ticket, AuditLog
from shared.database import SessionLocal
import uuid

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(x_user_role: str = Header(...)):
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return x_user_role


# ── STATS ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(role: str = Header(..., alias="x-user-role")):
    _require_admin(role)
    session = SessionLocal()
    try:
        total_users = session.query(User).count()
        users_by_role = {
            "tenant": session.query(User).filter(User.role == "tenant").count(),
            "owner":  session.query(User).filter(User.role == "owner").count(),
            "admin":  session.query(User).filter(User.role == "admin").count(),
        }

        total_properties = session.query(Property).count()
        properties_by_status = {
            "draft":     session.query(Property).filter(Property.status == "draft").count(),
            "published": session.query(Property).filter(Property.status == "published").count(),
            "archived":  session.query(Property).filter(Property.status == "archived").count(),
        }

        total_bookings = session.query(Booking).count()
        bookings_by_status = {
            "pending":   session.query(Booking).filter(Booking.status == "pending").count(),
            "accepted":  session.query(Booking).filter(Booking.status == "accepted").count(),
            "refused":   session.query(Booking).filter(Booking.status == "refused").count(),
            "paid":      session.query(Booking).filter(Booking.status == "paid").count(),
            "cancelled": session.query(Booking).filter(Booking.status == "cancelled").count(),
        }

        # Total revenue from paid bookings
        from sqlalchemy import func
        revenue_row = session.query(func.sum(Booking.total_price)).filter(Booking.status == "paid").scalar()
        total_revenue = float(revenue_row) if revenue_row else 0.0

        return {
            "users": {"total": total_users, "by_role": users_by_role},
            "properties": {"total": total_properties, "by_status": properties_by_status},
            "bookings": {"total": total_bookings, "by_status": bookings_by_status},
            "revenue": total_revenue,
        }
    finally:
        session.close()


# ── USERS ─────────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    role: str = Header(..., alias="x-user-role"),
    filter_role: Optional[str] = Query(None, alias="role"),
    search: Optional[str] = Query(None),
):
    _require_admin(role)
    session = SessionLocal()
    try:
        query = session.query(User)
        if filter_role:
            query = query.filter(User.role == filter_role)
        if search:
            query = query.filter(
                (User.username.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
            )
        users = query.order_by(User.username).all()
        return [
            {
                "id": str(u.id),
                "username": u.username,
                "email": u.email,
                "role": u.role,
                "is_verified": u.is_verified,
            }
            for u in users
        ]
    finally:
        session.close()


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    payload: dict,
    role: str = Header(..., alias="x-user-role"),
    admin_id: str = Header(..., alias="x-user-id"),
):
    _require_admin(role)
    new_role = payload.get("role")
    if new_role not in ("tenant", "owner", "admin"):
        raise HTTPException(status_code=400, detail="Rôle invalide")
    if user_id == admin_id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas modifier votre propre rôle")

    session = SessionLocal()
    try:
        user = session.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")
        user.role = new_role
        session.commit()
        return {"id": str(user.id), "username": user.username, "role": user.role}
    finally:
        session.close()


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    role: str = Header(..., alias="x-user-role"),
    admin_id: str = Header(..., alias="x-user-id"),
):
    _require_admin(role)
    if user_id == admin_id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte")

    session = SessionLocal()
    try:
        user = session.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")

        session.query(VerificationToken).filter(VerificationToken.user_id == user_id).delete()

        session.query(Review).filter(Review.reviewer_id == user_id).delete()

        session.query(Booking).filter(
            (Booking.tenant_id == user_id) | (Booking.owner_id == user_id)
        ).delete(synchronize_session=False)

        prop_ids = [
            str(p.id)
            for p in session.query(Property.id).filter(Property.owner_id == user_id).all()
        ]
        if prop_ids:
            session.query(Availability).filter(
                Availability.property_id.in_(prop_ids)
            ).delete(synchronize_session=False)
            session.query(Property).filter(Property.owner_id == user_id).delete(
                synchronize_session=False
            )

        session.query(Ticket).filter(Ticket.reported_by == user_id).delete()
        session.query(AuditLog).filter(AuditLog.admin_id == user_id).delete()

        session.delete(user)
        session.commit()
        return {"message": "Utilisateur supprimé"}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ── PROPERTIES ────────────────────────────────────────────────────────────────

@router.get("/properties")
def list_properties(
    role: str = Header(..., alias="x-user-role"),
    filter_status: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
):
    _require_admin(role)
    session = SessionLocal()
    try:
        query = session.query(Property, User).join(User, Property.owner_id == User.id)
        if filter_status:
            query = query.filter(Property.status == filter_status)
        if search:
            query = query.filter(Property.title.ilike(f"%{search}%"))
        rows = query.order_by(Property.created_at.desc()).all()
        return [
            {
                "id": str(p.id),
                "title": p.title,
                "city": p.city,
                "price_per_night": float(p.price_per_night) if p.price_per_night else None,
                "num_rooms": p.num_rooms,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "owner": {"id": str(u.id), "username": u.username, "email": u.email},
            }
            for p, u in rows
        ]
    finally:
        session.close()


@router.patch("/properties/{property_id}/status")
def update_property_status(
    property_id: str,
    payload: dict,
    role: str = Header(..., alias="x-user-role"),
):
    _require_admin(role)
    new_status = payload.get("status")
    if new_status not in ("draft", "published", "archived"):
        raise HTTPException(status_code=400, detail="Statut invalide")

    session = SessionLocal()
    try:
        prop = session.query(Property).filter(Property.id == property_id).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Annonce introuvable")
        prop.status = new_status
        session.commit()
        return {"id": str(prop.id), "title": prop.title, "status": prop.status}
    finally:
        session.close()


@router.delete("/properties/{property_id}")
def delete_property(
    property_id: str,
    role: str = Header(..., alias="x-user-role"),
):
    _require_admin(role)
    session = SessionLocal()
    try:
        prop = session.query(Property).filter(Property.id == property_id).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Annonce introuvable")
        session.query(Availability).filter(Availability.property_id == property_id).delete()
        session.delete(prop)
        session.commit()
        return {"message": "Annonce supprimée"}
    finally:
        session.close()


# ── BOOKINGS ──────────────────────────────────────────────────────────────────

@router.get("/bookings")
def list_bookings(
    role: str = Header(..., alias="x-user-role"),
    filter_status: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
):
    _require_admin(role)
    session = SessionLocal()
    try:
        Tenant = User.__class__
        from sqlalchemy.orm import aliased
        TenantAlias = aliased(User)
        OwnerAlias = aliased(User)

        query = (
            session.query(Booking, Property, TenantAlias, OwnerAlias)
            .join(Property, Booking.property_id == Property.id)
            .join(TenantAlias, Booking.tenant_id == TenantAlias.id)
            .join(OwnerAlias, Booking.owner_id == OwnerAlias.id)
        )
        if filter_status:
            query = query.filter(Booking.status == filter_status)
        if search:
            query = query.filter(
                Property.title.ilike(f"%{search}%") | TenantAlias.username.ilike(f"%{search}%")
            )
        rows = query.order_by(Booking.created_at.desc()).all()
        return [
            {
                "id": str(b.id),
                "status": b.status,
                "check_in": b.check_in.isoformat() if b.check_in else None,
                "check_out": b.check_out.isoformat() if b.check_out else None,
                "total_price": float(b.total_price) if b.total_price else None,
                "created_at": b.created_at.isoformat() if b.created_at else None,
                "property": {"id": str(p.id), "title": p.title, "city": p.city},
                "tenant": {"id": str(t.id), "username": t.username},
                "owner": {"id": str(o.id), "username": o.username},
            }
            for b, p, t, o in rows
        ]
    finally:
        session.close()


@router.delete("/bookings/{booking_id}")
def cancel_booking(
    booking_id: str,
    role: str = Header(..., alias="x-user-role"),
):
    _require_admin(role)
    session = SessionLocal()
    try:
        booking = session.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise HTTPException(status_code=404, detail="Réservation introuvable")
        if booking.status in ("cancelled", "refused"):
            raise HTTPException(status_code=400, detail="Cette réservation est déjà annulée ou refusée")
        booking.status = "cancelled"
        session.commit()
        return {"id": str(booking.id), "status": booking.status}
    finally:
        session.close()
