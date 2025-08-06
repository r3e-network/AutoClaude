# AutoClaude v3.8.0 Release Notes

## 🎯 AutoClaude Rebranding & Publisher Correction

This release completes the transition from "Claude Autopilot" to "AutoClaude" with proper publisher attribution.

## ✨ What's New

### Publisher & Branding Updates

- **Publisher**: Now correctly set to "R3ENetwork"
- **Package Name**: Renamed from `claude-autopilot` to `autoclaude`
- **Display Name**: Updated to "AutoClaude"
- **Icon**: Updated icon file naming to match new branding

### Technical Improvements

- **Error Handling**: Renamed `ClaudeAutopilotError` to `AutoClaudeError` for consistency
- **Folder Structure**: All references now use `.autoclaude` instead of `.claude-autopilot`
- **Code Quality**: Fixed all naming inconsistencies throughout the codebase
- **Test Suite**: Updated all test files to use new class names

### Bug Fixes

- Fixed import statements that referenced old error class names
- Corrected package.json configuration with proper publisher
- Updated extension icon references
- Cleaned up legacy `.autopilot` directory references

## 🔄 Migration Notes

If you're upgrading from a previous version:

- The extension will now appear as "AutoClaude" in VS Code
- All functionality remains the same - only naming has changed
- Configuration files will migrate automatically to `.autoclaude` folder

## 📦 Technical Details

- **Package**: `autoclaude@3.8.0`
- **Publisher**: R3ENetwork
- **VS Code Compatibility**: ^1.74.0
- **Node.js**: >=18.0.0

## 🏷️ Neo-rs Specialty Branch

A specialized version for Neo blockchain development is available on the `neo-rs` branch:

- Package: `autoclaude-neo-rs@3.8.0-neo-rs`
- Focused on C# to Rust conversion accuracy
- Specialized tooling for Neo-rs development

---

**Full Changelog**: https://github.com/r3e-network/AutoClaude/compare/v3.7.0...v3.8.0
