/**
 * Optimized Extension Entry Point
 * Shows GUI in < 500ms instead of dozens of seconds
 */

import * as vscode from "vscode";
import { FastActivation } from "./optimization/FastActivation";
import { debugLog, infoLog } from "./utils/logging";

/**
 * Optimized activation function
 * Prioritizes showing GUI immediately over full initialization
 */
export async function activate(context: vscode.ExtensionContext): Promise<any> {
  const startTime = Date.now();
  
  console.log('[AutoClaude Optimized] Fast activation starting...');
  
  try {
    // Use fast activation to show GUI immediately
    await FastActivation.activate(context);
    
    const activationTime = Date.now() - startTime;
    console.log(`[AutoClaude Optimized] Activated in ${activationTime}ms`);
    
    // Show success message after GUI is ready
    if (activationTime < 1000) {
      vscode.window.showInformationMessage(
        `✨ AutoClaude ready in ${activationTime}ms!`
      );
    } else {
      vscode.window.showInformationMessage('AutoClaude extension activated');
    }
    
    // Return API for other extensions
    return {
      version: context.extension.packageJSON.version,
      commands: {
        start: () => vscode.commands.executeCommand('autoclaude.start'),
        stop: () => vscode.commands.executeCommand('autoclaude.stop'),
        addMessage: () => vscode.commands.executeCommand('autoclaude.addMessage'),
      },
      getStatus: () => FastActivation.getStatus()
    };
    
  } catch (error) {
    console.error('[AutoClaude Optimized] Activation failed:', error);
    
    vscode.window.showErrorMessage(
      'AutoClaude failed to activate. Please check the logs and restart VS Code.',
      'Show Logs'
    ).then(choice => {
      if (choice === 'Show Logs') {
        const outputChannel = vscode.window.createOutputChannel('AutoClaude');
        outputChannel.appendLine(`Activation error: ${error}`);
        outputChannel.show();
      }
    });
    
    throw error;
  }
}

/**
 * Optimized deactivation
 */
export async function deactivate(): Promise<void> {
  console.log('[AutoClaude Optimized] Deactivating...');
  
  try {
    // Import cleanup functions lazily
    const cleanupModules = [
      import("./queue").then(m => m.stopAutomaticMaintenance?.()),
      import("./services").then(m => {
        m.stopSleepPrevention?.();
        m.stopHealthCheck?.();
        m.stopScheduledSession?.();
      }),
      import("./memory").then(m => m.closeAllMemoryManagers?.()),
      import("./agents/AgentCoordinator").then(m => m.resetAgentCoordinator?.()),
      import("./monitoring/SystemMonitor").then(m => m.resetSystemMonitor?.()),
      import("./middleware").then(m => m.disposeMiddleware?.())
    ];
    
    // Run all cleanup in parallel with timeout
    await Promise.race([
      Promise.all(cleanupModules),
      new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
    ]);
    
    console.log('[AutoClaude Optimized] Deactivation complete');
    
  } catch (error) {
    console.error('[AutoClaude Optimized] Deactivation error:', error);
    // Don't throw - VS Code needs clean shutdown
  }
}