#!/bin/bash

# Azure Container Instance Start Script
# Starts the container for demo purposes

set -e

echo "=========================================="
echo "Starting QuickBooks MCP Server Container"
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

echo "Starting container: $CONTAINER_NAME..."
az container start \
    --resource-group $RESOURCE_GROUP \
    --name $CONTAINER_NAME

echo ""
echo "Container started successfully!"
echo ""
echo "Waiting for container to be ready..."
sleep 5

# Get container state
STATE=$(az container show \
    --resource-group $RESOURCE_GROUP \
    --name $CONTAINER_NAME \
    --query instanceView.state -o tsv)

echo "Container state: $STATE"
echo ""
echo "Access your application at: $CONTAINER_URL"
echo ""
