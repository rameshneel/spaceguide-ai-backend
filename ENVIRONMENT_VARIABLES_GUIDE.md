# 🔧 Environment Variables Guide

## 📋 Overview

Yeh guide explain karta hai ki `NODE_ENV` (api-service) aur `ENVIRONMENT` (ai-embedding-service) kahan define karein aur kaise pata chalega ki kaunsa environment use ho raha hai.

---

## 🎯 Environment Variables

### api-service (Node.js)

- **Variable Name**: `NODE_ENV`
- **Values**: `development`, `staging`, `production`

### ai-embedding-service (Python)

- **Variable Name**: `ENVIRONMENT`
- **Values**: `development`, `staging`, `production`

---

## 📍 Kahan Define Karein

### 1. **Docker Compose Files** (Recommended - Highest Priority)

#### Development (`docker-compose.dev.yml`):

```yaml
services:
  backend:
    environment:
      - NODE_ENV=development # ✅ Define here

  embedding-service:
    environment:
      - ENVIRONMENT=development # ✅ Define here
```

#### Staging (`docker-compose.staging.yml`):

```yaml
services:
  backend:
    environment:
      - NODE_ENV=staging # ✅ Define here

  embedding-service:
    environment:
      - ENVIRONMENT=staging # ✅ Define here
```

#### Production (`docker-compose.prod.yml`):

```yaml
services:
  backend:
    environment:
      - NODE_ENV=production # ✅ Define here

  embedding-service:
    environment:
      - ENVIRONMENT=production # ✅ Define here
```

---

### 2. **.env Files** (For Local Development)

#### api-service/.env.dev:

```env
NODE_ENV=development  # ✅ Define here for local dev
```

#### api-service/.env.staging:

```env
NODE_ENV=staging  # ✅ Define here for staging
```

#### api-service/.env.prod:

```env
NODE_ENV=production  # ✅ Define here for production
```

#### ai-embedding-service/.env.dev:

```env
ENVIRONMENT=development  # ✅ Define here for local dev
```

#### ai-embedding-service/.env.staging:

```env
ENVIRONMENT=staging  # ✅ Define here for staging
```

#### ai-embedding-service/.env.prod:

```env
ENVIRONMENT=production  # ✅ Define here for production
```

---

### 3. **System Environment Variables** (Optional)

```bash
# Linux/Mac
export NODE_ENV=development
export ENVIRONMENT=development

# Windows PowerShell
$env:NODE_ENV="development"
$env:ENVIRONMENT="development"
```

---

## 🔄 Priority Order

Environment variables ka priority order (highest to lowest):

1. **Docker Compose `environment` section** (Highest Priority)

   - Directly set in `docker-compose.dev.yml`, `docker-compose.staging.yml`, `docker-compose.prod.yml`
   - Yeh sabse pehle load hota hai

2. **Docker Compose `env_file`** (Second Priority)

   - `.env.dev`, `.env.staging`, `.env.prod` files se load hota hai
   - Docker Compose automatically load karta hai

3. **System Environment Variables** (Third Priority)

   - Host system ke environment variables
   - `export NODE_ENV=development` (Linux/Mac)
   - `$env:NODE_ENV="development"` (Windows)

4. **Application Code Defaults** (Lowest Priority)
   - Code me hardcoded defaults
   - Example: `const nodeEnv = process.env.NODE_ENV || "development"`

---

## 🔍 Kaise Pata Chalega Kaunsa Environment Use Ho Raha Hai

### Method 1: Docker Compose Logs

```bash
# Development
docker-compose -p ai-portal-dev -f docker-compose.yml -f docker-compose.dev.yml logs backend | grep NODE_ENV
docker-compose -p ai-portal-dev -f docker-compose.yml -f docker-compose.dev.yml logs embedding-service | grep ENVIRONMENT

# Staging
docker-compose -p ai-portal-staging -f docker-compose.yml -f docker-compose.staging.yml logs backend | grep NODE_ENV

# Production
docker-compose -p ai-portal-prod -f docker-compose.yml -f docker-compose.prod.yml logs backend | grep NODE_ENV
```

### Method 2: Container Me Check Karein

```bash
# Backend container
docker exec ai-portal-backend-dev printenv NODE_ENV
# Output: development

# Embedding service container
docker exec ai-portal-embedding-dev printenv ENVIRONMENT
# Output: development
```

### Method 3: Application Logs

#### api-service:

Application start karte time log me dikhega:

```
🌍 Environment: development
```

#### ai-embedding-service:

Check logs:

```bash
docker-compose logs embedding-service | grep ENVIRONMENT
```

### Method 4: Health Check Endpoint

```bash
# Backend
curl http://localhost:5000/health
# Response me environment info mil sakta hai

# Embedding Service
curl http://localhost:8001/api/v1/health
```

---

## 📝 Current Setup Summary

### ✅ Already Configured:

1. **docker-compose.dev.yml**:

   - `NODE_ENV=development` ✅
   - `ENVIRONMENT=development` ✅

2. **docker-compose.staging.yml**:

   - `NODE_ENV=staging` ✅
   - `ENVIRONMENT=staging` ✅

3. **docker-compose.prod.yml**:

   - `NODE_ENV=production` ✅
   - `ENVIRONMENT=production` ✅

4. **setup-env.sh / setup-env.ps1**:
   - `.env.dev` files me `NODE_ENV=development` ✅
   - `.env.staging` files me `NODE_ENV=staging` ✅
   - `.env.prod` files me `NODE_ENV=production` ✅

---

## 🚀 Usage Examples

### Local Development (Windows):

```powershell
# .env.dev file me NODE_ENV=development already hai
npm run dev
# NODE_ENV automatically development hoga
```

### Docker Development:

```bash
docker-compose -p ai-portal-dev -f docker-compose.yml -f docker-compose.dev.yml up -d
# NODE_ENV=development automatically set hoga (docker-compose.dev.yml se)
```

### Docker Staging:

```bash
docker-compose -p ai-portal-staging -f docker-compose.yml -f docker-compose.staging.yml up -d
# NODE_ENV=staging automatically set hoga (docker-compose.staging.yml se)
```

### Docker Production:

```bash
docker-compose -p ai-portal-prod -f docker-compose.yml -f docker-compose.prod.yml up -d
# NODE_ENV=production automatically set hoga (docker-compose.prod.yml se)
```

---

## ⚠️ Important Notes

1. **Docker Compose me define karna best practice hai** - Yeh sabse reliable hai
2. **.env files me bhi define karein** - Local development ke liye
3. **Don't hardcode in code** - Always use environment variables
4. **Priority order yaad rakhein** - Docker Compose > .env files > System env > Defaults

---

## 🔧 Troubleshooting

### Problem: Wrong environment use ho raha hai

**Solution:**

1. Check Docker Compose file me correct value hai ya nahi
2. Check `.env` file me correct value hai ya nahi
3. Restart containers: `docker-compose down && docker-compose up -d`

### Problem: Local me wrong environment

**Solution:**

1. Check `.env.dev` file me `NODE_ENV=development` hai
2. Restart application
3. Check system environment variables: `echo $NODE_ENV` (Linux/Mac) or `echo $env:NODE_ENV` (Windows)

---

## 📊 Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Application Start                                      │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Step 1: Check Docker Compose environment section      │
│  (docker-compose.dev.yml, staging.yml, prod.yml)       │
│  ✅ NODE_ENV=development (Highest Priority)            │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Step 2: Check Docker Compose env_file                 │
│  (Loads .env.dev, .env.staging, .env.prod)             │
│  ✅ NODE_ENV=development (if not set in Step 1)        │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Step 3: Check System Environment Variables            │
│  (export NODE_ENV=development)                          │
│  ✅ NODE_ENV=development (if not set in Step 1-2)      │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Step 4: Use Code Default                              │
│  (const nodeEnv = process.env.NODE_ENV || "development")│
│  ✅ NODE_ENV=development (if not set anywhere)         │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Final: Application uses NODE_ENV value                │
│  ✅ NODE_ENV=development                                │
└─────────────────────────────────────────────────────────┘
```

---

## 📚 Summary

| Location                     | Priority    | When to Use                         |
| ---------------------------- | ----------- | ----------------------------------- |
| Docker Compose `environment` | 1 (Highest) | Docker deployments                  |
| Docker Compose `env_file`    | 2           | Docker deployments (via .env files) |
| System Environment           | 3           | Manual overrides                    |
| Code Defaults                | 4 (Lowest)  | Fallback only                       |

**Best Practice**: Docker Compose files me define karein - yeh sabse reliable aur maintainable hai!

---

## ✅ Quick Reference

### Current Status:

- ✅ `docker-compose.dev.yml` me `NODE_ENV=development` defined
- ✅ `docker-compose.staging.yml` me `NODE_ENV=staging` defined
- ✅ `docker-compose.prod.yml` me `NODE_ENV=production` defined
- ✅ `.env.dev` files me `NODE_ENV=development` defined
- ✅ `.env.staging` files me `NODE_ENV=staging` defined
- ✅ `.env.prod` files me `NODE_ENV=production` defined

**Sab kuch already configured hai!** 🎉
