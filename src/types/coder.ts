/**
 * Type definitions for Coder Agent
 */

// Refactoring types
export interface RefactoringItem {
  type: RefactoringType;
  description: string;
  location?: string;
  line?: number;
  severity?: 'low' | 'medium' | 'high';
}

export type RefactoringType = 
  | 'extract-method'
  | 'extract-variable'
  | 'inline-variable'
  | 'rename'
  | 'simplify-logic'
  | 'remove-duplication'
  | 'improve-naming';

// Performance optimization types
export interface OptimizationItem {
  type: OptimizationType;
  description: string;
  location?: string;
  impact: 'low' | 'medium' | 'high';
  estimatedGain?: number;
}

export type OptimizationType = 
  | 'algorithm'
  | 'caching'
  | 'query-optimization'
  | 'memory-usage'
  | 'async-operations'
  | 'loop-optimization';

// Error fix types
export interface ErrorFix {
  type: 'syntax' | 'type' | 'runtime' | 'logic';
  description: string;
  line?: number;
  column?: number;
  replacement?: string;
  confidence: 'low' | 'medium' | 'high';
  file?: string;
}

export interface BuildError {
  file: string;
  line: number;
  column: number;
  message: string;
  type: string;
}

// Feature implementation types
export interface FeatureRequirements {
  name: string;
  description: string;
  dependencies: string[];
  components: ComponentInfo[];
  interfaces?: InterfaceInfo[];
  tests?: TestRequirement[];
}

export interface ComponentInfo {
  name: string;
  type: 'class' | 'function' | 'module' | 'service';
  description: string;
  methods?: string[];
  properties?: string[];
}

export interface InterfaceInfo {
  name: string;
  properties: PropertyInfo[];
  methods?: MethodInfo[];
}

export interface PropertyInfo {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
  description?: string;
}

export interface ParameterInfo {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
}

export interface TestRequirement {
  name: string;
  type: 'unit' | 'integration' | 'e2e';
  description: string;
}

// Implementation plan types
export interface ImplementationPlan {
  phases: ImplementationPhase[];
  components: ComponentPlan[];
  integrations: IntegrationPoint[];
  estimatedTime?: number;
  needsIntegration?: boolean;
}

export interface ImplementationPhase {
  name: string;
  tasks: string[];
  dependencies: string[];
  order: number;
}

export interface ComponentPlan {
  name: string;
  type: string;
  dependencies: string[];
  interfaces: string[];
  implementation?: string;
  path?: string;
}

export interface IntegrationPoint {
  source: string;
  target: string;
  type: 'import' | 'inject' | 'compose' | 'extend';
  description: string;
}

// Code generation types
export interface CodeGenerationConfig {
  framework?: string;
  language?: string;
  style?: 'functional' | 'object-oriented' | 'mixed';
  includeTests?: boolean;
  includeDocumentation?: boolean;
}

// Data processing types
export interface DataItem {
  id?: string | number;
  type?: string;
  value: unknown;
  metadata?: Record<string, unknown>;
}

export interface ProcessingConfig {
  batchSize?: number;
  parallel?: boolean;
  timeout?: number;
  retries?: number;
}

// Resource creation types
export interface ResourceData {
  type: string;
  name: string;
  properties: Record<string, unknown>;
  relationships?: ResourceRelationship[];
}

export interface ResourceRelationship {
  type: string;
  target: string;
  cardinality: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

// Requirement processing types
export interface RequirementParams {
  feature?: string;
  context?: Record<string, unknown>;
  constraints?: string[];
  preferences?: Record<string, unknown>;
}

export interface ProcessedRequirements {
  functional: string[];
  nonFunctional: string[];
  technical: string[];
  constraints: string[];
}