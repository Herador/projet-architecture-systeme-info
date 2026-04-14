from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date
from shared.models import AmenityEnum

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
    id: str
    title: str
    latitude: float
    longitude: float
    price_per_night: float

    model_config = ConfigDict(from_attributes=True)



class PropertyResult(BaseModel):         
    id: str
    title: str
    description: Optional[str]
    city: str
    address: str
    latitude: Optional[float]
    longitude: Optional[float]
    price_per_night: float
    num_rooms: int
    amenities: Optional[List[AmenityEnum]]
    status: str

    model_config = ConfigDict(from_attributes=True)
