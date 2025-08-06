/**
 * Type definitions for Pattern Learning Hook
 */

// Memory manager interface for pattern learning
export interface PatternLearningMemoryManager {
  getPatterns(category: string, minConfidence: number): Promise<ExistingPattern[]>;
  updatePatternSuccess(id: string, success: boolean, confidence: number): Promise<void>;
  recordPattern(
    input: string,
    output: string, 
    category: string,
    confidence: number
  ): Promise<void>;
  recordValidation(
    originalCode: string,
    convertedCode: string,
    type: string,
    score: number,
    success: boolean
  ): Promise<void>;
}

// Existing pattern structure from memory
export interface ExistingPattern {
  id: string;
  input_pattern: string;
  output_pattern: string;
  category: string;
  confidence: number;
  usage_count?: number;
  success_count?: number;
  failure_count?: number;
  created_at?: string;
  last_used?: string;
}

// Learning result structure
export interface LearningResult {
  patternsLearned: number;
  newPatterns: string[];
  updatedPatterns: string[];
  category?: string;
  confidence?: number;
}

// Conversion input for pattern learning
export interface ConversionInput {
  originalCode: string;
  convertedCode: string;
  success: boolean;
  confidence: number;
  metadata?: {
    sourceLanguage?: string;
    targetLanguage?: string;
    conversionType?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

// Validation input for pattern learning
export interface ValidationInput {
  originalCode: string;
  convertedCode: string;
  validationResult: ValidationResult;
  success: boolean;
  metadata?: {
    validationType?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

// Validation result structure
export interface ValidationResult {
  compatibilityScore: number;
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  suggestions?: string[];
  neoSpecificChecks?: unknown[];
  typeCompatibility?: number;
  apiCompatibility?: number;
  [key: string]: unknown;
}