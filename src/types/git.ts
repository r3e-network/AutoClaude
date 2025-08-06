/**
 * Type definitions for Git Agents
 */

// Git status types
export interface GitStatus {
  hasChanges: boolean;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  deleted: string[];
  modified: string[];
  renamed: string[];
  branch?: string;
  ahead?: number;
  behind?: number;
}

// Change analysis types
export interface ChangeAnalysis {
  type: ChangeType;
  scope?: string;
  files: FileChange[];
  summary: string;
  breaking: boolean;
  features: string[];
  fixes: string[];
  additions: number;
  deletions: number;
}

export type ChangeType = 
  | 'feat'
  | 'fix'
  | 'docs'
  | 'style'
  | 'refactor'
  | 'test'
  | 'chore'
  | 'perf'
  | 'build'
  | 'ci';

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  oldPath?: string;
}

// PR types
export interface PRDetails {
  title: string;
  body: string;
  base?: string;
  head?: string;
  draft?: boolean;
  labels?: string[];
  assignees?: string[];
  reviewers?: string[];
}

export interface PRInfo {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  html_url: string;
  created_at: string;
  updated_at: string;
}

// Merge conflict types
export interface ConflictInfo {
  file: string;
  type: 'content' | 'rename' | 'delete' | 'mode';
  ourChanges?: string;
  theirChanges?: string;
  resolution?: ConflictResolution;
}

export interface ConflictResolution {
  strategy: 'ours' | 'theirs' | 'manual' | 'merge';
  content?: string;
  reason?: string;
}

export interface ConflictAnalysis {
  file: string;
  conflicts: ConflictMarker[];
  canAutoResolve: boolean;
  suggestedResolution?: string;
}

export interface ConflictMarker {
  start: number;
  end: number;
  ours: string;
  theirs: string;
}

// Branch types
export interface BranchInfo {
  name: string;
  current: boolean;
  remote?: string;
  upstream?: string;
  ahead: number;
  behind: number;
}

// Commit types
export interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  files?: string[];
}

// Git command options
export interface GitCommandOptions {
  cwd?: string;
  maxBuffer?: number;
  timeout?: number;
  env?: Record<string, string>;
}

// Error types
export interface GitError extends Error {
  code?: string;
  command?: string;
  stdout?: string;
  stderr?: string;
}