/**
 * Type definitions for Queen Agent
 */

import { HiveMindTask, HiveMindResult } from "../agents/hivemind/types";

// Task management types
export interface QueuedTask extends HiveMindTask {
  priority: number;
  timestamp: number;
  dependencies?: string[];
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface DecomposedTask {
  id: string;
  name: string;
  description: string;
  type: string;
  priority: number;
  dependencies?: string[];
  estimatedTime?: number;
  requiredAgent?: string;
}

export interface TaskGroup {
  id: string;
  tasks: DecomposedTask[];
  dependencies: string[];
  order: number;
}

// Orchestration types
export interface OrchestrationResult {
  success: boolean;
  results: TaskResult[];
  summary: string;
  errors?: string[];
  duration?: number;
}

export interface TaskResult {
  taskId: string;
  agentId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  duration?: number;
}

// Memory system types
export interface MemorySystem {
  store(key: string, value: unknown): Promise<void>;
  retrieve(key: string): Promise<unknown>;
  search(query: string): Promise<unknown[]>;
  clear(): Promise<void>;
}

// Task queue types
export interface TaskQueueInterface {
  add(task: QueuedTask): void;
  getNext(): QueuedTask | null;
  complete(task: QueuedTask): void;
  getRecentCompleted(limit?: number): QueuedTask[];
  isEmpty(): boolean;
  size(): number;
}

// Agent selection types
export interface AgentScore {
  agentId: string;
  score: number;
  capabilities: string[];
  availability: boolean;
}

// Workflow types
export interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
  variables?: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  type: string;
  agent?: string;
  inputs?: Record<string, unknown>;
  outputs?: string[];
  next?: string[];
}