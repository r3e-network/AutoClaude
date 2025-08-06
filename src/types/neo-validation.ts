/**
 * Type definitions for Neo-rs Validation Hook
 */

import { MemoryManager } from '../memory/MemoryManager';

// Memory manager interface
export interface NeoMemoryManager extends MemoryManager {
  recordValidation(
    originalCode: string,
    convertedCode: string,
    type: string,
    score: number,
    success: boolean
  ): Promise<void>;
}

// Validation input types
export interface ConversionInput {
  originalCode: string;
  convertedCode: string;
  metadata?: Record<string, unknown>;
}

export interface PreValidationInput {
  filePath?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface FinalValidationInput {
  originalCode: string;
  convertedCode: string;
  validationResults?: unknown[];
}

// Validation result types
export interface NeoTypeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  typeMapping: Record<string, string>;
}

export interface NeoProtocolValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  protocolFeatures: string[];
}

export interface SmartContractValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  contractPatterns: string[];
}

export interface VMIntegrationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  vmFeatures: string[];
}

export interface ConsensusValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  consensusFeatures: string[];
}

export interface StructuralValidation {
  isValid: boolean;
  structureScore: number;
  issues: string[];
}

export interface FunctionalEquivalenceValidation {
  isValid: boolean;
  functionalScore: number;
  equivalenceIssues: string[];
}

export interface PerformanceValidation {
  isValid: boolean;
  performanceScore: number;
  performanceIssues: string[];
}

export interface SecurityValidation {
  isValid: boolean;
  securityScore: number;
  securityIssues: string[];
}

// Neo-specific check types
export type NeoSpecificCheck = 
  | NeoTypeValidation
  | NeoProtocolValidation
  | SmartContractValidation
  | VMIntegrationValidation
  | ConsensusValidation;

// Comprehensive validation results
export interface ConversionValidationResult {
  isValid: boolean;
  compatibilityScore: number;
  errors: string[];
  warnings: string[];
  neoSpecificChecks: NeoSpecificCheck[];
}

export interface PreValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  neoDetected: boolean;
}

export interface FinalCheckResult {
  type: 'structural' | 'functional' | 'performance' | 'security';
  result: StructuralValidation | FunctionalEquivalenceValidation | PerformanceValidation | SecurityValidation;
}

export interface FinalValidationResult {
  isValid: boolean;
  overallCompatibility: number;
  finalChecks: FinalCheckResult[];
  readyForProduction: boolean;
}

// Union type for all validation results
export type ValidationResult = 
  | ConversionValidationResult 
  | PreValidationResult 
  | FinalValidationResult;