import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { debugLog } from "../utils/logging";
import { getMemoryManager, MemoryManager } from "../memory";
import {
  getEnhancedConfig,
  EnhancedConfigManager,
} from "../config/enhanced-config";
import { AutoClaudeError, ErrorCategory, ErrorSeverity } from "../core/errors";
import {
  HookContextMetadata,
  HookModification,
  HookResultMetadata,
  HookMemoryManager,
  HookEnhancedConfigManager,
} from "../types/hook-manager";

// Hook interfaces
export interface HookContext {
  operation: string;
  workspacePath: string;
  file?: string;
  content?: string;
  originalContent?: string;
  convertedContent?: string;
  patterns?: string[];
  metadata?: HookContextMetadata;
  timestamp: Date;
}

export interface HookResult {
  success: boolean;
  modified?: HookModification;
  error?: string;
  warnings?: string[];
  suggestions?: string[];
  metadata?: HookResultMetadata;
  executionTime?: number;
}

export interface Hook {
  id: string;
  name: string;
  operation: string;
  type: "pre" | "post";
  priority: number;
  enabled: boolean;
  blocking: boolean;
  timeout: number;
  execute(context: HookContext): Promise<HookResult>;
}

// Built-in hooks
class SyntaxValidationHook implements Hook {
  id = "syntax-validation";
  name = "Syntax Validation";
  operation = "pre-edit";
  type = "pre" as const;
  priority = 100;
  enabled = true;
  blocking = true;
  timeout = 5000;

  async execute(context: HookContext): Promise<HookResult> {
    const startTime = Date.now();

    if (!context.file || !context.content) {
      return {
        success: true,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      // Basic syntax validation based on file extension
      const ext = path.extname(context.file);

      if (ext === ".cs") {
        return this.validateCSharp(context.content);
      } else if (ext === ".rs") {
        return this.validateRust(context.content);
      }

      return {
        success: true,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `Syntax validation failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private validateCSharp(content: string): HookResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic C# syntax checks
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push("Mismatched braces in C# code");
    }

    // Check for common issues
    if (content.includes("TODO") || content.includes("FIXME")) {
      warnings.push("Code contains TODO or FIXME comments");
    }

    return {
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join("; ") : undefined,
      warnings,
    };
  }

  private validateRust(content: string): HookResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic Rust syntax checks
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push("Mismatched braces in Rust code");
    }

    // Check for unimplemented!() macros
    if (content.includes("unimplemented!()")) {
      warnings.push("Code contains unimplemented!() macros");
    }

    return {
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join("; ") : undefined,
      warnings,
    };
  }
}

class AutoFormatHook implements Hook {
  id = "auto-format";
  name = "Auto Format";
  operation = "post-edit";
  type = "post" as const;
  priority = 200;
  enabled = true;
  blocking = false;
  timeout = 15000;

  async execute(context: HookContext): Promise<HookResult> {
    const startTime = Date.now();

    if (!context.file || !context.content) {
      return {
        success: true,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      const ext = path.extname(context.file);

      if (ext === ".rs") {
        return await this.formatRust(context);
      } else if (ext === ".cs") {
        return await this.formatCSharp(context);
      }

      return {
        success: true,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `Auto formatting failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async formatRust(context: HookContext): Promise<HookResult> {
    try {
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      // Check if rustfmt is available
      await execAsync("rustfmt --version");

      // Format the code
      const result = await execAsync("rustfmt --edition 2021", {
        input: context.content,
        timeout: this.timeout,
      });

      return {
        success: true,
        modified: result.stdout,
        suggestions: ["Code formatted with rustfmt"],
      };
    } catch (error) {
      return {
        success: false,
        error: `rustfmt not available or failed: ${error instanceof Error ? error.message : String(error)}`,
        suggestions: ["Install rustfmt for automatic Rust formatting"],
      };
    }
  }

  private async formatCSharp(context: HookContext): Promise<HookResult> {
    // Basic C# formatting - could integrate with dotnet format
    const formatted = this.basicCSharpFormat(context.content!);

    return {
      success: true,
      modified: formatted,
      suggestions: ["Applied basic C# formatting"],
    };
  }

  private basicCSharpFormat(content: string): string {
    // Simple formatting rules
    return content
      .replace(/\{\s*\n/g, "{\n")
      .replace(/\n\s*\}/g, "\n}")
      .replace(/;\s*\n/g, ";\n");
  }
}

class PatternLearningHook implements Hook {
  id = "pattern-learning";
  name = "Pattern Learning";
  operation = "post-conversion";
  type = "post" as const;
  priority = 300;
  enabled = true;
  blocking = false;
  timeout = 10000;

  constructor(private memory: HookMemoryManager) {}

  async execute(context: HookContext): Promise<HookResult> {
    const startTime = Date.now();

    if (!context.originalContent || !context.convertedContent) {
      return {
        success: true,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      // Extract patterns from the conversion
      const patterns = this.extractPatterns(
        context.originalContent,
        context.convertedContent,
      );

      // Store patterns in memory
      const promises = patterns.map((pattern) =>
        this.memory.recordPattern(
          pattern.csharp,
          pattern.rust,
          pattern.type,
          pattern.confidence,
          {
            file: context.file,
            timestamp: context.timestamp.toISOString(),
          },
        ),
      );

      await Promise.all(promises);

      return {
        success: true,
        metadata: {
          patternsLearned: patterns.length,
        },
        suggestions: [`Learned ${patterns.length} new conversion patterns`],
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `Pattern learning failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private extractPatterns(
    csharpCode: string,
    rustCode: string,
  ): Array<{
    csharp: string;
    rust: string;
    type: "type" | "syntax" | "idiom" | "api";
    confidence: number;
  }> {
    const patterns: Array<{
      csharp: string;
      rust: string;
      type: "type" | "syntax" | "idiom" | "api";
      confidence: number;
    }> = [];

    // Extract class to struct patterns
    const classMatch = csharpCode.match(/public\s+class\s+(\w+)/g);
    const structMatch = rustCode.match(/pub\s+struct\s+(\w+)/g);

    if (classMatch && structMatch && classMatch.length === structMatch.length) {
      for (let i = 0; i < classMatch.length; i++) {
        patterns.push({
          csharp: classMatch[i],
          rust: structMatch[i],
          type: "syntax",
          confidence: 0.9,
        });
      }
    }

    // Extract method patterns
    const csharpMethods =
      csharpCode.match(/public\s+\w+\s+\w+\s*\([^)]*\)/g) || [];
    const rustMethods = rustCode.match(/pub\s+fn\s+\w+\s*\([^)]*\)/g) || [];

    const methodCount = Math.min(csharpMethods.length, rustMethods.length);
    for (let i = 0; i < methodCount; i++) {
      patterns.push({
        csharp: csharpMethods[i],
        rust: rustMethods[i],
        type: "syntax",
        confidence: 0.8,
      });
    }

    // Extract type patterns
    const typePatterns = [
      { csharp: "List<", rust: "Vec<", confidence: 0.95 },
      { csharp: "Dictionary<", rust: "HashMap<", confidence: 0.95 },
      { csharp: "string", rust: "String", confidence: 0.9 },
      { csharp: "int", rust: "i32", confidence: 0.95 },
      { csharp: "bool", rust: "bool", confidence: 1.0 },
    ];

    for (const typePattern of typePatterns) {
      if (
        csharpCode.includes(typePattern.csharp) &&
        rustCode.includes(typePattern.rust)
      ) {
        patterns.push({
          csharp: typePattern.csharp,
          rust: typePattern.rust,
          type: "type",
          confidence: typePattern.confidence,
        });
      }
    }

    return patterns;
  }
}

class NeoRsValidationHook implements Hook {
  id = "neo-rs-validation";
  name = "Neo-rs Validation";
  operation = "post-conversion";
  type = "post" as const;
  priority = 150;
  enabled = false; // Enabled only on neo-rs branch
  blocking = true;
  timeout = 30000;

  async execute(context: HookContext): Promise<HookResult> {
    const startTime = Date.now();

    if (!context.convertedContent) {
      return {
        success: true,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      const validationResults = await this.validateNeoRsConversion(context);

      return {
        success: validationResults.isValid,
        error: validationResults.isValid
          ? undefined
          : validationResults.errors.join("; "),
        warnings: validationResults.warnings,
        metadata: {
          apiCompatibility: validationResults.apiCompatibility,
          typeCompatibility: validationResults.typeCompatibility,
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `Neo-rs validation failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async validateNeoRsConversion(context: HookContext): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    apiCompatibility: number;
    typeCompatibility: number;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const content = context.convertedContent!;

    // Check for Neo-specific types
    const neoTypes = ["UInt160", "UInt256", "ECPoint", "StackItem"];
    let typeCompatibility = 1.0;

    for (const neoType of neoTypes) {
      if (
        context.originalContent?.includes(neoType) &&
        !content.includes(neoType)
      ) {
        errors.push(`Missing Neo type: ${neoType}`);
        typeCompatibility -= 0.1;
      }
    }

    // Check for proper error handling
    if (
      context.originalContent?.includes("try") &&
      !content.includes("Result<")
    ) {
      warnings.push("Consider using Result<T, E> for error handling in Rust");
    }

    // Check for memory safety
    if (content.includes("unsafe")) {
      warnings.push("Unsafe code detected - ensure memory safety");
    }

    // API compatibility check
    const apiCompatibility = this.calculateApiCompatibility(
      context.originalContent || "",
      content,
    );

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      apiCompatibility,
      typeCompatibility: Math.max(0, typeCompatibility),
    };
  }

  private calculateApiCompatibility(
    csharpCode: string,
    rustCode: string,
  ): number {
    // Simple API compatibility calculation
    const csharpMethods = (csharpCode.match(/public\s+\w+\s+\w+\s*\(/g) || [])
      .length;
    const rustMethods = (rustCode.match(/pub\s+fn\s+\w+\s*\(/g) || []).length;

    if (csharpMethods === 0) return 1.0;

    return Math.min(1.0, rustMethods / csharpMethods);
  }
}

export class HookManager {
  private hooks: Map<string, Hook[]> = new Map();
  private config: HookEnhancedConfigManager;
  private memory: HookMemoryManager;

  constructor(private workspacePath: string) {
    this.config = getEnhancedConfig(workspacePath) as HookEnhancedConfigManager;
    this.memory = getMemoryManager(workspacePath) as HookMemoryManager;
  }

  async initialize(): Promise<void> {
    try {
      await this.config.initialize();
      await this.memory.initialize();

      if (this.config.isHooksEnabled()) {
        await this.registerBuiltinHooks();
        await this.loadCustomHooks();

        debugLog("Hook system initialized successfully");
      } else {
        debugLog("Hook system disabled in configuration");
      }
    } catch (error) {
      debugLog(`Failed to initialize hook system: ${error}`);
      throw new AutoClaudeError(
        "HOOK_INIT_FAILED",
        `Hook system initialization failed: ${error}`,
        ErrorCategory.INTERNAL,
        ErrorSeverity.HIGH,
        { error },
        true,
        "Failed to initialize hook system",
        ["Check configuration", "Restart VS Code", "Disable hooks temporarily"],
      );
    }
  }

  private async registerBuiltinHooks(): Promise<void> {
    const config = this.config.getConfig();

    // Register syntax validation hook
    if (config.hooks.validateSyntax) {
      this.registerHook(new SyntaxValidationHook());
    }

    // Register auto format hook
    if (config.hooks.autoFormat) {
      this.registerHook(new AutoFormatHook());
    }

    // Register pattern learning hook
    if (config.hooks.learnPatterns) {
      this.registerHook(new PatternLearningHook(this.memory));
    }

    // Register Neo-rs validation hook
    if (config.neoRs.enabled && config.neoRs.strictValidation) {
      const neoRsHook = new NeoRsValidationHook();
      neoRsHook.enabled = true;
      this.registerHook(neoRsHook);
    }
  }

  private async loadCustomHooks(): Promise<void> {
    const config = this.config.getConfig();

    if (!config.hooks.customHooksPath) return;

    const hooksPath = path.resolve(
      this.workspacePath,
      config.hooks.customHooksPath,
    );

    if (!fs.existsSync(hooksPath)) return;

    try {
      const hookFiles = fs
        .readdirSync(hooksPath)
        .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));

      for (const hookFile of hookFiles) {
        const hookPath = path.join(hooksPath, hookFile);
        const hookModule = require(hookPath);

        if (hookModule.default && typeof hookModule.default === "function") {
          const customHook = new hookModule.default();
          this.registerHook(customHook);
        }
      }

      debugLog(`Loaded ${hookFiles.length} custom hooks`);
    } catch (error) {
      debugLog(`Failed to load custom hooks: ${error}`);
    }
  }

  async executeHooks(
    operation: string,
    context: Partial<HookContext>,
  ): Promise<{ success: boolean; results: HookResult[] }> {
    const fullContext: HookContext = {
      operation,
      workspacePath: this.workspacePath,
      timestamp: new Date(),
      ...context,
    };

    const results: HookResult[] = [];
    const hooks = this.hooks.get(operation) || [];

    if (hooks.length === 0) {
      return { success: true, results: [] };
    }

    debugLog(`Executing ${hooks.length} hooks for operation: ${operation}`);

    for (const hook of hooks) {
      if (!hook.enabled) continue;

      try {
        const timeoutPromise = new Promise<HookResult>((_, reject) => {
          setTimeout(() => reject(new Error("Hook timeout")), hook.timeout);
        });

        const hookPromise = hook.execute(fullContext);
        const result = await Promise.race([hookPromise, timeoutPromise]);

        results.push(result);

        if (!result.success && hook.blocking) {
          debugLog(`Blocking hook ${hook.name} failed, aborting execution`);
          return { success: false, results };
        }

        // Update context with modifications
        if (result.modified && hook.type === "pre") {
          fullContext.content = result.modified;
        }
      } catch (error) {
        const errorResult: HookResult = {
          success: false,
          error: `Hook ${hook.name} failed: ${error instanceof Error ? error.message : String(error)}`,
        };

        results.push(errorResult);

        if (hook.blocking) {
          debugLog(
            `Blocking hook ${hook.name} threw error, aborting execution`,
          );
          return { success: false, results };
        }
      }
    }

    const success =
      results.every((r) => r.success) ||
      results.some(
        (r) => r.success && !hooks.find((h) => h.blocking && !r.success),
      );

    return { success, results };
  }

  getHooks(operation?: string): Hook[] {
    if (operation) {
      return this.hooks.get(operation) || [];
    }

    const allHooks: Hook[] = [];
    for (const hookList of this.hooks.values()) {
      allHooks.push(...hookList);
    }

    return allHooks;
  }

  enableHook(hookId: string): void {
    for (const hookList of this.hooks.values()) {
      const hook = hookList.find((h) => h.id === hookId);
      if (hook) {
        hook.enabled = true;
        debugLog(`Enabled hook: ${hook.name}`);
        break;
      }
    }
  }

  disableHook(hookId: string): void {
    for (const hookList of this.hooks.values()) {
      const hook = hookList.find((h) => h.id === hookId);
      if (hook) {
        hook.enabled = false;
        debugLog(`Disabled hook: ${hook.name}`);
        break;
      }
    }
  }

  async getHookStats(): Promise<{
    totalHooks: number;
    enabledHooks: number;
    hooksByOperation: Record<string, number>;
    recentExecutions: number;
  }> {
    const allHooks = this.getHooks();
    const hooksByOperation: Record<string, number> = {};

    for (const [operation, hooks] of this.hooks.entries()) {
      hooksByOperation[operation] = hooks.length;
    }

    return {
      totalHooks: allHooks.length,
      enabledHooks: allHooks.filter((h) => h.enabled).length,
      hooksByOperation,
      recentExecutions: 0, // Would be tracked in production
    };
  }

  async registerHook(hook: Hook, operation?: string): Promise<void> {
    if (!operation) {
      // Register hook for multiple operations if no specific operation provided
      const operations = [
        "pre-conversion",
        "post-conversion",
        "pre-validation",
        "post-validation",
      ];
      for (const op of operations) {
        if (!this.hooks.has(op)) {
          this.hooks.set(op, []);
        }
        const existingHooks = this.hooks.get(op)!;
        if (!existingHooks.find((h) => h.id === hook.id)) {
          existingHooks.push(hook);
          existingHooks.sort((a, b) => a.priority - b.priority);
        }
      }
    } else {
      if (!this.hooks.has(operation)) {
        this.hooks.set(operation, []);
      }
      const operationHooks = this.hooks.get(operation)!;
      if (!operationHooks.find((h) => h.id === hook.id)) {
        operationHooks.push(hook);
        operationHooks.sort((a, b) => a.priority - b.priority);
      }
    }

    debugLog(
      `Hook ${hook.name} registered for operation: ${operation || "multiple"}`,
    );
  }

  getHookStatistics(): {
    totalHooks: number;
    enabledHooks: number;
    hooksByOperation: Record<string, number>;
    executionStats: Array<{
      hookId: string;
      name: string;
      executionCount: number;
      averageDuration: number;
      successRate: number;
    }>;
  } {
    const allHooks = this.getHooks();
    const hooksByOperation: Record<string, number> = {};
    const executionStats: Array<{
      hookId: string;
      name: string;
      executionCount: number;
      averageDuration: number;
      successRate: number;
    }> = [];

    for (const [operation, hooks] of this.hooks.entries()) {
      hooksByOperation[operation] = hooks.length;
    }

    // Generate execution statistics for each hook
    for (const hook of allHooks) {
      executionStats.push({
        hookId: hook.id,
        name: hook.name,
        executionCount: 0, // Would be tracked in production
        averageDuration: 0,
        successRate: 100,
      });
    }

    return {
      totalHooks: allHooks.length,
      enabledHooks: allHooks.filter((h) => h.enabled).length,
      hooksByOperation,
      executionStats,
    };
  }

  async runHooks(
    operation: string,
    context: Partial<HookContext>,
  ): Promise<{ success: boolean; results: HookResult[] }> {
    // This is an alias for executeHooks for backward compatibility
    return this.executeHooks(operation, context);
  }

  dispose(): void {
    this.hooks.clear();
    this.config.dispose();
  }
}

// Singleton instance
let hookManagerInstance: HookManager | null = null;

export function getHookManager(workspacePath: string): HookManager {
  if (!hookManagerInstance) {
    hookManagerInstance = new HookManager(workspacePath);
  }
  return hookManagerInstance;
}
