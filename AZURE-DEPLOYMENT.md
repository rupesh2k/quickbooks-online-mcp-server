# Azure Container Deployment Guide

This guide explains how to deploy the QuickBooks Online MCP Server to Azure Container Instances with minimal resources for demo purposes.

## Prerequisites

1. **Azure CLI**: Install from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
2. **Docker**: Install from https://docs.docker.com/get-docker/
3. **Azure Account**: Active Azure subscription
4. **GitHub Account**: For free container registry (GHCR)
5. **GitHub Personal Access Token**: With `write:packages` and `read:packages` scopes
   - Create at: https://github.com/settings/tokens/new
6. **.env file**: Your QuickBooks credentials configured

## Cost Optimization

Azure Container Instances charges only when the container is running:
- **CPU**: 0.5 vCPU
- **Memory**: 0.5 GB
- **Estimated cost**: ~$0.01-0.02 per hour when running
- **When stopped**: No compute charges
- **Container Storage**: FREE (using GitHub Container Registry)

**Total cost**: Only pay for compute time when container is running!

## Deployment Steps

### 1. Setup GitHub Token

Create a GitHub Personal Access Token:
1. Go to https://github.com/settings/tokens/new
2. Give it a name: "QuickBooks GHCR"
3. Select scopes: `write:packages` and `read:packages`
4. Click "Generate token"
5. Copy the token

Export the token:
```bash
export GITHUB_TOKEN=your_token_here
```

Or add to your shell profile (~/.bashrc or ~/.zshrc):
```bash
echo 'export GITHUB_TOKEN=your_token_here' >> ~/.bashrc
source ~/.bashrc
```

### 2. Initial Deployment

Run the deployment script:

```bash
./azure-deploy.sh
```

This script will:
- Create a resource group
- Build your Docker image
- Push the image to GitHub Container Registry (FREE!)
- Deploy to Azure Container Instances
- Configure environment variables securely
- Provide you with the public URL

**Deployment time**: ~5-10 minutes

### 2. Managing Your Container

After deployment, you'll receive:
- A public URL to access your application
- Commands to start/stop the container

**Access your application**:
```
http://your-container-url:3000
```

### 3. Stop Container (Save Costs)

When you're done with your demo:

```bash
./azure-stop.sh
```

This stops the container and you stop paying for compute time.

### 4. Start Container (For Next Demo)

Before your next demo:

```bash
./azure-start.sh
```

Container starts in ~10-30 seconds.

## Common Commands

### Check Container Status
```bash
source azure-deployment-info.txt
az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --query instanceView.state
```

### View Container Logs
```bash
source azure-deployment-info.txt
az container logs --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME
```

### Delete All Resources
When you're completely done and want to remove everything:

```bash
source azure-deployment-info.txt
az group delete --name $RESOURCE_GROUP --yes
```

This deletes:
- The container
- The container registry
- All associated resources

## Updating Your Application

To deploy a new version:

```bash
# 1. Stop the current container
./azure-stop.sh

# 2. Rebuild and redeploy
source azure-deployment-info.txt
docker build -t quickbooks-online-mcp-server:latest .
ACR_LOGIN_SERVER=$(az acr show --name $REGISTRY_NAME --query loginServer -o tsv)
docker tag quickbooks-online-mcp-server:latest $ACR_LOGIN_SERVER/quickbooks-online-mcp-server:latest
docker push $ACR_LOGIN_SERVER/quickbooks-online-mcp-server:latest

# 3. Restart the container
az container restart --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME

# 4. Start it
./azure-start.sh
```

## Troubleshooting

### Container won't start
Check the logs:
```bash
source azure-deployment-info.txt
az container logs --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --follow
```

### Environment variables not working
Verify they're set correctly:
```bash
source azure-deployment-info.txt
az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --query containers[0].environmentVariables
```

### Need to update credentials
1. Stop the container
2. Update your .env file
3. Run the update commands above

## Security Notes

- Environment variables are passed securely to the container
- The .env file is never uploaded to Azure
- Credentials are stored in Azure's secure environment variable system
- The container registry requires authentication
- The .env file is excluded from Docker image via .dockerignore

## Demo Workflow

**Before your demo**:
```bash
./azure-start.sh
# Wait 30 seconds
# Access the URL provided
```

**After your demo**:
```bash
./azure-stop.sh
```

**That's it!** Simple and cost-effective.

## Additional Configuration

### Custom Domain
To use a custom domain, you'll need to:
1. Set up Azure Front Door or Application Gateway
2. Configure SSL/TLS certificates
3. Update DNS records

### Scaling
If you need more resources, edit `azure-deploy.sh`:
```bash
--cpu 1 \
--memory 1 \
```

### Multiple Environments
Create separate resource groups for dev/staging/prod:
```bash
RESOURCE_GROUP="quickbooks-demo-prod-rg"
RESOURCE_GROUP="quickbooks-demo-dev-rg"
```
