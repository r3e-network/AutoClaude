import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import type { Database } from "sqlite3";
import { sqliteLoader, MemoryFallbackStorage } from "./SqliteLoader";
import { promisify } from "util";
import { debugLog } from "../utils/logging";
import {
  ConversionMetadata,
  ProjectMetadata,
  AgentMemoryValue,
  DatabaseMethod,
  DatabaseGetMethod,
  DatabaseAllMethod,
  ConversionStats,
  ParsedConversionHistory,
  QueryParams,
} from "../types/memory";

// Import ConversionPattern from types
import { ConversionPattern } from "../types/memory";

export interface ProjectContext {
  id?: number;
  project_path: string;
  module_name: string;
  conversion_status: "pending" | "in_progress" | "completed" | "failed";
  files_total: number;
  files_converted: number;
  tests_total: number;
  tests_passing: number;
  metadata?: ProjectMetadata;
}

export interface ConversionHistory {
  id?: number;
  project_id: number;
  source_file: string;
  target_file: string;
  file_hash: string;
  conversion_status: string;
  agent_id?: string;
  duration_ms?: number;
  errors?: unknown[];
  warnings?: unknown[];
  patterns_applied?: string[];
}

export interface AgentMemory {
  agent_id: string;
  agent_type: string;
  memory_key: string;
  memory_value: AgentMemoryValue;
  importance: number;
  access_count: number;
}

export interface TypeMapping {
  csharp_type: string;
  rust_type: string;
  namespace?: string;
  requires_import?: string;
  is_generic: boolean;
  conversion_complexity: number;
  notes?: string;
  confidence: number;
}

export class MemoryManager {
  private db: Database | null = null;
  private dbPath: string;
  private initialized: boolean = false;
  private fallbackStorage: MemoryFallbackStorage | null = null;
  private useFallback = false;

  // Promisified database methods
  private dbRun: DatabaseMethod;
  private dbGet: DatabaseGetMethod;
  private dbAll: DatabaseAllMethod;

  constructor(private workspacePath: string) {
    this.dbPath = path.join(workspacePath, ".autoclaude", "memory.db");
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Check if SQLite is available
    if (!sqliteLoader.isAvailable()) {
      console.warn("[AutoClaude] SQLite not available - using in-memory fallback storage");
      this.fallbackStorage = sqliteLoader.createMemoryFallback();
      this.useFallback = true;
      this.initialized = true;
      
      // Initialize fallback tables
      this.initializeFallbackTables();
      return;
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Open database using SqliteLoader
      const sqlite3Module = sqliteLoader.getSqlite3();
      if (sqlite3Module) {
        this.db = new sqlite3Module.Database(this.dbPath);
        
        // Promisify methods
        this.dbRun = promisify(this.db!.run.bind(this.db));
        this.dbGet = promisify(this.db!.get.bind(this.db));
        this.dbAll = promisify(this.db!.all.bind(this.db));
      } else {
        // Try alternative connection method
        this.db = await sqliteLoader.createDatabase(this.dbPath);
        
        // Setup promisified methods for alternative driver
        this.dbRun = (sql: string, params?: any) => this.db!.run(sql, params);
        this.dbGet = (sql: string, params?: any) => this.db!.get(sql, params);
        this.dbAll = (sql: string, params?: any) => this.db!.all(sql, params);
      }

      // Create tables
      await this.createTables();
      await this.loadBuiltinMappings();

      this.initialized = true;
      debugLog("Memory system initialized successfully");
    } catch (error) {
      debugLog(`Failed to initialize SQLite, falling back to in-memory storage: ${error}`);
      
      // Fall back to in-memory storage
      this.fallbackStorage = sqliteLoader.createMemoryFallback();
      this.useFallback = true;
      this.initialized = true;
      this.initializeFallbackTables();
    }
  }
  
  private initializeFallbackTables(): void {
    if (!this.fallbackStorage) return;
    
    // Create tables in fallback storage
    this.fallbackStorage.createTable("projects");
    this.fallbackStorage.createTable("conversion_history");
    this.fallbackStorage.createTable("conversion_patterns");
    this.fallbackStorage.createTable("agent_memory");
    this.fallbackStorage.createTable("workflow_templates");
    this.fallbackStorage.createTable("statistics");
  }

  private async createTables(): Promise<void> {
    const tables = [
      // Conversion patterns table
      `CREATE TABLE IF NOT EXISTS conversion_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern_hash TEXT UNIQUE NOT NULL,
                csharp_pattern TEXT NOT NULL,
                rust_pattern TEXT NOT NULL,
                pattern_type TEXT NOT NULL,
                confidence REAL DEFAULT 0.5,
                usage_count INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                failure_count INTEGER DEFAULT 0,
                last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

      // Project context table
      `CREATE TABLE IF NOT EXISTS project_context (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_path TEXT NOT NULL,
                module_name TEXT NOT NULL,
                conversion_status TEXT DEFAULT 'pending',
                files_total INTEGER DEFAULT 0,
                files_converted INTEGER DEFAULT 0,
                tests_total INTEGER DEFAULT 0,
                tests_passing INTEGER DEFAULT 0,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                metadata TEXT,
                UNIQUE(project_path, module_name)
            )`,

      // Conversion history table
      `CREATE TABLE IF NOT EXISTS conversion_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                source_file TEXT NOT NULL,
                target_file TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                conversion_status TEXT NOT NULL,
                agent_id TEXT,
                duration_ms INTEGER,
                errors TEXT,
                warnings TEXT,
                patterns_applied TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES project_context(id)
            )`,

      // Agent memory table
      `CREATE TABLE IF NOT EXISTS agent_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,
                agent_type TEXT NOT NULL,
                memory_key TEXT NOT NULL,
                memory_value TEXT NOT NULL,
                importance REAL DEFAULT 0.5,
                access_count INTEGER DEFAULT 0,
                last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(agent_id, memory_key)
            )`,

      // Type mappings table
      `CREATE TABLE IF NOT EXISTS type_mappings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                csharp_type TEXT NOT NULL,
                rust_type TEXT NOT NULL,
                namespace TEXT,
                requires_import TEXT,
                is_generic INTEGER DEFAULT 0,
                conversion_complexity INTEGER DEFAULT 1,
                notes TEXT,
                confidence REAL DEFAULT 1.0,
                UNIQUE(csharp_type, namespace)
            )`,

      // Session state table
      `CREATE TABLE IF NOT EXISTS session_state (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                workspace_path TEXT NOT NULL,
                active_agents TEXT,
                current_task TEXT,
                task_queue TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

      // Command history table
      `CREATE TABLE IF NOT EXISTS command_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                command TEXT NOT NULL,
                result TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
    ];

    // Create indexes
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_pattern_type ON conversion_patterns(pattern_type)`,
      `CREATE INDEX IF NOT EXISTS idx_confidence ON conversion_patterns(confidence DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_source_file ON conversion_history(source_file)`,
      `CREATE INDEX IF NOT EXISTS idx_agent_id ON agent_memory(agent_id)`,
      `CREATE INDEX IF NOT EXISTS idx_importance ON agent_memory(importance DESC)`,
    ];

    // Execute all table creations
    for (const sql of tables) {
      await this.dbRun(sql);
    }

    // Create indexes
    for (const sql of indexes) {
      await this.dbRun(sql);
    }
  }

  private async loadBuiltinMappings(): Promise<void> {
    const builtinMappings: Partial<TypeMapping>[] = [
      // Basic types
      { csharp_type: "int", rust_type: "i32", conversion_complexity: 1 },
      { csharp_type: "uint", rust_type: "u32", conversion_complexity: 1 },
      { csharp_type: "long", rust_type: "i64", conversion_complexity: 1 },
      { csharp_type: "ulong", rust_type: "u64", conversion_complexity: 1 },
      { csharp_type: "short", rust_type: "i16", conversion_complexity: 1 },
      { csharp_type: "ushort", rust_type: "u16", conversion_complexity: 1 },
      { csharp_type: "byte", rust_type: "u8", conversion_complexity: 1 },
      { csharp_type: "sbyte", rust_type: "i8", conversion_complexity: 1 },
      { csharp_type: "bool", rust_type: "bool", conversion_complexity: 1 },
      { csharp_type: "char", rust_type: "char", conversion_complexity: 1 },
      { csharp_type: "float", rust_type: "f32", conversion_complexity: 1 },
      { csharp_type: "double", rust_type: "f64", conversion_complexity: 1 },
      {
        csharp_type: "decimal",
        rust_type: "rust_decimal::Decimal",
        conversion_complexity: 2,
        requires_import: "rust_decimal",
      },
      { csharp_type: "string", rust_type: "String", conversion_complexity: 2 },

      // Collections
      {
        csharp_type: "List<T>",
        rust_type: "Vec<T>",
        is_generic: true,
        conversion_complexity: 2,
      },
      {
        csharp_type: "Dictionary<K,V>",
        rust_type: "HashMap<K,V>",
        is_generic: true,
        conversion_complexity: 3,
        requires_import: "std::collections::HashMap",
      },
      {
        csharp_type: "HashSet<T>",
        rust_type: "HashSet<T>",
        is_generic: true,
        conversion_complexity: 2,
        requires_import: "std::collections::HashSet",
      },
      {
        csharp_type: "Queue<T>",
        rust_type: "VecDeque<T>",
        is_generic: true,
        conversion_complexity: 2,
        requires_import: "std::collections::VecDeque",
      },
      {
        csharp_type: "Stack<T>",
        rust_type: "Vec<T>",
        is_generic: true,
        conversion_complexity: 2,
        notes: "Use Vec with push/pop",
      },
      {
        csharp_type: "IEnumerable<T>",
        rust_type: "impl Iterator<Item=T>",
        is_generic: true,
        conversion_complexity: 3,
      },
      {
        csharp_type: "IList<T>",
        rust_type: "Vec<T>",
        is_generic: true,
        conversion_complexity: 2,
      },

      // Neo-specific types
      {
        csharp_type: "BigInteger",
        rust_type: "num_bigint::BigInt",
        namespace: "System.Numerics",
        conversion_complexity: 2,
        requires_import: "num_bigint",
      },
      {
        csharp_type: "UInt160",
        rust_type: "U160",
        namespace: "Neo",
        conversion_complexity: 2,
      },
      {
        csharp_type: "UInt256",
        rust_type: "U256",
        namespace: "Neo",
        conversion_complexity: 2,
      },
      {
        csharp_type: "ECPoint",
        rust_type: "PublicKey",
        namespace: "Neo.Cryptography",
        conversion_complexity: 3,
      },
    ];

    for (const mapping of builtinMappings) {
      await this.dbRun(
        `
                INSERT OR IGNORE INTO type_mappings 
                (csharp_type, rust_type, namespace, requires_import, is_generic, conversion_complexity, notes, confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          mapping.csharp_type,
          mapping.rust_type,
          mapping.namespace || null,
          mapping.requires_import || null,
          mapping.is_generic ? 1 : 0,
          mapping.conversion_complexity || 1,
          mapping.notes || null,
          mapping.confidence || 1.0,
        ],
      );
    }
  }

  // Pattern management
  async recordPattern(
    csharpPattern: string,
    rustPattern: string,
    patternType: ConversionPattern["pattern_type"],
    confidence: number = 0.5,
    metadata?: ConversionMetadata,
  ): Promise<void> {
    const hash = this.hashPattern(csharpPattern + rustPattern);

    await this.dbRun(
      `
            INSERT INTO conversion_patterns 
            (pattern_hash, csharp_pattern, rust_pattern, pattern_type, confidence, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(pattern_hash) DO UPDATE SET
                usage_count = usage_count + 1,
                confidence = (confidence * usage_count + ?) / (usage_count + 1),
                last_used = CURRENT_TIMESTAMP
        `,
      [
        hash,
        csharpPattern,
        rustPattern,
        patternType,
        confidence,
        JSON.stringify(metadata || {}),
        confidence,
      ],
    );
  }

  async findSimilarPatterns(
    csharpCode: string,
    patternType?: ConversionPattern["pattern_type"],
    limit: number = 5,
  ): Promise<ConversionPattern[]> {
    let query = `
            SELECT * FROM conversion_patterns
            WHERE 1=1
        `;
    const params: QueryParams = [];

    if (patternType) {
      query += ` AND pattern_type = ?`;
      params.push(patternType);
    }

    query += ` ORDER BY confidence DESC, usage_count DESC LIMIT ?`;
    params.push(limit);

    const patterns = await this.dbAll(query, params);

    // Simple similarity check - in production, use better matching
    return patterns.filter((p: ConversionPattern) => {
      return this.calculateSimilarity(csharpCode, p.csharp_pattern) > 0.5;
    });
  }

  async updatePatternSuccess(
    patternHash: string,
    success: boolean,
  ): Promise<void> {
    const field = success ? "success_count" : "failure_count";
    await this.dbRun(
      `
            UPDATE conversion_patterns 
            SET ${field} = ${field} + 1,
                confidence = CASE 
                    WHEN ? = 1 THEN MIN(confidence * 1.1, 1.0)
                    ELSE MAX(confidence * 0.9, 0.1)
                END
            WHERE pattern_hash = ?
        `,
      [success ? 1 : 0, patternHash],
    );
  }

  // Project context management
  async getOrCreateProject(
    projectPath: string,
    moduleName: string,
  ): Promise<ProjectContext> {
    let project = await this.dbGet(
      `
            SELECT * FROM project_context
            WHERE project_path = ? AND module_name = ?
        `,
      [projectPath, moduleName],
    );

    if (!project) {
      await this.dbRun(
        `
                INSERT INTO project_context (project_path, module_name, start_time)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `,
        [projectPath, moduleName],
      );

      project = await this.dbGet(
        `
                SELECT * FROM project_context
                WHERE project_path = ? AND module_name = ?
            `,
        [projectPath, moduleName],
      );
    }

    return project;
  }

  async updateProjectProgress(
    projectPath: string,
    moduleName: string,
    updates: Partial<ProjectContext>,
  ): Promise<void> {
    const allowedFields = [
      "conversion_status",
      "files_total",
      "files_converted",
      "tests_total",
      "tests_passing",
      "metadata",
    ];

    const updateFields: string[] = [];
    const values: QueryParams = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        values.push(key === "metadata" ? JSON.stringify(value) : value);
      }
    }

    if (updateFields.length > 0) {
      values.push(projectPath, moduleName);
      await this.dbRun(
        `
                UPDATE project_context
                SET ${updateFields.join(", ")}
                WHERE project_path = ? AND module_name = ?
            `,
        values,
      );
    }
  }

  // Agent memory management
  async storeAgentMemory(
    agentId: string,
    key: string,
    value: AgentMemoryValue,
    importance: number = 0.5,
  ): Promise<void> {
    const agentType = this.extractAgentType(agentId);

    await this.dbRun(
      `
            INSERT INTO agent_memory 
            (agent_id, agent_type, memory_key, memory_value, importance)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(agent_id, memory_key) DO UPDATE SET
                memory_value = excluded.memory_value,
                importance = excluded.importance,
                access_count = access_count + 1,
                last_accessed = CURRENT_TIMESTAMP
        `,
      [agentId, agentType, key, JSON.stringify(value), importance],
    );
  }

  async recallAgentMemory(agentId: string, key: string): Promise<AgentMemoryValue | null> {
    const result = await this.dbGet(
      `
            SELECT memory_value FROM agent_memory
            WHERE agent_id = ? AND memory_key = ?
        `,
      [agentId, key],
    );

    if (result) {
      // Update access count
      await this.dbRun(
        `
                UPDATE agent_memory
                SET access_count = access_count + 1,
                    last_accessed = CURRENT_TIMESTAMP
                WHERE agent_id = ? AND memory_key = ?
            `,
        [agentId, key],
      );

      return JSON.parse(result.memory_value);
    }

    return null;
  }

  async getAgentMemories(
    agentId: string,
    minImportance: number = 0,
  ): Promise<AgentMemory[]> {
    return await this.dbAll(
      `
            SELECT * FROM agent_memory
            WHERE agent_id = ? AND importance >= ?
            ORDER BY importance DESC, last_accessed DESC
        `,
      [agentId, minImportance],
    );
  }

  // Type mapping queries
  async getTypeMapping(
    csharpType: string,
    namespace?: string,
  ): Promise<TypeMapping | null> {
    return await this.dbGet(
      `
            SELECT * FROM type_mappings
            WHERE csharp_type = ? AND (namespace = ? OR namespace IS NULL)
            ORDER BY namespace DESC
            LIMIT 1
        `,
      [csharpType, namespace || null],
    );
  }

  async getAllTypeMappings(): Promise<TypeMapping[]> {
    return await this.dbAll(`
            SELECT * FROM type_mappings
            ORDER BY conversion_complexity, csharp_type
        `);
  }

  // Conversion history
  async recordConversion(
    history: Omit<ConversionHistory, "id">,
  ): Promise<void> {
    await this.dbRun(
      `
            INSERT INTO conversion_history 
            (project_id, source_file, target_file, file_hash, conversion_status,
             agent_id, duration_ms, errors, warnings, patterns_applied)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        history.project_id,
        history.source_file,
        history.target_file,
        history.file_hash,
        history.conversion_status,
        history.agent_id || null,
        history.duration_ms || null,
        JSON.stringify(history.errors || []),
        JSON.stringify(history.warnings || []),
        JSON.stringify(history.patterns_applied || []),
      ],
    );
  }

  async getConversionHistory(projectId: number): Promise<ConversionHistory[]> {
    const results = await this.dbAll(
      `
            SELECT * FROM conversion_history
            WHERE project_id = ?
            ORDER BY created_at DESC
        `,
      [projectId],
    );

    return results.map((r: ParsedConversionHistory & { errors: string; warnings: string; patterns_applied: string }) => ({
      ...r,
      errors: JSON.parse(r.errors || "[]"),
      warnings: JSON.parse(r.warnings || "[]"),
      patterns_applied: JSON.parse(r.patterns_applied || "[]"),
    }));
  }

  // Analytics
  async getConversionStats(): Promise<ConversionStats> {
    const overall = await this.dbGet(`
            SELECT 
                COUNT(*) as total_conversions,
                SUM(CASE WHEN conversion_status = 'completed' THEN 1 ELSE 0 END) as successful,
                AVG(duration_ms) as avg_duration_ms,
                COUNT(DISTINCT project_id) as total_projects
            FROM conversion_history
        `);

    const patterns = await this.dbGet(`
            SELECT 
                COUNT(*) as total_patterns,
                AVG(confidence) as avg_confidence,
                SUM(usage_count) as total_usage,
                SUM(success_count) as total_successes,
                SUM(failure_count) as total_failures
            FROM conversion_patterns
        `);

    const topPatterns = await this.dbAll(`
            SELECT pattern_type, csharp_pattern, rust_pattern, confidence, usage_count
            FROM conversion_patterns
            ORDER BY confidence DESC, usage_count DESC
            LIMIT 10
        `);

    return {
      overall,
      patterns,
      topPatterns,
    };
  }

  // Memory maintenance
  async pruneOldMemory(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTimestamp = cutoffDate.toISOString();

    // Remove low-importance, rarely accessed agent memories
    await this.dbRun(
      `
            DELETE FROM agent_memory
            WHERE importance < 0.3 
            AND last_accessed < ?
            AND access_count < 5
        `,
      [cutoffTimestamp],
    );

    // Archive completed conversions
    await this.dbRun(
      `
            DELETE FROM conversion_history
            WHERE created_at < ?
            AND conversion_status = 'completed'
            AND project_id IN (
                SELECT id FROM project_context
                WHERE conversion_status = 'completed'
            )
        `,
      [cutoffTimestamp],
    );

    debugLog("Memory pruning completed");
  }

  async exportMemory(outputPath: string): Promise<void> {
    const data = {
      patterns: await this.dbAll("SELECT * FROM conversion_patterns"),
      typeMappings: await this.dbAll("SELECT * FROM type_mappings"),
      projects: await this.dbAll("SELECT * FROM project_context"),
      stats: await this.getConversionStats(),
    };

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    debugLog(`Memory exported to ${outputPath}`);
  }

  // Helper methods
  private hashPattern(pattern: string): string {
    const crypto = require("crypto");
    return crypto.createHash("md5").update(pattern).digest("hex");
  }

  private extractAgentType(agentId: string): string {
    const parts = agentId.split("-");
    return parts[0] || "unknown";
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation - improve with better algorithm
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  async recordCommand(command: string, result: unknown): Promise<void> {
    await this.ensureInitialized();
    const timestamp = new Date().toISOString();
    await this.dbRun(
      `INSERT INTO command_history (command, result, timestamp) VALUES (?, ?, ?)`,
      [command, JSON.stringify(result), timestamp],
    );
  }

  async close(): Promise<void> {
    if (this.db) {
      await promisify(this.db.close.bind(this.db))();
      this.db = null;
      this.initialized = false;
    }
  }
}

// Singleton instance
let memoryManagerInstance: MemoryManager | null = null;

export function getMemoryManager(workspacePath: string): MemoryManager {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager(workspacePath);
  }
  return memoryManagerInstance;
}
