from typing import List, Optional
import uuid
from app.domain.entities.crop_batch import CropBatch
from app.domain.entities.farming_log import FarmingLog
from app.application.dto.farming_log_dto import (
    CropBatchCreateDTO,
    CropBatchUpdateDTO,
    FarmingLogCreateDTO,
    TraceabilityResponseDTO,
    CropBatchResponseDTO,
    FarmingLogResponseDTO
)
from app.domain.repositories.farming_log_repository import FarmingLogRepository
from app.domain.repositories.farm_repository import FarmRepository

class CreateCropBatchUseCase:
    def __init__(self, log_repo: FarmingLogRepository, farm_repo: FarmRepository):
        self.log_repo = log_repo
        self.farm_repo = farm_repo

    async def execute(self, user_id: int, farm_id: int, dto: CropBatchCreateDTO) -> Optional[CropBatch]:
        # Verify farm ownership
        farm = await self.farm_repo.get_by_id(farm_id)
        if not farm or farm.user_id != user_id:
            return None

        batch = CropBatch(
            farm_id=farm_id,
            name=dto.name,
            seed_type=dto.seed_type,
            planting_date=dto.planting_date,
            expected_harvest_date=dto.expected_harvest_date,
            status=dto.status,
            qr_code_id=str(uuid.uuid4())
        )
        return await self.log_repo.save_batch(batch)

class GetBatchesByFarmUseCase:
    def __init__(self, log_repo: FarmingLogRepository, farm_repo: FarmRepository):
        self.log_repo = log_repo
        self.farm_repo = farm_repo

    async def execute(self, user_id: int, farm_id: int) -> Optional[List[CropBatch]]:
        farm = await self.farm_repo.get_by_id(farm_id)
        if not farm or farm.user_id != user_id:
            return None
        return await self.log_repo.get_batches_by_farm_id(farm_id)

class CreateFarmingLogUseCase:
    def __init__(self, log_repo: FarmingLogRepository, farm_repo: FarmRepository):
        self.log_repo = log_repo
        self.farm_repo = farm_repo

    async def execute(self, user_id: int, batch_id: int, dto: FarmingLogCreateDTO) -> Optional[FarmingLog]:
        batch = await self.log_repo.get_batch_by_id(batch_id)
        if not batch:
            return None
        farm = await self.farm_repo.get_by_id(batch.farm_id)
        if not farm or farm.user_id != user_id:
            return None

        log = FarmingLog(
            batch_id=batch_id,
            activity_type=dto.activity_type,
            description=dto.description,
            image_url=dto.image_url
        )
        return await self.log_repo.save_log(log)

class GetLogsByBatchUseCase:
    def __init__(self, log_repo: FarmingLogRepository, farm_repo: FarmRepository):
        self.log_repo = log_repo
        self.farm_repo = farm_repo

    async def execute(self, user_id: int, batch_id: int) -> Optional[List[FarmingLog]]:
        batch = await self.log_repo.get_batch_by_id(batch_id)
        if not batch:
            return None
        farm = await self.farm_repo.get_by_id(batch.farm_id)
        if not farm or farm.user_id != user_id:
            return None
        return await self.log_repo.get_logs_by_batch_id(batch_id)

class GetTraceabilityDataUseCase:
    def __init__(self, log_repo: FarmingLogRepository, farm_repo: FarmRepository):
        self.log_repo = log_repo
        self.farm_repo = farm_repo

    async def execute(self, qr_code_id: str) -> Optional[TraceabilityResponseDTO]:
        batch = await self.log_repo.get_batch_by_qr_code(qr_code_id)
        if not batch:
            return None
            
        farm = await self.farm_repo.get_by_id(batch.farm_id)
        if not farm:
            return None
            
        logs = await self.log_repo.get_logs_by_batch_id(batch.id)
        
        return TraceabilityResponseDTO(
            batch=CropBatchResponseDTO.model_validate(batch),
            logs=[FarmingLogResponseDTO.model_validate(log) for log in logs],
            farm_name=farm.name
        )
