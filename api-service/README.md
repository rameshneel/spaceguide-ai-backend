# 🚀 AI Business Portal - Backend API Service

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Express](https://img.shields.io/badge/Express-5.1-blue.svg)
![MongoDB](https://img.shields.io/badge/MongoDB-8.19-green.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

**Enterprise-grade Node.js backend for AI-powered business services**

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
- [Authentication](#-authentication)
- [AI Services](#-ai-services)
- [Database Models](#-database-models)
- [Real-time Communication](#-real-time-communication)
- [Error Handling](#-error-handling)
- [Security](#-security)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## 🎯 Overview

The AI Business Portal Backend is a comprehensive Node.js/Express API service that provides:

- **AI Text Generation** - Generate high-quality content using OpenAI or Ollama
- **AI Image Generation** - Create images using Pollinations, HuggingFace, or DALL·E 3
- **AI Chatbot Builder** - Build and deploy custom chatbots with RAG capabilities
- **User Management** - Complete authentication and authorization system
- **Subscription Management** - Flexible subscription plans and billing
- **Payment Integration** - Stripe payment processing
- **Real-time Updates** - Socket.IO for live notifications and updates
- **Analytics** - Usage tracking and analytics

---

## ✨ Features

### 🤖 AI Services

- **Text Writer**

  - Multiple providers (Ollama, OpenAI)
  - Streaming responses
  - Content type customization (blog, email, social media, etc.)
  - Tone and style control
  - Usage tracking and history

- **Image Generator**

  - Multiple providers (Pollinations, HuggingFace, DALL·E 3)
  - Multiple sizes and styles
  - HD quality option
  - Prompt revision
  - Image storage and management

- **Chatbot Builder**
  - Custom chatbot creation
  - RAG (Retrieval-Augmented Generation) support
  - Multiple training data formats (text, PDF)
  - Vector database integration (ChromaDB)
  - Pre-built templates
  - Widget integration

### 👥 User Management

- JWT-based authentication
- Role-based access control (Admin, User)
- Refresh token mechanism
- Secure password hashing (bcrypt)
- User profile management

### 💳 Subscription & Payments

- Flexible subscription plans (Free, Basic, Premium, Enterprise)
- Stripe integration
- Usage limits per plan
- Subscription analytics
- Payment history

### 🔌 Real-time Communication

- Socket.IO integration
- Live notifications
- Real-time service updates
- User presence tracking
- Admin broadcasts

### 📊 Analytics & Monitoring

- Usage tracking
- Service statistics
- Subscription analytics
- Request logging (Winston)
- Health check endpoints

---

## 🛠 Tech Stack

### Core

- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.1
- **Database**: MongoDB 8.19 (Mongoose ODM)
- **Authentication**: JWT (jsonwebtoken)
- **Real-time**: Socket.IO 4.8

### AI & ML

- **Text Generation**: OpenAI API, Ollama
- **Image Generation**: Pollinations, HuggingFace, DALL·E 3
- **Embeddings**: FastAPI Embedding Service, OpenAI, Ollama
- **Vector Database**: ChromaDB

### Utilities

- **Validation**: express-validator
- **Security**: Helmet, CORS, bcryptjs
- **Logging**: Winston
- **File Upload**: Multer
- **PDF Processing**: pdf-parse
- **Rate Limiting**: express-rate-limit
- **Compression**: compression

### Payment

- **Stripe**: Stripe API

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local or Atlas)
- (Optional) Ollama for local AI models
- (Optional) FastAPI Embedding Service

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd spaceguide-ai-backend/api-service
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

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
# Required
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/spaceguide-ai-backend-dev
ACCESS_TOKEN_SECRET=dev-access-token-secret-change-this
REFRESH_TOKEN_SECRET=dev-refresh-token-secret-change-this

# Optional
PORT=5000
HOST=localhost
BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
TEXT_WRITER_PROVIDER=ollama
IMAGE_PROVIDER=pollinations
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_API_URL=http://localhost:8001
CHROMADB_URL=http://localhost:8000
```

**Note:** The application automatically loads the correct `.env` file based on `NODE_ENV`:

- `NODE_ENV=development` → loads `.env.dev`
- `NODE_ENV=staging` → loads `.env.staging`
- `NODE_ENV=production` → loads `.env.prod`

4. **Start the server**

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server will start on `http://localhost:5000`

### Health Check

```bash
curl http://localhost:5000/health
```

---

## 📁 Project Structure

```
api-service/
├── src/
│   ├── config/              # Configuration files
│   │   ├── database.js      # MongoDB connection
│   │   └── env.js           # Environment validation
│   │
│   ├── controllers/         # Request handlers
│   │   ├── auth.controller.js
│   │   ├── service.controller.js
│   │   ├── chatbot.controller.js
│   │   ├── subscription.controller.js
│   │   └── payment.controller.js
│   │
│   ├── middleware/          # Express middleware
│   │   ├── auth.middleware.js
│   │   ├── errorHandler.middleware.js
│   │   ├── rateLimit.middleware.js
│   │   └── usageLimit.middleware.js
│   │
│   ├── models/              # Mongoose models
│   │   ├── user.model.js
│   │   ├── service.model.js
│   │   ├── chatbot.model.js
│   │   └── subscription.model.js
│   │
│   ├── routes/              # API routes
│   │   ├── auth.routes.js
│   │   ├── service.routes.js
│   │   ├── chatbot.routes.js
│   │   └── subscription.routes.js
│   │
│   ├── services/            # Business logic
│   │   ├── ai/              # AI services
│   │   │   ├── services/
│   │   │   │   ├── textWriter/
│   │   │   │   ├── imageGenerator/
│   │   │   │   └── chatbot/
│   │   │   └── providers/
│   │   ├── communication/   # Socket.IO, Email
│   │   ├── payment/         # Stripe integration
│   │   └── subscription/    # Subscription logic
│   │
│   ├── utils/               # Utility functions
│   │   ├── logger.js
│   │   ├── ApiError.js
│   │   └── ApiResponse.js
│   │
│   ├── validation/          # Request validation
│   │   ├── auth.validation.js
│   │   └── service.validation.js
│   │
│   ├── app.js               # Express app setup
│   └── index.js             # Server entry point
│
├── public/                  # Static files
│   ├── widget.html          # Chatbot widget
│   └── generated-images/    # Generated images storage
│
├── uploads/                 # Uploaded files
├── logs/                    # Application logs
├── .env.dev                 # Development environment (local)
├── .env.staging             # Staging environment (customer testing)
├── .env.prod                # Production environment (live)
├── package.json
└── README.md
```

---

## 📚 API Documentation

### Base URL

```
Development: http://localhost:5000
Production: https://api.yourdomain.com
```

### Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <access_token>
```

### Endpoints

#### 🔐 Authentication

| Method | Endpoint                   | Description          | Auth        |
| ------ | -------------------------- | -------------------- | ----------- |
| POST   | `/api/auth/register`       | Register new user    | No          |
| POST   | `/api/auth/login`          | User login           | No          |
| POST   | `/api/auth/logout`         | User logout          | Yes         |
| POST   | `/api/auth/tokens/refresh` | Refresh access token | No (cookie) |
| GET    | `/api/auth/me`             | Get current user     | Yes         |

#### 🤖 AI Text Writer

| Method | Endpoint                             | Description               | Auth |
| ------ | ------------------------------------ | ------------------------- | ---- |
| POST   | `/api/services/text/generate`        | Generate text             | Yes  |
| POST   | `/api/services/text/generate-stream` | Generate text (streaming) | Yes  |
| GET    | `/api/services/text/history`         | Get generation history    | Yes  |
| GET    | `/api/services/text/stats`           | Get usage statistics      | Yes  |
| GET    | `/api/services/text/options`         | Get available options     | Yes  |

**Example Request:**

```json
POST /api/services/text/generate
{
  "prompt": "Write a blog post about AI",
  "contentType": "blog",
  "tone": "professional",
  "length": "medium"
}
```

#### 🎨 AI Image Generator

| Method | Endpoint                       | Description            | Auth |
| ------ | ------------------------------ | ---------------------- | ---- |
| POST   | `/api/services/image/generate` | Generate image         | Yes  |
| GET    | `/api/services/image/history`  | Get generation history | Yes  |
| GET    | `/api/services/image/stats`    | Get usage statistics   | Yes  |
| GET    | `/api/services/image/options`  | Get available options  | Yes  |

**Example Request:**

```json
POST /api/services/image/generate
{
  "prompt": "A futuristic city at sunset",
  "size": "1024x1024",
  "style": "vivid",
  "quality": "hd"
}
```

#### 🤖 Chatbot Builder

| Method | Endpoint                         | Description              | Auth |
| ------ | -------------------------------- | ------------------------ | ---- |
| POST   | `/api/chatbot`                   | Create chatbot           | Yes  |
| GET    | `/api/chatbot`                   | Get user's chatbots      | Yes  |
| GET    | `/api/chatbot/:id`               | Get chatbot details      | Yes  |
| PUT    | `/api/chatbot/:id`               | Update chatbot           | Yes  |
| DELETE | `/api/chatbot/:id`               | Delete chatbot           | Yes  |
| POST   | `/api/chatbot/:id/train/text`    | Train with text          | Yes  |
| POST   | `/api/chatbot/:id/train/file`    | Train with file (PDF)    | Yes  |
| POST   | `/api/chatbot/:id/query`         | Query chatbot            | Yes  |
| GET    | `/api/chatbot/:id/conversations` | Get conversations        | Yes  |
| GET    | `/widget/:id/info`               | Get widget info (public) | No   |

#### 💳 Subscriptions

| Method | Endpoint                       | Description              | Auth |
| ------ | ------------------------------ | ------------------------ | ---- |
| GET    | `/api/subscriptions/plans`     | Get all plans            | Yes  |
| GET    | `/api/subscriptions/current`   | Get current subscription | Yes  |
| POST   | `/api/subscriptions/subscribe` | Subscribe to plan        | Yes  |
| POST   | `/api/subscriptions/cancel`    | Cancel subscription      | Yes  |

#### 💰 Payments

| Method | Endpoint                      | Description           | Auth |
| ------ | ----------------------------- | --------------------- | ---- |
| POST   | `/api/payments/create-intent` | Create payment intent | Yes  |
| POST   | `/api/payments/webhook`       | Stripe webhook        | No   |
| GET    | `/api/payments/history`       | Get payment history   | Yes  |

#### 📊 Analytics

| Method | Endpoint                       | Description                | Auth        |
| ------ | ------------------------------ | -------------------------- | ----------- |
| GET    | `/api/analytics/usage`         | Get usage analytics        | Yes (Admin) |
| GET    | `/api/analytics/subscriptions` | Get subscription analytics | Yes (Admin) |

#### 🔌 Socket.IO

| Event                         | Description              | Auth |
| ----------------------------- | ------------------------ | ---- |
| `connect`                     | Connect to Socket.IO     | Yes  |
| `refresh_token`               | Refresh access token     | Yes  |
| `ai_text_generation_start`    | Text generation started  | Yes  |
| `ai_text_generation_progress` | Text generation progress | Yes  |
| `notification`                | Receive notification     | Yes  |

---

## ⚙️ Configuration

### Environment Variables

See `.env.dev`, `.env.staging`, or `.env.prod` files (created by setup scripts) for all available variables.

#### Required

- `MONGODB_URI` - MongoDB connection string
- `ACCESS_TOKEN_SECRET` - JWT access token secret
- `REFRESH_TOKEN_SECRET` - JWT refresh token secret

#### Optional

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `BASE_URL` - Base URL for the API
- `FRONTEND_URL` - Frontend URL for CORS
- `CORS_ORIGINS` - Comma-separated allowed origins

#### AI Providers

- `TEXT_WRITER_PROVIDER` - `ollama` or `openai` (default: `ollama`)
- `IMAGE_PROVIDER` - `pollinations`, `huggingface`, or `openai` (default: `pollinations`)
- `CHAT_PROVIDER` - `ollama` or `openai` (default: `ollama`)
- `EMBEDDING_PROVIDER` - `fastapi`, `ollama`, or `openai` (default: `fastapi`)

#### Ollama

- `OLLAMA_BASE_URL` - Ollama service URL (default: `http://localhost:11434`)
- `OLLAMA_TEXT_WRITER_MODEL` - Model for text writing (default: `tinyllama`)

#### FastAPI Embedding Service

- `EMBEDDING_API_URL` - Embedding service URL (default: `http://localhost:8001`)

#### OpenAI

- `OPENAI_API_KEY` - OpenAI API key (required for OpenAI providers)

#### Stripe

- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key

---

## 🔐 Authentication

### Registration

```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

### Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

Response includes:

- `accessToken` - Short-lived access token (15 minutes)
- `refreshToken` - Long-lived refresh token (7 days, HTTP-only cookie)

### Using Access Token

```bash
GET /api/auth/me
Authorization: Bearer <access_token>
```

### Refresh Token

```bash
POST /api/auth/tokens/refresh
# Refresh token sent as HTTP-only cookie
```

---

## 🤖 AI Services

### Text Writer

Supports multiple providers:

- **Ollama** (default) - Free, local, no API key required
- **OpenAI** - Requires API key, paid

**Features:**

- Streaming responses
- Multiple content types
- Tone customization
- Length control

### Image Generator

Supports multiple providers:

- **Pollinations** (default) - Free, no API key required
- **HuggingFace** - Free tier, requires API key
- **DALL·E 3** - Paid, requires OpenAI API key

**Features:**

- Multiple sizes (512x512 to 1792x1024)
- Multiple styles (vivid, natural, artistic, etc.)
- HD quality option
- Prompt revision

### Chatbot Builder

**Features:**

- Custom chatbot creation
- RAG (Retrieval-Augmented Generation)
- Multiple training formats (text, PDF)
- Vector database (ChromaDB)
- Pre-built templates
- Widget integration

**Training:**

- Text-based training
- PDF document training
- Automatic chunking and embedding
- Vector storage

---

## 🗄️ Database Models

### User

- Authentication credentials
- Profile information
- Subscription details
- Usage statistics

### Service

- AI service definitions
- Provider configuration
- Usage limits
- Pricing information

### Chatbot

- Chatbot configuration
- Training data metadata
- Vector collection references
- Conversation history

### Subscription

- Plan details
- User subscriptions
- Billing information
- Usage tracking

### Payment

- Payment records
- Stripe integration
- Transaction history

---

## 🔌 Real-time Communication

### Socket.IO

The service uses Socket.IO for real-time updates:

**Connection:**

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: {
    token: "your-access-token",
  },
});
```

**Events:**

- `connect` - Connection established
- `disconnect` - Connection lost
- `ai_text_generation_start` - Text generation started
- `ai_text_generation_progress` - Generation progress
- `notification` - New notification
- `refresh_token` - Update access token

---

## 🛡️ Security

### Implemented Security Measures

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Request throttling
- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt with salt rounds
- **Input Validation** - express-validator
- **SQL Injection Prevention** - Mongoose ODM
- **XSS Protection** - sanitize-html
- **Request Timeout** - connect-timeout middleware

### Best Practices

- Never commit `.env`, `.env.dev`, `.env.staging`, or `.env.prod` files (they contain secrets)
- Use strong JWT secrets
- Rotate secrets regularly
- Enable HTTPS in production
- Use environment-specific configurations
- Monitor and log security events

---

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 🚀 Deployment

### Docker

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run
```

### Docker Compose

See root `docker-compose.yml` for full stack deployment.

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secrets
- [ ] Configure MongoDB connection
- [ ] Set up HTTPS
- [ ] Configure CORS origins
- [ ] Set up logging
- [ ] Configure rate limits
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Set up error tracking

---

## 🐛 Troubleshooting

### Common Issues

**MongoDB Connection Error**

- Check `MONGODB_URI` is correct
- Ensure MongoDB is running
- Check network connectivity

**JWT Authentication Failed**

- Verify `ACCESS_TOKEN_SECRET` is set
- Check token expiration
- Ensure token is sent in Authorization header

**Ollama Connection Error**

- Ensure Ollama is running: `ollama serve`
- Check `OLLAMA_BASE_URL` is correct
- Verify model is available: `ollama list`

**Embedding Service Error**

- Ensure FastAPI service is running
- Check `EMBEDDING_API_URL` is correct
- Verify service health: `curl http://localhost:8001/api/v1/health`

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

<div align="center">

**Built with ❤️ for AI-powered business solutions**

[Back to Top](#-spaceguide-ai-backend---backend-api-service)

</div>
