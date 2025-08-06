/**
 * Type definitions for middleware components
 */

// Webview message interface for CSRF middleware
export interface CSRFMessage {
  command: string;
  sessionId?: string;
  csrfToken?: string;
  data?: unknown;
  payload?: unknown;
  [key: string]: string | number | boolean | undefined;
}

// CSRF-protected context interface
export interface CSRFContext {
  sessionId: string;
  csrfToken: string;
  userId?: string;
  permissions?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: string | string[] | Record<string, unknown> | undefined;
}