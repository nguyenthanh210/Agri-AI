
==================== backend\app\domain\entities\base.py ====================
```py
"""
Base entity class for domain models.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class BaseEntity(BaseModel):
    """Base entity with common fields."""
    
    id: Optional[int] = None
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

```

==================== backend\app\domain\entities\crop_batch.py ====================
```py
from typing import Optional, List
from datetime import datetime
from pydantic import Field
from .base import BaseEntity

class CropBatch(BaseEntity):
    farm_id: int
    name: str
    seed_type: Optional[str] = None
    planting_date: Optional[datetime] = None
    expected_harvest_date: Optional[datetime] = None
    status: str = "active"
    qr_code_id: Optional[str] = None

```

==================== backend\app\domain\entities\farm.py ====================
```py
from typing import List, Optional
from pydantic import BaseModel
from .base import BaseEntity

class Coordinate(BaseModel):
    lat: float
    lng: float

class FarmArea(BaseEntity):
    name: str
    description: Optional[str] = None
    coordinates: List[Coordinate]
    area_size: Optional[float] = None
    crop_type: Optional[str] = None
    user_id: int

```

==================== backend\app\domain\entities\farming_log.py ====================
```py
from typing import Optional
from datetime import datetime
from pydantic import Field
from .base import BaseEntity

class FarmingLog(BaseEntity):
    batch_id: int
    activity_type: str
    description: Optional[str] = None
    image_url: Optional[str] = None

```

==================== backend\app\domain\entities\user.py ====================
```py
"""
User domain entity.
"""
from typing import Optional
from pydantic import EmailStr
from app.domain.entities.base import BaseEntity


class User(BaseEntity):
    """User domain entity."""
    
    email: EmailStr
    username: str
    hashed_password: str
    full_name: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False

```

==================== backend\app\domain\repositories\__init__.py ====================
```py

```

==================== backend\app\domain\repositories\base.py ====================
```py
"""
Base repository interface.
"""
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional, List

T = TypeVar('T')


class BaseRepository(ABC, Generic[T]):
    """Base repository interface for data access."""
    
    @abstractmethod
    async def create(self, entity: T) -> T:
        """Create a new entity."""
        pass
    
    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[T]:
        """Get entity by ID."""
        pass
    
    @abstractmethod
    async def get_all(self, skip: int = 0, limit: int = 100) -> List[T]:
        """Get all entities with pagination."""
        pass
    
    @abstractmethod
    async def update(self, id: int, entity: T) -> Optional[T]:
        """Update an entity."""
        pass
    
    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete an entity."""
        pass

```
