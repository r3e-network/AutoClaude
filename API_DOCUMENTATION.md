# AutoClaude API Documentation

## Overview

AutoClaude is a VS Code extension that integrates Claude AI to provide intelligent code assistance, automated workflows, and production-ready code generation. This document provides comprehensive API documentation for all public interfaces and services.

## Table of Contents

1. [Core Services](#core-services)
2. [Agent System](#agent-system)
3. [Memory Management](#memory-management)
4. [Automation System](#automation-system)
5. [SubAgent Framework](#subagent-framework)
6. [Hook System](#hook-system)
7. [Configuration](#configuration)
8. [Error Handling](#error-handling)

## Core Services

### Extension API

The main extension exposes the following commands:

#### Commands

| Command | Description | Parameters |
|---------|-------------|------------|
| `autoclaude.start` | Start Claude session | None |
| `autoclaude.stop` | Stop Claude session | None |
| `autoclaude.restart` | Restart Claude session | None |
| `autoclaude.clear` | Clear message queue | None |
| `autoclaude.runScript` | Execute automation script | `scriptId: string` |
| `autoclaude.runSubAgent` | Execute SubAgent | `agentId: string` |
| `autoclaude.exportSession` | Export session data | `path?: string` |
| `autoclaude.importSession` | Import session data | `path: string` |

### Message Queue API

```typescript
interface QueueMessage {
  id: string;
  text: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority?: number;
  metadata?: Record<string, unknown>;
}

class MessageQueue {
  addMessage(text: string, priority?: number): string;
  removeMessage(id: string): boolean;
  clearQueue(): void;
  getQueueStatus(): QueueStatus;
  processBatch(size: number): Promise<void>;
}
```

## Agent System

### Agent Coordinator

Manages and coordinates multiple AI agents for parallel task execution.

```typescript
interface Agent {
  id: string;
  name: string;
  type: AgentType;
  capabilities: string[];
  status: AgentStatus;
  execute(task: Task): Promise<TaskResult>;
}

class AgentCoordinator {
  async initialize(): Promise<void>;
  async submitTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<string>;
  async getTaskStatus(taskId: string): Promise<Task | null>;
  async getAgentStatus(): Promise<AgentStatusReport[]>;
  async stopAllAgents(): Promise<void>;
}
```

### Hive-Mind System

Specialized agents working together in a swarm configuration.

```typescript
interface HiveMindTask {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  description: string;
  context?: Record<string, unknown>;
  result?: HiveMindResult;
}

class QueenAgent {
  async planWork(task: HiveMindTask): Promise<TaskPlan>;
  async coordinateAgents(plan: TaskPlan): Promise<void>;
  async aggregateResults(results: AgentResult[]): Promise<HiveMindResult>;
}
```

#### Specialized Hive-Mind Agents

- **ArchitectAgent**: System design and architecture planning
- **ResearcherAgent**: Code analysis and research
- **CoderAgent**: Code implementation
- **TesterAgent**: Test generation and execution
- **OptimizationAgent**: Performance optimization
- **SecurityAgent**: Security analysis and hardening
- **DocumentationAgent**: Documentation generation

## Memory Management

### Memory Manager

Persistent memory system with pattern learning capabilities.

```typescript
interface MemoryEntry {
  id: string;
  type: 'pattern' | 'task' | 'error' | 'learning';
  content: unknown;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

class MemoryManager {
  async initialize(): Promise<void>;
  async recordPattern(pattern: Pattern): Promise<void>;
  async recallPatterns(type: string, limit?: number): Promise<Pattern[]>;
  async recordTaskCompletion(task: Task, result: TaskResult): Promise<void>;
  async getTaskHistory(agentId: string): Promise<TaskHistory[]>;
  async recordCommand(command: string, result: unknown): Promise<void>;
  async clearOldMemories(daysToKeep: number): Promise<void>;
}
```

### Pattern Recognition

```typescript
interface Pattern {
  id: string;
  type: 'syntax' | 'idiom' | 'api' | 'algorithm';
  source: string;
  target: string;
  confidence: number;
  usageCount: number;
  metadata?: Record<string, unknown>;
}

class PatternMatcher {
  matchPattern(code: string, patterns: Pattern[]): Pattern | null;
  extractPatterns(sourceCode: string, targetCode: string): Pattern[];
  applyPattern(code: string, pattern: Pattern): string;
}
```

## Automation System

### Unified Orchestration System

Central system for automatic task detection and execution.

```typescript
class UnifiedOrchestrationSystem {
  async start(): Promise<void>;
  async stop(): Promise<void>;
  async detectWork(): Promise<WorkItem[]>;
  async executeTask(task: HiveMindTask): Promise<void>;
  async validateProductionReadiness(): Promise<ValidationResult>;
}
```

### Workflow Automation

```typescript
interface Workflow {
  id: string;
  name: string;
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  conditions?: WorkflowCondition[];
}

class WorkflowOrchestrator {
  async registerWorkflow(workflow: Workflow): Promise<void>;
  async executeWorkflow(workflowId: string, context?: Record<string, unknown>): Promise<WorkflowResult>;
  async getWorkflowStatus(executionId: string): Promise<WorkflowStatus>;
}
```

### Intelligent Task Analyzer

```typescript
class IntelligentTaskAnalyzer {
  async analyzeTask(description: string): Promise<TaskAnalysis>;
  async determineOptimalApproach(analysis: TaskAnalysis): Promise<TaskApproach>;
  async estimateComplexity(task: Task): Promise<ComplexityEstimate>;
  async suggestAgents(task: Task): Promise<string[]>;
}
```

## SubAgent Framework

### SubAgent Interface

```typescript
interface SubAgent {
  id: string;
  name: string;
  description: string;
  category: SubAgentCategory;
  capabilities: SubAgentCapability[];
  execute(context: SubAgentContext): Promise<SubAgentResult>;
}

interface SubAgentResult {
  success: boolean;
  message: string;
  data?: unknown;
  confidence?: 'low' | 'medium' | 'high';
  suggestions?: string[];
}
```

### Built-in SubAgents

| SubAgent | Category | Purpose |
|----------|----------|---------|
| ProductionReadinessAgent | quality | Ensures code is production-ready |
| TestAgent | quality | Generates and improves tests |
| SecurityAuditAgent | security | Security vulnerability scanning |
| DependencyResolutionAgent | automation | Manages dependencies |
| CodeUnderstandingAgent | analysis | Code comprehension |
| PerformanceOptimizationAgent | optimization | Performance improvements |
| BuildAgent | automation | Build system management |
| FormatAgent | quality | Code formatting |
| GitHubActionsAgent | automation | CI/CD pipeline setup |

### SubAgent Runner

```typescript
class SubAgentRunner {
  async runAgent(agentId: string, context: SubAgentContext): Promise<SubAgentResult>;
  async runMultipleAgents(agentIds: string[], context: SubAgentContext): Promise<SubAgentResult[]>;
  async getAvailableAgents(): Promise<SubAgentConfig[]>;
}
```

## Hook System

### Hook Manager

Event-driven hook system for extensibility.

```typescript
interface Hook {
  id: string;
  name: string;
  operation: string;
  type: 'pre' | 'post';
  priority: number;
  enabled: boolean;
  blocking: boolean;
  execute(context: HookContext): Promise<HookResult>;
}

class HookManager {
  async initialize(): Promise<void>;
  async registerHook(hook: Hook, operation?: string): Promise<void>;
  async executeHooks(operation: string, context: Partial<HookContext>): Promise<HookExecutionResult>;
  enableHook(hookId: string): void;
  disableHook(hookId: string): void;
}
```

### Built-in Hooks

- **SyntaxValidationHook**: Validates syntax before operations
- **AutoFormatHook**: Automatic code formatting
- **PatternLearningHook**: Learns from code patterns
- **UniversalValidationHook**: Universal code validation
- **NeoRsValidationHook**: Neo-rs specific validation

## Configuration

### Configuration Schema

```typescript
interface AutoClaudeConfig {
  // Core settings
  enabled: boolean;
  apiKey?: string;
  maxConcurrentTasks: number;
  
  // Agent settings
  agents: {
    enabled: boolean;
    maxAgents: number;
    autoScale: boolean;
  };
  
  // Memory settings
  memory: {
    enabled: boolean;
    persistPath: string;
    maxMemorySize: number;
  };
  
  // Hook settings
  hooks: {
    enabled: boolean;
    validateSyntax: boolean;
    autoFormat: boolean;
    learnPatterns: boolean;
  };
  
  // SubAgent settings
  subAgents: {
    enabled: boolean;
    categories: string[];
    customPath?: string;
  };
}
```

### Configuration Manager

```typescript
class ConfigManager {
  getConfig(): AutoClaudeConfig;
  updateConfig(updates: Partial<AutoClaudeConfig>): void;
  validateConfig(config: Partial<AutoClaudeConfig>): ConfigValidationError[];
  loadFromFile(path: string): Promise<void>;
  saveToFile(path: string): Promise<void>;
}
```

## Error Handling

### Error Types

```typescript
enum ErrorCategory {
  CONFIGURATION = 'configuration',
  DEPENDENCY = 'dependency',
  RUNTIME = 'runtime',
  VALIDATION = 'validation',
  NETWORK = 'network',
  INTERNAL = 'internal'
}

enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

class AutoClaudeError extends Error {
  constructor(
    code: string,
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context?: Record<string, unknown>,
    recoverable?: boolean,
    userMessage?: string,
    suggestions?: string[]
  );
}
```

### Error Recovery

```typescript
class ErrorRecoverySystem {
  async analyzeError(error: string): Promise<RecoveryStrategy | null>;
  async executeRecovery(strategy: RecoveryStrategy): Promise<boolean>;
  clearHistory(): void;
  getStatistics(): Map<ErrorType, number>;
}
```

## Event System

### Event Emitter

```typescript
interface AutoClaudeEvents {
  'task:started': (task: Task) => void;
  'task:completed': (task: Task, result: TaskResult) => void;
  'task:failed': (task: Task, error: Error) => void;
  'agent:ready': (agentId: string) => void;
  'agent:busy': (agentId: string) => void;
  'agent:error': (agentId: string, error: Error) => void;
  'memory:pattern-learned': (pattern: Pattern) => void;
  'hook:executed': (hookId: string, result: HookResult) => void;
}
```

## REST API Endpoints (Future)

*Note: REST API is planned for future releases*

```typescript
// Planned endpoints
POST   /api/tasks                 // Submit new task
GET    /api/tasks/:id             // Get task status
DELETE /api/tasks/:id             // Cancel task
GET    /api/agents                // List available agents
POST   /api/agents/:id/execute   // Execute agent directly
GET    /api/memory/patterns      // Get learned patterns
POST   /api/memory/clear         // Clear memory
GET    /api/config               // Get configuration
PATCH  /api/config               // Update configuration
```

## WebSocket API (Future)

*Note: WebSocket API is planned for future releases*

```typescript
// Planned WebSocket events
ws.on('task:submit', (task) => { /* ... */ });
ws.on('task:status', (taskId) => { /* ... */ });
ws.on('agent:command', (agentId, command) => { /* ... */ });
ws.emit('task:update', { taskId, status, progress });
ws.emit('agent:output', { agentId, output });
```

## Usage Examples

### Basic Task Submission

```typescript
import { AgentCoordinator } from 'autoclaude';

const coordinator = new AgentCoordinator(workspacePath);
await coordinator.initialize();

const taskId = await coordinator.submitTask({
  type: 'code-generation',
  priority: 'high',
  description: 'Generate REST API endpoints for user management',
  context: {
    framework: 'express',
    database: 'postgresql'
  }
});

const status = await coordinator.getTaskStatus(taskId);
console.log('Task status:', status);
```

### Using SubAgents

```typescript
import { SubAgentRunner } from 'autoclaude';

const runner = new SubAgentRunner(workspacePath);
const result = await runner.runAgent('production-readiness', {
  workspacePath,
  iterationCount: 1,
  maxIterations: 3
});

if (!result.success) {
  console.error('Production readiness check failed:', result.message);
}
```

### Hook Registration

```typescript
import { HookManager, Hook } from 'autoclaude';

const customHook: Hook = {
  id: 'custom-validation',
  name: 'Custom Validation',
  operation: 'pre-commit',
  type: 'pre',
  priority: 100,
  enabled: true,
  blocking: true,
  async execute(context) {
    // Custom validation logic
    return {
      success: true,
      suggestions: ['Consider adding unit tests']
    };
  }
};

const hookManager = new HookManager(workspacePath);
await hookManager.initialize();
await hookManager.registerHook(customHook);
```

### Memory Pattern Learning

```typescript
import { MemoryManager } from 'autoclaude';

const memory = new MemoryManager(workspacePath);
await memory.initialize();

// Record a new pattern
await memory.recordPattern({
  type: 'api',
  source: 'app.get("/users", handler)',
  target: 'router.get("/users", controller.getUsers)',
  confidence: 0.95,
  usageCount: 1
});

// Recall similar patterns
const patterns = await memory.recallPatterns('api', 10);
```

## Performance Considerations

- **Concurrency**: Default max concurrent tasks is 5, adjustable via configuration
- **Memory Limits**: Default memory limit is 100MB for pattern storage
- **Timeout**: Default operation timeout is 30 seconds
- **Rate Limiting**: Built-in rate limiting for external API calls
- **Caching**: Intelligent caching of patterns and frequent operations

## Security

- **Input Validation**: All inputs are sanitized and validated
- **CSRF Protection**: Built-in CSRF token validation for webview communication
- **Secure Storage**: Sensitive data encrypted in memory storage
- **Rate Limiting**: Protection against abuse via rate limiting
- **Audit Logging**: All operations are logged for audit purposes

## Versioning

This API follows semantic versioning (SemVer). Current version: 3.10.1

- **Major version**: Breaking API changes
- **Minor version**: New features, backward compatible
- **Patch version**: Bug fixes, backward compatible

## Support

For issues, feature requests, or questions:
- GitHub Issues: https://github.com/autoclaude/autoclaude/issues
- Documentation: https://docs.autoclaude.ai
- Discord: https://discord.gg/autoclaude

## License

MIT License - See LICENSE file for details