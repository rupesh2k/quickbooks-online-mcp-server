#!/bin/bash

###############################################################################
# Azure Container Apps Deployment Script with GHCR Authentication
###############################################################################

set -e

# Check if required environment variables are set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN environment variable is not set"
    echo "Please run: export GITHUB_TOKEN=your_token_here"
    echo "Or run this script with: GITHUB_TOKEN=your_token ./deploy-to-azure.sh"
    exit 1
fi

if [ -z "$QUICKBOOKS_CLIENT_ID" ] || [ -z "$QUICKBOOKS_CLIENT_SECRET" ]; then
    echo "Error: QuickBooks credentials are required"
    echo "Please set the following environment variables:"
    echo "  export QUICKBOOKS_CLIENT_ID=your_client_id"
    echo "  export QUICKBOOKS_CLIENT_SECRET=your_client_secret"
    echo "  export QUICKBOOKS_REALM_ID=your_realm_id"
    echo "  export QUICKBOOKS_REDIRECTURI=your_redirect_uri"
    echo ""
    echo "Get credentials from: https://developer.intuit.com/"
    exit 1
fi

if [ -z "$QUICKBOOKS_REALM_ID" ]; then
    echo "Warning: QUICKBOOKS_REALM_ID not set. You'll need to authenticate via OAuth."
fi

if [ -z "$QUICKBOOKS_REDIRECTURI" ]; then
    echo "Error: QUICKBOOKS_REDIRECTURI is required"
    echo "Set it to your Azure Container App URL + /callback"
    echo "Example: export QUICKBOOKS_REDIRECTURI=https://your-app.azurecontainerapps.io/callback"
    exit 1
fi

# Check if OPENAI_API_KEY is set (optional but recommended)
if [ -z "$OPENAI_API_KEY" ]; then
    echo "Warning: OPENAI_API_KEY not set. AI Assistant features will not work."
    echo "To enable AI Assistant, set: export OPENAI_API_KEY=your_openai_key"
    echo ""
    echo "You can update it later with:"
    echo "  az containerapp secret set --name quickbooks-search-app --resource-group quickbooks-search-rg --secrets openai-api-key=YOUR_KEY"
    echo ""
    read -p "Continue without OpenAI? (y/n): " continue_deploy
    if [ "$continue_deploy" != "y" ]; then
        exit 1
    fi
fi

echo "Deploying QuickBooks Search App to Azure Container Apps..."
echo ""

az containerapp create \
  --name quickbooks-search-app \
  --resource-group quickbooks-search-rg \
  --environment quickbooks-env \
  --image ghcr.io/rupesh2k/quickbooks-online-mcp-server:latest \
  --registry-server ghcr.io \
  --registry-username rupesh2k \
  --registry-password "$GITHUB_TOKEN" \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --secrets \
    quickbooks-client-id="${QUICKBOOKS_CLIENT_ID}" \
    quickbooks-client-secret="${QUICKBOOKS_CLIENT_SECRET}" \
    quickbooks-refresh-token="${QUICKBOOKS_REFRESH_TOKEN:-}" \
    quickbooks-realm-id="${QUICKBOOKS_REALM_ID}" \
    quickbooks-redirect-uri="${QUICKBOOKS_REDIRECTURI}" \
    openai-api-key="${OPENAI_API_KEY:-}" \
    ai-provider="${AI_PROVIDER:-openai}" \
    openai-model="${OPENAI_MODEL:-gpt-4o-mini}" \
  --env-vars \
    QUICKBOOKS_CLIENT_ID=secretref:quickbooks-client-id \
    QUICKBOOKS_CLIENT_SECRET=secretref:quickbooks-client-secret \
    QUICKBOOKS_REFRESH_TOKEN=secretref:quickbooks-refresh-token \
    QUICKBOOKS_REALM_ID=secretref:quickbooks-realm-id \
    QUICKBOOKS_REDIRECTURI=secretref:quickbooks-redirect-uri \
    QUICKBOOKS_ENVIRONMENT="production" \
    OPENAI_API_KEY=secretref:openai-api-key \
    AI_PROVIDER=secretref:ai-provider \
    OPENAI_MODEL=secretref:openai-model \
    NODE_ENV=production

echo ""
echo "Deployment complete! Getting application URL..."
echo ""

# Get the application URL
APP_URL=$(az containerapp show \
  --name quickbooks-search-app \
  --resource-group quickbooks-search-rg \
  --query properties.configuration.ingress.fqdn \
  -o tsv)

echo "========================================="
echo "✓ Deployment successful!"
echo "========================================="
echo ""
echo "Application URL: https://$APP_URL"
echo "Resource Group: quickbooks-search-rg"
echo "Container App: quickbooks-search-app"
echo ""
echo "To view logs:"
echo "  az containerapp logs show --name quickbooks-search-app --resource-group quickbooks-search-rg --follow"
echo ""
