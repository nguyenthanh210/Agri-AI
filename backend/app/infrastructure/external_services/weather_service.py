"""
Weather service for Open-Meteo and Photon API integration.
"""
import logging
from typing import Optional, List, Dict, Any

try:
    import httpx
except ImportError:
    import requests as httpx

logger = logging.getLogger(__name__)


class OpenMeteoService:
    """Service for Open-Meteo weather API."""
    
    BASE_URL = "https://api.open-meteo.com/v1"
    
    def __init__(self, timeout: int = 10):
        self.timeout = timeout
    
    async def get_forecast(
        self, 
        latitude: float, 
        longitude: float,
        hours_ahead: int = 24
    ) -> Dict[str, Any]:
        """
        Get weather forecast from Open-Meteo API.
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
            hours_ahead: Number of hours to forecast (max 240)
        
        Returns:
            Weather forecast data
        """
        if hours_ahead > 240:
            hours_ahead = 240
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/forecast",
                    params={
                        "latitude": latitude,
                        "longitude": longitude,
                        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,is_day",
                        "hourly": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,soil_moisture_0_to_1cm",
                        "forecast_days": (hours_ahead // 24) + 1,
                        "timezone": "auto"
                    },
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"Error fetching forecast from Open-Meteo: {str(e)}")
                raise Exception(f"Failed to fetch weather data: {str(e)}")
    
    async def get_historical_data(
        self,
        latitude: float,
        longitude: float,
        start_date: str,
        end_date: str
    ) -> Dict[str, Any]:
        """
        Get historical weather data.
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
        
        Returns:
            Historical weather data
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/archive",
                    params={
                        "latitude": latitude,
                        "longitude": longitude,
                        "start_date": start_date,
                        "end_date": end_date,
                        "hourly": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
                        "timezone": "auto"
                    },
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"Error fetching historical data: {str(e)}")
                raise Exception(f"Failed to fetch historical data: {str(e)}")


class PhotonGeocodingService:
    """Service for Photon API (reverse geocoding and location search) with Nominatim fallback."""
    
    BASE_URL = "https://photon.komoot.io"
    NOMINATIM_URL = "https://nominatim.openstreetmap.org"
    HEADERS = {
        "User-Agent": "ClosedAgri/1.0 (https://github.com/ICTU-OpenAgri/Closed-Agri; contact@openagri.example.com)"
    }
    
    def __init__(self, timeout: int = 10):
        self.timeout = timeout
    
    async def search_location(
        self,
        query: str,
        limit: int = 10,
        country_codes: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Search for locations by query string.
        
        Args:
            query: Search query (city name, address, etc.)
            limit: Maximum number of results
            country_codes: Filter by country codes (e.g., ['vn'])
        
        Returns:
            Search results with coordinates
        """
        params = {
            "q": query,
            "limit": min(limit, 50)
        }
        
        if country_codes:
            params["osm_tag"] = ",".join(country_codes)
        
        async with httpx.AsyncClient(headers=self.HEADERS) as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/api",
                    params=params,
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"Error searching location: {str(e)}")
                raise Exception(f"Failed to search location: {str(e)}")
    
    async def _reverse_geocode_photon(
        self,
        client: httpx.AsyncClient,
        latitude: float,
        longitude: float,
        limit: int,
    ) -> Dict[str, Any]:
        """Attempt reverse geocoding via Photon (komoot)."""
        params = {
            "lat": latitude,
            "lon": longitude,
            "limit": min(limit, 10),
        }
        response = await client.get(
            f"{self.BASE_URL}/reverse",
            params=params,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

    async def _reverse_geocode_nominatim(
        self,
        client: httpx.AsyncClient,
        latitude: float,
        longitude: float,
    ) -> Dict[str, Any]:
        """
        Fallback reverse geocoding via Nominatim (OpenStreetMap).
        Converts the Nominatim response to a Photon-compatible GeoJSON structure.
        """
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "jsonv2",
            "addressdetails": 1,
        }
        response = await client.get(
            f"{self.NOMINATIM_URL}/reverse",
            params=params,
            timeout=self.timeout,
        )
        response.raise_for_status()
        data = response.json()

        # Normalize to Photon GeoJSON FeatureCollection format
        address = data.get("address", {})
        properties = {
            "name": data.get("name") or address.get("city") or address.get("town") or address.get("village", ""),
            "city": address.get("city") or address.get("town") or address.get("village", ""),
            "state": address.get("state", ""),
            "county": address.get("county", ""),
            "country": address.get("country", ""),
            "country_code": address.get("country_code", "").upper(),
            "postcode": address.get("postcode", ""),
            "osm_id": data.get("osm_id"),
            "osm_type": data.get("osm_type"),
            "type": data.get("type", ""),
        }
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [longitude, latitude],
            },
            "properties": properties,
        }
        return {"type": "FeatureCollection", "features": [feature]}

    async def reverse_geocode(
        self,
        latitude: float,
        longitude: float,
        limit: int = 1
    ) -> Dict[str, Any]:
        """
        Get location name and address from coordinates (reverse geocoding).
        Tries Photon first; falls back to Nominatim on failure.
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
            limit: Maximum number of results
        
        Returns:
            Location information (Photon-compatible GeoJSON FeatureCollection)
        """
        async with httpx.AsyncClient(headers=self.HEADERS) as client:
            try:
                return await self._reverse_geocode_photon(client, latitude, longitude, limit)
            except httpx.HTTPError as e:
                logger.warning(
                    f"Photon reverse geocoding failed ({e}), falling back to Nominatim"
                )
                try:
                    return await self._reverse_geocode_nominatim(client, latitude, longitude)
                except httpx.HTTPError as fallback_err:
                    logger.error(f"Nominatim fallback also failed: {fallback_err}")
                    raise Exception(f"Failed to reverse geocode: {str(fallback_err)}")
