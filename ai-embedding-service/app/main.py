"""
FastAPI application initialization
"""
from fastapi import FastAPI
from app.routes import embeddings_router, health_router
from app.middleware import setup_cors, setup_error_handlers
from app.config.settings import settings
from app.config.logging import logger
from app import __version__


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    
    app = FastAPI(
        title="Embedding Service",
        description="FastAPI service for generating text embeddings using sentence-transformers",
        version=__version__,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    
    # Setup middleware
    setup_cors(app)
    setup_error_handlers(app)
    
    # Include routers
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(embeddings_router, prefix="/api/v1")
    
    # Startup event - preload model (optional, can be lazy-loaded on first request)
    @app.on_event("startup")
    async def startup_event():
        logger.info(f"Starting Embedding Service v{__version__}")
        logger.info(f"Default model: {settings.EMBEDDING_MODEL}")
        logger.info(f"Device: {settings.DEVICE}")
        
        # Preload default model (commented out to avoid DLL issues at startup)
        # Model will be loaded lazily on first request
        # try:
        #     from app.services.model_manager import model_manager
        #     model_manager.get_model()  # Load default model
        #     logger.info("Default model loaded successfully")
        # except Exception as e:
        #     logger.error(f"Failed to load default model: {str(e)}")
        logger.info("Model will be loaded on first request")
    
    # Shutdown event
    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info("Shutting down Embedding Service")
    
    return app


# Create app instance
app = create_app()

