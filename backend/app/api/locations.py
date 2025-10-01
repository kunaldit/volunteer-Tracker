from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.connection import get_db
from app.models.location import CampaignLocation
from pydantic import BaseModel
from typing import List, Optional
import json

router = APIRouter()

class LocationCreate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    user_id: int
    stay_duration: Optional[int] = 0
    visit_type: Optional[str] = "door_to_door"
    notes: Optional[str] = None

class LocationResponse(BaseModel):
    id: int
    latitude: float
    longitude: float
    accuracy: Optional[float]
    user_id: int
    stay_duration: int
    visit_type: str
    notes: Optional[str]
    created_at: str

@router.post("/", response_model=dict)
async def create_location(location: LocationCreate, db: Session = Depends(get_db)):
    """Create a new location entry with geospatial data"""
    
    # Check if location is within Lalganj constituency (basic bounds check)
    if not (25.82 <= location.latitude <= 25.90 and 85.10 <= location.longitude <= 85.25):
        raise HTTPException(status_code=400, detail="Location outside Lalganj constituency")
    
    # Create WKT point from coordinates
    point_wkt = f"POINT({location.longitude} {location.latitude})"
    
    query = text("""
        INSERT INTO campaign_locations (user_id, location, accuracy, stay_duration, visit_type, notes)
        VALUES (:user_id, ST_GeomFromText(:point_wkt, 4326), :accuracy, :stay_duration, :visit_type, :notes)
        RETURNING id, ST_X(location) as longitude, ST_Y(location) as latitude
    """)
    
    result = db.execute(query, {
        "user_id": location.user_id,
        "point_wkt": point_wkt,
        "accuracy": location.accuracy,
        "stay_duration": location.stay_duration,
        "visit_type": location.visit_type,
        "notes": location.notes
    })
    
    db.commit()
    row = result.fetchone()
    
    return {
        "id": row.id,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "message": "Location recorded successfully"
    }

@router.get("/heatmap-data")
async def get_heatmap_data(db: Session = Depends(get_db)):
    """Get location data formatted for heatmap visualization"""
    
    query = text("""
        SELECT 
            ST_Y(location) as latitude,
            ST_X(location) as longitude,
            stay_duration,
            COUNT(*) as visit_count,
            AVG(stay_duration) as avg_duration
        FROM campaign_locations 
        WHERE ST_Within(
            location, 
            ST_MakeEnvelope(85.10, 25.82, 85.25, 25.90, 4326)
        )
        GROUP BY latitude, longitude, stay_duration
        ORDER BY visit_count DESC
    """)
    
    result = db.execute(query)
    locations = []
    
    for row in result:
        # Calculate intensity based on visit count and duration
        intensity = min(row.visit_count * 0.1 + row.avg_duration / 300, 1.0)
        locations.append([row.latitude, row.longitude, intensity])
    
    return {"heatmap_points": locations}

@router.get("/coverage-stats")
async def get_coverage_statistics(db: Session = Depends(get_db)):
    """Get campaign coverage statistics"""
    
    query = text("""
        SELECT 
            COUNT(DISTINCT ST_SnapToGrid(location, 0.001)) as unique_locations,
            COUNT(*) as total_visits,
            AVG(stay_duration) as avg_stay_duration,
            SUM(CASE WHEN stay_duration >= 120 THEN 1 ELSE 0 END) as productive_visits
        FROM campaign_locations
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    """)
    
    result = db.execute(query).fetchone()
    
    return {
        "unique_locations_covered": result.unique_locations,
        "total_visits": result.total_visits,
        "average_stay_duration": round(result.avg_stay_duration, 2) if result.avg_stay_duration else 0,
        "productive_visits": result.productive_visits,
        "coverage_efficiency": round((result.productive_visits / result.total_visits) * 100, 2) if result.total_visits > 0 else 0
    }
