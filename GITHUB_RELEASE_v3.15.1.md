# AutoClaude v3.15.1 - Critical Command Registration Fix

## 🚨 Critical Fix Release

This release fixes a critical issue that prevented the VS Code extension from working properly.

## 🐛 Bug Fixes

- **Fixed critical command registration error**: Resolved "command 'autoclaude.start' not found" error that prevented the extension from loading
- **Fixed ES module/CommonJS conflict**: Updated src/index.ts to properly export both ES6 and CommonJS formats for VS Code compatibility
- **Updated all command descriptions**: Changed from "Claude: xxx" to "AutoClaude: xxx" for consistent branding (35 commands)
- **Updated agent farm commands**: Changed from "Claude Agent Farm" to "AutoClaude Agent Farm" category (8 commands)

## 💫 Improvements

- **Enhanced command registration**: Improved module export compatibility to ensure all 43 commands work correctly
- **Better branding consistency**: All commands now use "AutoClaude" prefix for clearer identification
- **Added command verification**: Created test script to validate all commands are properly registered

## 🔄 Technical Details

The main issue was in `src/index.ts` where the module exports were not compatible with VS Code's CommonJS requirements:

**Before (broken):**
```typescript
import { activate as activateExtension, deactivate as deactivateExtension } from './extension';
export const activate = activateExtension;
export const deactivate = deactivateExtension;
```

**After (fixed):**
```typescript
import { activate as activateExtension, deactivate as deactivateExtension } from './extension';
export const activate = activateExtension;
export const deactivate = deactivateExtension;

// Also export as CommonJS for compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    activate: activateExtension,
    deactivate: deactivateExtension
  };
}
```

## 📦 Installation

### VS Code Extension
1. Download the `.vsix` file from the assets below
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X)
4. Click on the "..." menu and select "Install from VSIX..."
5. Select the downloaded file

### NPM Package
```bash
npm install -g autoclaude@3.15.1
```

## 📊 Package Information

- **Version**: 3.15.1
- **Node Version**: ≥18.0.0
- **VS Code Version**: ≥1.74.0
- **Total Commands**: 43 (all verified working)

## 🔍 Affected Commands

All 43 commands are now working correctly with proper "AutoClaude" branding:
- 35 commands in "AutoClaude" category
- 8 commands in "AutoClaude Agent Farm" category

## 📝 What's Changed

**Full Changelog**: https://github.com/r3e-network/AutoClaude/compare/v3.15.0...v3.15.1

## ⚠️ Important Note

If you experienced the "command not found" error in v3.14.1 or v3.15.0, this release resolves that issue. Please update immediately for a working extension.

---

**Assets:**
- 📦 autoclaude-3.15.1.vsix (VS Code Extension)