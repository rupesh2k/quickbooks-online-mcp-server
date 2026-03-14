#!/bin/bash

###############################################################################
# Push Docker images to GitHub Container Registry (GHCR)
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Push to GitHub Container Registry ===${NC}"
echo ""

# Get GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${YELLOW}Please enter your GitHub Personal Access Token:${NC}"
    echo "(Token should have write:packages, read:packages permissions)"
    echo ""
    read -sp "Token: " GITHUB_TOKEN
    echo ""
    echo ""
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}Error: No token provided${NC}"
    exit 1
fi

# Login to GHCR
echo -e "${GREEN}[1/3] Logging in to GHCR...${NC}"
echo "$GITHUB_TOKEN" | docker login ghcr.io -u rupesh2k --password-stdin

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Login failed${NC}"
    echo ""
    echo "Please check:"
    echo "  1. Your token is valid"
    echo "  2. Token has write:packages permission"
    echo "  3. Token has read:packages permission"
    exit 1
fi

echo -e "${GREEN}✓ Login successful!${NC}"
echo ""

# Push latest tag
echo -e "${GREEN}[2/3] Pushing latest tag...${NC}"
docker push ghcr.io/rupesh2k/quickbooks-online-mcp-server:latest

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to push latest tag${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Latest tag pushed successfully!${NC}"
echo ""

# Push version tag
echo -e "${GREEN}[3/3] Pushing v1.0.0 tag...${NC}"
docker push ghcr.io/rupesh2k/quickbooks-online-mcp-server:v1.0.0

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to push v1.0.0 tag${NC}"
    exit 1
fi

echo -e "${GREEN}✓ v1.0.0 tag pushed successfully!${NC}"
echo ""

# Success message
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All images pushed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Your images are now available at:"
echo "  📦 ghcr.io/rupesh2k/quickbooks-online-mcp-server:latest"
echo "  📦 ghcr.io/rupesh2k/quickbooks-online-mcp-server:v1.0.0"
echo ""
echo "View your packages at:"
echo "  🔗 https://github.com/rupesh2k?tab=packages"
echo ""
echo "To pull the image:"
echo "  docker pull ghcr.io/rupesh2k/quickbooks-online-mcp-server:latest"
echo ""
echo "To make the package public (optional):"
echo "  1. Go to https://github.com/rupesh2k?tab=packages"
echo "  2. Click on 'quickbooks-online-mcp-server'"
echo "  3. Click 'Package settings'"
echo "  4. Scroll to 'Danger Zone'"
echo "  5. Click 'Change visibility' → 'Public'"
echo ""
