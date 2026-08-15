"""
AI Data Transfer Objects.
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class ChatRequestDTO(BaseModel):
    """Request DTO for AI chat."""
    message: str
    context: Optional[dict] = None  # weather, soil, disease, location, crop, ndvi


class ChatResponseDTO(BaseModel):
    """Response DTO for AI chat."""
    response: str
    timestamp: datetime


class FarmInsightRequestDTO(BaseModel):
    """Request DTO for generating farm insights."""
    weather: Optional[dict] = None
    soil: Optional[dict] = None
    disease: Optional[str] = None
    location: Optional[str] = None
    crop: Optional[str] = None
    ndvi: Optional[float] = None


class FarmInsightResponseDTO(BaseModel):
    """Response DTO for farm insights."""
    insights: List[str]
    recommendations: List[str]
    risk_level: str  # "low", "medium", "high", "unknown"
    risk_reason: Optional[str] = None
    generated_at: datetime
