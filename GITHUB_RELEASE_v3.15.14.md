# AutoClaude v3.15.14 - Performance & Stability Fix

## 🚨 CRITICAL FIX: Extension Hanging/Freezing

This release fixes critical performance issues where the extension would hang or freeze when starting, making it completely unusable.

## 🐛 Critical Fixes

### Extension Hanging on Startup
- **Root Cause**: Unlimited TODO/FIXME processing overwhelming the system
- **Issue**: Extension tried to process hundreds/thousands of TODOs at once
- **Solution**: Limited processing to 5 tasks at a time with 30-second timeout
- **Impact**: Extension became unresponsive, UI frozen, commands not working

### Auto-Start Disabled
- **Changed**: Workflow auto-start now defaults to `false`
- **Reason**: Prevents automatic processing of large codebases on startup
- **Result**: Extension starts quickly without hanging

### What Was Broken
- ❌ Extension would freeze on startup with large codebases
- ❌ UI became unresponsive
- ❌ Could not add messages to queue
- ❌ Claude output would stop/freeze
- ❌ Commands would not respond

### What's Fixed
- ✅ Extension starts quickly without hanging
- ✅ UI remains responsive
- ✅ Can add messages to queue normally
- ✅ Claude processes messages properly
- ✅ All commands work without freezing

## 🔧 Technical Changes

### Task Processing Limits
```typescript
// Limit pending work processing
const MAX_TASKS_PER_RUN = 5;
const limitedWork = pendingWork.slice(0, MAX_TASKS_PER_RUN);

// Add timeout to prevent infinite processing
const MAX_PROCESSING_TIME = 30000; // 30 seconds max
if (Date.now() - startTime > MAX_PROCESSING_TIME) {
  log.warn(`Task processing timeout reached, stopping queue processing`);
  break;
}
```

### Configuration Changes
- `autoclaude.workflow.autoStart` now defaults to `false`
- Prevents automatic orchestration system startup

### Files Updated
- **extension.ts**: Disabled auto-start by default
- **UnifiedOrchestrationSystem.ts**: Added processing limits and timeouts

## 📦 Installation

### VS Code Extension
1. Download the `.vsix` file from the assets below
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X)
4. Click on the "..." menu and select "Install from VSIX..."
5. Select the downloaded file

### Testing the Fix
After installation:
1. Extension should start without hanging
2. UI should be immediately responsive
3. You can add messages to the queue
4. Claude processes messages normally
5. No freezing or hanging issues

## 📊 Package Information

- **Version**: 3.15.14
- **Node Version**: ≥18.0.0
- **VS Code Version**: ≥1.74.0
- **Total Commands**: 43 (all working)
- **Performance**: Optimized for large codebases

## 🎉 Stable & Responsive

The extension now handles large codebases gracefully without hanging or freezing. All functionality is preserved while ensuring the UI remains responsive.

---

**Assets:**
- 📦 autoclaude-3.15.14.vsix (VS Code Extension)