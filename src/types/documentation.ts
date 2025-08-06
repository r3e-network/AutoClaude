/**
 * Type definitions for Documentation Agent
 */

// API documentation types
export interface ApiFile {
  path: string;
  content: string;
  type: 'controller' | 'route' | 'middleware' | 'model';
}

export interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  responses?: Record<string, unknown>;
  auth?: boolean;
  tags?: string[];
  file?: string;
}

export interface ApiModel {
  name: string;
  file: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  properties?: Record<string, unknown>;
}

export interface ApiSpec {
  title: string;
  version: string;
  description: string;
  baseUrl: string;
  endpoints: ApiEndpoint[];
  models: ApiModel[];
  auth?: {
    type: string;
    description: string;
  };
}

export interface ApiDocumentation {
  openApiSpec: string;
  readme: string;
  postmanCollection: string;
  examples?: ApiExample[];
}

export interface ApiExample {
  endpoint: string;
  request: string;
  response: string;
}

// Code documentation types
export interface CodeModule {
  name: string;
  path: string;
  exports: string[];
  imports: string[];
  description?: string;
  functions?: CodeFunction[];
  classes?: CodeClass[];
}

export interface CodeFunction {
  name: string;
  file: string;
  params: string[];
  returns: string;
  description?: string;
  complexity?: number;
  async?: boolean;
  exported?: boolean;
}

export interface CodeClass {
  name: string;
  file: string;
  methods: string[];
  properties: string[];
  description?: string;
  exported?: boolean;
}

export interface CodeAnalysis {
  files: number;
  lines: number;
  functions: CodeFunction[];
  classes: CodeClass[];
  modules: CodeModule[];
  complexity: {
    average: number;
    max: number;
  };
}

export interface CodeDocumentation {
  overview: string;
  modules: Array<{
    name: string;
    documentation: string;
  }>;
  inlineUpdates: Array<{
    file: string;
    content: string;
  }>;
}

// User guide types
export interface UserPersona {
  name: string;
  role: string;
  goals: string[];
  skills: string[];
}

export interface Feature {
  name: string;
  description: string;
  steps: string[];
  examples?: string[];
  prerequisites?: string[];
}

export interface UserGuideSet {
  mainGuide: string;
  personaGuides: Array<{
    persona: string;
    guide: string;
  }>;
  featureGuides: Array<{
    feature: string;
    guide: string;
    content?: string;
  }>;
  quickStart?: string;
  faq?: Array<{
    question: string;
    answer: string;
  }>;
}

// Project info types
export interface ProjectInfo {
  name: string;
  description: string;
  version: string;
  license: string;
  repository?: string;
  homepage?: string;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  language: string;
  framework?: string;
}

export interface Badge {
  type: string;
  url: string;
  alt: string;
  markdown?: string;
}

// Git history types
export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: Date;
  type?: string;
  scope?: string;
  breaking?: boolean;
}

// Architecture types
export interface ArchitectureComponent {
  name: string;
  description: string;
  responsibilities: string[];
  dependencies: string[];
  interfaces?: string[];
}

export interface ArchitectureLayer {
  name: string;
  components: string[];
  purpose: string;
}

export interface Architecture {
  overview: string;
  components: ArchitectureComponent[];
  layers: ArchitectureLayer[];
  patterns: string[];
  principles: string[];
}

// Requirements types
export interface Requirement {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'functional' | 'non-functional' | 'technical';
  status: 'draft' | 'approved' | 'implemented' | 'verified';
  acceptance?: string[];
}

// Tutorial types
export interface Tutorial {
  title: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  objectives: string[];
  prerequisites?: string[];
  steps?: string[];
  exercises?: string[];
  slug?: string;
}

// Generic documentation types
export interface DocumentationArtifact {
  type: 'documentation';
  content: string;
  path: string;
}

export interface DocumentationSet {
  [key: string]: string | DocumentationArtifact[];
}