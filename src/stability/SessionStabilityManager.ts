/**
 * Session Stability Manager
 * Ensures Claude Code sessions are stable and can recover from failures
 */

import * as vscode from "vscode";
import { debugLog, errorLog, infoLog } from "../utils/logging";

export interface SessionHealth {
  isHealthy: boolean;
  lastHealthCheck: number;
  consecutiveFailures: number;
  memoryUsage: number;
  activeTimers: Set<NodeJS.Timeout>;
  activeIntervals: Set<NodeJS.Timeout>;
  activePromises: Set<Promise<any>>;
  errors: Error[];
  warnings: string[];
}

export interface RecoveryStrategy {
  type: "restart" | "cleanup" | "reset" | "gracefulShutdown";
  reason: string;
  attempts: number;
  maxAttempts: number;
  backoffMs: number;
}

export class SessionStabilityManager {
  private static instance: SessionStabilityManager;
  private health: SessionHealth;
  private recoveryInProgress = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private resourceTracker: ResourceTracker;
  private errorRecovery: ErrorRecoverySystem;
  private sessionPersistence: SessionPersistence;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_MEMORY_MB = 512;
  private readonly MAX_ERRORS_BEFORE_RECOVERY = 10;

  private constructor() {
    this.health = this.initializeHealth();
    this.resourceTracker = new ResourceTracker();
    this.errorRecovery = new ErrorRecoverySystem();
    this.sessionPersistence = new SessionPersistence();
  }

  static getInstance(): SessionStabilityManager {
    if (!SessionStabilityManager.instance) {
      SessionStabilityManager.instance = new SessionStabilityManager();
    }
    return SessionStabilityManager.instance;
  }

  /**
   * Initialize health tracking
   */
  private initializeHealth(): SessionHealth {
    return {
      isHealthy: true,
      lastHealthCheck: Date.now(),
      consecutiveFailures: 0,
      memoryUsage: 0,
      activeTimers: new Set(),
      activeIntervals: new Set(),
      activePromises: new Set(),
      errors: [],
      warnings: []
    };
  }

  /**
   * Start monitoring session health
   */
  async startMonitoring(): Promise<void> {
    if (this.healthCheckInterval) {
      return; // Already monitoring
    }

    infoLog("[SessionStability] Starting health monitoring");

    // Install global error handlers
    this.installErrorHandlers();

    // Start periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        errorLog("[SessionStability] Health check failed", error);
      });
    }, this.HEALTH_CHECK_INTERVAL);

    // Track the interval itself
    this.resourceTracker.trackInterval(this.healthCheckInterval);

    // Initial health check
    await this.performHealthCheck();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.resourceTracker.untrackInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.cleanup();
    infoLog("[SessionStability] Monitoring stopped");
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      debugLog("[SessionStability] Performing health check");

      // Check memory usage
      const memUsage = process.memoryUsage();
      this.health.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB

      // Check for memory leaks
      if (this.health.memoryUsage > this.MAX_MEMORY_MB) {
        this.health.warnings.push(`High memory usage: ${this.health.memoryUsage.toFixed(2)}MB`);
        await this.triggerMemoryCleanup();
      }

      // Check for resource leaks
      const resourceStats = this.resourceTracker.getStats();
      if (resourceStats.timers > 100 || resourceStats.intervals > 10 || resourceStats.promises > 50) {
        this.health.warnings.push(`Resource leak detected: ${JSON.stringify(resourceStats)}`);
        await this.triggerResourceCleanup();
      }

      // Check error accumulation
      if (this.health.errors.length > this.MAX_ERRORS_BEFORE_RECOVERY) {
        await this.triggerErrorRecovery();
      }

      // Check session responsiveness
      const isResponsive = await this.checkSessionResponsiveness();
      if (!isResponsive) {
        this.health.consecutiveFailures++;
        if (this.health.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          await this.triggerSessionRecovery();
        }
      } else {
        this.health.consecutiveFailures = 0;
        this.health.isHealthy = true;
      }

      this.health.lastHealthCheck = Date.now();

      // Persist session state periodically
      await this.sessionPersistence.saveState();

    } catch (error) {
      errorLog("[SessionStability] Health check error", error as Error);
      this.health.errors.push(error as Error);
    }
  }

  /**
   * Check if session is responsive
   */
  private async checkSessionResponsiveness(): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000);

      // Try to execute a simple command
      vscode.commands.executeCommand("autoclaude.ping").then(
        () => {
          clearTimeout(timeout);
          resolve(true);
        },
        () => {
          clearTimeout(timeout);
          resolve(false);
        }
      );
    });
  }

  /**
   * Trigger memory cleanup
   */
  private async triggerMemoryCleanup(): Promise<void> {
    infoLog("[SessionStability] Triggering memory cleanup");

    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Clear caches
      await this.clearCaches();

      // Trim large data structures
      await this.trimDataStructures();

    } catch (error) {
      errorLog("[SessionStability] Memory cleanup failed", error as Error);
    }
  }

  /**
   * Trigger resource cleanup
   */
  private async triggerResourceCleanup(): Promise<void> {
    infoLog("[SessionStability] Triggering resource cleanup");

    try {
      // Clean up tracked resources
      await this.resourceTracker.cleanupLeakedResources();

      // Close unused connections
      await this.closeUnusedConnections();

    } catch (error) {
      errorLog("[SessionStability] Resource cleanup failed", error as Error);
    }
  }

  /**
   * Trigger error recovery
   */
  private async triggerErrorRecovery(): Promise<void> {
    if (this.recoveryInProgress) {
      return;
    }

    this.recoveryInProgress = true;
    infoLog("[SessionStability] Triggering error recovery");

    try {
      const strategy = this.errorRecovery.determineStrategy(this.health.errors);
      await this.executeRecoveryStrategy(strategy);

      // Clear errors after successful recovery
      this.health.errors = [];
      this.health.consecutiveFailures = 0;

    } catch (error) {
      errorLog("[SessionStability] Error recovery failed", error as Error);
    } finally {
      this.recoveryInProgress = false;
    }
  }

  /**
   * Trigger session recovery
   */
  private async triggerSessionRecovery(): Promise<void> {
    if (this.recoveryInProgress) {
      return;
    }

    this.recoveryInProgress = true;
    infoLog("[SessionStability] Triggering session recovery");

    try {
      // Save current state
      await this.sessionPersistence.saveState();

      // Attempt graceful restart
      const success = await this.attemptGracefulRestart();

      if (!success) {
        // Force restart if graceful failed
        await this.forceRestart();
      }

      // Restore state
      await this.sessionPersistence.restoreState();

      this.health.consecutiveFailures = 0;
      this.health.isHealthy = true;

    } catch (error) {
      errorLog("[SessionStability] Session recovery failed", error as Error);
      
      // Last resort: notify user
      vscode.window.showErrorMessage(
        "AutoClaude session has become unstable. Please restart VS Code.",
        "Restart Extension"
      ).then(action => {
        if (action === "Restart Extension") {
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
    } finally {
      this.recoveryInProgress = false;
    }
  }

  /**
   * Execute recovery strategy
   */
  private async executeRecoveryStrategy(strategy: RecoveryStrategy): Promise<void> {
    switch (strategy.type) {
      case "restart":
        await this.attemptGracefulRestart();
        break;
      case "cleanup":
        await this.performDeepCleanup();
        break;
      case "reset":
        await this.resetSession();
        break;
      case "gracefulShutdown":
        await this.gracefulShutdown();
        break;
    }
  }

  /**
   * Attempt graceful restart
   */
  private async attemptGracefulRestart(): Promise<boolean> {
    try {
      // Stop current session
      await vscode.commands.executeCommand("autoclaude.stop");
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start new session
      await vscode.commands.executeCommand("autoclaude.start");
      
      return true;
    } catch (error) {
      errorLog("[SessionStability] Graceful restart failed", error as Error);
      return false;
    }
  }

  /**
   * Force restart
   */
  private async forceRestart(): Promise<void> {
    infoLog("[SessionStability] Forcing restart");

    // Kill all resources
    this.resourceTracker.killAll();

    // Clear all state
    await this.clearAllState();

    // Restart
    await vscode.commands.executeCommand("autoclaude.start");
  }

  /**
   * Perform deep cleanup
   */
  private async performDeepCleanup(): Promise<void> {
    await this.triggerMemoryCleanup();
    await this.triggerResourceCleanup();
    await this.clearCaches();
    await this.trimDataStructures();
  }

  /**
   * Reset session
   */
  private async resetSession(): Promise<void> {
    await vscode.commands.executeCommand("autoclaude.resetSession");
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    await vscode.commands.executeCommand("autoclaude.stop");
  }

  /**
   * Clear caches
   */
  private async clearCaches(): Promise<void> {
    // Implementation depends on your cache structure
    debugLog("[SessionStability] Clearing caches");
  }

  /**
   * Trim data structures
   */
  private async trimDataStructures(): Promise<void> {
    // Implementation depends on your data structures
    debugLog("[SessionStability] Trimming data structures");
  }

  /**
   * Close unused connections
   */
  private async closeUnusedConnections(): Promise<void> {
    // Implementation depends on your connection management
    debugLog("[SessionStability] Closing unused connections");
  }

  /**
   * Clear all state
   */
  private async clearAllState(): Promise<void> {
    // Implementation depends on your state management
    debugLog("[SessionStability] Clearing all state");
  }

  /**
   * Install global error handlers
   */
  private installErrorHandlers(): void {
    // Handle unhandled rejections
    process.on("unhandledRejection", (reason, promise) => {
      errorLog("[SessionStability] Unhandled rejection", reason as Error);
      this.health.errors.push(new Error(`Unhandled rejection: ${reason}`));
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      errorLog("[SessionStability] Uncaught exception", error);
      this.health.errors.push(error);
      
      // Attempt recovery
      this.triggerErrorRecovery().catch(err => {
        errorLog("[SessionStability] Failed to recover from uncaught exception", err);
      });
    });
  }

  /**
   * Cleanup on disposal
   */
  private cleanup(): void {
    this.resourceTracker.cleanup();
    this.health = this.initializeHealth();
  }

  /**
   * Get current health status
   */
  getHealthStatus(): SessionHealth {
    return { ...this.health };
  }

  /**
   * Track a timer
   */
  trackTimer(timer: NodeJS.Timeout): void {
    this.resourceTracker.trackTimer(timer);
  }

  /**
   * Track an interval
   */
  trackInterval(interval: NodeJS.Timeout): void {
    this.resourceTracker.trackInterval(interval);
  }

  /**
   * Track a promise
   */
  trackPromise(promise: Promise<any>): void {
    this.resourceTracker.trackPromise(promise);
  }
}

/**
 * Resource Tracker
 * Tracks and manages resources to prevent leaks
 */
class ResourceTracker {
  private timers = new Set<NodeJS.Timeout>();
  private intervals = new Set<NodeJS.Timeout>();
  private promises = new Set<Promise<any>>();
  private disposables = new Set<vscode.Disposable>();

  trackTimer(timer: NodeJS.Timeout): void {
    this.timers.add(timer);
  }

  untrackTimer(timer: NodeJS.Timeout): void {
    this.timers.delete(timer);
  }

  trackInterval(interval: NodeJS.Timeout): void {
    this.intervals.add(interval);
  }

  untrackInterval(interval: NodeJS.Timeout): void {
    this.intervals.delete(interval);
  }

  trackPromise(promise: Promise<any>): void {
    this.promises.add(promise);
    promise.finally(() => {
      this.promises.delete(promise);
    });
  }

  trackDisposable(disposable: vscode.Disposable): void {
    this.disposables.add(disposable);
  }

  async cleanupLeakedResources(): Promise<void> {
    // Clear old timers
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Clear intervals
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();

    // Dispose disposables
    for (const disposable of this.disposables) {
      try {
        disposable.dispose();
      } catch (error) {
        debugLog(`[ResourceTracker] Failed to dispose: ${error}`);
      }
    }
    this.disposables.clear();
  }

  killAll(): void {
    this.cleanupLeakedResources();
    this.promises.clear();
  }

  getStats(): { timers: number; intervals: number; promises: number; disposables: number } {
    return {
      timers: this.timers.size,
      intervals: this.intervals.size,
      promises: this.promises.size,
      disposables: this.disposables.size
    };
  }

  cleanup(): void {
    this.killAll();
  }
}

/**
 * Error Recovery System
 * Determines appropriate recovery strategies
 */
class ErrorRecoverySystem {
  determineStrategy(errors: Error[]): RecoveryStrategy {
    const errorTypes = this.categorizeErrors(errors);

    if (errorTypes.memory > 3) {
      return {
        type: "cleanup",
        reason: "Memory errors detected",
        attempts: 0,
        maxAttempts: 3,
        backoffMs: 1000
      };
    }

    if (errorTypes.network > 5) {
      return {
        type: "restart",
        reason: "Network errors detected",
        attempts: 0,
        maxAttempts: 2,
        backoffMs: 2000
      };
    }

    if (errorTypes.state > 2) {
      return {
        type: "reset",
        reason: "State corruption detected",
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 0
      };
    }

    return {
      type: "gracefulShutdown",
      reason: "Too many errors",
      attempts: 0,
      maxAttempts: 1,
      backoffMs: 0
    };
  }

  private categorizeErrors(errors: Error[]): { memory: number; network: number; state: number; other: number } {
    const categories = {
      memory: 0,
      network: 0,
      state: 0,
      other: 0
    };

    for (const error of errors) {
      const message = error.message.toLowerCase();
      if (message.includes("memory") || message.includes("heap")) {
        categories.memory++;
      } else if (message.includes("network") || message.includes("timeout") || message.includes("econnrefused")) {
        categories.network++;
      } else if (message.includes("state") || message.includes("undefined") || message.includes("null")) {
        categories.state++;
      } else {
        categories.other++;
      }
    }

    return categories;
  }
}

/**
 * Session Persistence
 * Saves and restores session state
 */
class SessionPersistence {
  private readonly STATE_KEY = "autoclaude.sessionState";

  async saveState(): Promise<void> {
    try {
      const state = await this.gatherState();
      const context = await this.getContext();
      if (context) {
        await context.globalState.update(this.STATE_KEY, state);
      }
    } catch (error) {
      debugLog(`[SessionPersistence] Failed to save state: ${error}`);
    }
  }

  async restoreState(): Promise<void> {
    try {
      const context = await this.getContext();
      if (context) {
        const state = context.globalState.get(this.STATE_KEY);
        if (state) {
          await this.applyState(state);
        }
      }
    } catch (error) {
      debugLog(`[SessionPersistence] Failed to restore state: ${error}`);
    }
  }

  private async gatherState(): Promise<any> {
    // Gather current session state
    return {
      timestamp: Date.now(),
      // Add your state properties here
    };
  }

  private async applyState(state: any): Promise<void> {
    // Apply restored state
    debugLog("[SessionPersistence] State restored");
  }

  private async getContext(): Promise<vscode.ExtensionContext | null> {
    // Get extension context - implementation depends on your setup
    return null;
  }
}

// Export singleton getter
export function getSessionStabilityManager(): SessionStabilityManager {
  return SessionStabilityManager.getInstance();
}