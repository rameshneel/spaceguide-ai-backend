# Code Execution - Behind the Scenes Explained

## 🎯 Main Concept

जब user code run करता है, तो **isolated Docker container** में code execute होता है। यह एक **sandbox** है जहाँ code safely run हो सकता है।

---

## 📋 Complete Flow (Hindi + English)

### Step 1: User Action

```
User clicks "Run" button
    ↓
Frontend sends request to Backend
POST /api/editor/run
{
  language: "python",
  code: "print('Hello')\nprint(2+2)"
}
```

### Step 2: Backend Validation

```javascript
// Backend checks:
✅ Code size < 100KB?
✅ User has run quota?
✅ Language supported?
✅ Plan allows execution?

// If all OK → Proceed
```

### Step 3: Docker Container Creation

```bash
# Backend calls Execution Service
# Execution Service creates isolated container:

docker run --rm \
  --memory=128m \        # Max 128MB memory
  --cpus=0.5 \           # Max 50% CPU
  --network=none \       # No internet access
  --read-only \          # Can't modify files
  --timeout=10s \        # Max 10 seconds
  python:3.11-slim \     # Python image
  python code.py         # Run code
```

**Key Points:**

- `--rm`: Container automatically deleted after execution
- `--network=none`: Code cannot access internet
- `--read-only`: Code cannot modify system files
- `--memory=128m`: Limited memory (prevents memory attacks)

### Step 4: Code Execution Inside Container

```python
# Inside Docker container:
# 1. Code written to: /tmp/code.py
# 2. Python executes: python /tmp/code.py
# 3. Output captured:
#    stdout: "Hello\n4"
#    stderr: ""
#    exitCode: 0
# 4. Container stops
```

### Step 5: Output Capture

```javascript
// Execution Service captures:
{
  stdout: "Hello\n4",      // Normal output
  stderr: "",              // Error output (empty)
  exitCode: 0,             // 0 = success
  durationMs: 250,         // Execution time
  memoryUsed: 45678        // Memory used (bytes)
}
```

### Step 6: Container Cleanup

```bash
# Container automatically removed
# All files deleted
# No traces left
# Ready for next execution
```

### Step 7: Response to User

```json
// Backend returns to Frontend:
{
  "output": {
    "stdout": "Hello\n4",
    "stderr": "",
    "exitCode": 0
  },
  "durationMs": 250,
  "usage": { ... }
}

// Frontend displays:
┌─────────────────────────┐
│ Language: python        │
│ Exit Code: 0 ✓          │
│ Duration: 250ms          │
│ Status: Success          │
├─────────────────────────┤
│ Hello                   │
│ 4                       │
└─────────────────────────┘
```

---

## 🔒 Security Features

### 1. **Isolation**

```
User Code → Isolated Container → No access to:
  ❌ Host filesystem
  ❌ Other containers
  ❌ Network (optional)
  ❌ System files
```

### 2. **Resource Limits**

```
Memory: 128MB max
CPU: 50% max
Timeout: 10 seconds max
Disk: Temporary only
```

### 3. **Auto Cleanup**

```
After execution:
  ✅ Container deleted
  ✅ Files removed
  ✅ No persistent data
  ✅ Fresh for next run
```

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USER BROWSER                         │
│  Clicks "Run" → Sends code to Backend                   │
└─────────────────────────────────────────────────────────┘
                        │
                        │ HTTP POST
                        ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND API SERVICE                        │
│  (Node.js/Express)                                      │
│                                                          │
│  1. Validate code                                       │
│  2. Check user quota                                    │
│  3. Call Execution Service                              │
└─────────────────────────────────────────────────────────┘
                        │
                        │ HTTP Request
                        ▼
┌─────────────────────────────────────────────────────────┐
│         CODE EXECUTION SERVICE                          │
│         (FastAPI + Docker)                              │
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │  Docker Engine                               │      │
│  │                                               │      │
│  │  ┌──────────────┐  ┌──────────────┐        │      │
│  │  │ Container 1  │  │ Container 2  │        │      │
│  │  │ (Python)     │  │ (Node.js)    │        │      │
│  │  │              │  │              │        │      │
│  │  │ Code runs    │  │ Code runs    │        │      │
│  │  │ Isolated     │  │ Isolated     │        │      │
│  │  └──────────────┘  └──────────────┘        │      │
│  │                                               │      │
│  │  Each execution = New container              │      │
│  │  Auto cleanup after execution                 │      │
│  └──────────────────────────────────────────────┘      │
│                                                          │
│  Returns: stdout, stderr, exitCode, duration           │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Results
                        ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND API SERVICE                        │
│                                                          │
│  1. Save run log to MongoDB                            │
│  2. Update usage counter                               │
│  3. Return results to Frontend                         │
└─────────────────────────────────────────────────────────┘
                        │
                        │ JSON Response
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    USER BROWSER                         │
│  Displays output in Code Editor                         │
└─────────────────────────────────────────────────────────┘
```

---

## 💡 Real Example

### User Code:

```python
print("Hello World")
x = 10
y = 20
print(f"Sum: {x + y}")
```

### What Happens:

1. **Container Created:**

   ```bash
   docker run python:3.11-slim
   ```

2. **Code Written:**

   ```python
   # /tmp/code.py created inside container
   print("Hello World")
   x = 10
   y = 20
   print(f"Sum: {x + y}")
   ```

3. **Execution:**

   ```bash
   python /tmp/code.py
   ```

4. **Output Captured:**

   ```
   stdout: "Hello World\nSum: 30"
   stderr: ""
   exitCode: 0
   ```

5. **User Sees:**
   ```
   ┌─────────────────────┐
   │ Language: python    │
   │ Exit Code: 0 ✓      │
   │ Duration: 180ms     │
   ├─────────────────────┤
   │ Hello World         │
   │ Sum: 30             │
   └─────────────────────┘
   ```

---

## ⚠️ Error Example

### User Code (with error):

```python
print("Hello")
x = undefined_variable  # Error!
print("This won't run")
```

### What Happens:

1. **Container Created** ✓
2. **Code Written** ✓
3. **Execution Starts** ✓
4. **Error Occurs:**

   ```
   stderr: "NameError: name 'undefined_variable' is not defined"
   exitCode: 1
   ```

5. **User Sees:**
   ```
   ┌─────────────────────┐
   │ Language: python    │
   │ Exit Code: 1 ✗      │
   │ Duration: 50ms       │
   ├─────────────────────┤
   │ Hello               │
   │                     │
   │ --- Errors ---      │
   │ NameError: name     │
   │ 'undefined_variable'│
   │ is not defined      │
   └─────────────────────┘
   ```

---

## 🚀 Benefits

1. **Security**: Code cannot harm server
2. **Isolation**: Each execution is separate
3. **Clean**: No leftover files
4. **Fast**: Docker is efficient
5. **Scalable**: Can run multiple containers

---

## 📊 Current vs Production

### Currently (Mock):

```
User Code → Mock Response → "Code executed successfully"
```

### Production (Docker):

```
User Code → Docker Container → Real Execution → Real Output
```

---

## 🔧 Implementation Files Created

1. **CODE_EXECUTION_ARCHITECTURE.md** - Full architecture docs
2. **code-execution-service-example/** - Example implementation
   - `app/main.py` - FastAPI service
   - `Dockerfile` - Container setup
   - `requirements.txt` - Dependencies

---

## ✅ Summary

**Behind the scenes:**

1. Code goes into isolated Docker container
2. Executes safely with limits
3. Output captured
4. Container deleted
5. Results returned to user

**User sees:**

- Real code output
- Real errors
- Execution time
- Success/failure status

**Security:**

- Complete isolation
- Resource limits
- Auto cleanup
- No persistent data
