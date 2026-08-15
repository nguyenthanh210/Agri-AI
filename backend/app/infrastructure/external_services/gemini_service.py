"""
Google Gemini AI service for agricultural assistant and farm insights.
Uses the official google-genai SDK (v1+).
"""
import json
import logging
import re
from typing import Optional

from google import genai
from google.genai import types

from app.infrastructure.config.settings import get_settings

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """Bạn là AgriBot – trợ lý AI nông nghiệp thông minh của hệ thống OpenAgri, chuyên hỗ trợ nông dân Việt Nam.

Vai trò của bạn:
- Chuyên gia về cây trồng, bệnh hại, sâu bệnh, thổ nhưỡng và thời tiết tại Việt Nam
- Tư vấn canh tác, phòng trừ dịch hại, bón phân, tưới tiêu dựa trên điều kiện thực tế
- Phân tích dữ liệu nông trại (thời tiết, độ ẩm đất, kết quả quét bệnh) để đưa ra lời khuyên thực tế
- Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu

Quy tắc:
- Luôn trả lời bằng tiếng Việt
- Ưu tiên lời khuyên thực tiễn, có thể áp dụng ngay
- Nếu được cung cấp dữ liệu ngữ cảnh (thời tiết, đất, bệnh), hãy tham chiếu đến chúng
- Không hứa hẹn kết quả tuyệt đối; khuyến khích tham khảo chuyên gia địa phương khi cần
- Đặt câu hỏi phản hồi nếu cần thêm thông tin để tư vấn chính xác hơn"""

_INSIGHT_PROMPT_TEMPLATE = """Bạn là chuyên gia nông nghiệp AI. Hãy phân tích dữ liệu nông trại sau và cung cấp:
1. Tối đa 4 nhận xét ngắn về tình trạng hiện tại
2. Tối đa 3 khuyến nghị hành động cụ thể

Dữ liệu nông trại:
{context}

Yêu cầu định dạng JSON:
{{
  "insights": ["nhận xét 1", "nhận xét 2", ...],
  "recommendations": ["khuyến nghị 1", "khuyến nghị 2", ...],
  "risk_level": "low|medium|high",
  "risk_reason": "lý do ngắn gọn"
}}

Chỉ trả về JSON, không có văn bản thêm."""

_WEATHER_ANALYSIS_PROMPT = """Bạn là chuyên gia nông nghiệp AI. Phân tích dữ liệu thời tiết và đưa ra tư vấn nông vụ thực tế.

Thông tin thời tiết tại {location}:
- Nhiệt độ hiện tại: {temperature}°C (cảm giác như {apparent_temperature}°C)
- Độ ẩm không khí: {humidity}%
- Tình trạng thời tiết: {weather_desc}
- Tốc độ gió: {wind_speed} km/h
- Lượng mưa: {precipitation} mm
- Dự báo 7 ngày – cao nhất: {temp_max}°C / thấp nhất: {temp_min}°C
- Loại cây trồng: {crop_type}

Trả về JSON theo định dạng sau (không có văn bản ngoài JSON):
{{
  "summary": "Tóm tắt điều kiện thời tiết và tác động nông vụ trong 2-3 câu.",
  "insights": ["nhận xét cụ thể 1", "nhận xét cụ thể 2", "nhận xét cụ thể 3"],
  "recommendations": ["hành động cụ thể 1", "hành động cụ thể 2", "hành động cụ thể 3"],
  "risk_level": "low|medium|high",
  "risk_reason": "Lý do mức rủi ro (ngắn)"
}}"""

_IRRIGATION_PROMPT = """Bạn là chuyên gia nông nghiệp AI. Dựa trên dữ liệu dưới đây, hãy đưa ra tư vấn về việc CÓ NÊN TƯỚI NƯỚC/BÓN PHÂN hay không.

Dữ liệu:
- Loại cây trồng: {crop_type}
- Giai đoạn sinh trưởng: {growth_stage}
- Độ ẩm đất hiện tại: {soil_moisture}%
- Dự báo thời tiết (24h tới): {weather_forecast}

Yêu cầu định dạng JSON:
{{
  "action": "irrigate" | "wait" | "fertilize",
  "water_amount_liters_per_m2": 0.0,
  "fertilizer_suggestion": "Loại phân (nếu action là fertilize) hoặc None",
  "reasoning": "Giải thích lý do tư vấn (khoảng 2-3 câu)"
}}

Chỉ trả về JSON, không có văn bản thêm."""

_MODEL = "gemini-2.5-flash"
_FALLBACK_MODEL = "gemini-2.5-pro"


class GeminiService:
    """Singleton service wrapping Google Gemini API (google-genai v1+)."""

    _instance = None
    _client: Optional[genai.Client] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._client = None
        return cls._instance

    def _get_client(self) -> genai.Client:
        if self._client is None:
            settings = get_settings()
            if not settings.GEMINI_API_KEY:
                raise ValueError(
                    "GEMINI_API_KEY chưa được cấu hình. "
                    "Vui lòng thêm GEMINI_API_KEY vào file .env"
                )
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    async def chat(self, message: str, context: Optional[dict] = None) -> str:
        """Send a message and get a response from the agricultural AI assistant."""
        client = self._get_client()
        prompt = message
        if context:
            context_str = _build_context_string(context)
            prompt = (
                f"[Dữ liệu ngữ cảnh nông trại]\n{context_str}\n\n"
                f"[Câu hỏi của nông dân]\n{message}"
            )

        config = types.GenerateContentConfig(
            system_instruction=_SYSTEM_PROMPT,
            temperature=0.7,
            max_output_tokens=1024,
        )

        for model in (_MODEL, _FALLBACK_MODEL):
            try:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                )
                if model != _MODEL:
                    logger.info(f"Gemini chat: used fallback model '{model}'")
                return response.text or "Không có phản hồi từ AI."
            except Exception as e:
                logger.warning(f"Gemini chat model '{model}' failed: {e}")
                if model == _FALLBACK_MODEL:
                    raise ValueError(f"Lỗi khi gọi AI: {str(e)}")
        
        raise ValueError("Lỗi không xác định khi gọi AI.")

    async def generate_insights(self, farm_data: dict) -> dict:
        """Analyze farm data and generate structured insights."""
        client = self._get_client()
        context_str = _build_context_string(farm_data)
        prompt = _INSIGHT_PROMPT_TEMPLATE.format(context=context_str)
        config = types.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=2048,
        )

        raw_text: Optional[str] = None
        for model in (_MODEL, _FALLBACK_MODEL):
            try:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                )
                if model != _MODEL:
                    logger.info(f"Gemini insights: used fallback model '{model}'")
                raw_text = (response.text or "").strip()
                break
            except Exception as e:
                logger.warning(f"Gemini insights model '{model}' failed: {e}")
                if model == _FALLBACK_MODEL:
                    return {
                        "insights": ["Không thể kết nối với AI lúc này. Vui lòng thử lại sau."],
                        "recommendations": [],
                        "risk_level": "unknown",
                        "risk_reason": str(e),
                    }

        if not raw_text:
            return {
                "insights": ["Không thể kết nối với AI lúc này. Vui lòng thử lại sau."],
                "recommendations": [],
                "risk_level": "unknown",
                "risk_reason": "AI trả về dữ liệu trống",
            }

        try:
            text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            text = re.sub(r"\s*```$", "", text)
            text = text.strip()
            # Fallback: extract first JSON object in case model prepended/appended text
            if not text.startswith("{"):
                match = re.search(r"\{.*\}", text, re.DOTALL)
                if match:
                    text = match.group(0)
                else:
                    logger.error(f"Gemini insight: no JSON object found in response: {text[:200]}")
                    raise json.JSONDecodeError("No JSON object", text, 0)
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Gemini insight JSON parse error: {e}. Raw: {raw_text[:300] if raw_text else 'None'}")
            return {
                "insights": ["Không thể phân tích dữ liệu lúc này."],
                "recommendations": [],
                "risk_level": "unknown",
                "risk_reason": "Lỗi parse JSON từ AI",
            }

    async def analyze_weather(
        self,
        location: str,
        temperature: float,
        apparent_temperature: float,
        humidity: int,
        weather_desc: str,
        wind_speed: float,
        precipitation: float,
        temp_max: float,
        temp_min: float,
        crop_type: str = "Không xác định",
    ) -> dict:
        """Analyse weather data and return structured agricultural advice."""
        client = self._get_client()
        prompt = _WEATHER_ANALYSIS_PROMPT.format(
            location=location,
            temperature=temperature,
            apparent_temperature=apparent_temperature,
            humidity=humidity,
            weather_desc=weather_desc,
            wind_speed=wind_speed,
            precipitation=precipitation,
            temp_max=temp_max,
            temp_min=temp_min,
            crop_type=crop_type,
        )
        config = types.GenerateContentConfig(
            temperature=0.4,
            max_output_tokens=1024,
        )

        raw_text: Optional[str] = None
        for model in (_MODEL, _FALLBACK_MODEL):
            try:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                )
                if model != _MODEL:
                    logger.info(f"Gemini weather analysis: used fallback model '{model}'")
                raw_text = (response.text or "").strip()
                break
            except Exception as e:
                logger.warning(f"Gemini weather analysis model '{model}' failed: {e}")
                if model == _FALLBACK_MODEL:
                    return {
                        "summary": "Không thể tải phân tích AI lúc này.",
                        "insights": [],
                        "recommendations": [],
                        "risk_level": "unknown",
                        "risk_reason": str(e),
                    }

        if not raw_text:
            return {
                "summary": "Không thể phân tích dữ liệu thời tiết lúc này.",
                "insights": [],
                "recommendations": [],
                "risk_level": "unknown",
                "risk_reason": "AI trả về dữ liệu trống",
            }

        try:
            text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            text = re.sub(r"\s*```$", "", text).strip()
            if not text.startswith("{"):
                match = re.search(r"\{.*\}", text, re.DOTALL)
                if match:
                    text = match.group(0)
                else:
                    raise json.JSONDecodeError("No JSON object", text, 0)
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Gemini weather analysis JSON parse error: {e}. Raw: {raw_text[:300] if raw_text else 'None'}")
            return {
                "summary": "Không thể phân tích dữ liệu thời tiết lúc này.",
                "insights": [],
                "recommendations": [],
                "risk_level": "unknown",
                "risk_reason": "Lỗi parse JSON từ AI",
            }

    async def analyze_irrigation_needs(
        self,
        crop_type: str,
        growth_stage: str,
        soil_moisture: float,
        weather_forecast: str,
    ) -> dict:
        """Analyze data and recommend irrigation/fertilization actions."""
        client = self._get_client()
        prompt = _IRRIGATION_PROMPT.format(
            crop_type=crop_type,
            growth_stage=growth_stage,
            soil_moisture=soil_moisture,
            weather_forecast=weather_forecast,
        )
        config = types.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=1024,
        )

        raw_text: Optional[str] = None
        for model in (_MODEL, _FALLBACK_MODEL):
            try:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                )
                if model != _MODEL:
                    logger.info(f"Gemini irrigation: used fallback model '{model}'")
                raw_text = (response.text or "").strip()
                break
            except Exception as e:
                logger.warning(f"Gemini irrigation model '{model}' failed: {e}")
                if model == _FALLBACK_MODEL:
                    return {
                        "action": "wait",
                        "water_amount_liters_per_m2": 0.0,
                        "fertilizer_suggestion": None,
                        "reasoning": "Không thể kết nối với AI lúc này.",
                    }

        if not raw_text:
            return {
                "action": "wait",
                "water_amount_liters_per_m2": 0.0,
                "fertilizer_suggestion": None,
                "reasoning": "AI trả về dữ liệu trống",
            }

        try:
            text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            text = re.sub(r"\s*```$", "", text).strip()
            if not text.startswith("{"):
                match = re.search(r"\{.*\}", text, re.DOTALL)
                if match:
                    text = match.group(0)
                else:
                    raise json.JSONDecodeError("No JSON object", text, 0)
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Gemini irrigation JSON parse error: {e}")
            return {
                "action": "wait",
                "water_amount_liters_per_m2": 0.0,
                "fertilizer_suggestion": None,
                "reasoning": "Lỗi parse JSON từ AI",
            }


def _build_context_string(context: dict) -> str:
    parts = []
    if context.get("weather"):
        w = context["weather"]
        parts.append(
            f"Thời tiết: nhiệt độ {w.get('temperature', 'N/A')}°C, "
            f"độ ẩm {w.get('humidity', 'N/A')}%, "
            f"tốc độ gió {w.get('wind_speed', 'N/A')} m/s, "
            f"mô tả: {w.get('description', 'N/A')}"
        )
    if context.get("soil"):
        s = context["soil"]
        parts.append(
            f"Đất: pH {s.get('ph', 'N/A')}, "
            f"N {s.get('nitrogen', 'N/A')}%, "
            f"P {s.get('phosphorus', 'N/A')}%, "
            f"K {s.get('potassium', 'N/A')}%, "
            f"loại: {s.get('soil_type', 'N/A')}"
        )
    if context.get("disease"):
        parts.append(f"Kết quả quét bệnh gần nhất: {context['disease']}")
    if context.get("location"):
        parts.append(f"Vị trí: {context['location']}")
    if context.get("crop"):
        parts.append(f"Loại cây trồng: {context['crop']}")
    if context.get("ndvi") is not None:
        parts.append(f"Chỉ số NDVI: {context['ndvi']} (sức khoẻ thực vật)")
    return "\n".join(parts) if parts else "Không có dữ liệu ngữ cảnh"