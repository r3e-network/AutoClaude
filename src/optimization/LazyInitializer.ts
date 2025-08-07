/**
 * Lazy Initializer for AutoClaude
 * Optimizes startup time by deferring heavy initialization
 */

import * as vscode from "vscode";
import { debugLog } from "../utils/logging";

export class LazyInitializer {
  private initializationPromises = new Map<string, Promise<any>>();
  private initialized = new Set<string>();
  private initStartTime = Date.now();
  
  constructor(private workspacePath: string) {}

  /**
   * Initialize a component lazily
   */
  async initializeComponent(
    componentName: string,
    initFunction: () => Promise<any>,
    priority: "critical" | "high" | "medium" | "low" = "medium"
  ): Promise<any> {
    // Check if already initialized
    if (this.initialized.has(componentName)) {
      return;
    }

    // Check if initialization is already in progress
    if (this.initializationPromises.has(componentName)) {
      return this.initializationPromises.get(componentName);
    }

    // Create initialization promise
    const initPromise = this.performInitialization(componentName, initFunction, priority);
    this.initializationPromises.set(componentName, initPromise);
    
    return initPromise;
  }

  /**
   * Perform the actual initialization with timing
   */
  private async performInitialization(
    componentName: string,
    initFunction: () => Promise<any>,
    priority: string
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      debugLog(`[LazyInit] Starting ${componentName} (${priority} priority)...`);
      
      // Add delay for non-critical components
      if (priority === "low") {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (priority === "medium") {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const result = await initFunction();
      
      const duration = Date.now() - startTime;
      debugLog(`[LazyInit] ✓ ${componentName} initialized in ${duration}ms`);
      
      this.initialized.add(componentName);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog(`[LazyInit] ✗ ${componentName} failed after ${duration}ms: ${error}`);
      
      // Remove from promises map so it can be retried
      this.initializationPromises.delete(componentName);
      
      // For non-critical components, don't throw
      if (priority === "low" || priority === "medium") {
        debugLog(`[LazyInit] Continuing without ${componentName}`);
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Initialize critical components needed for GUI
   */
  async initializeCriticalComponents(): Promise<void> {
    const criticalComponents = [
      // Only absolutely necessary components for showing GUI
    ];

    await Promise.all(
      criticalComponents.map(component => 
        this.initializeComponent(component.name, component.init, "critical")
      )
    );
  }

  /**
   * Initialize high priority components in background
   */
  async initializeHighPriorityComponents(): Promise<void> {
    // These run after GUI is shown but are still important
    const highPriorityComponents = [
      {
        name: "ContextSystem",
        init: async () => {
          const { initializeContextSystem } = await import("../context");
          return initializeContextSystem();
        }
      },
      {
        name: "QueueHistory",
        init: async () => {
          const { loadWorkspaceHistory, loadPendingQueue } = await import("../queue");
          loadPendingQueue();
          return loadWorkspaceHistory();
        }
      }
    ];

    // Don't await - let them run in background
    Promise.all(
      highPriorityComponents.map(component =>
        this.initializeComponent(component.name, component.init, "high")
      )
    ).catch(error => {
      debugLog(`[LazyInit] High priority initialization error: ${error}`);
    });
  }

  /**
   * Initialize medium priority components
   */
  async initializeMediumPriorityComponents(): Promise<void> {
    const mediumComponents = [
      {
        name: "MemorySystem",
        init: async () => {
          const { getMemoryManager } = await import("../memory");
          const manager = getMemoryManager(this.workspacePath);
          return manager.initialize();
        }
      },
      {
        name: "EnhancedConfig",
        init: async () => {
          const { getEnhancedConfig } = await import("../config/enhanced-config");
          const config = getEnhancedConfig(this.workspacePath);
          return config.initialize();
        }
      },
      {
        name: "HookManager",
        init: async () => {
          const { getHookManager } = await import("../hooks/HookManager");
          const hooks = getHookManager(this.workspacePath);
          return hooks.initialize();
        }
      }
    ];

    // Run in background without blocking
    mediumComponents.forEach(component => {
      setTimeout(() => {
        this.initializeComponent(component.name, component.init, "medium")
          .catch(error => {
            debugLog(`[LazyInit] Medium priority error (${component.name}): ${error}`);
          });
      }, 1000); // Stagger initialization
    });
  }

  /**
   * Initialize low priority components
   */
  async initializeLowPriorityComponents(): Promise<void> {
    const lowComponents = [
      {
        name: "AgentCoordinator",
        init: async () => {
          const { getAgentCoordinator } = await import("../agents/AgentCoordinator");
          const coordinator = getAgentCoordinator(this.workspacePath);
          return coordinator.initialize();
        }
      },
      {
        name: "SystemMonitor",
        init: async () => {
          const { getSystemMonitor } = await import("../monitoring/SystemMonitor");
          const monitor = getSystemMonitor(this.workspacePath);
          return monitor.initialize();
        }
      },
      {
        name: "WorkflowSystem",
        init: async () => {
          const { AutomaticWorkflowSystem } = await import("../automation/AutomaticWorkflowSystem");
          const system = AutomaticWorkflowSystem.getInstance(this.workspacePath);
          return system.initialize();
        }
      },
      {
        name: "UnifiedOrchestration",
        init: async () => {
          const { UnifiedOrchestrationSystem } = await import("../automation/UnifiedOrchestrationSystem");
          const system = UnifiedOrchestrationSystem.getInstance(this.workspacePath);
          return system.initialize();
        }
      }
    ];

    // Run much later and don't block anything
    setTimeout(() => {
      lowComponents.forEach((component, index) => {
        setTimeout(() => {
          this.initializeComponent(component.name, component.init, "low")
            .catch(error => {
              debugLog(`[LazyInit] Low priority error (${component.name}): ${error}`);
            });
        }, index * 2000); // Stagger by 2 seconds each
      });
    }, 5000); // Start after 5 seconds
  }

  /**
   * Get initialization status
   */
  getStatus(): {
    initialized: string[];
    pending: string[];
    totalTime: number;
  } {
    return {
      initialized: Array.from(this.initialized),
      pending: Array.from(this.initializationPromises.keys()).filter(
        key => !this.initialized.has(key)
      ),
      totalTime: Date.now() - this.initStartTime
    };
  }

  /**
   * Wait for specific component to be ready
   */
  async waitForComponent(componentName: string, timeoutMs = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (this.initialized.has(componentName)) {
        return true;
      }
      
      const promise = this.initializationPromises.get(componentName);
      if (promise) {
        try {
          await promise;
          return true;
        } catch {
          return false;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return false;
  }
}

// Singleton instance
let lazyInitializer: LazyInitializer | null = null;

export function getLazyInitializer(workspacePath: string): LazyInitializer {
  if (!lazyInitializer) {
    lazyInitializer = new LazyInitializer(workspacePath);
  }
  return lazyInitializer;
}

export function resetLazyInitializer(): void {
  lazyInitializer = null;
}