import * as vscode from "vscode";
import { log } from "../../utils/productionLogger";
import { AgentCoordinator } from "../AgentCoordinator";
import {
  HiveMindAgent,
  AgentRole,
  TaskPriority,
  HiveMindTask,
  HiveMindResult,
} from "./types";
import ArchitectAgent from "./ArchitectAgent";
import CoderAgent from "./CoderAgent";
import TesterAgent from "./TesterAgent";
import ResearcherAgent from "./ResearcherAgent";
import SecurityAgent from "./SecurityAgent";
import DocumentationAgent from "./DocumentationAgent";
import OptimizationAgent from "./OptimizationAgent";
import {
  QueuedTask,
  DecomposedTask,
  TaskGroup,
  OrchestrationResult,
  TaskResult,
  MemorySystem,
  TaskQueueInterface,
} from "../../types/queen";

/**
 * Queen Agent - Master coordinator for the Hive-Mind system
 * Manages all other agents and orchestrates complex workflows
 */
export class QueenAgent implements HiveMindAgent {
  id = "queen-agent";
  name = "Queen Agent";
  role = AgentRole.QUEEN;
  capabilities = [
    "orchestration",
    "task-decomposition",
    "agent-assignment",
    "priority-management",
  ];

  private agentCoordinator: AgentCoordinator;
  private activeAgents: Map<string, HiveMindAgent> = new Map();
  private taskQueue: TaskQueue;
  private memorySystem: MemorySystem | null = null; // Will be enhanced with SQLite

  constructor(private workspaceRoot: string) {
    this.agentCoordinator = new AgentCoordinator(this.workspaceRoot);
    this.taskQueue = new TaskQueue();
  }

  async initialize(): Promise<void> {
    log.info("Queen Agent initializing...", {
      workspaceRoot: this.workspaceRoot,
    });

    // Initialize agent swarm
    await this.initializeSwarm();

    // Load memory and patterns
    await this.loadMemorySystem();

    // Start coordination
    await this.startCoordination();

    log.info("Queen Agent initialized successfully");
  }

  async execute(task: HiveMindTask): Promise<HiveMindResult> {
    log.info("Queen Agent executing task", {
      taskId: task.id,
      type: task.type,
    });

    try {
      // Analyze task complexity
      const complexity = await this.analyzeTaskComplexity(task);

      // Decompose into subtasks if needed
      if (complexity.isComplex) {
        const subtasks = await this.decomposeTask(task);
        return await this.orchestrateSubtasks(subtasks);
      }

      // Assign to appropriate agent
      const agent = await this.selectBestAgent(task);
      return await this.delegateToAgent(agent, task);
    } catch (error) {
      log.error("Queen Agent execution failed", error as Error, {
        taskId: task.id,
      });
      throw error;
    }
  }

  private async initializeSwarm(): Promise<void> {
    // Initialize specialized agents
    const agents: HiveMindAgent[] = [
      new ArchitectAgent(this.workspaceRoot),
      new CoderAgent(this.workspaceRoot),
      new TesterAgent(this.workspaceRoot),
      new ResearcherAgent(this.workspaceRoot),
      new SecurityAgent(this.workspaceRoot),
      new DocumentationAgent(this.workspaceRoot),
      new OptimizationAgent(this.workspaceRoot),
    ];

    // Initialize statically imported agents
    for (const agent of agents) {
      try {
        await agent.initialize();
        this.activeAgents.set(agent.id, agent);
        log.info("Initialized agent", { agentId: agent.id, name: agent.name });
      } catch (error) {
        log.error("Failed to initialize agent", error as Error, {
          agentId: agent.id,
        });
      }
    }

    log.info("All specialized agents initialized", {
      agentCount: this.activeAgents.size,
      agents: Array.from(this.activeAgents.keys()),
    });
  }

  private async loadMemorySystem(): Promise<void> {
    // Enhanced memory system with pattern recognition
    try {
      const { getMemoryManager } = await import("../../memory");
      this.memorySystem = getMemoryManager(this.workspaceRoot);
      await this.memorySystem.initialize();
      
      // Check if it's a stub (when sqlite3 is not available)
      if (this.memorySystem && typeof this.memorySystem.getLearnedPatterns === 'function') {
        try {
          // Load learned patterns
          const patterns = await this.memorySystem.getLearnedPatterns();
          log.info("Loaded memory patterns", { patternCount: patterns.length });
        } catch (err) {
          log.warn("Memory patterns not available", err as Error);
        }
      } else {
        log.info("Memory system running in stub mode (sqlite3 not available)");
      }
    } catch (error) {
      log.warn("Memory system not available, using stub", error as Error);
      // Create a stub memory system
      this.memorySystem = {
        initialize: async () => {},
        getLearnedPatterns: async () => [],
        savePattern: async () => {},
        recallPattern: async () => null,
        close: async () => {},
      } as any;
    }
  }

  private async startCoordination(): Promise<void> {
    // Start the coordination loop
    setInterval(async () => {
      try {
        await this.checkAgentHealth();
        await this.optimizeTaskDistribution();
        await this.updateMemoryPatterns();
      } catch (error) {
        // Silently skip errors to prevent log spam
        // These are non-critical background tasks
        log.debug("Coordination cycle skipped", error as Error);
      }
    }, 5000); // Check every 5 seconds
  }

  private async analyzeTaskComplexity(
    task: HiveMindTask,
  ): Promise<{ isComplex: boolean; score: number }> {
    // Analyze task to determine complexity
    const factors = {
      fileCount: task.files?.length || 0,
      lineCount: task.estimatedLines || 0,
      dependencies: task.dependencies?.length || 0,
      requiresMultipleAgents: task.requiresMultipleAgents || false,
      estimatedTime: task.estimatedTime || 0,
    };

    const score =
      (factors.fileCount > 5 ? 2 : 0) +
      (factors.lineCount > 500 ? 2 : 0) +
      (factors.dependencies > 3 ? 1 : 0) +
      (factors.requiresMultipleAgents ? 3 : 0) +
      (factors.estimatedTime > 300 ? 2 : 0);

    return {
      isComplex: score >= 5,
      score,
    };
  }

  private async decomposeTask(task: HiveMindTask): Promise<DecomposedTask[]> {
    // Intelligent task decomposition
    const subtasks: DecomposedTask[] = [];

    // Example decomposition logic
    if (task.type === "feature-implementation") {
      subtasks.push(
        { id: `${task.id}-arch`, name: "Architecture Design", description: "Design system architecture", type: "architecture-design", priority: TaskPriority.HIGH },
        { id: `${task.id}-code`, name: "Code Implementation", description: "Implement the feature", type: "code-implementation", priority: TaskPriority.MEDIUM },
        { id: `${task.id}-test`, name: "Test Creation", description: "Create tests", type: "test-creation", priority: TaskPriority.MEDIUM },
        { id: `${task.id}-docs`, name: "Documentation", description: "Document the feature", type: "documentation", priority: TaskPriority.LOW },
      );
    } else {
      // Default: convert task to decomposed task
      subtasks.push({
        id: task.id,
        name: task.name || task.type,
        description: task.description || "",
        type: task.type,
        priority: task.priority || TaskPriority.MEDIUM,
      });
    }

    return subtasks;
  }

  private async orchestrateSubtasks(subtasks: DecomposedTask[]): Promise<OrchestrationResult> {
    // Orchestrate parallel and sequential execution
    const results: TaskResult[] = [];

    // Group by dependencies
    const parallelGroups = this.groupByDependencies(subtasks);

    for (const group of parallelGroups) {
      const groupResults = await Promise.all(
        group.map((task) => this.executeSubtask(task)),
      );
      results.push(...groupResults);
    }

    return {
      success: true,
      results,
      summary: this.generateSummary(results),
    };
  }

  private async selectBestAgent(task: DecomposedTask): Promise<HiveMindAgent> {
    // Select the most appropriate agent for the task
    let bestAgent: HiveMindAgent | null = null;
    let bestScore = -1;

    for (const [_, agent] of this.activeAgents) {
      const score = this.calculateAgentScore(agent, task);
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    if (!bestAgent) {
      throw new Error("No suitable agent found for task");
    }

    return bestAgent;
  }

  private calculateAgentScore(agent: HiveMindAgent, task: DecomposedTask): number {
    // Calculate how well an agent matches a task
    let score = 0;

    // Check capability match
    for (const required of task.requiredCapabilities || []) {
      if (agent.capabilities.includes(required)) {
        score += 10;
      }
    }

    // Check role match
    if (this.getRoleForTaskType(task.type) === agent.role) {
      score += 20;
    }

    // Check agent availability
    const load = this.agentCoordinator.getAgentLoad(agent.id);
    score -= load * 5;

    return score;
  }

  private getRoleForTaskType(taskType: string): AgentRole {
    const roleMap: Record<string, AgentRole> = {
      "architecture-design": AgentRole.ARCHITECT,
      "code-implementation": AgentRole.CODER,
      "test-creation": AgentRole.TESTER,
      research: AgentRole.RESEARCHER,
      "security-audit": AgentRole.SECURITY,
      documentation: AgentRole.DOCUMENTATION,
    };

    return roleMap[taskType] || AgentRole.CODER;
  }

  private async executeSubtask(task: DecomposedTask): Promise<TaskResult> {
    const agent = await this.selectBestAgent(task);
    return await this.delegateToAgent(agent, task);
  }

  private async delegateToAgent(agent: HiveMindAgent, task: DecomposedTask): Promise<TaskResult> {
    log.info("Delegating task to agent", {
      agentId: agent.id,
      taskId: task.id,
    });

    // Track delegation
    const hiveMindTask: HiveMindTask = {
      id: task.id,
      type: task.type,
      priority: task.priority || TaskPriority.MEDIUM,
      name: task.name,
      description: task.description,
    };
    
    this.agentCoordinator.assignTask(agent.id, hiveMindTask);

    try {
      const result = await agent.execute(hiveMindTask);
      this.agentCoordinator.completeTask(agent.id, task.id);
      
      return {
        taskId: task.id,
        agentId: agent.id,
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      this.agentCoordinator.failTask(agent.id, task.id);
      
      return {
        taskId: task.id,
        agentId: agent.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private groupByDependencies(tasks: DecomposedTask[]): DecomposedTask[][] {
    // Group tasks that can be executed in parallel
    // This is a simplified implementation
    const groups: DecomposedTask[][] = [];
    const processed = new Set<string>();

    for (const task of tasks) {
      if (!processed.has(task.id)) {
        const group = [task];
        processed.add(task.id);

        // Find tasks without dependencies on this task
        for (const other of tasks) {
          if (!processed.has(other.id) && !this.hasDependency(other, task)) {
            group.push(other);
            processed.add(other.id);
          }
        }

        groups.push(group);
      }
    }

    return groups;
  }

  private hasDependency(task1: DecomposedTask, task2: DecomposedTask): boolean {
    // Check if task1 depends on task2
    return task1.dependencies?.includes(task2.id) || false;
  }

  private mergeResults(results: TaskResult[]): HiveMindResult {
    // Merge results from multiple agents
    return {
      success: results.every((r) => r.success),
      results: results,
      summary: this.generateSummary(results),
    };
  }

  private generateSummary(results: TaskResult[]): string {
    const successful = results.filter((r) => r.success).length;
    return `Completed ${successful}/${results.length} tasks successfully`;
  }

  private async checkAgentHealth(): Promise<void> {
    // Monitor agent health and restart if needed
    // Skip health checks if getAgentHealth is not available
    if (!this.agentCoordinator || typeof this.agentCoordinator.getAgentHealth !== 'function') {
      // Method not available - skip health checks silently
      return;
    }
    
    for (const [id, agent] of this.activeAgents) {
      try {
        const health = await this.agentCoordinator.getAgentHealth(id);
        if (health.status === "unhealthy") {
          log.warn("Agent unhealthy, restarting", { agentId: id });
          await this.restartAgent(agent);
        }
      } catch (error) {
        // Only log if it's not a "function not found" error
        if (!error?.message?.includes('is not a function')) {
          log.warn("Health check failed", error as Error, { agentId: id });
        }
      }
    }
  }

  private async restartAgent(agent: HiveMindAgent): Promise<void> {
    try {
      await agent.shutdown?.();
      await agent.initialize();
      log.info("Agent restarted successfully", { agentId: agent.id });
    } catch (error) {
      log.error("Failed to restart agent", error as Error, {
        agentId: agent.id,
      });
      this.activeAgents.delete(agent.id);
    }
  }

  private async optimizeTaskDistribution(): Promise<void> {
    // Rebalance tasks across agents for optimal performance
    // Skip if getAgentLoads is not available
    if (!this.agentCoordinator || typeof this.agentCoordinator.getAgentLoads !== 'function') {
      return;
    }
    
    try {
      const loads = this.agentCoordinator.getAgentLoads();
      const average = loads.reduce((a, b) => a + b.load, 0) / loads.length;

      for (const agentLoad of loads) {
        if (agentLoad.load > average * 1.5) {
          // Redistribute some tasks
          await this.redistributeTasks(agentLoad.agentId);
        }
      }
    } catch (error) {
      // Silently skip if method not available
      if (!error?.message?.includes('is not a function')) {
        log.debug("Task distribution optimization skipped", error as Error);
      }
    }
  }

  private async redistributeTasks(overloadedAgentId: string): Promise<void> {
    // Move tasks from overloaded agent to others
    const tasks = this.agentCoordinator.getAgentTasks(overloadedAgentId);
    const redistributable = tasks.filter((t) => t.canRedistribute);

    for (const task of redistributable.slice(0, 2)) {
      // Move at most 2 tasks
      const newAgent = await this.selectBestAgent(task);
      if (newAgent.id !== overloadedAgentId) {
        await this.agentCoordinator.reassignTask(
          task.id,
          overloadedAgentId,
          newAgent.id,
        );
        log.info("Redistributed task", {
          taskId: task.id,
          from: overloadedAgentId,
          to: newAgent.id,
        });
      }
    }
  }

  private async updateMemoryPatterns(): Promise<void> {
    // Update memory with learned patterns
    if (this.memorySystem && this.taskQueue && typeof this.taskQueue.getRecentCompleted === 'function') {
      try {
        const recentTasks = this.taskQueue.getRecentCompleted();
        for (const task of recentTasks) {
          await this.memorySystem.recordPattern?.({
            type: task.type,
            success: task.result?.success,
            duration: task.duration,
            agent: task.assignedAgent,
            complexity: task.complexity,
          });
        }
      } catch (error) {
        // Silently skip if method not available
        log.debug("Memory pattern update skipped", error as Error);
      }
    }
  }

  async shutdown(): Promise<void> {
    log.info("Queen Agent shutting down");

    // Shutdown all agents
    for (const [_, agent] of this.activeAgents) {
      await agent.shutdown?.();
    }

    this.activeAgents.clear();
  }
}

class TaskQueue {
  private tasks: QueuedTask[] = [];
  private completed: QueuedTask[] = [];

  add(task: QueuedTask): void {
    this.tasks.push(task);
  }

  getNext(): QueuedTask | null {
    return this.tasks.shift() || null;
  }

  complete(task: QueuedTask): void {
    this.completed.push({
      ...task,
      completedAt: Date.now(),
    });
  }

  getRecentCompleted(limit = 10): QueuedTask[] {
    return this.completed.slice(-limit);
  }
}
