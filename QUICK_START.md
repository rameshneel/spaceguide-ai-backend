# 🚀 Quick Start Guide

## 📦 Initial Setup

### 1. Setup Environment Files

**Windows (PowerShell):**

```powershell
.\setup-env.ps1
```

**Linux/Mac:**

```bash
chmod +x setup-env.sh
./setup-env.sh
```

### 2. Update Environment Variables

Edit these files with your actual values:

- `api-service/.env.dev` - Development backend config
- `api-service/.env.prod` - Production backend config
- `ai-embedding-service/.env.dev` - Development embedding config
- `ai-embedding-service/.env.prod` - Production embedding config

### 3. Initialize Git Repository

```bash
git init
git add .
git commit -m "Initial commit: AI Business Portal"
```

### 4. Setup GitHub Repository

```bash
# Create repo on GitHub, then:
git remote add origin https://github.com/yourusername/spaceguide-ai-backend.git
git branch -M main
git push -u origin main

# Create develop branch
git checkout -b develop
git push -u origin develop

# Create staging branch
git checkout -b staging
git push -u origin staging
```

## 🏃 Running Services

### Development (Internal Team)

```bash
docker-compose -p ai-portal-dev -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### Staging (Customer/Client Testing)

```bash
docker-compose -p ai-portal-staging -f docker-compose.yml -f docker-compose.staging.yml up -d
```

### Production (Future)

```bash
docker-compose -p ai-portal-prod -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 🔧 GitHub Actions Setup

1. Go to GitHub Repository → Settings → Secrets and variables → Actions
2. Add secrets (see README.DEPLOYMENT.md for details)
3. Push to `develop` branch → Auto-deploy to dev (internal testing)
4. Push to `staging` branch → Auto-deploy to staging (customer testing)
5. Merge to `main` → Deploy to prod (future)

## 📚 More Information

- [Deployment Guide](./README.DEPLOYMENT.md)
- [MongoDB Setup](./MONGODB_HOST_SETUP.md)
