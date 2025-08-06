/**
 * Type definitions for Universal Validator Agent
 */

import { Agent, Task, AgentResult } from '../agents';

// Validation rule types
export interface ValidationPattern {
  pattern: RegExp;
  message: string;
}

export interface ValidationRuleSet {
  syntaxPatterns: Record<string, RegExp>;
  commonErrors: ValidationPattern[];
  bestPractices: ValidationPattern[];
}

// Result types
export interface SyntaxValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  suggestions: string[];
}

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface CompatibilityValidationResult {
  isCompatible: boolean;
  compatibilityScore: number;
  issues: CompatibilityIssue[];
  recommendations: string[];
}

export interface CompatibilityIssue {
  type: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface CodeAnalysisResult {
  complexity: number;
  maintainability: number;
  performance: number;
  security: number;
  recommendations: string[];
  metrics: CodeMetrics;
}

export interface CodeMetrics {
  complexity?: ComplexityMetrics;
  maintainability?: MaintainabilityMetrics;
  performance?: PerformanceMetrics;
  security?: SecurityMetrics;
  [key: string]: unknown;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
}

export interface MaintainabilityMetrics {
  longLines: number;
  largeFiles: boolean;
  namingIssues: number;
}

export interface PerformanceMetrics {
  inefficientPatterns: Array<{ issue: string; count: number }>;
  memoryIssues: string[];
}

export interface SecurityMetrics {
  vulnerabilities: Array<{ type: string; count: number }>;
}

export interface ErrorDetectionResult {
  errors: DetectedError[];
  warnings: DetectedWarning[];
  summary: ErrorSummary;
}

export interface DetectedError {
  line: number;
  type: string;
  message: string;
  suggestion?: string;
}

export interface DetectedWarning {
  line: number;
  type: string;
  message: string;
  suggestion?: string;
}

export interface ErrorSummary {
  errorCount: number;
  warningCount: number;
  criticalErrors: number;
}

export interface ConversionValidationResult {
  isValid: boolean;
  validationScore: number;
  syntaxValidation: SyntaxValidationResult;
  compatibilityValidation: CompatibilityValidationResult;
  codeAnalysis: CodeAnalysisResult;
  recommendation: string;
}

export interface SecurityScanResult {
  vulnerabilities: SecurityVulnerability[];
  securityScore: number;
  summary: string;
}

export interface SecurityVulnerability {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  description: string;
  recommendation: string;
}

// Input types
export interface SyntaxValidationInput {
  code: string;
  language: string;
  strict?: boolean;
}

export interface CompatibilityValidationInput {
  originalCode: string;
  originalLanguage: string;
  convertedCode: string;
  convertedLanguage: string;
}

export interface CodeAnalysisInput {
  code: string;
  language: string;
  analysisTypes?: Array<'complexity' | 'performance' | 'security' | 'maintainability'>;
}

export interface ErrorDetectionInput {
  code: string;
  language: string;
  includeWarnings?: boolean;
}

export interface ConversionValidationInput {
  originalCode: string;
  convertedCode: string;
  sourceLanguage: string;
  targetLanguage: string;
  validationLevel?: 'basic' | 'standard' | 'strict';
}

export interface SecurityScanInput {
  code: string;
  language: string;
  scanLevel?: 'basic' | 'standard' | 'comprehensive';
}

// Analyzer types
export interface LanguageAnalyzer {
  analyzeComplexity: (code: string, lines: string[]) => AnalysisResult;
  analyzeMaintainability: (code: string, lines: string[]) => AnalysisResult;
  analyzePerformance: (code: string, lines: string[]) => AnalysisResult;
  analyzeSecurity: (code: string, lines: string[]) => AnalysisResult;
}

export interface AnalysisResult {
  score: number;
  details: Record<string, unknown>;
  recommendations: string[];
}

// Error detector types
export interface ErrorDetector {
  detectErrors: (line: string, lineNum: number) => DetectedError[];
  detectWarnings: (line: string, lineNum: number) => DetectedWarning[];
  detectCrossLineErrors: (lines: string[]) => {
    errors: DetectedError[];
    warnings: DetectedWarning[];
  };
}

// Security scanner types
export interface SecurityScanner {
  scanLine: (line: string, lineNum: number, scanLevel: string) => SecurityVulnerability[];
  scanCrossLine: (lines: string[], scanLevel: string) => SecurityVulnerability[];
}

// Structural validation types
export interface StructuralValidationResult {
  isValid: boolean;
  penaltyScore: number;
  issues: CompatibilityIssue[];
}

export interface TypeMappingValidationResult {
  isValid: boolean;
  penaltyScore: number;
  issues: CompatibilityIssue[];
}

export interface FunctionalEquivalenceResult {
  isValid: boolean;
  penaltyScore: number;
  issues: CompatibilityIssue[];
}

// Configuration types
export interface EnhancedConfiguration {
  initialize(): Promise<void>;
  getConfig(): EnhancedConfigData;
}

export interface EnhancedConfigData {
  languageConversion: {
    supportedPairs: ConversionPair[];
  };
}

export interface ConversionPair {
  from: string;
  to: string;
  name: string;
  typeMappings?: Record<string, string>;
  specialValidation?: boolean;
}

// Manager types
export interface MemoryManager {
  recordValidation(
    originalCode: string,
    convertedCode: string,
    type: string,
    score: number,
    success: boolean
  ): Promise<void>;
}