/**
 * Type definitions for Advanced Hook System
 */

import { Task, AgentResult } from '../agents';

// Project context types
export interface ProjectContext {
  config: Record<string, unknown>;
  projectType?: string;
  dependencies?: Record<string, string>;
  recentFiles?: string[];
  [key: string]: unknown;
}

// Session types
export interface SessionData {
  id: string;
  startedAt: number;
  endedAt?: number;
  mode: 'swarm' | 'hive-mind';
  tasksCompleted: number;
  tasksFailed?: number;
  agents: string[];
  memory: SessionMemory;
  summary?: string;
}

export interface SessionMemory {
  filesCreated?: number;
  testsAdded?: number;
  bugsFixed?: number;
  patterns?: TaskPattern[];
  failureRate?: number;
  averageTaskDuration?: number;
  [key: string]: unknown;
}

export interface TaskPattern {
  type: string;
  description: string;
  success: boolean;
  duration: number;
  context: Record<string, unknown>;
  result: unknown;
  timestamp: number;
}

// Cache types
export interface CachedTaskResult {
  result: unknown;
  timestamp: number;
}

// Hook status types
export interface HookStatus {
  id: string;
  name: string;
  enabled: boolean;
}

export interface HookStatusReport {
  preOperation: HookStatus[];
  postOperation: HookStatus[];
  sessionStart: HookStatus[];
  sessionEnd: HookStatus[];
  [key: string]: HookStatus[];
}

// Memory manager interface
export interface HookMemoryManager {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
}

// Task result type for hook context
export interface HookTaskResult {
  success: boolean;
  data?: unknown;
  error?: string;
  artifacts?: Array<{
    type: string;
    path?: string;
    content?: string;
  }>;
}

// Extended HiveMindTask for hooks
export interface HiveMindTask extends Task {
  startedAt?: number;
  completedAt?: number;
  context?: Record<string, unknown>;
}