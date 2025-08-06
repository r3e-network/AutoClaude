import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { log } from "../utils/productionLogger";
import { SubAgentRunner } from "../subagents/SubAgentRunner";
import { HiveMindTask } from "../agents/hivemind/types";

/**
 * Pre-Task Validator
 *
 * Enforces TDD and DDD practices BEFORE any implementation begins:
 * - Blocks implementation tasks without corresponding tests (TDD)
 * - Blocks implementation tasks without documentation (DDD)
 * - Ensures tests are written first and fail initially
 * - Ensures documentation is comprehensive and complete
 */
export class PreTaskValidator {
  private static instance: PreTaskValidator | null = null;
  private subAgentRunner: SubAgentRunner;

  private constructor(private workspaceRoot: string) {
    this.subAgentRunner = new SubAgentRunner(workspaceRoot);
  }

  static getInstance(workspaceRoot: string): PreTaskValidator {
    if (!PreTaskValidator.instance) {
      PreTaskValidator.instance = new PreTaskValidator(workspaceRoot);
    }
    return PreTaskValidator.instance;
  }

  /**
   * Validate task before execution
   */
  async validatePreTask(task: HiveMindTask): Promise<ValidationResult> {
    log.info("Running pre-task validation", {
      taskId: task.id,
      type: task.type,
      tddEnforcement: task.context?.tddEnforcement,
      dddEnforcement: task.context?.dddEnforcement,
    });

    const result: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      blockers: [],
    };

    // Check TDD enforcement for implementation tasks
    if (task.type === "implementation" && task.context?.tddEnforcement) {
      const tddValidation = await this.validateTDDRequirements(task);
      if (!tddValidation.passed) {
        result.passed = false;
        result.blockers.push(...tddValidation.errors);
      }
    }

    // Check DDD enforcement for implementation tasks
    if (task.type === "implementation" && task.context?.dddEnforcement) {
      const dddValidation = await this.validateDDDRequirements(task);
      if (!dddValidation.passed) {
        result.passed = false;
        result.blockers.push(...dddValidation.errors);
      }
    }

    // Validate test tasks ensure they will fail first
    if (task.type === "testing" && task.context?.mustFailFirst) {
      const testValidation = await this.validateTestsWillFail(task);
      if (!testValidation.passed) {
        result.warnings.push(...testValidation.errors);
      }
    }

    // Validate documentation tasks are comprehensive
    if (task.type === "documentation" && task.context?.dddEnforcement) {
      const docValidation = await this.validateDocumentationComprehensive(task);
      if (!docValidation.passed) {
        result.errors.push(...docValidation.errors);
      }
    }

    return result;
  }

  /**
   * Validate TDD requirements before implementation
   */
  private async validateTDDRequirements(
    task: HiveMindTask,
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      blockers: [],
    };

    try {
      // Check if corresponding tests exist
      const targetEntity = task.context?.entity || task.context?.targetType;
      if (targetEntity) {
        const hasTests = await this.checkForCorrespondingTests(targetEntity);
        if (!hasTests) {
          result.passed = false;
          result.blockers.push({
            type: "tdd-violation",
            message: `TDD Violation: No tests found for ${targetEntity}. Tests must be written BEFORE implementation!`,
            severity: "critical",
            taskId: task.id,
          });
        }
      }

      // Run TDD enforcement check
      const tddCheck =
        await this.subAgentRunner.runSingleAgent("tdd-enforcement");
      if (tddCheck && !tddCheck.passed) {
        result.passed = false;
        result.blockers.push({
          type: "tdd-enforcement",
          message: `TDD Enforcement Failed: ${tddCheck.errors?.join(", ") || "Tests required before implementation"}`,
          severity: "critical",
          taskId: task.id,
        });
      }
    } catch (error) {
      log.error("TDD validation failed", error as Error);
      result.passed = false;
      result.blockers.push({
        type: "validation-error",
        message: `TDD validation error: ${(error as Error).message}`,
        severity: "critical",
        taskId: task.id,
      });
    }

    return result;
  }

  /**
   * Validate DDD requirements before implementation
   */
  private async validateDDDRequirements(
    task: HiveMindTask,
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      blockers: [],
    };

    try {
      // Check if corresponding documentation exists
      const targetEntity = task.context?.entity || task.context?.targetType;
      if (targetEntity) {
        const hasDocumentation =
          await this.checkForCorrespondingDocumentation(targetEntity);
        if (!hasDocumentation) {
          result.passed = false;
          result.blockers.push({
            type: "ddd-violation",
            message: `DDD Violation: No documentation found for ${targetEntity}. Documentation must be written BEFORE implementation!`,
            severity: "critical",
            taskId: task.id,
          });
        }
      }

      // Run DDD enforcement check
      const dddCheck =
        await this.subAgentRunner.runSingleAgent("ddd-enforcement");
      if (dddCheck && !dddCheck.passed) {
        result.passed = false;
        result.blockers.push({
          type: "ddd-enforcement",
          message: `DDD Enforcement Failed: ${dddCheck.errors?.join(", ") || "Documentation required before implementation"}`,
          severity: "critical",
          taskId: task.id,
        });
      }
    } catch (error) {
      log.error("DDD validation failed", error as Error);
      result.passed = false;
      result.blockers.push({
        type: "validation-error",
        message: `DDD validation error: ${(error as Error).message}`,
        severity: "critical",
        taskId: task.id,
      });
    }

    return result;
  }

  /**
   * Validate that tests will fail first (Red phase of TDD)
   */
  private async validateTestsWillFail(
    task: HiveMindTask,
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      blockers: [],
    };

    try {
      // This would ideally run the tests to ensure they fail
      // For now, we'll check if there are any implementation files that might make tests pass
      const targetEntity = task.context?.entity || task.context?.targetType;
      if (targetEntity) {
        const implementationExists =
          await this.checkForExistingImplementation(targetEntity);
        if (implementationExists) {
          result.warnings.push({
            type: "tdd-warning",
            message: `TDD Warning: Implementation may already exist for ${targetEntity}. Ensure tests fail before implementing!`,
            severity: "warning",
            taskId: task.id,
          });
        }
      }
    } catch (error) {
      log.warn("Test validation failed", error as Error);
      result.errors.push({
        type: "validation-error",
        message: `Test validation error: ${(error as Error).message}`,
        severity: "error",
        taskId: task.id,
      });
    }

    return result;
  }

  /**
   * Validate documentation is comprehensive
   */
  private async validateDocumentationComprehensive(
    task: HiveMindTask,
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      blockers: [],
    };

    try {
      const context = task.context;
      const requiredElements = [];

      if (context?.includeArchitecture) requiredElements.push("architecture");
      if (context?.includeAPIContracts) requiredElements.push("API contracts");
      if (context?.includeExamples) requiredElements.push("usage examples");
      if (context?.includeErrorHandling)
        requiredElements.push("error handling");

      // Check if all required documentation elements are planned
      if (requiredElements.length > 0) {
        result.warnings.push({
          type: "ddd-requirement",
          message: `DDD Requirements: Ensure documentation includes ${requiredElements.join(", ")}`,
          severity: "warning",
          taskId: task.id,
        });
      }
    } catch (error) {
      log.warn("Documentation validation failed", error as Error);
      result.errors.push({
        type: "validation-error",
        message: `Documentation validation error: ${(error as Error).message}`,
        severity: "error",
        taskId: task.id,
      });
    }

    return result;
  }

  /**
   * Check if corresponding tests exist for an entity
   */
  private async checkForCorrespondingTests(entity: string): Promise<boolean> {
    try {
      // Search for test files
      const testPatterns = [
        `**/*${entity}*.test.*`,
        `**/*${entity}*.spec.*`,
        `**/${entity}.test.*`,
        `**/${entity}.spec.*`,
      ];

      for (const pattern of testPatterns) {
        const files = await vscode.workspace.findFiles(
          pattern,
          "**/node_modules/**",
        );
        if (files.length > 0) {
          // Check if test files have actual test cases
          for (const file of files) {
            const content = await fs.promises.readFile(file.fsPath, "utf8");
            if (/(?:test|it|describe)\s*\(/.test(content)) {
              return true;
            }
          }
        }
      }

      return false;
    } catch (error) {
      log.error("Failed to check for tests", error as Error);
      return false;
    }
  }

  /**
   * Check if corresponding documentation exists for an entity
   */
  private async checkForCorrespondingDocumentation(
    entity: string,
  ): Promise<boolean> {
    try {
      // Check for inline documentation (JSDoc/TSDoc)
      const sourcePatterns = [`**/*${entity}*.*`, `**/${entity}.*`];

      for (const pattern of sourcePatterns) {
        const files = await vscode.workspace.findFiles(
          pattern,
          "**/node_modules/**",
        );
        for (const file of files) {
          if (file.fsPath.includes(".test.") || file.fsPath.includes(".spec."))
            continue;

          const content = await fs.promises.readFile(file.fsPath, "utf8");
          // Check for JSDoc comments
          if (/\/\*\*[\s\S]*?\*\//.test(content)) {
            return true;
          }
        }
      }

      // Check for external documentation files
      const docPatterns = [
        `**/*${entity}*.md`,
        `**/${entity}.md`,
        "**/README.md",
        "**/ARCHITECTURE.md",
      ];

      for (const pattern of docPatterns) {
        const files = await vscode.workspace.findFiles(
          pattern,
          "**/node_modules/**",
        );
        if (files.length > 0) {
          // Check if documentation is substantial (more than just a title)
          for (const file of files) {
            const content = await fs.promises.readFile(file.fsPath, "utf8");
            if (content.trim().length > 100) {
              // Minimum documentation length
              return true;
            }
          }
        }
      }

      return false;
    } catch (error) {
      log.error("Failed to check for documentation", error as Error);
      return false;
    }
  }

  /**
   * Check if implementation already exists for an entity
   */
  private async checkForExistingImplementation(
    entity: string,
  ): Promise<boolean> {
    try {
      const sourcePatterns = [`**/*${entity}*.*`, `**/${entity}.*`];

      for (const pattern of sourcePatterns) {
        const files = await vscode.workspace.findFiles(
          pattern,
          "**/node_modules/**",
        );
        for (const file of files) {
          // Skip test files
          if (file.fsPath.includes(".test.") || file.fsPath.includes(".spec."))
            continue;

          const content = await fs.promises.readFile(file.fsPath, "utf8");
          // Check if file contains actual implementation (not just interfaces or types)
          if (
            /(?:function|class|const.*=>)/.test(content) &&
            content.trim().length > 200
          ) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      log.error("Failed to check for existing implementation", error as Error);
      return false;
    }
  }
}

// Type definitions
export interface ValidationResult {
  passed: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  blockers: ValidationIssue[];
}

export interface ValidationIssue {
  type: string;
  message: string;
  severity: "critical" | "error" | "warning";
  taskId: string;
  file?: string;
  line?: number;
}
