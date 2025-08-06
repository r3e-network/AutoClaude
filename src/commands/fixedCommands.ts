
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
        throw new Error(`Failed to start AutoClaude: ${error instanceof Error ? error.message : String(error)}`);
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
        throw new Error(`Failed to stop AutoClaude: ${error instanceof Error ? error.message : String(error)}`);
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
        throw new Error(`Failed to add message: ${error instanceof Error ? error.message : String(error)}`);
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
