/**
 * Type definitions for Memory System
 */

// Error and warning types
export interface ConversionError {
  type: string;
  message: string;
  line?: number;
  column?: number;
  file?: string;
}

export interface ConversionWarning {
  type: string;
  message: string;
  line?: number;
  column?: number;
  file?: string;
}

// Pattern similarity type
export interface PatternWithSimilarity extends ConversionPattern {
  similarity: number;
}

// Database method types
export type DatabaseRunResult = {
  lastID?: number;
  changes?: number;
};

export type DatabaseGetResult<T> = T | undefined;
export type DatabaseAllResult<T> = T[];

// Memory value types - can be any serializable data
export type MemoryValue = string | number | boolean | object | null;

// Query parameter types
export type QueryParams = Array<string | number | boolean | null>;

// Error context type
export type ErrorContext = Record<string, unknown>;

// Define ConversionPattern interface locally since it's in the same file being fixed
export interface ConversionPattern {
  id?: number;
  pattern_hash: string;
  csharp_pattern: string;
  rust_pattern: string;
  pattern_type: "type" | "syntax" | "idiom" | "api";
  confidence: number;
  usage_count: number;
  success_count: number;
  failure_count: number;
  metadata?: ConversionMetadata;
  last_used?: string;
  created_at?: string;
}

// Database promisified method signatures
export interface PromisifiedDatabase {
  run: (sql: string, params?: QueryParams) => Promise<DatabaseRunResult>;
  get: <T>(sql: string, params?: QueryParams) => Promise<DatabaseGetResult<T>>;
  all: <T>(sql: string, params?: QueryParams) => Promise<DatabaseAllResult<T>>;
  exec: (sql: string) => Promise<void>;
}

// SQLite Memory System types
export interface CacheEntry {
  key: string;
  type: string;
  context: Record<string, unknown>;
  result: unknown;
  created_at: string;
  accessed_at: string;
  access_count: number;
}

export interface TaskRecord {
  id: string;
  type: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  duration?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionData {
  id: string;
  started_at: string;
  ended_at?: string;
  task_count: number;
  success_count: number;
  error_count: number;
  metadata?: Record<string, unknown>;
}

export interface InsightRecord {
  id: string;
  type: string;
  content: string;
  confidence: number;
  source: string;
  created_at: string;
  validated: boolean;
  context?: Record<string, unknown>;
}

export interface PatternRow {
  id: string;
  type: string;
  frequency: number;
  success_rate: number;
  average_duration: number;
  metadata?: string;
}

export interface ContextRow {
  task_type: string;
  context_key: string;
  context_value: string;
  frequency: number;
}

export interface InsightRow {
  type: string;
  content: string;
  confidence: number;
  created_at: string;
}

// Additional Memory Manager types
export interface ConversionMetadata {
  [key: string]: unknown;
}

export interface ProjectMetadata {
  [key: string]: unknown;
}

export interface AgentMemoryValue {
  [key: string]: unknown;
}

export type DatabaseMethod = {
  (sql: string, params?: QueryParams): Promise<DatabaseRunResult>;
  (sql: string, callback: (err: Error | null, result: DatabaseRunResult) => void): void;
};

export type DatabaseGetMethod = {
  <T>(sql: string, params?: QueryParams): Promise<T | undefined>;
  <T>(sql: string, callback: (err: Error | null, result: T | undefined) => void): void;
};

export type DatabaseAllMethod = {
  <T>(sql: string, params?: QueryParams): Promise<T[]>;
  <T>(sql: string, callback: (err: Error | null, results: T[]) => void): void;
};

// Conversion statistics types
export interface ConversionOverallStats {
  total_conversions: number;
  successful: number;
  avg_duration_ms: number;
  total_projects: number;
}

export interface ConversionPatternStats {
  total_patterns: number;
  avg_confidence: number;
  total_usage: number;
  total_successes: number;
  total_failures: number;
}

export interface TopPattern {
  pattern_type: string;
  csharp_pattern: string;
  rust_pattern: string;
  confidence: number;
  usage_count: number;
}

export interface ConversionStats {
  overall: ConversionOverallStats;
  patterns: ConversionPatternStats;
  topPatterns: TopPattern[];
}

// History record with parsed arrays
export interface ParsedConversionHistory {
  id?: number;
  project_id: number;
  source_file: string;
  target_file: string;
  file_hash: string;
  conversion_status: string;
  agent_id?: string;
  duration_ms?: number;
  errors: ConversionError[];
  warnings: ConversionWarning[];
  patterns_applied: string[];
  created_at?: string;
}