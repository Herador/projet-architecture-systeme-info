from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Optional, List
from datetime import date
from shared.database import get_db
from shared.models import Property, Availability, Booking
from app.schemas import PropertyResult, PropertyMapResult, AmenityEnum, AMENITY_LABELS
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


# ------------- Liste des équipements disponibles --------------------

@router.get("/amenities")
def get_amenities():
    return [{"value": a.value, "label": AMENITY_LABELS[a.value]} for a in AmenityEnum]


# ------------- Recherche de logements avec filtres -------------------

@router.get("", response_model=list[PropertyResult])
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
):
    query = db.query(Property).filter(
        Property.status == "published",
        Property.price_per_night.isnot(None),
        Property.num_rooms.isnot(None),
    )

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

    # ── Filtres équipements (texte CSV : "wifi,parking,piscine") ──
    if amenities:
        for amenity in amenities:
            query = query.filter(Property.amenities.ilike(f"%{amenity.value}%"))

    # ── Filtre disponibilité ──────────────────────────────────────
    if check_in and check_out:
        # 1) Jours explicitement bloqués dans la table availabilities
        blocked_by_availability = select(Availability.property_id).where(
            Availability.is_blocked.is_(True),
            Availability.date >= check_in,
            Availability.date <= check_out,
        )

        # 2) Réservations actives qui chevauchent la plage demandée
        #    Overlap : booking.check_in < demande.check_out
        #          AND booking.check_out > demande.check_in
        blocked_by_booking = select(Booking.property_id).where(
            Booking.status.in_(["pending", "confirmed"]),
            Booking.check_in < check_out,
            Booking.check_out > check_in,
        )

        query = query.filter(
            Property.id.not_in(blocked_by_availability),
            Property.id.not_in(blocked_by_booking),
        )

    results = query.all()

    # ── Filtre géographique (post-query, Haversine) ───────────────
    if lat and lng and radius_km:
        results = [
            p for p in results
            if p.latitude and p.longitude and
            haversine(lat, lng, p.latitude, p.longitude) <= radius_km
        ]

    return results


# ------------ Marqueurs pour la carte -------------------

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


# ------------ Détail d'un logement -------------------

@router.get("/{property_id}", response_model=PropertyResult)
def get_property_detail(property_id: str, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.status == "published"
    ).first()

    if not prop:
        raise HTTPException(status_code=404, detail="Logement introuvable")

    return prop
