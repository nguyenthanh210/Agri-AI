import logging
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.crop_batch import CropBatch
from app.domain.entities.farming_log import FarmingLog
from app.domain.repositories.farming_log_repository import FarmingLogRepository
from app.infrastructure.database.models.crop_batch_model import CropBatchModel
from app.infrastructure.database.models.farming_log_model import FarmingLogModel

logger = logging.getLogger(__name__)

class SQLAlchemyFarmingLogRepository(FarmingLogRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    # -- Crop Batch --

    async def save_batch(self, batch: CropBatch) -> CropBatch:
        db_batch = CropBatchModel(
            farm_id=batch.farm_id,
            name=batch.name,
            seed_type=batch.seed_type,
            planting_date=batch.planting_date,
            expected_harvest_date=batch.expected_harvest_date,
            status=batch.status,
            qr_code_id=batch.qr_code_id
        )
        self.session.add(db_batch)
        await self.session.commit()
        await self.session.refresh(db_batch)
        return self._map_to_batch_entity(db_batch)

    async def get_batches_by_farm_id(self, farm_id: int) -> List[CropBatch]:
        result = await self.session.execute(
            select(CropBatchModel).where(CropBatchModel.farm_id == farm_id)
        )
        return [self._map_to_batch_entity(b) for b in result.scalars().all()]

    async def get_batch_by_id(self, batch_id: int) -> Optional[CropBatch]:
        result = await self.session.execute(
            select(CropBatchModel).where(CropBatchModel.id == batch_id)
        )
        db_batch = result.scalar_one_or_none()
        if db_batch:
            return self._map_to_batch_entity(db_batch)
        return None

    async def get_batch_by_qr_code(self, qr_code_id: str) -> Optional[CropBatch]:
        result = await self.session.execute(
            select(CropBatchModel).where(CropBatchModel.qr_code_id == qr_code_id)
        )
        db_batch = result.scalar_one_or_none()
        if db_batch:
            return self._map_to_batch_entity(db_batch)
        return None

    async def update_batch(self, batch_id: int, **kwargs) -> Optional[CropBatch]:
        result = await self.session.execute(
            select(CropBatchModel).where(CropBatchModel.id == batch_id)
        )
        db_batch = result.scalar_one_or_none()
        if not db_batch:
            return None
            
        for key, value in kwargs.items():
            if hasattr(db_batch, key) and value is not None:
                setattr(db_batch, key, value)
                
        await self.session.commit()
        await self.session.refresh(db_batch)
        return self._map_to_batch_entity(db_batch)

    # -- Farming Log --

    async def save_log(self, log: FarmingLog) -> FarmingLog:
        db_log = FarmingLogModel(
            batch_id=log.batch_id,
            activity_type=log.activity_type,
            description=log.description,
            image_url=log.image_url
        )
        self.session.add(db_log)
        await self.session.commit()
        await self.session.refresh(db_log)
        return self._map_to_log_entity(db_log)

    async def get_logs_by_batch_id(self, batch_id: int) -> List[FarmingLog]:
        result = await self.session.execute(
            select(FarmingLogModel).where(FarmingLogModel.batch_id == batch_id).order_by(FarmingLogModel.created_at.desc())
        )
        return [self._map_to_log_entity(l) for l in result.scalars().all()]

    # -- Mappers --

    def _map_to_batch_entity(self, model: CropBatchModel) -> CropBatch:
        return CropBatch(
            id=model.id,
            farm_id=model.farm_id,
            name=model.name,
            seed_type=model.seed_type,
            planting_date=model.planting_date,
            expected_harvest_date=model.expected_harvest_date,
            status=model.status,
            qr_code_id=model.qr_code_id,
            created_at=model.created_at,
            updated_at=model.updated_at
        )

    def _map_to_log_entity(self, model: FarmingLogModel) -> FarmingLog:
        return FarmingLog(
            id=model.id,
            batch_id=model.batch_id,
            activity_type=model.activity_type,
            description=model.description,
            image_url=model.image_url,
            created_at=model.created_at,
            updated_at=model.created_at # Logs usually aren't updated, but mapping it
        )
