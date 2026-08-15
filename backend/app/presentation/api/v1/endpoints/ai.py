"""
AI endpoints – agricultural chatbot and farm insights.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.application.dto.ai_dto import (
    ChatRequestDTO,
    ChatResponseDTO,
    FarmInsightRequestDTO,
    FarmInsightResponseDTO,
    IrrigationAdviceRequestDTO,
    IrrigationAdviceResponseDTO,
    YieldFinanceRequestDTO,
    YieldFinanceResponseDTO,
)
from app.application.use_cases.ai_use_cases import AIChatUseCase, FarmInsightUseCase, IrrigationAdviceUseCase, YieldFinanceUseCase
from app.presentation.deps import get_current_user
from app.domain.entities.user import User

router = APIRouter()


@router.post("/chat", response_model=ChatResponseDTO)
async def ai_chat(
    request: ChatRequestDTO,
    current_user: User = Depends(get_current_user),
):
    """
    Send a message to the AI agricultural assistant and get a response.
    Optionally include farm context (weather, soil, disease results) in `context`.
    """
    use_case = AIChatUseCase()
    try:
        return await use_case.execute(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.post("/insights", response_model=FarmInsightResponseDTO)
async def farm_insights(
    request: FarmInsightRequestDTO,
    current_user: User = Depends(get_current_user),
):
    """
    Generate AI-powered insights and recommendations from farm data.
    Pass weather, soil, disease, NDVI and location for best results.
    """
    use_case = FarmInsightUseCase()
    try:
        return await use_case.execute(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.post("/irrigation-advice", response_model=IrrigationAdviceResponseDTO)
async def irrigation_advice(
    request: IrrigationAdviceRequestDTO,
    current_user: User = Depends(get_current_user),
):
    """
    Get AI-powered irrigation and fertilization advice.
    """
    use_case = IrrigationAdviceUseCase()
    try:
        return await use_case.execute(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.post("/yield-finance", response_model=YieldFinanceResponseDTO)
async def yield_finance_advice(
    request: YieldFinanceRequestDTO,
    current_user: User = Depends(get_current_user),
):
    """
    Get AI-powered yield forecasting and financial insights.
    """
    use_case = YieldFinanceUseCase()
    try:
        return await use_case.execute(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
