"""
CORS middleware configuration
"""
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI


def setup_cors(app: FastAPI):
    """Setup CORS middleware"""
    from app.config.settings import settings
    import os
    
    # Get allowed origins from settings
    cors_origins = settings.CORS_ORIGINS
    if cors_origins != "*":
        # Split comma-separated origins
        allowed_origins = [origin.strip() for origin in cors_origins.split(",")]
    else:
        # In production, restrict to specific origins
        if settings.ENVIRONMENT == "production":
            allowed_origins = [
                os.getenv("FRONTEND_URL", "https://yourdomain.com")
            ]
        else:
            allowed_origins = ["*"]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

