from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy import Enum as SAEnum
import enum

class AmenityEnum(str, enum.Enum):
    wifi      = "wifi"
    parking   = "parking"
    piscine   = "piscine"
    climatisation = "climatisation"
    lave_linge = "lave_linge"
    televiseur = "televiseur"
    cuisine_equipee = "cuisine_equipee"
    animaux_acceptes = "animaux_acceptes"

class Property(Base):
    amenities = Column(ARRAY(SAEnum(AmenityEnum, name="amenity_enum")), default=[])