from typing import List
from fastapi import APIRouter, Depends, HTTPException
from app.application.dto.farm_dto import FarmAreaCreateDTO, FarmAreaUpdateDTO, FarmAreaResponseDTO
from app.application.use_cases.farm_use_cases import (
    CreateFarmAreaUseCase, 
    GetUserFarmsUseCase,
    UpdateFarmAreaUseCase,
    DeleteFarmAreaUseCase
)
from app.infrastructure.repositories.farm_repository_impl import SQLAlchemyFarmRepository
from app.presentation.deps import get_current_user, get_farm_repository
from app.domain.entities.user import User

router = APIRouter()

def get_create_farm_use_case(
    farm_repository: SQLAlchemyFarmRepository = Depends(get_farm_repository)
) -> CreateFarmAreaUseCase:
    return CreateFarmAreaUseCase(farm_repository)

def get_user_farms_use_case(
    farm_repository: SQLAlchemyFarmRepository = Depends(get_farm_repository)
) -> GetUserFarmsUseCase:
    return GetUserFarmsUseCase(farm_repository)

def get_update_farm_use_case(
    farm_repository: SQLAlchemyFarmRepository = Depends(get_farm_repository)
) -> UpdateFarmAreaUseCase:
    return UpdateFarmAreaUseCase(farm_repository)

def get_delete_farm_use_case(
    farm_repository: SQLAlchemyFarmRepository = Depends(get_farm_repository)
) -> DeleteFarmAreaUseCase:
    return DeleteFarmAreaUseCase(farm_repository)

@router.post("/", response_model=FarmAreaResponseDTO)
async def create_farm_area(
    farm_data: FarmAreaCreateDTO,
    use_case: CreateFarmAreaUseCase = Depends(get_create_farm_use_case),
    current_user: User = Depends(get_current_user)
):
    return await use_case.execute(current_user.id, farm_data)

@router.get("/", response_model=List[FarmAreaResponseDTO])
async def get_my_farms(
    use_case: GetUserFarmsUseCase = Depends(get_user_farms_use_case),
    current_user: User = Depends(get_current_user)
):
    return await use_case.execute(current_user.id)

@router.put("/{farm_id}", response_model=FarmAreaResponseDTO)
async def update_farm_area(
    farm_id: int,
    farm_data: FarmAreaUpdateDTO,
    use_case: UpdateFarmAreaUseCase = Depends(get_update_farm_use_case),
    current_user: User = Depends(get_current_user)
):
    """Update a farm area. Only the owner can update their farm."""
    result = await use_case.execute(farm_id, current_user.id, farm_data)
    if not result:
        raise HTTPException(status_code=404, detail="Không tìm thấy vùng trồng hoặc bạn không có quyền chỉnh sửa")
    return result

@router.delete("/{farm_id}")
async def delete_farm_area(
    farm_id: int,
    use_case: DeleteFarmAreaUseCase = Depends(get_delete_farm_use_case),
    current_user: User = Depends(get_current_user)
):
    """Delete a farm area. Only the owner can delete their farm."""
    success = await use_case.execute(farm_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy vùng trồng hoặc bạn không có quyền xóa")
    return {"message": "Xóa vùng trồng thành công"}
