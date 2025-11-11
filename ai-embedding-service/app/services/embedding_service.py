"""
Embedding Service for generating embeddings using sentence-transformers
"""
from typing import List, Optional
import numpy as np
# Lazy import to avoid DLL issues at startup
from app.config.settings import settings
from app.config.logging import logger
from app.services.model_manager import model_manager


class EmbeddingService:
    """Service for generating text embeddings"""
    
    def __init__(self):
        self.default_model_name = settings.EMBEDDING_MODEL
        self.batch_size = settings.BATCH_SIZE
        self.max_text_length = settings.MAX_TEXT_LENGTH
        
        # Map OpenAI model names to sentence-transformers model names
        # Note: Dimension mapping:
        # - text-embedding-3-small: 1536 dims (OpenAI) -> all-MiniLM-L6-v2: 384 dims (sentence-transformers)
        # - text-embedding-3-large: 3072 dims (OpenAI) -> all-mpnet-base-v2: 768 dims (sentence-transformers)
        # - text-embedding-ada-002: 1536 dims (OpenAI) -> all-MiniLM-L6-v2: 384 dims (sentence-transformers)
        # For collections expecting 768 dims, use text-embedding-3-large -> all-mpnet-base-v2
        self.model_name_map = {
            "text-embedding-3-small": "all-MiniLM-L6-v2",  # 384 dims
            "text-embedding-3-large": "all-mpnet-base-v2",  # 768 dims
            "text-embedding-ada-002": "all-MiniLM-L6-v2",  # 384 dims
            "text-embedding": "all-MiniLM-L6-v2",  # 384 dims - Fallback for generic "text-embedding"
        }
        
        # Dimension mapping for reference
        self.model_dimensions = {
            "all-MiniLM-L6-v2": 384,
            "all-mpnet-base-v2": 768,
            "all-MiniLM-L12-v2": 384,
            "paraphrase-multilingual-MiniLM-L12-v2": 384,
        }
    
    def _map_model_name(self, model_name: Optional[str]) -> str:
        """
        Map OpenAI/other model names to sentence-transformers model names
        
        Args:
            model_name: Input model name (can be OpenAI or sentence-transformers)
            
        Returns:
            Mapped sentence-transformers model name
        """
        if not model_name:
            return self.default_model_name
        
        # Check if it's already a sentence-transformers model name
        # (contains common sentence-transformers patterns)
        if any(pattern in model_name.lower() for pattern in [
            "all-minilm", "all-mpnet", "paraphrase", "sentence-transformers"
        ]):
            return model_name
        
        # Map OpenAI model names to sentence-transformers
        mapped = self.model_name_map.get(model_name.lower())
        if mapped:
            logger.debug(f"Mapped model name: {model_name} -> {mapped}")
            return mapped
        
        # If not in map, try using as-is (might be a valid sentence-transformers model)
        # If it fails, will fall back to default
        logger.warning(
            f"Unknown model name '{model_name}', using as-is. "
            f"If it fails, will fall back to default: {self.default_model_name}"
        )
        return model_name
    
    def generate_embedding(
        self,
        text: str,
        model_name: Optional[str] = None,
        normalize: bool = False
    ) -> tuple[List[float], str, int]:
        """
        Generate embedding for a single text
        
        Args:
            text: Input text
            model_name: Model to use (optional)
            normalize: Whether to normalize the embedding
            
        Returns:
            Tuple of (embedding, model_name, dimensions)
        """
        # Map model name if needed
        mapped_model_name = self._map_model_name(model_name)
        
        try:
            model = model_manager.get_model(mapped_model_name)
        except Exception as e:
            # If mapped model fails, try default model
            if mapped_model_name != self.default_model_name:
                logger.warning(
                    f"Failed to load model '{mapped_model_name}': {str(e)}. "
                    f"Falling back to default model: {self.default_model_name}"
                )
                mapped_model_name = self.default_model_name
                model = model_manager.get_model(mapped_model_name)
            else:
                raise
        
        model_name = mapped_model_name  # Use mapped name for return value
        
        # Truncate text if too long
        if len(text) > self.max_text_length:
            logger.warning(f"Text truncated from {len(text)} to {self.max_text_length} characters")
            text = text[:self.max_text_length]
        
        try:
            # Generate embedding
            embedding = model.encode(text, normalize_embeddings=normalize, convert_to_numpy=True)
            
            # Convert to list
            embedding_list = embedding.tolist()
            
            # Get dimensions
            dimensions = len(embedding_list)
            
            logger.debug(f"Generated embedding for text of length {len(text)}, dimensions: {dimensions}")
            
            return embedding_list, model_name, dimensions
            
        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
            raise
    
    def generate_embeddings_batch(
        self,
        texts: List[str],
        model_name: Optional[str] = None,
        normalize: bool = False
    ) -> tuple[List[List[float]], str, int]:
        """
        Generate embeddings for a batch of texts
        
        Args:
            texts: List of input texts
            model_name: Model to use (optional)
            normalize: Whether to normalize embeddings
            
        Returns:
            Tuple of (embeddings_list, model_name, dimensions)
        """
        if not texts:
            raise ValueError("Texts list cannot be empty")
        
        # Map model name if needed
        mapped_model_name = self._map_model_name(model_name)
        
        try:
            model = model_manager.get_model(mapped_model_name)
        except Exception as e:
            # If mapped model fails, try default model
            if mapped_model_name != self.default_model_name:
                logger.warning(
                    f"Failed to load model '{mapped_model_name}': {str(e)}. "
                    f"Falling back to default model: {self.default_model_name}"
                )
                mapped_model_name = self.default_model_name
                model = model_manager.get_model(mapped_model_name)
            else:
                raise
        
        model_name = mapped_model_name  # Use mapped name for return value
        
        # Truncate texts if too long
        processed_texts = []
        for text in texts:
            if len(text) > self.max_text_length:
                logger.warning(f"Text truncated from {len(text)} to {self.max_text_length} characters")
                processed_texts.append(text[:self.max_text_length])
            else:
                processed_texts.append(text)
        
        try:
            # Generate embeddings in batches
            all_embeddings = []
            
            for i in range(0, len(processed_texts), self.batch_size):
                batch = processed_texts[i:i + self.batch_size]
                logger.debug(f"Processing batch {i//self.batch_size + 1} with {len(batch)} texts")
                
                batch_embeddings = model.encode(
                    batch,
                    normalize_embeddings=normalize,
                    convert_to_numpy=True,
                    batch_size=self.batch_size,
                    show_progress_bar=False
                )
                
                # Convert to list
                all_embeddings.extend(batch_embeddings.tolist())
            
            # Get dimensions from first embedding
            dimensions = len(all_embeddings[0]) if all_embeddings else 0
            
            logger.info(f"Generated {len(all_embeddings)} embeddings, dimensions: {dimensions}")
            
            return all_embeddings, model_name, dimensions
            
        except Exception as e:
            logger.error(f"Error generating batch embeddings: {str(e)}")
            raise
    
    def get_model_info(self, model_name: Optional[str] = None) -> Optional[dict]:
        """Get information about a model"""
        model_name = model_name or self.default_model_name
        return model_manager.get_model_info(model_name)


# Global embedding service instance
embedding_service = EmbeddingService()

