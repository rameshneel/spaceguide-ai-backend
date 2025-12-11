# AI Business Portal — Unified Deployment Guide

This repo contains the backend stack (`api-service` + optional embedding/LLM services) and the separate frontend app (`spaceguide-ai-frontend`). Both now run with single docker-compose files driven by environment variables.

## Contents
- Overview
- Project structure
- Environment files
- How to run (backend)
- How to run (frontend)
- Common commands
- Notes & security

## Overview
- Backend: Node.js/Express (`api-service`), optional embedding FastAPI service, ChromaDB, Ollama (optional).
- Frontend: Vite/React app served by Nginx.
- Deployment: Single compose per project; pick env by pointing to the right `.env` files and host ports.

## Project structure
```
ai-business-portal/
├── docker-compose.yml           # backend stack (api-service, embedding, chromadb, ollama)
├── api-service/                 # Node.js backend
│   ├── .env.dev.example
│   ├── .env.staging.example
│   └── .env.prod.example
└── ai-embedding-service/        # FastAPI embeddings
    ├── .env.dev.example
    ├── .env.staging.example
    └── .env.prod.example

spaceguide-ai-frontend/
├── docker-compose.yml           # frontend only
├── .env.dev.example
├── .env.staging.example
└── .env.prod.example
```

## Environment files
- Backend: place real values in `api-service/.env.dev|.env.staging|.env.prod` and `ai-embedding-service/.env.*`.
- Frontend: place real values in `.env.dev|.env.staging|.env.prod` at `spaceguide-ai-frontend/`.
- Do **not** commit real secrets.

## How to run (backend stack)
From `ai-business-portal/`:
```bash
# Dev (defaults)
BACKEND_ENV_FILE=./api-service/.env.dev \
EMBEDDING_ENV_FILE=./ai-embedding-service/.env.dev \
docker-compose up -d

# Staging
BACKEND_ENV_FILE=./api-service/.env.staging \
EMBEDDING_ENV_FILE=./ai-embedding-service/.env.staging \
BACKEND_HOST_PORT=5002 EMBEDDING_HOST_PORT=8002 CHROMADB_HOST_PORT=8002 OLLAMA_HOST_PORT=11436 \
docker-compose up -d

# Prod
BACKEND_ENV_FILE=./api-service/.env.prod \
EMBEDDING_ENV_FILE=./ai-embedding-service/.env.prod \
BACKEND_HOST_PORT=5001 EMBEDDING_HOST_PORT=9001 CHROMADB_HOST_PORT=9000 OLLAMA_HOST_PORT=11435 \
docker-compose up -d
```

## How to run (frontend)
From `spaceguide-ai-frontend/`:
```bash
# Dev (defaults)
docker-compose up -d

# Staging
ENV_FILE=./.env.staging FRONTEND_HOST_PORT=3002 VITE_API_URL=https://staging-api.example.com/api \
docker-compose up -d

# Prod
ENV_FILE=./.env.prod FRONTEND_HOST_PORT=3001 VITE_API_URL=https://api.example.com/api \
docker-compose up -d
```

## Common commands
```bash
# Status
docker-compose ps

# Logs
docker-compose logs -f

# Restart
docker-compose restart

# Rebuild images
docker-compose build --no-cache

# Stop / clean
docker-compose down
docker-compose down -v   # also remove volumes (data loss)
```

## Notes & security
- Keep `.env` files out of images and version control; supply them via `env_file`/environment variables.
- Pin base images (node/nginx) to specific tags in Dockerfiles for reproducibility.
- Stripe/PayPal keys and other secrets should be provided at runtime, not baked into build layers.
- Health checks are enabled in compose/Dockerfiles; ensure the endpoints respond quickly.

