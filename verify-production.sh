#!/bin/bash

# Production Verification Script
# Verifies that the application is ready for production deployment

echo "========================================="
echo "Santa Priscila PTAR - Production Verification"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Check function
check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $2"
        ((FAILED++))
    fi
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

echo "1. Checking Required Files..."
echo "------------------------------"

[ -f .env ] && check 0 ".env file exists" || check 1 ".env file missing"
[ -f .env.production ] && check 0 ".env.production exists" || check 1 ".env.production missing"
[ -f docker-compose.yml ] && check 0 "docker-compose.yml exists" || check 1 "docker-compose.yml missing"
[ -f Dockerfile.backend ] && check 0 "Dockerfile.backend exists" || check 1 "Dockerfile.backend missing"
[ -f Dockerfile.frontend ] && check 0 "Dockerfile.frontend exists" || check 1 "Dockerfile.frontend missing"
[ -f DEPLOYMENT.md ] && check 0 "DEPLOYMENT.md exists" || check 1 "DEPLOYMENT.md missing"
[ -f PRODUCTION-READY.md ] && check 0 "PRODUCTION-READY.md exists" || check 1 "PRODUCTION-READY.md missing"

echo ""
echo "2. Checking Environment Configuration..."
echo "----------------------------------------"

if [ -f .env ]; then
    if grep -q "JWT_SECRET=" .env; then
        JWT_SECRET=$(grep "JWT_SECRET=" .env | cut -d '=' -f2)
        if [ ${#JWT_SECRET} -ge 32 ]; then
            check 0 "JWT_SECRET is configured and strong (${#JWT_SECRET} chars)"
        else
            check 1 "JWT_SECRET is too weak (${#JWT_SECRET} chars, minimum 32)"
        fi

        # Check if using default secret
        if [[ "$JWT_SECRET" == *"dev-secret"* ]]; then
            warn "JWT_SECRET appears to be default development secret - CHANGE THIS!"
        fi
    else
        check 1 "JWT_SECRET not found in .env"
    fi

    if grep -q "NODE_ENV=production" .env; then
        check 0 "NODE_ENV set to production"
    else
        warn "NODE_ENV not set to production"
    fi
else
    check 1 "Cannot verify .env - file not found"
fi

echo ""
echo "3. Checking Docker Configuration..."
echo "-----------------------------------"

# Check if Docker is installed
if command -v docker &> /dev/null; then
    check 0 "Docker is installed"
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
    echo "   Docker version: $DOCKER_VERSION"
else
    check 1 "Docker is not installed"
fi

# Check if Docker Compose is installed
if command -v docker-compose &> /dev/null; then
    check 0 "Docker Compose is installed"
    COMPOSE_VERSION=$(docker-compose --version | awk '{print $4}')
    echo "   Docker Compose version: $COMPOSE_VERSION"
else
    check 1 "Docker Compose is not installed"
fi

# Check if Docker daemon is running
if docker info &> /dev/null; then
    check 0 "Docker daemon is running"
else
    check 1 "Docker daemon is not running"
fi

echo ""
echo "4. Checking Security Fixes..."
echo "-----------------------------"

if grep -q "allowedSortFields" api/lib/dal.ts; then
    check 0 "SQL injection fix applied (sortBy whitelist)"
else
    check 1 "SQL injection fix missing"
fi

if grep -q "path.basename(plantId)" api/routes/documents.ts; then
    check 0 "Path traversal fix applied (plantId sanitization)"
else
    check 1 "Path traversal fix missing"
fi

if grep -q "GET.*download/:id" api/routes/documents.ts; then
    check 0 "Secure file download endpoint implemented"
else
    check 1 "Secure file download endpoint missing"
fi

if grep -q "SECURITY: Disable demo mode in production" api/routes/auth.ts; then
    check 0 "Demo mode production check implemented"
else
    check 1 "Demo mode production check missing"
fi

if grep -q "verbose: isProd ? undefined" api/lib/database.ts; then
    check 0 "Verbose database logging disabled in production"
else
    check 1 "Verbose database logging still enabled"
fi

echo ""
echo "5. Checking Docker Security..."
echo "------------------------------"

if grep -q "USER nodejs" Dockerfile.backend; then
    check 0 "Backend runs as non-root user"
else
    check 1 "Backend runs as root (security risk)"
fi

if grep -q "HEALTHCHECK" Dockerfile.backend; then
    check 0 "Backend health check configured"
else
    warn "Backend health check not configured"
fi

if grep -q "HEALTHCHECK" Dockerfile.frontend; then
    check 0 "Frontend health check configured"
else
    warn "Frontend health check not configured"
fi

echo ""
echo "6. Checking Database & Uploads..."
echo "---------------------------------"

[ -d data ] && check 0 "Data directory exists" || warn "Data directory not created yet (will be created on first run)"
[ -d uploads ] && check 0 "Uploads directory exists" || warn "Uploads directory not created yet (will be created on first run)"

if [ -f data/ptar.db ]; then
    check 0 "Database file exists"
    DB_SIZE=$(du -h data/ptar.db | cut -f1)
    echo "   Database size: $DB_SIZE"

    # Check if admin user exists
    if command -v sqlite3 &> /dev/null; then
        ADMIN_COUNT=$(sqlite3 data/ptar.db "SELECT COUNT(*) FROM users WHERE role='admin';")
        if [ "$ADMIN_COUNT" -gt 0 ]; then
            check 0 "Admin user exists ($ADMIN_COUNT admin users)"
        else
            warn "No admin users found - run scripts/create-admin.ts"
        fi
    fi
else
    warn "Database not initialized yet (will be created on first run)"
fi

echo ""
echo "7. Checking Documentation..."
echo "----------------------------"

[ -f DEPLOYMENT.md ] && check 0 "Deployment guide available" || check 1 "Deployment guide missing"
[ -f PRODUCTION-READY.md ] && check 0 "Production documentation available" || check 1 "Production documentation missing"
[ -f PRODUCTION-SUMMARY.md ] && check 0 "Production summary available" || check 1 "Production summary missing"

if [ -d claudedocs ]; then
    if [ -f claudedocs/SECURITY_AUDIT_REPORT.md ]; then
        check 0 "Security audit report available"
    else
        warn "Security audit report not found"
    fi
fi

echo ""
echo "========================================="
echo "VERIFICATION SUMMARY"
echo "========================================="
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ READY FOR PRODUCTION${NC}"
        echo "All checks passed! You can deploy with confidence."
        echo ""
        echo "Next steps:"
        echo "1. Review DEPLOYMENT.md for deployment instructions"
        echo "2. Ensure JWT_SECRET is unique and secure"
        echo "3. Run: docker-compose up -d"
        echo "4. Access: http://localhost"
        echo "5. Login with admin@santapriscila.com / Admin2025!"
        echo "6. CHANGE ADMIN PASSWORD immediately!"
        exit 0
    else
        echo -e "${YELLOW}⚠ READY WITH WARNINGS${NC}"
        echo "System is functional but has $WARNINGS warnings."
        echo "Review warnings above before deploying."
        exit 0
    fi
else
    echo -e "${RED}✗ NOT READY FOR PRODUCTION${NC}"
    echo "Fix $FAILED failed checks before deploying."
    exit 1
fi
