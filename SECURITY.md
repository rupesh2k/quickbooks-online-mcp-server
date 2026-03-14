# Security Documentation

## 🔒 Credential Management

### How Credentials Are Handled

**Your `.env` file NEVER goes into the Docker image or to Azure.**

Here's the secure flow:

```
┌─────────────────────────────────────────────────┐
│ 1. Local Machine                                │
│    .env file with credentials                   │
│    (NEVER leaves your machine)                  │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 2. azure-deploy.sh reads .env locally           │
│    Extracts credential values                   │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 3. Docker Build                                 │
│    .env excluded by .dockerignore               │
│    ✓ Image contains NO secrets                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 4. Push to GHCR                                 │
│    Public image is safe (no secrets)            │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 5. Azure Container Instance                     │
│    Credentials passed via --environment-variables│
│    Azure securely injects them at runtime       │
└─────────────────────────────────────────────────┘
```

## ✅ Security Verification

### Verify .env is NOT in the image:

```bash
./verify-security.sh
```

This script checks:
- ✓ `.env` file is not in the container
- ✓ `.git` directory is not included
- ✓ No hardcoded secrets in environment variables
- ✓ Image is safe to push publicly

### Manual Verification

```bash
# Build the image
docker build -t quickbooks-online-mcp-server:latest .

# Try to find .env in the image (should fail)
docker run --rm quickbooks-online-mcp-server:latest ls -la /app/.env
# Expected: ls: /app/.env: No such file or directory

# Check environment variables (should only see NODE_ENV)
docker run --rm quickbooks-online-mcp-server:latest env
# Expected: NODE_ENV=production (NO QuickBooks secrets)
```

## 🛡️ Security Features

### 1. .dockerignore Protection
```
.env              ← Your credentials
.git              ← Source control history
node_modules      ← (Rebuilt inside container)
*.md              ← Documentation
```

### 2. Runtime Environment Variables

Credentials are passed to Azure using `--environment-variables`:

```bash
az container create \
    --environment-variables \
        QUICKBOOKS_CLIENT_ID=$QUICKBOOKS_CLIENT_ID \
        QUICKBOOKS_CLIENT_SECRET=$QUICKBOOKS_CLIENT_SECRET \
        # etc...
```

**These are stored securely by Azure and injected at container startup.**

### 3. GitHub Token Security

Your `GITHUB_TOKEN` is:
- Used locally to push to GHCR
- Passed to Azure for pulling the image
- Stored as Azure Container Instances registry credentials
- **NOT baked into the image**

## 🔍 What's Inside the Image?

**Safe to include:**
- ✅ Application source code (TypeScript/JavaScript)
- ✅ package.json and package-lock.json
- ✅ Compiled code (dist/)
- ✅ node_modules (dependencies)
- ✅ public/ directory (HTML/CSS)

**Excluded (sensitive):**
- ❌ .env file
- ❌ .git directory
- ❌ azure-deployment-info.txt
- ❌ Local credentials

## 🚨 What If .env Gets In?

If `.env` somehow gets into the image:

1. **Immediate action:**
   ```bash
   # Delete the image from GHCR
   # Go to: https://github.com/rupesh2k?tab=packages
   # Delete the package

   # Rotate your QuickBooks credentials immediately
   # Get new tokens from QuickBooks Developer Portal
   ```

2. **Prevention:**
   - Run `./verify-security.sh` before deploying
   - Check `.dockerignore` includes `.env`
   - Never use `COPY . .` without proper .dockerignore

## 📋 Security Checklist

Before deploying:

- [ ] `.env` is in `.dockerignore`
- [ ] Run `./verify-security.sh` and confirm all checks pass
- [ ] `.env` is in `.gitignore` (never commit to git)
- [ ] GitHub token has minimal scopes (`read:packages`, `write:packages`)
- [ ] QuickBooks credentials are production-ready
- [ ] Review Azure environment variables before deployment

## 🔐 Best Practices

### Local Development
```bash
# Keep .env local
# Never commit .env to git
# Use different credentials for dev/prod
```

### Azure Environment Variables
- Azure encrypts environment variables at rest
- They're injected at container startup
- Not visible in the public image
- Can be rotated without rebuilding image

### Rotating Credentials

**To update credentials without rebuilding:**

```bash
# 1. Stop the container
./azure-stop.sh

# 2. Update your .env file with new credentials

# 3. Delete the container
source azure-deployment-info.txt
az container delete -g $RESOURCE_GROUP -n $CONTAINER_NAME --yes

# 4. Redeploy (will use new credentials)
./azure-deploy.sh
```

## 📊 Image Inspection Commands

```bash
# List all files in image
docker run --rm quickbooks-online-mcp-server:latest find /app -type f

# Check specific file
docker run --rm quickbooks-online-mcp-server:latest cat /app/.env
# Should fail: cat: /app/.env: No such file or directory

# View environment variables
docker run --rm quickbooks-online-mcp-server:latest env

# Get image size
docker images quickbooks-online-mcp-server:latest
```

## 🆘 If You Suspect a Security Issue

1. **Stop the container immediately:**
   ```bash
   ./azure-stop.sh
   ```

2. **Delete the image from GHCR:**
   - Go to https://github.com/rupesh2k?tab=packages
   - Find the package
   - Delete it

3. **Rotate all credentials:**
   - QuickBooks API keys
   - GitHub token
   - Any other secrets

4. **Investigate:**
   ```bash
   ./verify-security.sh
   ```

5. **Rebuild from scratch:**
   ```bash
   docker build -t quickbooks-online-mcp-server:latest .
   ./verify-security.sh
   ./azure-deploy.sh
   ```

## ✅ Summary

**Your setup is secure because:**
1. ✅ .env excluded by .dockerignore
2. ✅ Credentials passed at runtime by Azure
3. ✅ Image can be public (contains no secrets)
4. ✅ GitHub token has minimal permissions
5. ✅ Verification script confirms security

**Run this before every deployment:**
```bash
./verify-security.sh && ./azure-deploy.sh
```
