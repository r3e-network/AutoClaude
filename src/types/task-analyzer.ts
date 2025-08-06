/**
 * Type definitions for Intelligent Task Analyzer
 */

// Memory manager with task analysis methods
export interface TaskAnalysisMemoryManager {
  searchPatterns?(searchKey: string): Promise<TaskAnalysisPattern[]>;
  searchSimilarTasks?(taskDescription: string): Promise<TaskAnalysisPattern[]>;
  getLearnedPatterns?(): Promise<TaskPattern[]>;
  learnPattern?(pattern: TaskPattern): Promise<void>;
}

// Task analysis pattern from memory
export interface TaskAnalysisPattern {
  description?: string;
  success?: boolean;
  subtasks?: PatternSubtask[];
  duration?: number;
  [key: string]: unknown;
}

// Pattern subtask structure
export interface PatternSubtask {
  type: string;
  description: string;
  requiredCapabilities: string[];
  dependencies: string[];
  estimatedDuration?: number;
  priority?: import('../agents/hivemind/types').TaskPriority;
  context?: SubtaskContext;
}

// Task context configuration
export interface TaskContextConfiguration {
  language?: string;
  framework?: string;
  testFramework?: string;
  buildTool?: string;
  [key: string]: unknown;
}

// Comprehensive task context
export interface TaskAnalysisContext {
  files: string[];
  dependencies: string[];
  relatedCode: string[];
  testFiles: string[];
  documentation: string[];
  configuration: TaskContextConfiguration;
}

// Similar task analysis
export interface SimilarTaskAnalysis {
  task: TaskAnalysisPattern;
  similarity: number;
  successful: boolean;
  subtasks: PatternSubtask[];
  duration: number;
}

// Subtask context - covers all the various context types used
export interface SubtaskContext {
  // Documentation contexts
  dddEnforcement?: boolean;
  includeArchitecture?: boolean;
  includeAPIContracts?: boolean;
  includeExamples?: boolean;
  includeErrorHandling?: boolean;
  targetType?: string;
  
  // Testing contexts
  tddEnforcement?: boolean;
  mustFailFirst?: boolean;
  minimumCoverage?: number;
  includeUnitTests?: boolean;
  includeIntegrationTests?: boolean;
  includeEdgeCases?: boolean;
  testFramework?: string;
  validateTDD?: boolean;
  mustPass?: boolean;
  
  // Implementation contexts
  entity?: string;
  action?: string;
  requiresPassingTests?: boolean;
  blockedWithoutTests?: boolean;
  blockedWithoutDocs?: boolean;
  
  // General contexts
  files?: string[];
  scope?: string;
  
  // Documentation validation contexts
  validateDDD?: boolean;
  ensureAccuracy?: boolean;
  updateExamples?: boolean;
  
  // Additional context data
  [key: string]: unknown;
}

// Pattern execution plan
export interface PatternExecutionPlan {
  phaseCount: number;
  totalDuration: number;
  parallelOpportunities: number;
}

// Task pattern for learning
export interface TaskPattern {
  key: string;
  description: string;
  intent: import('./task-analyzer').TaskIntent;
  subtaskPattern: PatternSubtask[];
  executionPlan: PatternExecutionPlan;
  timestamp: number;
}

// Task intent interface
export interface TaskIntent {
  primaryAction: string;
  targetType: string;
  scope: string;
  entities: string[];
  urgency: "low" | "medium" | "high" | "critical";
  requiresNewCode: boolean;
  requiresAnalysis: boolean;
  requiresTesting: boolean;
  requiresDocumentation: boolean;
}