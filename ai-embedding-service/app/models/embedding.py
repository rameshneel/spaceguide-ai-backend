"""
Pydantic models for embedding requests and responses
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional


class EmbeddingRequest(BaseModel):
    """Request model for single embedding generation"""
    text: str = Field(..., min_length=1, description="Text to generate embedding for")
    model: Optional[str] = Field(None, description="Model name (optional, uses default if not provided)")
    normalize: bool = Field(False, description="Whether to normalize embeddings")
    
    @field_validator("text")
    @classmethod
    def validate_text_length(cls, v: str) -> str:
        max_length = 5000  # Reasonable limit
        if len(v) > max_length:
            raise ValueError(f"Text length exceeds maximum of {max_length} characters")
        return v


class EmbeddingBatchRequest(BaseModel):
    """Request model for batch embedding generation"""
    texts: List[str] = Field(..., min_items=1, max_items=100, description="List of texts to generate embeddings for")
    model: Optional[str] = Field(None, description="Model name (optional, uses default if not provided)")
    normalize: bool = Field(False, description="Whether to normalize embeddings")
    
    @field_validator("texts")
    @classmethod
    def validate_texts(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("Texts list cannot be empty")
        max_length = 5000
        for text in v:
            if len(text) > max_length:
                raise ValueError(f"Text length exceeds maximum of {max_length} characters")
        return v


class EmbeddingResponse(BaseModel):
    """Response model for embedding generation"""
    embedding: List[float] = Field(..., description="Generated embedding vector")
    model: str = Field(..., description="Model used for generation")
    dimensions: int = Field(..., description="Embedding dimensions")
    text_length: int = Field(..., description="Length of input text")


class EmbeddingBatchResponse(BaseModel):
    """Response model for batch embedding generation"""
    embeddings: List[List[float]] = Field(..., description="List of generated embedding vectors")
    model: str = Field(..., description="Model used for generation")
    dimensions: int = Field(..., description="Embedding dimensions")
    count: int = Field(..., description="Number of embeddings generated")

