"""
Error handling middleware
"""
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.config.logging import logger


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors"""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error",
            "errors": errors
        }
    )


async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    import os
    
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    
    # Only expose error details in development
    is_development = os.getenv("ENVIRONMENT", "development") == "development"
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "message": str(exc) if is_development else "An internal error occurred"
        }
    )


def setup_error_handlers(app: FastAPI):
    """Setup error handlers"""
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)

