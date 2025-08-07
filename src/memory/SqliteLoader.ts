/**
 * SQLite Loader
 * Safely loads SQLite with fallback support
 */

import { debugLog } from "../utils/logging";

export interface SqliteModule {
  Database: any;
  verbose?: () => any;
  available: boolean;
}

class SqliteLoader {
  private static instance: SqliteLoader;
  private sqlite3Module: any = null;
  private sqliteModule: any = null;
  private loadAttempted = false;
  private available = false;

  private constructor() {}

  static getInstance(): SqliteLoader {
    if (!SqliteLoader.instance) {
      SqliteLoader.instance = new SqliteLoader();
    }
    return SqliteLoader.instance;
  }

  /**
   * Try to load SQLite modules
   */
  private tryLoadModules(): void {
    if (this.loadAttempted) {
      return;
    }

    this.loadAttempted = true;

    // Try loading sqlite3
    try {
      this.sqlite3Module = require("sqlite3");
      if (this.sqlite3Module.verbose) {
        this.sqlite3Module = this.sqlite3Module.verbose();
      }
      this.available = true;
      debugLog("[SqliteLoader] sqlite3 module loaded successfully");
    } catch (error) {
      debugLog("[SqliteLoader] sqlite3 module not available");
      
      // Try alternative sqlite module
      try {
        this.sqliteModule = require("sqlite");
        this.available = true;
        debugLog("[SqliteLoader] sqlite module loaded as fallback");
      } catch (err) {
        debugLog("[SqliteLoader] No SQLite modules available");
      }
    }
  }

  /**
   * Get SQLite3 module if available
   */
  getSqlite3(): any {
    this.tryLoadModules();
    return this.sqlite3Module;
  }

  /**
   * Get SQLite module if available
   */
  getSqlite(): any {
    this.tryLoadModules();
    return this.sqliteModule;
  }

  /**
   * Check if any SQLite module is available
   */
  isAvailable(): boolean {
    this.tryLoadModules();
    return this.available;
  }

  /**
   * Create a database connection with fallback
   */
  async createDatabase(dbPath: string): Promise<any> {
    this.tryLoadModules();

    if (this.sqlite3Module) {
      return new Promise((resolve, reject) => {
        const db = new this.sqlite3Module.Database(dbPath, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(db);
          }
        });
      });
    }

    if (this.sqliteModule) {
      const sqlite = await import("sqlite");
      const sqlite3 = await import("sqlite3");
      return sqlite.open({
        filename: dbPath,
        driver: sqlite3.Database
      });
    }

    throw new Error("No SQLite module available");
  }

  /**
   * Create in-memory fallback storage
   */
  createMemoryFallback(): MemoryFallbackStorage {
    return new MemoryFallbackStorage();
  }
}

/**
 * In-memory fallback storage when SQLite is not available
 */
export class MemoryFallbackStorage {
  private storage = new Map<string, Map<string, any>>();

  constructor() {
    debugLog("[MemoryFallback] Using in-memory storage as SQLite is not available");
  }

  /**
   * Create a table
   */
  createTable(tableName: string): void {
    if (!this.storage.has(tableName)) {
      this.storage.set(tableName, new Map());
    }
  }

  /**
   * Insert data
   */
  insert(tableName: string, data: any): string {
    const table = this.storage.get(tableName);
    if (!table) {
      this.createTable(tableName);
    }
    
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const dataWithId = { ...data, id };
    this.storage.get(tableName)!.set(id, dataWithId);
    return id;
  }

  /**
   * Get data by ID
   */
  get(tableName: string, id: string): any {
    const table = this.storage.get(tableName);
    return table?.get(id);
  }

  /**
   * Get all data from table
   */
  getAll(tableName: string): any[] {
    const table = this.storage.get(tableName);
    return table ? Array.from(table.values()) : [];
  }

  /**
   * Update data
   */
  update(tableName: string, id: string, data: any): boolean {
    const table = this.storage.get(tableName);
    if (table && table.has(id)) {
      const existing = table.get(id);
      table.set(id, { ...existing, ...data });
      return true;
    }
    return false;
  }

  /**
   * Delete data
   */
  delete(tableName: string, id: string): boolean {
    const table = this.storage.get(tableName);
    if (table) {
      return table.delete(id);
    }
    return false;
  }

  /**
   * Query with conditions
   */
  query(tableName: string, conditions: Record<string, any>): any[] {
    const table = this.storage.get(tableName);
    if (!table) return [];

    const results: any[] = [];
    for (const item of table.values()) {
      let matches = true;
      for (const [key, value] of Object.entries(conditions)) {
        if (item[key] !== value) {
          matches = false;
          break;
        }
      }
      if (matches) {
        results.push(item);
      }
    }
    return results;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.storage.clear();
  }

  /**
   * Clear a specific table
   */
  clearTable(tableName: string): void {
    this.storage.delete(tableName);
  }

  /**
   * Get storage statistics
   */
  getStats(): { tables: number; totalRecords: number; memoryUsage: number } {
    let totalRecords = 0;
    for (const table of this.storage.values()) {
      totalRecords += table.size;
    }

    // Rough estimate of memory usage
    const memoryUsage = JSON.stringify(Array.from(this.storage.entries())).length;

    return {
      tables: this.storage.size,
      totalRecords,
      memoryUsage
    };
  }
}

// Export singleton instance
export const sqliteLoader = SqliteLoader.getInstance();