#!/bin/bash

# ==============================================================================
# Vexaro Backend - Docker Quick Setup Script
# ==============================================================================

set -e  # Exit on error

echo "🚀 Vexaro Backend - Docker Setup"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are installed${NC}"
echo ""

# Check if .env.docker.local exists
if [ ! -f ".env.docker.local" ]; then
    echo -e "${YELLOW}⚠️  .env.docker.local not found. Creating from template...${NC}"
    
    if [ -f ".env.docker" ]; then
        cp .env.docker .env.docker.local
        echo -e "${GREEN}✅ Created .env.docker.local${NC}"
        echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env.docker.local and add your credentials!${NC}"
        echo ""
        echo "Required variables:"
        echo "  - JWT_SECRET (generate with: openssl rand -hex 32)"
        echo "  - JWT_REFRESH_SECRET (generate with: openssl rand -hex 32)"
        echo "  - SMTP credentials"
        echo "  - Velocity API credentials"
        echo "  - Razorpay credentials"
        echo "  - Sentry DSN (optional but recommended)"
        echo ""
        read -p "Press Enter after updating .env.docker.local to continue..."
    else
        echo -e "${RED}❌ .env.docker template not found${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Environment configuration found${NC}"
echo ""

# Load environment variables
export $(cat .env.docker.local | grep -v '^#' | xargs)

# Check critical variables
MISSING_VARS=()

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your-super-secret-jwt-key-change-in-production-min-32-chars" ]; then
    MISSING_VARS+=("JWT_SECRET")
fi

if [ -z "$JWT_REFRESH_SECRET" ] || [ "$JWT_REFRESH_SECRET" = "your-super-secret-refresh-key-change-in-production-min-32-chars" ]; then
    MISSING_VARS+=("JWT_REFRESH_SECRET")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing or default values for critical variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Generate secrets with: openssl rand -hex 32"
    exit 1
fi

echo -e "${GREEN}✅ Critical environment variables configured${NC}"
echo ""

# Build the Docker image
echo "🔨 Building Docker image..."
docker-compose build --no-cache

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker image built successfully${NC}"
else
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi
echo ""

# Start services
echo "🚀 Starting services..."
docker-compose up -d

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Services started${NC}"
else
    echo -e "${RED}❌ Failed to start services${NC}"
    exit 1
fi
echo ""

# Wait for MongoDB replica set to initialize
echo "⏳ Waiting for MongoDB replica set to initialize (30-40 seconds)..."
sleep 35

# Check MongoDB status
echo "🔍 Checking MongoDB replica set status..."
docker-compose exec -T mongodb-primary mongosh -u admin -p admin123 --authenticationDatabase admin --eval "rs.status()" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ MongoDB replica set is ready${NC}"
else
    echo -e "${YELLOW}⚠️  MongoDB replica set initialization in progress. Check logs: docker-compose logs mongodb-primary${NC}"
fi
echo ""

# Wait for backend to be healthy
echo "⏳ Waiting for backend to be healthy..."
for i in {1..30}; do
    if curl -f http://localhost:3000/api/v1/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
        break
    fi
    
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Backend health check failed. Check logs: docker-compose logs backend${NC}"
        exit 1
    fi
    
    sleep 2
done
echo ""

# Show service status
echo "📊 Service Status:"
docker-compose ps
echo ""

# Test endpoints
echo "🧪 Testing endpoints..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/v1/health)
echo "Health Check: $HEALTH_RESPONSE"
echo ""

echo -e "${GREEN}✨ Setup complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "  1. Run database seeds (optional): docker-compose exec backend npm run seed"
echo "  2. Create indexes: docker-compose exec backend npm run create-indexes"
echo "  3. View logs: docker-compose logs -f backend"
echo "  4. Access Mongo Express (dev): docker-compose --profile dev up -d"
echo "     URL: http://localhost:8081 (admin/admin123)"
echo ""
echo "🎯 API Base URL: http://localhost:3000/api/v1"
echo "📊 Health Check: http://localhost:3000/api/v1/health"
echo ""
echo "🛑 To stop: docker-compose down"
echo "🔄 To restart: docker-compose restart backend"
echo ""
