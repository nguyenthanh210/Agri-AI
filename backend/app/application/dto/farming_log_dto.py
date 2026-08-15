from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

# --- Crop Batch DTOs ---

class CropBatchCreateDTO(BaseModel):
    name: str
    seed_type: Optional[str] = None
    planting_date: Optional[datetime] = None
    expected_harvest_date: Optional[datetime] = None
    status: str = "active"

class CropBatchUpdateDTO(BaseModel):
    name: Optional[str] = None
    seed_type: Optional[str] = None
    planting_date: Optional[datetime] = None
    expected_harvest_date: Optional[datetime] = None
    status: Optional[str] = None

class CropBatchResponseDTO(BaseModel):
    id: int
    farm_id: int
    name: str
    seed_type: Optional[str] = None
    planting_date: Optional[datetime] = None
    expected_harvest_date: Optional[datetime] = None
    status: str
    qr_code_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Farming Log DTOs ---

class FarmingLogCreateDTO(BaseModel):
    activity_type: str
    description: Optional[str] = None
    image_url: Optional[str] = None

class FarmingLogResponseDTO(BaseModel):
    id: int
    batch_id: int
    activity_type: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Traceability DTOs ---

class TraceabilityResponseDTO(BaseModel):
    batch: CropBatchResponseDTO
    logs: List[FarmingLogResponseDTO]
    farm_name: str
