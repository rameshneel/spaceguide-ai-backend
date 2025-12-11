"""
Health check endpoints
"""
from fastapi import APIRouter, HTTPException
from app.models.health import HealthResponse, ModelInfo
from app.services.model_manager import model_manager
from app.config.settings import settings
from app import __version__

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/", response_model=HealthResponse)
async def health_check():
    """Basic health check"""
    try:
        # Try to get default model info
        model_info = None
        try:
            model = model_manager.get_model()
            model_info_dict = model_manager.get_model_info(settings.EMBEDDING_MODEL)
            if model_info_dict:
                model_info = ModelInfo(**model_info_dict)
        except Exception as e:
            # Model not loaded yet, but service is still healthy
            pass
        
        return HealthResponse(
            status="healthy",
            service="embedding-service",
            version=__version__,
            model=model_info,
            device=settings.DEVICE,
            message="Service is running"
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")


@router.get("/ready", response_model=HealthResponse)
async def readiness_check():
    """Readiness check - verifies model is loaded"""
    try:
        model = model_manager.get_model()
        model_info_dict = model_manager.get_model_info(settings.EMBEDDING_MODEL)
        
        if not model_info_dict:
            raise HTTPException(
                status_code=503,
                detail="Model not loaded"
            )
        
        model_info = ModelInfo(**model_info_dict)
        
        return HealthResponse(
            status="ready",
            service="embedding-service",
            version=__version__,
            model=model_info,
            device=settings.DEVICE,
            message="Service is ready to process requests"
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service not ready: {str(e)}")

