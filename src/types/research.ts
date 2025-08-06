/**
 * Type definitions for Researcher Agent
 */

// Code analysis types
export interface CodeAnalysis {
  fileCount: number;
  totalLines: number;
  complexity: number;
  maintainabilityIndex: number;
  techDebtHours: number;
  files: FileAnalysis[];
  languages: Record<string, number>;
  frameworks: string[];
}

export interface FileAnalysis {
  path: string;
  lines: number;
  complexity: number;
  functions: number;
  classes: number;
  imports: number;
  exports: number;
}

// Pattern analysis types
export interface Pattern {
  type: string;
  name: string;
  occurrences: number;
  locations: string[];
  description: string;
  category: 'design' | 'architectural' | 'coding' | 'testing';
  recommendation?: string;
}

export interface AntiPattern {
  type: string;
  name: string;
  occurrences: number;
  locations: string[];
  severity: 'low' | 'medium' | 'high';
  impact: string;
  recommendation?: string;
}

export interface ImprovementOpportunity {
  pattern: string;
  antiPattern?: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  target?: string;
}

// Best practices types
export interface BestPractice {
  name: string;
  category: string;
  description: string;
  implemented: boolean;
  examples?: string[];
}

export interface CurrentPractice {
  name: string;
  category: string;
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  locations: string[];
}

export interface PracticeGap {
  practice: string;
  current: string;
  target: string;
  priority: 'low' | 'medium' | 'high';
  effort: string;
}

// Technology research types
export interface TechnologyResearch {
  name: string;
  type: string;
  description: string;
  pros: string[];
  cons: string[];
  useCases: string[];
  maturity: 'experimental' | 'stable' | 'mature' | 'legacy';
  adoption: 'low' | 'medium' | 'high';
  alternatives: string[];
}

// Dependency analysis types
export interface Dependency {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer';
  license: string;
  size?: number;
  lastUpdate?: Date;
}

export interface DependencyAnalysis {
  vulnerabilities: number;
  outdated: number;
  totalSize: number;
  licenses: Record<string, number>;
  updatePriority?: 'low' | 'medium' | 'high';
}

export interface DependencyUpdate {
  name: string;
  currentVersion: string;
  latestVersion: string;
  type: 'patch' | 'minor' | 'major';
  breaking: boolean;
}

// Performance analysis types
export interface PerformanceData {
  loadTime: number;
  memoryUsage: number;
  cpuUsage: number;
  requestsPerSecond?: number;
  averageResponseTime?: number;
  errorRate?: number;
}

export interface PerformanceBottleneck {
  type: 'cpu' | 'memory' | 'io' | 'network' | 'database';
  location: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metrics?: Record<string, number>;
}

export interface PerformanceOptimization {
  type: string;
  target: string;
  description: string;
  expectedImprovement: string;
  effort: 'low' | 'medium' | 'high';
  impact?: 'low' | 'medium' | 'high';
  suggestion?: string;
}

// Security analysis types
export interface SecurityAnalysis {
  score: number;
  vulnerabilities: SecurityThreat[];
  compliance: Record<string, boolean>;
  lastScan: Date;
}

export interface SecurityThreat {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: string;
  cve?: string;
}

export interface SecurityMitigation {
  threat: string;
  mitigation: string;
  priority: 'low' | 'medium' | 'high' | 'immediate';
  effort: string;
}

// Generic research types
export interface ResearchFinding {
  topic: string;
  finding: string;
  source?: string;
  confidence: 'low' | 'medium' | 'high';
  relevance: 'low' | 'medium' | 'high';
}