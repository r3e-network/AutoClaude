import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { debugLog } from '../utils/logging';
import { CSRFMessage, CSRFContext } from '../types/middleware';

export class CSRFProtection {
    private tokens: Map<string, { token: string; expires: number }> = new Map();
    private readonly tokenLifetime: number = 3600000; // 1 hour
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Start cleanup interval
        this.startCleanup();
    }

    /**
     * Generate a new CSRF token for a session
     */
    public generateToken(sessionId: string): string {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + this.tokenLifetime;

        this.tokens.set(sessionId, { token, expires });
        
        debugLog('Generated CSRF token', { sessionId, expires: new Date(expires) });
        
        return token;
    }

    /**
     * Validate a CSRF token
     */
    public validateToken(sessionId: string, token: string): boolean {
        const storedData = this.tokens.get(sessionId);
        
        if (!storedData) {
            debugLog('CSRF validation failed: No token found', { sessionId });
            return false;
        }

        if (Date.now() > storedData.expires) {
            debugLog('CSRF validation failed: Token expired', { sessionId });
            this.tokens.delete(sessionId);
            return false;
        }

        if (storedData.token !== token) {
            debugLog('CSRF validation failed: Token mismatch', { sessionId });
            return false;
        }

        // Token is valid
        return true;
    }

    /**
     * Refresh a token's expiration time
     */
    public refreshToken(sessionId: string): boolean {
        const storedData = this.tokens.get(sessionId);
        
        if (!storedData || Date.now() > storedData.expires) {
            return false;
        }

        storedData.expires = Date.now() + this.tokenLifetime;
        return true;
    }

    /**
     * Invalidate a token
     */
    public invalidateToken(sessionId: string): void {
        this.tokens.delete(sessionId);
        debugLog('Invalidated CSRF token', { sessionId });
    }

    /**
     * Clean up expired tokens
     */
    private cleanup(): void {
        const now = Date.now();
        const tokensToDelete: string[] = [];

        this.tokens.forEach((data, sessionId) => {
            if (now > data.expires) {
                tokensToDelete.push(sessionId);
            }
        });

        tokensToDelete.forEach(sessionId => {
            this.tokens.delete(sessionId);
        });

        if (tokensToDelete.length > 0) {
            debugLog(`Cleaned up ${tokensToDelete.length} expired CSRF tokens`);
        }
    }

    /**
     * Start periodic cleanup
     */
    private startCleanup(): void {
        // Run cleanup every 10 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 600000);
    }

    /**
     * Dispose of the CSRF protection instance
     */
    public dispose(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.tokens.clear();
    }

    /**
     * Middleware for webview requests
     */
    public createWebviewMiddleware() {
        return (message: CSRFMessage): boolean => {
            // Extract session ID and token from message
            const sessionId = message.sessionId;
            const csrfToken = message.csrfToken;

            // Skip CSRF check for certain commands
            const skipCommands = ['getCSRFToken', 'initialize'];
            if (skipCommands.includes(message.command)) {
                return true;
            }

            // Validate token
            if (!sessionId || !csrfToken) {
                debugLog('CSRF validation failed: Missing session ID or token', { command: message.command });
                return false;
            }

            if (!this.validateToken(sessionId, csrfToken)) {
                debugLog('CSRF validation failed', { sessionId, command: message.command });
                return false;
            }

            // Refresh token on successful validation
            this.refreshToken(sessionId);
            
            return true;
        };
    }
}

// Global CSRF protection instance
export const csrfProtection = new CSRFProtection();

/**
 * Decorator for CSRF-protected methods
 */
export function CSRFProtected(target: object, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
        // Extract session information from context
        const context = args[0];
        if (!context || !context.sessionId || !context.csrfToken) {
            throw new Error('CSRF token validation failed: Missing session information');
        }

        if (!csrfProtection.validateToken(context.sessionId, context.csrfToken)) {
            throw new Error('CSRF token validation failed: Invalid or expired token');
        }

        // Call original method
        return originalMethod.apply(this, args);
    };

    return descriptor;
}