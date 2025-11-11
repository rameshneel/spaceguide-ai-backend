# 🚀 Deployment Guide

## 📋 Prerequisites

- Docker & Docker Compose installed
- Git installed
- MongoDB installed (system-wide, not in Docker)
- SSH access to deployment server (for CI/CD)

## 🏗️ Project Structure

```
spaceguide-ai-backend/
├── .github/workflows/     # CI/CD pipelines
├── docker-compose.yml     # Base configuration
├── docker-compose.dev.yml # Development overrides
├── docker-compose.prod.yml # Production overrides
├── api-service/
│   ├── .env.dev.example
│   └── .env.prod.example
└── ai-embedding-service/
    ├── .env.dev.example
    └── .env.prod.example
```

## 🔧 Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/spaceguide-ai-backend.git
cd spaceguide-ai-backend
```

### 2. Setup Environment Files

#### Backend (api-service):

```bash
cd api-service
cp .env.dev.example .env.dev
# Edit .env.dev with your values
```

#### Embedding Service:

```bash
cd ai-embedding-service
cp .env.dev.example .env.dev
# Edit .env.dev with your values
```

### 3. Start Development Environment

```bash
# From root directory
docker-compose -p ai-portal-dev -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### 4. Check Status

```bash
docker-compose -p ai-portal-dev ps
```

### 5. View Logs

```bash
docker-compose -p ai-portal-dev logs -f
```

## 🏭 Production Setup

### 1. Setup Environment Files

#### Backend:

```bash
cd api-service
cp .env.prod.example .env.prod
# Edit .env.prod with production values
```

#### Embedding Service:

```bash
cd ai-embedding-service
cp .env.prod.example .env.prod
# Edit .env.prod with production values
```

### 2. Start Staging Environment

```bash
docker-compose -p ai-portal-staging -f docker-compose.yml -f docker-compose.staging.yml up -d
```

### 3. Check Staging Status

```bash
docker-compose -p ai-portal-staging ps
```

## 🎭 Staging Setup (Customer/Client Testing)

### 1. Setup Environment Files

#### Backend:

```bash
cd api-service
cp .env.staging.example .env.staging
# Edit .env.staging with staging values
```

#### Embedding Service:

```bash
cd ai-embedding-service
cp .env.staging.example .env.staging
# Edit .env.staging with staging values
```

### 2. Start Staging Environment

```bash
docker-compose -p ai-portal-staging -f docker-compose.yml -f docker-compose.staging.yml up -d
```

### 3. Check Status

```bash
docker-compose -p ai-portal-staging ps
```

## 🏭 Production Setup (Future)

### 1. Setup Environment Files

#### Backend:

```bash
cd api-service
cp .env.prod.example .env.prod
# Edit .env.prod with production values
```

#### Embedding Service:

```bash
cd ai-embedding-service
cp .env.prod.example .env.prod
# Edit .env.prod with production values
```

### 2. Start Production Environment

```bash
docker-compose -p ai-portal-prod -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 3. Check Status

```bash
docker-compose -p ai-portal-prod ps
```

## 🔄 Port Mapping

| Service   | Dev Port | Staging Port | Prod Port |
| --------- | -------- | ------------ | --------- |
| Backend   | 5000     | 5002         | 5001      |
| Embedding | 8001     | 8002         | 9001      |
| ChromaDB  | 8000     | 8002         | 9000      |
| Ollama    | 11434    | 11436        | 11435     |

## 🤖 GitHub Actions CI/CD

### Setup Secrets

Go to GitHub Repository → Settings → Secrets and variables → Actions

Add these secrets:

#### Development:

- `DEV_HOST` - Development server IP/hostname
- `DEV_USER` - SSH username
- `DEV_SSH_KEY` - SSH private key
- `DEV_SSH_PORT` - SSH port (optional, default: 22)
- `DEV_DEPLOY_PATH` - Deployment path (optional, default: /opt/spaceguide-ai-backend)

#### Staging:

- `STAGING_HOST` - Staging server IP/hostname (can be same as DEV_HOST)
- `STAGING_USER` - SSH username
- `STAGING_SSH_KEY` - SSH private key
- `STAGING_SSH_PORT` - SSH port (optional, default: 22)
- `STAGING_DEPLOY_PATH` - Deployment path (optional, default: /opt/spaceguide-ai-backend)

#### Production:

- `PROD_HOST` - Production server IP/hostname
- `PROD_USER` - SSH username
- `PROD_SSH_KEY` - SSH private key
- `PROD_SSH_PORT` - SSH port (optional, default: 22)
- `PROD_DEPLOY_PATH` - Deployment path (optional, default: /opt/spaceguide-ai-backend)

### Workflows

#### 1. CI (Continuous Integration)

- **Trigger**: Pull requests to `main` or `develop`
- **Actions**: Run tests, build Docker images

#### 2. Deploy to Development

- **Trigger**: Push to `develop` branch
- **Actions**: Auto-deploy to dev server (internal team testing)

#### 3. Deploy to Staging

- **Trigger**: Push to `staging` branch
- **Actions**: Auto-deploy to staging server (customer/client testing)

#### 4. Deploy to Production

- **Trigger**: Manual (workflow_dispatch) or push to `main`
- **Actions**: Deploy to prod server (requires approval)

## 📝 Branch Strategy

```
main      → Production (Future - when client server ready)
staging   → Staging (Customer/Client Testing) ← NEW
develop   → Development (Internal Team Testing)
feature/* → Feature branches
```

### Workflow:

1. **Local Development**: `npm run dev` / `python main.py` (Windows)
2. **Create feature branch** from `develop`
3. **Make changes and commit**
4. **Create PR to `develop`**
5. **After merge to `develop`**: Auto-deploy to dev server (internal testing)
6. **When ready for customer testing**: Merge `develop` to `staging`
7. **After merge to `staging`**: Auto-deploy to staging server (customer/client testing)
8. **When customer approves**: Merge `staging` to `main`
9. **After merge to `main`**: Deploy to production (future)

## 🛠️ Common Commands

### Development

```bash
# Start
docker-compose -p ai-portal-dev -f docker-compose.yml -f docker-compose.dev.yml up -d

# Stop
docker-compose -p ai-portal-dev down

# Restart
docker-compose -p ai-portal-dev restart

# Logs
docker-compose -p ai-portal-dev logs -f backend

# Rebuild
docker-compose -p ai-portal-dev -f docker-compose.yml -f docker-compose.dev.yml build --no-cache
```

### Staging

```bash
# Start
docker-compose -p ai-portal-staging -f docker-compose.yml -f docker-compose.staging.yml up -d

# Stop
docker-compose -p ai-portal-staging down

# Restart
docker-compose -p ai-portal-staging restart

# Logs
docker-compose -p ai-portal-staging logs -f backend

# Update
git pull origin staging
docker-compose -p ai-portal-staging -f docker-compose.yml -f docker-compose.staging.yml pull
docker-compose -p ai-portal-staging -f docker-compose.yml -f docker-compose.staging.yml up -d --build
```

### Production

```bash
# Start
docker-compose -p ai-portal-prod -f docker-compose.yml -f docker-compose.prod.yml up -d

# Stop
docker-compose -p ai-portal-prod down

# Restart
docker-compose -p ai-portal-prod restart

# Logs
docker-compose -p ai-portal-prod logs -f backend

# Update
git pull origin main
docker-compose -p ai-portal-prod -f docker-compose.yml -f docker-compose.prod.yml pull
docker-compose -p ai-portal-prod -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## 🔍 Troubleshooting

### Check Service Health

```bash
docker-compose -p ai-portal-dev ps
```

### View Logs

```bash
docker-compose -p ai-portal-dev logs --tail=100 backend
```

### Restart Service

```bash
docker-compose -p ai-portal-dev restart backend
```

### Clean Up

```bash
# Remove stopped containers
docker-compose -p ai-portal-dev down

# Remove volumes (⚠️ deletes data)
docker-compose -p ai-portal-dev down -v
```

## 📚 Additional Resources

- [MongoDB Host Setup](./MONGODB_HOST_SETUP.md)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
