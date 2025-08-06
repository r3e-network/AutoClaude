/**
 * Type definitions for Tester Agent
 */

// Code analysis types
export interface TestCodeAnalysis {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  hasAsync: boolean;
  hasClasses: boolean;
  dependencies: string[];
}

export interface FunctionInfo {
  name: string;
  params: string[];
  isAsync: boolean;
  isExported: boolean;
  line?: number;
}

export interface ClassInfo {
  name: string;
  methods: string[];
  isExported: boolean;
  line?: number;
}

// Test result types
export interface TestResult {
  name: string;
  file: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration?: number;
  error?: string;
  stack?: string;
}

export interface TestFix {
  type: 'assertion' | 'mock' | 'async' | 'import' | 'syntax';
  line?: number;
  description: string;
  replacement?: string;
}

export interface TestFailureAnalysis {
  type: string;
  line?: number;
  fix: TestFix;
}

// Coverage types
export interface CoverageReport {
  lines: CoverageMetrics;
  branches: CoverageMetrics;
  functions: CoverageMetrics;
  statements: CoverageMetrics;
  files?: FileCoverage[];
}

export interface CoverageMetrics {
  total: number;
  covered: number;
  skipped: number;
  percentage: number;
}

export interface FileCoverage {
  path: string;
  lines: CoverageMetrics;
  branches: CoverageMetrics;
  functions: CoverageMetrics;
  statements: CoverageMetrics;
}

export interface CoverageRecommendation {
  type: 'low-coverage' | 'untested-function' | 'untested-branch' | 'missing-edge-case';
  description: string;
  file?: string;
  function?: string;
  priority: 'high' | 'medium' | 'low';
}

// Performance test types
export interface PerformanceTestConfig {
  iterations: number;
  warmup?: number;
  concurrent?: boolean;
  endpoints?: string[];
}

export interface PerformanceTestResult {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errors?: number;
  bottlenecks?: PerformanceBottleneck[];
}

export interface PerformanceBottleneck {
  type: 'cpu' | 'memory' | 'io' | 'network';
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
}

// Security test types
export interface SecurityVulnerability {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  file?: string;
  line?: number;
  cve?: string;
  fix?: string;
}

export interface SecurityFix {
  vulnerability: string;
  fixType: string;
  code?: string;
  description: string;
}

// E2E test types
export interface E2EScenario {
  name: string;
  description: string;
  steps?: string[];
  expectedResults?: string[];
}

// Generic test types
export interface TestReport {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
  failures?: TestResult[];
}