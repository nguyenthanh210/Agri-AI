from typing import Optional, List
from datetime import datetime
from pydantic import Field
from .base import BaseEntity

class CropBatch(BaseEntity):
    farm_id: int
    name: str
    seed_type: Optional[str] = None
    planting_date: Optional[datetime] = None
    expected_harvest_date: Optional[datetime] = None
    status: str = "active"
    qr_code_id: Optional[str] = None
