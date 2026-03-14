# Docker Deployment Guide

Complete guide for deploying the QuickBooks Search Application using Docker, GitHub Container Registry (GHCR), and Azure Container Apps.

## Table of Contents

- [Quick Start](#quick-start)
- [Building Docker Image](#building-docker-image)
- [GitHub Container Registry Setup](#github-container-registry-setup)
- [Azure Container Apps Deployment](#azure-container-apps-deployment)
- [Managing Secrets](#managing-secrets)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Docker installed locally
- GitHub account with repository access
- Azure account with active subscription
- Azure CLI installed (`az` command)

### Local Docker Testing

1. **Build the image:**
   ```bash
   docker build -t quickbooks-search-app .
   ```

2. **Run locally with environment file:**
   ```bash
   docker run -p 3000:3000 --env-file .env quickbooks-search-app
   ```

3. **Access the application:**
   Open http://localhost:3000 in your browser

## Building Docker Image

The Dockerfile uses a multi-stage build for optimized image size and security:

```dockerfile
# Stage 1: Build TypeScript
FROM node:20-alpine AS builder
# ... build steps

# Stage 2: Production runtime
FROM node:20-alpine
# ... runtime setup with non-root user
```

### Build Features

- **Multi-stage build** for smaller final image
- **Non-root user** (nodejs:nodejs) for security
- **Health checks** built-in
- **Production dependencies only**
- **Signal handling** with dumb-init

### Manual Build and Push to GHCR

```bash
# 1. Build the image
docker build -t ghcr.io/YOUR_USERNAME/quickbooks-online-mcp-server:latest .

# 2. Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# 3. Push to registry
docker push ghcr.io/YOUR_USERNAME/quickbooks-online-mcp-server:latest
```

## GitHub Container Registry Setup

### Automatic CI/CD with GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/docker-publish.yml`) that automatically:

1. Builds the Docker image
2. Pushes to GHCR on every push to main/develop
3. Tags images with version numbers and git SHA
4. Creates attestations for security

### Setting Up GitHub Actions

1. **Enable GitHub Actions** in your repository settings

2. **The workflow runs automatically** - No setup needed!
   - Pushes to `main` or `develop` trigger builds
   - Creates git tags like `v1.0.0` for versioned releases
   - Pull requests build but don't push

3. **Access your images:**
   ```bash
   docker pull ghcr.io/YOUR_USERNAME/quickbooks-online-mcp-server:latest
   ```

### Image Tags

The workflow creates multiple tags:

- `latest` - Latest from main branch
- `main` - Latest from main branch
- `develop` - Latest from develop branch
- `v1.0.0` - Semantic version tags
- `main-abc1234` - Branch + git SHA

### Making Repository Package Public

By default, GHCR packages are private. To make public:

1. Go to your package on GitHub: `https://github.com/YOUR_USERNAME?tab=packages`
2. Click on your package
3. Click "Package settings"
4. Scroll to "Danger Zone"
5. Click "Change visibility" → "Public"

## Azure Container Apps Deployment

### Quick Deploy with Script

The easiest way to deploy:

```bash
# Set your image name (update YOUR_USERNAME)
export CONTAINER_IMAGE="ghcr.io/YOUR_USERNAME/quickbooks-online-mcp-server:latest"

# Set QuickBooks credentials
export QUICKBOOKS_CLIENT_ID="your_client_id"
export QUICKBOOKS_CLIENT_SECRET="your_client_secret"
export QUICKBOOKS_REFRESH_TOKEN="your_refresh_token"
export QUICKBOOKS_REALM_ID="your_realm_id"
export QUICKBOOKS_ENVIRONMENT="sandbox"

# Run deployment script
./deploy-azure-container.sh
```

### Manual Azure Deployment

1. **Login to Azure:**
   ```bash
   az login
   ```

2. **Set variables:**
   ```bash
   RESOURCE_GROUP="quickbooks-search-rg"
   LOCATION="eastus"
   CONTAINER_APP_NAME="quickbooks-search-app"
   CONTAINER_APP_ENV="quickbooks-env"
   IMAGE="ghcr.io/YOUR_USERNAME/quickbooks-online-mcp-server:latest"
   ```

3. **Create resource group:**
   ```bash
   az group create --name $RESOURCE_GROUP --location $LOCATION
   ```

4. **Create Container Apps environment:**
   ```bash
   az containerapp env create \
     --name $CONTAINER_APP_ENV \
     --resource-group $RESOURCE_GROUP \
     --location $LOCATION
   ```

5. **Deploy the container app:**
   ```bash
   az containerapp create \
     --name $CONTAINER_APP_NAME \
     --resource-group $RESOURCE_GROUP \
     --environment $CONTAINER_APP_ENV \
     --image $IMAGE \
     --target-port 3000 \
     --ingress external \
     --min-replicas 1 \
     --max-replicas 3 \
     --cpu 0.5 \
     --memory 1.0Gi \
     --secrets \
       quickbooks-client-id="YOUR_CLIENT_ID" \
       quickbooks-client-secret="YOUR_CLIENT_SECRET" \
       quickbooks-refresh-token="YOUR_REFRESH_TOKEN" \
       quickbooks-realm-id="YOUR_REALM_ID" \
     --env-vars \
       QUICKBOOKS_CLIENT_ID=secretref:quickbooks-client-id \
       QUICKBOOKS_CLIENT_SECRET=secretref:quickbooks-client-secret \
       QUICKBOOKS_REFRESH_TOKEN=secretref:quickbooks-refresh-token \
       QUICKBOOKS_REALM_ID=secretref:quickbooks-realm-id \
       QUICKBOOKS_ENVIRONMENT=sandbox \
       NODE_ENV=production
   ```

6. **Get your app URL:**
   ```bash
   az containerapp show \
     --name $CONTAINER_APP_NAME \
     --resource-group $RESOURCE_GROUP \
     --query properties.configuration.ingress.fqdn \
     -o tsv
   ```

### Updating the Application

**To deploy a new version:**

```bash
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image ghcr.io/YOUR_USERNAME/quickbooks-online-mcp-server:v1.1.0
```

## Managing Secrets

### Viewing Current Secrets

```bash
az containerapp secret list \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP
```

### Updating Secrets

**Update a single secret:**

```bash
az containerapp secret set \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --secrets quickbooks-client-id=NEW_VALUE
```

**Remove a secret:**

```bash
az containerapp secret remove \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --secret-names quickbooks-client-id
```

### Using Azure Key Vault (Recommended for Production)

For production, store secrets in Azure Key Vault:

1. **Create Key Vault:**
   ```bash
   az keyvault create \
     --name quickbooks-kv \
     --resource-group $RESOURCE_GROUP \
     --location $LOCATION
   ```

2. **Add secrets:**
   ```bash
   az keyvault secret set \
     --vault-name quickbooks-kv \
     --name quickbooks-client-id \
     --value "YOUR_CLIENT_ID"
   ```

3. **Reference in Container App:**
   ```bash
   az containerapp secret set \
     --name $CONTAINER_APP_NAME \
     --resource-group $RESOURCE_GROUP \
     --secrets quickbooks-client-id="keyvaultref:https://quickbooks-kv.vault.azure.net/secrets/quickbooks-client-id,identityref:/subscriptions/.../managed-identity"
   ```

## Monitoring and Logging

### View Logs

**Stream live logs:**
```bash
az containerapp logs show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --follow
```

**View recent logs:**
```bash
az containerapp logs show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --tail 100
```

### Health Check

The container includes a built-in health check at `/` that Azure uses to monitor app health.

### Scaling

**Manual scaling:**
```bash
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 2 \
  --max-replicas 5
```

**Auto-scaling based on HTTP requests:**
```bash
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --scale-rule-name http-scaling \
  --scale-rule-type http \
  --scale-rule-http-concurrency 10
```

## Troubleshooting

### Container Won't Start

1. **Check logs:**
   ```bash
   az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --tail 50
   ```

2. **Verify secrets are set:**
   ```bash
   az containerapp secret list --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP
   ```

3. **Check environment variables:**
   ```bash
   az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query properties.template.containers[0].env
   ```

### Image Pull Errors

If using private GHCR:

```bash
# Create registry credentials
az containerapp registry set \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --server ghcr.io \
  --username YOUR_GITHUB_USERNAME \
  --password $GITHUB_TOKEN
```

### Connection Issues

1. **Verify ingress is enabled:**
   ```bash
   az containerapp ingress show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP
   ```

2. **Check if app is running:**
   ```bash
   az containerapp replica list --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP
   ```

### QuickBooks Authentication Errors

1. **Verify credentials in secrets**
2. **Check refresh token hasn't expired**
3. **Ensure redirect URI matches in Intuit Developer Portal**

## Cost Optimization

### Reduce Costs

1. **Scale to zero when not in use:**
   ```bash
   az containerapp update \
     --name $CONTAINER_APP_NAME \
     --resource-group $RESOURCE_GROUP \
     --min-replicas 0
   ```

2. **Reduce resources:**
   ```bash
   az containerapp update \
     --name $CONTAINER_APP_NAME \
     --resource-group $RESOURCE_GROUP \
     --cpu 0.25 \
     --memory 0.5Gi
   ```

3. **Delete when not needed:**
   ```bash
   az containerapp delete --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --yes
   ```

## Security Best Practices

1. **Always use secrets for sensitive data** - Never hardcode credentials
2. **Use Azure Key Vault** for production secrets
3. **Enable HTTPS only** - Container Apps provides this by default
4. **Use managed identities** when possible
5. **Regularly update base images** - Rebuild with latest node:20-alpine
6. **Monitor access logs** - Review who's accessing your app
7. **Restrict ingress** - Set to `internal` if only accessed within Azure

## Next Steps

- Set up custom domain: [Azure Container Apps Custom Domains](https://learn.microsoft.com/en-us/azure/container-apps/custom-domains-certificates)
- Configure authentication: [Azure Container Apps Authentication](https://learn.microsoft.com/en-us/azure/container-apps/authentication)
- Set up monitoring: [Azure Container Apps Monitoring](https://learn.microsoft.com/en-us/azure/container-apps/observability)
