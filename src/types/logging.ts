/**
 * Type definitions for logging components
 */

// Context type for logging - can contain any serializable data
export type LogContext = Record<string, unknown> | unknown[] | string | number | boolean | null | undefined;

// Console replacement arguments
export type ConsoleArgs = unknown[];