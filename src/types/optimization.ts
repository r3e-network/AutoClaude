/**
 * Type definitions for Optimization Agent
 */

// Performance audit types
export interface PerformanceAudit {
  loadTime: number;
  memoryUsage: number;
  cpuUsage: number;
  bottlenecks: PerformanceBottleneck[];
  recommendations: string[];
  overallScore?: number;
  bundleSize?: number;
  cacheHitRate?: number;
}

export interface PerformanceBottleneck {
  type: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  description: string;
  metrics?: Record<string, number>;
}

// Optimization types
export interface OptimizationItem {
  type: OptimizationType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  target: string;
  description: string;
  expectedImprovement: number;
  code?: string;
  implemented?: boolean;
  codeChanges?: string[];
  optimizedCode?: string;
  filePath?: string;
  originalComplexity?: number;
  optimizedComplexity?: number;
  performanceGain?: number;
  linesChanged?: number;
  memoryReduction?: number;
  optimizedQuery?: string;
  queryId?: string;
  originalExecutionTime?: number;
  optimizedExecutionTime?: number;
  improvement?: number;
  loadTimeImprovement?: number;
}

export type OptimizationType = 
  | 'database-optimization'
  | 'memory-optimization'
  | 'performance-optimization'
  | 'code-optimization'
  | 'algorithm-optimization'
  | 'cache-optimization'
  | 'bundle-optimization'
  | 'build-optimization';

// Memory profiling types
export interface MemoryProfile {
  totalMemory: number;
  usedMemory: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  memoryLeaks: MemoryLeak[];
}

export interface MemoryLeak {
  type: 'event-listener' | 'timer' | 'closure' | 'dom-reference' | 'global-variable';
  location: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  size?: number;
}

// Build configuration types
export interface BuildConfig {
  buildTool: string;
  outputPath: string;
  entryPoints: string[];
  optimizations: BuildOptimization[];
  plugins: BuildPlugin[];
}

export interface BuildOptimization {
  type: string;
  enabled: boolean;
  buildTimeReduction: number;
  bundleSizeReduction: number;
  description: string;
}

export interface BuildPlugin {
  name: string;
  config: Record<string, unknown>;
}

// Database optimization types
export interface DatabaseAnalysis {
  slowQueries: SlowQuery[];
  missingIndexes: MissingIndex[];
  schema: SchemaAnalysis;
  queryCount: number;
  avgQueryTime: number;
}

export interface SlowQuery {
  id: string;
  query: string;
  executionTime: number;
  frequency: number;
  table: string;
}

export interface MissingIndex {
  table: string;
  columns: string[];
  estimatedImprovement: number;
}

export interface SchemaAnalysis {
  tables: string[];
  issues: string[];
  recommendations: string[];
}

// Cache optimization types
export interface CacheAnalysis {
  hitRate: number;
  missRate: number;
  averageResponseTime: number;
  cacheSize: number;
  evictionRate: number;
  hotKeys: string[];
}

export interface CacheStrategy {
  type: 'redis' | 'memory' | 'distributed' | 'browser';
  priority: 'low' | 'medium' | 'high';
  ttl: number;
  maxSize: number;
  evictionPolicy: string;
}

export interface CacheOptimizationStrategy {
  strategies: CacheStrategy[];
  estimatedImprovement: number;
  implementation: string;
  expectedHitRateImprovement?: number;
  expectedResponseTimeImprovement?: number;
  recommendedTTL?: Record<string, number>;
}

// Bundle optimization types
export interface BundleAnalysis {
  totalSize: number;
  chunks: BundleChunk[];
  duplicateModules: string[];
  unusedExports: string[];
  largeModules: ModuleInfo[];
}

export interface BundleChunk {
  name: string;
  type: string;
  size: number;
  modules: string[];
}

export interface ModuleInfo {
  name: string;
  size: number;
  path: string;
}

// Algorithm optimization types
export interface AlgorithmAnalysis {
  file: string;
  functionName: string;
  currentComplexity: string;
  optimizedComplexity: string;
  algorithmType: 'search' | 'sort' | 'graph' | 'dynamic-programming' | 'other';
  issues: string[];
  improvement: number;
}

export interface AlgorithmOptimization {
  target: string;
  currentComplexity: string;
  optimizedComplexity: string;
  improvement: number;
  optimizedCode: string;
  filePath?: string;
  originalComplexity?: string;
  algorithmType?: string;
  performanceGain?: number;
}

// File analysis types
export interface FileAnalysis {
  file: string;
  issues: OptimizationIssue[];
  opportunities: OptimizationOpportunity[];
}

export interface OptimizationIssue {
  type: string;
  line: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface OptimizationOpportunity {
  type: string;
  location: string;
  potentialImprovement: string;
  suggestion: string;
}

// Generic optimization types
export interface OptimizationRecommendation {
  area: string;
  issue: string;
  recommendation: string;
  priority: 'low' | 'medium' | 'high';
  estimatedImprovement: string;
  impact?: string;
}