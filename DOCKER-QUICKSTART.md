# Docker Quick Start Guide

Quick reference for deploying the QuickBooks Search Application with Docker and Azure.

## Prerequisites Checklist

- [ ] Docker installed and running
- [ ] GitHub account with this repository
- [ ] Azure account with active subscription
- [ ] QuickBooks Developer credentials

## 1. Local Docker Testing (5 minutes)

### Step 1: Copy environment template
```bash
cp .env.example .env
```

### Step 2: Edit .env with your credentials
```bash
# Edit .env file with your QuickBooks credentials
nano .env
```

### Step 3: Build and run
```bash
# Build the Docker image
docker build -t quickbooks-search-app .

# Run the container
docker run -p 3000:3000 --env-file .env quickbooks-search-app
```

### Step 4: Test
Open http://localhost:3000 in your browser.

## 2. Push to GitHub Container Registry (5 minutes)

### Step 1: Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes: `write:packages`, `read:packages`, `delete:packages`
4. Generate and copy the token

### Step 2: Login to GHCR
```bash
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### Step 3: Tag and push
```bash
# Tag the image (replace YOUR_GITHUB_USERNAME)
docker tag quickbooks-search-app ghcr.io/YOUR_GITHUB_USERNAME/quickbooks-online-mcp-server:latest

# Push to GHCR
docker push ghcr.io/YOUR_GITHUB_USERNAME/quickbooks-online-mcp-server:latest
```

## 3. Automated Builds with GitHub Actions (2 minutes)

GitHub Actions will automatically build and push on every commit to main!

### Step 1: Enable GitHub Actions
Just push your code to main branch - the workflow is already configured!

```bash
git add .
git commit -m "feat: add Docker deployment"
git push origin main
```

### Step 2: Watch the build
Go to your repository → Actions tab → Watch the build

### Step 3: Make package public (optional)
1. Go to https://github.com/YOUR_USERNAME?tab=packages
2. Click your package → Package settings
3. Change visibility → Public

## 4. Deploy to Azure Container Apps (10 minutes)

### Option A: Automated Script (Easiest)

```bash
# Set your image (update YOUR_GITHUB_USERNAME)
export CONTAINER_IMAGE="ghcr.io/YOUR_GITHUB_USERNAME/quickbooks-online-mcp-server:latest"

# Set your credentials
export QUICKBOOKS_CLIENT_ID="your_client_id"
export QUICKBOOKS_CLIENT_SECRET="your_client_secret"
export QUICKBOOKS_REFRESH_TOKEN="your_refresh_token"
export QUICKBOOKS_REALM_ID="your_realm_id"
export QUICKBOOKS_ENVIRONMENT="sandbox"

# Deploy!
./deploy-azure-container.sh
```

The script will output your application URL when complete!

### Option B: Manual Azure CLI

```bash
# Login
az login

# Set variables
RESOURCE_GROUP="quickbooks-rg"
LOCATION="eastus"
APP_NAME="quickbooks-app"
IMAGE="ghcr.io/YOUR_USERNAME/quickbooks-online-mcp-server:latest"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create environment
az containerapp env create \
  --name quickbooks-env \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Deploy app
az containerapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment quickbooks-env \
  --image $IMAGE \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --secrets \
    quickbooks-client-id="YOUR_CLIENT_ID" \
    quickbooks-client-secret="YOUR_SECRET" \
    quickbooks-refresh-token="YOUR_TOKEN" \
    quickbooks-realm-id="YOUR_REALM_ID" \
  --env-vars \
    QUICKBOOKS_CLIENT_ID=secretref:quickbooks-client-id \
    QUICKBOOKS_CLIENT_SECRET=secretref:quickbooks-client-secret \
    QUICKBOOKS_REFRESH_TOKEN=secretref:quickbooks-refresh-token \
    QUICKBOOKS_REALM_ID=secretref:quickbooks-realm-id \
    QUICKBOOKS_ENVIRONMENT=sandbox

# Get your URL
az containerapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv
```

## 5. Update and Redeploy

### Update image in Azure
```bash
az containerapp update \
  --name quickbooks-app \
  --resource-group quickbooks-rg \
  --image ghcr.io/YOUR_USERNAME/quickbooks-online-mcp-server:latest
```

### View logs
```bash
az containerapp logs show \
  --name quickbooks-app \
  --resource-group quickbooks-rg \
  --follow
```

## Common Commands

```bash
# Build Docker image
docker build -t quickbooks-search-app .

# Run locally
docker run -p 3000:3000 --env-file .env quickbooks-search-app

# Check running containers
docker ps

# View logs
docker logs CONTAINER_ID

# Stop container
docker stop CONTAINER_ID

# Push to GHCR
docker push ghcr.io/YOUR_USERNAME/quickbooks-online-mcp-server:latest

# Azure: View app status
az containerapp show --name APP_NAME --resource-group RESOURCE_GROUP

# Azure: Stream logs
az containerapp logs show --name APP_NAME --resource-group RESOURCE_GROUP --follow

# Azure: Update secrets
az containerapp secret set --name APP_NAME --resource-group RESOURCE_GROUP --secrets key=value
```

## Troubleshooting

### Docker build fails
- Ensure Docker daemon is running
- Check you have enough disk space
- Try `docker system prune` to clean up

### Can't push to GHCR
- Verify GitHub token has `write:packages` scope
- Ensure you're logged in: `docker login ghcr.io`
- Check package name matches your username

### Azure deployment fails
- Verify Azure CLI is logged in: `az account show`
- Check resource group exists
- Ensure image name is correct
- Verify all required secrets are provided

### Application won't start
- Check logs: `az containerapp logs show ...`
- Verify environment variables are set
- Ensure QuickBooks credentials are valid
- Check if refresh token has expired

### Can't access the application
- Verify ingress is set to `external`
- Check if container is running
- Look at health check status
- Review firewall/network settings

## Need Help?

- Docker Documentation: See [DOCKER-DEPLOYMENT.md](./DOCKER-DEPLOYMENT.md)
- Application Setup: See [README.md](./README.md)
- Azure Container Apps Docs: https://learn.microsoft.com/en-us/azure/container-apps/
- QuickBooks API Docs: https://developer.intuit.com/

## Security Notes

- Never commit `.env` file to git
- Always use secrets in Azure (not environment variables for sensitive data)
- Use Azure Key Vault for production deployments
- Regularly rotate QuickBooks refresh tokens
- Monitor access logs for suspicious activity
