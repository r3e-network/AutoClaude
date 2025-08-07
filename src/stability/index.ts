/**
 * Stability Module
 * Central export point for all stability features
 */

export { SessionStabilityManager, getSessionStabilityManager } from "./SessionStabilityManager";
export { RobustQueueManager, getRobustQueueManager } from "./RobustQueueManager";
export { ConnectionPoolManager, getDatabasePool } from "./ConnectionPoolManager";
export { AutoRecoverySystem } from "./AutoRecoverySystem";

import * as vscode from "vscode";
import { getSessionStabilityManager } from "./SessionStabilityManager";
import { getRobustQueueManager } from "./RobustQueueManager";
import { infoLog, errorLog } from "../utils/logging";

/**
 * Initialize all stability systems
 */
export async function initializeStabilitySystems(context: vscode.ExtensionContext): Promise<void> {
  try {
    infoLog("[Stability] Initializing stability systems");

    // Start session monitoring
    const sessionManager = getSessionStabilityManager();
    await sessionManager.startMonitoring();

    // Initialize robust queue
    const queueManager = getRobustQueueManager();

    // Register ping command for health checks
    const pingCommand = vscode.commands.registerCommand("autoclaude.ping", () => {
      return { status: "ok", timestamp: Date.now() };
    });
    context.subscriptions.push(pingCommand);

    // Register cleanup on deactivation
    context.subscriptions.push({
      dispose: () => {
        sessionManager.stopMonitoring();
        queueManager.dispose();
      }
    });

    infoLog("[Stability] Stability systems initialized");

  } catch (error) {
    errorLog("[Stability] Failed to initialize stability systems", error as Error);
  }
}

/**
 * Get stability status
 */
export function getStabilityStatus(): {
  session: any;
  queue: any;
  overall: string;
} {
  const sessionManager = getSessionStabilityManager();
  const queueManager = getRobustQueueManager();

  const sessionHealth = sessionManager.getHealthStatus();
  const queueStats = queueManager.getStats();

  const overallHealth = sessionHealth.isHealthy && queueStats.failed === 0 
    ? "healthy" 
    : sessionHealth.consecutiveFailures > 0 
      ? "degraded" 
      : "unhealthy";

  return {
    session: sessionHealth,
    queue: queueStats,
    overall: overallHealth
  };
}