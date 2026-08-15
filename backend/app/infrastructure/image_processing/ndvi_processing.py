import os
import rasterio
import numpy as np
from rasterio.warp import calculate_default_transform
from rasterio.enums import Resampling
from typing import Tuple

def find_band_paths(safe_path: str) -> Tuple[str, str]:
    """Given a Sentinel-2 SAFE folder or zip, find paths to B04 (red) and B08 (nir).
    This function assumes the L2A SAFE file structure. For zipped products you may need to unzip first.
    Looks for 10m resolution bands in IMG_DATA folder (not mask files in QI_DATA).
    """
    # naive search - walk folder
    red = None
    nir = None
    for root, dirs, files in os.walk(safe_path):
        # Skip QI_DATA folder (contains mask files, not actual bands)
        if 'QI_DATA' in root:
            continue
        for f in files:
            if f.endswith('.jp2'):
                # Look for B04 and B08 at 10m resolution in IMG_DATA
                if '_B04_10m' in f:
                    red = os.path.join(root, f)
                if '_B08_10m' in f:
                    nir = os.path.join(root, f)
    if not red or not nir:
        raise FileNotFoundError('Could not find B04 or B08 in SAFE product')
    return red, nir

def compute_ndvi(red_path: str, nir_path: str, out_path: str, bbox: list = None, resampling=Resampling.bilinear) -> Tuple[str, float, float, float]:
    """Compute NDVI from red and nir bands and save to GeoTIFF.
    NDVI = (NIR - RED) / (NIR + RED)
    
    Args:
        bbox: [minx, miny, maxx, maxy] in EPSG:4326 to crop the result
    """
    from rasterio.windows import from_bounds
    from rasterio.warp import transform_bounds
    
    with rasterio.open(red_path) as r_red, rasterio.open(nir_path) as r_nir:
        # If bbox provided, compute window to read only that area
        window = None
        if bbox:
            # Transform bbox from EPSG:4326 to raster CRS
            minx, miny, maxx, maxy = bbox
            if r_red.crs and r_red.crs.to_epsg() != 4326:
                from pyproj import Transformer
                transformer = Transformer.from_crs("EPSG:4326", r_red.crs, always_xy=True)
                minx, miny = transformer.transform(minx, miny)
                maxx, maxy = transformer.transform(maxx, maxy)
            
            window = from_bounds(minx, miny, maxx, maxy, r_red.transform)
        
        # Read arrays (with optional window for cropping)
        if r_red.crs != r_nir.crs or r_red.transform != r_nir.transform or r_red.width != r_nir.width or r_red.height != r_nir.height:
            nir_arr = r_nir.read(1, out_shape=(r_red.count, r_red.height, r_red.width), resampling=resampling)
            red_arr = r_red.read(1).astype('float32')
        else:
            if window:
                nir_arr = r_nir.read(1, window=window).astype('float32')
                red_arr = r_red.read(1, window=window).astype('float32')
            else:
                nir_arr = r_nir.read(1).astype('float32')
                red_arr = r_red.read(1).astype('float32')

        # Ensure float32 for division
        if nir_arr.dtype != 'float32':
            nir_arr = nir_arr.astype('float32')

        np.seterr(divide='ignore', invalid='ignore')
        ndvi = (nir_arr - red_arr) / (nir_arr + red_arr)
        # Clip to -1..1
        ndvi = np.clip(ndvi, -1, 1)

        # write to GeoTIFF
        profile = r_red.meta.copy()
        if window:
            profile.update(
                height=int(window.height),
                width=int(window.width),
                transform=r_red.window_transform(window)
            )
        profile.update(
            driver='GTiff',
            count=1, 
            dtype=rasterio.float32, 
            compress='lzw'
        )
        
        with rasterio.open(out_path, 'w', **profile) as dst:
            dst.write(ndvi.astype(rasterio.float32), 1)

    # Calculate stats
    # Mask out NaN values and zeros (no data) for stats
    valid_ndvi = ndvi[~np.isnan(ndvi) & (ndvi != 0)]
    mean_val = float(np.mean(valid_ndvi)) if valid_ndvi.size > 0 else 0.0
    min_val = float(np.min(valid_ndvi)) if valid_ndvi.size > 0 else 0.0
    max_val = float(np.max(valid_ndvi)) if valid_ndvi.size > 0 else 0.0

    return out_path, mean_val, min_val, max_val
