# 📁 Environment Files Structure

## Overview

Each service has separate `.env` files for different environments. The base `docker-compose.yml` does NOT load any `.env` files - only the override files (dev, staging, prod) load their respective environment files.

---

## 📂 File Structure

```
spaceguide-ai-backend/
├── api-service/
│   ├── .env.dev          # Development environment (internal team)
│   ├── .env.staging      # Staging environment (customer/client testing)
│   └── .env.prod         # Production environment (live)
│
└── ai-embedding-service/
    ├── .env.dev          # Development environment
    ├── .env.staging      # Staging environment
    └── .env.prod         # Production environment
```

---

## 🔄 Docker Compose Files

### Base File (`docker-compose.yml`)

- ❌ **NO** `env_file` directive
- ✅ Only contains default environment variables
- ✅ Used as base for all environments

### Override Files

#### `docker-compose.dev.yml`

- ✅ Loads `api-service/.env.dev`
- ✅ Loads `ai-embedding-service/.env.dev`
- ✅ Used for: Internal team development

#### `docker-compose.staging.yml`

- ✅ Loads `api-service/.env.staging`
- ✅ Loads `ai-embedding-service/.env.staging`
- ✅ Used for: Customer/client testing

#### `docker-compose.prod.yml`

- ✅ Loads `api-service/.env.prod`
- ✅ Loads `ai-embedding-service/.env.prod`
- ✅ Used for: Production (live)

---

## 🚀 Usage

### Development

```bash
docker-compose -p ai-portal-dev -f docker-compose.yml -f docker-compose.dev.yml up -d
# Uses: .env.dev files
```

### Staging

```bash
docker-compose -p ai-portal-staging -f docker-compose.yml -f docker-compose.staging.yml up -d
# Uses: .env.staging files
```

### Production

```bash
docker-compose -p ai-portal-prod -f docker-compose.yml -f docker-compose.prod.yml up -d
# Uses: .env.prod files
```

---

## 📝 Creating Environment Files

### Using Setup Scripts

**Windows:**

```powershell
.\setup-env.ps1
```

**Linux/Mac:**

```bash
chmod +x setup-env.sh
./setup-env.sh
```

This will create all `.env.dev`, `.env.staging`, and `.env.prod` files for both services.

---

## ⚠️ Important Notes

1. **Never commit `.env` files to Git** - They contain secrets
2. **Each environment has separate files** - No mixing of configs
3. **Base docker-compose.yml doesn't load .env** - Only override files do
4. **Local development** - Use `.env` files directly (not `.env.dev`) when running `npm run dev` / `python main.py`

---

## 🔐 Security

- All `.env*` files are in `.gitignore`
- Only `.env.example` files should be committed (if needed)
- Use different secrets for each environment
- Rotate secrets regularly in production
