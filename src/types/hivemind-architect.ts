import { AgentTask, TaskResult, BaseAgent, TaskStatus } from './hivemind';
import { LogContext } from '../utils/logging';

export interface ProjectStructure {
  files: string[];
  directories: string[];
  mainFiles: string[];
  configFiles: string[];
  dependencies?: string[];
  hasTests?: boolean;
  hasDocs?: boolean;
  hasCI?: boolean;
}

export interface DatabaseSchema {
  tables: Table[];
  relations: Relation[];
  indexes: Index[];
  constraints: Constraint[];
  sql?: string;
}

export interface Table {
  name: string;
  columns: Column[];
  primaryKey?: string;
  foreignKeys?: ForeignKey[];
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string | number | boolean | null;
}

export interface ForeignKey {
  column: string;
  referencesTable: string;
  referencesColumn: string;
}

export interface Relation {
  fromTable: string;
  toTable: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  foreignKey?: string;
}

export interface Index {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
}

export interface Constraint {
  name: string;
  table: string;
  type: 'check' | 'unique' | 'foreign_key';
  definition: string;
}

export interface Migration {
  id: string;
  name?: string;
  up: string;
  down: string;
  timestamp: number;
}

export interface ArchitectureAnalysis {
  projectType: 'web' | 'api' | 'desktop' | 'mobile' | 'library' | 'microservice';
  scalabilityRequirements: ScalabilityRequirement[];
  performanceRequirements: PerformanceRequirement[];
  securityRequirements: SecurityRequirement[];
  integrationPoints: IntegrationPoint[];
  architecture?: string;
  hasTests?: boolean;
  hasDocs?: boolean;
  hasCI?: boolean;
  type?: string;
}

export interface ScalabilityRequirement {
  dimension: 'users' | 'data' | 'requests' | 'storage';
  target: number;
  timeframe: string;
}

export interface PerformanceRequirement {
  metric: 'response_time' | 'throughput' | 'memory' | 'cpu';
  target: number;
  unit: string;
}

export interface SecurityRequirement {
  type: 'authentication' | 'authorization' | 'encryption' | 'audit';
  level: 'basic' | 'standard' | 'high' | 'critical';
  compliance?: string[];
}

export interface IntegrationPoint {
  name: string;
  type: 'database' | 'api' | 'service' | 'queue' | 'cache';
  protocol: string;
  security: string;
}

export interface ArchitecturalRecommendation {
  category: 'structure' | 'security' | 'performance' | 'scalability';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  implementation: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
}

export interface ArchitectTask extends AgentTask {
  analysis?: ArchitectureAnalysis;
  projectStructure?: ProjectStructure;
  databaseSchema?: DatabaseSchema;
}

export interface ArchitectResult extends TaskResult {
  analysis?: ArchitectureAnalysis;
  recommendations?: ArchitecturalRecommendation[];
  databaseSchema?: DatabaseSchema;
  migrations?: Migration[];
}

export interface ArchitectAgent extends BaseAgent {
  analyzeProject(projectPath: string): Promise<ArchitectureAnalysis>;
  generateRecommendations(analysis: ArchitectureAnalysis): Promise<ArchitecturalRecommendation[]>;
  designDatabase(requirements: DatabaseRequirements): Promise<DatabaseSchema>;
}

export interface DatabaseRequirements {
  entities: string[];
  relationships: string[];
  constraints?: string[];
  indexes?: string[];
  performance?: string[];
}