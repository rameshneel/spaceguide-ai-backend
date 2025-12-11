# 🚀 FastAPI Embedding Service

<div align="center">

![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green.svg)
![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![sentence-transformers](https://img.shields.io/badge/sentence--transformers-5.1+-orange.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

**High-performance text embedding service using sentence-transformers**

[Features](#-features) • [Quick Start](#-quick-start) • [API Documentation](#-api-documentation) • [Configuration](#-configuration) • [Deployment](#-deployment)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Configuration](#-configuration)
- [Models](#-models)
- [Performance](#-performance)
- [Docker Deployment](#-docker-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## 🎯 Overview

The FastAPI Embedding Service is a production-ready microservice for generating high-quality text embeddings using state-of-the-art sentence-transformers models. It provides a RESTful API for single and batch embedding generation, making it easy to integrate into AI applications, RAG systems, and semantic search solutions.

### Key Capabilities

- **Fast Embedding Generation** - Optimized for speed and efficiency
- **Batch Processing** - Process multiple texts in parallel
- **Model Management** - Automatic model loading and caching
- **GPU Support** - CUDA acceleration for faster inference
- **RESTful API** - Easy integration with any application
- **Health Monitoring** - Built-in health and readiness checks
- **Production Ready** - Error handling, logging, and CORS support

---

## ✨ Features

### Core Features

- ✅ **Single & Batch Embedding Generation**
- ✅ **Multiple Model Support** - Easy model switching
- ✅ **Automatic Model Caching** - Efficient memory usage
- ✅ **GPU Acceleration** - CUDA support for faster processing
- ✅ **Normalization** - Optional L2 normalization
- ✅ **Batch Processing** - Process up to 100 texts at once
- ✅ **RESTful API** - OpenAPI/Swagger documentation
- ✅ **Health Checks** - Liveness and readiness probes
- ✅ **Error Handling** - Comprehensive error responses
- ✅ **CORS Support** - Cross-origin resource sharing
- ✅ **Logging** - Structured logging with configurable levels
- ✅ **Environment Configuration** - Easy configuration via .env.dev, .env.staging, .env.prod

### Supported Models

- `all-MiniLM-L6-v2` (default) - 384 dimensions, fast and efficient
- `all-mpnet-base-v2` - 768 dimensions, higher quality
- `all-MiniLM-L12-v2` - 384 dimensions, better quality
- `paraphrase-multilingual-MiniLM-L12-v2` - 384 dimensions, multilingual

### Model Mapping

The service automatically maps OpenAI model names to sentence-transformers models:

- `text-embedding-3-small` → `all-MiniLM-L6-v2` (384 dims)
- `text-embedding-3-large` → `all-mpnet-base-v2` (768 dims)
- `text-embedding-ada-002` → `all-MiniLM-L6-v2` (384 dims)

---

## 🛠 Tech Stack

### Core

- **Framework**: FastAPI 0.115+
- **Python**: 3.10+
- **ASGI Server**: Uvicorn
- **ML Library**: sentence-transformers 5.1+
- **Deep Learning**: PyTorch 2.0+

### Dependencies

- **FastAPI** - Modern, fast web framework
- **Uvicorn** - ASGI server
- **sentence-transformers** - State-of-the-art embeddings
- **PyTorch** - Deep learning framework
- **Pydantic** - Data validation
- **NumPy** - Numerical computing
- **python-dotenv** - Environment configuration

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10 or higher
- pip package manager
- (Optional) CUDA-capable GPU for faster inference

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd spaceguide-ai-backend/ai-embedding-service
```

2. **Create virtual environment**

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

3. **Install dependencies**

```bash
pip install -r requirements.txt
```

4. **Configure environment variables**

For local development, create environment-specific files:

```bash
# Option 1: Use setup script (recommended)
# From project root:
./setup-env.ps1  # Windows
# or
./setup-env.sh   # Linux/Mac

# Option 2: Create manually
# For local development, create .env.dev file:
```

**Environment Files Structure:**

- `.env.dev` - Development environment (local development)
- `.env.staging` - Staging environment (customer/client testing)
- `.env.prod` - Production environment (live)

**For Local Development** - Edit `.env.dev`:

```env
# Server Configuration
ENVIRONMENT=development
API_HOST=0.0.0.0
API_PORT=8001
LOG_LEVEL=DEBUG

# Model Configuration
EMBEDDING_MODEL=all-MiniLM-L6-v2
DEVICE=cpu  # or 'cuda' for GPU

# Performance Settings
BATCH_SIZE=32
MAX_TEXT_LENGTH=512
MAX_BATCH_SIZE=100
NORMALIZE_EMBEDDINGS=false

# CORS Configuration
CORS_ORIGINS=*
```

**Note:** The application automatically loads the correct `.env` file based on `ENVIRONMENT`:

- `ENVIRONMENT=development` → loads `.env.dev`
- `ENVIRONMENT=staging` → loads `.env.staging`
- `ENVIRONMENT=production` → loads `.env.prod`

5. **Start the server**

```bash
# Development (with auto-reload)
python main.py

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

The service will start on `http://localhost:8001`

### Verify Installation

```bash
# Health check
curl http://localhost:8001/api/v1/health

# Interactive API docs
open http://localhost:8001/docs
```

---

## 📁 Project Structure

```
ai-embedding-service/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app initialization
│   │
│   ├── config/                 # Configuration
│   │   ├── __init__.py
│   │   ├── settings.py         # Application settings
│   │   └── logging.py          # Logging configuration
│   │
│   ├── models/                 # Pydantic models
│   │   ├── __init__.py
│   │   ├── embedding.py        # Request/Response models
│   │   └── health.py           # Health check models
│   │
│   ├── routes/                 # API routes
│   │   ├── __init__.py
│   │   ├── embeddings.py       # Embedding endpoints
│   │   └── health.py           # Health check endpoints
│   │
│   ├── services/               # Business logic
│   │   ├── __init__.py
│   │   ├── embedding_service.py    # Embedding generation
│   │   └── model_manager.py        # Model loading/caching
│   │
│   └── middleware/             # Middleware
│       ├── __init__.py
│       ├── cors.py             # CORS configuration
│       └── error_handler.py    # Error handling
│
├── main.py                     # Entry point
├── requirements.txt            # Python dependencies
├── .env.dev                    # Development environment (local)
├── .env.staging                # Staging environment (customer testing)
├── .env.prod                   # Production environment (live)
├── Dockerfile                  # Docker configuration
├── .dockerignore               # Docker ignore file
└── README.md                   # This file
```

---

## 📚 API Documentation

### Base URL

```
Development: http://localhost:8001
Production: https://embedding.yourdomain.com
```

### Interactive Documentation

FastAPI provides automatic interactive API documentation:

- **Swagger UI**: `http://localhost:8001/docs`
- **ReDoc**: `http://localhost:8001/redoc`

### Endpoints

#### 🏥 Health Checks

##### Basic Health Check

```http
GET /api/v1/health
```

**Response:**

```json
{
  "status": "healthy",
  "service": "embedding-service",
  "version": "1.0.0",
  "model": {
    "name": "all-MiniLM-L6-v2",
    "dimensions": 384,
    "loaded": true
  },
  "device": "cpu",
  "message": "Service is running"
}
```

##### Readiness Check

```http
GET /api/v1/health/ready
```

Verifies that the model is loaded and ready to process requests.

#### 🔢 Embedding Generation

##### Single Embedding

```http
POST /api/v1/embeddings/generate
Content-Type: application/json

{
  "text": "Hello, world!",
  "model": "all-MiniLM-L6-v2",
  "normalize": false
}
```

**Response:**

```json
{
  "embedding": [0.123, -0.456, 0.789, ...],
  "model": "all-MiniLM-L6-v2",
  "dimensions": 384,
  "text_length": 13
}
```

**Parameters:**

- `text` (required): Text to embed
- `model` (optional): Model name (default: configured model)
- `normalize` (optional): L2 normalize embeddings (default: false)

##### Batch Embeddings

```http
POST /api/v1/embeddings/batch
Content-Type: application/json

{
  "texts": [
    "First text to embed",
    "Second text to embed",
    "Third text to embed"
  ],
  "model": "all-MiniLM-L6-v2",
  "normalize": false
}
```

**Response:**

```json
{
  "embeddings": [
    [0.123, -0.456, ...],
    [0.789, -0.012, ...],
    [0.345, -0.678, ...]
  ],
  "model": "all-MiniLM-L6-v2",
  "dimensions": 384,
  "count": 3
}
```

**Parameters:**

- `texts` (required): Array of texts to embed (max 100)
- `model` (optional): Model name (default: configured model)
- `normalize` (optional): L2 normalize embeddings (default: false)

##### List Available Models

```http
GET /api/v1/embeddings/models
```

**Response:**

```json
{
  "available_models": [
    "all-MiniLM-L6-v2",
    "all-mpnet-base-v2",
    "all-MiniLM-L12-v2"
  ],
  "default_model": "all-MiniLM-L6-v2",
  "loaded_models": ["all-MiniLM-L6-v2"]
}
```

---

## ⚙️ Configuration

### Environment Variables

See `.env.dev`, `.env.staging`, or `.env.prod` files (created by setup scripts) for all available variables.

#### Server Configuration

- `ENVIRONMENT` - Environment (development/production)
- `API_HOST` - Host to bind to (default: `0.0.0.0`)
- `API_PORT` - Port to listen on (default: `8001`)
- `LOG_LEVEL` - Logging level (DEBUG, INFO, WARNING, ERROR)

#### Model Configuration

- `EMBEDDING_MODEL` - Default model name (default: `all-MiniLM-L6-v2`)
- `DEVICE` - Device to use (`cpu` or `cuda`) (default: `cpu`)
- `MODEL_CACHE_SIZE` - Number of models to cache (default: `1`)

#### Performance Settings

- `BATCH_SIZE` - Batch size for processing (default: `32`)
- `MAX_TEXT_LENGTH` - Maximum text length (default: `512`)
- `MAX_BATCH_SIZE` - Maximum batch size (default: `100`)
- `NORMALIZE_EMBEDDINGS` - Normalize embeddings by default (default: `false`)

#### CORS Configuration

- `CORS_ORIGINS` - Comma-separated allowed origins (default: `*`)

#### Production Settings

- `UVICORN_WORKERS` - Number of worker processes (default: `1`)

---

## 🤖 Models

### Default Model: all-MiniLM-L6-v2

- **Dimensions**: 384
- **Speed**: Very fast
- **Quality**: Good for most use cases
- **Size**: ~80 MB
- **Best for**: General-purpose embeddings, semantic search

### Alternative Models

#### all-mpnet-base-v2

- **Dimensions**: 768
- **Speed**: Fast
- **Quality**: Higher quality than MiniLM
- **Size**: ~420 MB
- **Best for**: When quality is more important than speed

#### all-MiniLM-L12-v2

- **Dimensions**: 384
- **Speed**: Fast
- **Quality**: Better than L6, slower than L6
- **Size**: ~120 MB
- **Best for**: Balance between speed and quality

#### paraphrase-multilingual-MiniLM-L12-v2

- **Dimensions**: 384
- **Speed**: Fast
- **Quality**: Good for multilingual
- **Size**: ~420 MB
- **Best for**: Multilingual applications

### Model Selection Guide

| Use Case        | Recommended Model                       | Dimensions |
| --------------- | --------------------------------------- | ---------- |
| General purpose | `all-MiniLM-L6-v2`                      | 384        |
| Higher quality  | `all-mpnet-base-v2`                     | 768        |
| Multilingual    | `paraphrase-multilingual-MiniLM-L12-v2` | 384        |
| Balanced        | `all-MiniLM-L12-v2`                     | 384        |

---

## ⚡ Performance

### Optimization Tips

1. **Use GPU** - Set `DEVICE=cuda` for 5-10x speedup
2. **Batch Processing** - Use batch endpoint for multiple texts
3. **Model Caching** - Models are cached after first load
4. **Text Length** - Keep texts under `MAX_TEXT_LENGTH` (512 tokens)

### Performance Benchmarks

**CPU (Intel i7-9700K):**

- Single embedding: ~10-20ms
- Batch of 32: ~200-300ms

**GPU (NVIDIA RTX 3080):**

- Single embedding: ~2-5ms
- Batch of 32: ~50-100ms

### Memory Usage

- **all-MiniLM-L6-v2**: ~200-300 MB RAM
- **all-mpnet-base-v2**: ~600-800 MB RAM
- **GPU Memory**: +500 MB - 1 GB VRAM

---

## 🐳 Docker Deployment

### Build Image

```bash
docker build -t embedding-service .
```

### Run Container

```bash
docker run -p 8001:8001 \
  -e EMBEDDING_MODEL=all-MiniLM-L6-v2 \
  -e DEVICE=cpu \
  embedding-service
```

### Docker Compose

See root `docker-compose.yml` for full stack deployment.

### Production Dockerfile

The included Dockerfile uses:

- Multi-stage build for smaller image size
- Non-root user for security
- Health checks
- Optimized layer caching

---

## 🧪 Testing

### Manual Testing

```bash
# Health check
curl http://localhost:8001/api/v1/health

# Single embedding
curl -X POST http://localhost:8001/api/v1/embeddings/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!"}'

# Batch embeddings
curl -X POST http://localhost:8001/api/v1/embeddings/batch \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Text 1", "Text 2", "Text 3"]}'
```

### Python Client Example

```python
import requests

# Single embedding
response = requests.post(
    "http://localhost:8001/api/v1/embeddings/generate",
    json={"text": "Hello, world!"}
)
embedding = response.json()["embedding"]

# Batch embeddings
response = requests.post(
    "http://localhost:8001/api/v1/embeddings/batch",
    json={"texts": ["Text 1", "Text 2"]}
)
embeddings = response.json()["embeddings"]
```

---

## 🐛 Troubleshooting

### Common Issues

**Model Loading Error**

- Check internet connection (first download)
- Verify model name is correct
- Check available disk space
- Review logs for detailed error

**CUDA/GPU Error**

- Verify CUDA is installed: `nvidia-smi`
- Check PyTorch CUDA support: `python -c "import torch; print(torch.cuda.is_available())"`
- Set `DEVICE=cpu` if GPU unavailable

**Memory Error**

- Reduce `BATCH_SIZE`
- Use smaller model (e.g., `all-MiniLM-L6-v2`)
- Increase system RAM
- Use GPU if available

**Slow Performance**

- Enable GPU: `DEVICE=cuda`
- Use batch processing
- Reduce `MAX_TEXT_LENGTH`
- Use faster model (e.g., `all-MiniLM-L6-v2`)

**CORS Error**

- Configure `CORS_ORIGINS` in `.env`
- Add your frontend URL to allowed origins
- Use `*` for development only

---

## 📊 Monitoring

### Health Checks

Use health endpoints for monitoring:

```bash
# Basic health
curl http://localhost:8001/api/v1/health

# Readiness (model loaded)
curl http://localhost:8001/api/v1/health/ready
```

### Logging

Logs are structured and include:

- Request/response information
- Model loading events
- Error details
- Performance metrics

Configure log level via `LOG_LEVEL` environment variable.

---

## 🔒 Security

### Best Practices

- Use HTTPS in production
- Configure CORS origins properly
- Keep dependencies updated
- Use non-root user in Docker
- Monitor and log access
- Rate limit if needed (add middleware)

---

## 📝 License

MIT License - see LICENSE file for details

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

## 📞 Support

For issues and questions:

- Open an issue on GitHub
- Check the documentation
- Review the troubleshooting section

---

## 🔗 Related Services

- **Backend API**: Node.js backend service
- **Ollama**: Local LLM service
- **ChromaDB**: Vector database

---

<div align="center">

**Built with ❤️ for AI-powered applications**

[Back to Top](#-fastapi-embedding-service)

</div>
