/**
 * Lifecycle Management
 * Handles start/stop operations
 */

import * as vscode from "vscode";
import { claudePanel, setIsRunning } from "./state";
import { debugLog } from "../utils/logging";

export function stopAutoClaude(): void {
  try {
    debugLog("[Lifecycle] Stopping AutoClaude...");
    
    if (claudePanel) {
      claudePanel.dispose();
    }
    
    setIsRunning(false);
    
    vscode.window.showInformationMessage("AutoClaude stopped");
    
  } catch (error) {
    debugLog(`[Lifecycle] Error stopping: ${error}`);
    vscode.window.showErrorMessage(`Failed to stop AutoClaude: ${error}`);
  }
}