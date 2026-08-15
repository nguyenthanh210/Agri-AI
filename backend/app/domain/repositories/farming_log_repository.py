from abc import ABC, abstractmethod
from typing import List, Optional
from app.domain.entities.crop_batch import CropBatch
from app.domain.entities.farming_log import FarmingLog

class FarmingLogRepository(ABC):
    
    # -- Crop Batch --
    
    @abstractmethod
    async def save_batch(self, batch: CropBatch) -> CropBatch:
        pass

    @abstractmethod
    async def get_batches_by_farm_id(self, farm_id: int) -> List[CropBatch]:
        pass

    @abstractmethod
    async def get_batch_by_id(self, batch_id: int) -> Optional[CropBatch]:
        pass

    @abstractmethod
    async def get_batch_by_qr_code(self, qr_code_id: str) -> Optional[CropBatch]:
        pass

    @abstractmethod
    async def update_batch(self, batch_id: int, **kwargs) -> Optional[CropBatch]:
        pass

    # -- Farming Log --

    @abstractmethod
    async def save_log(self, log: FarmingLog) -> FarmingLog:
        pass

    @abstractmethod
    async def get_logs_by_batch_id(self, batch_id: int) -> List[FarmingLog]:
        pass
