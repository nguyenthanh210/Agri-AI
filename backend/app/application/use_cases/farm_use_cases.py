from typing import List, Optional
from app.domain.entities.farm import FarmArea, Coordinate
from app.application.dto.farm_dto import FarmAreaCreateDTO, FarmAreaUpdateDTO
from app.domain.repositories.farm_repository import FarmRepository

class CreateFarmAreaUseCase:
    def __init__(self, farm_repository: FarmRepository):
        self.farm_repository = farm_repository

    async def execute(self, user_id: int, dto: FarmAreaCreateDTO) -> FarmArea:
        coordinates = [Coordinate(lat=c.lat, lng=c.lng) for c in dto.coordinates]
        
        farm = FarmArea(
            name=dto.name,
            description=dto.description,
            coordinates=coordinates,
            area_size=dto.area_size,
            crop_type=dto.crop_type,
            user_id=user_id
        )
        
        return await self.farm_repository.save(farm)

class GetUserFarmsUseCase:
    def __init__(self, farm_repository: FarmRepository):
        self.farm_repository = farm_repository

    async def execute(self, user_id: int) -> List[FarmArea]:
        return await self.farm_repository.get_by_user_id(user_id)

class UpdateFarmAreaUseCase:
    def __init__(self, farm_repository: FarmRepository):
        self.farm_repository = farm_repository

    async def execute(self, farm_id: int, user_id: int, dto: FarmAreaUpdateDTO) -> Optional[FarmArea]:
        coordinates = None
        if dto.coordinates is not None:
            coordinates = [Coordinate(lat=c.lat, lng=c.lng) for c in dto.coordinates]
        
        return await self.farm_repository.update(
            farm_id=farm_id,
            user_id=user_id,
            name=dto.name,
            description=dto.description,
            coordinates=coordinates,
            area_size=dto.area_size,
            crop_type=dto.crop_type
        )

class DeleteFarmAreaUseCase:
    def __init__(self, farm_repository: FarmRepository):
        self.farm_repository = farm_repository

    async def execute(self, farm_id: int, user_id: int) -> bool:
        return await self.farm_repository.delete(farm_id, user_id)
