/**
 * Type definitions for Agent Coordinator and Agent System
 */

import { Agent } from '../agents/AgentCoordinator';

// Agent metadata types
export interface AgentMetadata {
  loadedPatterns?: number;
  toolchainAvailable?: boolean;
  [key: string]: unknown;
}

// Task input types for different task types
export type ConvertFileInput = {
  filePath: string;
  content: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  options?: ConversionOptions;
};

export type ValidateConversionInput = {
  convertedContent: string;
  originalContent: string;
  filePath: string;
  sourceLanguage?: string;
  targetLanguage?: string;
};

export type AnalyzeCodeInput = {
  content: string;
  filePath?: string;
  language?: string;
  analysisType?: 'syntax' | 'semantic' | 'performance' | 'security';
};

export type GenerateTestsInput = {
  sourceCode: string;
  language: string;
  testFramework?: string;
  coverageTarget?: number;
};

export type TaskInput = 
  | ConvertFileInput 
  | ValidateConversionInput 
  | AnalyzeCodeInput 
  | GenerateTestsInput
  | string
  | Record<string, unknown>
  | unknown[];

// Task metadata types
export interface TaskMetadata {
  requestId?: string;
  userId?: string;
  timestamp?: number;
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

// Task result output types
export interface ConversionResult {
  originalPath: string;
  convertedPath: string;
  originalContent: string;
  convertedContent: string;
  patternsApplied?: string[];
  confidence?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  neoCompatibility?: number;
  syntaxScore?: number;
  semanticScore?: number;
}

export interface AnalysisResult {
  complexity: number;
  maintainabilityIndex: number;
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    line?: number;
    column?: number;
  }>;
  suggestions: string[];
  metrics: Record<string, number>;
}

export interface TestGenerationResult {
  testCode: string;
  testCount: number;
  estimatedCoverage: number;
  framework: string;
  dependencies: string[];
}

export type TaskOutput = 
  | ConversionResult 
  | ValidationResult 
  | AnalysisResult 
  | TestGenerationResult
  | string
  | Record<string, unknown>
  | unknown[];

// Task result metadata
export interface TaskResultMetadata {
  performance?: {
    cpuUsage?: number;
    memoryUsage?: number;
    diskIO?: number;
  };
  quality?: {
    confidence?: number;
    coverage?: number;
    accuracy?: number;
  };
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

// Conversion options
export interface ConversionOptions {
  preserveComments?: boolean;
  generateTests?: boolean;
  optimizeCode?: boolean;
  followConventions?: boolean;
  includeDocs?: boolean;
  strictMode?: boolean;
  [key: string]: unknown;
}

// Pattern types for conversion learning
export interface ConversionPattern {
  id?: string;
  csharp_pattern: string;
  rust_pattern: string;
  pattern_type: 'syntax' | 'idiom' | 'api' | 'type';
  confidence: number;
  usage_count?: number;
  success_count?: number;
  failure_count?: number;
  metadata?: Record<string, unknown>;
}

// Learning result for agents
export interface LearningResult {
  task: string;
  patterns?: string[];
  confidence: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

// Memory manager interface with required agent methods
export interface AgentMemoryManager {
  initialize(): Promise<void>;
  storeAgentMemory(
    agentId: string,
    key: string,
    value: unknown,
    importance?: number
  ): Promise<void>;
  recordTaskCompletion(
    taskId: string,
    taskType: string,
    success: boolean,
    error: string,
    executionTime: number
  ): Promise<void>;
  getPerformanceStats(): Promise<{
    totalTasks?: number;
    successRate?: number;
    averageExecutionTime?: number;
    [key: string]: unknown;
  }>;
  findSimilarPatterns(
    content: string,
    patternType?: string,
    limit?: number
  ): Promise<ConversionPattern[]>;
}

// Enhanced config interface
export interface AgentEnhancedConfig {
  agents: {
    enabled: boolean;
    maxConcurrent: number;
    maxRetries: number;
    retryFailedTasks: boolean;
    coordinationStrategy: 'sequential' | 'parallel' | 'adaptive';
  };
  languageConversion: {
    enabled: boolean;
  };
  neoRs: {
    enabled: boolean;
  };
  [key: string]: unknown;
}

export interface AgentEnhancedConfigManager {
  initialize(): Promise<void>;
  getConfig(): AgentEnhancedConfig;
  dispose(): void;
}