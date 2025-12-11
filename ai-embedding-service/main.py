"""
Entry point for the FastAPI Embedding Service
"""
import uvicorn
from app.main import app
from app.config.settings import settings
from app.config.logging import logger

if __name__ == "__main__":
    logger.info(f"Starting server on {settings.API_HOST}:{settings.API_PORT}")
    
    import os
    
    # Disable reload in production
    is_development = settings.ENVIRONMENT == "development"
    
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=is_development,  # Only enable auto-reload in development
        log_level=settings.LOG_LEVEL.lower(),
        workers=1 if is_development else int(os.getenv("UVICORN_WORKERS", "1")),
    )

