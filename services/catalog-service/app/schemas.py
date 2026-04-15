from pydantic import BaseModel
from typing import Optional, List
from datetime import date


class CreateProperty(BaseModel):
    title: str
    description: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    price_per_night: Optional[float] = None
    num_rooms: Optional[int] = None
    amenities: Optional[str] = None  # ex: "wifi,parking,piscine"


class UpdateProperty(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    price_per_night: Optional[float] = None
    num_rooms: Optional[int] = None
    amenities: Optional[str] = None
    status: Optional[str] = None  # draft / published / archived


class PropertyInfo(BaseModel):
    id: str
    owner_id: str
    title: str
    description: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    price_per_night: Optional[float] = None
    num_rooms: Optional[int] = None
    amenities: Optional[str] = None
    status: str


class AvailabilityInput(BaseModel):
    date: date
    is_blocked: bool


class AvailabilityInfo(BaseModel):
    id: str
    property_id: str
    date: date
    is_blocked: bool
