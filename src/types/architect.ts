/**
 * Type definitions for Architect Agent
 */

// Architecture analysis types
export interface ArchitectureAnalysis {
  projectType: string;
  type?: string;
  architecture?: string;
  hasTests?: boolean;
  hasDocs?: boolean;
  hasCI?: boolean;
  dependencies?: string[];
  scalabilityRequirements: ScalabilityRequirement[];
  performanceRequirements: PerformanceRequirement[];
  securityRequirements: SecurityRequirement[];
  components: ComponentInfo[];
  integrations: IntegrationInfo[];
  dataFlow: DataFlowInfo[];
}

export interface ScalabilityRequirement {
  type: 'horizontal' | 'vertical' | 'elastic';
  description: string;
  metrics?: string[];
}

export interface PerformanceRequirement {
  metric: string;
  target: string;
  priority: 'low' | 'medium' | 'high';
}

export interface SecurityRequirement {
  type: string;
  description: string;
  implementation?: string;
}

export interface ComponentInfo {
  name: string;
  type: 'service' | 'module' | 'library' | 'database' | 'cache' | 'queue';
  description: string;
  dependencies?: string[];
  interfaces?: string[];
  responsibilities?: string[];
}

export interface IntegrationInfo {
  source: string;
  target: string;
  type: 'sync' | 'async' | 'event';
  protocol?: string;
}

export interface DataFlowInfo {
  from: string;
  to: string;
  dataType: string;
  description?: string;
}

// Project structure types
export interface ProjectStructure {
  type: string;
  architecture: string;
  layers: ArchitectureLayer[];
  patterns: string[];
  technologies: TechnologyStack;
  hasTests?: boolean;
  hasDocs?: boolean;
  hasCI?: boolean;
  dependencies?: string[];
}

export interface ArchitectureLayer {
  name: string;
  components: string[];
  responsibilities: string[];
}

export interface TechnologyStack {
  frontend?: string[];
  backend?: string[];
  database?: string[];
  infrastructure?: string[];
  tools?: string[];
}

// API design types
export interface OpenAPISpec {
  openapi: string;
  info: APIInfo;
  servers: ServerInfo[];
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
}

export interface APIInfo {
  title: string;
  version: string;
  description?: string;
}

export interface ServerInfo {
  url: string;
  description?: string;
}

export interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  delete?: OperationObject;
  patch?: OperationObject;
}

export interface OperationObject {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBody;
  responses: Record<string, ResponseObject>;
  tags?: string[];
}

export interface ParameterObject {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema: SchemaObject;
  description?: string;
}

export interface RequestBody {
  required?: boolean;
  content: Record<string, MediaType>;
}

export interface ResponseObject {
  description: string;
  content?: Record<string, MediaType>;
}

export interface MediaType {
  schema: SchemaObject;
}

export interface SchemaObject {
  type?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  $ref?: string;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
}

// Database schema types
export interface DatabaseSchema {
  database: string;
  tables: TableDefinition[];
  relationships?: RelationshipDefinition[];
  indexes?: IndexDefinition[];
  sql?: string;
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  primaryKey?: string[];
  foreignKeys?: ForeignKeyDefinition[];
  indexes?: string[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  default?: unknown;
  unique?: boolean;
  autoIncrement?: boolean;
}

export interface ForeignKeyDefinition {
  column: string;
  references: {
    table: string;
    column: string;
  };
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
}

export interface RelationshipDefinition {
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  through?: string;
}

export interface IndexDefinition {
  table: string;
  columns: string[];
  unique?: boolean;
  type?: 'btree' | 'hash' | 'gin' | 'gist';
}

// Migration types
export interface Migration {
  version: string;
  name?: string;
  up: string;
  down: string;
  timestamp?: number;
}