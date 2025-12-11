"""
Embedding generation endpoints
"""
from fastapi import APIRouter, HTTPException, status
from typing import List
from app.models.embedding import (
    EmbeddingRequest,
    EmbeddingResponse,
    EmbeddingBatchRequest,
    EmbeddingBatchResponse
)
from app.services.embedding_service import embedding_service
from app.config.logging import logger

router = APIRouter(prefix="/embeddings", tags=["embeddings"])


@router.post("/generate", response_model=EmbeddingResponse)
async def generate_embedding(request: EmbeddingRequest):
    """
    Generate embedding for a single text
    
    Args:
        request: EmbeddingRequest with text and optional parameters
        
    Returns:
        EmbeddingResponse with embedding vector and metadata
    """
    try:
        embedding, model_name, dimensions = embedding_service.generate_embedding(
            text=request.text,
            model_name=request.model,
            normalize=request.normalize
        )
        
        return EmbeddingResponse(
            embedding=embedding,
            model=model_name,
            dimensions=dimensions,
            text_length=len(request.text)
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except OSError as e:
        if "DLL" in str(e) or "c10.dll" in str(e):
            logger.error(f"PyTorch DLL error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Embedding service unavailable due to PyTorch DLL error. "
                    "Please install Visual C++ Redistributables: "
                    "https://aka.ms/vs/17/release/vc_redist.x64.exe"
                )
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate embedding: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate embedding: {str(e)}"
        )


@router.post("/batch", response_model=EmbeddingBatchResponse)
async def generate_embeddings_batch(request: EmbeddingBatchRequest):
    """
    Generate embeddings for a batch of texts
    
    Args:
        request: EmbeddingBatchRequest with list of texts
        
    Returns:
        EmbeddingBatchResponse with list of embeddings and metadata
    """
    try:
        embeddings, model_name, dimensions = embedding_service.generate_embeddings_batch(
            texts=request.texts,
            model_name=request.model,
            normalize=request.normalize
        )
        
        return EmbeddingBatchResponse(
            embeddings=embeddings,
            model=model_name,
            dimensions=dimensions,
            count=len(embeddings)
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except OSError as e:
        if "DLL" in str(e) or "c10.dll" in str(e):
            logger.error(f"PyTorch DLL error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Embedding service unavailable due to PyTorch DLL error. "
                    "Please install Visual C++ Redistributables: "
                    "https://aka.ms/vs/17/release/vc_redist.x64.exe"
                )
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate embeddings: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error generating batch embeddings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate embeddings: {str(e)}"
        )


@router.get("/models")
async def list_models():
    """
    List available and loaded models
    
    Returns:
        Dictionary with available and loaded models
    """
    try:
        from app.config.settings import settings
        
        loaded_models = model_manager.list_loaded_models()
        model_info_list = []
        
        for model_name in loaded_models:
            info = model_manager.get_model_info(model_name)
            if info:
                model_info_list.append(info)
        
        return {
            "default_model": settings.EMBEDDING_MODEL,
            "supported_models": settings.supported_models_list,
            "loaded_models": loaded_models,
            "model_info": model_info_list,
            "device": settings.DEVICE
        }
        
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list models: {str(e)}"
        )

