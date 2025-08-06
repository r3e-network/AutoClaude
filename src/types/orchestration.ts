/**
 * Type definitions for Unified Orchestration System
 */

// Intent types
export interface TaskIntent {
  command: string;
  type: IntentType;
  description?: string;
  targetFiles?: string[];
  parameters?: Record<string, unknown>;
}

export type IntentType = 
  | 'feature'
  | 'bug-fix'
  | 'refactoring'
  | 'testing'
  | 'optimization'
  | 'documentation'
  | 'general';

// Workflow types
export interface WorkflowInfo {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  tasks: string[];
}

// Code change types
export interface CodeChange {
  file: string;
  type: 'todo' | 'fixme' | 'hack' | 'bug' | 'deprecated' | 'console-log' | 'any-type';
  line: number;
  content: string;
  priority: number;
  description: string;
}

// Build status types
export interface BuildStatus {
  success: boolean;
  errors: BuildError[];
  warnings: string[];
  duration?: number;
}

export interface BuildError {
  file: string;
  line: number;
  column: number;
  message: string;
  type: string;
}

// Test types
export interface FailingTest {
  name: string;
  file: string;
  error: string;
  type: 'unit' | 'integration' | 'e2e';
  priority: number;
}

// Pending work types
export interface PendingWork {
  type: 'todo' | 'fixme' | 'hack';
  file: string;
  line: number;
  content: string;
  priority: number;
}

// Validation result types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score?: number;
}

export interface ValidationError {
  type: string;
  message: string;
  file?: string;
  line?: number;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  type: string;
  message: string;
  file?: string;
  line?: number;
}

// Task subtask types
export interface TaskSubtask {
  name: string;
  description: string;
  agent?: string;
  tools?: string[];
  priority?: number;
}