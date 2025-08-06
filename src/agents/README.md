# AutoClaude Specialized Agent System

## Overview

The specialized agent system divides complex tasks among focused agents, each with specific expertise and responsibilities.

## Agent Architecture

```typescript
interface Agent {
  id: string;
  name: string;
  type: AgentType;
  capabilities: string[];
  priority: number;
  status: AgentStatus;
  memory: AgentMemory;
  execute(task: Task): Promise<TaskResult>;
}

enum AgentType {
  COORDINATOR = "coordinator",
  ANALYZER = "analyzer",
  CONVERTER = "converter",
  VALIDATOR = "validator",
  TESTER = "tester",
  DOCUMENTER = "documenter",
  OPTIMIZER = "optimizer",
}
```

## Core Agents for Neo-rs

### 1. **Coordinator Agent** 👑

**Role**: Master orchestrator that assigns tasks to specialized agents

**Capabilities**:

- Task decomposition and planning
- Agent assignment based on expertise
- Progress monitoring and reporting
- Conflict resolution between agents
- Resource optimization

**Example Tasks**:

- "Convert entire Neo.VM module from C# to Rust"
- "Validate all converted tests pass"
- "Optimize performance of converted code"

### 2. **C# Analyzer Agent** 🔍

**Role**: Understands and analyzes C# code structure

**Capabilities**:

- Parse C# syntax and semantics
- Identify design patterns
- Extract type information
- Analyze dependencies
- Map C# idioms to Rust equivalents

**Specialized Knowledge**:

- Neo-specific C# patterns
- LINQ to iterator conversions
- Event/delegate patterns
- Property getter/setter patterns

### 3. **Rust Converter Agent** 🦀

**Role**: Transforms C# code to idiomatic Rust

**Capabilities**:

- Generate Rust syntax from C# AST
- Apply Rust best practices
- Handle ownership and borrowing
- Convert types appropriately
- Implement traits from interfaces

**Conversion Patterns**:

```
C# List<T> → Rust Vec<T>
C# Dictionary<K,V> → Rust HashMap<K,V>
C# IEnumerable<T> → Rust Iterator<Item=T>
C# async/await → Rust async/await
C# lock → Rust Mutex/RwLock
```

### 4. **Validation Agent** ✅

**Role**: Ensures conversion accuracy and correctness

**Capabilities**:

- Compare API signatures
- Validate type safety
- Check memory safety
- Verify functional equivalence
- Ensure Neo protocol compliance

**Validation Levels**:

1. Syntax validation (does it compile?)
2. Type validation (are types equivalent?)
3. Behavior validation (same output for inputs?)
4. Performance validation (comparable speed?)

### 5. **Test Migration Agent** 🧪

**Role**: Converts C# tests to Rust tests

**Capabilities**:

- Convert NUnit/xUnit to Rust tests
- Adapt test patterns
- Generate property-based tests
- Create integration tests
- Ensure test coverage parity

**Test Patterns**:

```csharp
[Test] → #[test]
[TestCase] → #[test] with parameters
Assert.AreEqual → assert_eq!
Assert.Throws → #[should_panic]
```

### 6. **Documentation Agent** 📚

**Role**: Maintains and updates documentation

**Capabilities**:

- Convert XML docs to Rust docs
- Generate missing documentation
- Create migration guides
- Update README files
- Generate API documentation

### 7. **Performance Agent** 🚀

**Role**: Optimizes converted code for performance

**Capabilities**:

- Identify optimization opportunities
- Apply Rust-specific optimizations
- Profile code performance
- Suggest algorithmic improvements
- Implement zero-cost abstractions

## Agent Coordination Strategies

### 1. **Sequential Pipeline**

Best for: Simple, linear conversions

```
Analyze → Convert → Validate → Document
```

### 2. **Parallel Execution**

Best for: Large modules with independent components

```
        ↗ Converter₁ → Validator₁ ↘
Analyzer                           → Merger
        ↘ Converter₂ → Validator₂ ↗
```

### 3. **Iterative Refinement**

Best for: Complex conversions requiring multiple passes

```
Analyze → Convert → Validate
   ↑                    ↓
   ← Optimize ← Failed ←
```

## Memory System

Each agent maintains specialized memory:

```typescript
interface AgentMemory {
  patterns: ConversionPattern[];
  knownIssues: Issue[];
  successfulConversions: Conversion[];
  optimizations: Optimization[];
  projectContext: ProjectContext;
}
```

## Task Assignment Algorithm

```typescript
function assignTask(task: Task): Agent {
  // 1. Analyze task requirements
  const requirements = analyzeTask(task);

  // 2. Find capable agents
  const capableAgents = agents.filter((agent) =>
    agent.capabilities.some((cap) => requirements.includes(cap)),
  );

  // 3. Select best agent based on:
  // - Current workload
  // - Past success rate
  // - Specialization match
  return selectOptimalAgent(capableAgents, task);
}
```

## Communication Protocol

Agents communicate through a structured message system:

```typescript
interface AgentMessage {
  from: string;
  to: string;
  type: MessageType;
  content: any;
  timestamp: Date;
  priority: number;
}

enum MessageType {
  TASK_REQUEST = "task_request",
  TASK_RESULT = "task_result",
  HELP_REQUEST = "help_request",
  STATUS_UPDATE = "status_update",
  ERROR_REPORT = "error_report",
}
```

## Benefits for Neo-rs Development

1. **Specialization**: Each agent focuses on what it does best
2. **Parallelization**: Multiple files converted simultaneously
3. **Quality**: Specialized validation ensures accuracy
4. **Learning**: Agents improve over time
5. **Scalability**: Easy to add new agent types
6. **Maintainability**: Clear separation of concerns

## Configuration

Agents can be configured in `.autoclaude/agents.json`:

```json
{
  "agents": {
    "analyzer": {
      "enabled": true,
      "maxConcurrent": 2,
      "memoryLimit": "512MB"
    },
    "converter": {
      "enabled": true,
      "maxConcurrent": 4,
      "strictMode": true,
      "optimizationLevel": 2
    },
    "validator": {
      "enabled": true,
      "validationLevel": "strict",
      "compareWithOriginal": true
    }
  },
  "coordination": {
    "strategy": "parallel",
    "maxTotalAgents": 10,
    "taskTimeout": 300000
  }
}
```
