/**
 * Fast Activation Module
 * Optimizes the extension activation to show GUI immediately
 */

import * as vscode from "vscode";
import { debugLog, infoLog } from "../utils/logging";
import { getLazyInitializer } from "./LazyInitializer";

export class FastActivation {
  private static initializationStatus = {
    guiReady: false,
    criticalReady: false,
    fullReady: false,
    startTime: Date.now()
  };

  /**
   * Fast activation that shows GUI immediately
   */
  static async activate(context: vscode.ExtensionContext): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Step 1: Absolute minimum setup (< 50ms)
      debugLog("[FastActivation] Starting fast activation...");
      
      // Set context immediately
      const setExtensionContext = (await import("../core")).setExtensionContext;
      setExtensionContext(context);
      
      // Step 2: Show GUI immediately (target: < 100ms from start)
      // Don't wait for anything else
      setTimeout(() => {
        this.showGUIImmediately(context);
      }, 0);
      
      // Step 3: Initialize critical components in background
      setTimeout(() => {
        this.initializeCriticalComponents(context);
      }, 100);
      
      // Step 4: Initialize heavy components lazily
      setTimeout(() => {
        this.initializeHeavyComponents(context);
      }, 500);
      
      const guiTime = Date.now() - startTime;
      debugLog(`[FastActivation] GUI ready in ${guiTime}ms`);
      
    } catch (error) {
      console.error("[FastActivation] Activation failed:", error);
      vscode.window.showErrorMessage(
        `AutoClaude activation failed: ${error}`
      );
    }
  }

  /**
   * Show GUI immediately without waiting for initialization
   */
  private static async showGUIImmediately(context: vscode.ExtensionContext): Promise<void> {
    try {
      // Register just the start command immediately
      const startCommand = vscode.commands.registerCommand(
        "autoclaude.start",
        async () => {
          await this.fastStartCommand(context);
        }
      );
      
      context.subscriptions.push(startCommand);
      
      // Mark GUI as ready
      this.initializationStatus.guiReady = true;
      
      debugLog("[FastActivation] GUI commands registered");
      
    } catch (error) {
      console.error("[FastActivation] Failed to register GUI commands:", error);
    }
  }

  /**
   * Fast start command that shows panel immediately
   */
  private static async fastStartCommand(context: vscode.ExtensionContext): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Import only what's needed for panel creation
      const { claudePanel, setClaudePanel, isRunning } = await import("../core");
      
      // Check if already running
      if (isRunning && claudePanel) {
        claudePanel.reveal(vscode.ViewColumn.Two);
        vscode.window.showInformationMessage("AutoClaude is already running");
        return;
      }
      
      // Create panel immediately
      debugLog("[FastStart] Creating webview panel...");
      const panel = vscode.window.createWebviewPanel(
        "autoclaude",
        "AutoClaude",
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, "out"),
            vscode.Uri.joinPath(context.extensionUri, "src"),
            context.extensionUri,
          ],
        }
      );
      
      setClaudePanel(panel);
      
      // Show loading content immediately
      panel.webview.html = this.getLoadingHTML();
      
      const panelTime = Date.now() - startTime;
      debugLog(`[FastStart] Panel shown in ${panelTime}ms`);
      
      // Load real content asynchronously
      setTimeout(async () => {
        try {
          const { getWebviewContent } = await import("../ui");
          const htmlContent = getWebviewContent(context, panel.webview);
          panel.webview.html = htmlContent;
          
          // Setup message handlers
          await this.setupWebviewHandlers(panel, context);
          
          debugLog("[FastStart] Full content loaded");
        } catch (error) {
          console.error("[FastStart] Failed to load content:", error);
          panel.webview.html = this.getErrorHTML(error);
        }
      }, 0);
      
    } catch (error) {
      console.error("[FastStart] Failed to create panel:", error);
      vscode.window.showErrorMessage(`Failed to start AutoClaude: ${error}`);
    }
  }

  /**
   * Get loading HTML to show immediately
   */
  private static getLoadingHTML(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            background: #1e1e1e;
            color: #cccccc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .loading-container {
            text-align: center;
        }
        .logo {
            width: 100px;
            height: 100px;
            margin: 0 auto 20px;
            animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .spinner {
            border: 3px solid #333;
            border-top: 3px solid #007ACC;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .status {
            margin-top: 20px;
            font-size: 14px;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="logo">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="45" fill="#007ACC" opacity="0.1"/>
                <text x="50" y="65" text-anchor="middle" font-size="40" fill="#007ACC">AC</text>
            </svg>
        </div>
        <h2>AutoClaude</h2>
        <div class="spinner"></div>
        <div class="status">Initializing components...</div>
    </div>
    <script>
        // Update status messages
        const statuses = [
            "Loading interface...",
            "Preparing workspace...",
            "Starting services...",
            "Almost ready..."
        ];
        let index = 0;
        setInterval(() => {
            const statusEl = document.querySelector('.status');
            if (statusEl) {
                statusEl.textContent = statuses[index % statuses.length];
                index++;
            }
        }, 1500);
    </script>
</body>
</html>`;
  }

  /**
   * Get error HTML
   */
  private static getErrorHTML(error: any): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            background: #1e1e1e;
            color: #cccccc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 20px;
        }
        .error {
            background: #3c1e1e;
            border: 1px solid #c42525;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
        }
        .error h3 {
            color: #f48771;
            margin-top: 0;
        }
        .actions {
            margin-top: 20px;
        }
        button {
            background: #007ACC;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
        }
        button:hover {
            background: #005a9e;
        }
    </style>
</head>
<body>
    <h2>AutoClaude</h2>
    <div class="error">
        <h3>⚠️ Initialization Error</h3>
        <p>Failed to load AutoClaude interface.</p>
        <pre>${error}</pre>
    </div>
    <div class="actions">
        <button onclick="location.reload()">Retry</button>
        <button onclick="acquireVsCodeApi().postMessage({command: 'reportError'})">Report Issue</button>
    </div>
</body>
</html>`;
  }

  /**
   * Setup webview handlers
   */
  private static async setupWebviewHandlers(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext
  ): Promise<void> {
    // Import handlers lazily
    const handlers = await import("../ui/webviewHandlers");
    await handlers.setupWebviewHandlers(panel, context);
  }

  /**
   * Initialize critical components in background
   */
  private static async initializeCriticalComponents(context: vscode.ExtensionContext): Promise<void> {
    try {
      debugLog("[FastActivation] Initializing critical components...");
      
      // Register remaining essential commands
      await this.registerEssentialCommands(context);
      
      // Initialize middleware
      const { initializeMiddleware } = await import("../middleware");
      initializeMiddleware();
      
      // Setup error handling
      const { setupGlobalErrorHandler } = await import("../core/errors");
      setupGlobalErrorHandler();
      
      this.initializationStatus.criticalReady = true;
      debugLog("[FastActivation] Critical components ready");
      
    } catch (error) {
      console.error("[FastActivation] Critical initialization failed:", error);
    }
  }

  /**
   * Initialize heavy components lazily
   */
  private static async initializeHeavyComponents(context: vscode.ExtensionContext): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      debugLog("[FastActivation] No workspace folder, skipping heavy initialization");
      return;
    }

    try {
      const lazyInit = getLazyInitializer(workspaceFolder.uri.fsPath);
      
      // Start initialization in priority order
      await lazyInit.initializeCriticalComponents();
      await lazyInit.initializeHighPriorityComponents();
      await lazyInit.initializeMediumPriorityComponents();
      await lazyInit.initializeLowPriorityComponents();
      
      this.initializationStatus.fullReady = true;
      
      const totalTime = Date.now() - this.initializationStatus.startTime;
      infoLog(`[FastActivation] Full initialization complete in ${totalTime}ms`);
      
    } catch (error) {
      console.error("[FastActivation] Heavy initialization failed:", error);
    }
  }

  /**
   * Register essential commands
   */
  private static async registerEssentialCommands(context: vscode.ExtensionContext): Promise<void> {
    const commands = [
      {
        id: "autoclaude.stop",
        handler: async () => {
          const { stopAutoClaude } = await import("../core/lifecycle");
          stopAutoClaude();
        }
      },
      {
        id: "autoclaude.addMessage",
        handler: async () => {
          const { addMessageCommand } = await import("../commands/addMessage");
          await addMessageCommand();
        }
      },
      {
        id: "autoclaude.clearQueue",
        handler: async () => {
          const { clearMessageQueue } = await import("../queue");
          clearMessageQueue();
        }
      }
    ];

    for (const cmd of commands) {
      const disposable = vscode.commands.registerCommand(cmd.id, cmd.handler);
      context.subscriptions.push(disposable);
    }
  }

  /**
   * Get initialization status
   */
  static getStatus(): typeof FastActivation.initializationStatus {
    return this.initializationStatus;
  }
}