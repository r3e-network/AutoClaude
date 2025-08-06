# Release Notes - v3.13.1

## 🐛 Critical Fix

### Command Registration Issue Fixed
- **Fixed: "command 'autoclaude.start' not found" error**
- Changed activation event from `onCommand:autoclaude.start` to `onStartupFinished`
- This prevents circular dependency where extension needs to be activated to register the command that activates it

### Build Improvements
- Added `keepNames: true` to esbuild configuration to preserve function names
- Ensures proper export of `activate` and `deactivate` functions
- Prevents minification from breaking extension exports

## 🔧 Technical Details

### What was wrong?
The extension was configured to activate only when `autoclaude.start` command was invoked, but the command couldn't be registered until the extension was activated - creating a circular dependency.

### The fix:
- Extension now activates after VS Code startup is finished
- All commands are registered immediately when extension activates
- Commands are available as soon as VS Code is ready

## 📦 Installation

```bash
# VS Code Marketplace
ext install R3ENetwork.autoclaude

# Manual Installation
code --install-extension autoclaude-3.13.1.vsix
```

## ✅ Verification

After installing, you should be able to:
1. Open Command Palette (Ctrl/Cmd + Shift + P)
2. Type "Claude" 
3. See all AutoClaude commands
4. Run "Claude: 🚀 Start Claude Assistant" without errors

---

**Full Changelog**: [v3.13.0...v3.13.1](https://github.com/r3e-network/AutoClaude/compare/v3.13.0...v3.13.1)