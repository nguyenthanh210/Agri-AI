import asyncio
from app.infrastructure.external_services.gemini_service import GeminiService
import logging

logging.basicConfig(level=logging.DEBUG)

async def main():
    service = GeminiService()
    try:
        result = await service.predict_yield_and_finance(
            crop_type="Lúa nước",
            area_ha=1.0,
            seed_cost=5000000,
            fertilizer_cost=10000000,
            labor_cost=8000000,
            expected_price_per_kg=8000,
        )
        print("Success!")
        print(result)
    except Exception as e:
        print("Exception:", e)

if __name__ == "__main__":
    asyncio.run(main())
