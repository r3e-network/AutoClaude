# AutoClaude v3.15.0

## 🎉 Release Highlights

This release introduces automated release workflows, multi-platform binary support, and enhanced GitHub Actions integration for seamless deployment.

## ✨ New Features

- **Automated Release Workflow**: New GitHub Actions workflow that automatically builds and releases when creating `release/v*` branches
- **Multi-Platform Terminal Binaries**: Build and distribute terminal binaries for Windows, macOS (Intel & ARM), and Linux
- **Release Preparation Script**: New `prepare-release.sh` script for one-command releases
- **Enhanced Release Documentation**: Comprehensive release process documentation

## 🐛 Bug Fixes

- Fixed command registration issues from v3.14.1
- Resolved module export problems preventing VS Code from loading the extension
- Fixed activation event circular dependencies

## 💫 Improvements

- Improved build process with automated version management
- Enhanced release notes integration from markdown files
- Better asset management with automatic uploads to GitHub releases
- Streamlined release workflow reducing manual steps

## 🔄 Changes

<!-- List any breaking changes or important updates -->
- Changed behavior of...
- Updated dependency...

## 📦 Installation

### VS Code Extension
1. Download the `.vsix` file from the assets below
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X)
4. Click on the "..." menu and select "Install from VSIX..."
5. Select the downloaded file

### Terminal Binary
1. Download the appropriate binary for your platform:
   - Windows: `autoclaude-win32-x64.zip`
   - macOS (Intel): `autoclaude-darwin-x64.tar.gz`
   - macOS (Apple Silicon): `autoclaude-darwin-arm64.tar.gz`
   - Linux: `autoclaude-linux-x64.tar.gz`
2. Extract the archive
3. Make it executable (Unix/macOS): `chmod +x autoclaude`
4. Run: `./autoclaude`

## 📊 Package Information

- **Version**: 3.15.0
- **Node Version**: ≥18.0.0
- **VS Code Version**: ≥1.74.0

## 🔍 All Commands

The extension provides 43+ commands accessible through the Command Palette (Ctrl/Cmd + Shift + P).

### Core Commands
- `autoclaude.start` - Start Claude Assistant
- `autoclaude.stop` - Stop Claude
- `autoclaude.addMessage` - Ask Claude Something

### Script & Automation
- `autoclaude.runScriptChecks` - Run Quality Checks
- `autoclaude.runScriptLoop` - Auto-Fix Issues
- `autoclaude.autoComplete` - Auto-Complete Current Task

<!-- Add more commands as needed -->

## 📝 What's Changed

**Full Changelog**: https://github.com/r3e-network/AutoClaude/compare/v3.14.1...v3.15.0

## 🙏 Contributors

Thank you to all contributors who made this release possible!

---

**Assets:**
- 📦 autoclaude-3.15.0.vsix (VS Code Extension)
- 🖥️ Terminal binaries for Windows, macOS, and Linux
