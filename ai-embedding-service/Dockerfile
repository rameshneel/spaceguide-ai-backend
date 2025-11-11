# syntax=docker/dockerfile:1.4

############################
# Builder stage
############################
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies once
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc g++ \
    && rm -rf /var/lib/apt/lists/*

# Use BuildKit cache mount for pip (keeps downloaded wheels)
COPY requirements.txt .

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt


############################
# Production stage
############################
FROM python:3.11-slim

WORKDIR /app

# Install runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy installed packages and binaries from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy environment-specific .env files if they exist
# Note: docker-compose override files (dev/staging/prod) load .env.dev/.env.staging/.env.prod via env_file
# This COPY ensures pydantic-settings can also read the file if needed
# Files copied: .env.dev, .env.staging, .env.prod, .env (fallback)
COPY --chown=appuser:appuser .env* ./

# Copy app source code separately (ensures only code changes trigger rebuild)
COPY --chown=appuser:appuser . .

# Make directories
RUN mkdir -p logs .cache && chown -R appuser:appuser logs .cache

USER appuser

EXPOSE 8001

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/api/v1/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
