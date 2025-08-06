/**
 * Type definitions for agent-related structures
 */

// CoderAgent types
export interface DataItem {
  id?: number;
  [key: string]: unknown;
}

export interface ProcessorConfig {
  [key: string]: unknown;
}

export interface RefactoringInfo {
  type: string;
  location: string;
  description: string;
  priority?: number;
}

export interface PerformanceOptimization {
  type: string;
  description: string;
  impact?: string;
  location?: string;
}

export interface ErrorFix {
  errorType: string;
  fixDescription: string;
  line?: number;
  column?: number;
  replacement?: string;
}

export interface FeatureRequirements {
  name: string;
  type: string;
  components: string[];
  dependencies: string[];
}

export interface ComponentPlan {
  name: string;
  type: string;
  description?: string;
}

export interface ImplementationPlan {
  components: ComponentPlan[];
  integrationPoints: string[];
  testingStrategy: string;
}

export interface CodeContext {
  file?: string;
  language?: string;
  framework?: string;
  dependencies?: string[];
  [key: string]: unknown;
}

// SubAgent types
export interface SubAgentMessage {
  command: string;
  data?: unknown;
  [key: string]: unknown;
}

export interface SubAgentResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

// Task analysis types
export interface TaskAnalysis {
  type: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedTime?: number;
  requiredSkills?: string[];
  dependencies?: string[];
}

export interface WorkDetection {
  hasWork: boolean;
  workCount: number;
  suggestedAgents: number;
  workItems?: WorkItem[];
}

export interface WorkItem {
  id: string;
  type: string;
  priority: number;
  description: string;
  file?: string;
  line?: number;
}