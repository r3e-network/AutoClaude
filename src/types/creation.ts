/**
 * Type definitions for Creation Agents
 */

// Project specification types
export interface ProjectSpec {
  name: string;
  type: 'react' | 'express' | 'vue' | 'node' | 'html' | 'nextjs' | 'vanilla';
  path: string;
  description?: string;
  features?: string[];
  dependencies?: string[];
  devDependencies?: string[];
  scripts?: Record<string, string>;
  author?: string;
  license?: string;
  version?: string;
  private?: boolean;
  repository?: string;
  keywords?: string[];
}

// Website specification types
export interface WebsiteSpec {
  name: string;
  type: 'portfolio' | 'blog' | 'ecommerce' | 'landing' | 'corporate' | 'webapp';
  framework: 'react' | 'vue' | 'vanilla' | 'nextjs';
  pages: PageSpec[];
  components?: ComponentSpec[];
  features?: string[];
  styling?: StylingConfig;
  path: string;
}

export interface PageSpec {
  name: string;
  route: string;
  components?: string[];
  title?: string;
  description?: string;
}

export interface ComponentSpec {
  name: string;
  type: 'functional' | 'class' | 'presentational' | 'container';
  props?: PropSpec[];
}

export interface PropSpec {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
}

export interface StylingConfig {
  framework?: 'tailwind' | 'bootstrap' | 'material-ui' | 'custom';
  theme?: ThemeConfig;
  preprocessor?: 'scss' | 'less' | 'stylus' | 'css';
}

export interface ThemeConfig {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  spacing?: string;
}

// Analysis types
export interface ProjectAnalysis {
  type: string;
  name: string;
  features: string[];
  complexity: 'simple' | 'medium' | 'complex';
  estimatedTime: string;
  technologies: string[];
  structure: StructureSpec;
}

export interface StructureSpec {
  directories: string[];
  files: FileSpec[];
  configFiles: string[];
}

export interface FileSpec {
  path: string;
  content?: string;
  template?: string;
}

// Error handling types for middleware
export interface ExpressError extends Error {
  status?: number;
  code?: string;
}

export interface ExpressRequest {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ExpressResponse {
  status: (code: number) => ExpressResponse;
  json: (data: unknown) => void;
  send: (data: string) => void;
}

export interface ExpressNext {
  (error?: ExpressError): void;
}