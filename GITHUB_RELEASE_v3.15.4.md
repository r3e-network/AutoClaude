# AutoClaude v3.15.4 - Enhanced Debugging & Activation Fix

## 🔍 Debug Release

This release adds extensive debugging to identify and fix the command registration issue.

## 🐛 Fixes & Improvements

### Enhanced Activation Process
- **Added debug logging**: Console logs and VS Code notifications throughout activation
- **Return API object**: Activate function now returns an API object (VS Code convention)
- **Fixed module exports**: Cleaned up duplicate export statements from esbuild
- **Better error handling**: More detailed error messages if activation fails

### Debug Features Added
1. **Activation start notification**: Shows when activate function is called
2. **Command registration notification**: Shows when commands are being registered
3. **Success confirmation**: Shows when all commands are registered successfully
4. **API return value**: Returns version and command shortcuts

## 🔧 Technical Changes

### Post-Build Script Improvements
- Removes conditional exports from esbuild (`0 && ...`)
- Removes duplicate export statements
- Ensures clean CommonJS exports

### Activation Function
```javascript
// Now returns an API object
return {
  version: context.extension.packageJSON.version,
  commands: {
    start: () => vscode.commands.executeCommand('autoclaude.start'),
    stop: () => vscode.commands.executeCommand('autoclaude.stop'),
    addMessage: () => vscode.commands.executeCommand('autoclaude.addMessage'),
  }
};
```

## 📋 Debug Messages

When the extension loads, you should see:
1. "AutoClaude: Activating extension..."
2. "AutoClaude: Registering commands..."
3. "AutoClaude: Commands registered successfully"
4. "AutoClaude: Extension activated! All commands ready."

If you don't see these messages, the extension is not activating properly.

## 📦 Installation

### VS Code Extension
1. Download the `.vsix` file from the assets below
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X)
4. Click on the "..." menu and select "Install from VSIX..."
5. Select the downloaded file

### Troubleshooting
1. Check the Output panel (View → Output → Extension Host) for error messages
2. Check Developer Tools console (Help → Toggle Developer Tools) for [AutoClaude] logs
3. Try reloading VS Code window (Ctrl/Cmd+R in VS Code)
4. Ensure no other extensions are conflicting

## 📊 Package Information

- **Version**: 3.15.4
- **Node Version**: ≥18.0.0
- **VS Code Version**: ≥1.74.0
- **Total Commands**: 43
- **Build**: Unminified with debug logging

---

**Assets:**
- 📦 autoclaude-3.15.4.vsix (VS Code Extension)