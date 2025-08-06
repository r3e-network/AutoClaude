/**
 * Type definitions for Universal Converter Agent
 */

import { Task, AgentResult } from '../agents';

// Configuration types
export interface ConverterMemoryManager {
  getPatterns(category: string, minConfidence: number): Promise<ConversionPattern[]>;
  recordPattern(
    input: string,
    output: string,
    category: string,
    confidence: number
  ): Promise<string>;
}

export interface ConverterConfiguration {
  initialize(): Promise<void>;
  getConfig(): ConverterConfigData;
}

export interface ConverterConfigData {
  languageConversion: {
    supportedPairs: ConversionPair[];
  };
  neoRs: {
    enabled: boolean;
  };
}

export interface ConversionPair {
  from: string;
  to: string;
  name: string;
  typeMappings?: Record<string, string>;
}

// Pattern types
export interface ConversionPattern {
  id?: string;
  input_pattern: string;
  output_pattern: string;
  category: string;
  confidence: number;
  created_at?: string;
  usage_count?: number;
}

// Result types
export interface FileConversionResult {
  convertedContent: string;
  confidence: number;
  patternsUsed: string[];
  languagePair: LanguagePair;
}

export interface SnippetConversionResult {
  convertedSnippet: string;
  confidence: number;
  explanation: string;
  languagePair: LanguagePair;
}

export interface PatternLearningResult {
  success: boolean;
  patternId?: string;
}

export interface ConversionSuggestionResult {
  detectedLanguage: string | null;
  availableConversions: Array<{
    to: string;
    name: string;
    confidence: number;
  }>;
  recommendation: string;
}

export interface LanguagePair {
  from: string;
  to: string;
}

// Input types
export interface FileConversionInput {
  filePath: string;
  content: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

export interface SnippetConversionInput {
  snippet: string;
  context?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

export interface PatternLearningInput {
  inputPattern: string;
  outputPattern: string;
  category: string;
  confidence: number;
  languagePair?: LanguagePair;
}

export interface ConversionSuggestionInput {
  content: string;
  filePath?: string;
}

// Converter types
export interface LanguageConverter {
  convert: (content: string) => Promise<ConversionTransformResult>;
  convertSnippet: (
    snippet: string,
    context?: string
  ) => Promise<SnippetTransformResult>;
}

export interface ConversionTransformResult {
  content: string;
  confidence: number;
  patternsUsed: string[];
}

export interface SnippetTransformResult {
  converted: string;
  confidence: number;
  explanation: string;
}

// Detection types
export interface LanguageDetectionInput {
  content?: string;
  filePath?: string;
  context?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

// Result union type for processTask
export type ConversionResult = 
  | FileConversionResult
  | SnippetConversionResult
  | PatternLearningResult
  | ConversionSuggestionResult;