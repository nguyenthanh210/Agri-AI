"""
SQLAlchemy Crop Batch model.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.infrastructure.database.database import Base

class CropBatchModel(Base):
    """Crop Batch database model."""
    
    __tablename__ = "crop_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    name = Column(String, index=True, nullable=False)
    seed_type = Column(String, nullable=True)
    planting_date = Column(DateTime, nullable=True)
    expected_harvest_date = Column(DateTime, nullable=True)
    status = Column(String, default="active") # active, harvested
    qr_code_id = Column(String, default=lambda: str(uuid.uuid4()), unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    farm = relationship("FarmModel", backref="crop_batches")
    logs = relationship("FarmingLogModel", back_populates="batch", cascade="all, delete-orphan")
