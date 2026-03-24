#!/bin/bash

###############################################################################
# Azure Container Apps Deployment Script with GHCR Authentication
###############################################################################

set -e

# Check if GITHUB_TOKEN is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN environment variable is not set"
    echo "Please run: export GITHUB_TOKEN=your_token_here"
    echo "Or run this script with: GITHUB_TOKEN=your_token ./deploy-to-azure.sh"
    exit 1
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
  --env-vars \
    QUICKBOOKS_CLIENT_ID=secretref:quickbooks-client-id \
    QUICKBOOKS_CLIENT_SECRET=secretref:quickbooks-client-secret \
    QUICKBOOKS_REFRESH_TOKEN=secretref:quickbooks-refresh-token \
    QUICKBOOKS_REALM_ID=secretref:quickbooks-realm-id \
    QUICKBOOKS_REDIRECTURI=secretref:quickbooks-redirect-uri \
    QUICKBOOKS_ENVIRONMENT="production" \
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
