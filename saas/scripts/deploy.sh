#!/bin/bash
# PTAR SaaS Platform - Deployment Script
# Usage: ./scripts/deploy.sh [dev|staging|production]

set -e

ENVIRONMENT=${1:-production}

echo "=========================================="
echo "PTAR SaaS Deployment - ${ENVIRONMENT}"
echo "=========================================="

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found!"
    echo "Please copy .env.production to .env and configure it:"
    echo "  cp .env.production .env"
    echo "  nano .env"
    exit 1
fi

# Check if SSL certificates exist (for production)
if [ "${ENVIRONMENT}" = "production" ]; then
    if [ ! -d "ssl" ] || [ ! -f "ssl/fullchain.pem" ]; then
        echo "WARNING: SSL certificates not found in ./ssl/"
        echo ""
        echo "For production, you need SSL certificates. Options:"
        echo "1. Use Let's Encrypt with Certbot"
        echo "2. Place your certificates in ./ssl/fullchain.pem and ./ssl/privkey.pem"
        echo ""
        read -p "Continue without SSL? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi

        # Create self-signed cert for testing
        echo "Creating self-signed certificate for testing..."
        mkdir -p ssl
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/privkey.pem \
            -out ssl/fullchain.pem \
            -subj "/CN=localhost"
    fi
fi

# Pull latest images
echo ""
echo "Pulling latest images..."
docker compose pull nginx || true

# Build application
echo ""
echo "Building application..."
docker compose build --no-cache app

# Stop existing containers
echo ""
echo "Stopping existing containers..."
docker compose down --remove-orphans || true

# Start new containers
echo ""
echo "Starting containers..."
if [ "${ENVIRONMENT}" = "production" ]; then
    docker compose up -d
else
    docker compose up -d app
fi

# Wait for health check
echo ""
echo "Waiting for application to be healthy..."
sleep 5

MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker compose exec app wget -q --spider http://localhost:8080/api/health 2>/dev/null; then
        echo "Application is healthy!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "  Waiting... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "ERROR: Application failed to start!"
    echo "Check logs with: docker compose logs app"
    exit 1
fi

# Show status
echo ""
echo "=========================================="
echo "Deployment completed successfully!"
echo "=========================================="
echo ""
docker compose ps
echo ""
echo "Logs: docker compose logs -f"
echo "Stop: docker compose down"
echo ""

if [ "${ENVIRONMENT}" = "production" ]; then
    echo "Application is running at https://localhost"
else
    echo "Application is running at http://localhost:8080"
fi
