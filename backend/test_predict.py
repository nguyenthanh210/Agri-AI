import asyncio
from app.infrastructure.image_processing.disease_detection import disease_detection_service
import PIL.Image as Image
import io

# create dummy image
img = Image.new('RGB', (224, 224), color = 'red')
img_byte_arr = io.BytesIO()
img.save(img_byte_arr, format='JPEG')
img_bytes = img_byte_arr.getvalue()

async def test():
    try:
        res = await disease_detection_service.predict(img_bytes)
        print("SUCCESS:", res)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(test())
