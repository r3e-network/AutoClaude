#!/bin/bash

# AutoClaude Release Preparation Script
# Usage: ./scripts/prepare-release.sh <version>
# Example: ./scripts/prepare-release.sh 3.15.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if version is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Version number required${NC}"
    echo "Usage: $0 <version>"
    echo "Example: $0 3.15.0"
    exit 1
fi

VERSION=$1
BRANCH_NAME="release/v${VERSION}"
RELEASE_NOTES_FILE="GITHUB_RELEASE_v${VERSION}.md"

echo -e "${GREEN}🚀 Preparing release for AutoClaude v${VERSION}${NC}"

# Check if we're in the repository root
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must run from repository root${NC}"
    exit 1
fi

# Check if on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}Warning: Not on main branch (current: $CURRENT_BRANCH)${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update package.json version
echo -e "${GREEN}📝 Updating package.json version to ${VERSION}${NC}"
npm version $VERSION --no-git-tag-version --allow-same-version

# Create release notes template if it doesn't exist
if [ ! -f "$RELEASE_NOTES_FILE" ]; then
    echo -e "${GREEN}📄 Creating release notes template: ${RELEASE_NOTES_FILE}${NC}"
    cat > "$RELEASE_NOTES_FILE" << EOF
# AutoClaude v${VERSION}

## 🎉 Release Highlights

<!-- Brief summary of the most important changes -->

## ✨ New Features

<!-- List new features with bullet points -->
- Feature 1
- Feature 2

## 🐛 Bug Fixes

<!-- List bug fixes with bullet points -->
- Fixed issue with...
- Resolved problem where...

## 💫 Improvements

<!-- List improvements and enhancements -->
- Improved performance of...
- Enhanced user experience for...

## 🔄 Changes

<!-- List any breaking changes or important updates -->
- Changed behavior of...
- Updated dependency...

## 📦 Installation

### VS Code Extension
1. Download the \`.vsix\` file from the assets below
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X)
4. Click on the "..." menu and select "Install from VSIX..."
5. Select the downloaded file

### Terminal Binary
1. Download the appropriate binary for your platform:
   - Windows: \`autoclaude-win32-x64.zip\`
   - macOS (Intel): \`autoclaude-darwin-x64.tar.gz\`
   - macOS (Apple Silicon): \`autoclaude-darwin-arm64.tar.gz\`
   - Linux: \`autoclaude-linux-x64.tar.gz\`
2. Extract the archive
3. Make it executable (Unix/macOS): \`chmod +x autoclaude\`
4. Run: \`./autoclaude\`

## 📊 Package Information

- **Version**: ${VERSION}
- **Node Version**: ≥18.0.0
- **VS Code Version**: ≥1.74.0

## 🔍 All Commands

The extension provides 43+ commands accessible through the Command Palette (Ctrl/Cmd + Shift + P).

### Core Commands
- \`autoclaude.start\` - Start Claude Assistant
- \`autoclaude.stop\` - Stop Claude
- \`autoclaude.addMessage\` - Ask Claude Something

### Script & Automation
- \`autoclaude.runScriptChecks\` - Run Quality Checks
- \`autoclaude.runScriptLoop\` - Auto-Fix Issues
- \`autoclaude.autoComplete\` - Auto-Complete Current Task

<!-- Add more commands as needed -->

## 📝 What's Changed

**Full Changelog**: https://github.com/r3e-network/AutoClaude/compare/v${PREV_VERSION:-3.14.1}...v${VERSION}

## 🙏 Contributors

Thank you to all contributors who made this release possible!

---

**Assets:**
- 📦 autoclaude-${VERSION}.vsix (VS Code Extension)
- 🖥️ Terminal binaries for Windows, macOS, and Linux
EOF
    echo -e "${YELLOW}Please edit ${RELEASE_NOTES_FILE} with actual release notes${NC}"
fi

# Commit changes
echo -e "${GREEN}💾 Committing version update${NC}"
git add package.json package-lock.json "$RELEASE_NOTES_FILE" 2>/dev/null || true
git commit -m "chore: prepare release v${VERSION}" || echo "No changes to commit"

# Create release branch
echo -e "${GREEN}🌿 Creating release branch: ${BRANCH_NAME}${NC}"
git checkout -b "$BRANCH_NAME" 2>/dev/null || {
    echo -e "${YELLOW}Branch already exists, switching to it${NC}"
    git checkout "$BRANCH_NAME"
}

# Push branch to trigger workflow
echo -e "${GREEN}📤 Pushing release branch to GitHub${NC}"
git push -u origin "$BRANCH_NAME"

echo -e "${GREEN}✅ Release preparation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Edit ${RELEASE_NOTES_FILE} if needed"
echo "2. Commit any changes to the release branch"
echo "3. The GitHub Actions workflow will automatically:"
echo "   - Build the VS Code extension"
echo "   - Build terminal binaries for all platforms"
echo "   - Create a GitHub release with all assets"
echo ""
echo "Monitor the workflow at:"
echo "https://github.com/r3e-network/AutoClaude/actions"
echo ""
echo "After successful release:"
echo "1. Merge release branch to main: git checkout main && git merge ${BRANCH_NAME}"
echo "2. Delete release branch: git push origin --delete ${BRANCH_NAME}"