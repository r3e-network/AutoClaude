/**
 * Stability Configuration
 * Controls stability and validation features
 */

import * as vscode from "vscode";

export interface StabilityConfig {
  // Production readiness validation
  enableProductionValidation: boolean;
  blockOnValidationFailure: boolean;
  autoFixValidationIssues: boolean;
  validationTimeout: number;
  
  // Session stability
  enableHealthMonitoring: boolean;
  healthCheckInterval: number;
  maxMemoryMB: number;
  
  // Auto recovery
  enableAutoRecovery: boolean;
  recoveryScenarios: {
    panelNotResponding: boolean;
    queueStuck: boolean;
    memoryLeak: boolean;
    sessionCorrupted: boolean;
    extensionHanging: boolean;
  };
  
  // Queue management
  queueTimeout: number;
  maxRetries: number;
  enableDeadLetterQueue: boolean;
  
  // Resource management
  enableConnectionPooling: boolean;
  maxConnections: number;
  connectionTimeout: number;
}

export class StabilityConfigManager {
  private static instance: StabilityConfigManager;
  private config: StabilityConfig;
  
  private readonly DEFAULT_CONFIG: StabilityConfig = {
    // Production validation - disabled by default to avoid blocking
    enableProductionValidation: false,
    blockOnValidationFailure: false,
    autoFixValidationIssues: false,
    validationTimeout: 30000,
    
    // Session stability - enabled by default
    enableHealthMonitoring: true,
    healthCheckInterval: 30000,
    maxMemoryMB: 512,
    
    // Auto recovery - enabled by default
    enableAutoRecovery: true,
    recoveryScenarios: {
      panelNotResponding: true,
      queueStuck: true,
      memoryLeak: true,
      sessionCorrupted: true,
      extensionHanging: false // Requires user confirmation
    },
    
    // Queue management
    queueTimeout: 60000,
    maxRetries: 3,
    enableDeadLetterQueue: true,
    
    // Resource management
    enableConnectionPooling: true,
    maxConnections: 10,
    connectionTimeout: 30000
  };
  
  private constructor() {
    this.config = this.loadConfig();
  }
  
  static getInstance(): StabilityConfigManager {
    if (!StabilityConfigManager.instance) {
      StabilityConfigManager.instance = new StabilityConfigManager();
    }
    return StabilityConfigManager.instance;
  }
  
  /**
   * Load configuration from VS Code settings
   */
  private loadConfig(): StabilityConfig {
    const vsConfig = vscode.workspace.getConfiguration("autoclaude.stability");
    
    return {
      enableProductionValidation: vsConfig.get<boolean>(
        "enableProductionValidation",
        this.DEFAULT_CONFIG.enableProductionValidation
      ),
      blockOnValidationFailure: vsConfig.get<boolean>(
        "blockOnValidationFailure", 
        this.DEFAULT_CONFIG.blockOnValidationFailure
      ),
      autoFixValidationIssues: vsConfig.get<boolean>(
        "autoFixValidationIssues",
        this.DEFAULT_CONFIG.autoFixValidationIssues
      ),
      validationTimeout: vsConfig.get<number>(
        "validationTimeout",
        this.DEFAULT_CONFIG.validationTimeout
      ),
      
      enableHealthMonitoring: vsConfig.get<boolean>(
        "enableHealthMonitoring",
        this.DEFAULT_CONFIG.enableHealthMonitoring
      ),
      healthCheckInterval: vsConfig.get<number>(
        "healthCheckInterval",
        this.DEFAULT_CONFIG.healthCheckInterval
      ),
      maxMemoryMB: vsConfig.get<number>(
        "maxMemoryMB",
        this.DEFAULT_CONFIG.maxMemoryMB
      ),
      
      enableAutoRecovery: vsConfig.get<boolean>(
        "enableAutoRecovery",
        this.DEFAULT_CONFIG.enableAutoRecovery
      ),
      recoveryScenarios: vsConfig.get<any>(
        "recoveryScenarios",
        this.DEFAULT_CONFIG.recoveryScenarios
      ),
      
      queueTimeout: vsConfig.get<number>(
        "queueTimeout",
        this.DEFAULT_CONFIG.queueTimeout
      ),
      maxRetries: vsConfig.get<number>(
        "maxRetries",
        this.DEFAULT_CONFIG.maxRetries
      ),
      enableDeadLetterQueue: vsConfig.get<boolean>(
        "enableDeadLetterQueue",
        this.DEFAULT_CONFIG.enableDeadLetterQueue
      ),
      
      enableConnectionPooling: vsConfig.get<boolean>(
        "enableConnectionPooling",
        this.DEFAULT_CONFIG.enableConnectionPooling
      ),
      maxConnections: vsConfig.get<number>(
        "maxConnections",
        this.DEFAULT_CONFIG.maxConnections
      ),
      connectionTimeout: vsConfig.get<number>(
        "connectionTimeout",
        this.DEFAULT_CONFIG.connectionTimeout
      )
    };
  }
  
  /**
   * Reload configuration
   */
  reload(): void {
    this.config = this.loadConfig();
  }
  
  /**
   * Get current configuration
   */
  getConfig(): StabilityConfig {
    return { ...this.config };
  }
  
  /**
   * Get specific config value
   */
  get<K extends keyof StabilityConfig>(key: K): StabilityConfig[K] {
    return this.config[key];
  }
  
  /**
   * Update configuration
   */
  async update<K extends keyof StabilityConfig>(
    key: K, 
    value: StabilityConfig[K]
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration("autoclaude.stability");
    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    this.config[key] = value;
  }
  
  /**
   * Reset to defaults
   */
  async resetToDefaults(): Promise<void> {
    const config = vscode.workspace.getConfiguration("autoclaude.stability");
    
    for (const key of Object.keys(this.DEFAULT_CONFIG)) {
      await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
    }
    
    this.config = { ...this.DEFAULT_CONFIG };
  }
  
  /**
   * Watch for configuration changes
   */
  watchChanges(callback: (config: StabilityConfig) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration("autoclaude.stability")) {
        this.reload();
        callback(this.config);
      }
    });
  }
}

// Export singleton getter
export function getStabilityConfig(): StabilityConfigManager {
  return StabilityConfigManager.getInstance();
}