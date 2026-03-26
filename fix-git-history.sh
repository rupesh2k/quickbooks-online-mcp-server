#!/bin/bash

###############################################################################
# Git History Fix Script
# This script:
# 1. Fixes git remotes (origin -> rupesh2k, upstream -> intuit)
# 2. Rewrites commit author from rjain2-godaddy to rupesh2k
# 3. Removes Claude co-author lines from commits
###############################################################################

set -e

echo "=========================================="
echo "Git History Fix Script"
echo "=========================================="
echo ""

# Ask for user confirmation
echo "This script will:"
echo "  1. Fix git remotes (origin -> rupesh2k, upstream -> intuit)"
echo "  2. Rewrite commit author: rjain2-godaddy -> rupesh2k"
echo "  3. Remove Claude co-author lines"
echo ""
echo "WARNING: This will rewrite git history!"
echo "Make sure you have a backup before proceeding."
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

# Get new email for rupesh2k
echo ""
read -p "Enter email for rupesh2k (e.g., rupesh2k@gmail.com): " NEW_EMAIL

if [ -z "$NEW_EMAIL" ]; then
    echo "Error: Email is required"
    exit 1
fi

echo ""
echo "Step 1: Fixing git remotes..."
echo "----------------------------"

# Rename current remotes
git remote rename origin upstream 2>/dev/null || echo "  upstream already exists"
git remote rename fork origin 2>/dev/null || echo "  origin already exists"

# Verify remotes
echo ""
echo "Current remotes:"
git remote -v
echo ""

echo "Step 2: Rewriting commit history..."
echo "----------------------------"
echo "This may take a few moments..."
echo ""

# Create filter script
cat > /tmp/git-filter-script.sh << 'FILTER_EOF'
#!/bin/bash

# Get the commit message
COMMIT_MSG=$(git log --format=%B -n 1 HEAD)

# Remove Claude co-author line
CLEAN_MSG=$(echo "$COMMIT_MSG" | sed '/Co-Authored-By: Claude Sonnet/d')

# Update the commit message
echo "$CLEAN_MSG"
FILTER_EOF

chmod +x /tmp/git-filter-script.sh

# Rewrite history
git filter-branch --force --env-filter '
OLD_EMAIL="rjain2@godaddy.com"
CORRECT_NAME="rupesh2k"
CORRECT_EMAIL="'"$NEW_EMAIL"'"

if [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL" ]
then
    export GIT_COMMITTER_NAME="$CORRECT_NAME"
    export GIT_COMMITTER_EMAIL="$CORRECT_EMAIL"
fi
if [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL" ]
then
    export GIT_AUTHOR_NAME="$CORRECT_NAME"
    export GIT_AUTHOR_EMAIL="$CORRECT_EMAIL"
fi
' --msg-filter '/tmp/git-filter-script.sh' --tag-name-filter cat -- --branches --tags

# Clean up
rm /tmp/git-filter-script.sh
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "=========================================="
echo "✓ Git history rewrite complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Review changes: git log --oneline --all"
echo "  2. Force push to remote: git push origin --all --force"
echo "  3. Force push tags: git push origin --tags --force"
echo ""
echo "⚠️  WARNING: Force push will rewrite history on GitHub!"
echo "    Make sure all team members know about this change."
echo ""
