import * as vscode from "vscode";
import { log } from "../utils/productionLogger";
import { Hook, HookContext, HookConfiguration } from "../agents/hivemind/types";
import { getMemoryManager } from "../memory";
import {
  ProjectContext,
  SessionData,
  SessionMemory,
  TaskPattern,
  CachedTaskResult,
  HookStatus,
  HookStatusReport,
  HookMemoryManager,
  HookTaskResult,
  HiveMindTask,
} from "../types/hooks";

/**
 * Advanced Hook System inspired by Claude Flow
 * Provides automated pre/post operation hooks for enhanced workflow
 */
export class AdvancedHookSystem {
  private static instance: AdvancedHookSystem;
  private hooks: HookConfiguration = {
    preOperation: [],
    postOperation: [],
    sessionStart: [],
    sessionEnd: [],
  };

  private constructor(private workspaceRoot: string) {
    this.initializeDefaultHooks();
  }

  static getInstance(workspaceRoot: string): AdvancedHookSystem {
    if (!AdvancedHookSystem.instance) {
      AdvancedHookSystem.instance = new AdvancedHookSystem(workspaceRoot);
    }
    return AdvancedHookSystem.instance;
  }

  private initializeDefaultHooks(): void {
    // Pre-operation hooks
    this.registerHook({
      id: "auto-agent-assignment",
      name: "Automatic Agent Assignment",
      type: "pre",
      enabled: true,
      execute: async (context) => {
        if (context.task && !context.task.assignedAgent) {
          log.info("Auto-assigning agent for task", {
            taskId: context.task.id,
          });
          // Agent assignment logic will be handled by QueenAgent
        }
      },
    });

    this.registerHook({
      id: "cache-search",
      name: "Cache Search",
      type: "pre",
      enabled: true,
      execute: async (context) => {
        if (context.task) {
          const memory = getMemoryManager(this.workspaceRoot);
          // Check memory for cached results of similar tasks
          const cachedResult = await this.searchTaskCache(memory, context.task);
          if (cachedResult) {
            log.info("Found cached result for task", {
              taskId: context.task.id,
            });
            context.task.context = { ...context.task.context, cachedResult };
          }
        }
      },
    });

    this.registerHook({
      id: "context-enrichment",
      name: "Context Enrichment",
      type: "pre",
      enabled: true,
      execute: async (context) => {
        if (context.task) {
          // Enrich task context with project information
          const projectContext = await this.gatherProjectContext();
          context.task.context = { ...context.task.context, ...projectContext };
        }
      },
    });

    // Post-operation hooks
    this.registerHook({
      id: "auto-format-code",
      name: "Auto Format Code",
      type: "post",
      enabled: true,
      execute: async (context) => {
        if (context.result?.artifacts) {
          for (const artifact of context.result.artifacts) {
            if (artifact.type === "code" && artifact.path) {
              await this.formatCode(artifact.path);
            }
          }
        }
      },
    });

    this.registerHook({
      id: "pattern-learning",
      name: "Pattern Learning",
      type: "post",
      enabled: true,
      execute: async (context) => {
        if (context.task && context.result) {
          const memory = getMemoryManager(this.workspaceRoot);
          // Record pattern for future learning
          await this.recordTaskPattern(memory, context.task, context.result);
        }
      },
    });

    this.registerHook({
      id: "test-runner",
      name: "Automatic Test Runner",
      type: "post",
      enabled: true,
      execute: async (context) => {
        if (context.result?.artifacts?.some((a) => a.type === "code")) {
          await this.runRelevantTests(context);
        }
      },
    });

    // Session hooks
    this.registerHook({
      id: "session-restore",
      name: "Session Context Restore",
      type: "session",
      enabled: true,
      execute: async (context) => {
        if (context.session) {
          const memory = getMemoryManager(this.workspaceRoot);
          // Restore previous session state
          const previousSession = await this.getLastSession(memory);
          if (previousSession) {
            context.session.memory = previousSession.memory;
            log.info("Restored session context", {
              sessionId: previousSession.id,
            });
          }
        }
      },
    });

    this.registerHook({
      id: "session-summary",
      name: "Generate Session Summary",
      type: "session",
      enabled: true,
      execute: async (context) => {
        if (context.session && context.session.tasksCompleted > 0) {
          const summary = await this.generateSessionSummary(context.session);
          await this.saveSessionSummary(summary);
        }
      },
    });
  }

  registerHook(hook: Hook): void {
    const hookType =
      hook.type === "session"
        ? hook.name.includes("Start")
          ? "sessionStart"
          : "sessionEnd"
        : (`${hook.type}Operation` as keyof HookConfiguration);

    this.hooks[hookType].push(hook);
    log.info("Registered hook", { hookId: hook.id, type: hook.type });
  }

  async executePreOperationHooks(context: HookContext): Promise<void> {
    await this.executeHooks(this.hooks.preOperation, context);
  }

  async executePostOperationHooks(context: HookContext): Promise<void> {
    await this.executeHooks(this.hooks.postOperation, context);
  }

  async executeSessionStartHooks(context: HookContext): Promise<void> {
    await this.executeHooks(this.hooks.sessionStart, context);
  }

  async executeSessionEndHooks(context: HookContext): Promise<void> {
    await this.executeHooks(this.hooks.sessionEnd, context);
  }

  private async executeHooks(
    hooks: Hook[],
    context: HookContext,
  ): Promise<void> {
    for (const hook of hooks.filter((h) => h.enabled)) {
      try {
        log.debug("Executing hook", { hookId: hook.id });
        await hook.execute(context);
      } catch (error) {
        log.error(`Hook execution failed: ${hook.id}`, error as Error);
      }
    }
  }

  private async gatherProjectContext(): Promise<ProjectContext> {
    // Gather relevant project context
    const context: ProjectContext = {
      config: {},
    };

    // Get workspace configuration
    const config = vscode.workspace.getConfiguration("autoclaude");
    context.config = config;

    // Get project type
    const files = await vscode.workspace.findFiles(
      "**/package.json",
      "**/node_modules/**",
      1,
    );
    if (files.length > 0) {
      context.projectType = "node";
      const packageJson = await vscode.workspace.fs.readFile(files[0]);
      context.dependencies =
        JSON.parse(packageJson.toString()).dependencies || {};
    }

    // Get recently modified files
    const recentFiles = await vscode.workspace.findFiles(
      "**/*",
      "**/node_modules/**",
      10,
    );
    context.recentFiles = recentFiles.map((f) => f.fsPath);

    return context;
  }

  private async formatCode(filePath: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      const formatEdits = await vscode.commands.executeCommand<
        vscode.TextEdit[]
      >("vscode.executeFormatDocumentProvider", document.uri);

      if (formatEdits && formatEdits.length > 0) {
        const edit = new vscode.WorkspaceEdit();
        edit.set(document.uri, formatEdits);
        await vscode.workspace.applyEdit(edit);
        log.info("Auto-formatted code", { filePath });
      }
    } catch (error) {
      log.warn("Failed to format code", { filePath, error });
    }
  }

  private async runRelevantTests(context: HookContext): Promise<void> {
    // Find and run tests related to modified code
    const testFiles = await vscode.workspace.findFiles(
      "**/*.test.{js,ts}",
      "**/node_modules/**",
    );

    if (testFiles.length > 0) {
      const terminal = vscode.window.createTerminal("AutoClaude Tests");
      terminal.sendText("npm test");
      terminal.show();

      log.info("Running tests automatically", { testCount: testFiles.length });
    }
  }

  private async generateSessionSummary(session: SessionData): Promise<string> {
    const duration = Date.now() - session.startedAt;
    const minutes = Math.floor(duration / 60000);

    return `
# Session Summary

**Session ID**: ${session.id}
**Duration**: ${minutes} minutes
**Mode**: ${session.mode}
**Tasks Completed**: ${session.tasksCompleted}
**Active Agents**: ${session.agents.join(", ")}

## Key Accomplishments
${this.getKeyAccomplishments(session)}

## Patterns Learned
${this.getPatternsLearned(session)}

## Recommendations
${this.getRecommendations(session)}
        `.trim();
  }

  private getKeyAccomplishments(session: SessionData): string {
    // Analyze session data to extract key accomplishments
    const accomplishments = [];

    if (session.memory.filesCreated > 0) {
      accomplishments.push(
        `- Created ${session.memory.filesCreated} new files`,
      );
    }
    if (session.memory.testsAdded > 0) {
      accomplishments.push(`- Added ${session.memory.testsAdded} tests`);
    }
    if (session.memory.bugsFixed > 0) {
      accomplishments.push(`- Fixed ${session.memory.bugsFixed} bugs`);
    }

    return (
      accomplishments.join("\n") || "- No specific accomplishments tracked"
    );
  }

  private getPatternsLearned(session: SessionData): string {
    // Extract learned patterns from session
    const patterns = session.memory.patterns || [];

    if (patterns.length === 0) {
      return "- No new patterns identified";
    }

    return patterns
      .slice(0, 5)
      .map((p: TaskPattern) => `- ${p.type}: ${p.description}`)
      .join("\n");
  }

  private getRecommendations(session: SessionData): string {
    // Generate recommendations based on session analysis
    const recommendations = [];

    if (session.memory.failureRate > 0.2) {
      recommendations.push(
        "- Consider breaking down complex tasks into smaller subtasks",
      );
    }

    if (session.memory.averageTaskDuration > 600000) {
      // 10 minutes
      recommendations.push(
        "- Tasks are taking longer than expected. Review task complexity",
      );
    }

    if (session.agents.length < 3 && session.mode === "hive-mind") {
      recommendations.push(
        "- Enable more specialized agents for better task distribution",
      );
    }

    return recommendations.join("\n") || "- Continue with current approach";
  }

  private async saveSessionSummary(summary: string): Promise<void> {
    const summaryPath = vscode.Uri.joinPath(
      vscode.Uri.file(this.workspaceRoot),
      ".autoclaude",
      "sessions",
      `session-${Date.now()}.md`,
    );

    await vscode.workspace.fs.writeFile(
      summaryPath,
      Buffer.from(summary, "utf8"),
    );

    log.info("Session summary saved", { path: summaryPath.fsPath });
  }

  getHookStatus(): HookStatusReport {
    const status: HookStatusReport = {} as HookStatusReport;

    for (const [type, hooks] of Object.entries(this.hooks)) {
      status[type] = hooks.map((h: Hook) => ({
        id: h.id,
        name: h.name,
        enabled: h.enabled,
      }));
    }

    return status;
  }

  toggleHook(hookId: string, enabled: boolean): void {
    for (const hooks of Object.values(this.hooks)) {
      const hook = hooks.find((h: Hook) => h.id === hookId);
      if (hook) {
        hook.enabled = enabled;
        log.info("Hook toggled", { hookId, enabled });
        break;
      }
    }
  }

  /**
   * Search task cache for similar completed tasks
   */
  private async searchTaskCache(memory: HookMemoryManager, task: HiveMindTask): Promise<CachedTaskResult | null> {
    try {
      // Search for similar tasks in memory
      const key = `task_cache_${task.type}_${JSON.stringify(task.context || {}).substring(0, 50)}`;
      const cachedData = await memory.get?.(key);

      if (cachedData && Date.now() - cachedData.timestamp < 3600000) {
        // 1 hour cache
        log.info("Found cached task result", { taskType: task.type });
        return cachedData.result;
      }
    } catch (error) {
      log.warn("Failed to search task cache", error as Error);
    }

    return null;
  }

  /**
   * Record task pattern for learning
   */
  private async recordTaskPattern(
    memory: HookMemoryManager,
    task: HiveMindTask,
    result: HookTaskResult,
  ): Promise<void> {
    try {
      const pattern = {
        type: task.type,
        success: result.success,
        duration:
          (task.completedAt || Date.now()) - (task.startedAt || Date.now()),
        context: task.context,
        result: result.data,
        timestamp: Date.now(),
      };

      // Store pattern
      const key = `pattern_${task.type}_${Date.now()}`;
      await memory.set?.(key, pattern);

      // Also cache successful results
      if (result.success) {
        const cacheKey = `task_cache_${task.type}_${JSON.stringify(task.context || {}).substring(0, 50)}`;
        await memory.set?.(cacheKey, {
          result: result.data,
          timestamp: Date.now(),
        });
      }

      log.info("Recorded task pattern", {
        taskType: task.type,
        success: result.success,
      });
    } catch (error) {
      log.warn("Failed to record task pattern", error as Error);
    }
  }

  /**
   * Get last session state from memory
   */
  private async getLastSession(memory: HookMemoryManager): Promise<SessionData | null> {
    try {
      const sessionData = await memory.get?.("last_session_state");
      if (sessionData) {
        log.info("Restored previous session state");
        return sessionData;
      }
    } catch (error) {
      log.warn("Failed to restore session state", error as Error);
    }

    return null;
  }
}
