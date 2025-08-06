/**
 * Type definitions for Production Agents
 */

// Test analysis types
export interface TestAnalysisResult {
  issues: string[];
  suggestedFixes: string[];
  affectedFiles: string[];
}

export interface TestCoverageAnalysis {
  coverage: number;
  uncoveredFiles: string[];
  testableFiles: string[];
}

// Project analysis types
export interface ProjectInfo {
  name: string;
  description: string;
  version: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  type?: string;
  runtime?: string;
}

export interface ProjectTypeInfo {
  type: 'node' | 'python' | 'go' | 'generic';
  runtime: string;
}

// Code quality analysis types
export interface CodeQualityIssues {
  deadCode: string[];
  lintErrors: string[];
  outdatedDeps: string[];
  duplicateCode: string[];
  largeFiles: LargeFileInfo[];
  totalIssues: number;
}

export interface LargeFileInfo {
  path: string;
  size: number;
  lineCount: number;
}

// Agent execution result types
export interface AgentExecutionResult {
  success: boolean;
  message: string;
}

// Docker configuration types
export interface DockerConfiguration {
  dockerfile: string;
  dockerCompose: string;
  dockerIgnore: string;
}

// Documentation generation types
export interface DocumentationPlan {
  readme: string;
  apiDocs: string;
  architecture: string;
}

// Test framework detection types
export interface TestFrameworkInfo {
  framework: 'jest' | 'mocha' | 'vitest' | 'unknown';
  configFile?: string;
  testPattern: string;
  coverageCommand?: string;
}