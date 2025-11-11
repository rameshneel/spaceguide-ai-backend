# PowerShell script to setup environment files for development and production

Write-Host "🚀 Setting up environment files..." -ForegroundColor Cyan

# Backend environment files
$backendDevPath = "api-service\.env.dev"
if (-not (Test-Path $backendDevPath)) {
    Write-Host "Creating api-service/.env.dev..." -ForegroundColor Yellow
    @"
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
"@ | Out-File -FilePath $backendDevPath -Encoding utf8
    Write-Host "✅ Created api-service/.env.dev" -ForegroundColor Green
}
else {
    Write-Host "⚠️  api-service/.env.dev already exists" -ForegroundColor Yellow
}

$backendProdPath = "api-service\.env.prod"
if (-not (Test-Path $backendProdPath)) {
    Write-Host "Creating api-service/.env.prod..." -ForegroundColor Yellow
    @"
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
"@ | Out-File -FilePath $backendProdPath -Encoding utf8
    Write-Host "✅ Created api-service/.env.prod" -ForegroundColor Green
}
else {
    Write-Host "⚠️  api-service/.env.prod already exists" -ForegroundColor Yellow
}

# Embedding service environment files
$embeddingDevPath = "ai-embedding-service\.env.dev"
if (-not (Test-Path $embeddingDevPath)) {
    Write-Host "Creating ai-embedding-service/.env.dev..." -ForegroundColor Yellow
    @"
ENVIRONMENT=development
API_HOST=0.0.0.0
API_PORT=8001
EMBEDDING_MODEL=all-MiniLM-L6-v2
DEVICE=cpu
LOG_LEVEL=DEBUG
CORS_ORIGINS=*
"@ | Out-File -FilePath $embeddingDevPath -Encoding utf8
    Write-Host "✅ Created ai-embedding-service/.env.dev" -ForegroundColor Green
}
else {
    Write-Host "⚠️  ai-embedding-service/.env.dev already exists" -ForegroundColor Yellow
}

$embeddingProdPath = "ai-embedding-service\.env.prod"
if (-not (Test-Path $embeddingProdPath)) {
    Write-Host "Creating ai-embedding-service/.env.prod..." -ForegroundColor Yellow
    @"
ENVIRONMENT=production
API_HOST=0.0.0.0
API_PORT=8001
EMBEDDING_MODEL=all-MiniLM-L6-v2
DEVICE=cpu
LOG_LEVEL=INFO
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
"@ | Out-File -FilePath $embeddingProdPath -Encoding utf8
    Write-Host "✅ Created ai-embedding-service/.env.prod" -ForegroundColor Green
}
else {
    Write-Host "⚠️  ai-embedding-service/.env.prod already exists" -ForegroundColor Yellow
}

# Staging environment files
$backendStagingPath = "api-service\.env.staging"
if (-not (Test-Path $backendStagingPath)) {
    Write-Host "Creating api-service/.env.staging..." -ForegroundColor Yellow
    @"
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
"@ | Out-File -FilePath $backendStagingPath -Encoding utf8
    Write-Host "✅ Created api-service/.env.staging" -ForegroundColor Green
}
else {
    Write-Host "⚠️  api-service/.env.staging already exists" -ForegroundColor Yellow
}

$embeddingStagingPath = "ai-embedding-service\.env.staging"
if (-not (Test-Path $embeddingStagingPath)) {
    Write-Host "Creating ai-embedding-service/.env.staging..." -ForegroundColor Yellow
    @"
ENVIRONMENT=staging
API_HOST=0.0.0.0
API_PORT=8001
EMBEDDING_MODEL=all-MiniLM-L6-v2
DEVICE=cpu
LOG_LEVEL=INFO
CORS_ORIGINS=http://staging-frontend.yourdomain.com,http://staging.yourdomain.com
"@ | Out-File -FilePath $embeddingStagingPath -Encoding utf8
    Write-Host "✅ Created ai-embedding-service/.env.staging" -ForegroundColor Green
}
else {
    Write-Host "⚠️  ai-embedding-service/.env.staging already exists" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Environment files setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Update the .env files with your actual values before deploying!" -ForegroundColor Yellow
Write-Host "   - api-service/.env.dev"
Write-Host "   - api-service/.env.staging"
Write-Host "   - api-service/.env.prod"
Write-Host "   - ai-embedding-service/.env.dev"
Write-Host "   - ai-embedding-service/.env.staging"
Write-Host "   - ai-embedding-service/.env.prod"

