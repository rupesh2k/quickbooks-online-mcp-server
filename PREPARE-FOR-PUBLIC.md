# Preparing Repository for Public Release

This guide walks through preparing this repository for public release on GitHub.

## ✅ Completed Tasks

1. **Removed hardcoded secrets** from `deploy-to-azure.sh`
   - All secrets now use environment variables
   - Added validation checks for required variables

2. **Verified .gitignore** excludes sensitive files
   - `.env` files
   - `.qb-tokens.json`
   - `azure-deployment-info.txt`

## 🔧 Tasks to Complete

### 1. Fix Git History

Run the provided script to fix git author and remotes:

```bash
./fix-git-history.sh
```

This script will:
- Fix git remotes (origin → rupesh2k, upstream → intuit)
- Change author from `rjain2-godaddy` to `rupesh2k`
- Remove Claude co-author lines

**Important:** This rewrites git history. Make sure you have a backup!

### 2. Review Changes

After running the script, review the changes:

```bash
# Check commit history
git log --oneline --all --graph

# Verify author changes
git log --format="%H %an <%ae> %s" | head -10

# Check remotes
git remote -v
```

### 3. Force Push Changes

Once you're satisfied with the changes:

```bash
# Push all branches (rewrites history on GitHub)
git push origin --all --force

# Push tags
git push origin --tags --force
```

### 4. Update README

Update the README.md to reflect:
- This is a fork of https://github.com/intuit/quickbooks-online-mcp-server
- New features added:
  - Unified server (auth + search + AI assistant in one container)
  - Azure Container Apps deployment
  - AI Assistant with multi-provider support (OpenAI/Anthropic)
  - Customer search with transactions
  - Automatic token management

### 5. Check for Sensitive Data

Before making public, do a final check:

```bash
# Search for any remaining secrets
grep -r "sk-proj-" . --exclude-dir=node_modules
grep -r "RT1-" . --exclude-dir=node_modules
grep -r "ABDnhhDHZBxBN2i5vXwnRnQQrELZllZ0iHDrMUmDluyHpvVm8Q" . --exclude-dir=node_modules
grep -r "rjain2@godaddy.com" . --exclude-dir=node_modules
```

### 6. Clean Up Local Environment

Remove any local sensitive files:

```bash
# These files should already be gitignored
rm .qb-tokens.json
rm azure-deployment-info.txt

# Verify nothing sensitive will be committed
git status
```

### 7. Add Proper Attribution

Update README.md to include:

```markdown
## Upstream

This is a fork of [QuickBooks Online MCP Server](https://github.com/intuit/quickbooks-online-mcp-server) by Intuit.

To sync with upstream:

\`\`\`bash
git fetch upstream
git merge upstream/main
\`\`\`
```

### 8. Make Repository Public

1. Go to GitHub repository settings
2. Scroll to "Danger Zone"
3. Click "Change visibility"
4. Select "Make public"
5. Confirm by typing the repository name

## 📋 Checklist Before Going Public

- [ ] Git history rewritten (author fixed, Claude co-author removed)
- [ ] Git remotes configured correctly
- [ ] All secrets removed from code
- [ ] .env.example updated with proper examples
- [ ] README updated with fork attribution
- [ ] README updated with new features
- [ ] Deployment scripts use environment variables only
- [ ] No hardcoded credentials in any files
- [ ] LICENSE file present (check if needs updating)
- [ ] Final grep search for sensitive data shows nothing

## 🎉 After Going Public

1. Update the repository description on GitHub
2. Add topics/tags: `quickbooks`, `mcp-server`, `azure`, `ai-assistant`, `openai`
3. Consider enabling Discussions for community support
4. Set up branch protection rules if needed
5. Add a CONTRIBUTING.md if you want contributions

## ⚠️ Important Notes

- **Backup first!** Git history rewrite is irreversible
- **Team coordination**: If others are working on this, coordinate the force push
- **Existing clones**: Anyone with existing clones will need to re-clone or reset hard
- **No going back**: Once you make a secret public (even if removed later), consider it compromised

## 🔄 Syncing with Upstream (After Public)

To keep your fork up to date with Intuit's original:

```bash
# Fetch upstream changes
git fetch upstream

# Merge upstream main into your main
git checkout main
git merge upstream/main

# Push to your fork
git push origin main
```
