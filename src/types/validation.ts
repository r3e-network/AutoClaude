/**
 * Type definitions for Validation Hooks
 */

import { MemoryManager } from "../memory/MemoryManager";
import { EnhancedConfig } from "../config/enhanced-config";

// Language conversion types
export interface LanguageConversion {
  from: string;
  to: string;
  description?: string;
  validated?: boolean;
}

// Validation configuration types
export interface ValidationConfig {
  strictMode?: boolean;
  allowPartialConversion?: boolean;
  validateTypes?: boolean;
  validateStructure?: boolean;
  supportedConversions?: LanguageConversion[];
  customRules?: ValidationRule[];
}

export interface ValidationRule {
  id: string;
  name: string;
  description?: string;
  pattern?: RegExp;
  validator?: (input: unknown) => boolean;
}

// Validation input types
export interface ValidationInput {
  content?: string;
  language?: string;
  targetLanguage?: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
}

// Validation result types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions?: ValidationSuggestion[];
  score?: number;
  details?: ValidationDetails;
}

export interface ValidationError {
  type: string;
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  type: string;
  message: string;
  line?: number;
  column?: number;
}

export interface ValidationSuggestion {
  type: string;
  message: string;
  fix?: string;
}

export interface ValidationDetails {
  typeValidation?: TypeValidationResult;
  structureValidation?: StructureValidationResult;
  performanceValidation?: PerformanceValidationResult;
  securityValidation?: SecurityValidationResult;
}

// Type validation types
export interface TypeValidationResult {
  valid: boolean;
  typeConversions?: TypeConversion[];
  incompatibleTypes?: IncompatibleType[];
}

export interface TypeConversion {
  sourceType: string;
  targetType: string;
  compatible: boolean;
  conversionNote?: string;
}

export interface IncompatibleType {
  type: string;
  reason: string;
  suggestion?: string;
}

// Structure validation types
export interface StructureValidationResult {
  valid: boolean;
  structuralIssues?: StructuralIssue[];
  conversionNotes?: string[];
}

export interface StructuralIssue {
  element: string;
  issue: string;
  sourceLanguageFeature?: string;
  targetLanguageAlternative?: string;
}

// Performance validation types
export interface PerformanceValidationResult {
  valid: boolean;
  performanceIssues?: PerformanceIssue[];
  optimizationSuggestions?: string[];
}

export interface PerformanceIssue {
  type: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  location?: string;
}

// Security validation types
export interface SecurityValidationResult {
  valid: boolean;
  securityIssues?: SecurityIssue[];
  bestPractices?: string[];
}

export interface SecurityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation?: string;
}

// Final check types
export interface FinalCheck {
  id: string;
  name: string;
  passed: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

// Memory manager type (simplified)
export type ValidationMemoryManager = Pick<MemoryManager, 
  'recordPattern' | 'searchPatterns' | 'getPatterns'
>;

// Enhanced config type (simplified)
export type ValidationEnhancedConfig = Pick<EnhancedConfig,
  'getTechStack' | 'getProjectPatterns' | 'initialize'
>;