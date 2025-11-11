# 🗄️ MongoDB Host Setup Guide

## 📋 Current Setup

**MongoDB is installed system-wide (outside Docker)**

- ✅ MongoDB runs on host machine (port 27017)
- ✅ Docker containers connect to host MongoDB
- ✅ No MongoDB container in docker-compose.yml

---

## 🔧 Configuration

### Backend Service Connection

Backend container connects to host MongoDB via:

```yaml
MONGODB_URI=mongodb://host.docker.internal:27017/spaceguide-ai-backend
```

### Platform-Specific Notes

#### Windows / Mac (Docker Desktop)

✅ `host.docker.internal` works automatically

#### Linux (Docker Desktop)

✅ `host.docker.internal` works automatically

#### Linux (Docker Engine - Direct Install)

⚠️ `host.docker.internal` might not work. Use one of these:

**Option 1: Use Docker Gateway IP**

```yaml
MONGODB_URI=mongodb://172.17.0.1:27017/spaceguide-ai-backend
```

**Option 2: Use host network mode** (not recommended for production)

```yaml
network_mode: "host"
```

**Option 3: Add extra_hosts** (already configured in docker-compose.yml)

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

---

## 📝 Environment Variables

### `api-service/.env`

```env
# MongoDB connection (system-wide installed)
MONGODB_URI=mongodb://host.docker.internal:27017/spaceguide-ai-backend

# For Linux Docker Engine, use:
# MONGODB_URI=mongodb://172.17.0.1:27017/spaceguide-ai-backend
```

---

## ✅ Verify MongoDB Connection

### 1. Check MongoDB is Running on Host

```bash
# Check MongoDB service status
sudo systemctl status mongod  # Linux
brew services list | grep mongodb  # Mac
# Windows: Check Services panel

# Test connection
mongosh mongodb://localhost:27017/spaceguide-ai-backend
```

### 2. Test from Docker Container

```bash
# Enter backend container
docker exec -it ai-portal-backend sh

# Test MongoDB connection
# (if mongosh is installed in container)
mongosh mongodb://host.docker.internal:27017/spaceguide-ai-backend

# Or check from Node.js
node -e "require('mongoose').connect('mongodb://host.docker.internal:27017/spaceguide-ai-backend').then(() => console.log('Connected!')).catch(e => console.error(e))"
```

### 3. Check Backend Logs

```bash
docker logs ai-portal-backend | grep -i mongo
```

Should see:

```
MongoDB Connected: host.docker.internal
Database: spaceguide-ai-backend
```

---

## 🔒 Security Considerations

### MongoDB Bind IP

Ensure MongoDB accepts connections from Docker containers:

**Linux (`/etc/mongod.conf`):**

```yaml
net:
  bindIp: 127.0.0.1,172.17.0.1 # localhost + Docker gateway
  port: 27017
```

**Or allow all (development only):**

```yaml
net:
  bindIp: 0.0.0.0 # ⚠️ Development only!
  port: 27017
```

### Firewall Rules

If firewall is enabled, allow Docker network:

```bash
# Linux (iptables)
sudo iptables -A INPUT -s 172.17.0.0/16 -p tcp --dport 27017 -j ACCEPT

# Or disable firewall for development (not recommended for production)
```

---

## 🐛 Troubleshooting

### Connection Refused

**Error:** `MongoNetworkError: connect ECONNREFUSED`

**Solutions:**

1. Check MongoDB is running on host:

   ```bash
   sudo systemctl status mongod
   ```

2. Check MongoDB bind IP:

   ```bash
   # Linux
   cat /etc/mongod.conf | grep bindIp
   ```

3. Try different connection string:
   ```env
   # Try Docker gateway IP
   MONGODB_URI=mongodb://172.17.0.1:27017/spaceguide-ai-backend
   ```

### host.docker.internal Not Resolving

**Error:** `getaddrinfo ENOTFOUND host.docker.internal`

**Solution (Linux Docker Engine):**

```yaml
# docker-compose.yml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

Or use IP directly:

```env
MONGODB_URI=mongodb://172.17.0.1:27017/spaceguide-ai-backend
```

### Connection Timeout

**Error:** `MongoServerSelectionError: connection timed out`

**Solutions:**

1. Check MongoDB is listening on correct IP:

   ```bash
   netstat -tlnp | grep 27017
   # Should show: 0.0.0.0:27017 or 127.0.0.1:27017
   ```

2. Check firewall rules
3. Verify Docker network can reach host

---

## 📊 Architecture

```
┌─────────────────────────────────────┐
│         Host Machine                │
│                                     │
│  ┌──────────────┐                  │
│  │   MongoDB    │                  │
│  │  (System)    │                  │
│  │  :27017      │                  │
│  └──────┬───────┘                  │
│         │                           │
│         │ host.docker.internal      │
│         │                           │
│  ┌──────▼──────────────────────┐   │
│  │    Docker Network           │   │
│  │                             │   │
│  │  ┌──────────────────────┐   │   │
│  │  │  Backend Container   │   │   │
│  │  │  Connects to host    │   │   │
│  │  │  MongoDB             │   │   │
│  │  └──────────────────────┘   │   │
│  │                             │   │
│  │  ┌──────────────────────┐   │   │
│  │  │ Embedding Container  │   │   │
│  │  └──────────────────────┘   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## ✅ Summary

1. ✅ MongoDB service removed from docker-compose.yml
2. ✅ Backend connects via `host.docker.internal:27017`
3. ✅ `extra_hosts` configured for host access
4. ✅ MongoDB volume removed
5. ✅ `depends_on` MongoDB dependency removed

**All set!** 🎉
