/**
 * Type definitions for AutoClaude manager instances
 * This file defines interfaces for the various manager classes used in extension.ts
 */

import { MemoryManager } from "../memory";
import { EnhancedConfigManager } from "../config/enhanced-config";
import { HookManager } from "../hooks/HookManager";
import { AgentCoordinator } from "../agents/AgentCoordinator";
import { SystemMonitor } from "../monitoring/SystemMonitor";

// Export type aliases for better readability
export type AutoClaudeMemoryManager = MemoryManager;
export type AutoClaudeConfigManager = EnhancedConfigManager;
export type AutoClaudeHookManager = HookManager;
export type AutoClaudeAgentCoordinator = AgentCoordinator;
export type AutoClaudeSystemMonitor = SystemMonitor;

// Combined interface for all managers
export interface AutoClaudeManagers {
  memoryManager: MemoryManager | null;
  enhancedConfig: EnhancedConfigManager | null;
  hookManager: HookManager | null;
  agentCoordinator: AgentCoordinator | null;
  systemMonitor: SystemMonitor | null;
}