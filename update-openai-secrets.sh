#!/bin/bash

###############################################################################
# Update OpenAI Secrets in Azure Container Apps
# This script adds OpenAI configuration to an existing deployment
###############################################################################

set -e

# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "Error: OPENAI_API_KEY environment variable is not set"
    echo "Please run: export OPENAI_API_KEY=your_openai_key_here"
    echo "Get your key from: https://platform.openai.com/api-keys"
    exit 1
fi

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-quickbooks-search-rg}"
CONTAINER_APP_NAME="${AZURE_CONTAINER_APP_NAME:-quickbooks-search-app}"
AI_PROVIDER="${AI_PROVIDER:-openai}"
OPENAI_MODEL="${OPENAI_MODEL:-gpt-4o-mini}"

echo "Updating OpenAI configuration for Azure Container App..."
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Container App: $CONTAINER_APP_NAME"
echo "  AI Provider: $AI_PROVIDER"
echo "  Model: $OPENAI_MODEL"
echo ""

# Add or update secrets
echo "Setting secrets..."
az containerapp secret set \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --secrets \
    openai-api-key="$OPENAI_API_KEY" \
    ai-provider="$AI_PROVIDER" \
    openai-model="$OPENAI_MODEL"

echo ""
echo "Updating environment variables..."
az containerapp update \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars \
    OPENAI_API_KEY=secretref:openai-api-key \
    AI_PROVIDER=secretref:ai-provider \
    OPENAI_MODEL=secretref:openai-model

echo ""
echo "========================================="
echo "✓ OpenAI configuration updated!"
echo "========================================="
echo ""
echo "The container will restart automatically."
echo "Wait about 30 seconds, then test the AI Assistant at:"
echo "  https://$(az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)/assistant"
echo ""
