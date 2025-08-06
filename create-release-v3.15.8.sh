#!/bin/bash

# Exit on error
set -e

VERSION="3.15.8"
FILENAME="autoclaude-3.15.8.vsix"

echo "🚀 Creating GitHub release for v$VERSION..."

# Check if release already exists
if gh release view "v$VERSION" >/dev/null 2>&1; then
  echo "Release v$VERSION already exists, uploading asset..."
  gh release upload "v$VERSION" "$FILENAME" --clobber
else
  echo "Creating new release v$VERSION..."
  
  # Create release notes
  cat > release-notes.md << 'EOF'
## AutoClaude v3.15.8 - Memory System Error Fix

### 🔧 Critical Fix for "Failed to load memory system" Error

This release fixes the remaining memory system loading error that was still occurring in v3.15.7.

### 🐛 Fixes

#### QueenAgent Memory Loading Fix
- **Fixed QueenAgent**: Now properly handles memory system initialization failures
- **Better error handling**: Changed from log.error to log.warn for non-critical failures
- **Proper stub creation**: Creates complete stub when memory system unavailable
- **Synchronous loading**: Reverted to synchronous getMemoryManager for constructor compatibility

#### What This Means
- ✅ No more "Failed to load memory system" errors
- ✅ Extension activates cleanly without sqlite3
- ✅ All 43 commands work properly
- ✅ Clean console output with warnings instead of errors
- ✅ Memory features gracefully disabled when dependencies missing

### 📦 Installation

1. Download the `.vsix` file from the assets below
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X)
4. Click on the "..." menu and select "Install from VSIX..."
5. Select the downloaded file

### 📊 Package Information

- **Version**: 3.15.8
- **Node Version**: ≥18.0.0
- **VS Code Version**: ≥1.74.0
- **Total Commands**: 43 (all working)
- **Dependencies**: Fully optional with complete graceful degradation
EOF
  
  # Create the release
  gh release create "v$VERSION" \
    --title "Release v$VERSION - Memory System Error Fix" \
    --notes-file release-notes.md \
    "$FILENAME"
fi

echo "✅ Release created successfully!"
echo "📦 View at: https://github.com/r3e-network/AutoClaude/releases/tag/v$VERSION"