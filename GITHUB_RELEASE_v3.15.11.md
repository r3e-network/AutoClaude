# AutoClaude v3.15.11 - Date Object Fix

## 🔧 Fixes 'toISOString is not a function' Error

This release fixes date serialization errors where Date objects might be strings when loaded from storage.

## 🐛 Fixes

### Date Serialization Errors
- **Fixed projectIndexer**: Safe handling of lastUpdated date
- **Fixed taskPersistence**: Safe handling of createdAt, updatedAt, completedAt dates  
- **Fixed contextProvider**: Safe handling of task createdAt date
- **Added type checking**: All date objects now checked before calling toISOString()

### What This Means
- ✅ No more "toISOString is not a function" errors
- ✅ Dates display correctly even when loaded from storage
- ✅ Handles both Date objects and date strings gracefully
- ✅ Extension remains stable when working with persisted data

## 🔧 Technical Changes

### Updated Date Handling
All date serialization now uses safe pattern:
```javascript
date instanceof Date ? date.toISOString() : new Date(date || Date.now()).toISOString()
```

### Files Updated
- **projectIndexer.ts**: lastUpdated date handling
- **taskPersistence.ts**: Task date fields (createdAt, updatedAt, completedAt)
- **contextProvider.ts**: Task createdAt in context generation

## 📦 Installation

### VS Code Extension
1. Download the `.vsix` file from the assets below
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X)
4. Click on the "..." menu and select "Install from VSIX..."
5. Select the downloaded file

### Testing the Fix
After installation:
1. Extension should handle all date operations without errors
2. Project indexing works correctly
3. Task persistence and display works properly
4. No date-related errors in console

## 📊 Package Information

- **Version**: 3.15.11
- **Node Version**: ≥18.0.0
- **VS Code Version**: ≥1.74.0
- **Total Commands**: 43 (all working)
- **Dependencies**: Fully optional with complete graceful degradation

## 🎉 Robust Date Handling

The extension now handles date serialization robustly, whether dates come from memory, storage, or are freshly created.

---

**Assets:**
- 📦 autoclaude-3.15.11.vsix (VS Code Extension)