"""
SQLAlchemy Farming Log model.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from app.infrastructure.database.database import Base

class FarmingLogModel(Base):
    """Farming Log database model."""
    
    __tablename__ = "farming_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("crop_batches.id"), nullable=False)
    activity_type = Column(String, nullable=False) # e.g., "Gieo hạt", "Tưới nước", "Bón phân", "Phun thuốc", "Khác"
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    batch = relationship("CropBatchModel", back_populates="logs")
