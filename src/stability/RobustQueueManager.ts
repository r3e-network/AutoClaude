/**
 * Robust Queue Manager
 * Prevents queue processing hangs and ensures reliable message handling
 */

import * as vscode from "vscode";
import { debugLog, errorLog, infoLog } from "../utils/logging";

export interface QueueMessage {
  id: string;
  content: string;
  timestamp: number;
  retries: number;
  status: "pending" | "processing" | "completed" | "failed";
  error?: Error;
  timeout?: NodeJS.Timeout;
}

export interface QueueConfig {
  maxQueueSize: number;
  maxRetries: number;
  messageTimeout: number;
  processingTimeout: number;
  batchSize: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

export class RobustQueueManager {
  private static instance: RobustQueueManager;
  private queue: Map<string, QueueMessage> = new Map();
  private processingSet = new Set<string>();
  private isProcessing = false;
  private isPaused = false;
  private processTimeout: NodeJS.Timeout | null = null;
  private deadLetterQueue: QueueMessage[] = [];
  private config: QueueConfig;
  private healthChecker: QueueHealthChecker;
  
  private readonly DEFAULT_CONFIG: QueueConfig = {
    maxQueueSize: 1000,
    maxRetries: 3,
    messageTimeout: 60000, // 1 minute per message
    processingTimeout: 300000, // 5 minutes for batch
    batchSize: 10,
    backoffMultiplier: 2,
    maxBackoffMs: 60000
  };

  private constructor() {
    this.config = this.DEFAULT_CONFIG;
    this.healthChecker = new QueueHealthChecker(this);
  }

  static getInstance(): RobustQueueManager {
    if (!RobustQueueManager.instance) {
      RobustQueueManager.instance = new RobustQueueManager();
    }
    return RobustQueueManager.instance;
  }

  /**
   * Add message to queue with validation
   */
  async addMessage(content: string, priority: number = 0): Promise<string> {
    // Check queue size limit
    if (this.queue.size >= this.config.maxQueueSize) {
      throw new Error(`Queue full: ${this.queue.size}/${this.config.maxQueueSize} messages`);
    }

    const message: QueueMessage = {
      id: this.generateId(),
      content,
      timestamp: Date.now(),
      retries: 0,
      status: "pending"
    };

    this.queue.set(message.id, message);
    
    debugLog(`[RobustQueue] Added message ${message.id}`);

    // Start processing if not already running
    if (!this.isProcessing && !this.isPaused) {
      this.startProcessing();
    }

    return message.id;
  }

  /**
   * Start processing queue
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing || this.isPaused) {
      return;
    }

    this.isProcessing = true;
    infoLog("[RobustQueue] Starting queue processing");

    try {
      // Set overall timeout for processing
      this.processTimeout = setTimeout(() => {
        errorLog("[RobustQueue] Processing timeout reached");
        this.handleProcessingTimeout();
      }, this.config.processingTimeout);

      await this.processQueue();

    } catch (error) {
      errorLog("[RobustQueue] Processing error", error as Error);
      await this.handleProcessingError(error as Error);
    } finally {
      if (this.processTimeout) {
        clearTimeout(this.processTimeout);
        this.processTimeout = null;
      }
      this.isProcessing = false;
    }
  }

  /**
   * Process queue with batching and error isolation
   */
  private async processQueue(): Promise<void> {
    while (this.hasMessagesToProcess() && !this.isPaused) {
      const batch = this.getNextBatch();
      
      if (batch.length === 0) {
        break;
      }

      // Process batch with error isolation
      await this.processBatch(batch);

      // Health check between batches
      if (!this.healthChecker.isHealthy()) {
        await this.performHealthRecovery();
      }

      // Small delay between batches to prevent CPU hogging
      await this.delay(100);
    }

    debugLog("[RobustQueue] Queue processing completed");
  }

  /**
   * Process a batch of messages
   */
  private async processBatch(batch: QueueMessage[]): Promise<void> {
    const promises = batch.map(message => this.processMessage(message));
    
    // Process with timeout and error handling
    const results = await Promise.allSettled(promises);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const message = batch[i];

      if (result.status === "rejected") {
        await this.handleMessageError(message, result.reason);
      }
    }
  }

  /**
   * Process individual message with timeout
   */
  private async processMessage(message: QueueMessage): Promise<void> {
    if (this.processingSet.has(message.id)) {
      debugLog(`[RobustQueue] Message ${message.id} already processing`);
      return;
    }

    this.processingSet.add(message.id);
    message.status = "processing";

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        message.timeout = setTimeout(() => {
          reject(new Error(`Message ${message.id} processing timeout`));
        }, this.config.messageTimeout);
      });

      // Process with timeout
      const result = await Promise.race([
        this.executeMessageHandler(message),
        timeoutPromise
      ]);

      // Clear timeout on success
      if (message.timeout) {
        clearTimeout(message.timeout);
        message.timeout = undefined;
      }

      // Mark as completed
      message.status = "completed";
      this.queue.delete(message.id);
      
      debugLog(`[RobustQueue] Message ${message.id} completed`);

    } catch (error) {
      // Clear timeout on error
      if (message.timeout) {
        clearTimeout(message.timeout);
        message.timeout = undefined;
      }

      throw error;

    } finally {
      this.processingSet.delete(message.id);
    }
  }

  /**
   * Execute message handler (override in subclass)
   */
  protected async executeMessageHandler(message: QueueMessage): Promise<void> {
    // This should be overridden by specific implementations
    debugLog(`[RobustQueue] Processing message: ${message.content.substring(0, 100)}`);
    
    // Simulate processing
    await this.delay(1000);
  }

  /**
   * Handle message error with retry logic
   */
  private async handleMessageError(message: QueueMessage, error: Error): Promise<void> {
    errorLog(`[RobustQueue] Message ${message.id} failed`, error);
    
    message.error = error;
    message.retries++;

    if (message.retries < this.config.maxRetries) {
      // Calculate backoff delay
      const backoffMs = Math.min(
        this.config.backoffMultiplier ** message.retries * 1000,
        this.config.maxBackoffMs
      );

      debugLog(`[RobustQueue] Retrying message ${message.id} in ${backoffMs}ms`);
      
      // Reset status and schedule retry
      message.status = "pending";
      setTimeout(() => {
        if (!this.isProcessing && !this.isPaused) {
          this.startProcessing();
        }
      }, backoffMs);

    } else {
      // Move to dead letter queue
      message.status = "failed";
      this.deadLetterQueue.push(message);
      this.queue.delete(message.id);
      
      errorLog(`[RobustQueue] Message ${message.id} moved to dead letter queue after ${message.retries} retries`);
    }
  }

  /**
   * Handle processing timeout
   */
  private async handleProcessingTimeout(): Promise<void> {
    errorLog("[RobustQueue] Processing timeout - stopping current batch");
    
    // Mark all processing messages as pending for retry
    for (const id of this.processingSet) {
      const message = this.queue.get(id);
      if (message) {
        message.status = "pending";
      }
    }
    
    this.processingSet.clear();
    this.isProcessing = false;

    // Attempt recovery
    await this.performHealthRecovery();
  }

  /**
   * Handle processing error
   */
  private async handleProcessingError(error: Error): Promise<void> {
    errorLog("[RobustQueue] Processing error - attempting recovery", error);
    
    // Clear processing state
    this.processingSet.clear();
    
    // Perform health recovery
    await this.performHealthRecovery();
  }

  /**
   * Perform health recovery
   */
  private async performHealthRecovery(): Promise<void> {
    infoLog("[RobustQueue] Performing health recovery");
    
    try {
      // Clear stuck messages
      await this.clearStuckMessages();
      
      // Reset processing state
      this.resetProcessingState();
      
      // Clear timeouts
      this.clearAllTimeouts();
      
      // Compact queue if needed
      await this.compactQueue();
      
    } catch (error) {
      errorLog("[RobustQueue] Health recovery failed", error as Error);
    }
  }

  /**
   * Clear stuck messages
   */
  private async clearStuckMessages(): Promise<void> {
    const now = Date.now();
    const stuckThreshold = this.config.messageTimeout * 2;

    for (const [id, message] of this.queue) {
      if (message.status === "processing" && 
          now - message.timestamp > stuckThreshold) {
        debugLog(`[RobustQueue] Clearing stuck message ${id}`);
        message.status = "pending";
        message.retries++;
      }
    }
  }

  /**
   * Reset processing state
   */
  private resetProcessingState(): void {
    this.processingSet.clear();
    this.isProcessing = false;
    
    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
      this.processTimeout = null;
    }
  }

  /**
   * Clear all timeouts
   */
  private clearAllTimeouts(): void {
    for (const message of this.queue.values()) {
      if (message.timeout) {
        clearTimeout(message.timeout);
        message.timeout = undefined;
      }
    }
  }

  /**
   * Compact queue by removing old completed messages
   */
  private async compactQueue(): Promise<void> {
    const cutoff = Date.now() - 3600000; // 1 hour
    let removed = 0;

    for (const [id, message] of this.queue) {
      if (message.status === "completed" && message.timestamp < cutoff) {
        this.queue.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      debugLog(`[RobustQueue] Compacted queue, removed ${removed} old messages`);
    }
  }

  /**
   * Check if there are messages to process
   */
  private hasMessagesToProcess(): boolean {
    for (const message of this.queue.values()) {
      if (message.status === "pending") {
        return true;
      }
    }
    return false;
  }

  /**
   * Get next batch of messages
   */
  private getNextBatch(): QueueMessage[] {
    const batch: QueueMessage[] = [];
    
    for (const message of this.queue.values()) {
      if (message.status === "pending" && batch.length < this.config.batchSize) {
        batch.push(message);
      }
    }

    return batch;
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.isPaused = true;
    infoLog("[RobustQueue] Queue paused");
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.isPaused = false;
    infoLog("[RobustQueue] Queue resumed");
    
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.clearAllTimeouts();
    this.queue.clear();
    this.processingSet.clear();
    this.deadLetterQueue = [];
    infoLog("[RobustQueue] Queue cleared");
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueSize: number;
    processing: number;
    pending: number;
    failed: number;
    deadLetter: number;
  } {
    let pending = 0;
    let failed = 0;

    for (const message of this.queue.values()) {
      if (message.status === "pending") pending++;
      if (message.status === "failed") failed++;
    }

    return {
      queueSize: this.queue.size,
      processing: this.processingSet.size,
      pending,
      failed,
      deadLetter: this.deadLetterQueue.length
    };
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): QueueMessage[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Retry dead letter messages
   */
  retryDeadLetterMessages(): void {
    for (const message of this.deadLetterQueue) {
      message.status = "pending";
      message.retries = 0;
      this.queue.set(message.id, message);
    }
    
    this.deadLetterQueue = [];
    
    if (!this.isProcessing && !this.isPaused) {
      this.startProcessing();
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.clear();
    this.healthChecker.dispose();
  }
}

/**
 * Queue Health Checker
 */
class QueueHealthChecker {
  private queue: RobustQueueManager;
  private healthMetrics = {
    messagesProcessed: 0,
    messagesFailed: 0,
    lastProcessTime: Date.now(),
    avgProcessingTime: 0,
    healthScore: 100
  };

  constructor(queue: RobustQueueManager) {
    this.queue = queue;
  }

  isHealthy(): boolean {
    const stats = this.queue.getStats();
    
    // Check for high failure rate
    if (stats.failed > stats.queueSize * 0.3) {
      return false;
    }

    // Check for stuck processing
    if (stats.processing > 0 && 
        Date.now() - this.healthMetrics.lastProcessTime > 60000) {
      return false;
    }

    // Check dead letter queue size
    if (stats.deadLetter > 100) {
      return false;
    }

    return this.healthMetrics.healthScore > 50;
  }

  updateMetrics(success: boolean, processingTime: number): void {
    if (success) {
      this.healthMetrics.messagesProcessed++;
    } else {
      this.healthMetrics.messagesFailed++;
    }

    this.healthMetrics.lastProcessTime = Date.now();
    
    // Update average processing time
    this.healthMetrics.avgProcessingTime = 
      (this.healthMetrics.avgProcessingTime * 0.9) + (processingTime * 0.1);

    // Calculate health score
    const successRate = this.healthMetrics.messagesProcessed / 
      (this.healthMetrics.messagesProcessed + this.healthMetrics.messagesFailed);
    
    this.healthMetrics.healthScore = Math.round(successRate * 100);
  }

  getMetrics(): typeof this.healthMetrics {
    return { ...this.healthMetrics };
  }

  dispose(): void {
    // Cleanup if needed
  }
}

// Export singleton getter
export function getRobustQueueManager(): RobustQueueManager {
  return RobustQueueManager.getInstance();
}