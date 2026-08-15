from typing import Optional
from datetime import datetime
from pydantic import Field
from .base import BaseEntity

class FarmingLog(BaseEntity):
    batch_id: int
    activity_type: str
    description: Optional[str] = None
    image_url: Optional[str] = None
