/**
 * Agents Module - Enhanced AutoClaude Agent System
 *
 * This module provides the agent coordination system for AutoClaude,
 * enabling multi-agent task processing and coordination.
 */

export { AgentCoordinator } from "./AgentCoordinator";

// Agent types
export interface Agent {
  id: string;
  type: string;
  status: "idle" | "busy" | "error";
  capabilities: string[];
  lastActivity: Date;
  taskCount: number;
  errorCount: number;
}

export interface Task {
  id: string;
  type: string;
  priority: number;
  status: "pending" | "processing" | "completed" | "failed";
  description: string;
  input: any;
  output?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  assignedAgent?: string;
  retryCount: number;
}

export interface AgentResult {
  success: boolean;
  output?: any;
  error?: string;
  metrics?: {
    duration: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

// Re-export from existing agents
export { ParallelAgentOrchestrator } from "./ParallelAgentOrchestrator";
export { WorkDistributor } from "./WorkDistributor";
export { AutoWorkDetector } from "./AutoWorkDetector";
export { AutoOrchestrationCoordinator } from "./AutoOrchestrationCoordinator";
export { ConverterAgent } from "./ConverterAgent";
export { ValidatorAgent } from "./ValidatorAgent";
export { UniversalConverterAgent } from "./UniversalConverterAgent";
export { UniversalValidatorAgent } from "./UniversalValidatorAgent";

// Utility functions
export function createAgent(
  id: string,
  type: string,
  capabilities: string[],
): Agent {
  return {
    id,
    type,
    status: "idle",
    capabilities,
    lastActivity: new Date(),
    taskCount: 0,
    errorCount: 0,
  };
}

export function createTask(
  type: string,
  description: string,
  input: any,
  priority: number = 5,
): Omit<Task, "id" | "createdAt"> {
  return {
    type,
    priority,
    status: "pending",
    description,
    input,
    retryCount: 0,
  };
}

// Agent status helpers
export function getAgentStatusSummary(agents: Agent[]): {
  total: number;
  idle: number;
  busy: number;
  error: number;
} {
  const summary = {
    total: agents.length,
    idle: 0,
    busy: 0,
    error: 0,
  };

  agents.forEach((agent) => {
    summary[agent.status]++;
  });

  return summary;
}

export function getTaskStatusSummary(tasks: Task[]): {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
} {
  const summary = {
    total: tasks.length,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  tasks.forEach((task) => {
    summary[task.status]++;
  });

  return summary;
}
