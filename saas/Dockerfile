# Multi-stage Dockerfile for PTAR SaaS Platform
# Production-ready build with nginx reverse proxy

# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# ============================================
# Stage 2: Build Backend
# ============================================
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Install pnpm and build dependencies
RUN npm install -g pnpm
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy API source
COPY api ./api
COPY tsconfig.json ./

# Build API
RUN pnpm build:server

# ============================================
# Stage 3: Production Image
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies for CAD conversion
RUN apk add --no-cache \
    python3 \
    py3-pip \
    libredwg-tools \
    && pip3 install --break-system-packages ezdxf matplotlib

# Create non-root user
RUN addgroup -g 1001 -S ptar && \
    adduser -S ptar -u 1001

# Copy built files from previous stages
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/api ./api
COPY --from=frontend-builder /app/dist ./public

# Copy package.json for version info
COPY package.json ./

# Create data directories
RUN mkdir -p /app/data /app/uploads /app/logs && \
    chown -R ptar:ptar /app

# Switch to non-root user
USER ptar

# Environment variables
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start command
CMD ["node", "dist/server.js"]
