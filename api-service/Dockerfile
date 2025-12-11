# syntax=docker/dockerfile:1.4

############################
# Builder stage
############################
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (if needed)
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Use BuildKit cache mount for npm (keeps downloaded packages)
# This significantly speeds up rebuilds when dependencies don't change
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

############################
# Production stage
############################
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy environment-specific .env files if they exist
# Note: docker-compose override files (dev/staging/prod) load .env.dev/.env.staging/.env.prod via env_file
# This COPY ensures dotenv.config() can also read the file if needed
# Files copied: .env.dev, .env.staging, .env.prod, .env (fallback)
COPY --chown=nodejs:nodejs .env* ./

# Copy application code separately (ensures only code changes trigger rebuild)
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p logs uploads public/generated-images && \
    chown -R nodejs:nodejs logs uploads public/generated-images

# Switch to non-root user
USER nodejs

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "src/index.js"]

