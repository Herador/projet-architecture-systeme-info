from fastapi import APIRouter, Depends, HTTPException, Query
from app.schemas import CreateProperty, UpdateProperty, PropertyInfo, AvailabilityInput, AvailabilityInfo
from app.security import get_current_user
from shared.models import Property, Availability
from shared.database import SessionLocal
from typing import Optional, List
import uuid

router = APIRouter(prefix="/catalog")


def property_to_info(p: Property) -> PropertyInfo:
    return PropertyInfo(
        id=str(p.id),
        owner_id=str(p.owner_id),
        title=p.title,
        description=p.description,
        city=p.city,
        address=p.address,
        latitude=p.latitude,
        longitude=p.longitude,
        price_per_night=float(p.price_per_night) if p.price_per_night else None,
        num_rooms=p.num_rooms,
        amenities=p.amenities,
        status=p.status,
    )


# Créer une annonce (owner uniquement)
@router.post("/properties", response_model=PropertyInfo)
def create_property(data: CreateProperty, user=Depends(get_current_user)):
    if user.role != "owner":
        raise HTTPException(status_code=403, detail="Seuls les propriétaires peuvent créer des annonces")

    session = SessionLocal()
    try:
        prop = Property(
            id=uuid.uuid4(),
            owner_id=user.id,
            title=data.title,
            description=data.description,
            city=data.city,
            address=data.address,
            latitude=data.latitude,
            longitude=data.longitude,
            price_per_night=data.price_per_night,
            num_rooms=data.num_rooms,
            amenities=data.amenities,
            status="published",
        )
        session.add(prop)
        session.commit()
        session.refresh(prop)
        return property_to_info(prop)
    finally:
        session.close()


# Lister les annonces publiées (public, avec filtres optionnels)
@router.get("/properties", response_model=List[PropertyInfo])
def list_properties(
    city: Optional[str] = Query(None),
    max_price: Optional[float] = Query(None),
    min_rooms: Optional[int] = Query(None),
):
    session = SessionLocal()
    try:
        query = session.query(Property).filter(Property.status == "published")
        if city:
            query = query.filter(Property.city.ilike(f"%{city}%"))
        if max_price is not None:
            query = query.filter(Property.price_per_night <= max_price)
        if min_rooms is not None:
            query = query.filter(Property.num_rooms >= min_rooms)
        return [property_to_info(p) for p in query.all()]
    finally:
        session.close()


# Voir une annonce (public)
@router.get("/properties/{property_id}", response_model=PropertyInfo)
def get_property(property_id: str):
    session = SessionLocal()
    try:
        prop = session.query(Property).filter(Property.id == property_id).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Annonce introuvable")
        return property_to_info(prop)
    finally:
        session.close()


# Modifier une annonce (owner, doit être le propriétaire)
@router.put("/properties/{property_id}", response_model=PropertyInfo)
def update_property(property_id: str, data: UpdateProperty, user=Depends(get_current_user)):
    if user.role != "owner":
        raise HTTPException(status_code=403, detail="Seuls les propriétaires peuvent modifier des annonces")

    session = SessionLocal()
    try:
        prop = session.query(Property).filter(Property.id == property_id).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Annonce introuvable")
        if str(prop.owner_id) != str(user.id):
            raise HTTPException(status_code=403, detail="Ce n'est pas votre annonce")

        for field, value in data.model_dump(exclude_none=True).items():
            setattr(prop, field, value)

        session.commit()
        session.refresh(prop)
        return property_to_info(prop)
    finally:
        session.close()


# Supprimer une annonce (owner, doit être le propriétaire)
@router.delete("/properties/{property_id}")
def delete_property(property_id: str, user=Depends(get_current_user)):
    if user.role != "owner":
        raise HTTPException(status_code=403, detail="Seuls les propriétaires peuvent supprimer des annonces")

    session = SessionLocal()
    try:
        prop = session.query(Property).filter(Property.id == property_id).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Annonce introuvable")
        if str(prop.owner_id) != str(user.id):
            raise HTTPException(status_code=403, detail="Ce n'est pas votre annonce")

        session.query(Availability).filter(Availability.property_id == property_id).delete()
        session.delete(prop)
        session.commit()
        return {"message": "Annonce supprimée"}
    finally:
        session.close()


# Définir la disponibilité d'une date (owner uniquement)
@router.post("/properties/{property_id}/availability", response_model=AvailabilityInfo)
def set_availability(property_id: str, data: AvailabilityInput, user=Depends(get_current_user)):
    if user.role != "owner":
        raise HTTPException(status_code=403, detail="Seuls les propriétaires peuvent gérer les disponibilités")

    session = SessionLocal()
    try:
        prop = session.query(Property).filter(Property.id == property_id).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Annonce introuvable")
        if str(prop.owner_id) != str(user.id):
            raise HTTPException(status_code=403, detail="Ce n'est pas votre annonce")

        existing = session.query(Availability).filter(
            Availability.property_id == property_id,
            Availability.date == data.date
        ).first()

        if existing:
            existing.is_blocked = data.is_blocked
            session.commit()
            session.refresh(existing)
            entry = existing
        else:
            entry = Availability(
                id=uuid.uuid4(),
                property_id=property_id,
                date=data.date,
                is_blocked=data.is_blocked,
            )
            session.add(entry)
            session.commit()
            session.refresh(entry)

        return AvailabilityInfo(
            id=str(entry.id),
            property_id=str(entry.property_id),
            date=entry.date,
            is_blocked=entry.is_blocked,
        )
    finally:
        session.close()


# Voir les disponibilités d'une annonce (public)
@router.get("/properties/{property_id}/availability", response_model=List[AvailabilityInfo])
def get_availability(property_id: str):
    session = SessionLocal()
    try:
        entries = session.query(Availability).filter(Availability.property_id == property_id).all()
        return [
            AvailabilityInfo(
                id=str(e.id),
                property_id=str(e.property_id),
                date=e.date,
                is_blocked=e.is_blocked,
            )
            for e in entries
        ]
    finally:
        session.close()
