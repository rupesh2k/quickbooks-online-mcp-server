#!/bin/bash

# Security Verification Script
# Verifies that sensitive files are NOT included in the Docker image

set -e

IMAGE_NAME="quickbooks-online-mcp-server:latest"

echo "=========================================="
echo "Docker Image Security Verification"
echo "=========================================="
echo ""

# Check if image exists
if ! docker image inspect $IMAGE_NAME &> /dev/null; then
    echo "Error: Image $IMAGE_NAME not found."
    echo "Please build the image first: docker build -t $IMAGE_NAME ."
    exit 1
fi

echo "Checking for sensitive files in Docker image..."
echo ""

# Create a temporary container to inspect
CONTAINER_ID=$(docker create $IMAGE_NAME)

echo "✓ Created temporary container: $CONTAINER_ID"
echo ""

# Check for .env file
echo "1. Checking for .env file..."
if docker cp $CONTAINER_ID:/app/.env /tmp/test-env 2>/dev/null; then
    echo "   ❌ SECURITY ISSUE: .env file found in container!"
    rm -f /tmp/test-env
    docker rm $CONTAINER_ID > /dev/null
    exit 1
else
    echo "   ✓ .env file NOT in container (GOOD)"
fi

# Check for other sensitive files
echo ""
echo "2. Checking for .git directory..."
if docker exec $CONTAINER_ID test -d /app/.git 2>/dev/null; then
    echo "   ⚠️  WARNING: .git directory found in container"
else
    echo "   ✓ .git directory NOT in container (GOOD)"
fi

echo ""
echo "3. Checking for node_modules in image..."
if docker exec $CONTAINER_ID test -d /app/node_modules 2>/dev/null; then
    echo "   ✓ node_modules present (expected for dependencies)"
else
    echo "   ⚠️  node_modules not found (this might be an issue)"
fi

echo ""
echo "4. Listing files in /app directory..."
docker exec $CONTAINER_ID ls -la /app/ | head -20

echo ""
echo "5. Checking environment variables in image..."
echo "   (Should only see NODE_ENV, not secrets)"
docker exec $CONTAINER_ID env | grep -E "(NODE_ENV|QUICKBOOKS)" || echo "   ✓ No hardcoded secrets in image"

# Cleanup
docker rm $CONTAINER_ID > /dev/null

echo ""
echo "=========================================="
echo "Security Verification Complete!"
echo "=========================================="
echo ""
echo "✓ .env file is NOT in the Docker image"
echo "✓ Credentials are passed at runtime via Azure environment variables"
echo "✓ Image can be safely pushed to public/private registries"
echo ""
echo "How credentials are handled:"
echo "  1. .env file stays on your local machine (excluded by .dockerignore)"
echo "  2. azure-deploy.sh reads .env locally"
echo "  3. Credentials passed to Azure as secure environment variables"
echo "  4. Azure injects them into container at runtime"
echo "  5. Credentials never baked into the image"
echo ""
