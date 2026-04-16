from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date
from uuid import UUID
import enum


class AmenityEnum(str, enum.Enum):
    wifi             = "wifi"
    parking          = "parking"
    piscine          = "piscine"
    climatisation    = "climatisation"
    lave_linge       = "lave_linge"
    televiseur       = "televiseur"
    cuisine_equipee  = "cuisine_equipee"
    animaux_acceptes = "animaux_acceptes"


AMENITY_LABELS: dict[str, str] = {
    AmenityEnum.wifi.value:             "WiFi",
    AmenityEnum.parking.value:          "Parking",
    AmenityEnum.piscine.value:          "Piscine",
    AmenityEnum.climatisation.value:    "Clim",
    AmenityEnum.lave_linge.value:       "Lave-linge",
    AmenityEnum.televiseur.value:       "TV",
    AmenityEnum.cuisine_equipee.value:  "Cuisine",
    AmenityEnum.animaux_acceptes.value: "Animaux",
}


class SearchFilters(BaseModel):
    keyword: Optional[str] = None
    city: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    num_rooms: Optional[int] = None
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    amenities: Optional[List[AmenityEnum]] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_km: Optional[float] = None


class PropertyMapResult(BaseModel):
    id: UUID
    title: str
    latitude: float
    longitude: float
    price_per_night: float

    model_config = ConfigDict(from_attributes=True)


class PropertyResult(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    city: str
    address: str
    latitude: Optional[float]
    longitude: Optional[float]
    price_per_night: float
    num_rooms: int
    amenities: Optional[str]
    status: str
    model_config = ConfigDict(from_attributes=True)
