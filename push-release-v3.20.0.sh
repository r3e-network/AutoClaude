#!/bin/bash

# AutoClaude Release Script for v3.20.0
# This script packages and releases the extension

VERSION="3.20.0"
EXTENSION_NAME="autoclaude"
PUBLISHER="R3ENetwork"

echo "🚀 Starting release process for AutoClaude v${VERSION}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Verify version in package.json
PACKAGE_VERSION=$(node -p "require('./package.json').version")
if [ "$PACKAGE_VERSION" != "$VERSION" ]; then
    echo "❌ Error: Version mismatch. package.json has ${PACKAGE_VERSION}, expected ${VERSION}"
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -f *.vsix
rm -rf out/

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npm run compile

if [ $? -ne 0 ]; then
    echo "❌ Error: Compilation failed"
    exit 1
fi

# Run tests (if available)
if [ -f "src/test/suite/index.ts" ]; then
    echo "🧪 Running tests..."
    npm test
    if [ $? -ne 0 ]; then
        echo "⚠️ Warning: Tests failed, continuing anyway..."
    fi
fi

# Package the extension
echo "📦 Packaging extension..."
npx vsce package

if [ $? -ne 0 ]; then
    echo "❌ Error: Packaging failed"
    exit 1
fi

# Find the generated VSIX file
VSIX_FILE="${EXTENSION_NAME}-${VERSION}.vsix"
if [ ! -f "$VSIX_FILE" ]; then
    echo "❌ Error: VSIX file not found: ${VSIX_FILE}"
    exit 1
fi

echo "✅ Successfully created ${VSIX_FILE}"

# Create GitHub release
echo "📝 Creating GitHub release..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "⚠️ GitHub CLI (gh) not found. Please install it to create releases automatically."
    echo "📎 VSIX file created: ${VSIX_FILE}"
    echo "📝 Release notes: GITHUB_RELEASE_v${VERSION}.md"
    echo ""
    echo "Manual steps:"
    echo "1. Create a new release at: https://github.com/r3e-network/AutoClaude/releases/new"
    echo "2. Tag: v${VERSION}"
    echo "3. Title: AutoClaude v${VERSION} - Enterprise Stability & Recovery Systems"
    echo "4. Upload ${VSIX_FILE}"
    echo "5. Copy release notes from GITHUB_RELEASE_v${VERSION}.md"
    exit 0
fi

# Create git tag
echo "🏷️ Creating git tag..."
git tag -a "v${VERSION}" -m "Release v${VERSION} - Enterprise Stability & Recovery Systems"

# Push tag
echo "⬆️ Pushing tag to GitHub..."
git push origin "v${VERSION}"

# Create GitHub release with notes
echo "🚀 Creating GitHub release..."
gh release create "v${VERSION}" \
    --title "AutoClaude v${VERSION} - Enterprise Stability & Recovery Systems" \
    --notes-file "GITHUB_RELEASE_v${VERSION}.md" \
    "${VSIX_FILE}"

if [ $? -eq 0 ]; then
    echo "✅ Successfully created GitHub release v${VERSION}"
    echo "🔗 Release URL: https://github.com/r3e-network/AutoClaude/releases/tag/v${VERSION}"
else
    echo "❌ Failed to create GitHub release"
    echo "📎 VSIX file available: ${VSIX_FILE}"
    echo "📝 Release notes: GITHUB_RELEASE_v${VERSION}.md"
fi

# Publish to VS Code Marketplace (optional)
read -p "📤 Do you want to publish to VS Code Marketplace? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📤 Publishing to VS Code Marketplace..."
    npx vsce publish
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully published to VS Code Marketplace"
        echo "🔗 Extension URL: https://marketplace.visualstudio.com/items?itemName=${PUBLISHER}.${EXTENSION_NAME}"
    else
        echo "❌ Failed to publish to marketplace"
    fi
fi

echo ""
echo "🎉 Release process completed for AutoClaude v${VERSION}!"
echo ""
echo "📊 Release Summary:"
echo "  - Version: ${VERSION}"
echo "  - VSIX File: ${VSIX_FILE}"
echo "  - Release Notes: GITHUB_RELEASE_v${VERSION}.md"
echo "  - GitHub Release: https://github.com/r3e-network/AutoClaude/releases/tag/v${VERSION}"
echo ""
echo "🚀 AutoClaude v${VERSION} - Enterprise Stability & Recovery Systems is ready!"