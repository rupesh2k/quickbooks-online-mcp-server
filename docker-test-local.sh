#!/bin/bash

# Local Docker Testing Script
# Test the Docker build and run locally before deploying to Azure

set -e

IMAGE_NAME="quickbooks-online-mcp-server"
CONTAINER_NAME="quickbooks-test"

echo "=========================================="
echo "Local Docker Build and Test"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please create a .env file with your QuickBooks credentials."
    exit 1
fi

# Load environment variables
source .env

# Stop and remove existing container if it exists
echo "Cleaning up any existing containers..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Build the Docker image
echo "Building Docker image..."
docker build -t $IMAGE_NAME:latest .

echo ""
echo "Build successful!"
echo ""

# Run the container
echo "Starting container..."
docker run -d \
    --name $CONTAINER_NAME \
    -p 3000:3000 \
    -e QUICKBOOKS_CLIENT_ID="$QUICKBOOKS_CLIENT_ID" \
    -e QUICKBOOKS_CLIENT_SECRET="$QUICKBOOKS_CLIENT_SECRET" \
    -e QUICKBOOKS_REFRESH_TOKEN="$QUICKBOOKS_REFRESH_TOKEN" \
    -e QUICKBOOKS_REALM_ID="$QUICKBOOKS_REALM_ID" \
    -e QUICKBOOKS_ENVIRONMENT="$QUICKBOOKS_ENVIRONMENT" \
    -e QUICKBOOKS_REDIRECTURI="$QUICKBOOKS_REDIRECTURI" \
    $IMAGE_NAME:latest

echo ""
echo "Container started!"
echo ""
echo "Waiting for application to be ready..."
sleep 3

# Check if container is running
if docker ps | grep -q $CONTAINER_NAME; then
    echo "✓ Container is running"
    echo ""
    echo "Application is available at: http://localhost:3000"
    echo ""
    echo "To view logs:"
    echo "  docker logs -f $CONTAINER_NAME"
    echo ""
    echo "To stop the container:"
    echo "  docker stop $CONTAINER_NAME"
    echo ""
    echo "To remove the container:"
    echo "  docker rm $CONTAINER_NAME"
    echo ""
else
    echo "✗ Container failed to start"
    echo "Check logs with: docker logs $CONTAINER_NAME"
    exit 1
fi
