/**
 * Syntax Validation Hook - Validates C# and Rust syntax
 *
 * This hook validates code syntax for both C# and Rust languages,
 * providing detailed error reporting and suggestions.
 */

import { Hook, HookContext, HookResult, HOOK_PRIORITIES } from "../index";

export class SyntaxValidationHook implements Hook {
  public readonly id: string = "syntax-validation";
  public readonly name: string = "Syntax Validation Hook";
  public readonly description: string = "Validates C# and Rust code syntax";
  public readonly priority: number = HOOK_PRIORITIES.HIGH;
  public enabled: boolean = true;
  public readonly blocking: boolean = true;
  public readonly timeout: number = 30000; // 30 seconds

  async execute(context: HookContext): Promise<HookResult> {
    const startTime = Date.now();

    try {
      const { input, operation } = context;

      if (!input || typeof input !== "object") {
        return {
          success: true,
          modified: false,
          duration: Date.now() - startTime,
        };
      }

      let validationResult: any = null;

      switch (operation) {
        case "pre-conversion":
          validationResult = await this.validateSourceCode(input);
          break;
        case "post-conversion":
          validationResult = await this.validateConvertedCode(input);
          break;
        case "pre-validation":
          validationResult = await this.validateBeforeProcessing(input);
          break;
        default:
          return {
            success: true,
            modified: false,
            duration: Date.now() - startTime,
          };
      }

      const duration = Date.now() - startTime;

      if (validationResult && !validationResult.isValid) {
        return {
          success: false,
          modified: false,
          error: `Syntax validation failed: ${validationResult.errors.map((e: any) => e.message).join(", ")}`,
          metadata: { validationResult },
          duration,
        };
      }

      return {
        success: true,
        modified: false,
        output: validationResult,
        metadata: { validationResult },
        duration,
      };
    } catch (error) {
      return {
        success: false,
        modified: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  private async validateSourceCode(input: any): Promise<{
    isValid: boolean;
    errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
    }>;
    warnings: string[];
  }> {
    const { code, language } = input;
    const errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
    }> = [];
    const warnings: string[] = [];

    if (!code || typeof code !== "string") {
      errors.push({
        line: 1,
        column: 1,
        message: "No code provided for validation",
        severity: "error",
      });
      return { isValid: false, errors, warnings };
    }

    if (language === "csharp" || language === "c#") {
      return this.validateCSharp(code);
    } else if (language === "rust") {
      return this.validateRust(code);
    }

    warnings.push(`Unknown language: ${language}, skipping syntax validation`);
    return { isValid: true, errors, warnings };
  }

  private async validateConvertedCode(input: any): Promise<{
    isValid: boolean;
    errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
    }>;
    warnings: string[];
  }> {
    const { originalCode, convertedCode, targetLanguage } = input;

    if (!convertedCode || typeof convertedCode !== "string") {
      return {
        isValid: false,
        errors: [
          {
            line: 1,
            column: 1,
            message: "No converted code provided for validation",
            severity: "error",
          },
        ],
        warnings: [],
      };
    }

    // Validate the converted code syntax
    if (targetLanguage === "rust") {
      return this.validateRust(convertedCode);
    } else if (targetLanguage === "csharp" || targetLanguage === "c#") {
      return this.validateCSharp(convertedCode);
    }

    return {
      isValid: true,
      errors: [],
      warnings: [`Unknown target language: ${targetLanguage}`],
    };
  }

  private async validateBeforeProcessing(input: any): Promise<{
    isValid: boolean;
    errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
    }>;
    warnings: string[];
  }> {
    const { filePath, content } = input;
    const errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
    }> = [];
    const warnings: string[] = [];

    if (!content || typeof content !== "string") {
      errors.push({
        line: 1,
        column: 1,
        message: "No content provided for validation",
        severity: "error",
      });
      return { isValid: false, errors, warnings };
    }

    // Determine language from file extension
    const language = this.getLanguageFromFilePath(filePath);

    if (language === "csharp") {
      return this.validateCSharp(content);
    } else if (language === "rust") {
      return this.validateRust(content);
    }

    warnings.push(`Could not determine language from file: ${filePath}`);
    return { isValid: true, errors, warnings };
  }

  private validateCSharp(code: string): {
    isValid: boolean;
    errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
    }>;
    warnings: string[];
  } {
    const lines = code.split("\n");
    const errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
    }> = [];
    const warnings: string[] = [];

    let braceLevel = 0;
    let inString = false;
    let inComment = false;

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();

      // Skip empty lines
      if (trimmed.length === 0) return;

      // Handle comments
      if (trimmed.startsWith("//")) {
        return;
      }

      if (trimmed.startsWith("/*")) {
        inComment = true;
        return;
      }

      if (trimmed.includes("*/")) {
        inComment = false;
        return;
      }

      if (inComment) return;

      // Basic syntax checks

      // Check for unmatched braces
      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && (i === 0 || line[i - 1] !== "\\")) {
          inString = !inString;
        } else if (!inString) {
          if (char === "{") {
            braceLevel++;
          } else if (char === "}") {
            braceLevel--;
            if (braceLevel < 0) {
              errors.push({
                line: lineNum,
                column: i + 1,
                message: "Unmatched closing brace",
                severity: "error",
              });
            }
          }
        }
      }

      // Check for missing semicolons
      if (
        !inString &&
        !trimmed.endsWith(";") &&
        !trimmed.endsWith("{") &&
        !trimmed.endsWith("}") &&
        !trimmed.includes("if") &&
        !trimmed.includes("else") &&
        !trimmed.includes("for") &&
        !trimmed.includes("while") &&
        !trimmed.includes("using") &&
        !trimmed.includes("namespace") &&
        !trimmed.includes("class") &&
        !trimmed.includes("interface") &&
        !trimmed.includes("enum") &&
        trimmed.length > 0
      ) {
        warnings.push(`Line ${lineNum}: Statement might be missing semicolon`);
      }

      // Check for common C# patterns
      if (trimmed.includes("public class") && !trimmed.includes("{")) {
        const nextLine = lines[index + 1];
        if (!nextLine || !nextLine.trim().startsWith("{")) {
          warnings.push(
            `Line ${lineNum}: Class declaration should be followed by opening brace`,
          );
        }
      }
    });

    // Check final brace level
    if (braceLevel !== 0) {
      errors.push({
        line: lines.length,
        column: 1,
        message: `Unmatched braces: ${braceLevel > 0 ? "missing closing" : "extra closing"} brace(s)`,
        severity: "error",
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateRust(code: string): {
    isValid: boolean;
    errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
    }>;
    warnings: string[];
  } {
    const lines = code.split("\n");
    const errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
    }> = [];
    const warnings: string[] = [];

    let braceLevel = 0;
    let inString = false;
    let inComment = false;

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();

      // Skip empty lines
      if (trimmed.length === 0) return;

      // Handle comments
      if (trimmed.startsWith("//")) {
        return;
      }

      if (trimmed.startsWith("/*")) {
        inComment = true;
        return;
      }

      if (trimmed.includes("*/")) {
        inComment = false;
        return;
      }

      if (inComment) return;

      // Basic syntax checks for Rust

      // Check for unmatched braces
      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && (i === 0 || line[i - 1] !== "\\")) {
          inString = !inString;
        } else if (!inString) {
          if (char === "{") {
            braceLevel++;
          } else if (char === "}") {
            braceLevel--;
            if (braceLevel < 0) {
              errors.push({
                line: lineNum,
                column: i + 1,
                message: "Unmatched closing brace",
                severity: "error",
              });
            }
          }
        }
      }

      // Check for missing semicolons in Rust
      if (
        !inString &&
        !trimmed.endsWith(";") &&
        !trimmed.endsWith("{") &&
        !trimmed.endsWith("}") &&
        !trimmed.endsWith(",") &&
        !trimmed.includes("if") &&
        !trimmed.includes("else") &&
        !trimmed.includes("for") &&
        !trimmed.includes("while") &&
        !trimmed.includes("match") &&
        !trimmed.includes("fn") &&
        !trimmed.includes("struct") &&
        !trimmed.includes("enum") &&
        !trimmed.includes("impl") &&
        !trimmed.includes("use") &&
        !trimmed.includes("mod") &&
        trimmed.length > 0
      ) {
        warnings.push(`Line ${lineNum}: Statement might be missing semicolon`);
      }

      // Check for Rust-specific patterns
      if (trimmed.includes("null")) {
        errors.push({
          line: lineNum,
          column: trimmed.indexOf("null") + 1,
          message: "Rust does not have null values, use Option<T> instead",
          severity: "error",
        });
      }

      // Check for unsafe blocks
      if (trimmed.includes("unsafe")) {
        warnings.push(
          `Line ${lineNum}: Unsafe block detected, ensure safety requirements are met`,
        );
      }
    });

    // Check final brace level
    if (braceLevel !== 0) {
      errors.push({
        line: lines.length,
        column: 1,
        message: `Unmatched braces: ${braceLevel > 0 ? "missing closing" : "extra closing"} brace(s)`,
        severity: "error",
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private getLanguageFromFilePath(filePath: string): string {
    if (!filePath) return "unknown";

    const extension = filePath.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "cs":
        return "csharp";
      case "rs":
        return "rust";
      default:
        return "unknown";
    }
  }
}
