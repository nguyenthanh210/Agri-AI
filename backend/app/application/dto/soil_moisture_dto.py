from pydantic import BaseModel
from typing import List, Optional

class SoilMoistureRequest(BaseModel):
    bbox: List[float]
    date: str  # YYYY-MM-DD

class SoilMoistureResponse(BaseModel):
    status: str
    soil_moisture_map: str
    image_base64: str
    mean_value: float = 0.0


# --- New DTOs for scheduled/cached soil moisture ---
class SoilMoistureQueryRequest(BaseModel):
    """Request to get soil moisture from database (cached from scheduler)"""
    farm_id: Optional[int] = None
    bbox: List[float]
    start_date: str  # YYYY-MM-DD or ISO format
    end_date: str    # YYYY-MM-DD or ISO format


class SoilMoistureQueryResponse(BaseModel):
    """Response with soil moisture data from database"""
    status: str
    mean_value: float = 0.0
    min_value: float = 0.0
    max_value: float = 0.0
    acquisition_date: str = ""
    chart_data: List[dict] = []  # [{date, value}]
