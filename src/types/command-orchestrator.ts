/**
 * Type definitions for Command Orchestrator
 */

// Task-related types for resumption and tracking
export interface ResumableTask {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused';
  taskType: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

// Workflow step definition
export interface WorkflowStep {
  taskId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  command?: string;
  subAgent?: string;
  dependencies?: string[];
  estimatedDuration?: number;
  metadata?: Record<string, unknown>;
}

// Active workflow tracking
export interface ActiveWorkflow {
  id: string;
  title: string;
  progress: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
  steps: WorkflowStep[];
  startedAt: string;
  estimatedCompletion?: string;
}

// Sub-agent interface
export interface SubAgent {
  id: string;
  name: string;
  execute(): Promise<{
    success: boolean;
    message: string;
    outputs?: string[];
    metadata?: Record<string, unknown>;
  }>;
}

// Sub-agent runner interface
export interface SubAgentRunnerInterface {
  subAgents: Map<string, SubAgent>;
  registerAgent(id: string, agent: SubAgent): void;
  getAgent(id: string): SubAgent | undefined;
  executeAgent(id: string, options?: Record<string, unknown>): Promise<unknown>;
}

// Task manager interface for adding context
export interface TaskManagerInterface {
  getTask(id: string): ResumableTask | null;
  updateTask(id: string, updates: Partial<ResumableTask>): void;
  addTaskContext(id: string, context: {
    outputs?: string[];
    errors?: string[];
    metadata?: Record<string, unknown>;
  }): void;
}

// Step failure recovery context
export interface StepFailureContext {
  taskId: string;
  name: string;
  error: string;
  retryCount?: number;
  lastAttempt?: string;
  workflow?: unknown;
  metadata?: Record<string, unknown>;
}