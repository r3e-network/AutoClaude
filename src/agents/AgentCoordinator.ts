import * as vscode from "vscode";
import * as path from "path";
import { debugLog } from "../utils/logging";
import { getMemoryManager, MemoryManager } from "../memory";
import {
  getEnhancedConfig,
  EnhancedConfigManager,
} from "../config/enhanced-config";
import { AutoClaudeError, ErrorCategory, ErrorSeverity } from "../core/errors";
import {
  AgentMetadata,
  TaskInput,
  TaskMetadata,
  TaskOutput,
  TaskResultMetadata,
  ConversionPattern,
  LearningResult,
  AgentMemoryManager,
  AgentEnhancedConfig,
  AgentEnhancedConfigManager,
} from "../types/agent-coordinator";
import { 
  conflictManager, 
  communicationChannel,
  ConflictPreventionManager,
  AgentCommunicationChannel 
} from "./ConflictPrevention";

// Core interfaces
export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  capabilities: string[];
  status: AgentStatus;
  priority: number;
  currentTask?: Task;
  lastActivity?: Date;
  metadata?: AgentMetadata;
  initialize(): Promise<void>;
  execute(task: Task): Promise<TaskResult>;
  canHandle(task: Task): boolean;
  stop(): Promise<void>;
}

export type AgentType =
  | "converter" // C# to Rust conversion (legacy)
  | "validator" // Code validation and testing (legacy)
  | "universal-converter" // Multi-language conversion
  | "universal-validator" // Multi-language validation
  | "optimizer" // Performance optimization
  | "documenter" // Documentation generation
  | "monitor" // System monitoring
  | "coordinator" // Task coordination
  | "specializer"; // Neo-rs specific tasks

export type AgentStatus =
  | "idle"
  | "busy"
  | "error"
  | "stopped"
  | "initializing";

export interface Task {
  id: string;
  type: TaskType;
  priority: number;
  description: string;
  input: TaskInput;
  requirements?: string[];
  dependencies?: string[];
  timeout?: number;
  retryCount?: number;
  maxRetries?: number;
  assignedAgent?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: TaskMetadata;
}

export type TaskType =
  | "convert-file"
  | "convert-snippet"
  | "validate-conversion"
  | "validate-syntax"
  | "validate-compatibility"
  | "analyze-code"
  | "detect-errors"
  | "suggest-conversion"
  | "security-scan"
  | "learn-pattern"
  | "optimize-code"
  | "generate-tests"
  | "create-docs"
  | "monitor-system"
  | "coordinate-agents"
  | "neo-rs-specific";

export interface TaskResult {
  success: boolean;
  output?: TaskOutput;
  error?: string;
  warnings?: string[];
  metadata?: TaskResultMetadata;
  executionTime?: number;
  agentId: string;
  taskId: string;
}

export interface CoordinationStrategy {
  name: "sequential" | "parallel" | "adaptive";
  maxConcurrentAgents: number;
  taskDistributionRules: TaskDistributionRule[];
  failureHandling: FailureHandlingStrategy;
}

export interface TaskDistributionRule {
  taskType: TaskType;
  preferredAgentTypes: AgentType[];
  loadBalancing: "round-robin" | "least-busy" | "capability-based";
  fallbackAgents?: AgentType[];
}

export interface FailureHandlingStrategy {
  maxRetries: number;
  retryDelay: number;
  escalationRules: EscalationRule[];
  failureRecovery: "retry" | "reassign" | "abort";
}

export interface EscalationRule {
  condition: "timeout" | "repeated-failure" | "agent-unavailable";
  action: "reassign" | "increase-timeout" | "alert-user";
  threshold: number;
}

// Concrete agent implementations
class ConverterAgent implements Agent {
  id: string = `converter-${Date.now()}`;
  type: AgentType = "converter";
  name = "C# to Rust Converter";
  description = "Converts C# code to Rust with Neo-specific optimizations";
  capabilities = [
    "c#-parsing",
    "rust-generation",
    "neo-types",
    "syntax-mapping",
  ];
  status: AgentStatus = "idle";
  priority = 5;
  currentTask?: Task;
  lastActivity?: Date;
  metadata: AgentMetadata = {};

  constructor(
    private memory: AgentMemoryManager,
    private workspacePath: string,
  ) {}

  async initialize(): Promise<void> {
    this.status = "initializing";
    try {
      // Load conversion patterns from memory
      await this.loadConversionPatterns();
      this.status = "idle";
      debugLog(`Converter agent ${this.id} initialized`);
    } catch (error) {
      this.status = "error";
      throw new AutoClaudeError(
        "AGENT_INIT_FAILED",
        `Failed to initialize converter agent: ${error}`,
        ErrorCategory.INTERNAL,
        ErrorSeverity.HIGH,
        { agentId: this.id, error },
        true,
        "Agent initialization failed",
        ["Check memory system", "Restart VS Code", "Reset agent state"],
      );
    }
  }

  async execute(task: Task): Promise<TaskResult> {
    if (!this.canHandle(task)) {
      throw new AutoClaudeError(
        "INVALID_TASK",
        `Converter agent cannot handle task type: ${task.type}`,
        ErrorCategory.USAGE,
        ErrorSeverity.MEDIUM,
        { agentId: this.id, taskType: task.type },
      );
    }

    this.status = "busy";
    this.currentTask = task;
    this.lastActivity = new Date();
    const startTime = Date.now();

    try {
      let result: TaskOutput;

      switch (task.type) {
        case "convert-file":
          result = await this.convertFile(task.input as { filePath: string; content: string; });
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      // Learn from successful conversion
      await this.learnFromConversion(task, result);

      this.status = "idle";
      this.currentTask = undefined;

      return {
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
        agentId: this.id,
        taskId: task.id,
      };
    } catch (error) {
      this.status = "error";
      this.currentTask = undefined;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        agentId: this.id,
        taskId: task.id,
      };
    }
  }

  canHandle(task: Task): boolean {
    return task.type === "convert-file" || task.type === "neo-rs-specific";
  }

  async stop(): Promise<void> {
    this.status = "stopped";
    this.currentTask = undefined;
    debugLog(`Converter agent ${this.id} stopped`);
  }

  private async loadConversionPatterns(): Promise<void> {
    try {
      // Load existing patterns from memory
      const patterns = await this.memory.findSimilarPatterns(
        "",
        undefined,
        100,
      );
      this.metadata.loadedPatterns = patterns.length;
      debugLog(`Loaded ${patterns.length} conversion patterns`);
    } catch (error) {
      debugLog(`Failed to load conversion patterns: ${error}`);
    }
  }

  private async convertFile(input: {
    filePath: string;
    content: string;
  }): Promise<TaskOutput> {
    // Simplified conversion logic - in production, this would be much more sophisticated
    const { filePath, content } = input;

    // Find similar patterns
    const patterns = await this.memory.findSimilarPatterns(
      content,
      "syntax",
      10,
    );

    // Apply known patterns
    let convertedContent = content;
    for (const pattern of patterns) {
      convertedContent = convertedContent.replace(
        new RegExp(pattern.csharp_pattern, "g"),
        pattern.rust_pattern,
      );
    }

    // Basic C# to Rust transformations
    convertedContent = this.applyBasicTransformations(convertedContent);

    return {
      originalPath: filePath,
      convertedPath: filePath.replace(".cs", ".rs"),
      originalContent: content,
      convertedContent,
      patternsApplied: patterns.map((p) => p.id || (p as any).pattern_hash || 'unknown'),
      confidence: this.calculateConversionConfidence(patterns),
    };
  }

  private applyBasicTransformations(content: string): string {
    return (
      content
        // Basic type mappings
        .replace(/\bint\b/g, "i32")
        .replace(/\bstring\b/g, "String")
        .replace(/\bbool\b/g, "bool")
        .replace(/\bList<(.+?)>/g, "Vec<$1>")
        .replace(/\bDictionary<(.+?),\s*(.+?)>/g, "HashMap<$1, $2>")
        // Access modifiers
        .replace(/\bpublic\s+class\b/g, "pub struct")
        .replace(/\bpublic\s+/g, "pub ")
        .replace(/\bprivate\s+/g, "")
        // Method syntax
        .replace(/\bpublic\s+(\w+)\s+(\w+)\s*\(/g, "pub fn $2(")
        // Null handling
        .replace(/\?\s*:/g, ".unwrap_or_else(||")
        // Basic error handling
        .replace(
          /\btry\s*{/g,
          "match (|| -> Result<_, Box<dyn std::error::Error>> {",
        )
        .replace(
          /\bcatch\s*\(.*?\)\s*{/g,
          "})() { Ok(result) => result, Err(e) => {",
        )
    );
  }

  private calculateConversionConfidence(patterns: ConversionPattern[]): number {
    if (patterns.length === 0) return 0.3;
    const avgConfidence =
      patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
    return Math.min(0.95, avgConfidence * (patterns.length / 10));
  }

  private async learnFromConversion(task: Task, result: TaskOutput): Promise<void> {
    try {
      // Store successful patterns for future use
      await this.memory.storeAgentMemory(
        this.id,
        `conversion-${Date.now()}`,
        {
          task: task.id,
          patterns: (result as any)?.patternsApplied || [],
          confidence: (result as any)?.confidence || 0.5,
          success: true,
        },
        (result as any)?.confidence || 0.5,
      );
    } catch (error) {
      debugLog(`Failed to store conversion learning: ${error}`);
    }
  }
}

class ValidatorAgent implements Agent {
  id: string = `validator-${Date.now()}`;
  type: AgentType = "validator";
  name = "Code Validator";
  description =
    "Validates converted Rust code for correctness and Neo compatibility";
  capabilities = [
    "rust-compilation",
    "neo-validation",
    "test-execution",
    "static-analysis",
  ];
  status: AgentStatus = "idle";
  priority = 7;
  currentTask?: Task;
  lastActivity?: Date;
  metadata: AgentMetadata = {};

  constructor(
    private memory: AgentMemoryManager,
    private workspacePath: string,
  ) {}

  async initialize(): Promise<void> {
    this.status = "initializing";
    try {
      // Check for Rust toolchain
      await this.checkRustToolchain();
      this.status = "idle";
      debugLog(`Validator agent ${this.id} initialized`);
    } catch (error) {
      this.status = "error";
      throw error;
    }
  }

  async execute(task: Task): Promise<TaskResult> {
    if (!this.canHandle(task)) {
      throw new Error(`Validator agent cannot handle task type: ${task.type}`);
    }

    this.status = "busy";
    this.currentTask = task;
    this.lastActivity = new Date();
    const startTime = Date.now();

    try {
      const result = await this.validateConversion(task.input as { convertedContent: string; originalContent: string; filePath: string; });

      this.status = "idle";
      this.currentTask = undefined;

      return {
        success: result.isValid,
        output: result,
        warnings: result.warnings,
        executionTime: Date.now() - startTime,
        agentId: this.id,
        taskId: task.id,
      };
    } catch (error) {
      this.status = "error";
      this.currentTask = undefined;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        agentId: this.id,
        taskId: task.id,
      };
    }
  }

  canHandle(task: Task): boolean {
    return task.type === "validate-conversion";
  }

  async stop(): Promise<void> {
    this.status = "stopped";
    this.currentTask = undefined;
  }

  private async checkRustToolchain(): Promise<void> {
    // Check if rustc and cargo are available
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    try {
      await execAsync("rustc --version");
      await execAsync("cargo --version");
      this.metadata.toolchainAvailable = true;
    } catch (error) {
      this.metadata.toolchainAvailable = false;
      debugLog("Rust toolchain not available for validation");
    }
  }

  private async validateConversion(input: {
    convertedContent: string;
    originalContent: string;
    filePath: string;
  }): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
    neoCompatibility: number;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Syntax validation
    const syntaxCheck = this.validateRustSyntax(input.convertedContent);
    errors.push(...syntaxCheck.errors);
    warnings.push(...syntaxCheck.warnings);

    // Neo-specific validation
    const neoCheck = this.validateNeoCompatibility(
      input.convertedContent,
      input.originalContent,
    );
    warnings.push(...neoCheck.warnings);
    suggestions.push(...neoCheck.suggestions);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      neoCompatibility: neoCheck.compatibility,
    };
  }

  private validateRustSyntax(content: string): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic syntax checks
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push("Mismatched braces in Rust code");
    }

    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push("Mismatched parentheses in Rust code");
    }

    // Check for common issues
    if (content.includes("unimplemented!()")) {
      warnings.push("Code contains unimplemented!() macros");
    }

    if (content.includes("unsafe")) {
      warnings.push("Code contains unsafe blocks - ensure memory safety");
    }

    return { errors, warnings };
  }

  private validateNeoCompatibility(
    rustContent: string,
    csharpContent: string,
  ): {
    warnings: string[];
    suggestions: string[];
    compatibility: number;
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let compatibility = 1.0;

    // Check for Neo-specific types
    const neoTypes = ["UInt160", "UInt256", "ECPoint", "StackItem"];
    for (const neoType of neoTypes) {
      if (csharpContent.includes(neoType) && !rustContent.includes(neoType)) {
        warnings.push(`Missing Neo type conversion: ${neoType}`);
        compatibility -= 0.1;
      }
    }

    // Check error handling patterns
    if (csharpContent.includes("try") && !rustContent.includes("Result<")) {
      suggestions.push(
        "Consider using Result<T, E> for proper Rust error handling",
      );
      compatibility -= 0.05;
    }

    // Check async patterns
    if (csharpContent.includes("async") && !rustContent.includes("async")) {
      suggestions.push("Verify async pattern conversion is correct");
    }

    return {
      warnings,
      suggestions,
      compatibility: Math.max(0, compatibility),
    };
  }
}

// Agent Coordinator - the main orchestrator
export class AgentCoordinator {
  private agents: Map<string, Agent> = new Map();
  private taskQueue: Task[] = [];
  private activeTasks: Map<string, Task> = new Map();
  private strategy: CoordinationStrategy;
  private memory: AgentMemoryManager;
  private config: AgentEnhancedConfigManager;
  private initialized = false;
  private sessionId: string;

  constructor(private workspacePath: string) {
    this.sessionId = `session-${Date.now()}`;
    this.memory = getMemoryManager(workspacePath) as AgentMemoryManager;
    this.config = getEnhancedConfig(workspacePath) as unknown as AgentEnhancedConfigManager;
    this.strategy = this.createDefaultStrategy();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.memory.initialize();
      await this.config.initialize();

      // Create and initialize agents based on configuration
      await this.createAgents();

      // Start deadlock detection
      this.startDeadlockDetection();

      this.initialized = true;
      debugLog("Agent coordinator initialized successfully");
    } catch (error) {
      throw new AutoClaudeError(
        "COORDINATOR_INIT_FAILED",
        `Failed to initialize agent coordinator: ${error}`,
        ErrorCategory.INTERNAL,
        ErrorSeverity.HIGH,
        { sessionId: this.sessionId, error },
        true,
        "Agent system initialization failed",
        ["Check configuration", "Restart VS Code", "Reset agent state"],
      );
    }
  }

  private async createAgents(): Promise<void> {
    const config = this.config.getConfig();

    if (!config.agents.enabled) {
      debugLog("Agent system disabled in configuration");
      return;
    }

    // Check if universal language conversion is enabled
    if (config.languageConversion.enabled) {
      // Import universal agents dynamically
      const { UniversalConverterAgent } = await import(
        "./UniversalConverterAgent"
      );
      const { UniversalValidatorAgent } = await import(
        "./UniversalValidatorAgent"
      );

      // Create universal converter agent
      const universalConverter = new UniversalConverterAgent(
        "universal-converter",
        this.workspacePath,
      );
      await universalConverter.initialize();
      this.agents.set(universalConverter.id, universalConverter as unknown as Agent);

      // Create universal validator agent
      const universalValidator = new UniversalValidatorAgent(
        "universal-validator",
        this.workspacePath,
      );
      await universalValidator.initialize();
      this.agents.set(universalValidator.id, universalValidator as unknown as Agent);

      debugLog("Created universal language conversion agents");
    }

    // Create neo-rs specific agents if enabled
    if (config.neoRs.enabled) {
      // Create converter agent
      const converter = new ConverterAgent(this.memory, this.workspacePath);
      await converter.initialize();
      this.agents.set(converter.id, converter);

      // Create validator agent
      const validator = new ValidatorAgent(this.memory, this.workspacePath);
      await validator.initialize();
      this.agents.set(validator.id, validator);

      debugLog("Created neo-rs specific agents");
    }

    debugLog(`Created ${this.agents.size} agents`);
  }

  async submitTask(task: Omit<Task, "id" | "createdAt">): Promise<string> {
    if (!this.initialized) {
      throw new AutoClaudeError(
        "COORDINATOR_NOT_INITIALIZED",
        "Agent coordinator not initialized",
        ErrorCategory.USAGE,
        ErrorSeverity.HIGH,
      );
    }

    const fullTask: Task = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    this.taskQueue.push(fullTask);
    debugLog(`Task ${fullTask.id} submitted to queue`);

    // Process tasks if we have available agents
    this.processTaskQueue();

    return fullTask.id;
  }

  private async processTaskQueue(): Promise<void> {
    if (this.taskQueue.length === 0) return;

    const availableAgents = Array.from(this.agents.values()).filter(
      (agent) => agent.status === "idle",
    );

    if (availableAgents.length === 0) return;

    const config = this.config.getConfig();
    const maxConcurrent = Math.min(
      config.agents.maxConcurrent,
      availableAgents.length,
    );

    const activeTasks = this.activeTasks.size;
    const slotsAvailable = maxConcurrent - activeTasks;

    if (slotsAvailable <= 0) return;

    // Process tasks based on strategy
    const tasksToProcess = this.taskQueue.splice(0, slotsAvailable);

    for (const task of tasksToProcess) {
      const agent = this.findBestAgent(task, availableAgents);
      if (agent) {
        this.executeTask(agent, task);
      } else {
        // Return task to queue if no suitable agent found
        this.taskQueue.unshift(task);
      }
    }
  }

  private findBestAgent(task: Task, availableAgents: Agent[]): Agent | null {
    // Find agents that can handle this task type
    const capableAgents = availableAgents.filter((agent) =>
      agent.canHandle(task),
    );

    if (capableAgents.length === 0) return null;

    // Sort by priority and select the best one
    capableAgents.sort((a, b) => b.priority - a.priority);
    return capableAgents[0];
  }

  private async executeTask(agent: Agent, task: Task): Promise<void> {
    this.activeTasks.set(task.id, task);
    task.assignedAgent = agent.id;
    task.startedAt = new Date();

    debugLog(`Executing task ${task.id} with agent ${agent.id}`);

    // Acquire necessary resource locks
    const resources = this.getTaskResources(task);
    const locksAcquired: string[] = [];
    
    try {
      // Try to acquire all necessary locks
      for (const resource of resources) {
        const lockType = this.determineLockType(task.type, resource);
        const acquired = await conflictManager.acquireResourceLock(
          resource,
          agent.id,
          task.id,
          lockType
        );
        
        if (acquired) {
          locksAcquired.push(resource);
        } else {
          // Could not acquire lock, wait or reschedule
          debugLog(`Failed to acquire lock for ${resource}, rescheduling task`);
          this.taskQueue.unshift(task); // Put back in queue
          this.activeTasks.delete(task.id);
          // Release any locks we did acquire
          for (const lockedResource of locksAcquired) {
            conflictManager.releaseResourceLock(lockedResource, agent.id);
          }
          return;
        }
      }

      // Subscribe to relevant communication channels
      const channels = this.getTaskChannels(task.type);
      for (const channel of channels) {
        communicationChannel.subscribe(channel, agent.id);
      }

      // Execute the task
      const result = await agent.execute(task);
      task.completedAt = new Date();

      // Publish result to communication channels
      for (const channel of channels) {
        communicationChannel.publish(channel, agent.id, {
          taskId: task.id,
          taskType: task.type,
          success: result.success,
          output: result.output
        });
      }

      // Store result in memory
      await this.memory.storeAgentMemory(
        agent.id,
        `task-result-${task.id}`,
        result,
        result.success ? 0.8 : 0.3,
      );

      debugLog(
        `Task ${task.id} completed: ${result.success ? "SUCCESS" : "FAILED"}`,
      );
    } catch (error) {
      debugLog(`Task ${task.id} failed with error: ${error instanceof Error ? error.message : String(error)}`);

      // Handle retry logic
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const shouldRetry = this.shouldRetryTask(task, errorObj);
      if (shouldRetry) {
        task.retryCount = (task.retryCount || 0) + 1;
        this.taskQueue.unshift(task); // Add back to front of queue
      }
    } finally {
      // Release all resource locks
      for (const resource of locksAcquired) {
        conflictManager.releaseResourceLock(resource, agent.id);
      }
      
      this.activeTasks.delete(task.id);

      // Continue processing queue
      setTimeout(() => this.processTaskQueue(), 100);
    }
  }

  private shouldRetryTask(task: Task, error: Error): boolean {
    const maxRetries =
      task.maxRetries || this.strategy.failureHandling.maxRetries;
    const currentRetries = task.retryCount || 0;

    return (
      currentRetries < maxRetries &&
      this.strategy.failureHandling.failureRecovery === "retry"
    );
  }

  private createDefaultStrategy(): CoordinationStrategy {
    const config = this.config.getConfig();

    return {
      name: config.agents.coordinationStrategy,
      maxConcurrentAgents: config.agents.maxConcurrent,
      taskDistributionRules: [
        {
          taskType: "convert-file",
          preferredAgentTypes: ["converter"],
          loadBalancing: "least-busy",
          fallbackAgents: ["specializer"],
        },
        {
          taskType: "validate-conversion",
          preferredAgentTypes: ["validator"],
          loadBalancing: "capability-based",
        },
      ],
      failureHandling: {
        maxRetries: config.agents.maxRetries,
        retryDelay: 1000,
        escalationRules: [],
        failureRecovery: config.agents.retryFailedTasks ? "retry" : "abort",
      },
    };
  }

  // Public API methods
  async getAgentStatus(): Promise<
    Array<{
      id: string;
      type: AgentType;
      name: string;
      status: AgentStatus;
      currentTask?: string;
      lastActivity?: Date;
    }>
  > {
    return Array.from(this.agents.values()).map((agent) => ({
      id: agent.id,
      type: agent.type,
      name: agent.name,
      status: agent.status,
      currentTask: agent.currentTask?.id,
      lastActivity: agent.lastActivity,
    }));
  }

  async getTaskStatus(taskId: string): Promise<Task | null> {
    return this.activeTasks.get(taskId) || null;
  }

  async getQueueStatus(): Promise<{
    queueLength: number;
    activeTasks: number;
    completedTasks: number;
  }> {
    // Get completed tasks from memory
    const stats = await this.memory.getPerformanceStats();

    return {
      queueLength: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      completedTasks: 0, // Would track this properly in production
    };
  }

  async processQueue(): Promise<void> {
    if (this.taskQueue.length === 0) {
      return;
    }

    const config = this.config.getConfig();
    const maxConcurrent = config.agents?.maxConcurrent || 5;

    while (this.activeTasks.size < maxConcurrent && this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (!task) break;

      // Find an available agent that can handle this task
      const availableAgent = this.findAvailableAgent(task);
      if (!availableAgent) {
        // Put task back at the front of the queue
        this.taskQueue.unshift(task);
        break;
      }

      // Assign task to agent
      this.activeTasks.set(task.id, task);
      availableAgent.currentTask = task;
      availableAgent.status = "busy";

      // Execute task asynchronously
      this.executeTaskWithAgent(availableAgent, task).catch((error) => {
        debugLog(`Task execution failed: ${error}`);
        this.activeTasks.delete(task.id);
        availableAgent.currentTask = undefined;
        availableAgent.status = "error";
      });
    }
  }

  private findAvailableAgent(task: Task): Agent | null {
    for (const agent of this.agents.values()) {
      if (agent.status === "idle" && agent.canHandle(task)) {
        return agent;
      }
    }
    return null;
  }

  private async executeTaskWithAgent(agent: Agent, task: Task): Promise<void> {
    try {
      const result = await agent.execute(task);

      // Store result in memory
      await this.memory.recordTaskCompletion(
        task.id,
        task.type,
        result.success,
        result.error || "",
        result.executionTime || 0,
      );

      // Clean up
      this.activeTasks.delete(task.id);
      agent.currentTask = undefined;
      agent.status = "idle";
      agent.lastActivity = new Date();

      debugLog(`Task ${task.id} completed by agent ${agent.id}`);

      // Continue processing queue
      this.processQueue();
    } catch (error) {
      debugLog(`Agent ${agent.id} failed to execute task ${task.id}: ${error}`);

      // Clean up
      this.activeTasks.delete(task.id);
      agent.currentTask = undefined;
      agent.status = "error";

      throw error;
    }
  }

  async stopAllAgents(): Promise<void> {
    const stopPromises = Array.from(this.agents.values()).map((agent) =>
      agent.stop(),
    );
    await Promise.all(stopPromises);

    this.taskQueue.length = 0;
    this.activeTasks.clear();

    debugLog("All agents stopped");
  }

  /**
   * Get resources required by a task
   */
  private getTaskResources(task: Task): string[] {
    const resources: string[] = [];
    
    switch (task.type) {
      case "convert-file":
      case "validate-conversion":
        if (task.input.filePath) {
          resources.push(`file:${task.input.filePath}`);
        }
        break;
      case "optimize-code":
        resources.push(`optimization:${task.id}`);
        break;
      case "generate-tests":
        resources.push(`tests:${task.input.filePath || task.id}`);
        break;
      case "create-docs":
        resources.push(`docs:${task.input.filePath || task.id}`);
        break;
      default:
        resources.push(`task:${task.id}`);
    }
    
    return resources;
  }

  /**
   * Determine lock type based on task type and resource
   */
  private determineLockType(taskType: TaskType, resource: string): "exclusive" | "shared" {
    // Write operations need exclusive locks
    const exclusiveTaskTypes: TaskType[] = [
      "convert-file",
      "optimize-code",
      "generate-tests",
      "create-docs"
    ];
    
    // Read operations can use shared locks
    const sharedTaskTypes: TaskType[] = [
      "validate-conversion",
      "validate-syntax",
      "analyze-code",
      "detect-errors",
      "security-scan"
    ];
    
    if (exclusiveTaskTypes.includes(taskType)) {
      return "exclusive";
    }
    
    if (sharedTaskTypes.includes(taskType)) {
      return "shared";
    }
    
    // Default to exclusive for safety
    return "exclusive";
  }

  /**
   * Get communication channels for a task type
   */
  private getTaskChannels(taskType: TaskType): string[] {
    const channels: string[] = [];
    
    switch (taskType) {
      case "convert-file":
      case "validate-conversion":
        channels.push("conversion-pipeline");
        break;
      case "optimize-code":
        channels.push("optimization");
        break;
      case "generate-tests":
      case "validate-syntax":
        channels.push("quality-assurance");
        break;
      case "create-docs":
        channels.push("documentation");
        break;
      case "security-scan":
        channels.push("security");
        break;
      default:
        channels.push("general");
    }
    
    return channels;
  }

  /**
   * Check for deadlocks periodically
   */
  private startDeadlockDetection(): void {
    setInterval(() => {
      if (conflictManager.detectDeadlocks()) {
        debugLog("Deadlock detected! Attempting resolution...");
        const activeAgentIds = Array.from(this.agents.keys()).filter(
          id => this.agents.get(id)?.status === "busy"
        );
        conflictManager.resolveDeadlock(activeAgentIds);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Clean up when agent fails
   */
  private handleAgentFailure(agentId: string): void {
    conflictManager.clearAgentLocks(agentId);
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = "error";
      if (agent.currentTask) {
        // Reschedule the task
        this.taskQueue.unshift(agent.currentTask);
        agent.currentTask = undefined;
      }
    }
  }

  dispose(): void {
    this.stopAllAgents();
    this.agents.clear();
    // Clear all locks on disposal
    for (const agentId of this.agents.keys()) {
      conflictManager.clearAgentLocks(agentId);
    }
    this.config.dispose();
  }
}

// Singleton instance
let coordinatorInstance: AgentCoordinator | null = null;

export function getAgentCoordinator(workspacePath: string): AgentCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new AgentCoordinator(workspacePath);
  }
  return coordinatorInstance;
}

export function resetAgentCoordinator(): void {
  if (coordinatorInstance) {
    coordinatorInstance.dispose();
    coordinatorInstance = null;
  }
}
