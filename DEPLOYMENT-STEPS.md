# Quick Deployment Guide

## Step-by-Step Instructions to Deploy to Azure

### Prerequisites Checklist
- [ ] Docker Desktop installed and running
- [ ] Azure CLI installed (`az --version` to check)
- [ ] Azure account with active subscription
- [ ] GitHub account (for free container registry)
- [ ] GitHub Personal Access Token with `write:packages` scope
- [ ] `.env` file with QuickBooks credentials configured

### Step 1: Test Locally (Optional but Recommended)

Start Docker Desktop, then run:

```bash
./docker-test-local.sh
```

This will:
- Build the Docker image
- Run it locally on port 3000
- Verify everything works

Test at: http://localhost:3000

When satisfied, stop the local test:
```bash
docker stop quickbooks-test
docker rm quickbooks-test
```

### Step 2: Setup GitHub Token

Create a GitHub token:
1. Go to https://github.com/settings/tokens/new
2. Name: "QuickBooks GHCR"
3. Select: `write:packages` and `read:packages`
4. Generate and copy the token

Export it:
```bash
export GITHUB_TOKEN=your_token_here
```

### Step 3: Deploy to Azure

```bash
./azure-deploy.sh
```

**What happens:**
1. Creates Azure Resource Group
2. Builds your Docker image locally
3. Pushes to GitHub Container Registry (FREE!)
4. Deploys to Azure Container Instances
5. Configures all environment variables securely
6. Provides your public URL

**Time:** ~5-10 minutes
**Cost:** ~$0.01-0.02/hour when running (container storage is FREE!)

### Step 4: Demo Time!

Access your application at the URL provided (saved in `azure-deployment-info.txt`)

Example: `http://quickbooks-demo-username.eastus.azurecontainer.io:3000`

### Step 5: Stop Container (Save Money)

After your demo:

```bash
./azure-stop.sh
```

**Compute charges stop immediately!**

### Step 6: Restart for Next Demo

Before your next demo:

```bash
./azure-start.sh
```

Container starts in 10-30 seconds.

---

## Cost Breakdown

### Running Costs
- **0.5 vCPU + 0.5GB RAM**: ~$0.01-0.02/hour
- **8 hours of demos per month**: ~$0.08-0.16/month
- **Container Storage (GHCR)**: FREE! ✨

### When Stopped
- **Compute**: $0
- **Storage**: $0 (FREE with GHCR)

### Total Monthly Cost
- **Active use (8 hours)**: ~$0.08-0.16/month 🎉
- **If always running**: ~$7-15/month

**Using GitHub Container Registry saves you ~$5/month compared to Azure Container Registry!**

**Recommendation**: Stop when not demoing to keep costs under $1/month!

---

## Quick Reference Commands

### Check if running
```bash
source azure-deployment-info.txt
az container show -g $RESOURCE_GROUP -n $CONTAINER_NAME --query instanceView.state
```

### View logs
```bash
source azure-deployment-info.txt
az container logs -g $RESOURCE_GROUP -n $CONTAINER_NAME --follow
```

### Restart container
```bash
source azure-deployment-info.txt
az container restart -g $RESOURCE_GROUP -n $CONTAINER_NAME
```

### Delete everything
```bash
source azure-deployment-info.txt
az group delete -n $RESOURCE_GROUP --yes --no-wait
```

---

## Troubleshooting

### "Docker daemon not running"
- Start Docker Desktop
- Wait for it to fully start
- Try again

### "az command not found"
- Install Azure CLI: https://docs.microsoft.com/cli/azure/install-azure-cli
- macOS: `brew install azure-cli`
- Or use the installer

### "Not logged in to Azure"
- Run: `az login`
- Follow the browser authentication

### Container won't start
```bash
source azure-deployment-info.txt
az container logs -g $RESOURCE_GROUP -n $CONTAINER_NAME
```

Check for environment variable issues or QuickBooks authentication problems.

### Need to update environment variables
1. Stop container: `./azure-stop.sh`
2. Update `.env` file
3. Delete the container:
   ```bash
   source azure-deployment-info.txt
   az container delete -g $RESOURCE_GROUP -n $CONTAINER_NAME --yes
   ```
4. Redeploy: `./azure-deploy.sh`

---

## Architecture

```
┌─────────────────────────────────────────┐
│         Azure Container Instance        │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  QuickBooks Search Server         │ │
│  │  (Node.js + Express)              │ │
│  │  Port 3000                        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Resources:                             │
│  - 0.5 vCPU                            │
│  - 0.5 GB RAM                          │
│  - Public IP                           │
│  - DNS Name                            │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  GitHub Container Registry (GHCR)       │
│  (FREE Docker image storage)            │
│  ghcr.io/rupesh2k/quickbooks-online-... │
└─────────────────────────────────────────┘
```

---

## Next Steps After Deployment

1. **Test the Search**: Open the URL and search for a customer
2. **Bookmark the URL**: You'll need it for demos
3. **Stop the Container**: Save costs when not demoing
4. **Share the URL**: It's public, safe to share for demos

## Security Notes

- Environment variables are injected securely
- `.env` file never leaves your machine
- Container registry requires authentication
- All credentials stored in Azure's secure environment
