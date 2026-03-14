# How Credentials Flow (Visual Guide)

## 🔒 The Short Answer

**Your `.env` file NEVER goes into the Docker image. It stays on your machine.**

Credentials are passed to Azure as **runtime environment variables** (encrypted and secure).

---

## 📊 Visual Flow

```
Step 1: Your Local Machine
┌─────────────────────────────┐
│  .env file                  │
│  ├─ QUICKBOOKS_CLIENT_ID    │
│  ├─ QUICKBOOKS_SECRET       │
│  └─ QUICKBOOKS_TOKENS       │
└─────────────────────────────┘
              │
              │ azure-deploy.sh reads this
              ▼
┌─────────────────────────────┐
│  azure-deploy.sh            │
│  ├─ Loads .env locally      │
│  ├─ Extracts values         │
│  └─ Stores in variables     │
└─────────────────────────────┘
              │
              ├──────────────────┬──────────────────┐
              ▼                  ▼                  ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
    │ Docker Build    │  │ Push to GHCR    │  │ Deploy to Azure  │
    │                 │  │                 │  │                  │
    │ ❌ NO .env      │  │ ❌ NO .env      │  │ ✅ Env vars      │
    │ ✅ App code     │  │ ✅ App code     │  │    injected      │
    └─────────────────┘  └─────────────────┘  └──────────────────┘
```

---

## 🛡️ What Protects Your Credentials?

### Layer 1: .dockerignore
```
# .dockerignore
.env              ← Prevents .env from being copied
```

### Layer 2: Dockerfile
```dockerfile
COPY . .          ← Copies files EXCEPT those in .dockerignore
```

### Layer 3: Azure Environment Variables
```bash
az container create \
    --environment-variables \
        QUICKBOOKS_CLIENT_ID=$QUICKBOOKS_CLIENT_ID
        # Passed securely at runtime ↑
```

---

## 🧪 Prove It Yourself

### Test 1: Check if .env is in the image
```bash
docker build -t quickbooks-online-mcp-server:latest .
docker run --rm quickbooks-online-mcp-server:latest cat /app/.env
```

**Expected result:**
```
cat: /app/.env: No such file or directory
```
✅ This is GOOD! It means .env is NOT in the image.

### Test 2: Check environment variables in the image
```bash
docker run --rm quickbooks-online-mcp-server:latest env
```

**Expected result:**
```
PATH=/usr/local/sbin:/usr/local/bin:...
NODE_ENV=production
```
✅ No QUICKBOOKS_* variables! They're injected by Azure at runtime, not baked in.

### Test 3: Run the security verification script
```bash
./verify-security.sh
```

**Expected output:**
```
✓ .env file NOT in container (GOOD)
✓ .git directory NOT in container (GOOD)
✓ No hardcoded secrets in image
```

---

## 🔄 Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    YOUR LOCAL MACHINE                        │
│                                                              │
│  1. You have .env file                                       │
│     ├─ QUICKBOOKS_CLIENT_ID=abc123                          │
│     ├─ QUICKBOOKS_CLIENT_SECRET=secret456                   │
│     └─ ... other credentials ...                            │
│                                                              │
│  2. Run: ./azure-deploy.sh                                  │
│     ├─ Script reads .env (stays local!)                     │
│     ├─ Stores values in shell variables                     │
│     └─ .env NEVER uploaded anywhere                         │
│                                                              │
│  3. Docker build                                            │
│     ├─ Copies app code                                      │
│     ├─ .dockerignore blocks .env                            │
│     └─ Result: Image with NO secrets ✓                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ docker push
                              ▼
┌──────────────────────────────────────────────────────────────┐
│              GITHUB CONTAINER REGISTRY (GHCR)                │
│                                                              │
│  Public image: ghcr.io/rupesh2k/quickbooks-online-...       │
│  ├─ Contains: App code, dependencies                        │
│  └─ Does NOT contain: .env, credentials, secrets            │
│                                                              │
│  ✅ Safe to be public                                        │
│  ✅ Anyone can inspect - no secrets                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ az container create
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                   AZURE CONTAINER INSTANCE                   │
│                                                              │
│  Container is created with:                                  │
│  ├─ Image from GHCR (no secrets)                            │
│  └─ Environment variables (passed via --environment-variables)│
│                                                              │
│  Azure injects at runtime:                                   │
│  ├─ QUICKBOOKS_CLIENT_ID=abc123                             │
│  ├─ QUICKBOOKS_CLIENT_SECRET=secret456                      │
│  └─ ... other credentials ...                               │
│                                                              │
│  ✅ App reads from process.env.*                             │
│  ✅ Credentials encrypted by Azure                           │
│  ✅ Never visible in public image                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## ❓ Common Questions

### Q: Is the image on GHCR public?
**A:** Yes, but it contains NO secrets! The image is safe to be public because credentials are never baked in.

### Q: Where are credentials stored?
**A:** In Azure's secure environment variables system. They're encrypted at rest and injected at runtime.

### Q: What if I need to rotate credentials?
**A:** Update your `.env` file locally, delete the container, and redeploy. No need to rebuild the image!

### Q: Can someone extract credentials from the running container?
**A:** Only if they have access to your Azure account. Secure your Azure account with MFA and proper RBAC.

### Q: What about the GitHub token?
**A:** Same principle - passed to Azure securely, never in the image.

---

## ✅ Security Checklist

Before deploying, verify:

```bash
# 1. Check .dockerignore includes .env
cat .dockerignore | grep .env
# Should see: .env

# 2. Build and verify
docker build -t quickbooks-online-mcp-server:latest .
./verify-security.sh
# Should see all checks pass

# 3. Deploy with confidence
./azure-deploy.sh
```

---

## 🎯 Summary

| Item | Where It Lives | Secure? |
|------|---------------|---------|
| `.env` file | Your local machine only | ✅ Yes - never leaves |
| Docker image | GHCR (public) | ✅ Yes - no secrets |
| Credentials | Azure environment variables | ✅ Yes - encrypted |
| Running container | Azure Container Instance | ✅ Yes - isolated |

**Bottom line:** Your credentials are handled securely at every step! 🔒
