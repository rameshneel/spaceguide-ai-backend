#!/bin/bash
# Setup environment files for development and production

echo "🚀 Setting up environment files..."

# Backend environment files
if [ ! -f "api-service/.env.dev" ]; then
    echo "Creating api-service/.env.dev..."
    cat > api-service/.env.dev << 'EOF'
# Development Environment Variables
NODE_ENV=development
PORT=5000
HOST=localhost
BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb://host.docker.internal:27017/spaceguide-ai-backend-dev
ACCESS_TOKEN_SECRET=dev-access-token-secret-change-this
REFRESH_TOKEN_SECRET=dev-refresh-token-secret-change-this
CORS_ORIGINS=http://localhost:3000,http://localhost:5000
EMBEDDING_PROVIDER=fastapi
CHAT_PROVIDER=ollama
TEXT_WRITER_PROVIDER=ollama
IMAGE_PROVIDER=pollinations
USE_POLLINATIONS=true
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_TEXT_WRITER_MODEL=tinyllama
EMBEDDING_API_URL=http://embedding-service:8001
CHROMADB_URL=http://chromadb:8000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    echo "✅ Created api-service/.env.dev"
else
    echo "⚠️  api-service/.env.dev already exists"
fi

if [ ! -f "api-service/.env.prod" ]; then
    echo "Creating api-service/.env.prod..."
    cat > api-service/.env.prod << 'EOF'
# Production Environment Variables
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
BASE_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
MONGODB_URI=mongodb://host.docker.internal:27017/spaceguide-ai-backend-prod
ACCESS_TOKEN_SECRET=your-super-secret-access-token-key-change-this-in-production
REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-key-change-this-in-production
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
EMBEDDING_PROVIDER=fastapi
CHAT_PROVIDER=ollama
TEXT_WRITER_PROVIDER=ollama
IMAGE_PROVIDER=openai
USE_POLLINATIONS=false
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_TEXT_WRITER_MODEL=tinyllama
EMBEDDING_API_URL=http://embedding-service:8001
CHROMADB_URL=http://chromadb:8000
OPENAI_API_KEY=sk-your-openai-api-key
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    echo "✅ Created api-service/.env.prod"
else
    echo "⚠️  api-service/.env.prod already exists"
fi

# Embedding service environment files
if [ ! -f "ai-embedding-service/.env.dev" ]; then
    echo "Creating ai-embedding-service/.env.dev..."
    cat > ai-embedding-service/.env.dev << 'EOF'
ENVIRONMENT=development
API_HOST=0.0.0.0
API_PORT=8001
EMBEDDING_MODEL=all-MiniLM-L6-v2
DEVICE=cpu
LOG_LEVEL=DEBUG
CORS_ORIGINS=*
EOF
    echo "✅ Created ai-embedding-service/.env.dev"
else
    echo "⚠️  ai-embedding-service/.env.dev already exists"
fi

if [ ! -f "ai-embedding-service/.env.prod" ]; then
    echo "Creating ai-embedding-service/.env.prod..."
    cat > ai-embedding-service/.env.prod << 'EOF'
ENVIRONMENT=production
API_HOST=0.0.0.0
API_PORT=8001
EMBEDDING_MODEL=all-MiniLM-L6-v2
DEVICE=cpu
LOG_LEVEL=INFO
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
EOF
    echo "✅ Created ai-embedding-service/.env.prod"
else
    echo "⚠️  ai-embedding-service/.env.prod already exists"
fi

# Staging environment files
if [ ! -f "api-service/.env.staging" ]; then
    echo "Creating api-service/.env.staging..."
    cat > api-service/.env.staging << 'EOF'
# Staging Environment Variables (Customer/Client Testing)
NODE_ENV=staging
PORT=5000
HOST=0.0.0.0
BASE_URL=http://staging.yourdomain.com
FRONTEND_URL=http://staging-frontend.yourdomain.com
MONGODB_URI=mongodb://host.docker.internal:27017/spaceguide-ai-backend-staging
ACCESS_TOKEN_SECRET=staging-access-token-secret-change-this
REFRESH_TOKEN_SECRET=staging-refresh-token-secret-change-this
CORS_ORIGINS=http://staging-frontend.yourdomain.com,http://staging.yourdomain.com
EMBEDDING_PROVIDER=fastapi
CHAT_PROVIDER=ollama
TEXT_WRITER_PROVIDER=ollama
IMAGE_PROVIDER=pollinations
USE_POLLINATIONS=true
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_TEXT_WRITER_MODEL=tinyllama
EMBEDDING_API_URL=http://embedding-service:8001
CHROMADB_URL=http://chromadb:8000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    echo "✅ Created api-service/.env.staging"
else
    echo "⚠️  api-service/.env.staging already exists"
fi

if [ ! -f "ai-embedding-service/.env.staging" ]; then
    echo "Creating ai-embedding-service/.env.staging..."
    cat > ai-embedding-service/.env.staging << 'EOF'
ENVIRONMENT=staging
API_HOST=0.0.0.0
API_PORT=8001
EMBEDDING_MODEL=all-MiniLM-L6-v2
DEVICE=cpu
LOG_LEVEL=INFO
CORS_ORIGINS=http://staging-frontend.yourdomain.com,http://staging.yourdomain.com
EOF
    echo "✅ Created ai-embedding-service/.env.staging"
else
    echo "⚠️  ai-embedding-service/.env.staging already exists"
fi

echo ""
echo "✅ Environment files setup complete!"
echo ""
echo "⚠️  IMPORTANT: Update the .env files with your actual values before deploying!"
echo "   - api-service/.env.dev"
echo "   - api-service/.env.staging"
echo "   - api-service/.env.prod"
echo "   - ai-embedding-service/.env.dev"
echo "   - ai-embedding-service/.env.staging"
echo "   - ai-embedding-service/.env.prod"

