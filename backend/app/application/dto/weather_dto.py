"""
Weather API DTOs.
"""
from typing import Optional, List
from pydantic import BaseModel, Field


class LocationDTO(BaseModel):
    """Location information."""
    name: str
    country: str
    latitude: float
    longitude: float
    address: Optional[str] = None
    
    class Config:
        from_attributes = True


class HourlyWeatherDTO(BaseModel):
    """Hourly weather data."""
    time: str
    temperature_2m: float
    relative_humidity_2m: int
    weather_code: int
    wind_speed_10m: float
    precipitation: float
    soil_moisture_0_to_1cm: Optional[float] = 0.0
    
    class Config:
        from_attributes = True


class CurrentWeatherDTO(BaseModel):
    """Current weather data."""
    time: str
    temperature_2m: float
    relative_humidity_2m: int
    apparent_temperature: Optional[float] = None
    weather_code: int
    wind_speed_10m: float
    precipitation: float
    is_day: int
    
    class Config:
        from_attributes = True


class ForecastResponseDTO(BaseModel):
    """Weather forecast response."""
    location: LocationDTO
    current: CurrentWeatherDTO
    hourly: List[HourlyWeatherDTO]
    
    class Config:
        from_attributes = True


class LocationSearchDTO(BaseModel):
    """Location search result."""
    name: str
    latitude: float
    longitude: float
    country: str
    state: Optional[str] = None
    type: str = Field(default="location")
    
    class Config:
        from_attributes = True


class LocationSearchResponseDTO(BaseModel):
    """Location search response."""
    results: List[LocationSearchDTO]
    count: int
    
    class Config:
        from_attributes = True


class WeatherAnalysisDTO(BaseModel):
    """AI-generated weather analysis for agricultural advice."""
    summary: str
    insights: List[str] = []
    recommendations: List[str] = []
    risk_level: str = "unknown"   # low | medium | high | unknown
    risk_reason: str = ""

    class Config:
        from_attributes = True


class WeatherAnalysisRequestDTO(BaseModel):
    """Request payload for weather analysis."""
    location: str
    temperature: float
    apparent_temperature: float
    humidity: int
    weather_code: int
    wind_speed: float
    precipitation: float
    temp_max: float
    temp_min: float
    crop_type: Optional[str] = "Không xác định"

    class Config:
        from_attributes = True


class ReverseGeocodeDTO(BaseModel):
    """Reverse geocode response."""
    name: str
    country: str
    country_code: str
    state: Optional[str] = None
    address: Optional[str] = None
    latitude: float
    longitude: float
    
    class Config:
        from_attributes = True
