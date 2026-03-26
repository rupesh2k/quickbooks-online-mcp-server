#!/bin/bash

# Azure Container Instance Deployment Script
# This script deploys the QuickBooks MCP Server to Azure Container Instances
# Uses GitHub Container Registry (GHCR) for free container storage

set -e

# Configuration
RESOURCE_GROUP="quickbooks-demo-rg"
LOCATION="eastus"
CONTAINER_NAME="quickbooks-search"
IMAGE_NAME="quickbooks-online-mcp-server"
GITHUB_USERNAME="rupesh2k"
DNS_NAME_LABEL="quickbooks-demo-$(whoami)"
GHCR_IMAGE="ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}"

echo "=========================================="
echo "QuickBooks MCP Server - Azure Deployment"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "Error: Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "Error: Azure CLI is not installed. Please install it first:"
    echo "https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
echo "Checking Azure login status..."
if ! az account show &> /dev/null; then
    echo "Not logged in to Azure. Logging in..."
    az login
fi

# Get current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo "Using Azure subscription: $SUBSCRIPTION"
echo ""

# Check for GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN environment variable not set!"
    echo ""
    echo "Please create a GitHub Personal Access Token with 'write:packages' scope:"
    echo "1. Go to: https://github.com/settings/tokens/new"
    echo "2. Create a token with 'write:packages' and 'read:packages' scopes"
    echo "3. Export it: export GITHUB_TOKEN=your_token_here"
    echo "4. Run this script again"
    echo ""
    echo "Or add it to your .env file:"
    echo "  echo 'export GITHUB_TOKEN=your_token_here' >> ~/.bashrc"
    exit 1
fi

# Load environment variables
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please create a .env file with your QuickBooks credentials."
    exit 1
fi

echo "Loading environment variables from .env..."
source .env

# Validate required environment variables
if [ -z "$QUICKBOOKS_CLIENT_ID" ] || [ -z "$QUICKBOOKS_CLIENT_SECRET" ]; then
    echo "Error: Required environment variables not set!"
    echo "Please ensure QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET are in .env"
    exit 1
fi

# Check for OpenAI API Key (optional but recommended)
if [ -z "$OPENAI_API_KEY" ]; then
    echo "Warning: OPENAI_API_KEY not set. AI Assistant will not work."
    echo "To enable AI Assistant, add to .env: OPENAI_API_KEY=your_key_here"
    echo "Get your key from: https://platform.openai.com/api-keys"
    echo ""
else
    echo "✓ OpenAI API Key found. AI Assistant will be enabled."
    echo ""
fi

# Set default AI provider values if not set
AI_PROVIDER="${AI_PROVIDER:-openai}"
OPENAI_MODEL="${OPENAI_MODEL:-gpt-4o-mini}"

# Create resource group
echo "Creating resource group: $RESOURCE_GROUP in $LOCATION..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# Build Docker image
echo ""
echo "Building Docker image for Linux AMD64..."
docker build --platform linux/amd64 -t $IMAGE_NAME:latest .

# Tag image for GHCR
echo "Tagging image for GitHub Container Registry..."
docker tag $IMAGE_NAME:latest $GHCR_IMAGE:latest

# Login to GHCR
echo "Logging in to GitHub Container Registry..."
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

# Push image to GHCR
echo "Pushing image to GitHub Container Registry..."
docker push $GHCR_IMAGE:latest

echo ""
echo "Image pushed successfully to: $GHCR_IMAGE:latest"
echo ""

# Deploy to Azure Container Instances
echo "Deploying container to Azure Container Instances..."
az container create \
    --resource-group $RESOURCE_GROUP \
    --name $CONTAINER_NAME \
    --image $GHCR_IMAGE:latest \
    --os-type Linux \
    --cpu 0.5 \
    --memory 0.5 \
    --registry-login-server ghcr.io \
    --registry-username $GITHUB_USERNAME \
    --registry-password $GITHUB_TOKEN \
    --dns-name-label $DNS_NAME_LABEL \
    --ports 3000 \
    --environment-variables \
        QUICKBOOKS_CLIENT_ID=$QUICKBOOKS_CLIENT_ID \
        QUICKBOOKS_CLIENT_SECRET=$QUICKBOOKS_CLIENT_SECRET \
        QUICKBOOKS_REFRESH_TOKEN=$QUICKBOOKS_REFRESH_TOKEN \
        QUICKBOOKS_REALM_ID=$QUICKBOOKS_REALM_ID \
        QUICKBOOKS_ENVIRONMENT=$QUICKBOOKS_ENVIRONMENT \
        QUICKBOOKS_REDIRECTURI=$QUICKBOOKS_REDIRECTURI \
        OPENAI_API_KEY=$OPENAI_API_KEY \
        AI_PROVIDER=$AI_PROVIDER \
        OPENAI_MODEL=$OPENAI_MODEL \
        NODE_ENV=production

# Get container URL
CONTAINER_URL=$(az container show \
    --resource-group $RESOURCE_GROUP \
    --name $CONTAINER_NAME \
    --query ipAddress.fqdn -o tsv)

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Container URL: http://$CONTAINER_URL:3000"
echo "Resource Group: $RESOURCE_GROUP"
echo "Container Name: $CONTAINER_NAME"
echo "Image: $GHCR_IMAGE:latest"
echo ""
echo "To stop the container (save costs):"
echo "  ./azure-stop.sh"
echo ""
echo "To start the container:"
echo "  ./azure-start.sh"
echo ""
echo "To delete all resources:"
echo "  az group delete --name $RESOURCE_GROUP --yes"
echo ""

# Save deployment info
cat > azure-deployment-info.txt <<EOF
RESOURCE_GROUP=$RESOURCE_GROUP
CONTAINER_NAME=$CONTAINER_NAME
GITHUB_USERNAME=$GITHUB_USERNAME
GHCR_IMAGE=$GHCR_IMAGE:latest
CONTAINER_URL=http://$CONTAINER_URL:3000
DEPLOYMENT_DATE=$(date)
EOF

echo "Deployment info saved to azure-deployment-info.txt"
echo ""
echo "Note: Your container image is stored for FREE in GitHub Container Registry!"
