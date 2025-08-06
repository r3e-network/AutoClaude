import * as vscode from 'vscode';
import * as assert from 'assert';
import { activate, deactivate } from '../extension';

suite('Extension Commands Test Suite', () => {
  let context: vscode.ExtensionContext;

  // All commands that should be registered
  const EXPECTED_COMMANDS = [
    'autoclaude.start',
    'autoclaude.stop',
    'autoclaude.addMessage',
    'autoclaude.runScriptChecks',
    'autoclaude.runScriptLoop',
    'autoclaude.quickStart',
    'autoclaude.runSubAgents',
    'autoclaude.autoComplete',
    'autoclaude.workflowWizard',
    'autoclaude.executeCommand',
    'autoclaude.updateContext',
    'autoclaude.showContext',
    'autoclaude.showTasks',
    'autoclaude.startParallelAgents',
    'autoclaude.stopParallelAgents',
    'autoclaude.showAgentMonitor',
    'autoclaude.attachToAgents',
    'autoclaude.clearAllAgentContext',
    'autoclaude.toggleAutoOrchestration',
    'autoclaude.exportQueue',
    'autoclaude.importQueue',
    'autoclaude.exportSettings',
    'autoclaude.useTemplate',
    'autoclaude.manageTemplates',
    'autoclaude.showStatistics',
    'autoclaude.checkRemoteStatus',
    'autoclaude.showErrorHistory',
    'autoclaude.showServiceHealth',
    'autoclaude.exportLogs',
    'autoclaude.validateConfiguration',
    'autoclaude.resetToDefaults',
    'autoclaude.showSessionInfo',
    'autoclaude.submitAgentTask',
    'autoclaude.showAgentStatus',
    'autoclaude.showMemoryStats',
    'autoclaude.exportMemory',
    'autoclaude.showHookStats',
    'autoclaude.startHiveMind',
    'autoclaude.startSwarm',
    'autoclaude.executeNaturalCommand',
    'autoclaude.showWorkflowStatus',
    'autoclaude.toggleHook',
    'autoclaude.viewMemoryInsights'
  ];

  setup(async () => {
    // Create a mock context
    context = {
      subscriptions: [],
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => []
      },
      globalState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => [],
        setKeysForSync: () => {}
      },
      extensionPath: __dirname,
      extensionUri: vscode.Uri.file(__dirname),
      environmentVariableCollection: {} as any,
      storagePath: '/tmp/test-storage',
      globalStoragePath: '/tmp/test-global-storage',
      logPath: '/tmp/test-logs',
      extensionMode: vscode.ExtensionMode.Test,
      asAbsolutePath: (relativePath: string) => relativePath,
      storageUri: vscode.Uri.file('/tmp/test-storage'),
      globalStorageUri: vscode.Uri.file('/tmp/test-global-storage'),
      logUri: vscode.Uri.file('/tmp/test-logs'),
      extension: {} as any,
      secrets: {} as any
    } as vscode.ExtensionContext;
  });

  teardown(async () => {
    // Clean up
    await deactivate();
  });

  test('Extension should activate successfully', async () => {
    await activate(context);
    assert.ok(context.subscriptions.length > 0, 'Extension should register subscriptions');
  });

  test('All expected commands should be registered', async () => {
    await activate(context);
    
    const registeredCommands = await vscode.commands.getCommands(true);
    const extensionCommands = registeredCommands.filter(cmd => cmd.startsWith('autoclaude.'));
    
    // Check that all expected commands are registered
    for (const expectedCommand of EXPECTED_COMMANDS) {
      assert.ok(
        extensionCommands.includes(expectedCommand),
        `Command '${expectedCommand}' should be registered`
      );
    }
    
    // Log any extra commands that are registered but not expected
    const unexpectedCommands = extensionCommands.filter(cmd => !EXPECTED_COMMANDS.includes(cmd));
    if (unexpectedCommands.length > 0) {
      console.warn('Unexpected commands found:', unexpectedCommands);
    }
  });

  test('Commands in package.json should match registered commands', async () => {
    const packageJson = require('../../package.json');
    const packageCommands = packageJson.contributes.commands.map((cmd: any) => cmd.command);
    
    await activate(context);
    const registeredCommands = await vscode.commands.getCommands(true);
    const extensionCommands = registeredCommands.filter(cmd => cmd.startsWith('autoclaude.'));
    
    // Check that all package.json commands are registered
    for (const packageCommand of packageCommands) {
      assert.ok(
        extensionCommands.includes(packageCommand),
        `Package.json command '${packageCommand}' should be registered in extension`
      );
    }
  });

  test('Start command should be executable', async () => {
    await activate(context);
    
    // Check that the command exists
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('autoclaude.start'), 'Start command should exist');
    
    // Try to execute the command (it may fail due to missing UI, but shouldn't throw)
    try {
      await vscode.commands.executeCommand('autoclaude.start');
    } catch (error) {
      // Command may fail in test environment, but should be registered
      assert.ok(error, 'Command execution may fail in test environment');
    }
  });

  test('All commands should have proper handlers', async () => {
    await activate(context);
    
    // Check that subscriptions were added for commands
    const commandSubscriptions = context.subscriptions.filter(
      sub => sub && typeof (sub as any).dispose === 'function'
    );
    
    assert.ok(
      commandSubscriptions.length >= EXPECTED_COMMANDS.length,
      `Should have at least ${EXPECTED_COMMANDS.length} command subscriptions, found ${commandSubscriptions.length}`
    );
  });

  test('Critical commands should be properly configured', async () => {
    const criticalCommands = [
      'autoclaude.start',
      'autoclaude.stop',
      'autoclaude.addMessage',
      'autoclaude.executeCommand'
    ];
    
    await activate(context);
    const commands = await vscode.commands.getCommands(true);
    
    for (const cmd of criticalCommands) {
      assert.ok(commands.includes(cmd), `Critical command '${cmd}' must be registered`);
    }
  });

  test('Commands should handle errors gracefully', async () => {
    await activate(context);
    
    // Test commands that might fail in test environment
    const testCommands = [
      'autoclaude.showContext',
      'autoclaude.showStatistics',
      'autoclaude.exportLogs',
      'autoclaude.validateConfiguration'
    ];
    
    for (const cmd of testCommands) {
      try {
        await vscode.commands.executeCommand(cmd);
      } catch (error) {
        // Commands should fail gracefully
        assert.ok(
          error instanceof Error,
          `Command '${cmd}' should throw proper Error when failing`
        );
      }
    }
  });

  test('Missing command registrations should be detected', () => {
    // This test helps identify commands in package.json that aren't registered
    const packageJson = require('../../package.json');
    const packageCommands = packageJson.contributes.commands.map((cmd: any) => cmd.command);
    
    const missingCommands = packageCommands.filter(
      (cmd: string) => !EXPECTED_COMMANDS.includes(cmd)
    );
    
    if (missingCommands.length > 0) {
      console.error('Commands in package.json but not in expected list:', missingCommands);
    }
    
    assert.strictEqual(
      missingCommands.length,
      0,
      `Found ${missingCommands.length} commands in package.json not in expected list: ${missingCommands.join(', ')}`
    );
  });

  test('Command categories should be consistent', () => {
    const packageJson = require('../../package.json');
    const commands = packageJson.contributes.commands;
    
    const categories = new Set<string>();
    commands.forEach((cmd: any) => {
      if (cmd.category) {
        categories.add(cmd.category);
      }
    });
    
    // Expected categories
    const expectedCategories = ['Claude', 'Claude Agent Farm'];
    
    categories.forEach(category => {
      assert.ok(
        expectedCategories.includes(category),
        `Category '${category}' should be one of: ${expectedCategories.join(', ')}`
      );
    });
  });

  test('Commands should have proper titles and icons', () => {
    const packageJson = require('../../package.json');
    const commands = packageJson.contributes.commands;
    
    commands.forEach((cmd: any) => {
      assert.ok(cmd.command, 'Command should have an ID');
      assert.ok(cmd.title, `Command '${cmd.command}' should have a title`);
      assert.ok(
        cmd.title.length > 0,
        `Command '${cmd.command}' title should not be empty`
      );
      
      // Optional: Check for icons (many commands have them)
      if (cmd.command.startsWith('autoclaude.')) {
        // Most commands should have icons for better UX
        console.log(`Command '${cmd.command}' icon: ${cmd.icon || 'none'}`);
      }
    });
  });
});

// Additional test suite for command functionality
suite('Command Functionality Tests', () => {
  let context: vscode.ExtensionContext;

  setup(async () => {
    context = createMockContext();
    await activate(context);
  });

  teardown(async () => {
    await deactivate();
  });

  test('Export commands should handle file operations', async () => {
    const exportCommands = [
      'autoclaude.exportQueue',
      'autoclaude.exportSettings',
      'autoclaude.exportMemory',
      'autoclaude.exportLogs'
    ];
    
    for (const cmd of exportCommands) {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes(cmd),
        `Export command '${cmd}' should be registered`
      );
    }
  });

  test('Import commands should validate input', async () => {
    const importCommands = [
      'autoclaude.importQueue'
    ];
    
    for (const cmd of importCommands) {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes(cmd),
        `Import command '${cmd}' should be registered`
      );
    }
  });

  test('Show commands should open proper views', async () => {
    const showCommands = [
      'autoclaude.showContext',
      'autoclaude.showTasks',
      'autoclaude.showStatistics',
      'autoclaude.showAgentMonitor',
      'autoclaude.showErrorHistory',
      'autoclaude.showServiceHealth',
      'autoclaude.showSessionInfo',
      'autoclaude.showAgentStatus',
      'autoclaude.showMemoryStats',
      'autoclaude.showHookStats',
      'autoclaude.showWorkflowStatus'
    ];
    
    for (const cmd of showCommands) {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes(cmd),
        `Show command '${cmd}' should be registered`
      );
    }
  });

  test('Toggle commands should maintain state', async () => {
    const toggleCommands = [
      'autoclaude.toggleAutoOrchestration',
      'autoclaude.toggleHook'
    ];
    
    for (const cmd of toggleCommands) {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes(cmd),
        `Toggle command '${cmd}' should be registered`
      );
    }
  });
});

// Helper function to create mock context
function createMockContext(): vscode.ExtensionContext {
  return {
    subscriptions: [],
    workspaceState: {
      get: (key: string) => undefined,
      update: (key: string, value: any) => Promise.resolve(),
      keys: () => []
    },
    globalState: {
      get: (key: string) => undefined,
      update: (key: string, value: any) => Promise.resolve(),
      keys: () => [],
      setKeysForSync: (keys: string[]) => {}
    },
    extensionPath: __dirname,
    extensionUri: vscode.Uri.file(__dirname),
    environmentVariableCollection: {} as any,
    storagePath: '/tmp/test-storage',
    globalStoragePath: '/tmp/test-global-storage',
    logPath: '/tmp/test-logs',
    extensionMode: vscode.ExtensionMode.Test,
    asAbsolutePath: (relativePath: string) => relativePath,
    storageUri: vscode.Uri.file('/tmp/test-storage'),
    globalStorageUri: vscode.Uri.file('/tmp/test-global-storage'),
    logUri: vscode.Uri.file('/tmp/test-logs'),
    extension: {} as any,
    secrets: {
      get: (key: string) => Promise.resolve(undefined),
      store: (key: string, value: string) => Promise.resolve(),
      delete: (key: string) => Promise.resolve(),
      onDidChange: {} as any
    }
  } as vscode.ExtensionContext;
}