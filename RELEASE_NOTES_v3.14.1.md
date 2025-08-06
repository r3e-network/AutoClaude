# Release Notes - v3.14.1

## 🚨 Critical Fix Release

### Fixed
- **Critical: "command 'autoclaude.start' not found" error resolved**
  - Fixed module export issue that prevented extension activation
  - Properly exports activate/deactivate functions for VS Code
  - Ensures CommonJS compatibility in bundled output

### Technical Details
- Created index.ts wrapper to handle proper exports
- Updated esbuild configuration to use new entry point
- Fixed activation events to prevent circular dependency
- Ensures module.exports is correctly set in compiled code

## 🔧 Changes Made

### Module Export Fix
- Added src/index.ts as main entry point
- Wraps extension.ts exports for proper CommonJS output
- Handles both ES module and CommonJS export patterns
- Fixed build process to maintain function names

### Build Configuration
- Updated esbuild.js to use index.ts as entry point
- Added keepNames option to preserve function identifiers
- Configured mainFields for proper module resolution

## ✅ Verification

Test the fix:
```bash
# Install the extension
code --install-extension autoclaude-3.14.1.vsix

# Restart VS Code
# Press Ctrl/Cmd + Shift + P
# Type "Claude" - all commands should now appear
# Select "Claude: 🚀 Start Claude Assistant"
# Extension should activate without errors
```

## 📦 Installation

```bash
# VS Code Marketplace
ext install R3ENetwork.autoclaude

# Manual Installation
code --install-extension autoclaude-3.14.1.vsix
```

## 🐛 Known Issues

This release specifically addresses the critical "command not found" error. If you continue to experience issues:
1. Restart VS Code after installation
2. Check the Extension Host log for errors
3. Report issues at https://github.com/r3e-network/AutoClaude/issues

---

**Full Changelog**: [v3.14.0...v3.14.1](https://github.com/r3e-network/AutoClaude/compare/v3.14.0...v3.14.1)