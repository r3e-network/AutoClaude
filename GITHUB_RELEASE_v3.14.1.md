# v3.14.1 - Critical Fix: Command Not Found

## 🚨 Critical Bug Fix Release

This release fixes the critical "command 'autoclaude.start' not found" error that prevented the extension from working properly.

## ✅ What's Fixed

### Primary Fix
- **RESOLVED: "command not found" errors for all extension commands**
  - Fixed module export issue that prevented VS Code from loading the extension
  - Added proper CommonJS exports through new index.ts wrapper
  - All 43 commands now properly registered and functional

### Technical Details
- Created `src/index.ts` wrapper to ensure proper module.exports
- Updated esbuild configuration to use index.ts as entry point  
- Fixed activation events to use `onStartupFinished` (no circular dependencies)
- Added comprehensive test scripts for verification

## 📦 Installation

### Option 1: Download and Install VSIX
1. Download `autoclaude-3.14.1.vsix` from this release
2. In VS Code: `Ctrl/Cmd + Shift + P` → "Extensions: Install from VSIX..."
3. Select the downloaded file
4. Restart VS Code

### Option 2: Command Line
```bash
code --install-extension autoclaude-3.14.1.vsix
```

## ✅ Verification

After installation:
1. Restart VS Code
2. Press `Ctrl/Cmd + Shift + P`
3. Type "Claude" - all 43 commands should appear
4. Select "Claude: 🚀 Start Claude Assistant"
5. Extension activates without errors!

## 📊 Package Information

- **Size**: 716 KB
- **SHA256**: `704ee3ba9b34509136bffb9610622390bc89cace6168beb0bca4d905361ed2cb`
- **Node Version**: ≥18.0.0
- **VS Code Version**: ≥1.74.0

## 🔍 All 43 Commands Verified

✅ Core Commands
- `autoclaude.start` - Start Claude Assistant
- `autoclaude.stop` - Stop Claude
- `autoclaude.addMessage` - Ask Claude Something

✅ Script & Automation
- `autoclaude.runScriptChecks` - Run Quality Checks
- `autoclaude.runScriptLoop` - Auto-Fix Issues
- `autoclaude.autoComplete` - Auto-Complete Current Task
- `autoclaude.workflowWizard` - Claude Workflow Wizard

✅ Agent Management
- `autoclaude.startParallelAgents` - Start Parallel Agents
- `autoclaude.runSubAgents` - Run Claude AI Agents
- `autoclaude.startHiveMind` - Start Hive-Mind Mode
- `autoclaude.startSwarm` - Start Swarm Mode

✅ Configuration & Tools
- `autoclaude.validateConfiguration` - Validate Configuration
- `autoclaude.exportQueue` - Export Queue
- `autoclaude.showStatistics` - Show Queue Statistics
- `autoclaude.viewMemoryInsights` - View Memory & Learning Insights

...and 29 more commands all working perfectly!

## 🛠 Testing

Two new test scripts added to verify all commands:
- `test-all-commands.js` - Verifies all 43 command registrations
- `verify-extension-flow.js` - Checks complete loading flow

Run tests:
```bash
node test-all-commands.js
node verify-extension-flow.js
```

## 📝 What's Changed

**Full Changelog**: https://github.com/r3e-network/AutoClaude/compare/v3.14.0...v3.14.1

## 🙏 Thank You

Thank you for your patience with this critical fix. The extension should now work flawlessly with all commands accessible through the Command Palette.

---

**Assets:**
- 📦 autoclaude-3.14.1.vsix (716 KB)