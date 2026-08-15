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


class IrrigationAdviceRequestDTO(BaseModel):
    """Request DTO for generating irrigation and fertilization advice."""
    crop_type: str
    growth_stage: str
    soil_moisture: float
    weather_forecast: str


class IrrigationAdviceResponseDTO(BaseModel):
    """Response DTO for irrigation and fertilization advice."""
    action: str  # "irrigate", "wait", "fertilize"
    water_amount_liters_per_m2: float
    fertilizer_suggestion: Optional[str] = None
    reasoning: str
    generated_at: datetime


class YieldFinanceRequestDTO(BaseModel):
    """Request DTO for yield forecasting and financial management."""
    crop_type: str
    area_ha: float
    seed_cost: int
    fertilizer_cost: int
    labor_cost: int
    expected_price_per_kg: int


class YieldFinanceResponseDTO(BaseModel):
    """Response DTO for yield forecasting and financial management."""
    predicted_yield_tons: float
    total_cost_vnd: int
    expected_revenue_vnd: int
    expected_profit_vnd: int
    financial_advice: List[str]
    generated_at: datetime
