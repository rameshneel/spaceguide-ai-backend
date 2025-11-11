"""
Application settings and configuration
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os
from pathlib import Path


def _get_env_file() -> Optional[str]:
    """
    Determine which .env file to load based on ENVIRONMENT variable.
    Priority:
    1. Environment-specific file (.env.dev, .env.staging, .env.prod) based on ENVIRONMENT
    2. Generic .env file (fallback)
    """
    # Get ENVIRONMENT from system environment first (may be set by docker-compose)
    environment = os.getenv("ENVIRONMENT", "development")
    
    # Map environment to .env file
    env_file_map = {
        "development": ".env.dev",
        "staging": ".env.staging",
        "production": ".env.prod",
    }
    
    # Try environment-specific file first
    env_file_name = env_file_map.get(environment, ".env.dev")
    env_file_path = Path(env_file_name)
    
    if env_file_path.exists():
        return str(env_file_path)
    
    # Fallback to generic .env file
    generic_env_path = Path(".env")
    if generic_env_path.exists():
        return str(generic_env_path)
    
    # Return None if no .env file found (will use environment variables only)
    return None


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Environment Configuration
    ENVIRONMENT: str = "development"  # "development", "staging", or "production"
    
    # Model Configuration
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    DEVICE: str = "cpu"  # "cpu" or "cuda"
    
    # Batch Processing
    BATCH_SIZE: int = 32
    MAX_TEXT_LENGTH: int = 512
    MAX_BATCH_SIZE: int = 100
    
    # API Configuration
    API_PORT: int = 8001
    API_HOST: str = "0.0.0.0"
    LOG_LEVEL: str = "INFO"
    
    # Performance
    NORMALIZE_EMBEDDINGS: bool = False
    MODEL_CACHE_SIZE: int = 1
    
    # Supported Models
    SUPPORTED_MODELS: str = "all-MiniLM-L6-v2"
    
    # CORS Configuration
    CORS_ORIGINS: str = "*"  # Comma-separated list of allowed origins
    
    @property
    def supported_models_list(self) -> List[str]:
        """Get list of supported models"""
        return [m.strip() for m in self.SUPPORTED_MODELS.split(",")]
    
    model_config = SettingsConfigDict(
        env_file=_get_env_file() or ".env",  # Load environment-specific or generic .env
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


# Global settings instance
settings = Settings()

