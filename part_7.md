mmodity in commodities:
        if commodity.id == commodity_id:
            return commodity
    return None


def get_chart_data(commodity_id: str) -> List[Dict[str, Any]]:
    """
    Lấy dữ liệu biểu đồ cho một loại nông sản.
    Format phù hợp với biểu đồ candlestick/line chart.
    
    Args:
        commodity_id: ID của nông sản
    
    Returns:
        List of dict với format: [{"date": "2024-01-01", "price": 12500, "open": 12400, "high": 12600, "low": 12300, "close": 12500}]
    """
    commodity = get_commodity_by_id(commodity_id)
    if not commodity:
        return []
    
    chart_data = []
    prices = commodity.prices
    
    for i, price_point in enumerate(prices):
        price = price_point.price
        
        # Tính open, high, low, close
        # Với mock data, chúng ta sẽ tạo dữ liệu giả lập
        # Trong thực tế, API sẽ cung cấp đầy đủ OHLC data
        if i == 0:
            open_price = price
        else:
            open_price = prices[i-1].price
        
        # Tạo high và low dựa trên giá hiện tại (thêm biến động nhỏ)
        high = price * 1.02  # Cao hơn 2%
        low = price * 0.98   # Thấp hơn 2%
        close = price
        
        chart_data.append({
            "date": price_point.date,
            "price": price,
            "open": round(open_price, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close, 2),
            "volume": 0  # Mock data không có volume
        })
    
    return chart_data


# TODO: Khi có API thật hoặc FIWARE, thay thế các function trên bằng các API call
# Ví dụ:
# async def get_all_commodities_from_fiware(...) -> List[CommodityPriceDTO]:
#     async with httpx.AsyncClient() as client:
#         response = await client.get(f"{ORION_URL}/ngsi-ld/v1/entities", params={"type": "AgriCommodityPrice"})
#         return parse_ngsi_ld_response(response.json())

\n`\n\n\n### File: backend\app\infrastructure\external_services\fiware_client.py ###\n`\n"""
FIWARE Orion Context Broker client for NGSI-LD API.
Implements Smart Data Models for Agriculture (AgriFood).
"""
import httpx
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from app.infrastructure.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class FiwareClientError(Exception):
    """Raised when FIWARE returns a non-success response."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        super().__init__(message)

# FIWARE Smart Data Models for Agriculture
CONTEXT = [
    "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
    "https://raw.githubusercontent.com/smart-data-models/dataModel.Agrifood/master/context.jsonld"
]


class FiwareClient:
    """Client for FIWARE Orion Context Broker (NGSI-LD)."""
    
    def __init__(self, orion_url: str = None):
        self.orion_url = orion_url or settings.ORION_URL
        service_path = settings.FIWARE_SERVICEPATH or "/"
        if not service_path.startswith("/"):
            service_path = f"/{service_path}"
        self.headers = {
            "Content-Type": "application/ld+json",
            "Accept": "application/ld+json",
            "FIWARE-Service": settings.FIWARE_SERVICE,
            "FIWARE-ServicePath": service_path
        }
    
    async def health_check(self) -> bool:
        """Check if Orion Context Broker is available."""
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(f"{self.orion_url}/version")
                return response.status_code == 200
            except Exception as e:
                logger.error(f"Orion health check failed: {e}")
                return False
    
    async def create_entity(self, entity: Dict[str, Any]) -> bool:
        """Create a new entity in Orion."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self.orion_url}/ngsi-ld/v1/entities",
                    json=entity,
                    headers=self.headers
                )
                if response.status_code in [201, 204]:
                    logger.info(f"Entity created: {entity.get('id')}")
                    return True
                elif response.status_code == 409:
                    logger.info(f"Entity already exists, updating: {entity.get('id')}")
                    return await self.update_entity(entity["id"], entity)
                else:
                    logger.error(f"Failed to create entity: {response.status_code} - {response.text}")
                    raise FiwareClientError(response.status_code, response.text)
            except Exception as e:
                if isinstance(e, FiwareClientError):
                    raise
                logger.error(f"Error creating entity: {e}")
                raise FiwareClientError(500, str(e))
    
    async def update_entity(self, entity_id: str, attrs: Dict[str, Any]) -> bool:
        """Update entity attributes."""
        # Remove @context and id for PATCH request
        update_attrs = {k: v for k, v in attrs.items() if k not in ["@context", "id", "type"]}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                headers = {
                    "Content-Type": "application/json",
                    "Link": f'<{CONTEXT[0]}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"',
                    "FIWARE-Service": self.headers["FIWARE-Service"],
                    "FIWARE-ServicePath": self.headers["FIWARE-ServicePath"],
                }
                response = await client.patch(
                    f"{self.orion_url}/ngsi-ld/v1/entities/{entity_id}/attrs",
                    json=update_attrs,
                    headers=headers
                )
                if response.status_code in [200, 204]:
                    logger.info(f"Entity updated: {entity_id}")
                    return True
                else:
                    logger.error(f"Failed to update entity: {response.status_code} - {response.text}")
                    raise FiwareClientError(response.status_code, response.text)
            except Exception as e:
                if isinstance(e, FiwareClientError):
                    raise
                logger.error(f"Error updating entity: {e}")
                raise FiwareClientError(500, str(e))
    
    async def get_entity(self, entity_id: str) -> Optional[Dict[str, Any]]:
        """Get entity by ID."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    f"{self.orion_url}/ngsi-ld/v1/entities/{entity_id}",
                    headers=self.headers
                )
                if response.status_code == 200:
                    return response.json()
                if response.status_code == 404:
                    return None
                raise FiwareClientError(response.status_code, response.text)
            except Exception as e:
                if isinstance(e, FiwareClientError):
                    raise
                logger.error(f"Error getting entity: {e}")
                raise FiwareClientError(500, str(e))
    
    async def delete_entity(self, entity_id: str) -> bool:
        """Delete entity by ID."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.delete(
                    f"{self.orion_url}/ngsi-ld/v1/entities/{entity_id}",
                    headers=self.headers
                )
                if response.status_code in [200, 204]:
                    return True
                if response.status_code == 404:
                    return False
                raise FiwareClientError(response.status_code, response.text)
            except Exception as e:
                if isinstance(e, FiwareClientError):
                    raise
                logger.error(f"Error deleting entity: {e}")
                raise FiwareClientError(500, str(e))
    
    async def query_entities(
        self, 
        entity_type: str, 
        q: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Query entities by type."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                params = {"type": entity_type, "limit": limit}
                if q:
                    params["q"] = q
                response = await client.get(
                    f"{self.orion_url}/ngsi-ld/v1/entities",
                    params=params,
                    headers=self.headers
                )
                if response.status_code == 200:
                    return response.json()
                if response.status_code == 404:
                    return []
                raise FiwareClientError(response.status_code, response.text)
            except Exception as e:
                if isinstance(e, FiwareClientError):
                    raise
                logger.error(f"Error querying entities: {e}")
                raise FiwareClientError(500, str(e))
    
    async def subscribe_to_entity(
        self,
        entity_type: str,
        notification_url: str,
        watched_attrs: List[str] = None
    ) -> Optional[str]:
        """Create a subscription for entity changes."""
        subscription = {
            "@context": CONTEXT,
            "type": "Subscription",
            "entities": [{"type": entity_type}],
            "notification": {
                "endpoint": {
                    "uri": notification_url,
                    "accept": "application/json"
                }
            }
        }
        
        if watched_attrs:
            subscription["watchedAttributes"] = watched_attrs
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self.orion_url}/ngsi-ld/v1/subscriptions",
                    json=subscription,
                    headers=self.headers
                )
                if response.status_code in [201, 204]:
                    location = response.headers.get("Location", "")
                    subscription_id = location.split("/")[-1] if location else None
                    logger.info(f"Subscription created: {subscription_id}")
                    return subscription_id
                else:
                    logger.error(f"Failed to create subscription: {response.text}")
                    return None
            except Exception as e:
                logger.error(f"Error creating subscription: {e}")
                return None


# ==================== Smart Data Model Factories ====================

def create_agriparcel_entity(
    farm_id: int, 
    name: str, 
    coordinates: List[Dict], 
    crop_type: str = None,
    area: float = None
) -> Dict[str, Any]:
    """
    Create AgriParcel entity following Smart Data Models.
    https://github.com/smart-data-models/dataModel.Agrifood/tree/master/AgriParcel
    
    Args:
        farm_id: Internal farm ID
        name: Name of the parcel
        coordinates: List of coordinate dicts with 'lat' and 'lng' keys
        crop_type: Type of crop being grown
        area: Area in hectares
    """
    # Convert coordinates to GeoJSON Polygon
    polygon_coords = [[c["lng"], c["lat"]] for c in coordinates]
    if polygon_coords[0] != polygon_coords[-1]:
        polygon_coords.append(polygon_coords[0])  # Close the polygon
    
    now_utc = datetime.now(timezone.utc)
    entity = {
        "@context": CONTEXT,
        "id": f"urn:ngsi-ld:AgriParcel:OpenAgri:{farm_id}",
        "type": "AgriParcel",
        "name": {
            "type": "Property",
            "value": name
        },
        "location": {
            "type": "GeoProperty",
            "value": {
                "type": "Polygon",
                "coordinates": [polygon_coords]
            }
        },
        "dateCreated": {
            "type": "Property",
            "value": _format_datetime(now_utc)
        },
        "dateModified": {
            "type": "Property",
            "value": _format_datetime(now_utc)
        }
    }
    
    if crop_type:
        entity["category"] = {
            "type": "Property",
            "value": crop_type
        }
    
    if area:
        entity["area"] = {
            "type": "Property",
            "value": area,
            "unitCode": "HAR"  # Hectare
        }
    
    return entity


def create_agriparcel_record(
    farm_id: int,
    record_type: str,
    value: float,
    observed_at: datetime,
    unit_code: str = None
) -> Dict[str, Any]:
    """
    Create AgriParcelRecord entity for observations (NDVI, soil moisture, etc.).
    https://github.com/smart-data-models/dataModel.Agrifood/tree/master/AgriParcelRecord
    
    Args:
        farm_id: Internal farm ID
        record_type: Type of record (e.g., 'ndvi', 'soilMoisture')
        value: Measured value
        observed_at: Timestamp of observation
        unit_code: UN/CEFACT unit code
    """
    observed_at_utc = _ensure_utc(observed_at)
    timestamp_str = observed_at_utc.strftime('%Y%m%dT%H%M%S')
    
    entity = {
        "@context": CONTEXT,
        "id": f"urn:ngsi-ld:AgriParcelRecord:OpenAgri:{farm_id}:{record_type}:{timestamp_str}",
        "type": "AgriParcelRecord",
        "hasAgriParcel": {
            "type": "Relationship",
            "object": f"urn:ngsi-ld:AgriParcel:OpenAgri:{farm_id}"
        },
        record_type: {
            "type": "Property",
            "value": value,
            "observedAt": _format_datetime(observed_at_utc)
        },
        "dateObserved": {
            "type": "Property",
            "value": _format_datetime(observed_at_utc)
        }
    }
    
    if unit_code:
        entity[record_type]["unitCode"] = unit_code
    
    return entity


def create_weather_observed(
    location_id: str,
    lat: float,
    lng: float,
    temperature: float = None,
    humidity: float = None,
    precipitation: float = None,
    wind_speed: float = None,
    observed_at: datetime = None
) -> Dict[str, Any]:
    """
    Create WeatherObserved entity.
    https://github.com/smart-data-models/dataModel.Weather/tree/master/WeatherObserved
    
    Args:
        location_id: Identifier for the location
        lat: Latitude
        lng: Longitude
        temperature: Temperature in Celsius
        humidity: Relative humidity (0-100)
        precipitation: Precipitation in mm
        wind_speed: Wind speed in m/s
        observed_at: Observation timestamp
    """
    if observed_at is None:
        observed_at = datetime.now(timezone.utc)
    observed_at_utc = _ensure_utc(observed_at)
    
    timestamp_str = observed_at_utc.strftime('%Y%m%dT%H%M%S')
    
    entity = {
        "@context": CONTEXT,
        "id": f"urn:ngsi-ld:WeatherObserved:OpenAgri:{location_id}:{timestamp_str}",
        "type": "WeatherObserved",
        "location": {
            "type": "GeoProperty",
            "value": {
                "type": "Point",
                "coordinates": [lng, lat]
            }
        },
        "dateObserved": {
            "type": "Property",
            "value": _format_datetime(observed_at_utc)
        }
    }
    
    if temperature is not None:
        entity["temperature"] = {
            "type": "Property",
            "value": temperature,
            "unitCode": "CEL"
        }
    
    if humidity is not None:
        entity["relativeHumidity"] = {
            "type": "Property",
            "value": humidity / 100,  # Convert to 0-1 range
            "unitCode": "P1"  # Percent
        }
    
    if precipitation is not None:
        entity["precipitation"] = {
            "type": "Property",
            "value": precipitation,
            "unitCode": "MMT"  # Millimeter
        }
    
    if wind_speed is not None:
        entity["windSpeed"] = {
            "type": "Property",
            "value": wind_speed,
            "unitCode": "MTS"  # Meters per second
        }
    
    return entity


def create_device_entity(
    device_id: str,
    device_type: str,
    lat: float,
    lng: float,
    farm_id: int = None,
    description: str = None
) -> Dict[str, Any]:
    """
    Create Device entity for IoT sensors.
    https://github.com/smart-data-models/dataModel.Device/tree/master/Device
    
    Args:
        device_id: Unique device identifier
        device_type: Type of device (e.g., 'SoilMoistureSensor', 'TemperatureSensor')
        lat: Latitude
        lng: Longitude
        farm_id: Associated farm ID
        description: Device description
    """
    entity = {
        "@context": CONTEXT,
        "id": f"urn:ngsi-ld:Device:OpenAgri:{device_id}",
        "type": "Device",
        "category": {
            "type": "Property",
            "value": [device_type]
        },
        "location": {
            "type": "GeoProperty",
            "value": {
                "type": "Point",
                "coordinates": [lng, lat]
            }
        },
        "dateInstalled": {
            "type": "Property",
            "value": datetime.utcnow().isoformat() + "Z"
        },
        "controlledProperty": {
            "type": "Property",
            "value": _get_controlled_property(device_type)
        }
    }
    
    if farm_id:
        entity["refAgriParcel"] = {
            "type": "Relationship",
            "object": f"urn:ngsi-ld:AgriParcel:OpenAgri:{farm_id}"
        }
    
    if description:
        entity["description"] = {
            "type": "Property",
            "value": description
        }
    
    return entity


def _get_controlled_property(device_type: str) -> List[str]:
    """Get controlled properties based on device type."""
    property_map = {
        "SoilMoistureSensor": ["soilMoisture"],
        "TemperatureSensor": ["temperature"],
        "HumiditySensor": ["humidity"],
        "WeatherStation": ["temperature", "humidity", "precipitation", "windSpeed"],
        "NDVISensor": ["ndvi"],
    }
    return property_map.get(device_type, ["unknown"])


# ==================== Date/Time Helpers ====================

def _ensure_utc(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware in UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _format_datetime(dt: datetime) -> str:
    """Return ISO string with trailing Z required by FIWARE."""
    dt_utc = _ensure_utc(dt)
    return dt_utc.isoformat().replace("+00:00", "Z")


# ==================== Utility Functions ====================

async def sync_farm_to_fiware(
    fiware_client: FiwareClient,
    farm_id: int,
    farm_name: str,
    coordinates: List[Dict],
    crop_type: str = None
) -> bool:
    """
    Sync a farm entity to FIWARE Orion.
    
    Args:
        fiware_client: FiwareClient instance
        farm_id: Internal farm ID
        farm_name: Name of the farm
        coordinates: List of coordinate dicts
        crop_type: Type of crop
    
    Returns:
        True if successful, False otherwise
    """
    try:
        entity = create_agriparcel_entity(
            farm_id=farm_id,
            name=farm_name,
            coordinates=coordinates,
            crop_type=crop_type
        )
        return await fiware_client.create_entity(entity)
    except FiwareClientError:
        # Propagate FIWARE-specific errors to allow API layer to return proper status
        raise
    except Exception as e:
        logger.error(f"Failed to sync farm {farm_id} to FIWARE: {e}")
        return False


async def sync_observation_to_fiware(
    fiware_client: FiwareClient,
    farm_id: int,
    observation_type: str,
    value: float,
    observed_at: datetime,
    unit_code: str = None
) -> bool:
    """
    Sync an observation record to FIWARE Orion.
    
    Args:
        fiware_client: FiwareClient instance
        farm_id: Internal farm ID
        observation_type: Type of observation (e.g., 'ndvi', 'soilMoisture')
        value: Observed value
        observed_at: Timestamp of observation
        unit_code: UN/CEFACT unit code
    
    Returns:
        True if successful, False otherwise
    """
    try:
        entity = create_agriparcel_record(
            farm_id=farm_id,
            record_type=observation_type,
            value=value,
            observed_at=observed_at,
            unit_code=unit_code
        )
        return await fiware_client.create_entity(entity)
    except FiwareClientError:
        # Propagate FIWARE-specific errors to allow API layer to return proper status
        raise
    except Exception as e:
        logger.error(f"Failed to sync observation for farm {farm_id} to FIWARE: {e}")
        return False
\n`\n\n\n### File: backend\app\infrastructure\external_services\gbif_service.py ###\n`\n"""
GBIF (Global Biodiversity Information Facility) service for pest and biodiversity data.
GBIF API is 100% open source and free to use.
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

try:
    import httpx
except ImportError:
    import requests as httpx

logger = logging.getLogger(__name__)


class GBIFService:
    """
    Service for GBIF API - Open source biodiversity data.
    
    GBIF provides free and open access to biodiversity data.
    License: CC0 1.0 (Public Domain Dedication)
    API Documentation: https://www.gbif.org/developer/summary
    """
    
    BASE_URL = "https://api.gbif.org/v1"
    
    def __init__(self, timeout: int = 30):
        self.timeout = timeout
    
    async def search_occurrences(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 10.0,
        species_key: Optional[int] = None,
        scientific_name: Optional[str] = None,
        year: Optional[int] = None,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Search for species occurrences within a radius around coordinates.
        
        Args:
            latitude: Center latitude
            longitude: Center longitude
            radius_km: Search radius in kilometers (default: 10km)
            species_key: GBIF species key (optional)
            scientific_name: Scientific name of species (optional)
            year: Filter by year (optional)
            limit: Maximum number of results (default: 100, max: 300)
        
        Returns:
            Occurrence data from GBIF
        """
        # Convert radius from km to decimal degrees (approximate)
        # 1 degree latitude ≈ 111 km
        radius_degrees = radius_km / 111.0
        
        # Create bounding box around the point
        # GBIF uses geometry in WKT format
        min_lat = latitude - radius_degrees
        max_lat = latitude + radius_degrees
        min_lng = longitude - radius_degrees
        max_lng = longitude + radius_degrees
        
        # Create WKT POLYGON for the bounding box
        geometry_wkt = f"POLYGON(({min_lng} {min_lat},{max_lng} {min_lat},{max_lng} {max_lat},{min_lng} {max_lat},{min_lng} {min_lat}))"
        
        params = {
            "geometry": geometry_wkt,
            "limit": min(limit, 300),
            "offset": 0
        }
        
        if species_key:
            params["speciesKey"] = species_key
        
        if scientific_name:
            params["scientificName"] = scientific_name
        
        if year:
            params["year"] = year
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/occurrence/search",
                    params=params,
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"Error fetching occurrences from GBIF: {str(e)}")
                raise Exception(f"Failed to fetch GBIF data: {str(e)}")
    
    async def search_species(
        self,
        query: str,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Search for species by name.
        
        Args:
            query: Species name (common or scientific)
            limit: Maximum number of results
        
        Returns:
            Species search results
        """
        params = {
            "q": query,
            "limit": min(limit, 100),
            "offset": 0
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/species/search",
                    params=params,
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"Error searching species from GBIF: {str(e)}")
                raise Exception(f"Failed to search species: {str(e)}")
    
    async def get_species_info(
        self,
        species_key: int
    ) -> Dict[str, Any]:
        """
        Get detailed information about a species.
        
        Args:
            species_key: GBIF species key
        
        Returns:
            Species information
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.BASE_URL}/species/{species_key}",
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"Error fetching species info from GBIF: {str(e)}")
                raise Exception(f"Failed to fetch species info: {str(e)}")
    
    async def get_pest_risk_forecast(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 10.0,
        pest_scientific_names: Optional[List[str]] = None,
        years_back: int = 5
    ) -> Dict[str, Any]:
        """
        Get pest risk forecast based on historical occurrence data.
        
        This method analyzes historical pest occurrences in the area to provide
        early warning about potential pest risks.
        
        Args:
            latitude: Field latitude
            longitude: Field longitude
            radius_km: Search radius in kilometers
            pest_scientific_names: List of pest scientific names to check
            years_back: Number of years to look back for historical data
        
        Returns:
            Pest risk forecast data with historical occurrences and warnings
        """
        import asyncio
        
        current_year = datetime.now().year
        start_year = current_year - years_back
        
        # Common agricultural pests (expanded for better GBIF coverage)
        default_pests = pest_scientific_names or [
            # Rice pests (Asia/India/Vietnam)
            "Nilaparvata lugens",  # Brown planthopper
            "Sogatella furcifera",  # White-backed planthopper
            "Chilo suppressalis",  # Striped stem borer
            "Scirpophaga incertulas",  # Yellow stem borer
            "Cnaphalocrocis medinalis",  # Rice leaffolder
            "Leptocorisa oratorius",  # Rice earhead bug
            "Dicladispa armigera",  # Rice hispa
            
            # Common agricultural pests (Global/USA/Europe - good GBIF coverage)
            "Sitophilus oryzae",  # Rice weevil
            "Tribolium castaneum",  # Red flour beetle
            "Acyrthosiphon pisum",  # Pea aphid
            "Myzus persicae",  # Green peach aphid
            "Diabrotica virgifera",  # Western corn rootworm
            "Helicoverpa armigera",  # Cotton bollworm
            "Spodoptera frugiperda",  # Fall armyworm
            "Agrotis ipsilon",  # Black cutworm
        ]
        
        all_occurrences = []
        pest_summary = {}
        
        async def process_pest(pest_name: str):
            try:
                # Search for species key
                logger.info(f"Searching for species: {pest_name}")
                species_search = await self.search_species(pest_name, limit=1)
                if not species_search.get("results"):
                    logger.warning(f"Species not found in GBIF: {pest_name}")
                    return None
                
                species_key = species_search["results"][0].get("key")
                if not species_key:
                    logger.warning(f"No species key found for: {pest_name}")
                    return None
                
                logger.info(f"Found species key {species_key} for {pest_name}, searching occurrences...")
                
                # Fetch ALL occurrences in ONE request to avoid rate limiting
                try:
                    all_data = await self.search_occurrences(
                        latitude=latitude,
                        longitude=longitude,
                        radius_km=radius_km,
                        species_key=species_key,
                        year=None,  # Don't filter by year
                        limit=300
                    )
                    
                    # Group by year manually
                    yearly_occurrences = {}
                    local_occurrences = []
                    
                    for occurrence in all_data.get("results", []):
                        year = occurrence.get("year")
                        if year and start_year <= year <= current_year:
                            yearly_occurrences[year] = yearly_occurrences.get(year, 0) + 1
                            if len(local_occurrences) < 10:
                                local_occurrences.append(occurrence)
                    
                    if yearly_occurrences:
                        logger.info(f"Found {sum(yearly_occurrences.values())} total occurrences for {pest_name}")
                except Exception as e:
                    logger.error(f"Error fetching occurrences for {pest_name}: {e}")
                    yearly_occurrences = {}
                    local_occurrences = []
                
                if yearly_occurrences:
                    return {
                        "pest_name": pest_name,
                        "data": {
                            "species_key": species_key,
                            "vietnamese_name": None,  # Will be populated below
                            "yearly_occurrences": yearly_occurrences,
                            "total_occurrences": sum(yearly_occurrences.values()),