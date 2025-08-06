/**
 * Type definitions for Enhanced Configuration System
 */

// Deep merge function types - generic object types
export type DeepMergeObject = Record<string, unknown>;

// Nested value setter types
export type NestedObject = Record<string, unknown>;
export type NestedValue = unknown;

// Configuration override types  
export type ConfigurationOverride = Record<string, unknown>;

// Type mappings for different language conversions
export interface TypeMappings {
  [sourceType: string]: string;
}

// Language conversion pair interface with proper typing
export interface LanguageConversionPair {
  from: string;
  to: string;
  name: string;
  typeMappings?: TypeMappings;
  specialValidation?: boolean;
}

// Enhanced configuration interface with proper generic typing
export interface EnhancedConfigurationBase {
  hooks: {
    enabled: boolean;
    autoFormat: boolean;
    validateSyntax: boolean;
    learnPatterns: boolean;
    customHooksPath?: string;
    hookTimeout: number;
    enableAsyncHooks: boolean;
  };

  agents: {
    enabled: boolean;
    maxConcurrent: number;
    coordinationStrategy: "sequential" | "parallel" | "adaptive";
    agentTimeout: number;
    enableSpecializedAgents: boolean;
    retryFailedTasks: boolean;
    maxRetries: number;
  };

  memory: {
    enabled: boolean;
    dbPath?: string;
    pruneAfterDays: number;
    maxSizeMB: number;
    enableCompression: boolean;
    enableAutoBackup: boolean;
    backupInterval: number;
    patternConfidenceThreshold: number;
  };

  languageConversion: {
    enabled: boolean;
    autoDetectEnvironment: boolean;
    parallelConversion: boolean;
    strictValidation: boolean;
    maxFilesPerBatch: number;
    enableTypeMapping: boolean;
    enablePatternLearning: boolean;
    generateCompatibilityReport: boolean;
    supportedPairs: LanguageConversionPair[];
  };

  neoRs: {
    enabled: boolean;
    autoDetectEnvironment: boolean;
    parallelConversion: boolean;
    strictValidation: boolean;
    maxFilesPerBatch: number;
    enableTypeMapping: boolean;
    enablePatternLearning: boolean;
    generateCompatibilityReport: boolean;
  };

  performance: {
    enableMetrics: boolean;
    metricsInterval: number;
    enableProfiling: boolean;
    maxMemoryUsage: number;
    enableQueryOptimization: boolean;
  };

  logging: {
    level: "debug" | "info" | "warn" | "error";
    enableFileLogging: boolean;
    logFilePath?: string;
    maxLogFiles: number;
    maxLogSizeMB: number;
  };
}