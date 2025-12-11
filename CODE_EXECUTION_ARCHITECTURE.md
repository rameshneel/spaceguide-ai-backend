# Code Execution Architecture - Docker Sandbox

## 🏗️ Architecture Overview

```
┌─────────────┐
│   Frontend  │  User clicks "Run"
│  (React)    │─────────────────┐
└─────────────┘                 │
                                 │
                                 ▼
┌─────────────────────────────────────────────┐
│         Backend API Service                 │
│  (Node.js/Express)                          │
│                                             │
│  1. Validate code & limits                 │
│  2. Check quota                             │
│  3. Call Execution Service                  │
└─────────────────────────────────────────────┘
                    │
                    │ HTTP Request
                    ▼
┌─────────────────────────────────────────────┐
│      Code Execution Service                 │
│      (Docker Container Manager)             │
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │  Docker Container Pool              │  │
│  │  - Python container                 │  │
│  │  - Node.js container                │  │
│  │  - Java container                   │  │
│  │  - etc.                             │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  1. Create isolated container               │
│  2. Copy code into container                │
│  3. Execute code                            │
│  4. Capture stdout/stderr                   │
│  5. Kill container                          │
│  6. Return results                          │
└─────────────────────────────────────────────┘
                    │
                    │ Results
                    ▼
┌─────────────────────────────────────────────┐
│         Backend API Service                 │
│                                             │
│  - Save run log                             │
│  - Update usage                              │
│  - Return to frontend                       │
└─────────────────────────────────────────────┘
```

## 🔄 Execution Flow (Step by Step)

### Step 1: User Request

```javascript
// Frontend sends:
POST /api/editor/run
{
  language: "python",
  code: "print('Hello World')\nprint(2+2)"
}
```

### Step 2: Backend Validation

```javascript
// Backend checks:
- Code size < 100KB ✓
- User has run quota remaining ✓
- Language is supported ✓
```

### Step 3: Docker Container Creation

```bash
# Execution service creates isolated container:
docker run --rm \
  --memory=128m \          # Limit memory
  --cpus=0.5 \             # Limit CPU
  --network=none \         # No network access
  --read-only \            # Read-only filesystem
  --tmpfs /tmp:rw,noexec \ # Temporary files
  --timeout=10s \          # Max execution time
  python:3.11-slim \
  python -c "print('Hello World'); print(2+2)"
```

### Step 4: Code Execution

```python
# Inside container:
# 1. Code is written to temp file: /tmp/code.py
# 2. Python executes: python /tmp/code.py
# 3. stdout captured: "Hello World\n4"
# 4. stderr captured: ""
# 5. Exit code: 0
```

### Step 5: Container Cleanup

```bash
# Container automatically removed after execution
# All files deleted
# No traces left
```

### Step 6: Response

```json
{
  "output": {
    "stdout": "Hello World\n4",
    "stderr": "",
    "exitCode": 0
  },
  "durationMs": 250,
  "memoryUsed": 45678
}
```

## 🔒 Security Features

### 1. **Isolation**

- Each execution runs in separate container
- No access to host filesystem
- No network access (optional)
- Read-only filesystem

### 2. **Resource Limits**

```yaml
Memory: 128MB per execution
CPU: 0.5 cores
Timeout: 10 seconds
Disk: Temporary only
```

### 3. **Code Restrictions**

- No file system writes (except /tmp)
- No network calls
- No system commands (rm, mkdir, etc.)
- No access to environment variables

### 4. **Auto Cleanup**

- Container deleted after execution
- Temporary files removed
- No persistent data

## 🛠️ Implementation Options

### Option 1: Docker API (Direct)

```javascript
const Docker = require("dockerode");
const docker = new Docker();

async function executeCode(language, code) {
  const container = await docker.createContainer({
    Image: `code-executor-${language}`,
    Cmd: ["sh", "-c", `echo "${code}" | ${getInterpreter(language)}`],
    HostConfig: {
      Memory: 128 * 1024 * 1024, // 128MB
      CpuQuota: 50000, // 0.5 CPU
      NetworkMode: "none",
      ReadonlyRootfs: true,
    },
  });

  await container.start();
  const stream = await container.logs({ stdout: true, stderr: true });
  // ... capture output
  await container.remove();
}
```

### Option 2: Separate Execution Service (Recommended)

```python
# FastAPI service: code-execution-service
# Handles Docker operations separately
# Better isolation and scaling
```

### Option 3: Third-party Services

- **Judge0 API**: Online code execution service
- **Piston API**: Open-source code execution engine
- **CodeX API**: Commercial solution

## 📊 Container Images Needed

```dockerfile
# Python executor
FROM python:3.11-slim
RUN apt-get update && apt-get install -y gcc
WORKDIR /tmp
CMD ["python", "-u", "code.py"]

# Node.js executor
FROM node:20-alpine
WORKDIR /tmp
CMD ["node", "code.js"]

# Java executor
FROM openjdk:17-jdk-slim
WORKDIR /tmp
CMD ["java", "Code.java"]
```

## ⚡ Performance Considerations

### 1. **Container Pool**

- Pre-create containers
- Reuse for faster execution
- Clean after each use

### 2. **Timeout Management**

- Kill container after timeout
- Prevent infinite loops
- Resource cleanup

### 3. **Concurrent Executions**

- Limit concurrent containers
- Queue system for high load
- Rate limiting per user

## 🚀 Implementation Steps

1. **Create Execution Service**

   - Docker API integration
   - Container management
   - Output capture

2. **Add to docker-compose.yml**

   ```yaml
   code-executor:
     build: ./code-execution-service
     ports:
       - "8002:8002"
   ```

3. **Update Backend Controller**

   - Replace mock execution
   - Call execution service
   - Handle errors

4. **Add Monitoring**
   - Execution logs
   - Performance metrics
   - Error tracking

## 📝 Example Implementation Structure

```
code-execution-service/
├── Dockerfile
├── requirements.txt
├── app/
│   ├── main.py          # FastAPI app
│   ├── docker_client.py # Docker operations
│   ├── executors/
│   │   ├── python.py
│   │   ├── javascript.py
│   │   └── java.py
│   └── models/
│       └── execution.py
```

## 🔐 Security Checklist

- [ ] Container isolation enabled
- [ ] Resource limits set
- [ ] Network disabled
- [ ] Read-only filesystem
- [ ] Timeout enforcement
- [ ] Code size limits
- [ ] Rate limiting
- [ ] Logging & monitoring
- [ ] Auto cleanup
- [ ] Error handling

## 💡 Benefits

1. **Security**: Complete isolation
2. **Scalability**: Can run multiple containers
3. **Reliability**: One failure doesn't affect others
4. **Performance**: Fast execution
5. **Flexibility**: Support multiple languages
