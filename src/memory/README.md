# AutoClaude Persistent Memory System

## Overview

The persistent memory system uses SQLite to store learned patterns, conversion history, and project knowledge across sessions. This enables AutoClaude to improve over time and maintain context between VS Code sessions.

## Database Schema

### Core Tables

#### 1. **conversion_patterns**

Stores successful C# to Rust conversion patterns.

```sql
CREATE TABLE conversion_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_hash TEXT UNIQUE NOT NULL,
    csharp_pattern TEXT NOT NULL,
    rust_pattern TEXT NOT NULL,
    pattern_type TEXT NOT NULL, -- 'type', 'syntax', 'idiom', 'api'
    confidence REAL DEFAULT 0.5,
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pattern_type ON conversion_patterns(pattern_type);
CREATE INDEX idx_confidence ON conversion_patterns(confidence DESC);
```

#### 2. **project_context**

Maintains project-specific information and progress.

```sql
CREATE TABLE project_context (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_path TEXT NOT NULL,
    module_name TEXT NOT NULL,
    conversion_status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    files_total INTEGER DEFAULT 0,
    files_converted INTEGER DEFAULT 0,
    tests_total INTEGER DEFAULT 0,
    tests_passing INTEGER DEFAULT 0,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    metadata JSON,
    UNIQUE(project_path, module_name)
);
```

#### 3. **conversion_history**

Tracks individual file conversions.

```sql
CREATE TABLE conversion_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    source_file TEXT NOT NULL,
    target_file TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    conversion_status TEXT NOT NULL,
    agent_id TEXT,
    duration_ms INTEGER,
    errors JSON,
    warnings JSON,
    patterns_applied JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES project_context(id)
);

CREATE INDEX idx_source_file ON conversion_history(source_file);
CREATE INDEX idx_status ON conversion_history(conversion_status);
```

#### 4. **learned_optimizations**

Stores performance optimizations discovered during conversions.

```sql
CREATE TABLE learned_optimizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    optimization_type TEXT NOT NULL, -- 'memory', 'performance', 'idiom'
    before_pattern TEXT NOT NULL,
    after_pattern TEXT NOT NULL,
    performance_gain REAL,
    applies_to TEXT NOT NULL, -- 'general', 'neo-specific', 'type-specific'
    confidence REAL DEFAULT 0.5,
    usage_count INTEGER DEFAULT 0,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. **agent_memory**

Agent-specific memory and state.

```sql
CREATE TABLE agent_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    memory_key TEXT NOT NULL,
    memory_value JSON NOT NULL,
    importance REAL DEFAULT 0.5,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, memory_key)
);

CREATE INDEX idx_agent_id ON agent_memory(agent_id);
CREATE INDEX idx_importance ON agent_memory(importance DESC);
```

#### 6. **type_mappings**

C# to Rust type equivalencies.

```sql
CREATE TABLE type_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    csharp_type TEXT NOT NULL,
    rust_type TEXT NOT NULL,
    namespace TEXT,
    requires_import TEXT,
    is_generic BOOLEAN DEFAULT 0,
    conversion_complexity INTEGER DEFAULT 1, -- 1-5 scale
    notes TEXT,
    confidence REAL DEFAULT 1.0,
    UNIQUE(csharp_type, namespace)
);

-- Pre-populate with common mappings
INSERT INTO type_mappings (csharp_type, rust_type, conversion_complexity) VALUES
    ('int', 'i32', 1),
    ('uint', 'u32', 1),
    ('long', 'i64', 1),
    ('ulong', 'u64', 1),
    ('byte', 'u8', 1),
    ('bool', 'bool', 1),
    ('string', 'String', 2),
    ('List<T>', 'Vec<T>', 2),
    ('Dictionary<K,V>', 'HashMap<K,V>', 3),
    ('IEnumerable<T>', 'impl Iterator<Item=T>', 3);
```

#### 7. **session_state**

Maintains session continuity.

```sql
CREATE TABLE session_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    workspace_path TEXT NOT NULL,
    active_agents JSON,
    current_task JSON,
    task_queue JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Memory Manager Implementation

```typescript
// src/memory/MemoryManager.ts
import * as sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import * as path from "path";

export class MemoryManager {
  private db: Database | null = null;
  private memoryPath: string;

  constructor(workspacePath: string) {
    this.memoryPath = path.join(workspacePath, ".autoclaude", "memory.db");
  }

  async initialize(): Promise<void> {
    this.db = await open({
      filename: this.memoryPath,
      driver: sqlite3.Database,
    });

    await this.createTables();
    await this.loadBuiltinPatterns();
  }

  // Pattern Learning
  async recordPattern(
    csharpPattern: string,
    rustPattern: string,
    type: string,
    confidence: number = 0.5,
  ): Promise<void> {
    const hash = this.hashPattern(csharpPattern + rustPattern);

    await this.db?.run(
      `
            INSERT INTO conversion_patterns 
            (pattern_hash, csharp_pattern, rust_pattern, pattern_type, confidence)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(pattern_hash) DO UPDATE SET
                usage_count = usage_count + 1,
                last_used = CURRENT_TIMESTAMP
        `,
      [hash, csharpPattern, rustPattern, type, confidence],
    );
  }

  async findSimilarPattern(
    csharpCode: string,
  ): Promise<ConversionPattern | null> {
    // Use fuzzy matching or embedding similarity
    const patterns = await this.db?.all(`
            SELECT * FROM conversion_patterns
            WHERE pattern_type IN ('syntax', 'idiom')
            ORDER BY confidence DESC, usage_count DESC
            LIMIT 10
        `);

    // Find best matching pattern
    return this.findBestMatch(csharpCode, patterns || []);
  }

  // Project Progress
  async updateProjectProgress(
    projectPath: string,
    module: string,
    updates: Partial<ProjectProgress>,
  ): Promise<void> {
    const fields = Object.keys(updates)
      .map((k) => `${k} = ?`)
      .join(", ");
    const values = Object.values(updates);

    await this.db?.run(
      `
            UPDATE project_context 
            SET ${fields}, updated_at = CURRENT_TIMESTAMP
            WHERE project_path = ? AND module_name = ?
        `,
      [...values, projectPath, module],
    );
  }

  // Agent Memory
  async storeAgentMemory(
    agentId: string,
    key: string,
    value: any,
    importance: number = 0.5,
  ): Promise<void> {
    await this.db?.run(
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
      [
        agentId,
        this.getAgentType(agentId),
        key,
        JSON.stringify(value),
        importance,
      ],
    );
  }

  async recallAgentMemory(agentId: string, key: string): Promise<any> {
    const result = await this.db?.get(
      `
            SELECT memory_value FROM agent_memory
            WHERE agent_id = ? AND memory_key = ?
        `,
      [agentId, key],
    );

    return result ? JSON.parse(result.memory_value) : null;
  }

  // Memory Optimization
  async pruneOldMemory(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // Remove low-importance, unused memories
    await this.db?.run(
      `
            DELETE FROM agent_memory
            WHERE importance < 0.3 
            AND last_accessed < ?
            AND access_count < 5
        `,
      [cutoffDate.toISOString()],
    );

    // Archive old conversion history
    await this.db?.run(
      `
            DELETE FROM conversion_history
            WHERE created_at < ?
            AND conversion_status = 'completed'
        `,
      [cutoffDate.toISOString()],
    );
  }

  // Analytics
  async getConversionStats(): Promise<ConversionStats> {
    const stats = await this.db?.get(`
            SELECT 
                COUNT(*) as total_conversions,
                SUM(CASE WHEN conversion_status = 'completed' THEN 1 ELSE 0 END) as successful,
                AVG(duration_ms) as avg_duration,
                COUNT(DISTINCT project_id) as projects_touched
            FROM conversion_history
        `);

    const patterns = await this.db?.get(`
            SELECT 
                COUNT(*) as total_patterns,
                AVG(confidence) as avg_confidence,
                SUM(usage_count) as total_usage
            FROM conversion_patterns
        `);

    return { ...stats, ...patterns };
  }

  // Helper methods
  private hashPattern(pattern: string): string {
    // Simple hash for demo - use crypto.createHash in production
    return pattern
      .split("")
      .reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0)
      .toString(36);
  }

  private getAgentType(agentId: string): string {
    // Extract agent type from ID
    return agentId.split("-")[0] || "unknown";
  }

  private async createTables(): Promise<void> {
    // Execute all CREATE TABLE statements from schema
    // ... (implementation of schema creation)
  }

  private async loadBuiltinPatterns(): Promise<void> {
    // Load common C# to Rust patterns
    // ... (implementation of pattern loading)
  }
}

// Types
interface ConversionPattern {
  id: number;
  csharp_pattern: string;
  rust_pattern: string;
  pattern_type: string;
  confidence: number;
  usage_count: number;
}

interface ProjectProgress {
  conversion_status: string;
  files_converted: number;
  tests_passing: number;
}

interface ConversionStats {
  total_conversions: number;
  successful: number;
  avg_duration: number;
  projects_touched: number;
  total_patterns: number;
  avg_confidence: number;
}
```

## Usage Examples

### 1. Recording a Successful Conversion Pattern

```typescript
const memory = new MemoryManager(workspacePath);
await memory.initialize();

// After successful conversion
await memory.recordPattern(
  "public class $name : IDisposable",
  "pub struct $name { /* fields */ }\n\nimpl Drop for $name",
  "syntax",
  0.85,
);
```

### 2. Finding Similar Patterns

```typescript
const similarPattern = await memory.findSimilarPattern(
  "public sealed class Configuration : IConfiguration",
);

if (similarPattern) {
  console.log(`Found pattern with ${similarPattern.confidence} confidence`);
  // Apply pattern transformation
}
```

### 3. Agent Memory Usage

```typescript
// Converter agent remembers successful strategies
await memory.storeAgentMemory(
  "converter-agent-1",
  "async-pattern-strategy",
  {
    pattern: "Task<T> to Future<T>",
    success_rate: 0.92,
    notes: "Use tokio::spawn for fire-and-forget tasks",
  },
  0.9, // high importance
);

// Later recall
const strategy = await memory.recallAgentMemory(
  "converter-agent-1",
  "async-pattern-strategy",
);
```

### 4. Project Progress Tracking

```typescript
await memory.updateProjectProgress("/home/user/neo-rs", "Neo.VM", {
  files_converted: 15,
  tests_passing: 142,
  conversion_status: "in_progress",
});
```

## Benefits

1. **Continuous Learning**: System improves with each conversion
2. **Context Preservation**: Maintains state across VS Code sessions
3. **Pattern Reuse**: Applies successful patterns to similar code
4. **Progress Tracking**: Never lose track of conversion status
5. **Agent Coordination**: Shared memory enables better collaboration
6. **Performance**: SQLite provides fast, reliable storage

## Configuration

Memory system can be configured in `.autoclaude/memory.json`:

```json
{
  "memory": {
    "enabled": true,
    "database": "memory.db",
    "autoprune": true,
    "pruneDays": 30,
    "maxMemoryMB": 500,
    "syncInterval": 60000,
    "backupEnabled": true,
    "backupInterval": 86400000
  }
}
```
