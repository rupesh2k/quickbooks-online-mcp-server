#!/bin/bash

###############################################################################
# Azure Container Apps Deployment Script
# This script deploys the QuickBooks Search App to Azure Container Apps
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Configuration - Update these values or set as environment variables
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-quickbooks-search-rg}"
LOCATION="${AZURE_LOCATION:-eastus}"
CONTAINER_APP_NAME="${AZURE_CONTAINER_APP_NAME:-quickbooks-search-app}"
CONTAINER_APP_ENV="${AZURE_CONTAINER_ENV:-quickbooks-env}"
REGISTRY="${CONTAINER_REGISTRY:-ghcr.io}"
IMAGE_NAME="${CONTAINER_IMAGE:-ghcr.io/YOUR_GITHUB_USERNAME/quickbooks-online-mcp-server:latest}"

print_info "Starting Azure Container Apps deployment..."
print_info "Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Location: $LOCATION"
echo "  Container App: $CONTAINER_APP_NAME"
echo "  Environment: $CONTAINER_APP_ENV"
echo "  Image: $IMAGE_NAME"
echo ""

# Login to Azure (if not already logged in)
print_info "Checking Azure login status..."
if ! az account show &> /dev/null; then
    print_info "Logging in to Azure..."
    az login
fi

# Get current subscription
SUBSCRIPTION=$(az account show --query id -o tsv)
print_info "Using subscription: $SUBSCRIPTION"

# Create resource group if it doesn't exist
print_info "Ensuring resource group exists..."
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none

# Register required providers
print_info "Registering required Azure providers..."
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

# Create Container Apps environment if it doesn't exist
print_info "Checking if Container Apps environment exists..."
if ! az containerapp env show --name "$CONTAINER_APP_ENV" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    print_info "Creating Container Apps environment..."
    az containerapp env create \
        --name "$CONTAINER_APP_ENV" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --output none
else
    print_info "Container Apps environment already exists."
fi

# Check if secrets are set in Azure Key Vault or as environment variables
if [ -z "$QUICKBOOKS_CLIENT_ID" ] || [ -z "$QUICKBOOKS_CLIENT_SECRET" ]; then
    print_warning "QuickBooks credentials not found in environment variables."
    print_warning "Please set them in Azure Container Apps secrets after deployment or provide them now."
    echo ""
    read -p "Enter QUICKBOOKS_CLIENT_ID: " QUICKBOOKS_CLIENT_ID
    read -sp "Enter QUICKBOOKS_CLIENT_SECRET: " QUICKBOOKS_CLIENT_SECRET
    echo ""
    read -p "Enter QUICKBOOKS_REFRESH_TOKEN: " QUICKBOOKS_REFRESH_TOKEN
    read -p "Enter QUICKBOOKS_REALM_ID: " QUICKBOOKS_REALM_ID
    read -p "Enter QUICKBOOKS_ENVIRONMENT (sandbox/production): " QUICKBOOKS_ENVIRONMENT
fi

# Check for OpenAI API Key (optional)
if [ -z "$OPENAI_API_KEY" ]; then
    print_warning "OpenAI API Key not found. AI Assistant will not work without it."
    echo ""
    read -p "Enter OPENAI_API_KEY (or press Enter to skip): " OPENAI_API_KEY
    if [ -z "$OPENAI_API_KEY" ]; then
        OPENAI_API_KEY="not-set"
        AI_PROVIDER="openai"
        OPENAI_MODEL="gpt-4o-mini"
    fi
else
    AI_PROVIDER="${AI_PROVIDER:-openai}"
    OPENAI_MODEL="${OPENAI_MODEL:-gpt-4o-mini}"
fi

# Deploy or update container app
print_info "Checking if container app exists..."
if az containerapp show --name "$CONTAINER_APP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    print_info "Updating existing container app..."
    az containerapp update \
        --name "$CONTAINER_APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --image "$IMAGE_NAME" \
        --output none
else
    print_info "Creating new container app..."
    az containerapp create \
        --name "$CONTAINER_APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --environment "$CONTAINER_APP_ENV" \
        --image "$IMAGE_NAME" \
        --target-port 3000 \
        --ingress external \
        --min-replicas 1 \
        --max-replicas 3 \
        --cpu 0.5 \
        --memory 1.0Gi \
        --secrets \
            quickbooks-client-id="$QUICKBOOKS_CLIENT_ID" \
            quickbooks-client-secret="$QUICKBOOKS_CLIENT_SECRET" \
            quickbooks-refresh-token="$QUICKBOOKS_REFRESH_TOKEN" \
            quickbooks-realm-id="$QUICKBOOKS_REALM_ID" \
            openai-api-key="$OPENAI_API_KEY" \
            ai-provider="$AI_PROVIDER" \
            openai-model="$OPENAI_MODEL" \
        --env-vars \
            QUICKBOOKS_CLIENT_ID=secretref:quickbooks-client-id \
            QUICKBOOKS_CLIENT_SECRET=secretref:quickbooks-client-secret \
            QUICKBOOKS_REFRESH_TOKEN=secretref:quickbooks-refresh-token \
            QUICKBOOKS_REALM_ID=secretref:quickbooks-realm-id \
            QUICKBOOKS_ENVIRONMENT="$QUICKBOOKS_ENVIRONMENT" \
            OPENAI_API_KEY=secretref:openai-api-key \
            AI_PROVIDER=secretref:ai-provider \
            OPENAI_MODEL=secretref:openai-model \
            NODE_ENV=production \
        --output none
fi

# Get the application URL
print_info "Retrieving application URL..."
APP_URL=$(az containerapp show \
    --name "$CONTAINER_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query properties.configuration.ingress.fqdn \
    -o tsv)

print_info "Deployment completed successfully!"
echo ""
print_info "Application URL: https://$APP_URL"
print_info "Resource Group: $RESOURCE_GROUP"
print_info "Container App: $CONTAINER_APP_NAME"
echo ""
print_info "To view logs, run:"
echo "  az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --follow"
echo ""
print_info "To update secrets, run:"
echo "  az containerapp secret set --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --secrets quickbooks-client-id=NEW_VALUE"
