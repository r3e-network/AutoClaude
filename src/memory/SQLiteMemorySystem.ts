import * as sqlite3 from "sqlite3";
import { open, Database as SqliteDatabase } from "sqlite";
import * as path from "path";
import { log } from "../utils/productionLogger";
import { Pattern } from "../agents/hivemind/types";
import {
  CacheEntry,
  TaskRecord,
  SessionData,
  InsightRecord,
  PatternRow,
  ContextRow,
  InsightRow,
} from "../types/memory";

/**
 * SQLite-based persistent memory system inspired by Claude Flow
 * Provides pattern recognition, learning, and cross-session memory
 */
export class SQLiteMemorySystem {
  private db: SqliteDatabase<sqlite3.Database, sqlite3.Statement> | null = null;
  private readonly dbPath: string;

  constructor(private workspaceRoot: string) {
    this.dbPath = path.join(workspaceRoot, ".autoclaude", "memory.db");
  }

  async initialize(): Promise<void> {
    try {
      // Open database connection
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
      });

      // Create tables if they don't exist
      await this.createTables();

      // Run maintenance
      await this.runMaintenance();

      log.info("SQLite memory system initialized", { dbPath: this.dbPath });
    } catch (error) {
      log.error("Failed to initialize SQLite memory", error as Error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    // Patterns table - stores learned patterns
    await this.db.exec(`
            CREATE TABLE IF NOT EXISTS patterns (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                frequency INTEGER DEFAULT 1,
                success_rate REAL DEFAULT 0.0,
                average_duration INTEGER DEFAULT 0,
                last_used INTEGER NOT NULL,
                metadata TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);

    // Tasks table - stores task history
    await this.db.exec(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                agent_id TEXT,
                priority INTEGER,
                duration INTEGER,
                success BOOLEAN,
                error TEXT,
                context TEXT,
                result TEXT,
                created_at INTEGER NOT NULL,
                completed_at INTEGER
            )
        `);

    // Sessions table - stores session information
    await this.db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                mode TEXT NOT NULL,
                started_at INTEGER NOT NULL,
                ended_at INTEGER,
                tasks_completed INTEGER DEFAULT 0,
                tasks_failed INTEGER DEFAULT 0,
                agents TEXT,
                memory TEXT,
                summary TEXT
            )
        `);

    // Cache table - stores cached results
    await this.db.exec(`
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                type TEXT NOT NULL,
                hits INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                expires_at INTEGER,
                last_accessed INTEGER NOT NULL
            )
        `);

    // Learning table - stores learning data
    await this.db.exec(`
            CREATE TABLE IF NOT EXISTS learning (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                input TEXT NOT NULL,
                output TEXT NOT NULL,
                confidence REAL DEFAULT 0.0,
                feedback TEXT,
                created_at INTEGER NOT NULL
            )
        `);

    // Metrics table - stores performance metrics
    await this.db.exec(`
            CREATE TABLE IF NOT EXISTS metrics (
                id TEXT PRIMARY KEY,
                metric_type TEXT NOT NULL,
                value REAL NOT NULL,
                tags TEXT,
                timestamp INTEGER NOT NULL
            )
        `);

    // Create indexes for better performance
    await this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(type);
            CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
            CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
            CREATE INDEX IF NOT EXISTS idx_cache_type ON cache(type);
            CREATE INDEX IF NOT EXISTS idx_learning_category ON learning(category);
            CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type);
            CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
        `);
  }

  async recordPattern(data: {
    type: string;
    success: boolean;
    duration: number;
    context?: Record<string, unknown>;
    result?: unknown;
  }): Promise<void> {
    if (!this.db) return;

    const patternId = `${data.type}_${Date.now()}`;
    const now = Date.now();

    // Check if pattern exists
    const existing = await this.db.get(
      "SELECT * FROM patterns WHERE type = ?",
      data.type,
    );

    if (existing) {
      // Update existing pattern
      const newFrequency = existing.frequency + 1;
      const newSuccessRate =
        (existing.success_rate * existing.frequency + (data.success ? 1 : 0)) /
        newFrequency;
      const newAvgDuration =
        (existing.average_duration * existing.frequency + data.duration) /
        newFrequency;

      await this.db.run(
        `UPDATE patterns 
                SET frequency = ?, success_rate = ?, average_duration = ?, 
                    last_used = ?, updated_at = ?, metadata = ?
                WHERE id = ?`,
        newFrequency,
        newSuccessRate,
        Math.round(newAvgDuration),
        now,
        now,
        JSON.stringify({
          ...JSON.parse(existing.metadata || "{}"),
          lastContext: data.context,
        }),
        existing.id,
      );
    } else {
      // Create new pattern
      await this.db.run(
        `INSERT INTO patterns 
                (id, type, frequency, success_rate, average_duration, last_used, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        patternId,
        data.type,
        1,
        data.success ? 1.0 : 0.0,
        data.duration,
        now,
        JSON.stringify({ context: data.context, result: data.result }),
        now,
        now,
      );
    }

    log.debug("Pattern recorded", { type: data.type, success: data.success });
  }

  async getLearnedPatterns(limit = 100): Promise<Pattern[]> {
    if (!this.db) return [];

    const rows = await this.db.all(
      `SELECT * FROM patterns 
            ORDER BY frequency DESC, success_rate DESC 
            LIMIT ?`,
      limit,
    );

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      frequency: row.frequency,
      successRate: row.success_rate,
      averageDuration: row.average_duration,
      lastUsed: row.last_used,
      metadata: JSON.parse(row.metadata || "{}"),
    }));
  }

  async searchCache(type: string, context: Record<string, unknown>): Promise<unknown | null> {
    if (!this.db) return null;

    const key = this.generateCacheKey(type, context);
    const now = Date.now();

    const cached = await this.db.get(
      `SELECT * FROM cache 
            WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)`,
      key,
      now,
    );

    if (cached) {
      // Update cache hits and last accessed
      await this.db.run(
        "UPDATE cache SET hits = hits + 1, last_accessed = ? WHERE key = ?",
        now,
        key,
      );

      log.debug("Cache hit", { key, type });
      return JSON.parse(cached.value);
    }

    return null;
  }

  async cacheResult(
    type: string,
    context: Record<string, unknown>,
    result: unknown,
    ttl?: number,
  ): Promise<void> {
    if (!this.db) return;

    const key = this.generateCacheKey(type, context);
    const now = Date.now();
    const expiresAt = ttl ? now + ttl : null;

    await this.db.run(
      `INSERT OR REPLACE INTO cache 
            (key, value, type, hits, created_at, expires_at, last_accessed)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      key,
      JSON.stringify(result),
      type,
      0,
      now,
      expiresAt,
      now,
    );

    log.debug("Result cached", { key, type, ttl });
  }

  async recordTask(task: TaskRecord): Promise<void> {
    if (!this.db) return;

    await this.db.run(
      `INSERT INTO tasks 
            (id, type, status, agent_id, priority, duration, success, error, context, result, created_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      task.id,
      task.type,
      task.status,
      task.assignedAgent,
      task.priority,
      task.duration,
      task.result?.success || false,
      task.result?.error,
      JSON.stringify(task.context || {}),
      JSON.stringify(task.result?.data || {}),
      task.createdAt,
      task.completedAt,
    );
  }

  async createSession(mode: "swarm" | "hive-mind"): Promise<string> {
    if (!this.db) return "";

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.run(
      `INSERT INTO sessions 
            (id, mode, started_at, tasks_completed, tasks_failed, agents, memory)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      sessionId,
      mode,
      Date.now(),
      0,
      0,
      "[]",
      "{}",
    );

    return sessionId;
  }

  async updateSession(sessionId: string, data: Partial<SessionData>): Promise<void> {
    if (!this.db) return;

    const updates = [];
    const values = [];

    if (data.tasksCompleted !== undefined) {
      updates.push("tasks_completed = ?");
      values.push(data.tasksCompleted);
    }
    if (data.tasksFailed !== undefined) {
      updates.push("tasks_failed = ?");
      values.push(data.tasksFailed);
    }
    if (data.agents) {
      updates.push("agents = ?");
      values.push(JSON.stringify(data.agents));
    }
    if (data.memory) {
      updates.push("memory = ?");
      values.push(JSON.stringify(data.memory));
    }
    if (data.summary) {
      updates.push("summary = ?");
      values.push(data.summary);
    }
    if (data.ended) {
      updates.push("ended_at = ?");
      values.push(Date.now());
    }

    if (updates.length > 0) {
      values.push(sessionId);
      await this.db.run(
        `UPDATE sessions SET ${updates.join(", ")} WHERE id = ?`,
        ...values,
      );
    }
  }

  async getLastSession(): Promise<any | null> {
    if (!this.db) return null;

    const session = await this.db.get(
      "SELECT * FROM sessions ORDER BY started_at DESC LIMIT 1",
    );

    if (session) {
      return {
        id: session.id,
        mode: session.mode,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        tasksCompleted: session.tasks_completed,
        tasksFailed: session.tasks_failed,
        agents: JSON.parse(session.agents || "[]"),
        memory: JSON.parse(session.memory || "{}"),
        summary: session.summary,
      };
    }

    return null;
  }

  async recordLearning(
    category: string,
    input: unknown,
    output: unknown,
    confidence: number,
  ): Promise<void> {
    if (!this.db) return;

    const learningId = `learn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.run(
      `INSERT INTO learning 
            (id, category, input, output, confidence, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      learningId,
      category,
      JSON.stringify(input),
      JSON.stringify(output),
      confidence,
      Date.now(),
    );
  }

  async getLearningData(category: string, limit = 10): Promise<any[]> {
    if (!this.db) return [];

    const rows = await this.db.all(
      `SELECT * FROM learning 
            WHERE category = ? 
            ORDER BY confidence DESC, created_at DESC 
            LIMIT ?`,
      category,
      limit,
    );

    return rows.map((row) => ({
      id: row.id,
      input: JSON.parse(row.input),
      output: JSON.parse(row.output),
      confidence: row.confidence,
      feedback: row.feedback,
    }));
  }

  async recordMetric(
    type: string,
    value: number,
    tags?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.db) return;

    const metricId = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.run(
      `INSERT INTO metrics 
            (id, metric_type, value, tags, timestamp)
            VALUES (?, ?, ?, ?, ?)`,
      metricId,
      type,
      value,
      JSON.stringify(tags || {}),
      Date.now(),
    );
  }

  async getMetrics(type: string, since?: number): Promise<any[]> {
    if (!this.db) return [];

    const query = since
      ? "SELECT * FROM metrics WHERE metric_type = ? AND timestamp > ? ORDER BY timestamp DESC"
      : "SELECT * FROM metrics WHERE metric_type = ? ORDER BY timestamp DESC LIMIT 1000";

    const params = since ? [type, since] : [type];
    const rows = await this.db.all(query, ...params);

    return rows.map((row) => ({
      id: row.id,
      type: row.metric_type,
      value: row.value,
      tags: JSON.parse(row.tags || "{}"),
      timestamp: row.timestamp,
    }));
  }

  private generateCacheKey(type: string, context: Record<string, unknown>): string {
    // Generate a stable cache key from type and context
    const contextStr = JSON.stringify(
      context || {},
      Object.keys(context || {}).sort(),
    );
    return `${type}_${this.hashString(contextStr)}`;
  }

  private hashString(str: string): string {
    // Simple hash function for cache keys
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private async runMaintenance(): Promise<void> {
    if (!this.db) return;

    // Clean expired cache entries
    await this.db.run(
      "DELETE FROM cache WHERE expires_at IS NOT NULL AND expires_at < ?",
      Date.now(),
    );

    // Clean old metrics (keep last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await this.db.run("DELETE FROM metrics WHERE timestamp < ?", sevenDaysAgo);

    // Vacuum database to reclaim space
    await this.db.run("VACUUM");

    log.info("Memory maintenance completed");
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      log.info("SQLite memory system closed");
    }
  }
}
