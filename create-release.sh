#!/bin/bash

# AutoClaude v3.20.0 Release Script
# This script creates a GitHub release with all artifacts

set -e

# Configuration
VERSION="3.20.1"
REPO="r3e-network/AutoClaude"
BRANCH="release/v3.16.0"  # Current branch

echo "🚀 AutoClaude Release Script v$VERSION"
echo "======================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Install it with: brew install gh"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Not in AutoClaude directory"
    exit 1
fi

# Verify version in package.json
PACKAGE_VERSION=$(node -pe "require('./package.json').version")
if [ "$PACKAGE_VERSION" != "$VERSION" ]; then
    echo "❌ Version mismatch: package.json has $PACKAGE_VERSION, expected $VERSION"
    exit 1
fi

echo "1. Building release package..."
echo "-------------------------------"
npm run compile:production
npm run package

if [ ! -f "autoclaude-$VERSION.vsix" ]; then
    echo "❌ Failed to create VSIX package"
    exit 1
fi

echo "✅ Package built: autoclaude-$VERSION.vsix"
echo ""

echo "2. Creating release artifacts..."
echo "---------------------------------"

# Create a release directory
mkdir -p release-artifacts

# Copy main artifacts
cp autoclaude-$VERSION.vsix release-artifacts/
cp CHANGELOG.md release-artifacts/
cp RELEASE_NOTES.md release-artifacts/
cp README.md release-artifacts/
cp LICENSE release-artifacts/

# Create installation instructions
cat > release-artifacts/INSTALLATION.md << 'EOF'
# Installation Instructions

## From VS Code Marketplace (Recommended)

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "AutoClaude"
4. Click Install

## From VSIX File

1. Download `autoclaude-3.20.0.vsix` from this release
2. Open VS Code
3. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
4. Click the "..." menu → "Install from VSIX..."
5. Select the downloaded file

## Command Line Installation

```bash
# Download the VSIX file, then:
code --install-extension autoclaude-3.20.0.vsix
```

## Requirements

- VS Code 1.74.0 or higher
- Node.js 18.0.0 or higher
- Claude CLI installed (the extension will guide you if not installed)

## Post-Installation

1. Open a project in VS Code
2. Run command: `AutoClaude: Quick Start Guide`
3. Follow the setup wizard

## Troubleshooting

If you encounter issues:
1. Check Claude CLI: `AutoClaude: Check Claude CLI Status`
2. Check for updates: `AutoClaude: Check for Claude Updates`
3. View logs: Open Output panel → Select "AutoClaude"
EOF

echo "✅ Release artifacts prepared"
echo ""

echo "3. Committing changes..."
echo "------------------------"

# Stage files
git add -A
git status

echo ""
read -p "Commit these changes? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git commit -m "chore(release): prepare v$VERSION

- Automatic Claude update detection and installation
- Enhanced stability and recovery systems
- Apple Silicon support improvements
- Production-ready validation
- Optimized bundle size (1.8MB)

See CHANGELOG.md for full details"
    
    echo "✅ Changes committed"
else
    echo "⏭️  Skipping commit"
fi

echo ""
echo "4. Creating Git tag..."
echo "----------------------"

if git tag | grep -q "^v$VERSION$"; then
    echo "⚠️  Tag v$VERSION already exists"
    read -p "Delete and recreate tag? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d "v$VERSION"
        git push origin --delete "v$VERSION" 2>/dev/null || true
    else
        echo "⏭️  Skipping tag creation"
    fi
fi

git tag -a "v$VERSION" -m "Release v$VERSION

🚀 Automatic Claude Updates & Enhanced Stability

Highlights:
- Automatic Claude version detection and updates
- Comprehensive stability and recovery systems
- Apple Silicon Homebrew support
- 96% bundle size reduction
- Production-ready validation

Full changelog: https://github.com/$REPO/blob/main/CHANGELOG.md"

echo "✅ Tag v$VERSION created"
echo ""

echo "5. Pushing to GitHub..."
echo "-----------------------"

read -p "Push branch and tag to GitHub? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin "$BRANCH"
    git push origin "v$VERSION"
    echo "✅ Pushed to GitHub"
else
    echo "⏭️  Skipping push"
fi

echo ""
echo "6. Creating GitHub Release..."
echo "-----------------------------"

read -p "Create GitHub release? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Create release using gh CLI
    gh release create "v$VERSION" \
        --repo "$REPO" \
        --title "v$VERSION - Automatic Updates & Enhanced Stability" \
        --notes-file RELEASE_NOTES.md \
        --target "$BRANCH" \
        autoclaude-$VERSION.vsix \
        release-artifacts/INSTALLATION.md
    
    echo "✅ GitHub release created!"
    echo ""
    echo "📦 Release URL: https://github.com/$REPO/releases/tag/v$VERSION"
else
    echo "⏭️  Skipping GitHub release"
fi

echo ""
echo "7. Cleanup..."
echo "-------------"

rm -rf release-artifacts
echo "✅ Cleaned up temporary files"

echo ""
echo "======================================="
echo "🎉 Release v$VERSION Complete!"
echo "======================================="
echo ""
echo "Next steps:"
echo "1. Visit: https://github.com/$REPO/releases/tag/v$VERSION"
echo "2. Verify the release looks correct"
echo "3. Publish to VS Code Marketplace if needed"
echo "4. Announce the release!"
echo ""
echo "To publish to VS Code Marketplace:"
echo "  npx @vscode/vsce publish"