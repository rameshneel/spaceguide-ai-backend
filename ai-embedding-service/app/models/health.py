"""
Pydantic models for health check responses
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any


class ModelInfo(BaseModel):
    """Model information"""
    name: str
    dimensions: int
    max_sequence_length: int
    device: str


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    version: str
    model: Optional[ModelInfo] = None
    device: str
    message: Optional[str] = None

