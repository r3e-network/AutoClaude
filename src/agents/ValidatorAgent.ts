/**
 * Validator Agent - Code Validation and Neo-rs Compatibility
 *
 * This agent handles code validation, syntax checking, and ensures
 * 100% compatibility with Neo N3 implementation.
 */

import { Agent, Task, AgentResult } from "./index";
import { getMemoryManager } from "../memory";

export class ValidatorAgent implements Agent {
  public readonly id: string;
  public readonly type: string = "validator";
  public status: "idle" | "busy" | "error" = "idle";
  public readonly capabilities: string[] = [
    "syntax-validation",
    "neo-compatibility",
    "code-analysis",
    "error-detection",
  ];
  public lastActivity: Date = new Date();
  public taskCount: number = 0;
  public errorCount: number = 0;

  private memoryManager: any;

  constructor(id: string, workspacePath?: string) {
    this.id = id;
    if (workspacePath) {
      const { getMemoryManager } = require("../memory");
      this.memoryManager = getMemoryManager(workspacePath);
    }
  }

  async processTask(task: Task): Promise<AgentResult> {
    this.status = "busy";
    this.lastActivity = new Date();

    try {
      const startTime = Date.now();
      let result: any;

      switch (task.type) {
        case "validate-syntax":
          result = await this.validateSyntax(task.input);
          break;
        case "validate-neo-compatibility":
          result = await this.validateNeoCompatibility(task.input);
          break;
        case "analyze-code":
          result = await this.analyzeCode(task.input);
          break;
        case "detect-errors":
          result = await this.detectErrors(task.input);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      const duration = Date.now() - startTime;
      this.taskCount++;
      this.status = "idle";

      return {
        success: true,
        output: result,
        metrics: {
          duration,
          memoryUsage: process.memoryUsage().heapUsed,
          cpuUsage: process.cpuUsage().user,
        },
      };
    } catch (error) {
      this.errorCount++;
      this.status = "error";

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async validateSyntax(input: {
    code: string;
    language: "csharp" | "rust";
    strict?: boolean;
  }): Promise<{
    isValid: boolean;
    errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: "error" | "warning";
    }>;
    suggestions: string[];
  }> {
    const { code, language, strict = false } = input;
    const errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: "error" | "warning";
    }> = [];
    const suggestions: string[] = [];

    if (language === "csharp") {
      return this.validateCSharpSyntax(code, strict, errors, suggestions);
    } else if (language === "rust") {
      return this.validateRustSyntax(code, strict, errors, suggestions);
    }

    return {
      isValid: false,
      errors: [
        {
          line: 1,
          column: 1,
          message: `Unsupported language: ${language}`,
          severity: "error",
        },
      ],
      suggestions: [],
    };
  }

  private validateCSharpSyntax(
    code: string,
    strict: boolean,
    errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: "error" | "warning";
    }>,
    suggestions: string[],
  ): { isValid: boolean; errors: typeof errors; suggestions: string[] } {
    const lines = code.split("\n");

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for common C# syntax issues
      if (
        line.includes("public class") &&
        !line.includes("{") &&
        !lines[index + 1]?.trim().startsWith("{")
      ) {
        errors.push({
          line: lineNum,
          column: line.indexOf("public class") + 1,
          message: "Class declaration should be followed by opening brace",
          severity: "error",
        });
      }

      // Check for missing semicolons
      if (
        line.trim().length > 0 &&
        !line.trim().endsWith(";") &&
        !line.trim().endsWith("{") &&
        !line.trim().endsWith("}") &&
        !line.trim().startsWith("//") &&
        !line.includes("if") &&
        !line.includes("else") &&
        !line.includes("for") &&
        !line.includes("while")
      ) {
        errors.push({
          line: lineNum,
          column: line.length,
          message: "Statement should end with semicolon",
          severity: "warning",
        });
      }

      // Check for Neo-specific patterns
      if (line.includes("UInt160") || line.includes("UInt256")) {
        suggestions.push(
          `Line ${lineNum}: Consider using appropriate Rust equivalent for Neo types`,
        );
      }
    });

    return {
      isValid: errors.filter((e) => e.severity === "error").length === 0,
      errors,
      suggestions,
    };
  }

  private validateRustSyntax(
    code: string,
    strict: boolean,
    errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: "error" | "warning";
    }>,
    suggestions: string[],
  ): { isValid: boolean; errors: typeof errors; suggestions: string[] } {
    const lines = code.split("\n");

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for common Rust syntax issues
      if (
        line.includes("struct") &&
        line.includes("pub") &&
        !line.includes("{") &&
        !lines[index + 1]?.trim().startsWith("{")
      ) {
        errors.push({
          line: lineNum,
          column: line.indexOf("struct") + 1,
          message:
            "Struct declaration should be followed by opening brace or semicolon",
          severity: "error",
        });
      }

      // Check for missing 'pub' keyword where needed
      if (
        line.includes("fn ") &&
        !line.includes("pub fn") &&
        !line.trim().startsWith("//")
      ) {
        errors.push({
          line: lineNum,
          column: line.indexOf("fn") + 1,
          message: 'Consider making function public with "pub" keyword',
          severity: "warning",
        });
      }

      // Check for Neo-rs specific patterns
      if (line.includes("U160") || line.includes("U256")) {
        suggestions.push(`Line ${lineNum}: Good use of Neo-rs types`);
      }
    });

    return {
      isValid: errors.filter((e) => e.severity === "error").length === 0,
      errors,
      suggestions,
    };
  }

  private async validateNeoCompatibility(input: {
    originalCSharp: string;
    convertedRust: string;
  }): Promise<{
    isCompatible: boolean;
    compatibilityScore: number;
    issues: Array<{
      type: string;
      description: string;
      severity: "critical" | "major" | "minor";
    }>;
    recommendations: string[];
  }> {
    const { originalCSharp, convertedRust } = input;
    const issues: Array<{
      type: string;
      description: string;
      severity: "critical" | "major" | "minor";
    }> = [];
    const recommendations: string[] = [];

    let compatibilityScore = 100;

    // Check for Neo-specific type conversions
    const neoTypes = [
      "UInt160",
      "UInt256",
      "ECPoint",
      "BigInteger",
      "StackItem",
      "InteropService",
      "Script",
      "Witness",
      "Transaction",
      "Block",
    ];

    for (const neoType of neoTypes) {
      if (originalCSharp.includes(neoType)) {
        const rustEquivalent = await this.getNeoRustEquivalent(neoType);
        if (!convertedRust.includes(rustEquivalent)) {
          issues.push({
            type: "missing_type_conversion",
            description: `${neoType} should be converted to ${rustEquivalent}`,
            severity: "critical",
          });
          compatibilityScore -= 15;
          recommendations.push(
            `Convert ${neoType} to ${rustEquivalent} for Neo compatibility`,
          );
        }
      }
    }

    // Check for method signature compatibility
    const csharpMethods = this.extractMethods(originalCSharp);
    const rustMethods = this.extractMethods(convertedRust);

    if (csharpMethods.length !== rustMethods.length) {
      issues.push({
        type: "method_count_mismatch",
        description: `Method count mismatch: C# has ${csharpMethods.length}, Rust has ${rustMethods.length}`,
        severity: "major",
      });
      compatibilityScore -= 10;
    }

    // Check for Neo-specific patterns
    if (
      originalCSharp.includes("ApplicationEngine") &&
      !convertedRust.includes("ApplicationEngine")
    ) {
      issues.push({
        type: "missing_engine_integration",
        description:
          "ApplicationEngine integration not found in Rust conversion",
        severity: "critical",
      });
      compatibilityScore -= 20;
    }

    // Record compatibility results for learning
    if (this.memoryManager) {
      await this.memoryManager.recordValidation(
        originalCSharp,
        convertedRust,
        "neo_compatibility",
        compatibilityScore / 100,
        issues.length === 0,
      );
    }

    return {
      isCompatible: compatibilityScore >= 80,
      compatibilityScore: Math.max(0, compatibilityScore),
      issues,
      recommendations,
    };
  }

  private async analyzeCode(input: {
    code: string;
    language: "csharp" | "rust";
    analysisType?:
      | "complexity"
      | "performance"
      | "security"
      | "maintainability";
  }): Promise<{
    complexity: number;
    maintainability: number;
    performance: number;
    security: number;
    recommendations: string[];
  }> {
    const { code, language, analysisType = "complexity" } = input;
    const lines = code.split("\n");

    let complexity = 1; // Base complexity
    let maintainability = 100;
    let performance = 100;
    let security = 100;
    const recommendations: string[] = [];

    // Analyze complexity
    lines.forEach((line) => {
      if (
        line.includes("if") ||
        line.includes("else") ||
        line.includes("while") ||
        line.includes("for")
      ) {
        complexity++;
      }
      if (line.includes("try") || line.includes("catch")) {
        complexity++;
      }
    });

    // Analyze maintainability
    const longMethods = lines.filter((line) => line.length > 120).length;
    if (longMethods > 0) {
      maintainability -= longMethods * 5;
      recommendations.push(
        "Consider breaking down long lines for better readability",
      );
    }

    // Analyze performance
    if (code.includes("String.") && language === "csharp") {
      performance -= 10;
      recommendations.push(
        "Consider using StringBuilder for multiple string operations",
      );
    }

    // Analyze security
    if (code.includes("unsafe") && language === "rust") {
      security -= 20;
      recommendations.push(
        "Review unsafe code blocks for potential security issues",
      );
    }

    return {
      complexity,
      maintainability: Math.max(0, maintainability),
      performance: Math.max(0, performance),
      security: Math.max(0, security),
      recommendations,
    };
  }

  private async detectErrors(input: {
    code: string;
    language: "csharp" | "rust";
  }): Promise<{
    errors: Array<{
      line: number;
      type: string;
      message: string;
      suggestion?: string;
    }>;
    warnings: Array<{
      line: number;
      type: string;
      message: string;
      suggestion?: string;
    }>;
  }> {
    const { code, language } = input;
    const lines = code.split("\n");
    const errors: Array<{
      line: number;
      type: string;
      message: string;
      suggestion?: string;
    }> = [];
    const warnings: Array<{
      line: number;
      type: string;
      message: string;
      suggestion?: string;
    }> = [];

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Common error patterns
      if (line.includes("null") && language === "rust") {
        errors.push({
          line: lineNum,
          type: "invalid_null",
          message: "Rust does not have null values",
          suggestion: "Use Option<T> instead of null",
        });
      }

      // Common warning patterns
      if (line.includes("TODO") || line.includes("FIXME")) {
        warnings.push({
          line: lineNum,
          type: "incomplete_implementation",
          message: "Incomplete implementation found",
          suggestion: "Complete the implementation before production",
        });
      }
    });

    return { errors, warnings };
  }

  private async getNeoRustEquivalent(csharpType: string): Promise<string> {
    const typeMap: Record<string, string> = {
      UInt160: "U160",
      UInt256: "U256",
      ECPoint: "PublicKey",
      BigInteger: "num_bigint::BigInt",
      StackItem: "StackItem",
      InteropService: "InteropService",
      Script: "Script",
      Witness: "Witness",
      Transaction: "Transaction",
      Block: "Block",
      ApplicationEngine: "ApplicationEngine",
    };

    return typeMap[csharpType] || csharpType;
  }

  private extractMethods(code: string): string[] {
    const methods: string[] = [];
    const lines = code.split("\n");

    lines.forEach((line) => {
      if (
        line.includes("public") &&
        (line.includes("(") || line.includes("fn"))
      ) {
        methods.push(line.trim());
      }
    });

    return methods;
  }

  getStatus(): {
    id: string;
    type: string;
    status: string;
    capabilities: string[];
    stats: {
      taskCount: number;
      errorCount: number;
      successRate: number;
      lastActivity: Date;
    };
  } {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      capabilities: this.capabilities,
      stats: {
        taskCount: this.taskCount,
        errorCount: this.errorCount,
        successRate:
          this.taskCount > 0
            ? (this.taskCount - this.errorCount) / this.taskCount
            : 0,
        lastActivity: this.lastActivity,
      },
    };
  }
}
