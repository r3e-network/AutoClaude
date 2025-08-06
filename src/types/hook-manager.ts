/**
 * Type definitions for Hook Manager and Hook System
 */

// Hook context metadata
export interface HookContextMetadata {
  requestId?: string;
  userId?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  conversionType?: 'file' | 'snippet' | 'project';
  quality?: {
    confidence?: number;
    coverage?: number;
  };
  performance?: {
    executionTime?: number;
    memoryUsage?: number;
  };
  [key: string]: unknown;
}

// Hook result modification types
export type HookModification = 
  | string                    // Modified content
  | {                        // Structured modification
      content?: string;
      metadata?: Record<string, unknown>;
      suggestions?: string[];
      warnings?: string[];
    }
  | {                        // File modification
      path: string;
      content: string;
      encoding?: string;
    }
  | Record<string, unknown>  // Custom modification object
  | unknown[];               // Array of modifications

// Hook result metadata
export interface HookResultMetadata {
  timing?: {
    startTime?: number;
    endTime?: number;
    duration?: number;
  };
  resources?: {
    cpuUsage?: number;
    memoryUsage?: number;
  };
  quality?: {
    confidence?: number;
    accuracy?: number;
    coverage?: number;
  };
  patterns?: {
    applied?: string[];
    learned?: string[];
    confidence?: number[];
  };
  validation?: {
    syntaxValid?: boolean;
    semanticValid?: boolean;
    typeCompatibility?: number;
    apiCompatibility?: number;
  };
  formatting?: {
    tool?: string;
    changes?: number;
    successful?: boolean;
  };
  [key: string]: unknown;
}

// Memory manager interface for hooks
export interface HookMemoryManager {
  initialize(): Promise<void>;
  recordPattern(
    csharpPattern: string,
    rustPattern: string,
    type: 'type' | 'syntax' | 'idiom' | 'api',
    confidence?: number,
    metadata?: Record<string, unknown>
  ): Promise<void>;
}

// Enhanced config manager interface for hooks
export interface HookEnhancedConfigManager {
  initialize(): Promise<void>;
  isHooksEnabled(): boolean;
  getConfig(): {
    hooks: {
      validateSyntax: boolean;
      autoFormat: boolean;
      learnPatterns: boolean;
      customHooksPath?: string;
    };
    neoRs: {
      enabled: boolean;
      strictValidation: boolean;
    };
    [key: string]: unknown;
  };
  dispose(): void;
}