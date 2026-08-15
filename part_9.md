parent.parent.parent / "data" / "vietnam_pest_ngsi_ld.json"
        
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading pest data: {e}")
        return {}

VIETNAM_PEST_DATA = load_pest_data()

# Export for use in backend
def get_mock_pest_data_for_vietnam(latitude: float, longitude: float, years_back: int = 10):
    """
    Get realistic mock data for Vietnam rice pests
    Only returns data if coordinates are in Vietnam (approximate check)
    """
    # Simple check if coordinates are in Vietnam
    if not (8.0 <= latitude <= 24.0 and 102.0 <= longitude <= 110.0):
        return None
    
    from datetime import datetime
    current_year = datetime.now().year
    start_year = current_year - years_back
    
    pest_summary = {}
    
    for pest_name, pest_info in VIETNAM_PEST_DATA["pest_data"].items():
        # Filter years based on years_back parameter
        yearly_data = {
            int(year): count 
            for year, count in pest_info["yearly_occurrences"].items()
            if start_year <= int(year) <= current_year
        }
        
        if yearly_data:
            pest_summary[pest_name] = {
                "pest_name": pest_name,
                "species_key": None,  
                "vietnamese_name": pest_info["common_name_vi"],
                "yearly_occurrences": yearly_data,
                "total_occurrences": sum(yearly_data.values()),
                "most_recent_year": max(yearly_data.keys())
            }
    
    # Generate warnings based on recent activity
    warnings = []
    for pest_name, data in pest_summary.items():
        pest_info = VIETNAM_PEST_DATA["pest_data"][pest_name]
        yearly = data["yearly_occurrences"]
        
        # Check recent years
        recent_years = [y for y in yearly.keys() if y >= current_year - 2]
        if recent_years and pest_info["severity"] in ["high", "medium"]:
            risk_level = "high" if pest_info["severity"] == "high" else "medium"
            warnings.append({
                "pest_name": pest_name,
                "vietnamese_name": pest_info["common_name_vi"],
                "risk_level": risk_level,
                "message": f"{pest_info['common_name_vi']} ({pest_name}) xuất hiện {sum(yearly[y] for y in recent_years)} lần trong 2 năm gần đây. {pest_info['damage_level']}.",
                "last_seen_year": max(recent_years),
                "occurrence_count": yearly[max(recent_years)]
            })
    
    return {
        "location": {
            "latitude": latitude,
            "longitude": longitude,
            "radius_km": 10.0
        },
        "pest_summary": pest_summary,
        "warnings": warnings,
        "checked_pests": list(VIETNAM_PEST_DATA["pest_data"].keys()),
        "total_occurrences": sum(data["total_occurrences"] for data in pest_summary.values()),
        "search_period": {
            "start_year": start_year,
            "end_year": current_year
        },
        "data_source": "Vietnam Plant Protection Department reports (NGSI-LD format)",
        "is_mock_data": False
    }

if __name__ == "__main__":
    # Test the function
    import json
    
    # Test with Dong Thap coordinates
    result = get_mock_pest_data_for_vietnam(10.4938, 105.6881, years_back=10)
    print(json.dumps(result, indent=2, ensure_ascii=False))
\n`\n\n\n### File: backend\app\infrastructure\external_services\weather_service.py ###\n`\n"""
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
\n`\n\n\n### File: backend\app\infrastructure\external_services\__init__.py ###\n`\n"""
External services module.
"""
\n`\n\n\n### File: backend\app\infrastructure\image_processing\disease_detection.py ###\n`\nimport logging
import os
import numpy as np

logger = logging.getLogger(__name__)
from PIL import Image
import tensorflow as tf
from pathlib import Path
from typing import List, Dict, Any
import io
from .disease_info import DISEASE_INFO

import asyncio
from concurrent.futures import ThreadPoolExecutor

class DiseaseDetectionService:
    _instance = None
    _model = None
    _class_names = None
    
    _vietnamese_names = {
        "Apple___Apple_scab": "Táo - Bệnh vảy táo",
        "Apple___Black_rot": "Táo - Bệnh thối đen",
        "Apple___Cedar_apple_rust": "Táo - Bệnh gỉ sắt tuyết tùng",
        "Apple___healthy": "Táo - Khỏe mạnh",
        "Bacterial Leaf Blight": "Lúa - Bệnh bạc lá vi khuẩn",
        "Blueberry___healthy": "Việt quất - Khỏe mạnh",
        "Brown Spot": "Lúa - Bệnh đốm nâu",
        "Cherry_(including_sour)___Powdery_mildew": "Anh đào - Bệnh phấn trắng",
        "Cherry_(including_sour)___healthy": "Anh đào - Khỏe mạnh",
        "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "Ngô - Bệnh đốm lá xám",
        "Corn_(maize)___Common_rust_": "Ngô - Bệnh gỉ sắt thường",
        "Corn_(maize)___Northern_Leaf_Blight": "Ngô - Bệnh cháy lá lớn",
        "Corn_(maize)___healthy": "Ngô - Khỏe mạnh",
        "Grape___Black_rot": "Nho - Bệnh thối đen",
        "Grape___Esca_(Black_Measles)": "Nho - Bệnh Esca (Sởi đen)",
        "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": "Nho - Bệnh cháy lá",
        "Grape___healthy": "Nho - Khỏe mạnh",
        "Healthy Rice Leaf": "Lúa - Khỏe mạnh",
        "Leaf Blast": "Lúa - Bệnh đạo ôn lá",
        "Leaf scald": "Lúa - Bệnh cháy bìa lá",
        "Narrow Brown Leaf Spot": "Lúa - Bệnh đốm nâu hẹp",
        "Orange___Haunglongbing_(Citrus_greening)": "Cam - Bệnh vàng lá gân xanh",
        "Peach___Bacterial_spot": "Đào - Bệnh đốm vi khuẩn",
        "Peach___healthy": "Đào - Khỏe mạnh",
        "Pepper,_bell___Bacterial_spot": "Ớt chuông - Bệnh đốm vi khuẩn",
        "Pepper,_bell___healthy": "Ớt chuông - Khỏe mạnh",
        "Potato___Early_blight": "Khoai tây - Bệnh đốm vòng",
        "Potato___Late_blight": "Khoai tây - Bệnh mốc sương",
        "Potato___healthy": "Khoai tây - Khỏe mạnh",
        "Raspberry___healthy": "Mâm xôi - Khỏe mạnh",
        "Rice Hispa": "Lúa - Sâu gai",
        "Sheath Blight": "Lúa - Bệnh khô vằn",
        "Soybean___healthy": "Đậu nành - Khỏe mạnh",
        "Squash___Powdery_mildew": "Bí - Bệnh phấn trắng",
        "Strawberry___Leaf_scorch": "Dâu tây - Bệnh cháy lá",
        "Strawberry___healthy": "Dâu tây - Khỏe mạnh",
        "Tomato___Bacterial_spot": "Cà chua - Bệnh đốm vi khuẩn",
        "Tomato___Early_blight": "Cà chua - Bệnh đốm vòng",
        "Tomato___Late_blight": "Cà chua - Bệnh mốc sương",
        "Tomato___Leaf_Mold": "Cà chua - Bệnh mốc lá",
        "Tomato___Septoria_leaf_spot": "Cà chua - Bệnh đốm lá Septoria",
        "Tomato___Spider_mites Two-spotted_spider_mite": "Cà chua - Nhện đỏ",
        "Tomato___Target_Spot": "Cà chua - Bệnh đốm đích",
        "Tomato___Tomato_Yellow_Leaf_Curl_Virus": "Cà chua - Virus xoăn vàng lá",
        "Tomato___Tomato_mosaic_virus": "Cà chua - Virus khảm",
        "Tomato___healthy": "Cà chua - Khỏe mạnh"
    }

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DiseaseDetectionService, cls).__new__(cls)
            cls._instance._load_resources()
        return cls._instance

    def _load_resources(self):
        """Load the model and class names."""
        try:
            # Calculate paths relative to this file
            current_dir = Path(__file__).parent
            # backend/app/infrastructure/image_processing/ -> backend/ml_models/
            base_dir = current_dir.parent.parent.parent
            model_path = base_dir / "ml_models" / "leaf_disease_model.keras"
            class_names_path = base_dir / "ml_models" / "class_names.txt"

            logger.info(f"Loading model from: {model_path}")
            self._model = tf.keras.models.load_model(model_path)
            
            logger.info(f"Loading class names from: {class_names_path}")
            with open(class_names_path, "r") as f:
                self._class_names = [line.strip() for line in f.readlines()]
                
        except Exception as e:
            logger.error(f"Error loading disease detection resources: {e}")
            # We might want to raise this or handle it gracefully depending on requirements
            # For now, we'll let it fail if called later if resources aren't loaded
            pass

    async def predict(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Predict disease from an image (Async wrapper).
        Runs the CPU-bound prediction in a thread pool.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._predict_sync, image_bytes)

    def _predict_sync(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Synchronous prediction logic.
        """
        if self._model is None or self._class_names is None:
            self._load_resources()
            if self._model is None:
                raise RuntimeError("Model not loaded successfully")

        try:
            # Preprocess image
            img = Image.open(io.BytesIO(image_bytes))
            img = img.convert('RGB')
            img = img.resize((224, 224)) # Assuming standard input size, adjust if needed
            
            img_array = tf.keras.preprocessing.image.img_to_array(img)
            img_array = tf.expand_dims(img_array, 0) # Create a batch

            # Predict
            predictions = self._model.predict(img_array)
            score = predictions[0]  # Model already has softmax activation

            # Get top prediction
            predicted_index = np.argmax(score)
            class_name = self._class_names[predicted_index]
            confidence = float(score[predicted_index])
            
            vietnamese_name = self._vietnamese_names.get(class_name, class_name)
            disease_info = DISEASE_INFO.get(class_name, {})
            
            result = {
                "vietnamese_name": vietnamese_name,
                "class": class_name,
                "confidence": confidence,
                "description": disease_info.get("description", ""),
                "symptoms": disease_info.get("symptoms", []),
                "treatment": disease_info.get("treatment", []),
                "prevention": disease_info.get("prevention", []),
                "severity": disease_info.get("severity", "")
            }
            
            return result

        except Exception as e:
            logger.error(f"Error during prediction: {e}")
            raise e

# Global instance
disease_detection_service = DiseaseDetectionService()\n`\n\n\n### File: backend\app\infrastructure\image_processing\disease_info.py ###\n`\n
DISEASE_INFO = {
    "Apple___Apple_scab": {
        "description": "Bệnh vảy táo do nấm Venturia inaequalis gây ra. Bệnh gây hại trên lá, quả và cành non.",
        "symptoms": [
            "Các đốm màu ô liu hoặc đen nhung trên lá và quả.",
            "Lá bị biến dạng, xoắn lại và rụng sớm.",
            "Quả bị sần sùi, nứt nẻ và biến dạng."
        ],
        "treatment": [
            "Phun thuốc diệt nấm chứa Captan, Mancozeb hoặc Myclobutanil.",
            "Loại bỏ và tiêu hủy lá và quả bị bệnh.",
            "Cắt tỉa cành để tạo độ thông thoáng."
        ],
        "prevention": [
            "Trồng các giống táo kháng bệnh.",
            "Vệ sinh vườn sạch sẽ, thu gom lá rụng vào mùa đông.",
            "Tưới nước vào gốc, tránh làm ướt lá."
        ],
        "severity": "Trung bình"
    },
    "Apple___Black_rot": {
        "description": "Bệnh thối đen do nấm Botryosphaeria obtusa gây ra. Bệnh ảnh hưởng đến quả, lá và vỏ cây.",
        "symptoms": [
            "Các đốm tròn màu nâu trên lá (đốm mắt ếch).",
            "Quả bị thối, chuyển sang màu đen và khô lại (xác ướp).",
            "Vết loét trên cành và thân cây."
        ],
        "treatment": [
            "Cắt bỏ các cành bị bệnh và tiêu hủy.",
            "Phun thuốc diệt nấm gốc đồng hoặc Captan.",
            "Loại bỏ các quả khô (xác ướp) còn sót lại trên cây."
        ],
        "prevention": [
            "Giữ cho cây khỏe mạnh, bón phân cân đối.",
            "Tránh làm tổn thương vỏ cây khi chăm sóc.",
            "Kiểm soát côn trùng gây hại."
        ],
        "severity": "Cao"
    },
    "Apple___Cedar_apple_rust": {
        "description": "Bệnh gỉ sắt tuyết tùng-táo là bệnh do nấm Gymnosporangium juniperi-virginianae gây ra. Bệnh cần hai vật chủ là cây táo và cây tuyết tùng để hoàn thành vòng đời.",
        "symptoms": [
            "Các đốm màu vàng cam sáng trên mặt trên của lá táo.",
            "Mặt dưới lá xuất hiện các cấu trúc hình ống nhỏ.",
            "Quả cũng có thể bị nhiễm bệnh và biến dạng."
        ],
        "treatment": [
            "Phun thuốc diệt nấm chứa Myclobutanil hoặc Mancozeb vào mùa xuân.",
            "Loại bỏ các u sưng trên cây tuyết tùng gần đó nếu có thể."
        ],
        "prevention": [
            "Trồng các giống táo kháng bệnh.",
            "Loại bỏ cây tuyết tùng đỏ trong bán kính gần vườn táo (nếu khả thi)."
        ],
        "severity": "Trung bình"
    },
    "Apple___healthy": {
        "description": "Cây táo khỏe mạnh, không có dấu hiệu bệnh tật.",
        "symptoms": [],
        "treatment": [],
        "prevention": [
            "Duy trì chế độ chăm sóc tốt: tưới nước, bón phân, cắt tỉa định kỳ.",
            "Thăm vườn thường xuyên để phát hiện sớm sâu bệnh."
        ],
        "severity": "Thấp"
    },
    "Bacterial Leaf Blight": {
        "description": "Bệnh bạc lá lúa do vi khuẩn Xanthomonas oryzae pv. oryzae gây ra. Đây là một trong những bệnh hại lúa nghiêm trọng nhất.",
        "symptoms": [
            "Vết bệnh bắt đầu từ mép lá, lan dần vào trong và xuống dưới.",
            "Vết bệnh có màu vàng đến trắng xám, rìa gợn sóng.",
            "Trên vết bệnh có thể thấy giọt dịch vi khuẩn vào buổi sáng sớm."
        ],
        "treatment": [
            "Không có thuốc hóa học đặc trị hiệu quả cao khi bệnh đã phát triển mạnh.",
            "Có thể sử dụng các thuốc gốc đồng hoặc kháng sinh (Kasugamycin, Streptomycin) để hạn chế lây lan."
        ],
        "prevention": [
            "Sử dụng giống lúa kháng bệnh.",
            "Bón phân cân đối, tránh bón thừa đạm.",
            "Vệ sinh đồng ruộng, diệt cỏ dại ký chủ.",
            "Điều chỉnh mực nước ruộng hợp lý."
        ],
        "severity": "Cao"
    },
    "Blueberry___healthy": {
        "description": "Cây việt quất khỏe mạnh.",
        "symptoms": [],
        "treatment": [],
        "prevention": [
            "Duy trì độ pH đất phù hợp (axit).",
            "Tưới nước đầy đủ và thoát nước tốt."
        ],
        "severity": "Thấp"
    },
    "Brown Spot": {
        "description": "Bệnh đốm nâu hại lúa do nấm Bipolaris oryzae gây ra. Bệnh thường xuất hiện trên đất nghèo dinh dưỡng.",
        "symptoms": [
            "Các đốm nhỏ hình tròn hoặc bầu dục màu nâu trên lá.",
            "Vết bệnh có thể liên kết lại làm lá khô cháy.",
            "Hạt lúa bị lem lép, vỏ trấu có đốm nâu."
        ],
        "treatment": [
            "Phun thuốc diệt nấm chứa Iprodione, Propiconazole hoặc Azoxystrobin.",
            "Bón bổ sung Kali và Silic."
        ],
        "prevention": [
            "Cải tạo đất, bón phân đầy đủ và cân đối.",
            "Sử dụng hạt giống sạch bệnh.",
            "Xử lý hạt giống trước khi gieo."
        ],
        "severity": "Trung bình"
    },
    "Cherry_(including_sour)___Powdery_mildew": {
        "description": "Bệnh phấn trắng trên cây anh đào do nấm Podosphaera clandestina gây ra.",
        "symptoms": [
            "Lớp phấn trắng bao phủ trên lá và chồi non.",
            "Lá bị xoăn, biến dạng và rụng sớm.",
            "Quả có thể bị nhiễm bệnh, còi cọc."
        ],
        "treatment": [
            "Phun thuốc diệt nấm chứa Sulfur hoặc Myclobutanil.",
            "Cắt tỉa cành bị bệnh."
        ],
        "prevention": [
            "Tạo độ thông thoáng cho tán cây.",
            "Tưới nước vào gốc, tránh làm ướt lá."
        ],
        "severity": "Trung bình"
    },
    "Cherry_(including_sour)___healthy": {
        "description": "Cây anh đào khỏe mạnh.",
        "symptoms": [],
        "treatment": [],
        "prevention": [
            "Chăm sóc định kỳ, bón phân và tưới nước hợp lý."
        ],
        "severity": "Thấp"
    },
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": {
        "description": "Bệnh đốm lá xám trên ngô do nấm Cercospora zeae-maydis gây ra.",
        "symptoms": [
            "Các vết bệnh hình chữ nhật dài, màu xám hoặc nâu nhạt chạy dọc theo gân lá.",
            "Khi bệnh nặng, toàn bộ lá có thể bị khô cháy."
        ],
        "treatment": [
            "Phun thuốc diệt nấm chứa Azoxystrobin hoặc Pyraclostrobin.",
            "Luân canh cây trồng."
        ],
        "prevention": [
            "Sử dụng giống ngô kháng bệnh.",
            "Cày vùi tàn dư cây trồng sau thu hoạch."
        ],
        "severity": "Trung bình"
    },
    "Corn_(maize)___Common_rust_": {
        "description": "Bệnh gỉ sắt thường trên ngô do nấm Puccinia sorghi gây ra.",
        "symptoms": [
            "Các mụn nhỏ màu nâu đỏ hoặc nâu quế trên cả hai mặt lá.",
            "Khi mụn vỡ ra giải phóng bào tử dạng bột màu gỉ sắt.",
            "Lá bị vàng và khô chết."
        ],
        "treatment": [
            "Thường không cần xử lý hóa học trừ khi bệnh rất nặng.",
            "Phun thuốc diệt nấm nếu bệnh xuất hiện sớm và điều kiện thời tiết thuận lợi cho bệnh."
        ],
        "prevention": [
            "Sử dụng giống kháng bệnh.",
            "Trồng sớm để tránh đợt bệnh cao điểm."
        ],
        "severity": "Thấp"
    },
    "Corn_(maize)___Northern_Leaf_Blight": {
        "description": "Bệnh cháy lá lớn (đốm lá lớn) trên ngô do nấm Exserohilum turcicum gây ra.",
        "symptoms": [
            "Vết bệnh dài hình thoi, màu xám hoặc nâu nhạt.",
            "Vết bệnh thường bắt đầu từ các lá dưới thấp và lan lên trên.",
            "Bệnh nặng làm giảm quang hợp và năng suất."
        ],
        "treatment": [
            "Phun thuốc diệt nấm khi bệnh mới xuất hiện.",
            "Luân canh cây trồng ít nhất 1 năm."
        ],
        "prevention": [
            "Sử dụng giống kháng bệnh.",
            "Xử lý tàn dư cây trồng sau thu hoạch."
        ],
        "severity": "Trung bình"
    },
    "Corn_(maize)___healthy": {
        "description": "Cây ngô khỏe mạnh.",
        "symptoms": [],
        "treatment": [],
        "prevention": [
            "Bón phân cân đối, đặc biệt là Đạm.",
            "Quản lý sâu hại như sâu đục thân."
        ],
        "severity": "Thấp"
    },
    "Grape___Black_rot": {
        "description": "Bệnh thối đen trên nho do nấm Guignardia bidwellii gây ra.",
        "symptoms": [
            "Đốm nâu đỏ trên lá.",
            "Quả nho bị héo, nhăn nheo, chuyển màu đen và khô cứng (xác ướp).",
            "Vết loét trên dây nho."
        ],
        "treatment": [
            "Phun thuốc diệt nấm chứa Mancozeb, Myclobutanil hoặc Captan.",
            "Loại bỏ quả bệnh và dây bệnh."
        ],
        "prevention": [
            "Vệ sinh vườn nho, loại bỏ tàn dư bệnh.",
            "Tạo độ thông thoáng cho giàn nho."
        ],
        "severity": "Cao"
    },
    "Grape___Esca_(Black_Measles)": {
        "description": "Bệnh Esca (Sởi đen) là một bệnh phức tạp do nhiều loại nấm gây ra, ảnh hưởng đến thân và lá nho.",
        "symptoms": [
            "Lá có các vệt màu vàng hoặc đỏ giữa các gân lá (như da hổ).",
            "Quả xuất hiện các đốm nhỏ màu tím đen (sởi).",
            "Gỗ bên trong thân bị mục nát."
        ],
        "treatment": [
            "Không có thuốc đặc trị hiệu quả.",
            "Cắt bỏ phần thân bị bệnh hoặc thay thế cây."
        ],
        "prevention": [
            "Tránh gây vết thương lớn khi cắt tỉa.",
            "Bôi thuốc bảo vệ vết cắt."
        ],
        "severity": "Cao"
    },
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": {
        "description": "Bệnh cháy lá nho do nấm Pseudocercospora vitis gây ra.",
        "symptoms": [
            "Các đốm góc cạnh màu đỏ hoặc nâu trên lá.",
            "Viền đốm thường có màu vàng.",
            "Lá bị khô và rụng sớm."
        ],
        "treatment": [
            "Phun thuốc diệt nấm gốc đồng hoặc Mancozeb.",
            "Kiểm soát độ ẩm vườn nho."
        ],
        "prevention": [
            "Cắt tỉa tạo độ thông thoáng.",
            "Vệ sinh lá rụng."
        ],
        "severity": "Trung bình"
    },
    "Grape___healthy": {
        "description": "Cây nho khỏe mạnh.",
        "symptoms": [],
        "treatment": [],
        "prevention": [
            "Cắt tỉa định kỳ.",
            "Bón phân và tưới nước hợp lý."
        ],
        "severity": "Thấp"
    },
    "Healthy Rice Leaf": {
        "description": "Cây lúa khỏe mạnh.",
        "symptoms": [],
        "treatment": [],
        "prevention": [
            "Thăm đồng thường xuyên.",
            "Bón phân cân đối."
        ],
        "severity": "Thấp"
    },
    "Leaf Blast": {
        "description": "Bệnh đạo ôn lá lúa do nấm Pyricularia oryzae gây ra.",
        "symptoms": [
            "Vết bệnh hình thoi, màu nâu ở viền, xám trắng ở giữa.",
            "Các vết bệnh liên kết làm lá bị cháy khô.",
            "Cây còi cọc, giảm năng suất."
        ],
        "treatment": [
            "Phun thuốc đặc trị đạo ôn như Tricyclazole, Isoprothiolane, Fenoxanil.",
            "Giữ mực nước ruộng ổn định."
        ],
        "prevention": [
            "Sử dụng giống kháng đạo ôn.",
            "Không bón thừa đạm, bón cân đối N-P-K.",
            "Gieo cấy mật độ vừa phải."
        ],
        "severity": "Cao"
    },
    "Leaf scald": {
        "description": "Bệnh cháy bìa lá lúa do nấm Microdochium oryzae gây ra.",
        "symptoms": [
            "Vết bệnh hình vân mây bắt đầu từ chóp lá hoặc mép lá.",
            "Vùng bệnh có các vạch màu nâu đậm xen kẽ màu nâu nhạt.",
            "Lá bị khô cháy từ chóp xuống."
        ],
        "treatment": [
            "Phun thuốc chứa hoạt chất Benomyl, Carbendazim hoặc Thiophanate-methyl.",
            "Bón thêm Kali."
        ],
        "prevention": [
            "Sử dụng hạt giống sạch bệnh.",
            "Bón phân cân đối.