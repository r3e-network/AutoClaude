# AutoClaude v3.15.2 - Complete Command Registration Fix

## 🚨 Critical Fix Release

This release completely resolves the command registration issues that prevented the VS Code extension from working.

## 🐛 Bug Fixes

- **Fixed command registration completely**: Removed problematic src/index.ts file that was causing module export conflicts
- **Corrected build configuration**: Changed entry point directly to src/extension.ts instead of using index.ts wrapper
- **Fixed all command categories**: Updated remaining 35 "Claude" categories to "AutoClaude" that were missed in v3.15.1
- **Added post-build script**: Ensures proper CommonJS exports are always present for VS Code compatibility
- **Verified all 43 commands**: Created comprehensive test to verify all commands are properly registered

## 💫 Improvements

- **Simplified build process**: Removed unnecessary index.ts wrapper file
- **Direct extension building**: Build directly from extension.ts for cleaner output
- **Better export handling**: Post-build script ensures exports are always correct
- **Complete branding update**: All commands now consistently use "AutoClaude" branding

## 🔄 Technical Details

### The Root Cause
The src/index.ts file was attempting to re-export from extension.ts, but this created module resolution issues:
- esbuild was building index.ts → extension.js
- But the exports weren't properly set up for VS Code's CommonJS requirements

### The Solution
1. Changed esbuild entry point directly to src/extension.ts
2. Removed the problematic src/index.ts file entirely
3. Added post-build.js script to ensure proper CommonJS exports
4. Fixed all remaining "Claude" category references to "AutoClaude"

## ✅ Verification

All 43 commands have been tested and verified working:
- 35 commands in "AutoClaude" category
- 8 commands in "AutoClaude Agent Farm" category
- All command IDs match between package.json and extension.ts

## 📦 Installation

### VS Code Extension
1. Download the `.vsix` file from the assets below
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X)
4. Click on the "..." menu and select "Install from VSIX..."
5. Select the downloaded file

### NPM Package
```bash
npm install -g autoclaude@3.15.2
```

## 📊 Package Information

- **Version**: 3.15.2
- **Node Version**: ≥18.0.0
- **VS Code Version**: ≥1.74.0
- **Total Commands**: 43 (all verified working)

## ⚠️ Important Note

This version completely fixes the "command 'autoclaude.start' not found" error. If you had issues with v3.15.0 or v3.15.1, please update to this version immediately.

---

**Assets:**
- 📦 autoclaude-3.15.2.vsix (VS Code Extension)