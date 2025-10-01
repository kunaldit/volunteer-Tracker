from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from app.database.connection import Base

class CampaignLocation(Base):
    __tablename__ = "campaign_locations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    location = Column(Geometry('POINT', srid=4326), nullable=False)
    accuracy = Column(Float)
    stay_duration = Column(Integer, default=0)
    visit_type = Column(String(50), default="door_to_door")
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
