import logging
import os
import rasterio

logger = logging.getLogger(__name__)
import numpy as np
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds
from typing import Tuple, List

def find_s1_band_path(safe_path: str, polarization: str = 'vv') -> str:
    """
    Find the measurement tiff for a specific polarization in Sentinel-1 SAFE folder.
    """
    # Sentinel-1 structure: measurement/s1a-iw-grd-vv-....tiff
    for root, dirs, files in os.walk(safe_path):
        for f in files:
            if f.endswith('.tiff') or f.endswith('.tif'):
                if f'iw-grd-{polarization}' in f.lower():
                    return os.path.join(root, f)
    
    raise FileNotFoundError(f'Could not find {polarization} band in SAFE product')

def compute_soil_moisture_proxy(vv_path: str, out_path: str, bbox: List[float] = None) -> Tuple[str, float]:
    """
    Compute a simple Soil Moisture proxy from Sentinel-1 VV band.
    
    Sentinel-1 GRD values are Digital Numbers (DN) that need calibration.
    For GRD products: sigma0 = DN^2 / A^2 where A is from calibration LUT.
    Simplified approach: Convert to pseudo-dB for relative moisture visualization.
    
    Reference backscatter ranges (sigma0 in dB):
    - Dry soil: -20 to -15 dB
    - Moist soil: -15 to -10 dB
    - Wet soil: -10 to -5 dB
    - Water: -5 to 0 dB (or positive for specular reflection)
    """
    mean_val = 0.0
    with rasterio.open(vv_path) as src:
        # Calculate window if bbox is provided
        window = None
        transform = src.transform
        
        if bbox:
            try:
                # Transform bbox (WGS84) to source CRS
                # bbox is [min_lon, min_lat, max_lon, max_lat]
                left, bottom, right, top = bbox
                
                if src.crs and src.crs.to_epsg() != 4326:
                    left, bottom, right, top = transform_bounds(4326, src.crs, left, bottom, right, top)
                
                window = from_bounds(left, bottom, right, top, src.transform)
                transform = src.window_transform(window)
            except Exception as e:
                logger.warning(f"Error calculating window from bbox: {e}. Reading full image.")
                window = None

        # Read data (only the window if specified)
        if window:
            dn = src.read(1, window=window).astype('float64')
        else:
            dn = src.read(1).astype('float64')
        
        # Avoid log of zero and negative values
        dn = np.where(dn > 0, dn, np.nan)
        
        # Sentinel-1 GRD calibration (simplified)
        # For Level-1 GRD raw products, DN values are typically 0-2000 range
        # Calibration constant adjusted so typical land DN (~130) gives moderate moisture
        # Reference: Land typically ranges from -25dB (very dry) to -5dB (very wet/water)
        calibration_constant = 3e5  # Calibrated for raw GRD products
        sigma0_linear = (dn ** 2) / calibration_constant
        
        # Convert to dB: sigma0_dB = 10 * log10(sigma0_linear)
        sigma0_db = 10 * np.log10(sigma0_linear + 1e-10)
        
        # Normalize for soil moisture visualization
        # Wet soil has higher backscatter (closer to 0 dB or positive)
        # Dry soil has lower backscatter (around -20 dB)
        min_db = -20.0  # Very dry soil
        max_db = -5.0   # Very wet soil / standing water
        
        soil_moisture_index = (sigma0_db - min_db) / (max_db - min_db)
        soil_moisture_index = np.clip(soil_moisture_index, 0, 1)
        
        # Calculate mean (ignoring NaNs)
        mean_val = float(np.nanmean(soil_moisture_index))

        # Write output
        profile = src.meta.copy()
        profile.update(
            driver='GTiff',
            height=dn.shape[0],
            width=dn.shape[1],
            transform=transform,
            count=1,
            dtype=rasterio.float32,
            compress='lzw'
        )
        
        with rasterio.open(out_path, 'w', **profile) as dst:
            dst.write(soil_moisture_index, 1)
            
    return out_path, mean_val
