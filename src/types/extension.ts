/**
 * Type definitions for extension.ts
 * This file contains interfaces for various data structures used in the VS Code extension
 */

import { AgentType, AgentStatus } from "../agents/AgentCoordinator";
import { ScriptConfig } from "../scripts";

// Agent status interface
export interface AgentStatusInfo {
  id: string;
  type: AgentType;
  name: string;
  status: AgentStatus;
  currentTask?: string;
  lastActivity?: Date;
}

// Hook status interface
export interface HookStatusInfo {
  id: string;
  name: string;
  enabled: boolean;
  type: "pre" | "post";
  operation: string;
  executionCount: number;
  lastExecuted?: Date;
}

// Message type for webview communication
export interface WebviewMessage {
  command: string;
  sessionId?: string;
  csrfToken?: string;
  data?: unknown;
  payload?: unknown;
  text?: string;
  scriptId?: string;
  [key: string]: string | number | boolean | unknown | undefined;
}

// Step interface for script execution
export interface ScriptStep {
  name: string;
  command: string;
  description?: string;
  condition?: string;
}

// Script configuration with execution details
export interface ScriptConfigWithExecution extends ScriptConfig {
  executionOrder?: number;
  dependencies?: string[];
  steps?: ScriptStep[];
}

// Script execution result
export interface ScriptExecutionResult {
  scriptId: string;
  scriptName: string;
  passed: boolean;
  errors: string[];
  warnings?: string[];
  executionTime?: number;
}

// Memory statistics interfaces
export interface PerformanceStats {
  queryCount: number;
  averageQueryTime: number;
  databaseSize: number;
  tableStats: Record<string, number>;
}

export interface ConversionStats {
  overall: {
    total_conversions: number;
    successful: number;
    avg_duration_ms?: number;
    total_projects: number;
  };
}

// Queue status interface
export interface QueueStatus {
  queueLength: number;
  activeTasks: number;
  completedTasks: number;
}