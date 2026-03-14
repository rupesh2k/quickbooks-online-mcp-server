#!/bin/bash

# Azure Container Instance Stop Script
# Stops the container to save costs when not demoing

set -e

echo "=========================================="
echo "Stopping QuickBooks MCP Server Container"
echo "=========================================="
echo ""

# Load deployment info
if [ ! -f azure-deployment-info.txt ]; then
    echo "Error: azure-deployment-info.txt not found!"
    echo "Please run ./azure-deploy.sh first."
    exit 1
fi

source azure-deployment-info.txt

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "Error: Azure CLI is not installed."
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo "Not logged in to Azure. Logging in..."
    az login
fi

echo "Stopping container: $CONTAINER_NAME..."
az container stop \
    --resource-group $RESOURCE_GROUP \
    --name $CONTAINER_NAME

echo ""
echo "Container stopped successfully!"
echo "You are no longer being charged for compute time."
echo ""
echo "To start the container again, run:"
echo "  ./azure-start.sh"
echo ""
