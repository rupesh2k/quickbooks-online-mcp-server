# Quick Start Guide - Azure Deployment with GHCR

## 🚀 Deploy in 5 Minutes

### 1. Get GitHub Token
```bash
# Create token at: https://github.com/settings/tokens/new
# Scopes needed: write:packages, read:packages
export GITHUB_TOKEN=your_token_here
```

### 2. Verify Security (Optional but Recommended)
```bash
# Build and verify .env is NOT in the image
docker build -t quickbooks-online-mcp-server:latest .
./verify-security.sh
```

### 3. Deploy
```bash
./azure-deploy.sh
```

### 4. Done! 🎉
Visit the URL provided to see your app running.

**Security Note**: Your `.env` file never leaves your machine. Credentials are passed securely to Azure at runtime.

---

## 💰 Cost Summary
- **Running**: ~$0.01-0.02/hour
- **Stopped**: $0/hour
- **Storage**: FREE (GHCR)
- **8 hrs/month demos**: ~$0.10/month

---

## 🎮 Controls

### Stop (save money)
```bash
./azure-stop.sh
```

### Start (for demo)
```bash
./azure-start.sh
```

### Delete everything
```bash
source azure-deployment-info.txt
az group delete -n $RESOURCE_GROUP --yes
```

---

## 📋 Prerequisites
- Docker Desktop (running)
- Azure CLI (`brew install azure-cli`)
- GitHub token with `write:packages` scope
- `.env` file with QuickBooks credentials

---

## 🔧 Troubleshooting

**Docker not running?**
- Start Docker Desktop

**Azure login needed?**
```bash
az login
```

**GitHub token not set?**
```bash
export GITHUB_TOKEN=your_token_here
```

**View logs**
```bash
source azure-deployment-info.txt
az container logs -g $RESOURCE_GROUP -n $CONTAINER_NAME --follow
```

---

## 📦 What Gets Created

1. **Azure Resource Group**: `quickbooks-demo-rg`
2. **Container Instance**: `quickbooks-search` (0.5 vCPU, 0.5GB RAM)
3. **GHCR Image**: `ghcr.io/rupesh2k/quickbooks-online-mcp-server:latest`
4. **Public URL**: `http://quickbooks-demo-*.eastus.azurecontainer.io:3000`

---

## 🎯 Demo Workflow

**Before demo:**
```bash
./azure-start.sh
# Wait 30 seconds
# Open the URL
```

**After demo:**
```bash
./azure-stop.sh
```

**That's it!** You only pay for the 30 minutes you used it.

---

## 🆘 Need Help?

See detailed guides:
- `DEPLOYMENT-STEPS.md` - Full step-by-step guide
- `AZURE-DEPLOYMENT.md` - Complete documentation
