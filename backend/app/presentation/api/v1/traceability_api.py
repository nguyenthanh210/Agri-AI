from fastapi import APIRouter, Depends, HTTPException
from app.application.dto.farming_log_dto import TraceabilityResponseDTO
from app.application.use_cases.farming_log_use_cases import GetTraceabilityDataUseCase
from app.infrastructure.repositories.farming_log_repository_impl import SQLAlchemyFarmingLogRepository
from app.infrastructure.repositories.farm_repository_impl import SQLAlchemyFarmRepository
from app.presentation.deps import get_farming_log_repository, get_farm_repository

router = APIRouter()

def get_traceability_uc(
    log_repo: SQLAlchemyFarmingLogRepository = Depends(get_farming_log_repository),
    farm_repo: SQLAlchemyFarmRepository = Depends(get_farm_repository)
) -> GetTraceabilityDataUseCase:
    return GetTraceabilityDataUseCase(log_repo, farm_repo)

@router.get("/{qr_code_id}", response_model=TraceabilityResponseDTO)
async def get_traceability_data(
    qr_code_id: str,
    use_case: GetTraceabilityDataUseCase = Depends(get_traceability_uc)
):
    """Public endpoint to get traceability data by QR code ID."""
    data = await use_case.execute(qr_code_id)
    if not data:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin truy xuất nguồn gốc")
    return data
