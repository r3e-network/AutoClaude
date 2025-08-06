/**
 * Type definitions for Researcher Agent
 */

export interface ResearchContext {
  topic: string;
  scope?: string;
  depth?: 'shallow' | 'medium' | 'deep';
  sources?: string[];
  constraints?: string[];
}

export interface ResearchResult {
  findings: Finding[];
  summary: string;
  recommendations?: string[];
  sources: Source[];
  confidence: number;
}

export interface Finding {
  topic: string;
  description: string;
  evidence: string[];
  relevance: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface Source {
  type: 'file' | 'url' | 'database' | 'api';
  location: string;
  credibility: number;
  lastAccessed: Date;
}

export interface Pattern {
  name: string;
  description: string;
  frequency: number;
  contexts: string[];
  recommendation?: string;
}

export interface AntiPattern {
  name: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  occurrences: number;
  recommendation?: string;
}

export interface DependencyAnalysis {
  dependencies: Dependency[];
  vulnerabilities: Vulnerability[];
  outdated: OutdatedDependency[];
  unused: string[];
  updatePriority?: 'low' | 'medium' | 'high';
}

export interface Dependency {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer';
  license?: string;
  size?: number;
}

export interface Vulnerability {
  package: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  fixVersion?: string;
}

export interface OutdatedDependency {
  name: string;
  current: string;
  latest: string;
  type: 'major' | 'minor' | 'patch';
}

export interface PerformanceOptimization {
  type: 'algorithm' | 'database' | 'network' | 'memory' | 'cpu' | 'io';
  target: string;
  description: string;
  expectedImprovement: number;
  effort: 'low' | 'medium' | 'high';
  impact?: 'low' | 'medium' | 'high';
  suggestion?: string;
}

export interface ImprovementOpportunity {
  area: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  estimatedEffort: number;
  expectedBenefit: string;
  target?: string;
}

export interface CodebaseAnalysis {
  structure: ProjectStructure;
  patterns: Pattern[];
  antiPatterns: AntiPattern[];
  metrics: CodebaseMetrics;
  improvements: ImprovementOpportunity[];
}

export interface ProjectStructure {
  architecture: string;
  layers: string[];
  modules: ModuleInfo[];
  dependencies: DependencyGraph;
}

export interface ModuleInfo {
  name: string;
  path: string;
  size: number;
  complexity: number;
  dependencies: string[];
}

export interface DependencyGraph {
  nodes: string[];
  edges: Array<{ from: string; to: string; type: string }>;
  cycles?: string[][];
}

export interface CodebaseMetrics {
  totalFiles: number;
  totalLines: number;
  averageComplexity: number;
  testCoverage?: number;
  technicalDebt?: number;
}

export interface TaskMetrics {
  startTime: number;
  endTime?: number;
  filesAnalyzed?: number;
  patternsAnalyzed?: number;
  dependenciesAnalyzed?: number;
  duration?: number;
}