import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import type { Database } from "sqlite3";

// Try to load sqlite3, but don't fail if it's not available
let sqlite3: any;
try {
  sqlite3 = require("sqlite3").verbose();
} catch (error) {
  console.warn("[AutoClaude] sqlite3 not available - memory features will be disabled");
  sqlite3 = null;
}
import { promisify } from "util";
import { debugLog } from "../utils/logging";
import { AutoClaudeError, ErrorCategory, ErrorSeverity } from "../core/errors";
import {
  ConversionError,
  ConversionWarning,
  PatternWithSimilarity,
  DatabaseRunResult,
  DatabaseGetResult,
  DatabaseAllResult,
  MemoryValue,
  QueryParams,
  ErrorContext,
  PromisifiedDatabase,
} from "../types/memory";

// Constants
const MEMORY_DB_VERSION = 1;
const MAX_PATTERN_LENGTH = 5000;
const MAX_MEMORY_VALUE_SIZE = 100000; // 100KB
const DEFAULT_CONFIDENCE = 0.5;
const MIN_CONFIDENCE = 0.1;
const MAX_CONFIDENCE = 1.0;

// Type definitions with strict validation
export interface ConversionPattern {
  id?: number;
  pattern_hash: string;
  csharp_pattern: string;
  rust_pattern: string;
  pattern_type:
    | "type"
    | "syntax"
    | "idiom"
    | "api"
    | "file_conversion"
    | "validated_conversion";
  confidence: number;
  usage_count: number;
  success_count: number;
  failure_count: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  last_used?: string;
}

export interface ProjectContext {
  id?: number;
  project_path: string;
  module_name: string;
  conversion_status: "pending" | "in_progress" | "completed" | "failed";
  files_total: number;
  files_converted: number;
  tests_total: number;
  tests_passing: number;
  start_time?: string;
  end_time?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversionHistory {
  id?: number;
  project_id: number;
  source_file: string;
  target_file: string;
  file_hash: string;
  conversion_status: "pending" | "in_progress" | "completed" | "failed";
  agent_id?: string;
  duration_ms?: number;
  errors?: ConversionError[];
  warnings?: ConversionWarning[];
  patterns_applied?: string[];
  created_at?: string;
}

export interface AgentMemory {
  id?: number;
  agent_id: string;
  agent_type: string;
  memory_key: string;
  memory_value: MemoryValue;
  importance: number;
  access_count: number;
  last_accessed?: string;
  created_at?: string;
}

export interface TypeMapping {
  id?: number;
  csharp_type: string;
  rust_type: string;
  namespace?: string;
  requires_import?: string;
  is_generic: boolean;
  conversion_complexity: number;
  notes?: string;
  confidence: number;
}

export interface MemoryConfig {
  dbPath?: string;
  maxPatternLength?: number;
  maxMemoryValueSize?: number;
  enableAutoBackup?: boolean;
  backupInterval?: number;
  enableCompression?: boolean;
  readonly?: boolean;
}

// Error classes
class MemoryError extends AutoClaudeError {
  constructor(message: string, code: string, context?: ErrorContext) {
    super(
      code,
      message,
      ErrorCategory.INTERNAL,
      ErrorSeverity.HIGH,
      context,
      true,
      message,
      [
        "Check memory database integrity",
        "Restart VS Code",
        "Clear memory cache",
      ],
    );
  }
}

export class MemoryManager {
  private db: Database | null = null;
  private dbPath: string;
  private initialized: boolean = false;
  private readonly: boolean = false;
  private transactionDepth: number = 0;

  // Promisified database methods
  private dbRun: PromisifiedDatabase['run'];
  private dbGet: PromisifiedDatabase['get'];
  private dbAll: PromisifiedDatabase['all'];
  private dbExec: PromisifiedDatabase['exec'];

  // Configuration
  private config: Required<MemoryConfig>;

  // Performance tracking
  private queryCount: number = 0;
  private queryTime: number = 0;

  constructor(
    private workspacePath: string,
    config?: MemoryConfig,
  ) {
    this.config = {
      dbPath:
        config?.dbPath || path.join(workspacePath, ".autoclaude", "memory.db"),
      maxPatternLength: config?.maxPatternLength || MAX_PATTERN_LENGTH,
      maxMemoryValueSize: config?.maxMemoryValueSize || MAX_MEMORY_VALUE_SIZE,
      enableAutoBackup: config?.enableAutoBackup ?? true,
      backupInterval: config?.backupInterval || 24 * 60 * 60 * 1000, // 24 hours
      enableCompression: config?.enableCompression ?? false,
      readonly: config?.readonly ?? false,
    };

    this.dbPath = this.config.dbPath;
    this.readonly = this.config.readonly;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Skip initialization if sqlite3 is not available
    if (!sqlite3) {
      console.warn("[AutoClaude] ProductionMemoryManager disabled - sqlite3 not available");
      this.initialized = true;
      return;
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Open database with proper error handling

      await new Promise<void>((resolve, reject) => {
        this.db = new sqlite3.Database(
          this.dbPath,
          this.readonly
            ? sqlite3.OPEN_READONLY
            : sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
          (err: Error | null) => {
            if (err) {
              reject(
                new MemoryError(
                  `Failed to open database: ${err.message}`,
                  "DB_OPEN_FAILED",
                  { dbPath: this.dbPath, error: err },
                ),
              );
            } else {
              resolve();
            }
          },
        );
      });

      // Configure database for better performance
      await this.configureDatabaseSettings();

      // Promisify methods
      this.dbRun = promisify(this.db!.run.bind(this.db));
      this.dbGet = promisify(this.db!.get.bind(this.db));
      this.dbAll = promisify(this.db!.all.bind(this.db));
      this.dbExec = promisify(this.db!.exec.bind(this.db));

      // Create tables and indexes
      if (!this.readonly) {
        await this.createTables();
        await this.createIndexes();
        await this.loadBuiltinMappings();
        await this.performMaintenance();
      }

      // Start auto-backup if enabled
      if (this.config.enableAutoBackup && !this.readonly) {
        this.startAutoBackup();
      }

      this.initialized = true;
      debugLog("Memory system initialized successfully");
    } catch (error) {
      debugLog(`Failed to initialize memory system: ${error}`);
      throw error;
    }
  }

  private async configureDatabaseSettings(): Promise<void> {
    if (!this.db) return;

    // Performance optimizations
    await new Promise<void>((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run("PRAGMA journal_mode = WAL", (err) => {
          if (err) debugLog(`Failed to set WAL mode: ${err}`);
        });
        this.db!.run("PRAGMA synchronous = NORMAL", (err) => {
          if (err) debugLog(`Failed to set synchronous mode: ${err}`);
        });
        this.db!.run("PRAGMA cache_size = -64000", (err) => {
          // 64MB cache
          if (err) debugLog(`Failed to set cache size: ${err}`);
        });
        this.db!.run("PRAGMA temp_store = MEMORY", (err) => {
          if (err) debugLog(`Failed to set temp store: ${err}`);
          resolve();
        });
      });
    });
  }

  private async createTables(): Promise<void> {
    const migrations = [
      // Database version tracking
      `CREATE TABLE IF NOT EXISTS db_version (
                version INTEGER PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

      // Basic patterns table for verification script compatibility
      `CREATE TABLE IF NOT EXISTS patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                input_pattern TEXT NOT NULL,
                output_pattern TEXT NOT NULL,
                category TEXT NOT NULL,
                confidence REAL NOT NULL,
                usage_count INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
      `CREATE INDEX IF NOT EXISTS idx_patterns_category ON patterns(category)`,
      `CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON patterns(confidence)`,

      // Conversion patterns table with validation
      `CREATE TABLE IF NOT EXISTS conversion_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern_hash TEXT UNIQUE NOT NULL CHECK(length(pattern_hash) > 0),
                csharp_pattern TEXT NOT NULL CHECK(length(csharp_pattern) <= ${MAX_PATTERN_LENGTH}),
                rust_pattern TEXT NOT NULL CHECK(length(rust_pattern) <= ${MAX_PATTERN_LENGTH}),
                pattern_type TEXT NOT NULL CHECK(pattern_type IN ('type', 'syntax', 'idiom', 'api', 'file_conversion', 'validated_conversion')),
                confidence REAL DEFAULT ${DEFAULT_CONFIDENCE} CHECK(confidence >= ${MIN_CONFIDENCE} AND confidence <= ${MAX_CONFIDENCE}),
                usage_count INTEGER DEFAULT 0 CHECK(usage_count >= 0),
                success_count INTEGER DEFAULT 0 CHECK(success_count >= 0),
                failure_count INTEGER DEFAULT 0 CHECK(failure_count >= 0),
                last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CHECK(success_count + failure_count <= usage_count)
            )`,

      // Project context table
      `CREATE TABLE IF NOT EXISTS project_context (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_path TEXT NOT NULL,
                module_name TEXT NOT NULL,
                conversion_status TEXT DEFAULT 'pending' CHECK(conversion_status IN ('pending', 'in_progress', 'completed', 'failed')),
                files_total INTEGER DEFAULT 0 CHECK(files_total >= 0),
                files_converted INTEGER DEFAULT 0 CHECK(files_converted >= 0),
                tests_total INTEGER DEFAULT 0 CHECK(tests_total >= 0),
                tests_passing INTEGER DEFAULT 0 CHECK(tests_passing >= 0),
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_path, module_name),
                CHECK(files_converted <= files_total),
                CHECK(tests_passing <= tests_total)
            )`,

      // Conversion history table
      `CREATE TABLE IF NOT EXISTS conversion_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                source_file TEXT NOT NULL,
                target_file TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                conversion_status TEXT NOT NULL CHECK(conversion_status IN ('pending', 'in_progress', 'completed', 'failed')),
                agent_id TEXT,
                duration_ms INTEGER CHECK(duration_ms >= 0),
                errors TEXT,
                warnings TEXT,
                patterns_applied TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES project_context(id) ON DELETE CASCADE
            )`,

      // Agent memory table with size limits
      `CREATE TABLE IF NOT EXISTS agent_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,
                agent_type TEXT NOT NULL,
                memory_key TEXT NOT NULL,
                memory_value TEXT NOT NULL CHECK(length(memory_value) <= ${MAX_MEMORY_VALUE_SIZE}),
                importance REAL DEFAULT 0.5 CHECK(importance >= 0 AND importance <= 1),
                access_count INTEGER DEFAULT 0 CHECK(access_count >= 0),
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
                is_generic INTEGER DEFAULT 0 CHECK(is_generic IN (0, 1)),
                conversion_complexity INTEGER DEFAULT 1 CHECK(conversion_complexity >= 1 AND conversion_complexity <= 5),
                notes TEXT,
                confidence REAL DEFAULT 1.0 CHECK(confidence >= 0 AND confidence <= 1),
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

      // Learned optimizations table
      `CREATE TABLE IF NOT EXISTS learned_optimizations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                optimization_type TEXT NOT NULL CHECK(optimization_type IN ('memory', 'performance', 'idiom')),
                before_pattern TEXT NOT NULL,
                after_pattern TEXT NOT NULL,
                performance_gain REAL CHECK(performance_gain >= -100 AND performance_gain <= 1000),
                applies_to TEXT NOT NULL CHECK(applies_to IN ('general', 'neo-specific', 'type-specific')),
                confidence REAL DEFAULT 0.5 CHECK(confidence >= 0 AND confidence <= 1),
                usage_count INTEGER DEFAULT 0 CHECK(usage_count >= 0),
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
    ];

    // Execute migrations in a transaction
    await this.transaction(async () => {
      for (const sql of migrations) {
        await this.dbRun(sql);
      }

      // Check and update database version
      const currentVersion = await this.dbGet(
        "SELECT MAX(version) as version FROM db_version",
      );
      if (!currentVersion || currentVersion.version < MEMORY_DB_VERSION) {
        await this.dbRun("INSERT INTO db_version (version) VALUES (?)", [
          MEMORY_DB_VERSION,
        ]);
      }
    });
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      // Pattern indexes
      "CREATE INDEX IF NOT EXISTS idx_pattern_type ON conversion_patterns(pattern_type)",
      "CREATE INDEX IF NOT EXISTS idx_pattern_confidence ON conversion_patterns(confidence DESC)",
      "CREATE INDEX IF NOT EXISTS idx_pattern_usage ON conversion_patterns(usage_count DESC)",

      // Project indexes
      "CREATE INDEX IF NOT EXISTS idx_project_status ON project_context(conversion_status)",
      "CREATE INDEX IF NOT EXISTS idx_project_path ON project_context(project_path)",

      // History indexes
      "CREATE INDEX IF NOT EXISTS idx_history_source ON conversion_history(source_file)",
      "CREATE INDEX IF NOT EXISTS idx_history_status ON conversion_history(conversion_status)",
      "CREATE INDEX IF NOT EXISTS idx_history_project ON conversion_history(project_id)",

      // Agent memory indexes
      "CREATE INDEX IF NOT EXISTS idx_agent_id ON agent_memory(agent_id)",
      "CREATE INDEX IF NOT EXISTS idx_agent_importance ON agent_memory(importance DESC)",
      "CREATE INDEX IF NOT EXISTS idx_agent_accessed ON agent_memory(last_accessed DESC)",

      // Type mapping indexes
      "CREATE INDEX IF NOT EXISTS idx_type_csharp ON type_mappings(csharp_type)",
      "CREATE INDEX IF NOT EXISTS idx_type_complexity ON type_mappings(conversion_complexity)",
    ];

    for (const sql of indexes) {
      try {
        await this.dbRun(sql);
      } catch (error) {
        debugLog(`Failed to create index: ${error}`);
      }
    }
  }

  // Transaction support
  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    if (this.readonly) {
      throw new MemoryError(
        "Cannot start transaction in readonly mode",
        "READONLY_TRANSACTION",
      );
    }

    this.transactionDepth++;

    if (this.transactionDepth === 1) {
      await this.dbRun("BEGIN TRANSACTION");
    }

    try {
      const result = await operation();

      this.transactionDepth--;
      if (this.transactionDepth === 0) {
        await this.dbRun("COMMIT");
      }

      return result;
    } catch (error) {
      this.transactionDepth--;
      if (this.transactionDepth === 0) {
        await this.dbRun("ROLLBACK");
      }
      throw error;
    }
  }

  // Pattern management with validation
  async recordPattern(
    csharpPattern: string,
    rustPattern: string,
    patternType: ConversionPattern["pattern_type"],
    confidence: number = DEFAULT_CONFIDENCE,
    metadata?: Record<string, any>,
  ): Promise<void> {
    this.ensureInitialized();
    this.ensureWritable();

    // Validate inputs
    if (!csharpPattern || !rustPattern) {
      throw new MemoryError("Pattern cannot be empty", "INVALID_PATTERN");
    }

    if (
      csharpPattern.length > this.config.maxPatternLength ||
      rustPattern.length > this.config.maxPatternLength
    ) {
      throw new MemoryError(
        `Pattern exceeds maximum length of ${this.config.maxPatternLength}`,
        "PATTERN_TOO_LONG",
      );
    }

    confidence = Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, confidence));

    const hash = this.hashPattern(csharpPattern + rustPattern);

    try {
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

      this.trackQuery();
    } catch (error) {
      throw new MemoryError(
        `Failed to record pattern: ${error instanceof Error ? error.message : String(error)}`,
        "PATTERN_RECORD_FAILED",
        { csharpPattern, rustPattern, error },
      );
    }
  }

  async findSimilarPatterns(
    csharpCode: string,
    patternType?: ConversionPattern["pattern_type"],
    limit: number = 5,
  ): Promise<ConversionPattern[]> {
    this.ensureInitialized();

    if (!csharpCode) {
      return [];
    }

    limit = Math.max(1, Math.min(100, limit));

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
    params.push(limit * 2); // Get more to filter

    try {
      const patterns = await this.dbAll(query, params);
      this.trackQuery();

      // Calculate similarity and filter
      const withSimilarity = patterns.map((p: ConversionPattern) => ({
        ...p,
        similarity: this.calculateSimilarity(csharpCode, p.csharp_pattern),
      }));

      return withSimilarity
        .filter((p: PatternWithSimilarity) => p.similarity > 0.3)
        .sort((a: PatternWithSimilarity, b: PatternWithSimilarity) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(({ similarity, ...pattern }: PatternWithSimilarity) => pattern);
    } catch (error) {
      debugLog(`Failed to find similar patterns: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  // Project context management with validation
  async getOrCreateProject(
    projectPath: string,
    moduleName: string,
  ): Promise<ProjectContext> {
    this.ensureInitialized();

    if (!projectPath || !moduleName) {
      throw new MemoryError(
        "Project path and module name are required",
        "INVALID_PROJECT_INFO",
      );
    }

    try {
      let project = await this.dbGet(
        `
                SELECT * FROM project_context
                WHERE project_path = ? AND module_name = ?
            `,
        [projectPath, moduleName],
      );

      if (!project && !this.readonly) {
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

      this.trackQuery();
      return project || null;
    } catch (error) {
      throw new MemoryError(
        `Failed to get/create project: ${error instanceof Error ? error.message : String(error)}`,
        "PROJECT_ACCESS_FAILED",
        { projectPath, moduleName, error },
      );
    }
  }

  // Agent memory with compression support
  async storeAgentMemory(
    agentId: string,
    key: string,
    value: MemoryValue,
    importance: number = 0.5,
  ): Promise<void> {
    this.ensureInitialized();
    this.ensureWritable();

    if (!agentId || !key) {
      throw new MemoryError(
        "Agent ID and key are required",
        "INVALID_AGENT_MEMORY",
      );
    }

    importance = Math.max(0, Math.min(1, importance));

    let serializedValue = JSON.stringify(value);

    // Compress if enabled and value is large
    if (this.config.enableCompression && serializedValue.length > 1000) {
      serializedValue = await this.compress(serializedValue);
    }

    if (serializedValue.length > this.config.maxMemoryValueSize) {
      throw new MemoryError(
        `Memory value exceeds maximum size of ${this.config.maxMemoryValueSize} bytes`,
        "MEMORY_TOO_LARGE",
      );
    }

    const agentType = this.extractAgentType(agentId);

    try {
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
        [agentId, agentType, key, serializedValue, importance],
      );

      this.trackQuery();
    } catch (error) {
      throw new MemoryError(
        `Failed to store agent memory: ${error instanceof Error ? error.message : String(error)}`,
        "AGENT_MEMORY_STORE_FAILED",
        { agentId, key, error },
      );
    }
  }

  // Performance tracking
  private trackQuery(): void {
    this.queryCount++;
  }

  /**
   * Hash content for consistent storage and retrieval
   */
  private hashContent(content: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /**
   * Record task completion for agent coordination
   */
  async recordTaskCompletion(
    taskId: string,
    taskType: string,
    success: boolean,
    error: string,
    executionTime: number,
  ): Promise<void> {
    if (!this.initialized) {
      throw new AutoClaudeError(
        "MEMORY_NOT_INITIALIZED",
        "Memory manager not initialized",
        ErrorCategory.INTERNAL,
        ErrorSeverity.HIGH,
      );
    }

    try {
      const query = `
                INSERT INTO agent_memory (
                    agent_id,
                    memory_type,
                    memory_key,
                    memory_value,
                    metadata,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now'))
            `;

      const params = [
        "task-recorder",
        "task_completion",
        taskId,
        JSON.stringify({
          taskType,
          success,
          error,
          executionTime,
        }),
        JSON.stringify({ completedAt: new Date().toISOString() }),
      ];

      await this.dbRun(query, params);
      debugLog(`Task completion recorded: ${taskId}`);
    } catch (error) {
      debugLog(`Failed to record task completion: ${error}`);
      throw new AutoClaudeError(
        "TASK_COMPLETION_FAILED",
        `Failed to record task completion: ${error}`,
        ErrorCategory.DATABASE,
        ErrorSeverity.MEDIUM,
      );
    }
  }

  /**
   * Record validation results
   */
  async recordValidation(
    originalCode: string,
    convertedCode: string,
    validationType: string,
    score: number,
    success: boolean,
  ): Promise<void> {
    if (!this.initialized) {
      throw new AutoClaudeError(
        "MEMORY_NOT_INITIALIZED",
        "Memory manager not initialized",
        ErrorCategory.INTERNAL,
        ErrorSeverity.HIGH,
      );
    }

    try {
      const query = `
                INSERT INTO conversion_history (
                    original_code_hash,
                    converted_code_hash,
                    success,
                    error_message,
                    conversion_time_ms,
                    validation_score,
                    metadata,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `;

      const originalHash = this.hashContent(originalCode);
      const convertedHash = this.hashContent(convertedCode);

      const params = [
        originalHash,
        convertedHash,
        success ? 1 : 0,
        success ? null : "Validation failed",
        100, // Default conversion time
        score,
        JSON.stringify({ validationType }),
      ];

      await this.dbRun(query, params);
      debugLog(`Validation recorded: ${validationType}, score: ${score}`);
    } catch (error) {
      debugLog(`Failed to record validation: ${error}`);
      throw new AutoClaudeError(
        "VALIDATION_RECORDING_FAILED",
        `Failed to record validation: ${error}`,
        ErrorCategory.DATABASE,
        ErrorSeverity.MEDIUM,
      );
    }
  }

  /**
   * Get patterns by category and confidence threshold
   */
  async getPatterns(
    category: string,
    minConfidence: number = 0.7,
  ): Promise<
    Array<{
      id: number;
      input_pattern: string;
      output_pattern: string;
      category: string;
      confidence: number;
      usage_count: number;
      success_count: number;
    }>
  > {
    if (!this.initialized) {
      throw new AutoClaudeError(
        "MEMORY_NOT_INITIALIZED",
        "Memory manager not initialized",
        ErrorCategory.INTERNAL,
        ErrorSeverity.HIGH,
      );
    }

    try {
      const query = `
                SELECT id, input_pattern, output_pattern, category, confidence, usage_count, success_count
                FROM patterns 
                WHERE category = ? AND confidence >= ?
                ORDER BY confidence DESC, usage_count DESC
                LIMIT 100
            `;

      const patterns = await this.dbAll(query, [category, minConfidence]);
      return patterns as Array<{
        id: number;
        input_pattern: string;
        output_pattern: string;
        category: string;
        confidence: number;
        usage_count: number;
        success_count: number;
      }>;
    } catch (error) {
      debugLog(`Failed to get patterns: ${error}`);
      throw new AutoClaudeError(
        "PATTERN_RETRIEVAL_FAILED",
        `Failed to retrieve patterns: ${error}`,
        ErrorCategory.DATABASE,
        ErrorSeverity.MEDIUM,
      );
    }
  }

  async getPerformanceStats(): Promise<{
    queryCount: number;
    averageQueryTime: number;
    databaseSize: number;
    tableStats: Record<string, number>;
  }> {
    this.ensureInitialized();

    const stats = {
      queryCount: this.queryCount,
      averageQueryTime:
        this.queryCount > 0 ? this.queryTime / this.queryCount : 0,
      databaseSize: 0,
      tableStats: {} as Record<string, number>,
    };

    try {
      // Get database file size
      const dbStats = fs.statSync(this.dbPath);
      stats.databaseSize = dbStats.size;

      // Get row counts for each table
      const tables = [
        "conversion_patterns",
        "project_context",
        "conversion_history",
        "agent_memory",
        "type_mappings",
        "learned_optimizations",
      ];

      for (const table of tables) {
        const result = await this.dbGet(
          `SELECT COUNT(*) as count FROM ${table}`,
        );
        stats.tableStats[table] = result.count;
      }

      this.trackQuery();
    } catch (error) {
      debugLog(`Failed to get performance stats: ${error}`);
    }

    return stats;
  }

  // Maintenance operations
  private async performMaintenance(): Promise<void> {
    try {
      // Vacuum database to reclaim space
      await this.dbRun("VACUUM");

      // Analyze tables for query optimization
      await this.dbRun("ANALYZE");

      // Clean up old session states
      await this.dbRun(`
                DELETE FROM session_state 
                WHERE updated_at < datetime('now', '-7 days')
            `);

      debugLog("Database maintenance completed");
    } catch (error) {
      debugLog(`Maintenance failed: ${error}`);
    }
  }

  // Auto-backup functionality
  private startAutoBackup(): void {
    if (!this.config.enableAutoBackup) return;

    setInterval(async () => {
      try {
        const backupPath = `${this.dbPath}.backup`;
        await this.dbRun(`VACUUM INTO ?`, [backupPath]);
        debugLog(`Database backed up to ${backupPath}`);
      } catch (error) {
        debugLog(`Backup failed: ${error}`);
      }
    }, this.config.backupInterval);
  }

  // Utility methods
  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new MemoryError("Memory system not initialized", "NOT_INITIALIZED");
    }
  }

  private ensureWritable(): void {
    if (this.readonly) {
      throw new MemoryError(
        "Memory system is in readonly mode",
        "READONLY_MODE",
      );
    }
  }

  private hashPattern(pattern: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(pattern).digest("hex");
  }

  private extractAgentType(agentId: string): string {
    const parts = agentId.split("-");
    return parts[0] || "unknown";
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    // Normalize strings
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    const similarity = (longer.length - editDistance) / longer.length;

    // Boost similarity if one string contains the other
    if (longer.includes(shorter) || shorter.includes(longer)) {
      return Math.min(1.0, similarity * 1.2);
    }

    return similarity;
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

  private async compress(data: string): Promise<string> {
    // Simple compression using zlib
    const zlib = require("zlib");
    const compressed = await promisify(zlib.gzip)(Buffer.from(data));
    return compressed.toString("base64");
  }

  private async decompress(data: string): Promise<string> {
    const zlib = require("zlib");
    const buffer = Buffer.from(data, "base64");
    const decompressed = await promisify(zlib.gunzip)(buffer);
    return decompressed.toString();
  }

  async close(): Promise<void> {
    if (this.db) {
      try {
        await promisify(this.db.close.bind(this.db))();
        this.db = null;
        this.initialized = false;
        debugLog("Memory system closed");
      } catch (error) {
        debugLog(`Failed to close database: ${error}`);
      }
    }
  }

  // Pattern success tracking
  async updatePatternSuccess(
    patternHash: string,
    success: boolean,
  ): Promise<void> {
    this.ensureInitialized();
    this.ensureWritable();

    try {
      const field = success ? "success_count" : "failure_count";
      await this.dbRun(
        `
                UPDATE conversion_patterns 
                SET ${field} = ${field} + 1,
                    confidence = CASE 
                        WHEN ? = 1 THEN MIN(confidence * 1.1, 1.0)
                        ELSE MAX(confidence * 0.9, 0.1)
                    END,
                    last_used = CURRENT_TIMESTAMP
                WHERE pattern_hash = ?
            `,
        [success ? 1 : 0, patternHash],
      );

      this.trackQuery();
    } catch (error) {
      throw new MemoryError(
        `Failed to update pattern success: ${error instanceof Error ? error.message : String(error)}`,
        "PATTERN_UPDATE_FAILED",
        { patternHash, success, error },
      );
    }
  }

  // Project progress updates
  async updateProjectProgress(
    projectPath: string,
    moduleName: string,
    updates: Partial<ProjectContext>,
  ): Promise<void> {
    this.ensureInitialized();
    this.ensureWritable();

    if (!projectPath || !moduleName) {
      throw new MemoryError(
        "Project path and module name are required",
        "INVALID_PROJECT_INFO",
      );
    }

    const allowedFields = [
      "conversion_status",
      "files_total",
      "files_converted",
      "tests_total",
      "tests_passing",
      "end_time",
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

    if (updateFields.length === 0) {
      return; // Nothing to update
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(projectPath, moduleName);

    try {
      await this.dbRun(
        `
                UPDATE project_context
                SET ${updateFields.join(", ")}
                WHERE project_path = ? AND module_name = ?
            `,
        values,
      );

      this.trackQuery();
    } catch (error) {
      throw new MemoryError(
        `Failed to update project progress: ${error instanceof Error ? error.message : String(error)}`,
        "PROJECT_UPDATE_FAILED",
        { projectPath, moduleName, updates, error },
      );
    }
  }

  // Agent memory retrieval
  async recallAgentMemory(agentId: string, key: string): Promise<any> {
    this.ensureInitialized();

    if (!agentId || !key) {
      throw new MemoryError(
        "Agent ID and key are required",
        "INVALID_AGENT_MEMORY",
      );
    }

    try {
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

        let value = result.memory_value;

        // Decompress if needed
        if (this.config.enableCompression && value.length > 1000) {
          try {
            value = await this.decompress(value);
          } catch (error) {
            // If decompression fails, assume it's not compressed
            debugLog(`Failed to decompress memory value: ${error}`);
          }
        }

        this.trackQuery();
        return JSON.parse(value);
      }

      this.trackQuery();
      return null;
    } catch (error) {
      throw new MemoryError(
        `Failed to recall agent memory: ${error instanceof Error ? error.message : String(error)}`,
        "AGENT_MEMORY_RECALL_FAILED",
        { agentId, key, error },
      );
    }
  }

  async getAgentMemories(
    agentId: string,
    minImportance: number = 0,
  ): Promise<AgentMemory[]> {
    this.ensureInitialized();

    if (!agentId) {
      throw new MemoryError("Agent ID is required", "INVALID_AGENT_ID");
    }

    minImportance = Math.max(0, Math.min(1, minImportance));

    try {
      const results = await this.dbAll(
        `
                SELECT * FROM agent_memory
                WHERE agent_id = ? AND importance >= ?
                ORDER BY importance DESC, last_accessed DESC
            `,
        [agentId, minImportance],
      );

      this.trackQuery();
      return results;
    } catch (error) {
      throw new MemoryError(
        `Failed to get agent memories: ${error instanceof Error ? error.message : String(error)}`,
        "AGENT_MEMORIES_FAILED",
        { agentId, minImportance, error },
      );
    }
  }

  // Type mapping queries
  async getTypeMapping(
    csharpType: string,
    namespace?: string,
  ): Promise<TypeMapping | null> {
    this.ensureInitialized();

    if (!csharpType) {
      return null;
    }

    try {
      const result = await this.dbGet(
        `
                SELECT * FROM type_mappings
                WHERE csharp_type = ? AND (namespace = ? OR namespace IS NULL)
                ORDER BY namespace DESC
                LIMIT 1
            `,
        [csharpType, namespace || null],
      );

      this.trackQuery();
      return result || null;
    } catch (error) {
      debugLog(`Failed to get type mapping: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async getAllTypeMappings(): Promise<TypeMapping[]> {
    this.ensureInitialized();

    try {
      const results = await this.dbAll(`
                SELECT * FROM type_mappings
                ORDER BY conversion_complexity, csharp_type
            `);

      this.trackQuery();
      return results;
    } catch (error) {
      debugLog(`Failed to get all type mappings: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  // Conversion history
  async recordConversion(
    history: Omit<ConversionHistory, "id">,
  ): Promise<void> {
    this.ensureInitialized();
    this.ensureWritable();

    if (!history.project_id || !history.source_file || !history.target_file) {
      throw new MemoryError(
        "Project ID, source file, and target file are required",
        "INVALID_CONVERSION_HISTORY",
      );
    }

    try {
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

      this.trackQuery();
    } catch (error) {
      throw new MemoryError(
        `Failed to record conversion: ${error instanceof Error ? error.message : String(error)}`,
        "CONVERSION_RECORD_FAILED",
        { history, error },
      );
    }
  }

  async getConversionHistory(projectId: number): Promise<ConversionHistory[]> {
    this.ensureInitialized();

    if (!projectId) {
      return [];
    }

    try {
      const results = await this.dbAll(
        `
                SELECT * FROM conversion_history
                WHERE project_id = ?
                ORDER BY created_at DESC
            `,
        [projectId],
      );

      this.trackQuery();
      return results.map((r: ConversionHistory) => ({
        ...r,
        errors: JSON.parse(r.errors || "[]"),
        warnings: JSON.parse(r.warnings || "[]"),
        patterns_applied: JSON.parse(r.patterns_applied || "[]"),
      }));
    } catch (error) {
      debugLog(`Failed to get conversion history: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  // Analytics and statistics
  async getConversionStats(): Promise<any> {
    this.ensureInitialized();

    try {
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

      this.trackQuery();
      return {
        overall: overall || {},
        patterns: patterns || {},
        topPatterns: topPatterns || [],
      };
    } catch (error) {
      debugLog(`Failed to get conversion stats: ${error instanceof Error ? error.message : String(error)}`);
      return {
        overall: {},
        patterns: {},
        topPatterns: [],
      };
    }
  }

  // Memory maintenance
  async pruneOldMemory(daysToKeep: number = 30): Promise<void> {
    this.ensureInitialized();
    this.ensureWritable();

    if (daysToKeep < 0) {
      daysToKeep = 30;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTimestamp = cutoffDate.toISOString();

    try {
      await this.transaction(async () => {
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

        // Archive completed conversions from completed projects
        await this.dbRun(
          `
                    DELETE FROM conversion_history
                    WHERE created_at < ?
                    AND conversion_status = 'completed'
                    AND project_id IN (
                        SELECT id FROM project_context
                        WHERE conversion_status = 'completed'
                        AND (end_time IS NULL OR end_time < ?)
                    )
                `,
          [cutoffTimestamp, cutoffTimestamp],
        );

        // Clean up old session states
        await this.dbRun(
          `
                    DELETE FROM session_state 
                    WHERE updated_at < ?
                `,
          [cutoffTimestamp],
        );
      });

      debugLog("Memory pruning completed", { daysToKeep, cutoffDate });
    } catch (error) {
      throw new MemoryError(
        `Failed to prune old memory: ${error instanceof Error ? error.message : String(error)}`,
        "MEMORY_PRUNE_FAILED",
        { daysToKeep, error },
      );
    }
  }

  async exportMemory(outputPath: string): Promise<void> {
    this.ensureInitialized();

    if (!outputPath) {
      throw new MemoryError("Output path is required", "INVALID_OUTPUT_PATH");
    }

    try {
      const data = {
        exportedAt: new Date().toISOString(),
        version: MEMORY_DB_VERSION,
        workspace: this.workspacePath,
        patterns: await this.dbAll(
          "SELECT * FROM conversion_patterns ORDER BY confidence DESC",
        ),
        typeMappings: await this.dbAll(
          "SELECT * FROM type_mappings ORDER BY conversion_complexity",
        ),
        projects: await this.dbAll(
          "SELECT * FROM project_context ORDER BY created_at DESC",
        ),
        stats: await this.getConversionStats(),
        performanceStats: await this.getPerformanceStats(),
      };

      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
      debugLog(`Memory exported to ${outputPath}`, {
        patterns: data.patterns.length,
        projects: data.projects.length,
      });
    } catch (error) {
      throw new MemoryError(
        `Failed to export memory: ${error instanceof Error ? error.message : String(error)}`,
        "MEMORY_EXPORT_FAILED",
        { outputPath, error },
      );
    }
  }

  // Built-in type mappings loader
  private async loadBuiltinMappings(): Promise<void> {
    const builtinMappings: Partial<TypeMapping>[] = [
      // Basic types
      {
        csharp_type: "int",
        rust_type: "i32",
        conversion_complexity: 1,
        confidence: 1.0,
      },
      {
        csharp_type: "uint",
        rust_type: "u32",
        conversion_complexity: 1,
        confidence: 1.0,
      },
      {
        csharp_type: "long",
        rust_type: "i64",
        conversion_complexity: 1,
        confidence: 1.0,
      },
      {
        csharp_type: "ulong",
        rust_type: "u64",
        conversion_complexity: 1,
        confidence: 1.0,
      },
      {
        csharp_type: "short",
        rust_type: "i16",
        conversion_complexity: 1,
        confidence: 1.0,
      },
      {
        csharp_type: "ushort",
        rust_type: "u16",
        conversion_complexity: 1,
        confidence: 1.0,
      },
      {
        csharp_type: "byte",
        rust_type: "u8",
        conversion_complexity: 1,
        confidence: 1.0,
      },
      {
        csharp_type: "sbyte",
        rust_type: "i8",
        conversion_complexity: 1,
        confidence: 1.0,
      },
      {
        csharp_type: "bool",
        rust_type: "bool",
        conversion_complexity: 1,
        confidence: 1.0,
      },
      {
        csharp_type: "char",
        rust_type: "char",
        conversion_complexity: 1,
        confidence: 1.0,
      },
      {
        csharp_type: "float",
        rust_type: "f32",
        conversion_complexity: 1,
        confidence: 1.0,
      },
      {
        csharp_type: "double",
        rust_type: "f64",
        conversion_complexity: 1,
        confidence: 1.0,
      },
      {
        csharp_type: "decimal",
        rust_type: "rust_decimal::Decimal",
        conversion_complexity: 2,
        requires_import: "rust_decimal",
        confidence: 0.9,
      },
      {
        csharp_type: "string",
        rust_type: "String",
        conversion_complexity: 2,
        confidence: 0.95,
      },

      // Collections
      {
        csharp_type: "List<T>",
        rust_type: "Vec<T>",
        is_generic: true,
        conversion_complexity: 2,
        confidence: 0.95,
      },
      {
        csharp_type: "Dictionary<K,V>",
        rust_type: "HashMap<K,V>",
        is_generic: true,
        conversion_complexity: 3,
        requires_import: "std::collections::HashMap",
        confidence: 0.9,
      },
      {
        csharp_type: "HashSet<T>",
        rust_type: "HashSet<T>",
        is_generic: true,
        conversion_complexity: 2,
        requires_import: "std::collections::HashSet",
        confidence: 0.9,
      },
      {
        csharp_type: "Queue<T>",
        rust_type: "VecDeque<T>",
        is_generic: true,
        conversion_complexity: 2,
        requires_import: "std::collections::VecDeque",
        confidence: 0.85,
      },
      {
        csharp_type: "Stack<T>",
        rust_type: "Vec<T>",
        is_generic: true,
        conversion_complexity: 2,
        notes: "Use Vec with push/pop",
        confidence: 0.8,
      },
      {
        csharp_type: "IEnumerable<T>",
        rust_type: "impl Iterator<Item=T>",
        is_generic: true,
        conversion_complexity: 3,
        confidence: 0.7,
      },
      {
        csharp_type: "IList<T>",
        rust_type: "Vec<T>",
        is_generic: true,
        conversion_complexity: 2,
        confidence: 0.85,
      },

      // Neo-specific types
      {
        csharp_type: "BigInteger",
        rust_type: "num_bigint::BigInt",
        namespace: "System.Numerics",
        conversion_complexity: 2,
        requires_import: "num_bigint",
        confidence: 0.9,
      },
      {
        csharp_type: "UInt160",
        rust_type: "U160",
        namespace: "Neo",
        conversion_complexity: 2,
        confidence: 0.95,
      },
      {
        csharp_type: "UInt256",
        rust_type: "U256",
        namespace: "Neo",
        conversion_complexity: 2,
        confidence: 0.95,
      },
      {
        csharp_type: "ECPoint",
        rust_type: "PublicKey",
        namespace: "Neo.Cryptography",
        conversion_complexity: 3,
        confidence: 0.85,
      },
      {
        csharp_type: "StackItem",
        rust_type: "StackItem",
        namespace: "Neo.VM",
        conversion_complexity: 3,
        confidence: 0.9,
      },

      // Common patterns
      {
        csharp_type: "Task<T>",
        rust_type: "Pin<Box<dyn Future<Output = T>>>",
        is_generic: true,
        conversion_complexity: 4,
        requires_import: "std::pin::Pin, std::future::Future",
        confidence: 0.7,
      },
      {
        csharp_type: "Task",
        rust_type: "Pin<Box<dyn Future<Output = ()>>>",
        conversion_complexity: 4,
        requires_import: "std::pin::Pin, std::future::Future",
        confidence: 0.7,
      },
      {
        csharp_type: "Result<T>",
        rust_type: "Result<T, Box<dyn std::error::Error>>",
        is_generic: true,
        conversion_complexity: 2,
        confidence: 0.9,
      },
    ];

    try {
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

      debugLog(`Loaded ${builtinMappings.length} built-in type mappings`);
    } catch (error) {
      debugLog(`Failed to load built-in mappings: ${error}`);
    }
  }
}

// Singleton instance management with workspace isolation
const memoryManagers = new Map<string, MemoryManager>();

export function getMemoryManager(
  workspacePath: string,
  config?: MemoryConfig,
): MemoryManager {
  if (!memoryManagers.has(workspacePath)) {
    memoryManagers.set(workspacePath, new MemoryManager(workspacePath, config));
  }
  return memoryManagers.get(workspacePath)!;
}

export function closeAllMemoryManagers(): Promise<void[]> {
  const promises = Array.from(memoryManagers.values()).map((manager) =>
    manager.close(),
  );
  memoryManagers.clear();
  return Promise.all(promises);
}
