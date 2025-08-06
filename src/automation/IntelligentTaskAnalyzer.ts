import * as vscode from "vscode";
import { log } from "../utils/productionLogger";
import {
  HiveMindTask,
  TaskPriority,
  TaskStatus,
} from "../agents/hivemind/types";
import { getMemoryManager } from "../memory";
import { ContextManager } from "./contextManager";
import * as path from "path";
import * as fs from "fs";
import {
  TaskAnalysisMemoryManager,
  TaskAnalysisPattern,
  PatternSubtask,
  TaskContextConfiguration,
  TaskAnalysisContext,
  SimilarTaskAnalysis,
  SubtaskContext,
  TaskPattern,
  TaskIntent,
  PatternExecutionPlan,
} from "../types/task-analyzer";

/**
 * Intelligent Task Analyzer
 *
 * Automatically analyzes complex tasks and breaks them down into:
 * - Logical subtasks with dependencies
 * - Optimal agent assignments
 * - Required tool executions
 * - Context gathering needs
 * - Memory lookups for similar past tasks
 */
export class IntelligentTaskAnalyzer {
  private memoryManager: TaskAnalysisMemoryManager;
  private contextManager: ContextManager;

  // Task patterns learned from experience
  private taskPatterns = new Map<string, TaskPattern>();

  // Agent capabilities for optimal assignment
  private agentCapabilities = {
    "architect-agent": [
      "system-design",
      "api-design",
      "database-design",
      "architecture-planning",
      "ddd-practices",
    ],
    "coder-agent": [
      "implementation",
      "refactoring",
      "bug-fixing",
      "feature-development",
      "tdd-practices",
    ],
    "tester-agent": [
      "unit-testing",
      "integration-testing",
      "test-generation",
      "coverage-analysis",
      "tdd-practices",
      "tdd-validation",
    ],
    "researcher-agent": [
      "code-analysis",
      "dependency-analysis",
      "best-practices",
      "pattern-discovery",
    ],
    "security-agent": [
      "vulnerability-scanning",
      "security-audit",
      "threat-modeling",
      "compliance-check",
    ],
    "documentation-agent": [
      "api-docs",
      "user-guides",
      "technical-specs",
      "readme-generation",
      "ddd-practices",
      "ddd-validation",
      "technical-writing",
    ],
    "optimization-agent": [
      "performance-tuning",
      "memory-optimization",
      "build-optimization",
      "algorithm-improvement",
    ],
    "production-readiness": [
      "production-check",
      "deployment-ready",
      "quality-assurance",
      "tdd-validation",
      "ddd-validation",
    ],
    "tdd-enforcement": [
      "tdd-practices",
      "test-first-validation",
      "test-execution",
      "tdd-validation",
    ],
    "ddd-enforcement": [
      "ddd-practices",
      "documentation-first",
      "technical-writing",
      "ddd-validation",
    ],
    "build-check": ["compilation", "dependency-check", "build-validation"],
    "format-check": ["code-formatting", "linting", "style-guide"],
  };

  // Tool mappings for automatic execution
  private toolMappings = {
    "file-analysis": ["Read", "Grep", "Glob"],
    "code-search": ["Grep", "Glob", "Task"],
    "file-modification": ["Edit", "MultiEdit", "Write"],
    "system-commands": ["Bash"],
    "web-research": ["WebSearch", "WebFetch"],
    documentation: ["Read", "Write"],
    testing: ["Bash", "Read"],
    "git-operations": ["Bash"],
    "package-management": ["Bash", "Edit"],
  };

  constructor(private workspaceRoot: string) {
    this.memoryManager = getMemoryManager(workspaceRoot);
    this.contextManager = new ContextManager(workspaceRoot);
    this.loadLearnedPatterns();
  }

  /**
   * Analyze a task and break it down intelligently
   */
  async analyzeTask(task: string | HiveMindTask): Promise<TaskAnalysisResult> {
    const taskDescription = typeof task === "string" ? task : task.description;
    log.info("Analyzing task for intelligent decomposition", {
      task: taskDescription,
    });

    try {
      // Step 1: Understand task intent and complexity
      const intent = await this.analyzeTaskIntent(taskDescription);

      // Step 2: Search memory for similar past tasks
      const similarTasks = await this.findSimilarTasks(taskDescription, intent);

      // Step 3: Gather relevant context
      const context = await this.gatherTaskContext(taskDescription, intent);

      // Step 4: Determine required capabilities
      const requiredCapabilities = this.determineRequiredCapabilities(
        intent,
        context,
      );

      // Step 5: Break down into subtasks
      const subtasks = await this.decomposeIntoSubtasks(
        taskDescription,
        intent,
        context,
        requiredCapabilities,
        similarTasks,
      );

      // Step 6: Assign optimal agents
      const assignments = this.assignAgentsToSubtasks(subtasks);

      // Step 7: Determine tool requirements
      const toolRequirements = this.determineToolRequirements(subtasks);

      // Step 8: Create execution plan
      const executionPlan = this.createExecutionPlan(
        subtasks,
        assignments,
        toolRequirements,
      );

      // Step 9: Learn from this analysis
      await this.learnFromAnalysis(
        taskDescription,
        intent,
        subtasks,
        executionPlan,
      );

      return {
        originalTask: taskDescription,
        intent,
        complexity: this.calculateComplexity(subtasks),
        subtasks,
        assignments,
        toolRequirements,
        executionPlan,
        estimatedDuration: this.estimateDuration(subtasks),
        confidence: this.calculateConfidence(intent, similarTasks),
      };
    } catch (error) {
      log.error("Task analysis failed", error as Error);
      throw error;
    }
  }

  /**
   * Analyze task intent using NLP-like parsing
   */
  private async analyzeTaskIntent(
    taskDescription: string,
  ): Promise<TaskIntent> {
    const lowerTask = taskDescription.toLowerCase();
    const words = lowerTask.split(/\s+/);

    // Detect primary action
    const actionKeywords = {
      create: ["create", "add", "implement", "build", "develop", "make"],
      fix: ["fix", "repair", "resolve", "debug", "correct", "patch"],
      improve: ["improve", "enhance", "optimize", "refactor", "upgrade"],
      analyze: ["analyze", "investigate", "research", "examine", "study"],
      test: ["test", "verify", "validate", "check", "ensure"],
      document: ["document", "describe", "explain", "write"],
      deploy: ["deploy", "release", "publish", "ship"],
      configure: ["configure", "setup", "install", "initialize"],
    };

    let primaryAction = "general";
    for (const [action, keywords] of Object.entries(actionKeywords)) {
      if (keywords.some((keyword) => words.includes(keyword))) {
        primaryAction = action;
        break;
      }
    }

    // Detect target type
    const targetKeywords = {
      feature: ["feature", "functionality", "capability"],
      component: ["component", "module", "service", "class"],
      api: ["api", "endpoint", "route", "interface"],
      database: ["database", "table", "schema", "migration"],
      ui: ["ui", "interface", "frontend", "component", "page"],
      test: ["test", "spec", "coverage"],
      documentation: ["documentation", "docs", "readme", "guide"],
      configuration: ["config", "settings", "environment"],
      security: ["security", "authentication", "authorization", "encryption"],
      performance: ["performance", "speed", "optimization", "cache"],
    };

    let targetType = "general";
    for (const [target, keywords] of Object.entries(targetKeywords)) {
      if (keywords.some((keyword) => lowerTask.includes(keyword))) {
        targetType = target;
        break;
      }
    }

    // Detect scope
    const scopeIndicators = {
      entire: ["entire", "all", "whole", "complete", "full"],
      specific: ["specific", "particular", "single", "one"],
      multiple: ["multiple", "several", "various", "many"],
    };

    let scope = "specific";
    for (const [s, keywords] of Object.entries(scopeIndicators)) {
      if (keywords.some((keyword) => words.includes(keyword))) {
        scope = s;
        break;
      }
    }

    // Extract entities (files, classes, functions mentioned)
    const entities = this.extractEntities(taskDescription);

    // Determine urgency
    const urgency = this.determineUrgency(taskDescription);

    return {
      primaryAction,
      targetType,
      scope,
      entities,
      urgency,
      requiresNewCode: actionKeywords.create.some((k) => words.includes(k)),
      requiresAnalysis: actionKeywords.analyze.some((k) => words.includes(k)),
      requiresTesting:
        targetType !== "test" &&
        (actionKeywords.create.some((k) => words.includes(k)) ||
          actionKeywords.fix.some((k) => words.includes(k))),
      requiresDocumentation:
        targetType !== "documentation" &&
        actionKeywords.create.some((k) => words.includes(k)),
    };
  }

  /**
   * Find similar tasks from memory
   */
  private async findSimilarTasks(
    taskDescription: string,
    intent: TaskIntent,
  ): Promise<SimilarTask[]> {
    try {
      // Search memory for similar task patterns
      const searchKey = `${intent.primaryAction}_${intent.targetType}`;
      const similarPatterns =
        (await this.memoryManager.searchPatterns?.(searchKey)) || [];

      // Also search by task description similarity
      const textSimilar =
        (await this.memoryManager.searchSimilarTasks?.(taskDescription)) || [];

      // Combine and rank by relevance
      const allSimilar = [...similarPatterns, ...textSimilar];

      return allSimilar
        .map((task) => ({
          task,
          similarity: this.calculateSimilarity(
            taskDescription,
            task.description || "",
          ),
          successful: task.success || false,
          subtasks: task.subtasks || [],
          duration: task.duration || 0,
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);
    } catch (error) {
      log.warn("Failed to find similar tasks", error as Error);
      return [];
    }
  }

  /**
   * Gather relevant context for the task
   */
  private async gatherTaskContext(
    taskDescription: string,
    intent: TaskIntent,
  ): Promise<TaskContext> {
    const context: TaskContext = {
      files: [],
      dependencies: [],
      relatedCode: [],
      testFiles: [],
      documentation: [],
      configuration: {},
    };

    try {
      // Find relevant files based on entities
      if (intent.entities.length > 0) {
        for (const entity of intent.entities) {
          // Search for files containing the entity
          const files = await vscode.workspace.findFiles(
            `**/*${entity}*`,
            "**/node_modules/**",
          );
          context.files.push(...files.map((f) => f.fsPath));
        }
      }

      // Find test files if testing is required
      if (intent.requiresTesting) {
        const testFiles = await vscode.workspace.findFiles(
          "**/*.{test,spec}.{ts,js,tsx,jsx}",
          "**/node_modules/**",
        );
        context.testFiles = testFiles.map((f) => f.fsPath);
      }

      // Find documentation files
      const docFiles = await vscode.workspace.findFiles(
        "**/{README,readme,*.md}",
        "**/node_modules/**",
      );
      context.documentation = docFiles.map((f) => f.fsPath);

      // Load package.json for dependencies
      const packageJsonPath = path.join(this.workspaceRoot, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8"),
        );
        context.dependencies = [
          ...Object.keys(packageJson.dependencies || {}),
          ...Object.keys(packageJson.devDependencies || {}),
        ];
      }

      // Get workspace configuration
      context.configuration = {
        language: await this.detectPrimaryLanguage(),
        framework: await this.detectFramework(),
        testFramework: await this.detectTestFramework(),
        buildTool: await this.detectBuildTool(),
      };
    } catch (error) {
      log.warn("Failed to gather complete context", error as Error);
    }

    return context;
  }

  /**
   * Determine required capabilities based on task analysis
   */
  private determineRequiredCapabilities(
    intent: TaskIntent,
    context: TaskContext,
  ): string[] {
    const capabilities = new Set<string>();

    // Based on primary action
    switch (intent.primaryAction) {
      case "create":
        capabilities.add("architecture-planning");
        capabilities.add("implementation");
        capabilities.add("test-generation");
        capabilities.add("documentation");
        break;
      case "fix":
        capabilities.add("code-analysis");
        capabilities.add("bug-fixing");
        capabilities.add("test-generation");
        break;
      case "improve":
        capabilities.add("code-analysis");
        capabilities.add("refactoring");
        capabilities.add("performance-tuning");
        break;
      case "analyze":
        capabilities.add("code-analysis");
        capabilities.add("dependency-analysis");
        capabilities.add("pattern-discovery");
        break;
      case "test":
        capabilities.add("test-generation");
        capabilities.add("coverage-analysis");
        break;
      case "document":
        capabilities.add("documentation");
        capabilities.add("api-docs");
        break;
    }

    // Based on target type
    switch (intent.targetType) {
      case "api":
        capabilities.add("api-design");
        capabilities.add("api-docs");
        break;
      case "database":
        capabilities.add("database-design");
        break;
      case "security":
        capabilities.add("security-audit");
        capabilities.add("vulnerability-scanning");
        break;
      case "performance":
        capabilities.add("performance-tuning");
        capabilities.add("memory-optimization");
        break;
    }

    // Always include production readiness
    capabilities.add("production-check");

    return Array.from(capabilities);
  }

  /**
   * Decompose task into logical subtasks
   */
  private async decomposeIntoSubtasks(
    taskDescription: string,
    intent: TaskIntent,
    context: TaskContext,
    requiredCapabilities: string[],
    similarTasks: SimilarTask[],
  ): Promise<Subtask[]> {
    const subtasks: Subtask[] = [];

    // Learn from similar successful tasks
    if (similarTasks.length > 0 && similarTasks[0].similarity > 0.7) {
      const bestMatch = similarTasks[0];
      if (bestMatch.successful && bestMatch.subtasks.length > 0) {
        log.info("Using successful pattern from similar task", {
          similarity: bestMatch.similarity,
        });
        // Adapt the subtasks to current context
        return this.adaptSubtasksFromPattern(
          bestMatch.subtasks,
          intent,
          context,
        );
      }
    }

    // Generate subtasks based on intent and capabilities
    let order = 1;

    // CRITICAL: Document-Driven Development - Documentation MUST come first
    if (intent.requiresDocumentation || intent.requiresNewCode) {
      subtasks.push({
        id: `subtask-${Date.now()}-${order++}`,
        description: `Create comprehensive documentation for ${intent.targetType}`,
        type: "documentation",
        requiredCapabilities: [
          "documentation",
          "api-docs",
          "technical-writing",
        ],
        dependencies: [],
        estimatedDuration: 600,
        priority: TaskPriority.CRITICAL,
        context: {
          dddEnforcement: true,
          includeArchitecture: true,
          includeAPIContracts: true,
          includeExamples: true,
          includeErrorHandling: true,
          targetType: intent.targetType,
        },
      });
    }

    // CRITICAL: Test-Driven Development - Tests MUST come before implementation
    if (
      intent.requiresTesting ||
      intent.requiresNewCode ||
      intent.primaryAction === "fix"
    ) {
      const docDeps = subtasks
        .filter((s) => s.type === "documentation")
        .map((s) => s.id);
      subtasks.push({
        id: `subtask-${Date.now()}-${order++}`,
        description: `Write comprehensive failing tests for ${intent.targetType}`,
        type: "testing",
        requiredCapabilities: [
          "test-generation",
          "coverage-analysis",
          "tdd-practices",
        ],
        dependencies: docDeps, // Tests depend on documentation
        estimatedDuration: 900,
        priority: TaskPriority.CRITICAL,
        context: {
          tddEnforcement: true,
          mustFailFirst: true,
          minimumCoverage: 90,
          includeUnitTests: true,
          includeIntegrationTests: true,
          includeEdgeCases: true,
          targetType: intent.targetType,
          testFramework: context.configuration.testFramework,
        },
      });
    }

    // 1. Analysis phase (if needed)
    if (intent.requiresAnalysis || intent.primaryAction === "analyze") {
      subtasks.push({
        id: `subtask-${Date.now()}-${order++}`,
        description: `Analyze existing ${intent.targetType} implementation and structure`,
        type: "analysis",
        requiredCapabilities: ["code-analysis", "pattern-discovery"],
        dependencies: [],
        estimatedDuration: 300,
        priority: TaskPriority.HIGH,
        context: {
          files: context.files,
          targetType: intent.targetType,
        },
      });
    }

    // 2. Design phase (for new features)
    if (intent.requiresNewCode && intent.targetType !== "test") {
      const designTaskId = `subtask-${Date.now()}-${order++}`;
      subtasks.push({
        id: designTaskId,
        description: `Design ${intent.targetType} architecture and interfaces`,
        type: "design",
        requiredCapabilities: ["architecture-planning", "api-design"],
        dependencies:
          subtasks.length > 0 ? [subtasks[subtasks.length - 1].id] : [],
        estimatedDuration: 600,
        priority: TaskPriority.HIGH,
        context: {
          targetType: intent.targetType,
          scope: intent.scope,
        },
      });
    }

    // 3. Implementation phase - ONLY after documentation and tests
    if (
      intent.primaryAction === "create" ||
      intent.primaryAction === "fix" ||
      intent.primaryAction === "improve"
    ) {
      // Implementation MUST depend on both documentation and tests (TDD/DDD enforcement)
      const docTestDeps = subtasks
        .filter((s) => s.type === "documentation" || s.type === "testing")
        .map((s) => s.id);

      // Break down by entities if multiple
      if (intent.entities.length > 1) {
        for (const entity of intent.entities) {
          subtasks.push({
            id: `subtask-${Date.now()}-${order++}`,
            description: `Implement ${entity} following TDD principles`,
            type: "implementation",
            requiredCapabilities: [
              "implementation",
              "refactoring",
              "tdd-practices",
            ],
            dependencies: docTestDeps, // CRITICAL: Must have docs and tests first
            estimatedDuration: 900,
            priority: TaskPriority.HIGH,
            context: {
              entity,
              action: intent.primaryAction,
              tddEnforcement: true,
              requiresPassingTests: true,
              blockedWithoutTests: true,
              blockedWithoutDocs: true,
            },
          });
        }
      } else {
        subtasks.push({
          id: `subtask-${Date.now()}-${order++}`,
          description: `Implement ${intent.targetType} following TDD/DDD principles`,
          type: "implementation",
          requiredCapabilities: [
            "implementation",
            "bug-fixing",
            "tdd-practices",
          ],
          dependencies: docTestDeps, // CRITICAL: Must have docs and tests first
          estimatedDuration: 1200,
          priority: TaskPriority.HIGH,
          context: {
            action: intent.primaryAction,
            targetType: intent.targetType,
            tddEnforcement: true,
            requiresPassingTests: true,
            blockedWithoutTests: true,
            blockedWithoutDocs: true,
          },
        });
      }
    }

    // 4. Test validation phase - Ensure tests pass after implementation
    if (intent.requiresTesting || intent.requiresNewCode) {
      const implTasks = subtasks.filter((s) => s.type === "implementation");
      const testValidationDeps =
        implTasks.length > 0 ? implTasks.map((s) => s.id) : [];

      if (testValidationDeps.length > 0) {
        subtasks.push({
          id: `subtask-${Date.now()}-${order++}`,
          description: `Validate all tests pass and meet coverage requirements`,
          type: "test-validation",
          requiredCapabilities: [
            "test-execution",
            "coverage-analysis",
            "tdd-validation",
          ],
          dependencies: testValidationDeps,
          estimatedDuration: 300,
          priority: TaskPriority.HIGH,
          context: {
            validateTDD: true,
            minimumCoverage: 90,
            mustPass: true,
            targetType: intent.targetType,
            testFramework: context.configuration.testFramework,
          },
        });
      }
    }

    // 5. Security check (if applicable)
    if (
      intent.targetType === "security" ||
      intent.targetType === "api" ||
      requiredCapabilities.includes("security-audit")
    ) {
      subtasks.push({
        id: `subtask-${Date.now()}-${order++}`,
        description: `Perform security audit and vulnerability scan`,
        type: "security",
        requiredCapabilities: ["security-audit", "vulnerability-scanning"],
        dependencies: subtasks
          .filter((s) => s.type === "implementation")
          .map((s) => s.id),
        estimatedDuration: 400,
        priority: TaskPriority.HIGH,
        context: {},
      });
    }

    // 6. Performance optimization (if needed)
    if (
      intent.targetType === "performance" ||
      intent.primaryAction === "improve"
    ) {
      subtasks.push({
        id: `subtask-${Date.now()}-${order++}`,
        description: `Optimize performance and memory usage`,
        type: "optimization",
        requiredCapabilities: ["performance-tuning", "memory-optimization"],
        dependencies: subtasks
          .filter((s) => s.type === "implementation")
          .map((s) => s.id),
        estimatedDuration: 600,
        priority: TaskPriority.MEDIUM,
        context: {},
      });
    }

    // 7. Documentation validation phase - Ensure docs are complete and accurate
    if (intent.requiresDocumentation || intent.requiresNewCode) {
      const implTasks = subtasks.filter((s) => s.type === "implementation");
      const docValidationDeps =
        implTasks.length > 0 ? implTasks.map((s) => s.id) : [];

      if (docValidationDeps.length > 0) {
        subtasks.push({
          id: `subtask-${Date.now()}-${order++}`,
          description: `Validate and update documentation accuracy`,
          type: "documentation-validation",
          requiredCapabilities: ["documentation", "api-docs", "ddd-validation"],
          dependencies: docValidationDeps,
          estimatedDuration: 300,
          priority: TaskPriority.MEDIUM,
          context: {
            validateDDD: true,
            ensureAccuracy: true,
            updateExamples: true,
            targetType: intent.targetType,
            files: context.files,
          },
        });
      }
    }

    // 8. Production readiness check (always last)
    subtasks.push({
      id: `subtask-${Date.now()}-${order++}`,
      description: `Validate production readiness and code quality`,
      type: "validation",
      requiredCapabilities: ["production-check", "quality-assurance"],
      dependencies: subtasks.map((s) => s.id),
      estimatedDuration: 200,
      priority: TaskPriority.CRITICAL,
      context: {},
    });

    return subtasks;
  }

  /**
   * Assign optimal agents to subtasks
   */
  private assignAgentsToSubtasks(subtasks: Subtask[]): AgentAssignment[] {
    const assignments: AgentAssignment[] = [];

    for (const subtask of subtasks) {
      const agentScores = new Map<string, number>();

      // Score each agent based on capability match
      for (const [agentId, capabilities] of Object.entries(
        this.agentCapabilities,
      )) {
        let score = 0;

        for (const required of subtask.requiredCapabilities) {
          if (capabilities.includes(required)) {
            score += 10;
          }
        }

        // Bonus for specialized agents
        if (subtask.type === "testing" && agentId === "tester-agent")
          score += 5;
        if (subtask.type === "design" && agentId === "architect-agent")
          score += 5;
        if (subtask.type === "implementation" && agentId === "coder-agent")
          score += 5;
        if (
          subtask.type === "documentation" &&
          agentId === "documentation-agent"
        )
          score += 5;
        if (subtask.type === "security" && agentId === "security-agent")
          score += 5;
        if (subtask.type === "optimization" && agentId === "optimization-agent")
          score += 5;
        if (subtask.type === "validation" && agentId === "production-readiness")
          score += 5;

        if (score > 0) {
          agentScores.set(agentId, score);
        }
      }

      // Select top agents
      const sortedAgents = Array.from(agentScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2); // Primary and backup

      if (sortedAgents.length > 0) {
        assignments.push({
          subtaskId: subtask.id,
          primaryAgent: sortedAgents[0][0],
          backupAgent: sortedAgents[1]?.[0],
          confidence:
            sortedAgents[0][1] / (subtask.requiredCapabilities.length * 10),
        });
      }
    }

    return assignments;
  }

  /**
   * Determine which tools are needed for subtasks
   */
  private determineToolRequirements(subtasks: Subtask[]): ToolRequirement[] {
    const requirements: ToolRequirement[] = [];

    for (const subtask of subtasks) {
      const tools = new Set<string>();

      // Based on subtask type
      switch (subtask.type) {
        case "analysis":
          tools.add("Read");
          tools.add("Grep");
          tools.add("Glob");
          tools.add("Task"); // For deep analysis
          break;

        case "design":
          tools.add("Write"); // For creating design docs
          tools.add("Read"); // For reading existing code
          break;

        case "implementation":
          tools.add("Read");
          tools.add("Edit");
          tools.add("MultiEdit");
          tools.add("Write");
          tools.add("Bash"); // For running commands
          break;

        case "testing":
          tools.add("Write"); // For creating tests
          tools.add("Bash"); // For running tests
          tools.add("Read");
          break;

        case "security":
          tools.add("Bash"); // For security tools
          tools.add("Grep"); // For pattern search
          tools.add("Read");
          break;

        case "optimization":
          tools.add("Read");
          tools.add("Edit");
          tools.add("Bash"); // For profiling
          break;

        case "documentation":
          tools.add("Read");
          tools.add("Write");
          tools.add("MultiEdit");
          break;

        case "validation":
          tools.add("Bash"); // For build/test
          tools.add("Grep"); // For validation
          break;
      }

      // Add web tools if research is needed
      if (
        subtask.requiredCapabilities.includes("best-practices") ||
        subtask.requiredCapabilities.includes("pattern-discovery")
      ) {
        tools.add("WebSearch");
        tools.add("WebFetch");
      }

      requirements.push({
        subtaskId: subtask.id,
        requiredTools: Array.from(tools),
        toolSequence: this.determineToolSequence(
          subtask.type,
          Array.from(tools),
        ),
      });
    }

    return requirements;
  }

  /**
   * Create optimal execution plan
   */
  private createExecutionPlan(
    subtasks: Subtask[],
    assignments: AgentAssignment[],
    toolRequirements: ToolRequirement[],
  ): ExecutionPlan {
    // Group subtasks by dependencies to create phases
    const phases: ExecutionPhase[] = [];
    const processed = new Set<string>();

    while (processed.size < subtasks.length) {
      const phase: ExecutionPhase = {
        tasks: [],
        parallelizable: true,
        estimatedDuration: 0,
      };

      // Find tasks with no unprocessed dependencies
      for (const subtask of subtasks) {
        if (!processed.has(subtask.id)) {
          const depsProcessed = subtask.dependencies.every((dep) =>
            processed.has(dep),
          );
          if (depsProcessed) {
            const assignment = assignments.find(
              (a) => a.subtaskId === subtask.id,
            );
            const tools = toolRequirements.find(
              (t) => t.subtaskId === subtask.id,
            );

            phase.tasks.push({
              subtask,
              agent: assignment?.primaryAgent || "coder-agent",
              tools: tools?.requiredTools || [],
              parallel: true, // Can be optimized based on resource constraints
            });

            processed.add(subtask.id);
          }
        }
      }

      if (phase.tasks.length > 0) {
        // Calculate phase duration (max of parallel tasks)
        phase.estimatedDuration = Math.max(
          ...phase.tasks.map((t) => t.subtask.estimatedDuration),
        );
        phases.push(phase);
      }
    }

    return {
      phases,
      totalDuration: phases.reduce((sum, p) => sum + p.estimatedDuration, 0),
      parallelOpportunities: phases.filter((p) => p.tasks.length > 1).length,
      criticalPath: this.findCriticalPath(subtasks),
    };
  }

  /**
   * Helper methods
   */

  private extractEntities(taskDescription: string): string[] {
    const entities: string[] = [];

    // Extract quoted strings
    const quotedMatches = taskDescription.match(/["']([^"']+)["']/g);
    if (quotedMatches) {
      entities.push(...quotedMatches.map((m) => m.slice(1, -1)));
    }

    // Extract PascalCase (class names)
    const pascalMatches = taskDescription.match(
      /\b[A-Z][a-zA-Z]+(?:[A-Z][a-zA-Z]+)*\b/g,
    );
    if (pascalMatches) {
      entities.push(...pascalMatches);
    }

    // Extract file paths
    const pathMatches = taskDescription.match(/[\w/]+\.\w+/g);
    if (pathMatches) {
      entities.push(...pathMatches);
    }

    return [...new Set(entities)]; // Remove duplicates
  }

  private determineUrgency(
    taskDescription: string,
  ): "low" | "medium" | "high" | "critical" {
    const lower = taskDescription.toLowerCase();

    if (
      lower.includes("urgent") ||
      lower.includes("asap") ||
      lower.includes("critical")
    ) {
      return "critical";
    } else if (lower.includes("important") || lower.includes("high priority")) {
      return "high";
    } else if (
      lower.includes("when possible") ||
      lower.includes("low priority")
    ) {
      return "low";
    }

    return "medium";
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple word-based similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private async detectPrimaryLanguage(): Promise<string> {
    const files = await vscode.workspace.findFiles(
      "**/*.{ts,js,py,java,cs,go,rs,cpp,c}",
      "**/node_modules/**",
      100,
    );

    const extensions = files.map((f) => path.extname(f.fsPath));
    const counts = extensions.reduce(
      (acc, ext) => {
        acc[ext] = (acc[ext] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || ".ts";
  }

  private async detectFramework(): Promise<string> {
    const packageJsonPath = path.join(this.workspaceRoot, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (deps.react) return "react";
      if (deps.vue) return "vue";
      if (deps.angular) return "angular";
      if (deps.express) return "express";
      if (deps.nestjs) return "nestjs";
    }

    return "unknown";
  }

  private async detectTestFramework(): Promise<string> {
    const packageJsonPath = path.join(this.workspaceRoot, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (deps.jest) return "jest";
      if (deps.mocha) return "mocha";
      if (deps.vitest) return "vitest";
      if (deps.jasmine) return "jasmine";
    }

    return "jest"; // default
  }

  private async detectBuildTool(): Promise<string> {
    if (fs.existsSync(path.join(this.workspaceRoot, "webpack.config.js")))
      return "webpack";
    if (fs.existsSync(path.join(this.workspaceRoot, "vite.config.js")))
      return "vite";
    if (fs.existsSync(path.join(this.workspaceRoot, "rollup.config.js")))
      return "rollup";
    if (fs.existsSync(path.join(this.workspaceRoot, "esbuild.js")))
      return "esbuild";

    return "npm";
  }

  private calculateComplexity(
    subtasks: Subtask[],
  ): "low" | "medium" | "high" | "very-high" {
    const score =
      subtasks.length * 10 +
      subtasks.filter((s) => s.priority === TaskPriority.CRITICAL).length * 20 +
      subtasks.filter((s) => s.type === "implementation").length * 15;

    if (score < 30) return "low";
    if (score < 60) return "medium";
    if (score < 100) return "high";
    return "very-high";
  }

  private estimateDuration(subtasks: Subtask[]): number {
    // Consider parallel execution
    const phases = this.groupByDependencies(subtasks);
    return phases.reduce((total, phase) => {
      const maxDuration = Math.max(...phase.map((s) => s.estimatedDuration));
      return total + maxDuration;
    }, 0);
  }

  private groupByDependencies(subtasks: Subtask[]): Subtask[][] {
    const phases: Subtask[][] = [];
    const processed = new Set<string>();

    while (processed.size < subtasks.length) {
      const phase: Subtask[] = [];

      for (const subtask of subtasks) {
        if (!processed.has(subtask.id)) {
          const depsProcessed = subtask.dependencies.every((dep) =>
            processed.has(dep),
          );
          if (depsProcessed) {
            phase.push(subtask);
            processed.add(subtask.id);
          }
        }
      }

      if (phase.length > 0) {
        phases.push(phase);
      }
    }

    return phases;
  }

  private calculateConfidence(
    intent: TaskIntent,
    similarTasks: SimilarTask[],
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on clarity of intent
    if (intent.primaryAction !== "general") confidence += 0.1;
    if (intent.targetType !== "general") confidence += 0.1;
    if (intent.entities.length > 0) confidence += 0.1;

    // Increase confidence based on similar successful tasks
    if (similarTasks.length > 0) {
      const bestSimilarity = similarTasks[0].similarity;
      confidence += bestSimilarity * 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  private determineToolSequence(taskType: string, tools: string[]): string[] {
    // Define optimal tool sequences for different task types
    const sequences: Record<string, string[]> = {
      analysis: ["Glob", "Read", "Grep", "Task"],
      design: ["Read", "Write"],
      implementation: ["Read", "Edit", "MultiEdit", "Write", "Bash"],
      testing: ["Write", "Bash", "Read"],
      security: ["Grep", "Read", "Bash"],
      optimization: ["Read", "Bash", "Edit"],
      documentation: ["Read", "Write", "MultiEdit"],
      validation: ["Bash", "Grep"],
    };

    const sequence = sequences[taskType] || tools;
    return sequence.filter((tool) => tools.includes(tool));
  }

  private adaptSubtasksFromPattern(
    patternSubtasks: PatternSubtask[],
    intent: TaskIntent,
    context: TaskContext,
  ): Subtask[] {
    // Adapt learned patterns to current context
    return patternSubtasks.map((pattern, index) => ({
      id: `subtask-${Date.now()}-${index + 1}`,
      description: pattern.description.replace(
        /\{target\}/g,
        intent.targetType,
      ),
      type: pattern.type,
      requiredCapabilities: pattern.requiredCapabilities,
      dependencies: pattern.dependencies,
      estimatedDuration: pattern.estimatedDuration || 600,
      priority: pattern.priority || TaskPriority.MEDIUM,
      context: {
        ...pattern.context,
        ...context,
      },
    }));
  }

  private findCriticalPath(subtasks: Subtask[]): string[] {
    // Simple critical path - longest dependency chain
    const paths: string[][] = [];

    // Find all leaf nodes (no dependents)
    const leaves = subtasks.filter(
      (s) => !subtasks.some((other) => other.dependencies.includes(s.id)),
    );

    for (const leaf of leaves) {
      const path = this.tracePath(leaf, subtasks);
      paths.push(path);
    }

    // Return longest path
    return paths.reduce(
      (longest, current) =>
        current.length > longest.length ? current : longest,
      [],
    );
  }

  private tracePath(task: Subtask, allTasks: Subtask[]): string[] {
    const path = [task.id];

    if (task.dependencies.length > 0) {
      // Follow the dependency with longest path
      let longestDepPath: string[] = [];

      for (const depId of task.dependencies) {
        const depTask = allTasks.find((t) => t.id === depId);
        if (depTask) {
          const depPath = this.tracePath(depTask, allTasks);
          if (depPath.length > longestDepPath.length) {
            longestDepPath = depPath;
          }
        }
      }

      path.push(...longestDepPath);
    }

    return path;
  }

  private async loadLearnedPatterns(): Promise<void> {
    try {
      const patterns = await this.memoryManager.getLearnedPatterns?.();
      if (patterns) {
        for (const pattern of patterns) {
          this.taskPatterns.set(pattern.key, pattern);
        }
      }
    } catch (error) {
      log.warn("Failed to load learned patterns", error as Error);
    }
  }

  private async learnFromAnalysis(
    taskDescription: string,
    intent: TaskIntent,
    subtasks: Subtask[],
    executionPlan: ExecutionPlan,
  ): Promise<void> {
    try {
      const pattern: TaskPattern = {
        key: `${intent.primaryAction}_${intent.targetType}`,
        description: taskDescription,
        intent,
        subtaskPattern: subtasks.map((s) => ({
          type: s.type,
          description: s.description,
          requiredCapabilities: s.requiredCapabilities,
          dependencies: s.dependencies,
          estimatedDuration: s.estimatedDuration,
          priority: s.priority,
        })),
        executionPlan: {
          phaseCount: executionPlan.phases.length,
          totalDuration: executionPlan.totalDuration,
          parallelOpportunities: executionPlan.parallelOpportunities,
        },
        timestamp: Date.now(),
      };

      await this.memoryManager.learnPattern?.(pattern);
      this.taskPatterns.set(pattern.key, pattern);
    } catch (error) {
      log.warn("Failed to learn from analysis", error as Error);
    }
  }
}

// Type definitions

interface TaskContext {
  files: string[];
  dependencies: string[];
  relatedCode: string[];
  testFiles: string[];
  documentation: string[];
  configuration: TaskContextConfiguration;
}

interface SimilarTask {
  task: TaskAnalysisPattern;
  similarity: number;
  successful: boolean;
  subtasks: PatternSubtask[];
  duration: number;
}

interface Subtask {
  id: string;
  description: string;
  type:
    | "analysis"
    | "design"
    | "implementation"
    | "testing"
    | "security"
    | "optimization"
    | "documentation"
    | "validation";
  requiredCapabilities: string[];
  dependencies: string[];
  estimatedDuration: number;
  priority: TaskPriority;
  context: SubtaskContext;
}

interface AgentAssignment {
  subtaskId: string;
  primaryAgent: string;
  backupAgent?: string;
  confidence: number;
}

interface ToolRequirement {
  subtaskId: string;
  requiredTools: string[];
  toolSequence: string[];
}

interface ExecutionPhase {
  tasks: {
    subtask: Subtask;
    agent: string;
    tools: string[];
    parallel: boolean;
  }[];
  parallelizable: boolean;
  estimatedDuration: number;
}

interface ExecutionPlan {
  phases: ExecutionPhase[];
  totalDuration: number;
  parallelOpportunities: number;
  criticalPath: string[];
}


export interface TaskAnalysisResult {
  originalTask: string;
  intent: TaskIntent;
  complexity: "low" | "medium" | "high" | "very-high";
  subtasks: Subtask[];
  assignments: AgentAssignment[];
  toolRequirements: ToolRequirement[];
  executionPlan: ExecutionPlan;
  estimatedDuration: number;
  confidence: number;
}
