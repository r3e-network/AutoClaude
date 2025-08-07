/**
 * Connection Pool Manager
 * Manages database and external connections to prevent resource exhaustion
 */

import { debugLog, errorLog, infoLog } from "../utils/logging";

export interface PooledConnection {
  id: string;
  type: "database" | "api" | "websocket" | "other";
  connection: any;
  inUse: boolean;
  lastUsed: number;
  created: number;
  useCount: number;
  errors: number;
  metadata?: any;
}

export interface PoolConfig {
  minConnections: number;
  maxConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  maxUseCount: number;
  maxErrorCount: number;
  healthCheckInterval: number;
}

export class ConnectionPoolManager {
  private static instances = new Map<string, ConnectionPoolManager>();
  private connections = new Map<string, PooledConnection>();
  private waitQueue: Array<(conn: PooledConnection) => void> = [];
  private config: PoolConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  
  private readonly DEFAULT_CONFIG: PoolConfig = {
    minConnections: 2,
    maxConnections: 10,
    connectionTimeout: 30000, // 30 seconds
    idleTimeout: 600000, // 10 minutes
    maxUseCount: 1000,
    maxErrorCount: 5,
    healthCheckInterval: 60000 // 1 minute
  };

  private constructor(
    private poolName: string,
    private connectionFactory: () => Promise<any>,
    private connectionValidator: (conn: any) => Promise<boolean>,
    private connectionDisposer: (conn: any) => Promise<void>,
    config?: Partial<PoolConfig>
  ) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  /**
   * Get or create pool instance
   */
  static getInstance(
    poolName: string,
    connectionFactory: () => Promise<any>,
    connectionValidator: (conn: any) => Promise<boolean>,
    connectionDisposer: (conn: any) => Promise<void>,
    config?: Partial<PoolConfig>
  ): ConnectionPoolManager {
    if (!ConnectionPoolManager.instances.has(poolName)) {
      const instance = new ConnectionPoolManager(
        poolName,
        connectionFactory,
        connectionValidator,
        connectionDisposer,
        config
      );
      ConnectionPoolManager.instances.set(poolName, instance);
    }
    return ConnectionPoolManager.instances.get(poolName)!;
  }

  /**
   * Initialize pool
   */
  private async initialize(): Promise<void> {
    infoLog(`[ConnectionPool-${this.poolName}] Initializing pool`);

    try {
      // Create minimum connections
      await this.ensureMinimumConnections();

      // Start health checks
      this.startHealthChecks();

    } catch (error) {
      errorLog(`[ConnectionPool-${this.poolName}] Initialization failed`, error as Error);
    }
  }

  /**
   * Ensure minimum connections exist
   */
  private async ensureMinimumConnections(): Promise<void> {
    const currentCount = this.connections.size;
    const needed = this.config.minConnections - currentCount;

    if (needed > 0) {
      debugLog(`[ConnectionPool-${this.poolName}] Creating ${needed} connections`);
      
      const promises: Promise<void>[] = [];
      for (let i = 0; i < needed; i++) {
        promises.push(this.createConnection());
      }

      await Promise.allSettled(promises);
    }
  }

  /**
   * Create new connection
   */
  private async createConnection(): Promise<void> {
    if (this.connections.size >= this.config.maxConnections) {
      throw new Error(`Pool limit reached: ${this.config.maxConnections}`);
    }

    try {
      // Create connection with timeout
      const connection = await this.withTimeout(
        this.connectionFactory(),
        this.config.connectionTimeout,
        "Connection creation timeout"
      );

      // Validate connection
      const isValid = await this.connectionValidator(connection);
      if (!isValid) {
        throw new Error("Connection validation failed");
      }

      // Add to pool
      const pooledConn: PooledConnection = {
        id: this.generateId(),
        type: "database", // Can be parameterized
        connection,
        inUse: false,
        lastUsed: Date.now(),
        created: Date.now(),
        useCount: 0,
        errors: 0
      };

      this.connections.set(pooledConn.id, pooledConn);
      
      debugLog(`[ConnectionPool-${this.poolName}] Created connection ${pooledConn.id}`);

      // Check if anyone is waiting
      this.processWaitQueue();

    } catch (error) {
      errorLog(`[ConnectionPool-${this.poolName}] Failed to create connection`, error as Error);
      throw error;
    }
  }

  /**
   * Acquire connection from pool
   */
  async acquire(): Promise<PooledConnection> {
    if (this.isShuttingDown) {
      throw new Error("Pool is shutting down");
    }

    // Try to get available connection
    let connection = this.getAvailableConnection();

    if (!connection) {
      // Try to create new connection if under limit
      if (this.connections.size < this.config.maxConnections) {
        try {
          await this.createConnection();
          connection = this.getAvailableConnection();
        } catch (error) {
          debugLog(`[ConnectionPool-${this.poolName}] Failed to create new connection`);
        }
      }
    }

    // If still no connection, wait in queue
    if (!connection) {
      connection = await this.waitForConnection();
    }

    // Mark as in use
    connection.inUse = true;
    connection.lastUsed = Date.now();
    connection.useCount++;

    debugLog(`[ConnectionPool-${this.poolName}] Acquired connection ${connection.id}`);
    
    return connection;
  }

  /**
   * Release connection back to pool
   */
  async release(connectionId: string, hadError: boolean = false): Promise<void> {
    const connection = this.connections.get(connectionId);
    
    if (!connection) {
      debugLog(`[ConnectionPool-${this.poolName}] Unknown connection ${connectionId}`);
      return;
    }

    connection.inUse = false;
    connection.lastUsed = Date.now();

    if (hadError) {
      connection.errors++;
    }

    // Check if connection should be replaced
    if (this.shouldReplaceConnection(connection)) {
      await this.replaceConnection(connection);
    } else {
      // Process wait queue
      this.processWaitQueue();
    }

    debugLog(`[ConnectionPool-${this.poolName}] Released connection ${connectionId}`);
  }

  /**
   * Get available connection
   */
  private getAvailableConnection(): PooledConnection | null {
    for (const conn of this.connections.values()) {
      if (!conn.inUse && this.isConnectionHealthy(conn)) {
        return conn;
      }
    }
    return null;
  }

  /**
   * Wait for connection to become available
   */
  private waitForConnection(): Promise<PooledConnection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.indexOf(resolve);
        if (index > -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(new Error("Connection acquisition timeout"));
      }, this.config.connectionTimeout);

      const wrappedResolve = (conn: PooledConnection) => {
        clearTimeout(timeout);
        resolve(conn);
      };

      this.waitQueue.push(wrappedResolve);
    });
  }

  /**
   * Process wait queue
   */
  private processWaitQueue(): void {
    while (this.waitQueue.length > 0) {
      const connection = this.getAvailableConnection();
      if (!connection) {
        break;
      }

      const resolver = this.waitQueue.shift();
      if (resolver) {
        connection.inUse = true;
        connection.lastUsed = Date.now();
        connection.useCount++;
        resolver(connection);
      }
    }
  }

  /**
   * Check if connection should be replaced
   */
  private shouldReplaceConnection(connection: PooledConnection): boolean {
    // Too many errors
    if (connection.errors >= this.config.maxErrorCount) {
      return true;
    }

    // Too many uses
    if (connection.useCount >= this.config.maxUseCount) {
      return true;
    }

    // Connection too old (24 hours)
    if (Date.now() - connection.created > 86400000) {
      return true;
    }

    return false;
  }

  /**
   * Replace connection
   */
  private async replaceConnection(oldConnection: PooledConnection): Promise<void> {
    debugLog(`[ConnectionPool-${this.poolName}] Replacing connection ${oldConnection.id}`);

    try {
      // Remove old connection
      this.connections.delete(oldConnection.id);

      // Dispose old connection
      await this.connectionDisposer(oldConnection.connection);

      // Create new connection
      await this.createConnection();

    } catch (error) {
      errorLog(`[ConnectionPool-${this.poolName}] Failed to replace connection`, error as Error);
    }
  }

  /**
   * Check if connection is healthy
   */
  private isConnectionHealthy(connection: PooledConnection): boolean {
    // Too many errors
    if (connection.errors >= this.config.maxErrorCount) {
      return false;
    }

    // Connection too old
    if (Date.now() - connection.created > 86400000) {
      return false;
    }

    return true;
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        errorLog(`[ConnectionPool-${this.poolName}] Health check failed`, error);
      });
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    debugLog(`[ConnectionPool-${this.poolName}] Performing health check`);

    const now = Date.now();
    const toRemove: PooledConnection[] = [];
    const toValidate: PooledConnection[] = [];

    for (const conn of this.connections.values()) {
      // Check for idle connections
      if (!conn.inUse && now - conn.lastUsed > this.config.idleTimeout) {
        toRemove.push(conn);
        continue;
      }

      // Validate connections
      if (!conn.inUse) {
        toValidate.push(conn);
      }
    }

    // Remove idle connections (keep minimum)
    for (const conn of toRemove) {
      if (this.connections.size > this.config.minConnections) {
        await this.removeConnection(conn);
      }
    }

    // Validate connections
    const validationPromises = toValidate.map(async conn => {
      try {
        const isValid = await this.connectionValidator(conn.connection);
        if (!isValid) {
          await this.replaceConnection(conn);
        }
      } catch (error) {
        debugLog(`[ConnectionPool-${this.poolName}] Validation failed for ${conn.id}`);
        await this.replaceConnection(conn);
      }
    });

    await Promise.allSettled(validationPromises);

    // Ensure minimum connections
    await this.ensureMinimumConnections();
  }

  /**
   * Remove connection from pool
   */
  private async removeConnection(connection: PooledConnection): Promise<void> {
    debugLog(`[ConnectionPool-${this.poolName}] Removing connection ${connection.id}`);

    this.connections.delete(connection.id);

    try {
      await this.connectionDisposer(connection.connection);
    } catch (error) {
      errorLog(`[ConnectionPool-${this.poolName}] Failed to dispose connection`, error as Error);
    }
  }

  /**
   * Drain pool (remove all connections)
   */
  async drain(): Promise<void> {
    infoLog(`[ConnectionPool-${this.poolName}] Draining pool`);
    
    this.isShuttingDown = true;

    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Reject all waiting
    for (const resolver of this.waitQueue) {
      resolver(null as any); // Will be caught as error
    }
    this.waitQueue = [];

    // Wait for all connections to be released
    const timeout = Date.now() + this.config.connectionTimeout;
    while (Date.now() < timeout) {
      const inUse = Array.from(this.connections.values()).filter(c => c.inUse);
      if (inUse.length === 0) {
        break;
      }
      await this.delay(100);
    }

    // Dispose all connections
    const disposePromises = Array.from(this.connections.values()).map(conn =>
      this.connectionDisposer(conn.connection).catch(err => 
        errorLog(`[ConnectionPool-${this.poolName}] Dispose error`, err)
      )
    );

    await Promise.allSettled(disposePromises);

    this.connections.clear();
    
    infoLog(`[ConnectionPool-${this.poolName}] Pool drained`);
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    inUse: number;
    available: number;
    waiting: number;
    errors: number;
    avgUseCount: number;
  } {
    let inUse = 0;
    let available = 0;
    let totalErrors = 0;
    let totalUseCount = 0;

    for (const conn of this.connections.values()) {
      if (conn.inUse) {
        inUse++;
      } else {
        available++;
      }
      totalErrors += conn.errors;
      totalUseCount += conn.useCount;
    }

    return {
      total: this.connections.size,
      inUse,
      available,
      waiting: this.waitQueue.length,
      errors: totalErrors,
      avgUseCount: this.connections.size > 0 ? totalUseCount / this.connections.size : 0
    };
  }

  /**
   * Helper to add timeout to promise
   */
  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      )
    ]);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose pool
   */
  async dispose(): Promise<void> {
    await this.drain();
    ConnectionPoolManager.instances.delete(this.poolName);
  }
}

// Export helper function for common database pool
export function getDatabasePool(
  dbPath: string,
  config?: Partial<PoolConfig>
): ConnectionPoolManager {
  return ConnectionPoolManager.getInstance(
    `db-${dbPath}`,
    async () => {
      // Database connection factory
      const sqlite3 = await import("sqlite3");
      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
          if (err) reject(err);
          else resolve(db);
        });
      });
    },
    async (conn) => {
      // Validation
      return new Promise((resolve) => {
        conn.get("SELECT 1", (err: any) => {
          resolve(!err);
        });
      });
    },
    async (conn) => {
      // Disposal
      return new Promise((resolve) => {
        conn.close(() => resolve());
      });
    },
    config
  );
}