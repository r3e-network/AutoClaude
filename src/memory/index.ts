/**
 * Memory System for AutoClaude
 *
 * Provides persistent storage for learned patterns, conversion history,
 * and agent memories using SQLite database.
 */

export {
  MemoryManager,
  getMemoryManager,
  closeAllMemoryManagers,
} from "./MemoryManager.production";

// Re-export types for convenience
export type {
  ConversionPattern,
  ProjectContext,
  ConversionHistory,
  AgentMemory,
  TypeMapping,
  MemoryConfig,
} from "./MemoryManager.production";
