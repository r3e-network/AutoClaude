export { RateLimiter, commandRateLimiter, apiRateLimiter } from './rateLimiter';
export { CSRFProtection, csrfProtection, CSRFProtected } from './csrf';

import { commandRateLimiter, apiRateLimiter } from './rateLimiter';
import { csrfProtection } from './csrf';

/**
 * Initialize all middleware components
 */
export function initializeMiddleware(): void {
    // Middleware is initialized on import
    // This function is for any additional setup if needed
}

/**
 * Dispose all middleware components
 */
export function disposeMiddleware(): void {
    commandRateLimiter.dispose();
    apiRateLimiter.dispose();
    csrfProtection.dispose();
}

/**
 * Check if a command should be rate limited
 */
export function checkCommandRateLimit(commandId: string, userId?: string): boolean {
    const identifier = userId ? `${userId}:${commandId}` : commandId;
    const allowed = commandRateLimiter.checkLimit(identifier);
    
    if (!allowed) {
        commandRateLimiter.showRateLimitWarning(identifier);
    }
    
    return allowed;
}

/**
 * Check if an API call should be rate limited
 */
export function checkAPIRateLimit(endpoint: string, userId?: string): boolean {
    const identifier = userId ? `${userId}:${endpoint}` : endpoint;
    return apiRateLimiter.checkLimit(identifier);
}