import * as vscode from "vscode";
import { TextDecoder } from "util";
import { log } from "../utils/productionLogger";
import { AutomaticWorkflowSystem } from "./AutomaticWorkflowSystem";
import { SubAgentRunner } from "../subagents/SubAgentRunner";
import { ParallelAgentOrchestrator } from "../agents/ParallelAgentOrchestrator";
import { getMemoryManager } from "../memory";
import { getHookManager } from "../hooks/HookManager";
import { getAgentCoordinator } from "../agents/AgentCoordinator";
import { getSystemMonitor } from "../monitoring/SystemMonitor";
import { ContextManager } from "./contextManager";
import { TaskCompletionEngine } from "./taskCompletion";
import { ErrorRecoverySystem } from "./errorRecovery";
import {
  HiveMindTask,
  TaskPriority,
  TaskStatus,
} from "../agents/hivemind/types";
import { ProductionReadinessValidator } from "../validation/ProductionReadinessValidator";
import { PreTaskValidator } from "../validation/PreTaskValidator";
import {
  IntelligentTaskAnalyzer,
  TaskAnalysisResult,
} from "./IntelligentTaskAnalyzer";
import {
  MemoryManager,
} from "../memory";
import {
  HookManager,
} from "../hooks/HookManager";
import { issueFixerAgent, ProductionIssue } from "./IssueFixerAgent";
import { getProductionIssueQueueManager } from "./ProductionIssueQueueManager";
import { getComprehensiveIssueHandler } from "./ComprehensiveIssueHandler";
import {
  AgentCoordinator,
} from "../agents/AgentCoordinator";
import {
  SystemMonitor,
} from "../monitoring/SystemMonitor";
import {
  TaskIntent,
  IntentType,
  WorkflowInfo,
  CodeChange,
  BuildStatus,
  FailingTest,
  PendingWork,
  ValidationResult,
  ValidationError,
  TaskSubtask,
} from "../types/orchestration";

/**
 * Unified Orchestration System - Integrates all AutoClaude features
 *
 * This system automatically coordinates:
 * - Hive-Mind AI agents for complex tasks
 * - SubAgents for specialized checks and fixes
 * - Parallel agents for distributed work
 * - Memory and context management
 * - Automatic task planning and execution
 * - Error recovery and resilience
 */
export class UnifiedOrchestrationSystem {
  private static instance: UnifiedOrchestrationSystem | null = null;

  private workflowSystem: AutomaticWorkflowSystem;
  private subAgentRunner: SubAgentRunner;
  private parallelOrchestrator: ParallelAgentOrchestrator | null = null;
  private contextManager: ContextManager;
  private taskEngine: TaskCompletionEngine;
  private errorRecovery: ErrorRecoverySystem;
  private memoryManager: MemoryManager;
  private hookManager: HookManager;
  private agentCoordinator: AgentCoordinator;
  private systemMonitor: SystemMonitor;
  private productionValidator: ProductionReadinessValidator;
  private preTaskValidator: PreTaskValidator;
  private taskAnalyzer: IntelligentTaskAnalyzer;

  private isRunning = false;
  private activeWorkflows = new Map<string, WorkflowInfo>();
  private taskQueue: HiveMindTask[] = [];
  private changedFiles = new Set<string>();

  constructor(private workspaceRoot: string) {
    this.workflowSystem = AutomaticWorkflowSystem.getInstance(workspaceRoot);
    this.subAgentRunner = new SubAgentRunner(workspaceRoot);
    this.contextManager = new ContextManager(workspaceRoot);
    this.taskEngine = new TaskCompletionEngine(workspaceRoot);
    this.errorRecovery = new ErrorRecoverySystem(
      this.contextManager,
      workspaceRoot,
    );
    this.productionValidator =
      ProductionReadinessValidator.getInstance(workspaceRoot);
    this.preTaskValidator = PreTaskValidator.getInstance(workspaceRoot);
    this.taskAnalyzer = new IntelligentTaskAnalyzer(workspaceRoot);

    // Get singleton instances
    this.memoryManager = getMemoryManager(workspaceRoot);
    this.hookManager = getHookManager(workspaceRoot);
    this.agentCoordinator = getAgentCoordinator(workspaceRoot);
    this.systemMonitor = getSystemMonitor(workspaceRoot);
    
    // Initialize ProductionIssueQueueManager and ComprehensiveIssueHandler with workspace root
    getProductionIssueQueueManager(workspaceRoot);
    getComprehensiveIssueHandler(workspaceRoot);
  }

  static getInstance(workspaceRoot: string): UnifiedOrchestrationSystem {
    if (!UnifiedOrchestrationSystem.instance) {
      UnifiedOrchestrationSystem.instance = new UnifiedOrchestrationSystem(
        workspaceRoot,
      );
    }
    return UnifiedOrchestrationSystem.instance;
  }

  async initialize(): Promise<void> {
    log.info("Initializing Unified Orchestration System");

    const initTasks = [
      { name: 'workflowSystem', init: () => this.workflowSystem.initialize() },
      { name: 'subAgentRunner', init: () => this.subAgentRunner.initialize() },
      { name: 'contextManager', init: () => this.contextManager.initialize() },
      { name: 'memoryManager', init: () => this.memoryManager.initialize() },
      { name: 'hookManager', init: () => this.hookManager.initialize() },
      { name: 'agentCoordinator', init: () => this.agentCoordinator.initialize() },
      { name: 'systemMonitor', init: () => this.systemMonitor.initialize() },
    ];

    // Initialize each subsystem with error handling
    for (const task of initTasks) {
      try {
        await task.init();
        log.info(`Initialized ${task.name}`);
      } catch (error) {
        log.warn(`Failed to initialize ${task.name}:`, error as Error);
        // Continue with other initializations instead of throwing
        console.warn(`[AutoClaude] ${task.name} initialization failed but continuing`);
      }
    }

    try {
      // Set up automatic coordination
      await this.setupAutomaticCoordination();

      // Load previous session state if available
      await this.restorePreviousSession();

      // Start automatic monitoring
      await this.startAutomaticMonitoring();

      log.info("Unified Orchestration System initialized (with some subsystems disabled)");
    } catch (error) {
      log.warn(
        "Failed to complete Unified Orchestration System setup",
        error as Error,
      );
      // Don't throw - let the extension continue with reduced functionality
    }
  }

  /**
   * Process a natural language command with full orchestration
   */
  async processNaturalCommand(command: string): Promise<void> {
    log.info("Processing natural language command", { command });

    try {
      // Run pre-operation hooks
      await this.hookManager.runHooks("pre-operation", { content: command });

      // Use IntelligentTaskAnalyzer to analyze and decompose the task
      const analysisResult = await this.taskAnalyzer.analyzeTask(command);

      log.info("Task analysis completed", {
        complexity: analysisResult.complexity,
        subtaskCount: analysisResult.subtasks.length,
        confidence: analysisResult.confidence,
        estimatedDuration: analysisResult.estimatedDuration,
      });

      // Show analysis to user
      const durationInMinutes = Math.ceil(
        analysisResult.estimatedDuration / 60,
      );
      vscode.window.showInformationMessage(
        `Task analyzed: ${analysisResult.subtasks.length} subtasks, ` +
          `complexity: ${analysisResult.complexity}, ` +
          `estimated duration: ${durationInMinutes} minutes`,
      );

      // Check if we need parallel processing based on analysis
      if (
        analysisResult.executionPlan.parallelOpportunities > 0 ||
        analysisResult.subtasks.length > 3
      ) {
        await this.initializeParallelProcessing(
          Math.min(analysisResult.executionPlan.parallelOpportunities + 1, 10),
        );
      }

      // Execute subtasks according to the execution plan
      for (const phase of analysisResult.executionPlan.phases) {
        // Execute tasks in parallel within each phase
        const phasePromises = phase.tasks.map(async (taskInfo) => {
          const hiveMindTask = this.convertSubtaskToHiveMindTask(
            taskInfo.subtask,
            taskInfo.agent,
            taskInfo.tools,
          );

          return this.executeTaskWithOrchestration(hiveMindTask);
        });

        // Wait for all tasks in the phase to complete
        await Promise.all(phasePromises);
      }

      // Run post-operation hooks
      await this.hookManager.runHooks("post-operation", {
        content: command,
        metadata: {
          tasksCompleted: analysisResult.subtasks.length,
          analysisResult,
        },
      });

      // Save to memory for learning
      await this.memoryManager.recordCommand(
        command,
        analysisResult.subtasks
      );

      vscode.window.showInformationMessage(
        `✅ Task completed successfully! Executed ${analysisResult.subtasks.length} subtasks.`,
      );
    } catch (error) {
      log.error("Failed to process natural command", error as Error);
      await this.handleOrchestrationError(error as Error, command);
    }
  }

  /**
   * Execute a task with full orchestration capabilities
   */
  private async executeTaskWithOrchestration(
    task: HiveMindTask,
  ): Promise<void> {
    log.info("Executing task with orchestration", {
      taskId: task.id,
      type: task.type,
      assignedAgent: task.context?.assignedAgent,
      requiredTools: task.context?.requiredTools,
    });

    try {
      // CRITICAL: Pre-task validation for TDD/DDD enforcement
      const preValidation = await this.preTaskValidator.validatePreTask(task);
      if (!preValidation.passed) {
        log.error("Pre-task validation failed - blocking task execution", undefined, {
          taskId: task.id,
          blockers: preValidation.blockers.length,
          errors: preValidation.errors.length,
        });

        // Show validation errors to user
        const errorMessages = [
          ...preValidation.blockers.map((b) => `🚫 ${b.message}`),
          ...preValidation.errors.map((e) => `❌ ${e.message}`),
        ].join("\n");

        vscode.window
          .showErrorMessage(
            `Task blocked: TDD/DDD violations detected`,
            "Show Details",
          )
          .then((action) => {
            if (action === "Show Details") {
              const outputChannel =
                vscode.window.createOutputChannel("TDD/DDD Validation");
              outputChannel.appendLine("Pre-Task Validation Failed\n");
              outputChannel.appendLine(errorMessages);
              outputChannel.show();
            }
          });

        // Mark task as failed due to validation
        task.status = TaskStatus.FAILED;
        task.result = {
          success: false,
          error: "Pre-task validation failed: TDD/DDD requirements not met",
          data: preValidation,
        };
        throw new Error(
          "Pre-task validation failed: TDD/DDD requirements not met",
        );
      }

      // Show warnings if any
      if (preValidation.warnings.length > 0) {
        const warningMessages = preValidation.warnings
          .map((w) => w.message)
          .join("\n");
        vscode.window.showWarningMessage(
          `TDD/DDD Warnings: ${warningMessages}`,
        );
      }

      // Update task status
      task.status = TaskStatus.IN_PROGRESS;
      task.startedAt = Date.now();

      // Check if task has a pre-assigned agent (from IntelligentTaskAnalyzer)
      if (task.context?.assignedAgent) {
        // Execute with the assigned agent and tools
        await this.executeWithAssignedAgent(task);
      } else {
        // Determine execution strategy dynamically
        const strategy = await this.determineExecutionStrategy(task);

        switch (strategy) {
          case "hive-mind":
            // Use Hive-Mind for complex tasks
            await this.workflowSystem.processTask(task);
            break;

          case "sub-agent":
            // Use specialized SubAgent
            await this.executeWithSubAgent(task);
            break;

          case "parallel":
            // Distribute to parallel agents
            await this.executeWithParallelAgents(task);
            break;

          case "direct":
            // Execute directly
            await this.executeDirectTask(task);
            break;

          default:
            // Default to workflow system
            await this.workflowSystem.processTask(task);
        }
      }

      // CRITICAL: Validate production readiness before marking as complete
      const validationResult = await this.validateProductionReadiness();

      if (!validationResult.isProductionReady) {
        log.error("Task cannot be completed - code is not production ready", undefined, {
          taskId: task.id,
          errors: validationResult.errors.length,
          criticalIssues: validationResult.criticalIssues.length,
        });

        // Show validation report to user
        const report =
          this.productionValidator.formatValidationResult(validationResult);
        vscode.window
          .showErrorMessage(
            "Task cannot be completed - code is not production ready. Check output for details.",
            "Show Report",
          )
          .then((action) => {
            if (action === "Show Report") {
              const outputChannel = vscode.window.createOutputChannel(
                "Production Readiness",
              );
              outputChannel.appendLine(report);
              outputChannel.show();
            }
          });

        // Attempt to fix issues automatically
        await this.attemptAutomaticFixes(validationResult);

        // Re-validate after fixes
        const revalidationResult = await this.validateProductionReadiness();

        if (!revalidationResult.isProductionReady) {
          // Still not ready - mark task as failed
          task.status = TaskStatus.FAILED;
          task.result = {
            success: false,
            error: "Code is not production ready",
            data: revalidationResult,
          };
          throw new Error(
            "Production readiness validation failed after automatic fixes",
          );
        }
      }

      // Update task completion only if validation passes
      task.status = TaskStatus.COMPLETED;
      task.completedAt = Date.now();
      task.duration = task.completedAt - task.startedAt;

      // Record metrics
      await this.recordTaskMetrics(task);

      // Clear changed files tracking
      this.changedFiles.clear();
    } catch (error) {
      log.error("Task execution failed", error as Error, { taskId: task.id });
      task.status = TaskStatus.FAILED;

      // Attempt recovery
      const recovered = await this.errorRecovery.attemptRecovery(
        String(error),
      );
      if (!recovered) {
        throw error;
      }
    }
  }

  /**
   * Execute task with a pre-assigned agent and tools
   */
  private async executeWithAssignedAgent(task: HiveMindTask): Promise<void> {
    log.info("Executing task with assigned agent", {
      taskId: task.id,
      agent: task.context.assignedAgent,
      tools: task.context.requiredTools,
    });

    const agentId = task.context.assignedAgent;

    // Check if it's a SubAgent task
    if (this.isSubAgentId(agentId)) {
      await this.executeWithSubAgent(task);
      return;
    }

    // Check if it's a Hive-Mind agent
    if (this.isHiveMindAgent(agentId)) {
      // Set the preferred agent in context
      task.context.preferredAgent = agentId;
      await this.workflowSystem.processTask(task);
      return;
    }

    // Otherwise, submit task to agent coordinator
    const taskId = await this.agentCoordinator.submitTask({
      type: task.type,
      priority: task.priority,
      description: task.description,
      context: {
        ...task.context,
        assignedAgent: agentId,
        requiredTools: task.context.requiredTools,
      },
    });

    // Wait for task completion
    let completedTask: HiveMindTask | null = null;
    while (!completedTask) {
      const status = await this.agentCoordinator.getTaskStatus(taskId);
      if (status && status.status === TaskStatus.COMPLETED) {
        completedTask = status as unknown as HiveMindTask;
        break;
      } else if (status && status.status === TaskStatus.FAILED) {
        task.result = {
          success: false,
          error: "Task failed in agent coordinator",
        };
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    task.result = completedTask.result;
  }

  /**
   * Execute task using SubAgent system
   */
  private async executeWithSubAgent(task: HiveMindTask): Promise<void> {
    log.info("Executing task with SubAgent", { taskId: task.id });

    // Map task type to SubAgent
    const agentId =
      task.context?.assignedAgent || this.mapTaskToSubAgent(task.type);
    if (!agentId) {
      throw new Error(`No SubAgent found for task type: ${task.type}`);
    }

    // Run SubAgent check
    const result = await this.subAgentRunner.runSingleAgent(agentId);

    if (result && !result.passed) {
      // Run SubAgent analysis and fix
      await this.subAgentRunner.runAgentAnalysis(agentId, result);

      // Run iterative fixes if needed
      let iterations = 0;
      const maxIterations = 5;

      while (!result.passed && iterations < maxIterations) {
        await this.subAgentRunner.runAgentFix(agentId, result);
        const newResult = await this.subAgentRunner.runSingleAgent(agentId);
        if (newResult) {
          Object.assign(result, newResult);
        }
        iterations++;
      }
    }

    task.result = {
      success: result?.passed || false,
      data: result,
    };
  }

  /**
   * Execute task using parallel agents
   */
  private async executeWithParallelAgents(task: HiveMindTask): Promise<void> {
    log.info("Executing task with parallel agents", { taskId: task.id });

    if (!this.parallelOrchestrator) {
      await this.initializeParallelProcessing();
    }

    // Distribute task to available agents
    const assignedAgents =
      await this.parallelOrchestrator!.distributeTask(task);

    // Wait for completion
    const results = await Promise.all(
      assignedAgents.map((agentId) =>
        this.parallelOrchestrator!.waitForTaskCompletion(agentId, task.id),
      ),
    );

    task.result = {
      success: results.every((r) => r.success),
      data: results,
    };
  }

  /**
   * Set up automatic coordination between systems
   */
  private async setupAutomaticCoordination(): Promise<void> {
    // Monitor for new work and automatically start processing
    this.systemMonitor.on("high-cpu-usage", async () => {
      log.warn("High CPU usage detected, throttling operations");
      await this.throttleOperations();
    });

    this.systemMonitor.on("memory-pressure", async () => {
      log.warn("Memory pressure detected, clearing caches");
      await this.clearCaches();
    });

    // Set up automatic task detection
    setInterval(async () => {
      if (this.isRunning) {
        await this.detectAndProcessPendingWork();
      }
    }, 30000); // Check every 30 seconds

    // Set up automatic context updates
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (this.isRunning) {
        await this.contextManager.updateContext(document.uri.fsPath);
        // Track changed files for validation
        this.changedFiles.add(document.uri.fsPath);
      }
    });

    // Track all file changes
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (this.isRunning && !event.document.isUntitled) {
        this.changedFiles.add(event.document.uri.fsPath);
      }
    });
  }

  /**
   * Detect and process pending work automatically
   */
  private async detectAndProcessPendingWork(): Promise<void> {
    try {
      // Check for TODOs and FIXMEs in code
      const pendingWork = await this.contextManager.findPendingWork();

      if (pendingWork.length > 0) {
        log.info(`Found ${pendingWork.length} pending work items`);

        // Limit to prevent overwhelming the system
        const MAX_TASKS_PER_RUN = 5;
        const limitedWork = pendingWork.slice(0, MAX_TASKS_PER_RUN);
        
        if (pendingWork.length > MAX_TASKS_PER_RUN) {
          log.info(`Processing only first ${MAX_TASKS_PER_RUN} tasks to prevent system overload`);
        }

        // Convert to tasks
        const tasks = limitedWork.map((work) =>
          this.createTaskFromPendingWork(work),
        );

        // Add to queue
        this.taskQueue.push(...tasks);

        // Process queue
        await this.processTaskQueue();
      }

      // Check for failing tests
      const failingTests = await this.detectFailingTests();
      if (failingTests.length > 0) {
        const testTasks = failingTests.map((test) =>
          this.createTestFixTask(test),
        );
        this.taskQueue.push(...testTasks);
        await this.processTaskQueue();
      }
    } catch (error) {
      log.warn("Failed to detect pending work", error as Error);
    }
  }

  /**
   * Process the task queue
   */
  private async processTaskQueue(): Promise<void> {
    const MAX_PROCESSING_TIME = 30000; // 30 seconds max
    const startTime = Date.now();
    
    while (this.taskQueue.length > 0) {
      // Check timeout to prevent infinite processing
      if (Date.now() - startTime > MAX_PROCESSING_TIME) {
        log.warn(`Task processing timeout reached, stopping queue processing. ${this.taskQueue.length} tasks remaining`);
        break;
      }
      
      const task = this.taskQueue.shift()!;
      await this.executeTaskWithOrchestration(task);
    }
  }

  /**
   * Analyze command intent using AI
   */
  private async analyzeCommandIntent(command: string): Promise<any> {
    // Use memory to find similar commands
    const similarCommands =
      await this.memoryManager.findSimilarCommands(command);

    // Analyze intent
    const intent = {
      command,
      type: this.classifyCommandType(command),
      complexity: this.assessComplexity(command),
      suggestedApproach: this.determineBestApproach(command),
      similarCommands,
    };

    return intent;
  }

  /**
   * Plan tasks based on intent
   */
  private async planTasks(intent: TaskIntent): Promise<HiveMindTask[]> {
    const tasks: HiveMindTask[] = [];

    // Use different planning strategies based on intent type
    switch (intent.type) {
      case "feature-implementation":
        tasks.push(...(await this.planFeatureTasks(intent)));
        break;

      case "bug-fix":
        tasks.push(...(await this.planBugFixTasks(intent)));
        break;

      case "refactoring":
        tasks.push(...(await this.planRefactoringTasks(intent)));
        break;

      case "testing":
        tasks.push(...(await this.planTestingTasks(intent)));
        break;

      case "optimization":
        tasks.push(...(await this.planOptimizationTasks(intent)));
        break;

      case "documentation":
        tasks.push(...(await this.planDocumentationTasks(intent)));
        break;

      default:
        // Generic task planning
        tasks.push(this.createGenericTask(intent));
    }

    return tasks;
  }

  /**
   * Initialize parallel processing
   */
  private async initializeParallelProcessing(
    suggestedAgents: number = 5,
  ): Promise<void> {
    if (!this.parallelOrchestrator) {
      this.parallelOrchestrator = new ParallelAgentOrchestrator(
        this.workspaceRoot,
      );
      await this.parallelOrchestrator.initialize();
    }

    const currentAgents = await this.parallelOrchestrator.getActiveAgentCount();
    if (currentAgents < suggestedAgents) {
      await this.parallelOrchestrator.startAgents(
        suggestedAgents - currentAgents,
      );
    }
  }

  /**
   * Map task type to SubAgent ID
   */
  private mapTaskToSubAgent(taskType: string): string | null {
    const mapping: Record<string, string> = {
      "production-check": "production-readiness",
      "build-check": "build-check",
      "test-check": "test-check",
      "format-check": "format-check",
      "github-actions": "github-actions",
      "security-check": "security-audit",
      "performance-check": "performance-optimization",
      "integration-test": "integration-testing",
      testing: "tdd-enforcement",
      "test-validation": "tdd-enforcement",
      documentation: "ddd-enforcement",
      "documentation-validation": "ddd-enforcement",
    };

    return mapping[taskType] || null;
  }

  /**
   * Start the unified orchestration system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn("Unified Orchestration System already running");
      return;
    }

    log.info("Starting Unified Orchestration System");
    this.isRunning = true;

    // Start all subsystems
    await this.workflowSystem.startProcessing();

    // Start monitoring
    await this.systemMonitor.startMonitoring();

    // Process any pending work
    await this.detectAndProcessPendingWork();

    vscode.window.showInformationMessage(
      "AutoClaude Unified System activated - Ready for intelligent automation!",
    );
  }

  /**
   * Stop the unified orchestration system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    log.info("Stopping Unified Orchestration System");
    this.isRunning = false;

    // Stop all subsystems
    await this.workflowSystem.stopProcessing();
    await this.systemMonitor.stopMonitoring();

    if (this.parallelOrchestrator) {
      await this.parallelOrchestrator.stopAllAgents();
    }

    // Save state
    await this.saveCurrentState();
  }

  /**
   * Get system status
   */
  async getStatus(): Promise<any> {
    return {
      running: this.isRunning,
      activeWorkflows: this.activeWorkflows.size,
      pendingTasks: this.taskQueue.length,
      workflowStatus: await this.workflowSystem.getStatus(),
      systemHealth: await this.systemMonitor.getHealth(),
      memoryUsage: await this.memoryManager.getUsageStats(),
    };
  }

  // Helper methods

  private classifyCommandType(command: string): string {
    const lowerCommand = command.toLowerCase();

    if (
      lowerCommand.includes("implement") ||
      lowerCommand.includes("add") ||
      lowerCommand.includes("create")
    ) {
      return "feature-implementation";
    } else if (
      lowerCommand.includes("fix") ||
      lowerCommand.includes("bug") ||
      lowerCommand.includes("error")
    ) {
      return "bug-fix";
    } else if (
      lowerCommand.includes("refactor") ||
      lowerCommand.includes("improve") ||
      lowerCommand.includes("clean")
    ) {
      return "refactoring";
    } else if (
      lowerCommand.includes("test") ||
      lowerCommand.includes("coverage")
    ) {
      return "testing";
    } else if (
      lowerCommand.includes("optimize") ||
      lowerCommand.includes("performance")
    ) {
      return "optimization";
    } else if (
      lowerCommand.includes("document") ||
      lowerCommand.includes("readme")
    ) {
      return "documentation";
    }

    return "general";
  }

  private assessComplexity(command: string): "low" | "medium" | "high" {
    // Simple heuristic based on command length and keywords
    const complexKeywords = [
      "entire",
      "all",
      "complete",
      "full",
      "system",
      "architecture",
    ];
    const hasComplexKeywords = complexKeywords.some((keyword) =>
      command.toLowerCase().includes(keyword),
    );

    if (hasComplexKeywords || command.length > 100) {
      return "high";
    } else if (command.length > 50) {
      return "medium";
    }

    return "low";
  }

  private determineBestApproach(command: string): string {
    const complexity = this.assessComplexity(command);
    const type = this.classifyCommandType(command);

    if (complexity === "high") {
      return "hive-mind";
    } else if (type === "testing" || type === "bug-fix") {
      return "sub-agent";
    } else if (complexity === "medium") {
      return "parallel";
    }

    return "direct";
  }

  private async planFeatureTasks(intent: TaskIntent): Promise<HiveMindTask[]> {
    return [
      this.createTask(
        "architecture-design",
        "Design feature architecture",
        TaskPriority.HIGH,
      ),
      this.createTask(
        "code-implementation",
        "Implement feature code",
        TaskPriority.HIGH,
      ),
      this.createTask(
        "test-creation",
        "Create unit and integration tests",
        TaskPriority.MEDIUM,
      ),
      this.createTask(
        "documentation",
        "Document the new feature",
        TaskPriority.LOW,
      ),
      this.createTask(
        "integration-test",
        "Run integration tests",
        TaskPriority.MEDIUM,
      ),
    ];
  }

  private async planBugFixTasks(intent: TaskIntent): Promise<HiveMindTask[]> {
    return [
      this.createTask(
        "bug-analysis",
        "Analyze and reproduce the bug",
        TaskPriority.HIGH,
      ),
      this.createTask(
        "fix-implementation",
        "Implement the bug fix",
        TaskPriority.HIGH,
      ),
      this.createTask(
        "test-creation",
        "Create regression tests",
        TaskPriority.HIGH,
      ),
      this.createTask("test-check", "Verify all tests pass", TaskPriority.HIGH),
    ];
  }

  private createTask(
    type: string,
    description: string,
    priority: TaskPriority,
  ): HiveMindTask {
    return {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      description,
      priority,
      status: TaskStatus.PENDING,
      createdAt: Date.now(),
    };
  }

  private async saveCurrentState(): Promise<void> {
    // Save current state to memory for restoration
    await this.memoryManager.saveSessionState({
      activeWorkflows: Array.from(this.activeWorkflows.entries()),
      pendingTasks: this.taskQueue,
      timestamp: Date.now(),
    });
  }

  private async restorePreviousSession(): Promise<void> {
    try {
      const previousState = await this.memoryManager.getLastSessionState();
      if (previousState && previousState.pendingTasks) {
        this.taskQueue = previousState.pendingTasks;
        log.info(
          `Restored ${this.taskQueue.length} pending tasks from previous session`,
        );
      }
    } catch (error) {
      log.warn("Could not restore previous session", error as Error);
    }
  }

  private shouldUseParallelProcessing(tasks: HiveMindTask[]): boolean {
    return tasks.length > 3 || tasks.some((t) => t.type.includes("parallel"));
  }

  private async determineExecutionStrategy(
    task: HiveMindTask,
  ): Promise<string> {
    // Check if task type maps to a specific strategy
    if (this.mapTaskToSubAgent(task.type)) {
      return "sub-agent";
    }

    // Check task complexity
    if (task.estimatedTime && task.estimatedTime > 300) {
      return "hive-mind";
    }

    // Check if task requires multiple agents
    if (task.requiredCapabilities && task.requiredCapabilities.length > 2) {
      return "hive-mind";
    }

    return "direct";
  }

  private async executeDirectTask(task: HiveMindTask): Promise<void> {
    // Simple direct execution - check if taskEngine method exists
    if (this.taskEngine && typeof this.taskEngine.autoCompleteTask === 'function') {
      try {
        const context = await this.taskEngine.analyzeCurrentContext();
        await this.taskEngine.autoCompleteTask(context);
      } catch (error) {
        log.debug("Task engine execution skipped", error as Error);
      }
    }

    task.result = {
      success: true,
      data: { completed: true },
    };
  }

  private async handleOrchestrationError(
    error: Error,
    command: string,
  ): Promise<void> {
    log.error("Orchestration error", error, { command });

    // Attempt recovery
    const recovered = await this.errorRecovery.attemptRecovery(error, {
      command,
    });

    if (!recovered) {
      vscode.window.showErrorMessage(
        `Failed to process command: ${error.message}. Check logs for details.`,
      );
    }
  }

  private async recordTaskMetrics(task: HiveMindTask): Promise<void> {
    await this.memoryManager.recordMetric("task_completion", 1, {
      type: task.type,
      duration: task.duration,
      success: task.status === TaskStatus.COMPLETED,
    });
  }

  private async throttleOperations(): Promise<void> {
    // Reduce parallel agent count
    if (this.parallelOrchestrator) {
      const currentCount =
        await this.parallelOrchestrator.getActiveAgentCount();
      if (currentCount > 2) {
        await this.parallelOrchestrator.reduceAgents(
          Math.floor(currentCount / 2),
        );
      }
    }

    // Pause non-critical operations
    this.taskQueue = this.taskQueue.filter(
      (t) => t.priority <= TaskPriority.HIGH,
    );
  }

  private async clearCaches(): Promise<void> {
    await this.memoryManager.clearCaches();
    await this.contextManager.clearCache();
  }

  private async startAutomaticMonitoring(): Promise<void> {
    // Monitor for various triggers
    setInterval(async () => {
      if (!this.isRunning) return;

      // Check for code changes that need attention
      const changes = await this.detectCodeChangesNeedingAttention();
      if (changes.length > 0) {
        await this.processCodeChanges(changes);
      }

      // Check for broken builds
      const buildStatus = await this.checkBuildStatus();
      if (!buildStatus.success) {
        await this.fixBuildIssues(buildStatus);
      }
    }, 60000); // Every minute
  }

  private async detectCodeChangesNeedingAttention(): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];

    try {
      // Get uncommitted changes
      const gitStatus = await vscode.commands.executeCommand("git.status");

      // Scan workspace for TODOs and FIXMEs
      const todoPattern =
        /\b(TODO|FIXME|HACK|BUG|OPTIMIZE|REFACTOR)\b:?\s*(.+)/gi;
      const files = await vscode.workspace.findFiles(
        "**/*.{ts,js,tsx,jsx,py,java,cs,go,rs}",
        "**/node_modules/**",
      );

      for (const file of files) {
        const content = await vscode.workspace.fs
          .readFile(file)
          .then((buffer) => new TextDecoder().decode(buffer));

        let match;
        let lineNumber = 0;
        const lines = content.split("\n");

        for (const line of lines) {
          lineNumber++;
          while ((match = todoPattern.exec(line)) !== null) {
            changes.push({
              file: file.fsPath,
              line: lineNumber,
              type: match[1].toUpperCase(),
              text: match[2].trim(),
              priority: this.getPriorityFromType(match[1].toUpperCase()),
            });
          }
        }
      }
    } catch (error) {
      log.error("Failed to detect code changes", error as Error);
    }

    return changes;
  }

  private async processCodeChanges(changes: CodeChange[]): Promise<void> {
    // Sort by priority
    changes.sort((a, b) => a.priority - b.priority);

    // Convert to tasks and add to queue
    for (const change of changes.slice(0, 10)) {
      // Process top 10
      const task = this.createTask(
        `fix-${change.type.toLowerCase()}`,
        `${change.type}: ${change.text} (${change.file}:${change.line})`,
        change.priority,
      );

      task.context = {
        file: change.file,
        line: change.line,
        type: change.type,
        text: change.text,
      };

      this.taskQueue.push(task);
    }

    if (changes.length > 0) {
      log.info(
        `Added ${Math.min(changes.length, 10)} code change tasks to queue`,
      );
      await this.processTaskQueue();
    }
  }

  private async checkBuildStatus(): Promise<any> {
    try {
      // Try to run build command
      const buildResult =
        await this.subAgentRunner.runSingleAgent("build-check");

      return {
        success: buildResult?.passed || false,
        errors: buildResult?.errors || [],
        output: buildResult?.output || "",
      };
    } catch (error) {
      log.error("Failed to check build status", error as Error);
      return { success: false, errors: [error.message] };
    }
  }

  private async fixBuildIssues(buildStatus: BuildStatus): Promise<void> {
    if (buildStatus.success) return;

    log.info("Attempting to fix build issues automatically");

    const task = this.createTask(
      "fix-build",
      "Fix build errors: " + buildStatus.errors.join(", "),
      TaskPriority.CRITICAL,
    );

    task.context = {
      errors: buildStatus.errors,
      output: buildStatus.output,
    };

    // Add to front of queue
    this.taskQueue.unshift(task);
    await this.executeTaskWithOrchestration(task);
  }

  private async detectFailingTests(): Promise<FailingTest[]> {
    const failingTests: FailingTest[] = [];

    try {
      // Run test check
      const testResult = await this.subAgentRunner.runSingleAgent("test-check");

      if (testResult && !testResult.passed && testResult.errors) {
        // Parse test failures
        for (const error of testResult.errors) {
          const testMatch = error.match(
            /(?:Test|test)\s+(.+?)\s+(?:failed|FAILED)/,
          );
          if (testMatch) {
            failingTests.push({
              name: testMatch[1],
              error: error,
              file: this.extractFileFromError(error),
            });
          }
        }
      }
    } catch (error) {
      log.error("Failed to detect failing tests", error as Error);
    }

    return failingTests;
  }

  private createTaskFromPendingWork(work: PendingWork): HiveMindTask {
    return this.createTask(
      "fix-todo",
      `Fix TODO: ${work.text}`,
      TaskPriority.MEDIUM,
    );
  }

  private createTestFixTask(test: FailingTest): HiveMindTask {
    return this.createTask(
      "fix-test",
      `Fix failing test: ${test.name}`,
      TaskPriority.HIGH,
    );
  }

  private async planRefactoringTasks(intent: TaskIntent): Promise<HiveMindTask[]> {
    return [
      this.createTask(
        "code-analysis",
        "Analyze code structure",
        TaskPriority.HIGH,
      ),
      this.createTask(
        "refactor-plan",
        "Plan refactoring approach",
        TaskPriority.HIGH,
      ),
      this.createTask(
        "refactor-implementation",
        "Implement refactoring",
        TaskPriority.MEDIUM,
      ),
      this.createTask(
        "test-check",
        "Ensure tests still pass",
        TaskPriority.HIGH,
      ),
    ];
  }

  private async planTestingTasks(intent: TaskIntent): Promise<HiveMindTask[]> {
    return [
      this.createTask(
        "test-analysis",
        "Analyze test coverage",
        TaskPriority.HIGH,
      ),
      this.createTask(
        "test-creation",
        "Create missing tests",
        TaskPriority.HIGH,
      ),
      this.createTask("test-execution", "Run all tests", TaskPriority.MEDIUM),
      this.createTask(
        "coverage-report",
        "Generate coverage report",
        TaskPriority.LOW,
      ),
    ];
  }

  private async planOptimizationTasks(intent: TaskIntent): Promise<HiveMindTask[]> {
    return [
      this.createTask(
        "performance-analysis",
        "Analyze performance bottlenecks",
        TaskPriority.HIGH,
      ),
      this.createTask(
        "optimization-plan",
        "Plan optimization strategy",
        TaskPriority.HIGH,
      ),
      this.createTask(
        "optimization-implementation",
        "Implement optimizations",
        TaskPriority.MEDIUM,
      ),
      this.createTask(
        "performance-test",
        "Verify performance improvements",
        TaskPriority.HIGH,
      ),
    ];
  }

  private async planDocumentationTasks(intent: TaskIntent): Promise<HiveMindTask[]> {
    return [
      this.createTask(
        "doc-analysis",
        "Analyze documentation needs",
        TaskPriority.MEDIUM,
      ),
      this.createTask(
        "api-documentation",
        "Generate API documentation",
        TaskPriority.MEDIUM,
      ),
      this.createTask("readme-update", "Update README files", TaskPriority.LOW),
      this.createTask(
        "example-creation",
        "Create usage examples",
        TaskPriority.LOW,
      ),
    ];
  }

  private createGenericTask(intent: TaskIntent): HiveMindTask {
    return this.createTask("general", intent.command, TaskPriority.MEDIUM);
  }

  private getPriorityFromType(type: string): TaskPriority {
    switch (type) {
      case "FIXME":
      case "BUG":
        return TaskPriority.HIGH;
      case "TODO":
      case "HACK":
        return TaskPriority.MEDIUM;
      case "OPTIMIZE":
      case "REFACTOR":
        return TaskPriority.LOW;
      default:
        return TaskPriority.MEDIUM;
    }
  }

  /**
   * Check if agent ID is a SubAgent
   */
  private isSubAgentId(agentId: string): boolean {
    const subAgentIds = [
      "production-readiness",
      "build-check",
      "test-check",
      "format-check",
      "github-actions",
      "security-audit",
      "performance-optimization",
      "integration-testing",
      "tdd-enforcement",
      "ddd-enforcement",
    ];

    return subAgentIds.includes(agentId);
  }

  /**
   * Check if agent ID is a Hive-Mind agent
   */
  private isHiveMindAgent(agentId: string): boolean {
    const hiveMindAgents = [
      "architect-agent",
      "coder-agent",
      "tester-agent",
      "researcher-agent",
      "security-agent",
      "documentation-agent",
      "optimization-agent",
    ];

    return hiveMindAgents.includes(agentId);
  }

  private extractFileFromError(error: string): string | undefined {
    // Try to extract file path from error message
    const fileMatch = error.match(/(?:in|at)\s+(.+?\.[a-zA-Z]+)(?::(\d+))?/);
    return fileMatch ? fileMatch[1] : undefined;
  }

  /**
   * Convert a subtask from the analyzer to a HiveMindTask
   */
  private convertSubtaskToHiveMindTask(
    subtask: any, // Using any temporarily as Subtask type from IntelligentTaskAnalyzer
    agent: string,
    tools: string[],
  ): HiveMindTask {
    return {
      id: subtask.id || `task-${Date.now()}`,
      type: subtask.type || 'general',
      description: subtask.description,
      priority: subtask.priority || 'medium',
      status: TaskStatus.PENDING,
      requiredCapabilities: subtask.requiredCapabilities || [],
      estimatedTime: (subtask.estimatedDuration || 60) * 1000, // Convert to milliseconds
      context: {
        ...subtask.context,
        assignedAgent: agent,
        requiredTools: tools,
      },
      dependencies: subtask.dependencies || [],
      createdAt: Date.now(),
    };
  }

  /**
   * Validate production readiness of current code
   */
  private async validateProductionReadiness(): Promise<any> {
    log.info("Validating production readiness", {
      changedFiles: this.changedFiles.size,
    });

    // Get list of changed files or validate all if too many changes
    const changedFilesArray =
      this.changedFiles.size > 0 && this.changedFiles.size < 100
        ? Array.from(this.changedFiles)
        : undefined;

    const result =
      await this.productionValidator.validateProductionReadiness(
        changedFilesArray,
      );

    // Log detailed results
    if (!result.isProductionReady) {
      log.warn("Production readiness validation failed", {
        errors: result.errors.length,
        warnings: result.warnings.length,
        criticalIssues: result.criticalIssues.length,
        totalIssues: result.totalIssues,
      });
    }

    return result;
  }

  /**
   * Format validation report for Claude
   */
  private formatValidationReport(validationResult: ValidationResult): string {
    let report = "Production Readiness Validation Report\n";
    report += "=" + "=".repeat(40) + "\n\n";
    
    report += `Status: ${validationResult.isProductionReady ? "✅ READY" : "❌ NOT READY"}\n\n`;
    
    if (validationResult.errors && validationResult.errors.length > 0) {
      report += `## Errors (${validationResult.errors.length})\n`;
      for (const error of validationResult.errors) {
        report += `- ${error.message || error}\n`;
      }
      report += "\n";
    }
    
    if (validationResult.criticalIssues && validationResult.criticalIssues.length > 0) {
      report += `## Critical Issues (${validationResult.criticalIssues.length})\n`;
      for (const critical of validationResult.criticalIssues) {
        report += `- ${critical.message || critical}\n`;
      }
      report += "\n";
    }
    
    if (validationResult.warnings && validationResult.warnings.length > 0) {
      report += `## Warnings (${validationResult.warnings.length})\n`;
      for (const warning of validationResult.warnings) {
        report += `- ${warning.message || warning}\n`;
      }
      report += "\n";
    }
    
    if (validationResult.summary) {
      report += `## Summary\n${validationResult.summary}\n\n`;
    }
    
    return report;
  }

  /**
   * Parse validation error into a ProductionIssue
   */
  private parseValidationError(error: ValidationError | string, severityOverride?: "critical" | "error" | "warning"): ProductionIssue | null {
    // Extract file path and line number from error message
    // Common patterns: "file.ts:10:", "[file.ts:10]", "in file.ts at line 10"
    const filePatterns = [
      /^([^:]+):(\d+):\s*(.+)$/,  // file.ts:10: message
      /\[([^:]+):(\d+)\]\s*(.+)$/,  // [file.ts:10] message
      /in\s+([^\s]+)\s+at\s+line\s+(\d+):\s*(.+)$/i,  // in file.ts at line 10: message
      /File:\s*([^,]+),\s*Line:\s*(\d+):\s*(.+)$/i,  // File: file.ts, Line: 10: message
    ];

    let file = "";
    let line = 0;
    let message = typeof error === 'string' ? error : (error.message || String(error));

    // Try to extract file and line from error message
    for (const pattern of filePatterns) {
      const match = message.match(pattern);
      if (match) {
        file = match[1];
        line = parseInt(match[2], 10);
        message = match[3] || message;
        break;
      }
    }

    // If no file found in message, check if error has file property
    if (!file && typeof error === 'object' && error !== null) {
      file = (error as any).file || (error as any).fileName || (error as any).path || "";
      line = (error as any).line || (error as any).lineNumber || 0;
    }

    // Determine issue type based on message content
    let type: ProductionIssue["type"] = "placeholder";
    let severity: ProductionIssue["severity"] = severityOverride || "warning";
    let fixable = true;

    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes("todo") || lowerMessage.includes("fixme")) {
      type = "todo";
      if (!severityOverride) severity = "warning";
    } else if (lowerMessage.includes("password") || lowerMessage.includes("secret") || lowerMessage.includes("key") || lowerMessage.includes("token")) {
      type = "hardcoded-secret";
      if (!severityOverride) severity = "critical";
    } else if (lowerMessage.includes("console.log") || lowerMessage.includes("console.error")) {
      type = "console-log";
      if (!severityOverride) severity = "warning";
    } else if (lowerMessage.includes("placeholder") || lowerMessage.includes("not implemented") || lowerMessage.includes("mock") || lowerMessage.includes("stub")) {
      type = "placeholder";
      if (!severityOverride) severity = "error";
    } else if (lowerMessage.includes("security") || lowerMessage.includes("vulnerability")) {
      type = "security";
      if (!severityOverride) severity = "critical";
      fixable = false; // Security issues often need manual review
    } else if (lowerMessage.includes("test") || lowerMessage.includes("failing")) {
      type = "test-failure";
      if (!severityOverride) severity = "error";
      fixable = false; // Test failures need manual fixes
    }

    // If we couldn't extract a file, try to find it from workspace
    if (!file) {
      // For now, skip issues without file info
      return null;
    }

    return {
      type,
      file,
      line,
      message,
      severity,
      fixable
    };
  }

  /**
   * Attempt to automatically fix production readiness issues
   */
  private async attemptAutomaticFixes(validationResult: ValidationResult): Promise<void> {
    log.info("Using comprehensive issue handler to queue ALL issues for Claude");

    try {
      // Use the comprehensive handler for robust issue processing
      const comprehensiveHandler = getComprehensiveIssueHandler(this.workspacePath);
      const result = await comprehensiveHandler.processAllValidationResults(validationResult);
      
      if (result.success) {
        vscode.window.showInformationMessage(
          `🚀 Successfully queued ${result.queued} messages for Claude to fix ALL issues. ` +
          `Claude will systematically fix every issue to make the code 100% production-ready.`
        );
        
        log.info("Comprehensive issue processing complete", {
          queued: result.queued,
          failed: result.failed,
          retried: result.retried
        });
      } else {
        // Fallback to basic queue manager if comprehensive handler fails
        log.warn("Comprehensive handler failed, using fallback");
        
        const issueQueueManager = getProductionIssueQueueManager(this.workspacePath);
        await issueQueueManager.queueValidationIssues(validationResult);
        
        const validationReport = this.formatValidationReport(validationResult);
        await issueQueueManager.queueComprehensiveFixMessage(validationReport);
        
        vscode.window.showWarningMessage(
          "⚠️ Using fallback issue processing. Some issues may not be detected. " +
          "Claude will still fix all reported issues."
        );
      }
    } catch (error) {
      log.error("Failed to queue issues for Claude", error as Error);
      
      // Last resort: Queue a simple message
      try {
        const issueQueueManager = getProductionIssueQueueManager(this.workspacePath);
        const validationReport = this.formatValidationReport(validationResult);
        await issueQueueManager.queueComprehensiveFixMessage(validationReport);
        
        vscode.window.showErrorMessage(
          "❌ Issue detection partially failed, but Claude has been notified to fix all issues."
        );
      } catch (fallbackError) {
        log.error("Even fallback failed", fallbackError as Error);
        vscode.window.showErrorMessage(
          "❌ Failed to queue issues. Please manually review and fix production readiness issues."
        );
      }
    }

    // Also try SubAgent fixes for complex issues
    const fixTasks: HiveMindTask[] = [];

    // Create fix tasks for different issue types that need Claude's help
    if (validationResult.errors.some((e: ValidationError) => e.message.includes("TODO") && e.message.includes("implement"))) {
      fixTasks.push(
        this.createTask(
          "implement-todos",
          "Implement TODO items that require complex logic",
          TaskPriority.CRITICAL,
        ),
      );
    }

    if (validationResult.errors.some((e: ValidationError) => e.message.includes("test"))) {
      fixTasks.push(
        this.createTask(
          "fix-tests",
          "Fix failing tests and add missing test coverage",
          TaskPriority.HIGH,
        ),
      );
    }

    if (validationResult.errors.some((e: ValidationError) => e.message.includes("documentation"))) {
      fixTasks.push(
        this.createTask(
          "add-documentation",
          "Add missing documentation for public APIs",
          TaskPriority.MEDIUM,
        ),
      );
    }

    if (
      validationResult.errors.some(
        (e: ValidationError) =>
          e.message.includes("placeholder") || e.message.includes("mock"),
      )
    ) {
      fixTasks.push(
        this.createTask(
          "implement-placeholders",
          "Implement all placeholder and mock code with production implementations",
          TaskPriority.CRITICAL,
        ),
      );
    }

    if (
      validationResult.errors.some((e: ValidationError) =>
        e.message.includes("error handling"),
      )
    ) {
      fixTasks.push(
        this.createTask(
          "fix-error-handling",
          "Implement proper error handling for all empty catch blocks",
          TaskPriority.HIGH,
        ),
      );
    }

    // Execute all fix tasks
    for (const fixTask of fixTasks) {
      try {
        log.info("Executing automatic fix task", {
          type: fixTask.type,
          description: fixTask.description,
        });

        // Use SubAgent for specific fixes
        if (
          fixTask.type === "fix-todos" ||
          fixTask.type === "implement-placeholders"
        ) {
          await this.executeWithSubAgent(fixTask);
        } else {
          await this.executeDirectTask(fixTask);
        }
      } catch (error) {
        log.error("Automatic fix failed", error as Error, {
          taskType: fixTask.type,
        });
      }
    }

    // Run format fix
    try {
      await vscode.commands.executeCommand("editor.action.formatDocument");
    } catch (error) {
      log.warn("Format command failed", error as Error);
    }
  }
}
