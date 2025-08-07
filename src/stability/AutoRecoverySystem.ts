/**
 * Auto Recovery System
 * Automatically detects and recovers from various failure scenarios
 */

import * as vscode from "vscode";
import { debugLog, errorLog, infoLog } from "../utils/logging";

export interface RecoveryScenario {
  id: string;
  name: string;
  description: string;
  detector: () => Promise<boolean>;
  recovery: () => Promise<boolean>;
  priority: number;
  cooldownMs: number;
  lastAttempt?: number;
  attempts: number;
  maxAttempts: number;
}

export class AutoRecoverySystem {
  private static instance: AutoRecoverySystem;
  private scenarios: Map<string, RecoveryScenario> = new Map();
  private isRecovering = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITOR_INTERVAL = 15000; // 15 seconds

  private constructor() {
    this.registerDefaultScenarios();
  }

  static getInstance(): AutoRecoverySystem {
    if (!AutoRecoverySystem.instance) {
      AutoRecoverySystem.instance = new AutoRecoverySystem();
    }
    return AutoRecoverySystem.instance;
  }

  /**
   * Register default recovery scenarios
   */
  private registerDefaultScenarios(): void {
    // Panel not responding
    this.registerScenario({
      id: "panel-not-responding",
      name: "Panel Not Responding",
      description: "Webview panel is not responding to messages",
      detector: async () => {
        try {
          const { claudePanel } = await import("../core/state");
          if (!claudePanel) return false;

          // Try to send a ping message
          return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(true), 3000);
            
            claudePanel.webview.postMessage({ type: "ping" });
            
            // If we get response, panel is working
            claudePanel.webview.onDidReceiveMessage(
              (msg) => {
                if (msg.type === "pong") {
                  clearTimeout(timeout);
                  resolve(false);
                }
              },
              undefined,
              []
            );
          });
        } catch {
          return false;
        }
      },
      recovery: async () => {
        infoLog("[AutoRecovery] Attempting to recover unresponsive panel");
        try {
          // Restart the panel
          await vscode.commands.executeCommand("autoclaude.stop");
          await new Promise(resolve => setTimeout(resolve, 2000));
          await vscode.commands.executeCommand("autoclaude.start");
          return true;
        } catch (error) {
          errorLog("[AutoRecovery] Panel recovery failed", error as Error);
          return false;
        }
      },
      priority: 1,
      cooldownMs: 60000,
      attempts: 0,
      maxAttempts: 3
    });

    // Queue stuck
    this.registerScenario({
      id: "queue-stuck",
      name: "Queue Stuck",
      description: "Message queue is not processing",
      detector: async () => {
        try {
          const { messageQueue, isProcessing } = await import("../core/state");
          
          // Check if queue has messages but not processing
          if (messageQueue && messageQueue.length > 0 && !isProcessing) {
            // Check if messages are old
            const firstMessage = messageQueue[0];
            if (firstMessage && firstMessage.timestamp) {
              const age = Date.now() - firstMessage.timestamp;
              return age > 60000; // Stuck for more than 1 minute
            }
          }
          return false;
        } catch {
          return false;
        }
      },
      recovery: async () => {
        infoLog("[AutoRecovery] Attempting to recover stuck queue");
        try {
          const { startProcessingQueue } = await import("../claude");
          await startProcessingQueue();
          return true;
        } catch (error) {
          errorLog("[AutoRecovery] Queue recovery failed", error as Error);
          return false;
        }
      },
      priority: 2,
      cooldownMs: 30000,
      attempts: 0,
      maxAttempts: 5
    });

    // Memory leak
    this.registerScenario({
      id: "memory-leak",
      name: "Memory Leak",
      description: "High memory usage detected",
      detector: async () => {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        return heapUsedMB > 512; // More than 512MB
      },
      recovery: async () => {
        infoLog("[AutoRecovery] Attempting to recover from high memory usage");
        try {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }

          // Clear caches and unused resources
          await this.clearMemory();
          
          return true;
        } catch (error) {
          errorLog("[AutoRecovery] Memory recovery failed", error as Error);
          return false;
        }
      },
      priority: 3,
      cooldownMs: 120000,
      attempts: 0,
      maxAttempts: 2
    });

    // Session corrupted
    this.registerScenario({
      id: "session-corrupted",
      name: "Session Corrupted",
      description: "Session state is corrupted",
      detector: async () => {
        try {
          const { getSessionForWorkspace } = await import("../core/state");
          const workspaceFolders = vscode.workspace.workspaceFolders;
          
          if (!workspaceFolders || workspaceFolders.length === 0) {
            return false;
          }

          const session = getSessionForWorkspace(workspaceFolders[0].uri.fsPath);
          
          // Check for corruption indicators
          if (session) {
            // Check for invalid state combinations
            if (session.isProcessing && !session.claudeProcess) {
              return true;
            }
            
            // Check for stuck processing
            if (session.isProcessing && session.lastActivity) {
              const timeSinceActivity = Date.now() - session.lastActivity;
              if (timeSinceActivity > 300000) { // 5 minutes
                return true;
              }
            }
          }
          
          return false;
        } catch {
          return false;
        }
      },
      recovery: async () => {
        infoLog("[AutoRecovery] Attempting to recover corrupted session");
        try {
          const { resetClaudeSession } = await import("../claude");
          await resetClaudeSession();
          return true;
        } catch (error) {
          errorLog("[AutoRecovery] Session recovery failed", error as Error);
          return false;
        }
      },
      priority: 1,
      cooldownMs: 60000,
      attempts: 0,
      maxAttempts: 2
    });

    // Extension hanging
    this.registerScenario({
      id: "extension-hanging",
      name: "Extension Hanging",
      description: "Extension is not responding",
      detector: async () => {
        try {
          // Try to execute a simple command with timeout
          return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(true), 5000);
            
            vscode.commands.executeCommand("autoclaude.ping").then(
              () => {
                clearTimeout(timeout);
                resolve(false);
              },
              () => {
                clearTimeout(timeout);
                resolve(true);
              }
            );
          });
        } catch {
          return true;
        }
      },
      recovery: async () => {
        infoLog("[AutoRecovery] Extension hanging detected, requesting reload");
        
        const action = await vscode.window.showWarningMessage(
          "AutoClaude appears to be hanging. Would you like to reload the window?",
          "Reload Window",
          "Ignore"
        );
        
        if (action === "Reload Window") {
          await vscode.commands.executeCommand("workbench.action.reloadWindow");
          return true;
        }
        
        return false;
      },
      priority: 0,
      cooldownMs: 300000, // 5 minutes
      attempts: 0,
      maxAttempts: 1
    });
  }

  /**
   * Register a recovery scenario
   */
  registerScenario(scenario: RecoveryScenario): void {
    this.scenarios.set(scenario.id, scenario);
    debugLog(`[AutoRecovery] Registered scenario: ${scenario.name}`);
  }

  /**
   * Start monitoring for recovery scenarios
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    infoLog("[AutoRecovery] Starting monitoring");

    this.monitoringInterval = setInterval(() => {
      this.checkScenarios().catch(error => {
        errorLog("[AutoRecovery] Monitoring error", error);
      });
    }, this.MONITOR_INTERVAL);

    // Run initial check
    this.checkScenarios();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    infoLog("[AutoRecovery] Monitoring stopped");
  }

  /**
   * Check all scenarios
   */
  private async checkScenarios(): Promise<void> {
    if (this.isRecovering) {
      debugLog("[AutoRecovery] Already recovering, skipping check");
      return;
    }

    // Sort scenarios by priority
    const sortedScenarios = Array.from(this.scenarios.values())
      .sort((a, b) => a.priority - b.priority);

    for (const scenario of sortedScenarios) {
      try {
        // Check cooldown
        if (scenario.lastAttempt) {
          const timeSinceLastAttempt = Date.now() - scenario.lastAttempt;
          if (timeSinceLastAttempt < scenario.cooldownMs) {
            continue;
          }
        }

        // Check if scenario is detected
        const detected = await scenario.detector();
        
        if (detected) {
          debugLog(`[AutoRecovery] Detected scenario: ${scenario.name}`);
          
          // Check max attempts
          if (scenario.attempts >= scenario.maxAttempts) {
            errorLog(`[AutoRecovery] Max attempts reached for ${scenario.name}`);
            continue;
          }

          // Attempt recovery
          await this.attemptRecovery(scenario);
          
          // Only handle one scenario at a time
          break;
        }
      } catch (error) {
        errorLog(`[AutoRecovery] Error checking scenario ${scenario.name}`, error as Error);
      }
    }
  }

  /**
   * Attempt recovery for a scenario
   */
  private async attemptRecovery(scenario: RecoveryScenario): Promise<void> {
    this.isRecovering = true;
    scenario.lastAttempt = Date.now();
    scenario.attempts++;

    try {
      infoLog(`[AutoRecovery] Attempting recovery: ${scenario.name}`);
      
      const success = await scenario.recovery();
      
      if (success) {
        infoLog(`[AutoRecovery] Recovery successful: ${scenario.name}`);
        
        // Reset attempts on success
        scenario.attempts = 0;
        
        // Notify user
        vscode.window.showInformationMessage(
          `AutoClaude recovered from: ${scenario.description}`
        );
      } else {
        errorLog(`[AutoRecovery] Recovery failed: ${scenario.name}`);
        
        if (scenario.attempts >= scenario.maxAttempts) {
          vscode.window.showErrorMessage(
            `AutoClaude could not recover from: ${scenario.description}. Manual intervention may be required.`
          );
        }
      }
    } catch (error) {
      errorLog(`[AutoRecovery] Recovery error for ${scenario.name}`, error as Error);
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Clear memory
   */
  private async clearMemory(): Promise<void> {
    try {
      // Clear message history
      const { clearOldHistory } = await import("../queue");
      if (clearOldHistory) {
        await clearOldHistory();
      }

      // Clear caches
      const { clearAllCaches } = await import("../cache");
      if (clearAllCaches) {
        await clearAllCaches();
      }

      debugLog("[AutoRecovery] Memory cleared");
    } catch (error) {
      debugLog(`[AutoRecovery] Failed to clear memory: ${error}`);
    }
  }

  /**
   * Manually trigger recovery check
   */
  async triggerCheck(): Promise<void> {
    await this.checkScenarios();
  }

  /**
   * Get recovery status
   */
  getStatus(): {
    isRecovering: boolean;
    scenarios: Array<{
      id: string;
      name: string;
      attempts: number;
      maxAttempts: number;
      lastAttempt?: number;
    }>;
  } {
    return {
      isRecovering: this.isRecovering,
      scenarios: Array.from(this.scenarios.values()).map(s => ({
        id: s.id,
        name: s.name,
        attempts: s.attempts,
        maxAttempts: s.maxAttempts,
        lastAttempt: s.lastAttempt
      }))
    };
  }

  /**
   * Reset all scenarios
   */
  reset(): void {
    for (const scenario of this.scenarios.values()) {
      scenario.attempts = 0;
      scenario.lastAttempt = undefined;
    }
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.stopMonitoring();
    this.scenarios.clear();
  }
}

// Export singleton getter
export function getAutoRecoverySystem(): AutoRecoverySystem {
  return AutoRecoverySystem.getInstance();
}