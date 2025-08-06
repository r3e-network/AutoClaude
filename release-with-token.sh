#!/bin/bash

# AutoClaude v3.14.1 Release Script with Token

echo "==================================="
echo "  AutoClaude v3.14.1 Release Tool  "
echo "==================================="
echo ""

# Check if token is provided
if [ -z "$1" ]; then
    echo "❌ Error: GitHub token not provided"
    echo ""
    echo "Usage: ./release-with-token.sh YOUR_GITHUB_TOKEN"
    echo ""
    echo "To get a token:"
    echo "1. Go to: https://github.com/settings/tokens/new"
    echo "2. Name: AutoClaude Release"
    echo "3. Scopes: Select 'repo' (all)"
    echo "4. Click 'Generate token'"
    echo "5. Copy the token and run:"
    echo "   ./release-with-token.sh ghp_YOUR_TOKEN_HERE"
    exit 1
fi

# Set the token
export GH_TOKEN="$1"

# Disable proxy
unset http_proxy
unset https_proxy
unset HTTP_PROXY
unset HTTPS_PROXY

echo "✅ Token set"
echo "✅ Proxy disabled"
echo ""

# Check if files exist
if [ ! -f "autoclaude-3.14.1.vsix" ]; then
    echo "❌ Error: autoclaude-3.14.1.vsix not found"
    exit 1
fi

if [ ! -f "GITHUB_RELEASE_v3.14.1.md" ]; then
    echo "❌ Error: GITHUB_RELEASE_v3.14.1.md not found"
    exit 1
fi

echo "📦 Creating GitHub release..."
echo ""

# Create the release
gh release create v3.14.1 \
  --title "v3.14.1 - Critical Fix: Command Not Found" \
  --notes-file GITHUB_RELEASE_v3.14.1.md \
  --latest \
  autoclaude-3.14.1.vsix

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Release created successfully!"
    echo ""
    echo "🎉 View your release at:"
    echo "   https://github.com/r3e-network/AutoClaude/releases/tag/v3.14.1"
    echo ""
    echo "📦 Download link:"
    echo "   https://github.com/r3e-network/AutoClaude/releases/download/v3.14.1/autoclaude-3.14.1.vsix"
else
    echo ""
    echo "❌ Failed to create release"
    echo ""
    echo "Possible issues:"
    echo "- Token doesn't have 'repo' scope"
    echo "- Network/proxy issues"
    echo "- Release already exists"
fi

# Clear token from environment
unset GH_TOKEN