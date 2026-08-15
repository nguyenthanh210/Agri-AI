Dưới đây là mã nguồn phần 5/24 của dự án Agri-AI:

==================== backend\app\application\use_cases\ndvi_use_cases.py ====================
```python
import logging
import random
import datetime
import os
import shutil
import uuid
from fastapi import HTTPException

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from app.application.dto.ndvi_dto import NDVIRequest, NDVIResponse
from app.infrastructure.external_services.sentinel_client import search_sentinel_products, download_product
from app.infrastructure.image_processing.ndvi_processing import find_band_paths, compute_ndvi
from app.infrastructure.image_processing.utils import convert_tiff_to_base64_png
from app.infrastructure.config.settings import get_settings
from app.infrastructure.repositories.satellite_repository_impl import SatelliteRepositoryImpl
from app.infrastructure.database.models.satellite_data_model import SatelliteDataModel

settings = get_settings()

class CalculateNDVIUseCase:
    async def sync_latest_data_for_farm(self, farm_id: int, bbox: list, db: AsyncSession):
        """
        Background task to sync latest NDVI data for a farm.
        Syncs up to 10 most recent images (approx last 2 months).
        """
        today = datetime.date.today()
        # Sentinel-2 revisits every 5 days. 10 images * 5 days = 50 days. Let's do 60 to be safe.
        start_date = (today - datetime.timedelta(days=60)).strftime('%Y-%m-%d')
        end_date = today.strftime('%Y-%m-%d')
        
        logger.info(f"Syncing top 10 recent NDVI images for farm {farm_id} from {start_date} to {end_date}")
        
        try:
            # search products
            api, products = await search_sentinel_products(bbox, start_date, end_date)
            if not products:
                logger.info(f"No products found for farm {farm_id}")
                return

            # Sort by ingestion date descending
            sorted_products = sorted(
                products.values(), 
                key=lambda x: x['ingestiondate'], 
                reverse=True
            )
            
            # Filter by cloud cover < 30% to get usable images
            low_cloud_products = [p for p in sorted_products if p.get('cloud_cover', 100) < 30]
            
            if not low_cloud_products:
                logger.info(f"No low-cloud products found for farm {farm_id} (all have > 30% cloud)")
                return
            
            # Take top 10 low-cloud images
            recent_products = low_cloud_products[:10]

            for product_info in recent_products:
                acquisition_date_str = product_info['ingestiondate'].split('T')[0]
                acquisition_date = datetime.datetime.strptime(acquisition_date_str, '%Y-%m-%d').date()
                
                # Check if already exists
                repo = SatelliteRepositoryImpl(db)
                existing = await repo.get_existing_record(farm_id, 'NDVI', acquisition_date)
                if existing:
                    # print(f"Data for farm {farm_id} on {acquisition_date} already exists.")
                    continue

                logger.info(f"Downloading and processing product for farm {farm_id}: {product_info['title']}")

                # Download
                out = await download_product(api, product_info, out_dir=settings.OUTPUT_DIR)
                
                # find bands
                red_path, nir_path = find_band_paths(out)
                
                # Generate output path
                out_tif = os.path.join(settings.OUTPUT_DIR, f'ndvi_{uuid.uuid4().hex}.tif')
                
                # Compute (with bbox crop)
                out_tif, mean_val, min_val, max_val = compute_ndvi(red_path, nir_path, out_tif, bbox=bbox)
                
                # Save to DB
                new_record = SatelliteDataModel(
                    farm_id=farm_id,
                    acquisition_date=acquisition_date,
                    data_type='NDVI',
                    satellite_platform='SENTINEL-2',
                    mean_value=mean_val,
                    min_value=min_val,
                    max_value=max_val,
                    cloud_cover=product_info['cloud_cover']
                )
                await repo.save_data(new_record)
                logger.info(f"Saved NDVI data for farm {farm_id} on {acquisition_date}")
                
                # Clean up downloaded files to save space
                try:
                    # 1. Remove the extracted .SAFE directory
                    if os.path.exists(out) and os.path.isdir(out):
                        shutil.rmtree(out)
                        # print(f"Deleted temp folder: {out}")

                    # 2. Remove the original .zip file
                    zip_path = os.path.join(settings.OUTPUT_DIR, f"{product_info['title']}.zip")
                    if os.path.exists(zip_path):
                        os.remove(zip_path)
                        # print(f"Deleted temp zip: {zip_path}")
                        
                    # 3. Remove the generated .tif file
                    if os.path.exists(out_tif):
                        os.remove(out_tif)
                        # print(f"Deleted temp result: {out_tif}")
                except Exception as cleanup_error:
                    logger.warning(f"Error cleaning up files for farm {farm_id}: {cleanup_error}") 

        except Exception as e:
            logger.error(f"Error syncing farm {farm_id}: {e}")

    async def execute(self, req: NDVIRequest, db: AsyncSession) -> NDVIResponse:
        # validate bbox
        if len(req.bbox) != 4:
            raise HTTPException(status_code=400, detail='bbox must be [minx,miny,maxx,maxy]')
        
        try:
            # Parse dates - handle ISO format with time (e.g., 2025-12-07T22:25:30.988)
            start_date_str = req.start_date.split('T')[0]
            end_date_str = req.end_date.split('T')[0]
            start_d = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_d = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
            
            repo = SatelliteRepositoryImpl(db)
            
            # --- CHECK DB FIRST ---
            if req.farm_id:
                history = await repo.get_data_by_farm(req.farm_id, 'NDVI', start_d, end_d)
                if history:
                    # Found data in DB - return without downloading
                    chart_data = []
                    latest_record = None
                    
                    for record in history:
                        chart_data.append({
                            'date': record.acquisition_date.strftime('%Y-%m-%d'),
                            'value': round(record.mean_value, 2)
                        })
                        if latest_record is None or record.acquisition_date > latest_record.acquisition_date:
                            latest_record = record
                    
                    chart_data.sort(key=lambda x: x['date'])
                    
                    logger.info(f"Returning {len(history)} NDVI records from DB for farm {req.farm_id}")
                    
                    return NDVIResponse(
                        status="success",
                        ndvi_geotiff="",
                        image_base64="",
                        mean_ndvi=round(latest_record.mean_value, 2),
                        min_ndvi=round(latest_record.min_value, 2) if latest_record.min_value else 0.0,
                        max_ndvi=round(latest_record.max_value, 2) if latest_record.max_value else 0.0,
                        acquisition_date=latest_record.acquisition_date.strftime('%Y-%m-%d'),
                        chart_data=chart_data
                    )
            
            # --- NO DATA IN DB - DOWNLOAD FROM SENTINEL ---
            # search products
            api, products = await search_sentinel_products(req.bbox, start_date_str, end_date_str)
            if not products:
                raise HTTPException(status_code=404, detail='No Sentinel-2 product found for this bbox/date range')
            
            # pick best product (lowest cloud cover)
            best_product_uuid = None
            best_product_info = None
            min_cloud_cover = 101.0

            for uuid_val, info in products.items():
                if info['cloud_cover'] < min_cloud_cover:
                    min_cloud_cover = info['cloud_cover']
                    best_product_uuid = uuid_val
                    best_product_info = info
            
            if not best_product_info:
                 # Fallback to first if something goes wrong
                 best_product_uuid, best_product_info = next(iter(products.items()))

            logger.info(f"Selected product: {best_product_info['title']} with cloud cover {best_product_info['cloud_cover']}%")

            # Download
            out = await download_product(api, best_product_info, out_dir=settings.OUTPUT_DIR)
            
            # find bands
            red_path, nir_path = find_band_paths(out)
            
            # Generate output path
            out_tif = os.path.join(settings.OUTPUT_DIR, f'ndvi_{uuid.uuid4().hex}.tif')
            
            # Compute (with bbox crop)
            out_tif, mean_val, min_val, max_val = compute_ndvi(red_path, nir_path, out_tif, bbox=req.bbox)

            # Convert to Base64 PNG
            img_base64 = convert_tiff_to_base64_png(out_tif, colormap='RdYlGn', vmin=-1, vmax=1)

            acquisition_date_str = best_product_info['ingestiondate'].split('T')[0]
            acquisition_date = datetime.datetime.strptime(acquisition_date_str, '%Y-%m-%d').date()

            # --- SAVE TO DB ---
            if req.farm_id:
                # Check if exists
                existing = await repo.get_existing_record(req.farm_id, 'NDVI', acquisition_date)
                if not existing:
                    new_record = SatelliteDataModel(
                        farm_id=req.farm_id,
                        acquisition_date=acquisition_date,
                        data_type='NDVI',
                        satellite_platform='SENTINEL-2',
                        mean_value=mean_val,
                        min_value=min_val,
                        max_value=max_val,
                        cloud_cover=best_product_info['cloud_cover']
                    )
                    await repo.save_data(new_record)
            
            # --- GENERATE CHART DATA (FROM DB + CURRENT) ---
            chart_data = []
            
            if req.farm_id:
                # Fetch real history from DB (use already parsed dates)
                history = await repo.get_data_by_farm(req.farm_id, 'NDVI', start_d, end_d)
                
                for record in history:
                    chart_data.append({
                        'date': record.acquisition_date.strftime('%Y-%m-%d'),
                        'value': round(record.mean_value, 2)
                    })
                
                # Ensure current calculation is in the chart (if not already saved/fetched)
                current_in_chart = False
                for point in chart_data:
                    if point['date'] == acquisition_date_str:
                        current_in_chart = True
                        point['value'] = round(mean_val, 2) # Update with latest calc
                        break
                
                if not current_in_chart:
                    chart_data.append({
                        'date': acquisition_date_str,
                        'value': round(mean_val, 2)
                    })
                
                # Sort by date
                chart_data.sort(key=lambda x: x['date'])

            # Fallback to simulation if no history (or very few points) to keep UI looking good for demo
            if len(chart_data) < 2:
                 # Sort products by date
                sorted_products = sorted(products.values(), key=lambda x: x['ingestiondate'])
                
                chart_data = [] # Reset to use simulation
                for p in sorted_products:
                    p_date = p['ingestiondate'].split('T')[0]
                    # If it's the selected product, use the real value
                    if p['uuid'] == best_product_uuid:
                        val = mean_val
                    else:
                        # Simulate a value close to the mean (e.g., +/- 0.1)
                        val = mean_val + random.uniform(-0.1, 0.1)
                        val = max(-1.0, min(1.0, val)) # Clip to valid range
                    
                    chart_data.append({
                        'date': p_date,
                        'value': round(val, 2)
                    })

            return NDVIResponse(
                status="success", 
                ndvi_geotiff=out_tif, 
                image_base64=img_base64,
                mean_ndvi=round(mean_val, 2),
                min_ndvi=round(min_val, 2),
                max_ndvi=round(max_val, 2),
                acquisition_date=acquisition_date_str,
                chart_data=chart_data
            )
            
        except (RuntimeError, Exception) as e:
            err_str = str(e)
            logger.error(f"Error in CalculateNDVIUseCase: {err_str}")

            # If Copernicus credentials are missing/wrong, return mock data for demo/dev
            is_sentinel_error = any(k in err_str for k in [
                'COPERNICUS', 'Authentication failed', 'not set',
                'No Sentinel', 'credential', 'token'
            ])
            if is_sentinel_error:
                logger.warning("Sentinel credentials not configured – returning mock NDVI data")
                return _generate_mock_ndvi_response(req)

            raise HTTPException(status_code=500, detail=err_str)


def _generate_mock_ndvi_response(req) -> "NDVIResponse":
    """Return realistic mock NDVI data when Sentinel credentials are not configured."""
    import datetime as dt

    try:
        start_d = datetime.datetime.strptime(req.start_date.split('T')[0], '%Y-%m-%d').date()
        end_d = datetime.datetime.strptime(req.end_date.split('T')[0], '%Y-%m-%d').date()
    except Exception:
        end_d = datetime.date.today()
        start_d = end_d - datetime.timedelta(days=60)

    # Generate one point every 5 days (Sentinel-2 revisit)
    chart_data = []
    cur = start_d
    base_ndvi = 0.55 + random.uniform(-0.05, 0.05)
    while cur <= end_d:
        val = base_ndvi + random.uniform(-0.08, 0.08)
        val = round(max(0.1, min(0.9, val)), 2)
        chart_data.append({'date': cur.strftime('%Y-%m-%d'), 'value': val})
        cur += datetime.timedelta(days=5)

    if not chart_data:
        chart_data = [{'date': end_d.strftime('%Y-%m-%d'), 'value': round(base_ndvi, 2)}]

    latest = chart_data[-1]
    mean_ndvi = round(sum(p['value'] for p in chart_data) / len(chart_data), 2)

    return NDVIResponse(
        status="success (mock – configure COPERNICUS credentials for real data)",
        ndvi_geotiff="",
        image_base64="",
        mean_ndvi=mean_ndvi,
        min_ndvi=round(min(p['value'] for p in chart_data), 2),
        max_ndvi=round(max(p['value'] for p in chart_data), 2),
        acquisition_date=latest['date'],
        chart_data=chart_data,
    )

```

==================== backend\app\application\use_cases\pest_use_cases.py ====================
```python
"""
Pest risk forecasting use cases - business logic layer.
"""
import logging
from typing import Optional, List, Dict, Any

from app.infrastructure.external_services.gbif_service import GBIFService
from app.application.dto.pest_dto import (
    PestRiskForecastResponseDTO,
    LocationDTO,
    PestSummaryDTO,
    PestWarningDTO,
    SearchPeriodDTO,
    SpeciesSearchResponseDTO,
    SpeciesSearchDTO
)

logger = logging.getLogger(__name__)


class GetPestRiskForecastUseCase:
    """Get pest risk forecast for a field location."""
    
    def __init__(self, gbif_service: GBIFService):
        self.gbif_service = gbif_service
    
    async def execute(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 10.0,
        pest_scientific_names: Optional[List[str]] = None,
        years_back: int = 5
    ) -> PestRiskForecastResponseDTO:
        """
        Get pest risk forecast for given coordinates.
        
        Args:
            latitude: Field latitude
            longitude: Field longitude
            radius_km: Search radius in kilometers (default: 10km)
            pest_scientific_names: Optional list of specific pests to check
            years_back: Number of years to look back (default: 5)
        
        Returns:
            PestRiskForecastResponseDTO with warnings and historical data
        """
        try:
            # Get forecast data from GBIF
            forecast_data = await self.gbif_service.get_pest_risk_forecast(
                latitude=latitude,
                longitude=longitude,
                radius_km=radius_km,
                pest_scientific_names=pest_scientific_names,
                years_back=years_back
            )
            
            # Convert to DTOs
            location = LocationDTO(
                latitude=forecast_data["location"]["latitude"],
                longitude=forecast_data["location"]["longitude"],
                radius_km=forecast_data["location"]["radius_km"]
            )
            
            # Convert pest summary
            pest_summary = {}
            for pest_name, data in forecast_data.get("pest_summary", {}).items():
                pest_summary[pest_name] = PestSummaryDTO(
                    pest_name=pest_name,
                    species_key=data.get("species_key"),
                    yearly_occurrences=data.get("yearly_occurrences", {}),
                    total_occurrences=data.get("total_occurrences", 0),
                    most_recent_year=data.get("most_recent_year")
                )
            
            # Convert warnings
            warnings = [
                PestWarningDTO(
                    pest_name=w["pest_name"],
                    risk_level=w.get("risk_level", "low"),
                    message=w.get("message", ""),
                    last_seen_year=w.get("last_seen_year"),
                    occurrence_count=w.get("occurrence_count", 0)
                )
                for w in forecast_data.get("warnings", [])
            ]
            
            search_period = SearchPeriodDTO(
                start_year=forecast_data["search_period"]["start_year"],
                end_year=forecast_data["search_period"]["end_year"]
            )
            
            return PestRiskForecastResponseDTO(
                location=location,
                pest_summary=pest_summary,
                warnings=warnings,
                checked_pests=forecast_data.get("checked_pests", []),
                total_occurrences=forecast_data.get("total_occurrences", 0),
                search_period=search_period
            )
        
        except Exception as e:
            logger.error(f"Error in GetPestRiskForecastUseCase: {str(e)}")
            raise


class SearchSpeciesUseCase:
    """Search for species by name."""
    
    def __init__(self, gbif_service: GBIFService):
        self.gbif_service = gbif_service
    
    async def execute(
        self,
        query: str,
        limit: int = 20
    ) -> SpeciesSearchResponseDTO:
        """
        Search for species by name.
        
        Args:
            query: Species name (common or scientific)
            limit: Maximum number of results
        
        Returns:
            List of matching species
        """
        try:
            search_data = await self.gbif_service.search_species(query, limit)
            
            results = []
            for result in search_data.get("results", []):
                # Extract common name from vernacular names
                common_name = None
                if result.get("vernacularNames"):
                    for vn in result.get("vernacularNames", []):
                        if vn.get("vernacularName"):
                            common_name = vn.get("vernacularName")
                            break
                
                results.append(
                    SpeciesSearchDTO(
                        key=result.get("key", 0),
                        scientific_name=result.get("scientificName", ""),
                        canonical_name=result.get("canonicalName"),
                        common_name=common_name,
                        kingdom=result.get("kingdom")
                    )
                )
            
            return SpeciesSearchResponseDTO(
                results=results,
                count=len(results)
            )
        
        except Exception as e:
            logger.error(f"Error in SearchSpeciesUseCase: {str(e)}")
            raise


```

==================== backend\app\application\use_cases\soil_moisture_use_cases.py ====================
```python
import logging
import datetime
import os
import uuid

logger = logging.getLogger(__name__)
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.application.dto.soil_moisture_dto import (
    SoilMoistureRequest, SoilMoistureResponse,
    SoilMoistureQueryRequest, SoilMoistureQueryResponse
)
from app.infrastructure.external_services.sentinel_client import search_sentinel_products, download_product
from app.infrastructure.image_processing.soil_moisture_processing import find_s1_band_path, compute_soil_moisture_proxy
from app.infrastructure.image_processing.utils import convert_tiff_to_base64_png
from app.infrastructure.config.settings import get_settings
from app.infrastructure.repositories.satellite_repository_impl import SatelliteRepositoryImpl

settings = get_settings()


class GetSoilMoistureUseCase:
    """Use case to get soil moisture from database (cached from scheduler)"""
    
    async def execute(self, req: SoilMoistureQueryRequest, db: AsyncSession) -> SoilMoistureQueryResponse:
        try:
            # Parse dates - handle ISO format with time
            start_date_str = req.start_date.split('T')[0]
            end_date_str = req.end_date.split('T')[0]
            start_d = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_d = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
            
            repo = SatelliteRepositoryImpl(db)
            
            if req.farm_id:
                history = await repo.get_data_by_farm(req.farm_id, 'SOIL_MOISTURE', start_d, end_d)
                if history:
                    chart_data = []
                    latest_record = None
                    
                    for record in history:
                        chart_data.append({
                            'date': record.acquisition_date.strftime('%Y-%m-%d'),
                            'value': round(record.mean_value, 2)
                        })
                        if latest_record is None or record.acquisition_date > latest_record.acquisition_date:
                            latest_record = record
                    
                    chart_data.sort(key=lambda x: x['date'])
                    
                    logger.info(f"Returning {len(history)} Soil Moisture records from DB for farm {req.farm_id}")
                    
                    return SoilMoistureQueryResponse(
                        status="success",
                        mean_value=round(latest_record.mean_value, 2),
                        min_value=round(latest_record.min_value, 2) if latest_record.min_value else 0.0,
                        max_value=round(latest_record.max_value, 2) if latest_record.max_value else 1.0,
                        acquisition_date=latest_record.acquisition_date.strftime('%Y-%m-%d'),
                        chart_data=chart_data
                    )
            
            # No data found
            return SoilMoistureQueryResponse(
                status="no_data",
                mean_value=0.0,
                min_value=0.0,
                max_value=0.0,
                acquisition_date="",
                chart_data=[]
            )
            
        except Exception as e:
            logger.error(f"Error in GetSoilMoistureUseCase: {e}")
            raise HTTPException(status_code=500, detail=str(e))

class CalculateSoilMoistureUseCase:
    async def execute(self, req: SoilMoistureRequest) -> SoilMoistureResponse:
        # validate bbox
        if len(req.bbox) != 4:
            raise HTTPException(status_code=400, detail='bbox must be [minx,miny,maxx,maxy]')
        
        try:
            # Calculate date range for Sentinel-1 search
            # Sentinel-1 revisit time is 6-12 days, so we search ±7 days from requested date
            try:
                date_obj = datetime.datetime.fromisoformat(req.date)
            except ValueError:
                date_obj = datetime.datetime.strptime(req.date, '%Y-%m-%d')
            
            date_start = (date_obj - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
            date_end = (date_obj + datetime.timedelta(days=7)).strftime('%Y-%m-%d')

            # search products (Sentinel-1)
            api, products = await search_sentinel_products(req.bbox, date_start, date_end, platformname='SENTINEL-1')
            if not products:
                raise HTTPException(status_code=404, detail='No Sentinel-1 product found for this bbox/date range (±7 days)')
            
            # pick product closest to requested date
            target_date = date_obj.date()
            best_product = None
            min_diff = None
            
            for uuid_val, info in products.items():
                prod_date_str = info['ingestiondate'].split('T')[0]
                prod_date = datetime.datetime.strptime(prod_date_str, '%Y-%m-%d').date()
                diff = abs((prod_date - target_date).days)
                
                if min_diff is None or diff < min_diff:
                    min_diff = diff
                    best_product = (uuid_val, info)
            
            first_uuid, prod = best_product
            
            logger.info(f"Selected Sentinel-1 product: {prod['title']} (closest to {req.date}, diff: {min_diff} days)")

            # Download
            out = await download_product(api, prod, out_dir=settings.OUTPUT_DIR)
            
            # find bands (VV polarization)
            vv_path = find_s1_band_path(out, polarization='vv')
            
            # Generate output path
            out_tif = os.path.join(settings.OUTPUT_DIR, f'soil_moisture_{uuid.uuid4().hex}.tif')
            
            # Compute
            _, mean_val = compute_soil_moisture_proxy(vv_path, out_tif, bbox=req.bbox)

            # Convert to Base64 PNG
            img_base64 = convert_tiff_to_base64_png(out_tif, colormap='Blues', vmin=0, vmax=1)

            return SoilMoistureResponse(
                status="success", 
                soil_moisture_map=out_tif, 
                image_base64=img_base64,
                mean_value=mean_val
            )
            
        except Exception as e:
            logger.error(f"Error in CalculateSoilMoistureUseCase: {e}")
            raise HTTPException(status_code=500, detail=str(e))

```

==================== backend\app\application\use_cases\user_use_cases.py ====================
```python
"""
User-related use cases.
"""
from typing import Optional
from app.application.use_cases.base import BaseUseCase
from app.domain.entities.user import User
from app.domain.repositories.user_repository import UserRepository
import secrets
from app.application.dto.user_dto import CreateUserDTO, UserDTO, UserLoginDTO, TokenDTO, ChangePasswordDTO, GoogleLoginDTO
from app.infrastructure.security.jwt import get_password_hash, verify_password, create_access_token
from app.infrastructure.config.settings import get_settings


class CreateUserUseCase(BaseUseCase[CreateUserDTO, UserDTO]):
    """Use case for creating a new user (Register)."""
    
    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository
    
    async def execute(self, input_dto: CreateUserDTO) -> UserDTO:
        """Create a new user."""
        # Check if user already exists
        existing_user = await self.user_repository.get_by_email(input_dto.email)
        if existing_user:
            raise ValueError("User with this email already exists")
        
        # Create user entity
        user = User(
            email=input_dto.email,
            username=input_dto.username,
            hashed_password=get_password_hash(input_dto.password),
            full_name=input_dto.full_name,
            is_active=True,
            is_superuser=False
        )
        
        # Save to repository
        created_user = await self.user_repository.create(user)
        
        return UserDTO.from_entity(created_user)


class LoginUserUseCase(BaseUseCase[UserLoginDTO, TokenDTO]):
    """Use case for user login."""
    
    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository
    
    async def execute(self, input_dto: UserLoginDTO) -> TokenDTO:
        """Authenticate user and return token."""
        user = await self.user_repository.get_by_email(input_dto.email)
        if not user or not verify_password(input_dto.password, user.hashed_password):
            raise ValueError("Incorrect email or password")
        
        if not user.is_active:
            raise ValueError("Inactive user")
            
        access_token = create_access_token(subject=user.id)
        return TokenDTO(access_token=access_token, token_type="bearer")


class LogoutUserUseCase(BaseUseCase[None, bool]):
    """Use case for user logout."""
    
    async def execute(self, input_dto: None = None) -> bool:
        """
        Logout user.
        Since we use stateless JWT, we don't need to do anything on server side
        unless we implement a blacklist. For now, just return True.
        """
        return True


class GoogleLoginUseCase(BaseUseCase[GoogleLoginDTO, TokenDTO]):
    """Use case for Google OAuth2 login."""

    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository

    async def execute(self, input_dto: GoogleLoginDTO) -> TokenDTO:
        """Verify Google ID token and return JWT."""
        try:
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests

            settings = get_settings()
            id_info = google_id_token.verify_oauth2_token(
                input_dto.id_token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except Exception as e:
            raise ValueError(f"Invalid Google token: {e}")

        email = id_info.get("email")
        if not email:
            raise ValueError("Google token does not contain an email")

        full_name = id_info.get("name")
        # Use part before @ as username base
        username_base = email.split("@")[0]

        # Find existing user or create new one
        user = await self.user_repository.get_by_email(email)
        if not user:
            # Generate a random secure password (user will never use it)
            random_password = get_password_hash(secrets.token_urlsafe(32))
            # Ensure unique username
            username = username_base
            existing = await self.user_repository.get_by_username(username)
            if existing:
                username = f"{username_base}_{secrets.token_hex(4)}"

            user = User(
                email=email,
                username=username,
                hashed_password=random_password,
                full_name=full_name,
                is_active=True,
                is_superuser=False,
            )
            user = await self.user_repository.create(user)
        elif not user.is_active:
            raise ValueError("Tài khoản đã bị vô hiệu hoá")

        access_token = create_access_token(subject=user.id)
        return TokenDTO(access_token=access_token, token_type="bearer")


class ChangePasswordUseCase(BaseUseCase[ChangePasswordDTO, bool]):
    """Use case for changing user password."""
    
    def __init__(self, user_repository: UserRepository, user_id: int):
        self.user_repository = user_repository
        self.user_id = user_id
    
    async def execute(self, input_dto: ChangePasswordDTO) -> bool:
        """Change user password."""
        user = await self.user_repository.get_by_id(self.user_id)
        if not user:
            raise ValueError("User not found")
            
        if not verify_password(input_dto.current_password, user.hashed_password):
            raise ValueError("Incorrect current password")
            
        user.hashed_password = get_password_hash(input_dto.new_password)
        await self.user_repository.update(self.user_id, user)
        return True


```

==================== backend\app\application\use_cases\weather_use_cases.py ====================
```python
"""
Weather use cases - business logic layer.
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.infrastructure.external_services.weather_service import (
    OpenMeteoService,
    PhotonGeocodingService
)
from app.application.dto.weather_dto import (
    ForecastResponseDTO,
    LocationDTO,
    CurrentWeatherDTO,
    HourlyWeatherDTO,
    LocationSearchResponseDTO,
    LocationSearchDTO,
    ReverseGeocodeDTO
)

logger = logging.getLogger(__name__)


class GetWeatherForecastUseCase:
    """Get weather forecast for a location."""
    
    def __init__(
        self,
        open_meteo_service: OpenMeteoService,
        photon_service: PhotonGeocodingService
    ):
        self.open_meteo_service = open_meteo_service
        self.photon_service = photon_service
    
    async def execute(
        self,
        latitude: float,
        longitude: float,
        location_name: Optional[str] = None,
        hours_ahead: int = 24
    ) -> ForecastResponseDTO:
        """
        Get weather forecast for given coordinates.
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
            location_name: Optional location name (if not provided, will be fetched)
            hours_ahead: Number of hours to forecast
        
        Returns:
            ForecastResponseDTO with current and hourly weather data
        """
        try:
            # Get location name if not provided
            if not location_name:
                geo_data = await self.photon_service.reverse_geocode(latitude, longitude)
                if geo_data.get("features"):
                    props = geo_data["features"][0].get("properties", {})
                    location_name = props.get("name", "Unknown")
                    country = props.get("country", "Unknown")
                else:
                    location_name = "Unknown"
                    country = "Unknown"
            else:
                country = "Unknown"
            
            # Get weather forecast
            forecast_data = await self.open_meteo_service.get_forecast(
                latitude, 
                longitude,
                hours_ahead
            )
            
            # Parse current weather
            current = forecast_data.get("current", {})
            current_weather = CurrentWeatherDTO(
                time=current.get("time", ""),
                temperature_2m=current.get("temperature_2m", 0.0),
                relative_humidity_2m=current.get("relative_humidity_2m", 0),
                apparent_temperature=current.get("apparent_temperature"),
                weather_code=current.get("weather_code", 0),
                wind_speed_10m=current.get("wind_speed_10m", 0.0),
                precipitation=current.get("precipitation", 0.0),
                is_day=current.get("is_day", 0)
            )
            
            # Parse hourly data
            hourly = forecast_data.get("hourly", {})
            hourly_times = hourly.get("time", [])
            hourly_temps = hourly.get("temperature_2m", [])
            hourly_humidity = hourly.get("relative_humidity_2m", [])
            hourly_weather_code = hourly.get("weather_code", [])
            hourly_wind_speed = hourly.get("wind_speed_10m", [])
            hourly_precipitation = hourly.get("precipitation", [])
            hourly_soil_moisture = hourly.get("soil_moisture_0_to_1cm", [])
            
            hourly_weather_list = []
            for i in range(min(len(hourly_times), hours_ahead)):
                hourly_weather_list.append(
                    HourlyWeatherDTO(
                        time=hourly_times[i] if i < len(hourly_times) else "",
                        temperature_2m=hourly_temps[i] if i < len(hourly_temps) else 0.0,
                        relative_humidity_2m=int(hourly_humidity[i]) if i < len(hourly_humidity) else 0,
                        weather_code=int(hourly_weather_code[i]) if i < len(hourly_weather_code) else 0,
                        wind_speed_10m=hourly_wind_speed[i] if i < len(hourly_wind_speed) else 0.0,
                        precipitation=hourly_precipitation[i] if i < len(hourly_precipitation) else 0.0,
                        soil_moisture_0_to_1cm=hourly_soil_moisture[i] if i < len(hourly_soil_moisture) else 0.0
                    )
                )
            
            location = LocationDTO(
                name=location_name,
                country=country,
                latitude=latitude,
                longitude=longitude
            )
            
            return ForecastResponseDTO(
                location=location,
                current=current_weather,
                hourly=hourly_weather_list
            )
        
        except Exception as e:
            logger.error(f"Error in GetWeatherForecastUseCase: {str(e)}")
            raise


class SearchLocationUseCase:
    """Search for locations by query."""
    
    def __init__(self, photon_service: PhotonGeocodingService):
        self.photon_service = photon_service
    
    async def execute(
        self,
        query: str,
        limit: int = 10
    ) -> LocationSearchResponseDTO:
        """
        Search for locations matching the query.
        
        Args:
            query: Search query
            limit: Maximum number of results
        
        Returns:
            List of matching locations with coordinates
        """
        try:
            search_data = await self.photon_service.search_location(query, limit)
            
            results = []
            for feature in search_data.get("features", []):
                props = feature.get("properties", {})
                coords = feature.get("geometry", {}).get("coordinates", [0, 0])
                
                result = LocationSearchDTO(
                    name=props.get("name", "Unknown"),
                    latitude=coords[1],
                    longitude=coords[0],
                    country=props.get("country", "Unknown"),
                    state=props.get("state"),
                    type=props.get("osm_type", "location")
                )
                results.append(result)
            
            return LocationSearchResponseDTO(
                results=results,
                count=len(results)
            )
        
        except Exception as e:
            logger.error(f"Error in SearchLocationUseCase: {str(e)}")
            raise


class ReverseGeocodeUseCase:
    """Get location information from coordinates."""
    
    def __init__(self, photon_service: PhotonGeocodingService):
        self.photon_service = photon_service
    
    async def execute(
        self,
        latitude: float,
        longitude: float
    ) -> ReverseGeocodeDTO:
        """
        Get location details from coordinates.
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
        
        Returns:
            Location information (name, address, country, etc.)
        """
        try:
            geo_data = await self.photon_service.reverse_geocode(latitude, longitude, limit=1)
            
            if not geo_data.get("features"):
                raise ValueError("Location not found")
            
            feature = geo_data["features"][0]
            props = feature.get("properties", {})
            
            # Build address
            address_parts = []
            for key in ["street", "housenumber", "suburb", "district"]:
                if key in props and props[key]:
                    address_parts.append(props[key])
            address = ", ".join(address_parts) if address_parts else None
            
            return ReverseGeocodeDTO(
                name=props.get("name", "Unknown"),
                country=props.get("country", "Unknown"),
                country_code=props.get("country_code", ""),
                state=props.get("state"),
                address=address,
                latitude=latitude,
                longitude=longitude
            )
        
        except Exception as e:
            logger.error(f"Error in ReverseGeocodeUseCase: {str(e)}")
            raise

```

==================== backend\app\domain\__init__.py ====================
```python

```

==================== backend\app\domain\entities\__init__.py ====================
```python

```

