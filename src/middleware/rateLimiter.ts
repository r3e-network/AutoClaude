import * as vscode from 'vscode';
import { debugLog } from '../utils/logging';

interface RateLimitEntry {
    count: number;
    firstRequest: number;
    lastRequest: number;
}

export class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();
    private readonly windowMs: number;
    private readonly maxRequests: number;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(windowMs: number = 900000, maxRequests: number = 100) { // 15 minutes, 100 requests
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        
        // Start cleanup interval
        this.startCleanup();
    }

    /**
     * Check if request should be rate limited
     * @param identifier - Unique identifier for the rate limit (e.g., user ID, IP, command)
     * @returns true if request is allowed, false if rate limited
     */
    public checkLimit(identifier: string): boolean {
        const now = Date.now();
        const entry = this.limits.get(identifier);

        if (!entry) {
            // First request
            this.limits.set(identifier, {
                count: 1,
                firstRequest: now,
                lastRequest: now
            });
            return true;
        }

        // Check if window has expired
        if (now - entry.firstRequest > this.windowMs) {
            // Reset window
            this.limits.set(identifier, {
                count: 1,
                firstRequest: now,
                lastRequest: now
            });
            return true;
        }

        // Check if limit exceeded
        if (entry.count >= this.maxRequests) {
            debugLog(`Rate limit exceeded for ${identifier}`, {
                count: entry.count,
                maxRequests: this.maxRequests,
                windowMs: this.windowMs
            });
            return false;
        }

        // Increment counter
        entry.count++;
        entry.lastRequest = now;
        return true;
    }

    /**
     * Get remaining requests for an identifier
     */
    public getRemainingRequests(identifier: string): number {
        const entry = this.limits.get(identifier);
        if (!entry) return this.maxRequests;
        
        const now = Date.now();
        if (now - entry.firstRequest > this.windowMs) {
            return this.maxRequests;
        }
        
        return Math.max(0, this.maxRequests - entry.count);
    }

    /**
     * Get time until rate limit resets
     */
    public getResetTime(identifier: string): number {
        const entry = this.limits.get(identifier);
        if (!entry) return 0;
        
        const now = Date.now();
        const resetTime = entry.firstRequest + this.windowMs;
        
        return Math.max(0, resetTime - now);
    }

    /**
     * Clean up expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        const entriesToDelete: string[] = [];

        this.limits.forEach((entry, identifier) => {
            if (now - entry.lastRequest > this.windowMs * 2) {
                entriesToDelete.push(identifier);
            }
        });

        entriesToDelete.forEach(identifier => {
            this.limits.delete(identifier);
        });

        if (entriesToDelete.length > 0) {
            debugLog(`Cleaned up ${entriesToDelete.length} expired rate limit entries`);
        }
    }

    /**
     * Start periodic cleanup
     */
    private startCleanup(): void {
        // Run cleanup every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 300000);
    }

    /**
     * Stop the rate limiter and clean up
     */
    public dispose(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.limits.clear();
    }

    /**
     * Show rate limit warning to user
     */
    public showRateLimitWarning(identifier: string): void {
        const remaining = this.getRemainingRequests(identifier);
        const resetTime = this.getResetTime(identifier);
        const resetMinutes = Math.ceil(resetTime / 60000);

        vscode.window.showWarningMessage(
            `Rate limit reached. You have ${remaining} requests remaining. Resets in ${resetMinutes} minutes.`
        );
    }
}

// Global rate limiter instances
export const commandRateLimiter = new RateLimiter(900000, 100); // 100 commands per 15 minutes
export const apiRateLimiter = new RateLimiter(60000, 20); // 20 API calls per minute