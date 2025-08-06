/**
 * Hooks Module - Enhanced AutoClaude Hook System
 *
 * This module provides the hook system for AutoClaude,
 * enabling automated workflows and pre/post processing.
 */

export { HookManager } from "./HookManager";

// Hook types and interfaces
export interface Hook {
  id: string;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  blocking: boolean;
  timeout: number;
  execute: (context: HookContext) => Promise<HookResult>;
}

export interface HookContext {
  operation: string;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
  timestamp: Date;
  workspaceRoot?: string;
  workspacePath?: string;
}

export interface HookResult {
  success: boolean;
  modified: boolean;
  output?: any;
  error?: string;
  warnings?: string[];
  metadata?: Record<string, any>;
  duration: number;
}

export interface HookStatistics {
  hookId: string;
  name: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  lastExecuted?: Date;
  totalDuration: number;
}

// Built-in hook implementations
export { SyntaxValidationHook } from "./hooks/SyntaxValidationHook";
export { AutoFormatHook } from "./hooks/AutoFormatHook";
export { PatternLearningHook } from "./hooks/PatternLearningHook";
export { NeoRsValidationHook } from "./hooks/NeoRsValidationHook";

// Hook utilities
export function createHookContext(
  operation: string,
  input?: any,
  metadata?: Record<string, any>,
): HookContext {
  return {
    operation,
    input,
    metadata: metadata || {},
    timestamp: new Date(),
  };
}

export function createHookResult(
  success: boolean,
  modified: boolean = false,
  output?: any,
  error?: string,
): HookResult {
  return {
    success,
    modified,
    output,
    error,
    duration: 0, // Will be set by hook manager
  };
}

// Hook priority constants
export const HOOK_PRIORITIES = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 5,
  LOW: 8,
  BACKGROUND: 10,
} as const;

// Hook operation constants
export const HOOK_OPERATIONS = {
  PRE_CONVERSION: "pre-conversion",
  POST_CONVERSION: "post-conversion",
  PRE_VALIDATION: "pre-validation",
  POST_VALIDATION: "post-validation",
  PRE_FORMAT: "pre-format",
  POST_FORMAT: "post-format",
  FILE_CHANGE: "file-change",
  PROJECT_LOAD: "project-load",
} as const;

// Utility functions
export function sortHooksByPriority(hooks: Hook[]): Hook[] {
  return hooks.sort((a, b) => a.priority - b.priority);
}

export function filterEnabledHooks(hooks: Hook[]): Hook[] {
  return hooks.filter((hook) => hook.enabled);
}

export function calculateSuccessRate(stats: HookStatistics): number {
  if (stats.executionCount === 0) return 0;
  return (stats.successCount / stats.executionCount) * 100;
}

export function formatHookDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(0)}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  } else {
    return `${(milliseconds / 60000).toFixed(1)}m`;
  }
}

export function isHookTimedOut(startTime: number, timeout: number): boolean {
  return Date.now() - startTime > timeout;
}
