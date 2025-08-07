/**
 * Webview Handlers Module
 * Separates webview message handling for better performance
 */

import * as vscode from "vscode";
import { debugLog } from "../utils/logging";

export async function setupWebviewHandlers(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext
): Promise<void> {
  // Import handlers lazily as needed
  const messageHandlers = new Map<string, (message: any) => Promise<void>>();
  
  // Register handlers lazily
  messageHandlers.set("addMessage", async (message) => {
    const { addMessageToQueueFromWebview } = await import("../queue/manager");
    addMessageToQueueFromWebview(message.text, message.attachedScripts);
  });
  
  messageHandlers.set("startProcessing", async (message) => {
    const { startProcessingQueue } = await import("../claude");
    await startProcessingQueue(message.skipPermissions);
  });
  
  messageHandlers.set("stopProcessing", async () => {
    const { stopProcessingQueue } = await import("../claude");
    stopProcessingQueue();
  });
  
  messageHandlers.set("clearQueue", async () => {
    const { clearMessageQueue } = await import("../queue");
    clearMessageQueue();
  });
  
  messageHandlers.set("resetSession", async () => {
    const { resetClaudeSession } = await import("../claude");
    await resetClaudeSession();
  });
  
  // Setup message listener
  panel.webview.onDidReceiveMessage(
    async (message: any) => {
      try {
        debugLog(`[WebviewHandler] Received command: ${message.command}`);
        
        const handler = messageHandlers.get(message.command);
        if (handler) {
          await handler(message);
        } else {
          // Try to load additional handlers if not found
          await loadAdditionalHandler(message, panel, context);
        }
      } catch (error) {
        debugLog(`[WebviewHandler] Error handling message: ${error}`);
        vscode.window.showErrorMessage(
          `Failed to handle command ${message.command}: ${error}`
        );
      }
    },
    undefined,
    context.subscriptions
  );
  
  // Setup panel disposal
  panel.onDidDispose(
    () => {
      debugLog("[WebviewHandler] Panel disposed");
      handlePanelDisposal();
    },
    undefined,
    context.subscriptions
  );
  
  // Load initial data after a delay
  setTimeout(() => {
    loadInitialData(panel);
  }, 100);
}

/**
 * Load additional handlers on demand
 */
async function loadAdditionalHandler(
  message: any,
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext
): Promise<void> {
  switch (message.command) {
    case "getAvailableScripts":
      const { sendAvailableScriptsToWebview } = await import("../scripts");
      await sendAvailableScriptsToWebview();
      break;
      
    case "getWorkspaceFiles":
      const { getWorkspaceFiles } = await import("../services/workspace");
      await getWorkspaceFiles(message.query || "", message.page || 0);
      break;
      
    case "removeMessage":
      const { removeMessageFromQueue } = await import("../queue");
      removeMessageFromQueue(message.id);
      break;
      
    case "duplicateMessage":
      const { duplicateMessageInQueue } = await import("../queue");
      duplicateMessageInQueue(message.id);
      break;
      
    case "editMessage":
      const { editMessageInQueue } = await import("../queue");
      editMessageInQueue(message.id, message.newText);
      break;
      
    case "reorderQueue":
      const { reorderQueue } = await import("../queue");
      reorderQueue(message.oldIndex, message.newIndex);
      break;
      
    case "sortQueue":
      const { sortQueue } = await import("../queue");
      sortQueue(message.criteria, message.direction);
      break;
      
    case "filterHistory":
      const { filterHistory } = await import("../queue");
      filterHistory(message.query);
      break;
      
    case "exportQueue":
      const { exportQueueCommand } = await import("../commands/exportImport");
      await exportQueueCommand();
      break;
      
    case "importQueue":
      const { importQueueCommand } = await import("../commands/exportImport");
      await importQueueCommand();
      break;
      
    default:
      debugLog(`[WebviewHandler] Unknown command: ${message.command}`);
  }
}

/**
 * Handle panel disposal
 */
async function handlePanelDisposal(): Promise<void> {
  try {
    const { setClaudePanel, setIsRunning } = await import("../core");
    setClaudePanel(null);
    setIsRunning(false);
    
    const { stopProcessingQueue } = await import("../claude");
    stopProcessingQueue();
    
    const { savePendingQueue, endCurrentHistoryRun } = await import("../queue");
    savePendingQueue();
    endCurrentHistoryRun();
    
    const { stopSleepPrevention } = await import("../services");
    stopSleepPrevention();
    
    debugLog("[WebviewHandler] Cleanup complete");
  } catch (error) {
    debugLog(`[WebviewHandler] Disposal error: ${error}`);
  }
}

/**
 * Load initial data into webview
 */
async function loadInitialData(panel: vscode.WebviewPanel): Promise<void> {
  try {
    // Load these in priority order
    const loaders = [
      // High priority - user visible
      import("../ui").then(m => {
        m.updateWebviewContent?.();
        m.updateSessionState?.();
      }),
      
      // Medium priority - settings
      import("../services/security").then(m => {
        m.sendSecuritySettings?.();
      }),
      
      import("../ui").then(m => {
        m.sendHistoryVisibilitySettings?.();
        m.sendScrollLockState?.();
      }),
      
      // Low priority - background data
      import("../queue").then(m => {
        setTimeout(() => {
          m.loadWorkspaceHistory?.();
          m.recoverWaitingMessages?.();
        }, 500);
      }),
      
      // Very low priority - auto features
      import("../queue").then(m => {
        setTimeout(() => {
          m.startAutomaticMaintenance?.();
        }, 2000);
      })
    ];
    
    // Don't await - let them load in background
    Promise.all(loaders).catch(error => {
      debugLog(`[WebviewHandler] Initial data load error: ${error}`);
    });
    
  } catch (error) {
    debugLog(`[WebviewHandler] Failed to load initial data: ${error}`);
  }
}