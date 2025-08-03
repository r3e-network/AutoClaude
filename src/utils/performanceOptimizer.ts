/**
 * Performance Optimizer - Enhances AutoClaude's performance and efficiency
 * 
 * This module provides performance optimizations for various operations
 * including file I/O, pattern matching, and queue processing.
 */

import * as vscode from 'vscode';
import { debugLog } from './logging';

/**
 * Cache for frequently accessed file contents
 */
const fileCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Debounce function for reducing excessive calls
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | undefined;
    
    return function debounced(...args: Parameters<T>) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * Throttle function for rate limiting
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;
    
    return function throttled(...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Batch processor for handling multiple operations efficiently
 */
export class BatchProcessor<T> {
    private batch: T[] = [];
    private timer: NodeJS.Timeout | undefined;
    
    constructor(
        private processor: (items: T[]) => Promise<void>,
        private batchSize: number = 50,
        private delay: number = 100
    ) {}
    
    add(item: T): void {
        this.batch.push(item);
        
        if (this.batch.length >= this.batchSize) {
            this.flush();
        } else {
            this.scheduleFlush();
        }
    }
    
    private scheduleFlush(): void {
        if (this.timer) return;
        
        this.timer = setTimeout(() => {
            this.flush();
        }, this.delay);
    }
    
    async flush(): Promise<void> {
        if (this.batch.length === 0) return;
        
        clearTimeout(this.timer);
        this.timer = undefined;
        
        const items = [...this.batch];
        this.batch = [];
        
        try {
            await this.processor(items);
        } catch (error) {
            debugLog(`Batch processing error: ${error}`);
        }
    }
}

/**
 * Cached file reader with TTL
 */
export async function readFileCached(filePath: string): Promise<string | null> {
    const cached = fileCache.get(filePath);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        debugLog(`Cache hit for file: ${filePath}`);
        return cached.content;
    }
    
    try {
        const uri = vscode.Uri.file(filePath);
        const content = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(content).toString('utf8');
        
        fileCache.set(filePath, { content: text, timestamp: now });
        
        // Cleanup old cache entries
        if (fileCache.size > 100) {
            const oldestKey = Array.from(fileCache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
            fileCache.delete(oldestKey);
        }
        
        return text;
    } catch (error) {
        debugLog(`Failed to read file ${filePath}: ${error}`);
        return null;
    }
}

/**
 * Parallel task executor with concurrency control
 */
export async function executeParallel<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number = 5
): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];
    
    for (const item of items) {
        const promise = processor(item).then(result => {
            results.push(result);
        });
        
        executing.push(promise);
        
        if (executing.length >= concurrency) {
            await Promise.race(executing);
            executing.splice(executing.findIndex(p => p === promise), 1);
        }
    }
    
    await Promise.all(executing);
    return results;
}

/**
 * Memory-efficient string builder for large outputs
 */
export class StringBuilder {
    private chunks: string[] = [];
    private currentSize = 0;
    
    append(str: string): this {
        this.chunks.push(str);
        this.currentSize += str.length;
        return this;
    }
    
    appendLine(str: string = ''): this {
        return this.append(str + '\n');
    }
    
    toString(): string {
        return this.chunks.join('');
    }
    
    clear(): void {
        this.chunks = [];
        this.currentSize = 0;
    }
    
    get length(): number {
        return this.currentSize;
    }
}

/**
 * Lazy evaluation wrapper
 */
export class Lazy<T> {
    private value?: T;
    private computed = false;
    
    constructor(private factory: () => T) {}
    
    get(): T {
        if (!this.computed) {
            this.value = this.factory();
            this.computed = true;
        }
        return this.value!;
    }
    
    reset(): void {
        this.computed = false;
        this.value = undefined;
    }
}

/**
 * Performance metrics collector
 */
export class PerformanceMetrics {
    private metrics = new Map<string, number[]>();
    
    record(operation: string, duration: number): void {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, []);
        }
        
        const values = this.metrics.get(operation)!;
        values.push(duration);
        
        // Keep only last 100 measurements
        if (values.length > 100) {
            values.shift();
        }
    }
    
    getStats(operation: string): { avg: number; min: number; max: number } | null {
        const values = this.metrics.get(operation);
        if (!values || values.length === 0) return null;
        
        const sum = values.reduce((a, b) => a + b, 0);
        return {
            avg: sum / values.length,
            min: Math.min(...values),
            max: Math.max(...values)
        };
    }
    
    async measure<T>(operation: string, func: () => Promise<T>): Promise<T> {
        const start = performance.now();
        try {
            return await func();
        } finally {
            const duration = performance.now() - start;
            this.record(operation, duration);
            debugLog(`Performance: ${operation} took ${duration.toFixed(2)}ms`);
        }
    }
}

// Global performance metrics instance
export const performanceMetrics = new PerformanceMetrics();