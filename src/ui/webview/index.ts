import * as vscode from "vscode";
import {
  claudePanel,
  messageQueue,
  debugMode,
  sessionReady,
  processingQueue,
} from "../../core/state";
import { debugLog } from "../../utils/logging";
import { getValidatedConfig } from "../../core/config";

export function updateWebviewContent(): void {
  if (claudePanel) {
    try {
      claudePanel.webview.postMessage({
        command: "updateQueue",
        queue: messageQueue,
      });
    } catch (error) {
      debugLog(`❌ Failed to update webview content: ${error}`);
    }
  }
}

export function updateSessionState(): void {
  if (claudePanel) {
    try {
      claudePanel.webview.postMessage({
        command: "sessionStateChanged",
        isSessionRunning: sessionReady,
        isProcessing: processingQueue,
      });
    } catch (error) {
      debugLog(`❌ Failed to update session state: ${error}`);
    }
  }
}

export function getWebviewContent(context: vscode.ExtensionContext, webviewParam?: vscode.Webview): string {
  // Use provided webview or fall back to claudePanel
  const webview = webviewParam || claudePanel?.webview;
  
  if (!webview) {
    return getErrorHtml("Panel not initialized");
  }

  // Get URIs for resources - this works in both desktop and web
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "out", "webview", "script.js"),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "out", "webview", "styles.css"),
  );
  const iconUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "icon.png"),
  );

  // Generate nonce for CSP
  const nonce = getNonce();

  // Return the full HTML content inline - this works in both desktop and web environments
  return getHtmlContent(webview, scriptUri, styleUri, iconUri, nonce);
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getHtmlContent(
  webview: vscode.Webview,
  scriptUri: vscode.Uri,
  styleUri: vscode.Uri,
  iconUri: vscode.Uri,
  nonce: string,
): string {
  // Get the base64 icon data for inline display
  const iconBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data: https:;">
    <title>AutoClaude</title>
    <link href="${styleUri}" rel="stylesheet">
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="data:image/png;base64,${iconBase64}" 
                         alt="Claude" style="width: 32px; height: 32px; border-radius: 6px;" id="claudeIcon">
                    <h1>Claude Assistant</h1>
                </div>
                <button id="settingsBtn" class="btn-secondary" title="Open Settings">
                    <span class="btn-icon">⚙️</span>Settings
                </button>
            </div>
            <p>Intelligent AI-powered development assistant with automated workflows and Claude integration</p>
        </div>

        <div class="input-section">
            <h3>Add Message to Queue</h3>
            <div class="message-input-container">
                <textarea id="messageInput" placeholder="Enter your message for Claude... (Type @ to mention scripts)"></textarea>
                <div id="scriptSuggestions" class="script-suggestions" style="display: none;">
                    <!-- Script suggestions will be populated dynamically -->
                </div>
            </div>
            <div class="attached-scripts" id="attachedScripts" style="display: none;">
                <div class="attached-scripts-header">
                    <span>📎 Scripts attached to this message:</span>
                </div>
                <div class="attached-scripts-list" id="attachedScriptsList">
                    <!-- Attached scripts will be shown here -->
                </div>
            </div>
            <div class="controls"
                style="justify-content: flex-end; margin-top: 5px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 20px;">
                <small style="color: var(--vscode-descriptionForeground); margin-left: 12px; opacity: 0.8;">
                    Press Cmd+Enter (Mac) or Ctrl+Enter to add message • Type @ to attach scripts
                </small>
                <button id="addMessageBtn" class="btn-primary">
                    <span class="btn-icon">➕</span>Add Message
                </button>
            </div>
        </div>

        <div class="controls">
            <button id="startBtn" class="btn-success" disabled>
                <span class="btn-icon">▶️</span>Start Processing
            </button>
            <button id="stopBtn" class="btn-danger" disabled>
                <span class="btn-icon">⏹️</span>Stop Processing
            </button>
            <button id="interruptBtn" class="btn-warning">
                <span class="btn-icon">⚠️</span>Interrupt (ESC)
            </button>
            <button id="resetBtn" class="btn-warning">
                <span class="btn-icon">🔄</span>Reset Session
            </button>
            <div class="toggle-container" style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                <label class="toggle-switch">
                    <input type="checkbox" id="skipPermissions" checked>
                    <span class="toggle-slider"></span>
                </label>
                <span style="color: var(--vscode-foreground); font-size: 14px;">Skip permissions check</span>
            </div>
        </div>

        <div id="securityWarning"
            style="display: none; background: #ff6b6b22; border: 1px solid #ff6b6b; border-radius: 4px; padding: 8px; margin-bottom: 15px; color: #ff6b6b; font-size: 13px;">
            ⚠️ XSS bypass is enabled - potentially dangerous content allowed in messages
        </div>

        <div class="debug-section" id="debugSection" style="display: none;">
            <div class="debug-header">
                <h3>🧪 Development Debug Controls</h3>
                <small style="opacity: 0.7;">These controls are only available in development mode</small>
            </div>
            <div class="debug-controls">
                <button id="simulateUsageLimitBtn" class="btn-warning btn-small">
                    <span class="btn-icon">⏱️</span>Simulate Usage Limit (10sec)
                </button>
                <button id="clearAllTimersBtn" class="btn-secondary btn-small">
                    <span class="btn-icon">🔄</span>Clear All Timers
                </button>
                <button id="debugQueueStateBtn" class="btn-secondary btn-small">
                    <span class="btn-icon">🐛</span>Debug Queue State
                </button>
                <button id="toggleDebugModeBtn" class="btn-secondary btn-small">
                    <span class="btn-icon">🔍</span>Toggle Debug Logging
                </button>
            </div>
        </div>

        <div class="claude-output-section">
            <div class="claude-header">
                <h3 class="claude-title">🤖 Claude Live Output</h3>
                <div style="display: flex; gap: 10px;">
                    <button id="scrollLockBtn" class="btn-secondary btn-small" title="Toggle auto-scroll">
                        <span id="scrollLockIcon">🔓</span> Auto-scroll
                    </button>
                    <button id="scrollToBottomBtn" class="btn-secondary btn-small" title="Scroll to bottom">
                        <span>⬇️</span> To Bottom
                    </button>
                    <button id="clearClaudeOutputBtn" class="clear-button">Clear</button>
                </div>
            </div>
            <div id="claudeOutputContainer">
                <div class="claude-live-output" tabindex="0">
                    <div class="claude-ready-message">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="pulse-dot"></div>
                            <span>Ready to receive Claude output...</span>
                        </div>
                        <br><br>
                        <small style="opacity: 0.6;">Click here and use arrow keys + Enter to navigate Claude
                            interface</small>
                    </div>
                </div>
            </div>
        </div>

        <div class="terminal-section">
            <div class="terminal-header">
                <h3 class="terminal-title">📋 Terminal Output</h3>
            </div>
            <div id="terminalContainer">
                <div class="terminal-output">
                    <div class="terminal-ready-message">
                        <div class="pulse-dot-green"></div>
                        <span>Ready to start processing messages</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="scripts-section">
            <div class="scripts-header">
                <div>
                    <h3>Quality Checks & Automation</h3>
                    <small style="color: var(--vscode-descriptionForeground); font-size: 11px;">
                        🔍 Basic checks validate code • 🤖 Automation features provide intelligent assistance
                    </small>
                </div>
                <div class="scripts-controls">
                    <label style="font-size: 12px; margin-right: 10px;">
                        Max Iterations: 
                        <input type="number" id="maxIterations" min="1" max="20" value="5" style="width: 40px; margin-left: 5px;">
                    </label>
                    <button id="runScriptChecksBtn" class="btn-secondary btn-small">
                        <span class="btn-icon">🔍</span>Run Checks
                    </button>
                    <button id="runScriptLoopBtn" class="btn-primary btn-small">
                        <span class="btn-icon">🔄</span>Run Loop
                    </button>
                </div>
            </div>
            <div class="scripts-config" id="scriptsConfig">
                <!-- Script items will be populated dynamically -->
            </div>
        </div>

        <div class="queue-section">
            <div class="queue-header">
                <h3>Message Queue</h3>
                <div class="queue-controls">
                    <select id="sortField">
                        <option value="timestamp">Sort by Time</option>
                        <option value="status">Sort by Status</option>
                        <option value="text">Sort by Text</option>
                    </select>
                    <select id="sortDirection">
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                    <button id="clearBtn" class="btn-secondary btn-small">
                        <span class="btn-icon">🗑️</span>Clear Queue
                    </button>
                </div>
            </div>
            <div id="queueContainer">
                <div class="empty-queue">
                    No messages in queue
                </div>
            </div>
        </div>

        <div class="history-section">
            <div class="history-header">
                <h3>History</h3>
                <div class="history-controls">
                    <select id="historyFilter">
                        <option value="all">All Runs</option>
                        <option value="waiting">With Waiting Messages</option>
                        <option value="completed">Completed Runs</option>
                        <option value="errors">With Errors</option>
                        <option value="recent">Recent (10)</option>
                    </select>
                    <button id="deleteAllHistoryBtn" class="btn-secondary btn-small">
                        <span class="btn-icon">🗑️</span>Delete All
                    </button>
                </div>
            </div>
            <div id="historyContainer">
                <div class="empty-history">
                    Loading history...
                </div>
            </div>
        </div>

    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getErrorHtml(error: string): string {
  return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>AutoClaude</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    padding: 20px; 
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .error { 
                    color: var(--vscode-charts-red); 
                    font-weight: bold; 
                }
            </style>
        </head>
        <body>
            <h1>AutoClaude</h1>
            <p class="error">Error: ${error}</p>
            <p>Please try reloading the extension or restarting VS Code.</p>
        </body>
        </html>
    `;
}

export function sendHistoryVisibilitySettings(): void {
  const config = getValidatedConfig();

  if (claudePanel) {
    try {
      claudePanel.webview.postMessage({
        command: "setHistoryVisibility",
        showInUI: config.history.showInUI,
      });
    } catch (error) {
      debugLog(
        `❌ Failed to send history visibility settings to webview: ${error}`,
      );
    }
  }
}

export function sendSubAgentData(subAgentData: Array<{ id: string; name: string; status: string; capability?: string }>): void {
  if (claudePanel) {
    try {
      claudePanel.webview.postMessage({
        command: "updateSubAgents",
        subAgents: subAgentData,
      });
    } catch (error) {
      debugLog(`❌ Failed to send sub-agent data to webview: ${error}`);
    }
  }
}
