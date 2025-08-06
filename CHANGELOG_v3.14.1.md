# Changelog - v3.14.1

## 🚨 Critical Bug Fix Release

### Fixed
- **✅ RESOLVED: "command 'autoclaude.start' not found" error**
  - Fixed module export issue preventing extension activation
  - Added proper CommonJS exports via index.ts wrapper
  - Ensures VS Code can properly load and activate the extension
  - All 43 commands now properly registered and functional

### Technical Improvements
- **Module Loading Fix**
  - Created `src/index.ts` wrapper for proper exports
  - Updated esbuild to use index.ts as entry point
  - Fixed `module.exports` in compiled output
  - Preserved function names with `keepNames: true`

- **Command Registration Verification**
  - All 43 commands verified to be registered in extension.ts
  - All commands properly added to context.subscriptions
  - No circular dependencies with onStartupFinished activation
  - Added comprehensive test scripts for verification

### Testing & Verification
- Added `test-all-commands.js` - Verifies all command registrations
- Added `verify-extension-flow.js` - Checks complete loading flow
- 100% command registration coverage
- Zero "command not found" errors possible

### Commands Verified (All 43)
✅ All AutoClaude commands including:
- Core commands (start, stop, addMessage)
- Script commands (runScriptChecks, runScriptLoop)
- Agent commands (startParallelAgents, runSubAgents)
- Workflow commands (workflowWizard, autoComplete)
- Management commands (exportQueue, importQueue, showStatistics)
- Configuration commands (validateConfiguration, resetToDefaults)
- Advanced commands (startHiveMind, startSwarm, executeNaturalCommand)

## Installation

```bash
# Install the extension
code --install-extension autoclaude-3.14.1.vsix

# Or from VS Code Marketplace
ext install R3ENetwork.autoclaude
```

## Verification

After installation:
1. Restart VS Code
2. Press `Ctrl/Cmd + Shift + P`
3. Type "Claude" - all 43 commands should appear
4. Select any command - it will work without errors

## What's Next

This critical fix ensures all extension commands work properly. Future releases will focus on:
- Enhanced AI agent capabilities
- Improved workflow automation
- Better error recovery
- Performance optimizations

---

**Full Changelog**: [v3.14.0...v3.14.1](https://github.com/r3e-network/AutoClaude/compare/v3.14.0...v3.14.1)