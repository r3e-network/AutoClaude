#!/usr/bin/env node

/**
 * Script to automatically add error handling to commands
 * This generates code snippets that can be used to fix commands
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Generating Command Fixes\n');
console.log('=' . repeat(60));

// Commands that need fixing (from test results)
const commandsToFix = [
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
  'autoclaude.checkRemoteStatus',
  'autoclaude.showErrorHistory',
  'autoclaude.showServiceHealth',
  'autoclaude.exportLogs',
  'autoclaude.startHiveMind',
  'autoclaude.startSwarm',
  'autoclaude.executeNaturalCommand',
  'autoclaude.showWorkflowStatus',
  'autoclaude.exportMemory',
  'autoclaude.showSessionInfo'
];

// Generate fix templates
console.log('📝 Generated Fix Templates:\n');

commandsToFix.forEach(cmd => {
  const varName = cmd.replace('autoclaude.', '').replace(/([A-Z])/g, (match, p1, offset) => 
    offset > 0 ? p1 : p1.toLowerCase()
  ) + 'Command';
  
  console.log(`// Fix for ${cmd}`);
  console.log(`const ${varName} = vscode.commands.registerCommand(
  "${cmd}",
  withErrorHandling("${cmd}", async () => {`);
  
  // Add specific validations based on command type
  if (cmd.includes('show') || cmd.includes('export')) {
    // Read-only commands
    console.log(`    // This command displays information or exports data`);
  } else if (cmd !== 'autoclaude.start' && cmd !== 'autoclaude.stop') {
    // Commands that need workspace
    console.log(`    const workspace = requireWorkspace();`);
  }
  
  if (cmd.includes('addMessage') || cmd.includes('Processing')) {
    console.log(`    const panel = requirePanel();`);
  }
  
  console.log(`    
    // TODO: Add actual implementation here
    await showInfo("${cmd} executed successfully");
  })
);\n`);
});

// Generate import statements
console.log('\n📦 Required Imports:\n');
console.log(`import {
  withErrorHandling,
  requireWorkspace,
  requirePanel,
  requireRunning,
  withProgress,
  confirmAction,
  showInfo,
  showError,
  getUserInput,
  showQuickPick,
  openDocument,
  saveToFile
} from './utils/commandHelpers';`);

// Generate validation utility
console.log('\n🛡️ Validation Utilities:\n');
console.log(`
// Add these validation checks where needed:

// For commands that need workspace
const workspace = requireWorkspace();

// For commands that need the panel
const panel = requirePanel();

// For commands that need AutoClaude running
requireRunning();

// For dangerous operations
const confirmed = await confirmAction('Are you sure you want to proceed?');
if (!confirmed) return;

// For progress tracking
await withProgress('Processing...', async (progress) => {
  progress.report({ message: 'Step 1 of 3' });
  // ... do work
  progress.report({ increment: 33 });
});

// For user input
const input = await getUserInput('Enter command:', 'e.g., npm test');
if (!input) return;
`);

// Create automated fix file
const fixFileContent = `
import * as vscode from 'vscode';
import {
  withErrorHandling,
  requireWorkspace,
  requirePanel,
  requireRunning,
  showInfo,
  showError
} from '../utils/commandHelpers';

// Example of properly implemented command with error handling
export function registerFixedCommands(context: vscode.ExtensionContext) {
  
  // Fixed start command
  const startCommand = vscode.commands.registerCommand(
    "autoclaude.start",
    withErrorHandling("autoclaude.start", async () => {
      try {
        if (!checkCommandRateLimit("autoclaude.start")) {
          await showError("Command rate limit exceeded. Please wait before trying again.");
          return;
        }
        startAutoClaude(context);
        await showInfo("AutoClaude started successfully");
      } catch (error) {
        throw new Error(\`Failed to start AutoClaude: \${error instanceof Error ? error.message : String(error)}\`);
      }
    })
  );

  // Fixed stop command
  const stopCommand = vscode.commands.registerCommand(
    "autoclaude.stop",
    withErrorHandling("autoclaude.stop", async () => {
      try {
        requireRunning();
        stopAutoClaude();
        await showInfo("AutoClaude stopped");
      } catch (error) {
        throw new Error(\`Failed to stop AutoClaude: \${error instanceof Error ? error.message : String(error)}\`);
      }
    })
  );

  // Fixed addMessage command
  const addMessageCommand = vscode.commands.registerCommand(
    "autoclaude.addMessage",
    withErrorHandling("autoclaude.addMessage", async () => {
      try {
        requireRunning();
        requirePanel();
        const message = await getUserInput('Enter message for Claude:', 'Type your message here...');
        if (message) {
          addMessageToQueue(message);
          await showInfo("Message added to queue");
        }
      } catch (error) {
        throw new Error(\`Failed to add message: \${error instanceof Error ? error.message : String(error)}\`);
      }
    })
  );

  // Add all commands to subscriptions
  context.subscriptions.push(
    startCommand,
    stopCommand,
    addMessageCommand
    // ... add all other commands
  );
}
`;

fs.writeFileSync(
  path.join(__dirname, '../src/commands/fixedCommands.ts'),
  fixFileContent
);

console.log('\n✅ Fix templates generated!');
console.log('📄 Fixed command implementation saved to: src/commands/fixedCommands.ts');
console.log('\n⚠️  Note: Review and integrate these fixes into extension.ts');