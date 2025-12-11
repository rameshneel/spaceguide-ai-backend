"""
Model Manager for loading and caching sentence-transformers models
"""
# Lazy import to avoid DLL issues at startup
from typing import Dict, Optional
from app.config.settings import settings
from app.config.logging import logger


class ModelManager:
    """Manages loading, caching, and unloading of embedding models"""
    
    def __init__(self):
        self.models: Dict[str, any] = {}  # SentenceTransformer type (lazy loaded)
        self.model_info: Dict[str, dict] = {}
        self.max_cache_size = settings.MODEL_CACHE_SIZE
        self.device = settings.DEVICE
    
    def get_model(self, model_name: Optional[str] = None):
        """
        Get a model instance, loading it if not already cached
        
        Args:
            model_name: Name of the model to load. Uses default if None.
            
        Returns:
            SentenceTransformer instance
        """
        # Lazy import to avoid DLL issues at startup
        from sentence_transformers import SentenceTransformer
        
        model_name = model_name or settings.EMBEDDING_MODEL
        
        # Check if model is already loaded
        if model_name in self.models:
            logger.debug(f"Using cached model: {model_name}")
            return self.models[model_name]
        
        # Load model
        return self.load_model(model_name)
    
    def load_model(self, model_name: str):
        """
        Load a model and cache it
        
        Args:
            model_name: Name of the model to load
            
        Returns:
            SentenceTransformer instance
        """
        # Lazy import to avoid DLL issues at startup
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as e:
            logger.error(f"Failed to import sentence_transformers: {e}")
            raise ImportError(
                "sentence-transformers is not installed. Install it with: pip install sentence-transformers"
            )
        
        try:
            import torch
        except OSError as e:
            if "DLL" in str(e) or "c10.dll" in str(e):
                error_msg = (
                    "PyTorch DLL initialization failed. This is a Windows compatibility issue.\n"
                    "Solutions:\n"
                    "1. Install Visual C++ Redistributables: https://aka.ms/vs/17/release/vc_redist.x64.exe\n"
                    "2. Use Python 3.11 or 3.12 instead of 3.14\n"
                    "3. Restart your computer after installing Visual C++ Redistributables\n"
                    f"Original error: {str(e)}"
                )
                logger.error(error_msg)
                raise OSError(error_msg)
            raise
        
        try:
            logger.info(f"Loading model: {model_name} on device: {self.device}")
            
            # Check device availability
            if self.device == "cuda" and not torch.cuda.is_available():
                logger.warning("CUDA requested but not available, falling back to CPU")
                self.device = "cpu"
            
            # Load model
            model = SentenceTransformer(model_name, device=self.device)
            
            # Cache model
            self.models[model_name] = model
            
            # Store model info
            self.model_info[model_name] = {
                "name": model_name,
                "dimensions": model.get_sentence_embedding_dimension(),
                "max_sequence_length": model.max_seq_length,
                "device": self.device,
            }
            
            logger.info(
                f"Model {model_name} loaded successfully. "
                f"Dimensions: {self.model_info[model_name]['dimensions']}, "
                f"Device: {self.device}"
            )
            
            # Cleanup if cache is full
            if len(self.models) > self.max_cache_size:
                self._cleanup_cache()
            
            return model
            
        except Exception as e:
            logger.error(f"Error loading model {model_name}: {str(e)}")
            raise
    
    def _cleanup_cache(self):
        """Remove oldest model from cache if cache is full"""
        if len(self.models) > 0:
            # Remove first (oldest) model
            oldest_model = list(self.models.keys())[0]
            del self.models[oldest_model]
            if oldest_model in self.model_info:
                del self.model_info[oldest_model]
            logger.info(f"Removed model {oldest_model} from cache")
    
    def get_model_info(self, model_name: Optional[str] = None) -> Optional[dict]:
        """
        Get information about a model
        
        Args:
            model_name: Name of the model. Uses default if None.
            
        Returns:
            Model information dict or None if model not loaded
        """
        model_name = model_name or settings.EMBEDDING_MODEL
        return self.model_info.get(model_name)
    
    def unload_model(self, model_name: str) -> bool:
        """
        Unload a model from memory
        
        Args:
            model_name: Name of the model to unload
            
        Returns:
            True if model was unloaded, False if not found
        """
        if model_name in self.models:
            del self.models[model_name]
            if model_name in self.model_info:
                del self.model_info[model_name]
            logger.info(f"Unloaded model: {model_name}")
            return True
        return False
    
    def list_loaded_models(self) -> list:
        """Get list of currently loaded models"""
        return list(self.models.keys())


# Global model manager instance
model_manager = ModelManager()

