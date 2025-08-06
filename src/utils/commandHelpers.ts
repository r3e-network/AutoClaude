import * as vscode from 'vscode';
import { debugLog, errorLog } from './logging';

/**
 * Wraps a command handler with error handling and user feedback
 */
export function withErrorHandling(
  commandName: string,
  handler: (...args: any[]) => Promise<void> | void
): (...args: any[]) => Promise<void> {
  return async (...args: any[]) => {
    try {
      debugLog(`Executing command: ${commandName}`);
      await handler(...args);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errorLog(`Command ${commandName} failed`, { 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      vscode.window.showErrorMessage(
        `Command failed: ${errorMessage}`,
        'Show Logs'
      ).then(choice => {
        if (choice === 'Show Logs') {
          vscode.commands.executeCommand('autoclaude.exportLogs');
        }
      });
    }
  };
}

/**
 * Validates that a workspace is open
 */
export function requireWorkspace(): vscode.WorkspaceFolder {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    throw new Error('No workspace folder open. Please open a folder first.');
  }
  return workspace;
}

/**
 * Validates that the Claude panel is active
 */
export function requirePanel(): any {
  // Import from core to avoid circular dependency
  const { claudePanel } = require('../core');
  if (!claudePanel) {
    throw new Error('AutoClaude panel is not active. Please start AutoClaude first.');
  }
  return claudePanel;
}

/**
 * Validates that the extension is running
 */
export function requireRunning(): void {
  const { isRunning } = require('../core');
  if (!isRunning) {
    throw new Error('AutoClaude is not running. Please start AutoClaude first.');
  }
}

/**
 * Shows a progress notification while executing a command
 */
export async function withProgress<T>(
  title: string,
  task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false
    },
    task
  );
}

/**
 * Confirms an action with the user
 */
export async function confirmAction(
  message: string,
  confirmLabel = 'Yes',
  cancelLabel = 'No'
): Promise<boolean> {
  const choice = await vscode.window.showWarningMessage(
    message,
    confirmLabel,
    cancelLabel
  );
  return choice === confirmLabel;
}

/**
 * Shows an information message with optional actions
 */
export async function showInfo(
  message: string,
  ...actions: string[]
): Promise<string | undefined> {
  return vscode.window.showInformationMessage(message, ...actions);
}

/**
 * Shows an error message with optional actions
 */
export async function showError(
  message: string,
  ...actions: string[]
): Promise<string | undefined> {
  return vscode.window.showErrorMessage(message, ...actions);
}

/**
 * Gets user input via input box
 */
export async function getUserInput(
  prompt: string,
  placeHolder?: string,
  value?: string
): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt,
    placeHolder,
    value,
    ignoreFocusOut: true
  });
}

/**
 * Shows a quick pick menu
 */
export async function showQuickPick<T extends vscode.QuickPickItem>(
  items: T[],
  placeHolder: string
): Promise<T | undefined> {
  return vscode.window.showQuickPick(items, {
    placeHolder,
    ignoreFocusOut: true
  });
}

/**
 * Opens a text document in the editor
 */
export async function openDocument(
  content: string,
  language = 'plaintext'
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    content,
    language
  });
  await vscode.window.showTextDocument(doc);
}

/**
 * Saves content to a file with save dialog
 */
export async function saveToFile(
  content: string,
  defaultFileName: string
): Promise<void> {
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(defaultFileName),
    filters: {
      'All Files': ['*']
    }
  });
  
  if (uri) {
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
    await showInfo(`File saved: ${uri.fsPath}`);
  }
}