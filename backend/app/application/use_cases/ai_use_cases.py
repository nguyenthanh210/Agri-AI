"""
AI use cases – chat assistant and farm insights.
"""
from datetime import datetime
from app.application.use_cases.base import BaseUseCase
from app.application.dto.ai_dto import (
    ChatRequestDTO,
    ChatResponseDTO,
    FarmInsightRequestDTO,
    FarmInsightResponseDTO,
    IrrigationAdviceRequestDTO,
    IrrigationAdviceResponseDTO,
)
from app.infrastructure.external_services.gemini_service import GeminiService


class AIChatUseCase(BaseUseCase[ChatRequestDTO, ChatResponseDTO]):
    """Use case: send a message to the AI agricultural assistant."""

    async def execute(self, input_dto: ChatRequestDTO) -> ChatResponseDTO:
        service = GeminiService()
        response_text = await service.chat(
            message=input_dto.message,
            context=input_dto.context,
        )
        return ChatResponseDTO(response=response_text, timestamp=datetime.utcnow())


class FarmInsightUseCase(BaseUseCase[FarmInsightRequestDTO, FarmInsightResponseDTO]):
    """Use case: generate AI insights from farm data."""

    async def execute(self, input_dto: FarmInsightRequestDTO) -> FarmInsightResponseDTO:
        service = GeminiService()
        farm_data = {
            "weather": input_dto.weather,
            "soil": input_dto.soil,
            "disease": input_dto.disease,
            "location": input_dto.location,
            "crop": input_dto.crop,
            "ndvi": input_dto.ndvi,
        }
        result = await service.generate_insights(farm_data)
        return FarmInsightResponseDTO(
            insights=result.get("insights", []),
            recommendations=result.get("recommendations", []),
            risk_level=result.get("risk_level", "unknown"),
            risk_reason=result.get("risk_reason"),
            generated_at=datetime.utcnow(),
        )


class IrrigationAdviceUseCase(BaseUseCase[IrrigationAdviceRequestDTO, IrrigationAdviceResponseDTO]):
    """Use case: get AI recommendations for irrigation and fertilization."""

    async def execute(self, input_dto: IrrigationAdviceRequestDTO) -> IrrigationAdviceResponseDTO:
        service = GeminiService()
        result = await service.analyze_irrigation_needs(
            crop_type=input_dto.crop_type,
            growth_stage=input_dto.growth_stage,
            soil_moisture=input_dto.soil_moisture,
            weather_forecast=input_dto.weather_forecast,
        )
        return IrrigationAdviceResponseDTO(
            action=result.get("action", "wait"),
            water_amount_liters_per_m2=float(result.get("water_amount_liters_per_m2", 0.0)),
            fertilizer_suggestion=result.get("fertilizer_suggestion"),
            reasoning=result.get("reasoning", "Không có gợi ý"),
            generated_at=datetime.utcnow(),
        )
