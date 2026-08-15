from typing import List
from fastapi import APIRouter, Depends, HTTPException
from app.application.dto.farming_log_dto import (
    CropBatchCreateDTO,
    CropBatchResponseDTO,
    FarmingLogCreateDTO,
    FarmingLogResponseDTO
)
from app.application.use_cases.farming_log_use_cases import (
    CreateCropBatchUseCase,
    GetBatchesByFarmUseCase,
    CreateFarmingLogUseCase,
    GetLogsByBatchUseCase
)
from app.infrastructure.repositories.farming_log_repository_impl import SQLAlchemyFarmingLogRepository
from app.infrastructure.repositories.farm_repository_impl import SQLAlchemyFarmRepository
from app.presentation.deps import get_current_user, get_farming_log_repository, get_farm_repository
from app.domain.entities.user import User

router = APIRouter()

def get_create_batch_uc(
    log_repo: SQLAlchemyFarmingLogRepository = Depends(get_farming_log_repository),
    farm_repo: SQLAlchemyFarmRepository = Depends(get_farm_repository)
) -> CreateCropBatchUseCase:
    return CreateCropBatchUseCase(log_repo, farm_repo)

def get_batches_uc(
    log_repo: SQLAlchemyFarmingLogRepository = Depends(get_farming_log_repository),
    farm_repo: SQLAlchemyFarmRepository = Depends(get_farm_repository)
) -> GetBatchesByFarmUseCase:
    return GetBatchesByFarmUseCase(log_repo, farm_repo)

def get_create_log_uc(
    log_repo: SQLAlchemyFarmingLogRepository = Depends(get_farming_log_repository),
    farm_repo: SQLAlchemyFarmRepository = Depends(get_farm_repository)
) -> CreateFarmingLogUseCase:
    return CreateFarmingLogUseCase(log_repo, farm_repo)

def get_logs_uc(
    log_repo: SQLAlchemyFarmingLogRepository = Depends(get_farming_log_repository),
    farm_repo: SQLAlchemyFarmRepository = Depends(get_farm_repository)
) -> GetLogsByBatchUseCase:
    return GetLogsByBatchUseCase(log_repo, farm_repo)

@router.post("/farms/{farm_id}/batches", response_model=CropBatchResponseDTO)
async def create_crop_batch(
    farm_id: int,
    data: CropBatchCreateDTO,
    use_case: CreateCropBatchUseCase = Depends(get_create_batch_uc),
    current_user: User = Depends(get_current_user)
):
    batch = await use_case.execute(current_user.id, farm_id, data)
    if not batch:
        raise HTTPException(status_code=403, detail="Not authorized or farm not found")
    return batch

@router.get("/farms/{farm_id}/batches", response_model=List[CropBatchResponseDTO])
async def get_crop_batches(
    farm_id: int,
    use_case: GetBatchesByFarmUseCase = Depends(get_batches_uc),
    current_user: User = Depends(get_current_user)
):
    batches = await use_case.execute(current_user.id, farm_id)
    if batches is None:
        raise HTTPException(status_code=403, detail="Not authorized or farm not found")
    return batches

@router.post("/batches/{batch_id}/logs", response_model=FarmingLogResponseDTO)
async def create_farming_log(
    batch_id: int,
    data: FarmingLogCreateDTO,
    use_case: CreateFarmingLogUseCase = Depends(get_create_log_uc),
    current_user: User = Depends(get_current_user)
):
    log = await use_case.execute(current_user.id, batch_id, data)
    if not log:
        raise HTTPException(status_code=403, detail="Not authorized or batch not found")
    return log

@router.get("/batches/{batch_id}/logs", response_model=List[FarmingLogResponseDTO])
async def get_farming_logs(
    batch_id: int,
    use_case: GetLogsByBatchUseCase = Depends(get_logs_uc),
    current_user: User = Depends(get_current_user)
):
    logs = await use_case.execute(current_user.id, batch_id)
    if logs is None:
        raise HTTPException(status_code=403, detail="Not authorized or batch not found")
    return logs
