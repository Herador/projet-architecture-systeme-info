from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import date
from shared.database import get_db
from shared.models import Property, Availability, AmenityEnum
from app.schemas import PropertyResult, PropertyMapResult
from app.security import get_optional_user
import math

router = APIRouter(prefix="/search")


def haversine(lat1, lng1, lat2, lng2) -> float:
    """Calcule la distance en km entre deux points GPS"""
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat/2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lng/2)**2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Recherche principale ──────────────────────────────────────────────────────

@router.get("/", response_model=list[PropertyResult])
def search_properties(
    keyword: Optional[str] = Query(None, description="Recherche dans le titre et la description"),

    city: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    num_rooms: Optional[int] = Query(None),
    check_in: Optional[date] = Query(None),
    check_out: Optional[date] = Query(None),

    amenities: Optional[List[AmenityEnum]] = Query(None),

    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    radius_km: Optional[float] = Query(None, description="Rayon en km autour de lat/lng"),

    db: Session = Depends(get_db),
    user=Depends(get_optional_user)
):
    query = db.query(Property).filter(Property.status == "published")

    # ── Recherche par mots-clés ───────────────────────────────────
    if keyword:
        query = query.filter(
            Property.title.ilike(f"%{keyword}%") |
            Property.description.ilike(f"%{keyword}%")
        )

    # ── Filtres prix / ville / chambres ───────────────────────────
    if city:
        query = query.filter(Property.city.ilike(f"%{city}%"))
    if min_price is not None:
        query = query.filter(Property.price_per_night >= min_price)
    if max_price is not None:
        query = query.filter(Property.price_per_night <= max_price)
    if num_rooms is not None:
        query = query.filter(Property.num_rooms >= num_rooms)

    # ── Filtres équipements ───────────────────────────────────────
    # amenities est stocké "wifi,parking,piscine" → on cherche chaque valeur
    query = query.filter(Property.amenities.contains(amenities))

    # ── Filtre disponibilité ──────────────────────────────────────
    if check_in and check_out:
        blocked = db.query(Availability.property_id).filter(
            Availability.is_blocked == True,
            Availability.date >= check_in,
            Availability.date <= check_out
        ).subquery()
        query = query.filter(Property.id.not_in(blocked))

    results = query.all()

    # ── Filtre géographique (post-query, Haversine) ───────────────
    # Note : pour une vraie prod → utiliser PostGIS
    if lat and lng and radius_km:
        results = [
            p for p in results
            if p.latitude and p.longitude and
            haversine(lat, lng, p.latitude, p.longitude) <= radius_km
        ]

    return results


# ── Endpoint carte (données allégées pour Leaflet) ────────────────────────────

@router.get("/map", response_model=list[PropertyMapResult])
def get_map_markers(
    city: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    radius_km: Optional[float] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Retourne uniquement id, titre, coordonnées et prix
    → optimisé pour afficher les marqueurs sur la carte Leaflet
    """
    query = db.query(Property).filter(
        Property.status == "published",
        Property.latitude != None,
        Property.longitude != None
    )

    if city:
        query = query.filter(Property.city.ilike(f"%{city}%"))

    results = query.all()

    if lat and lng and radius_km:
        results = [
            p for p in results
            if haversine(lat, lng, p.latitude, p.longitude) <= radius_km
        ]

    return results


# ── Détail d'un logement ──────────────────────────────────────────────────────

@router.get("/{property_id}", response_model=PropertyResult)
def get_property_detail(property_id: str, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.status == "published"
    ).first()

    if not prop:
        raise HTTPException(status_code=404, detail="Logement introuvable")

    return prop