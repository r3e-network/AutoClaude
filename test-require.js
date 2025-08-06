// Test if extension can be required
console.log('Testing if extension can be required...\n');

try {
  // Mock vscode module for testing
  global.vscode = {
    ExtensionContext: class {},
    window: {
      showInformationMessage: () => {},
      showErrorMessage: () => {},
      showWarningMessage: () => {},
    },
    commands: {
      registerCommand: () => {},
    },
    workspace: {
      getConfiguration: () => ({
        get: () => {}
      }),
      workspaceFolders: []
    },
    env: {},
    Uri: {
      file: () => {},
      parse: () => {}
    },
    ViewColumn: {},
    StatusBarAlignment: {},
    DiagnosticSeverity: {},
    ProgressLocation: {},
    ExtensionMode: {},
  };
  
  const ext = require('./out/extension.js');
  
  console.log('✅ Extension loaded successfully');
  console.log('✅ typeof activate:', typeof ext.activate);
  console.log('✅ typeof deactivate:', typeof ext.deactivate);
  
  if (typeof ext.activate === 'function' && typeof ext.deactivate === 'function') {
    console.log('\n✅ Extension exports are correct!');
  } else {
    console.log('\n❌ Extension exports are NOT functions!');
  }
} catch (error) {
  console.error('❌ Failed to load extension:', error.message);
  console.error('\nStack trace:', error.stack);
}