/**
 * Auto Format Hook - Automatically formats code
 *
 * This hook automatically formats Rust code with rustfmt and provides
 * basic C# formatting for consistency.
 */

import { Hook, HookContext, HookResult, HOOK_PRIORITIES } from "../index";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export class AutoFormatHook implements Hook {
  public readonly id: string = "auto-format";
  public readonly name: string = "Auto Format Hook";
  public readonly description: string =
    "Automatically formats code with language-specific formatters";
  public readonly priority: number = HOOK_PRIORITIES.NORMAL;
  public enabled: boolean = true;
  public readonly blocking: boolean = false;
  public readonly timeout: number = 45000; // 45 seconds

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

      let formatResult: any = null;

      switch (operation) {
        case "post-conversion":
          formatResult = await this.formatConvertedCode(input);
          break;
        case "pre-validation":
          formatResult = await this.formatBeforeValidation(input);
          break;
        case "file-change":
          formatResult = await this.formatChangedFile(input);
          break;
        default:
          return {
            success: true,
            modified: false,
            duration: Date.now() - startTime,
          };
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        modified: formatResult?.modified || false,
        output: formatResult?.formattedCode || input,
        warnings: formatResult?.warnings,
        metadata: { formatResult },
        duration,
      };
    } catch (error) {
      return {
        success: true, // Non-blocking - formatting failure shouldn't stop processing
        modified: false,
        warnings: [
          `Formatting failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
        duration: Date.now() - startTime,
      };
    }
  }

  private async formatConvertedCode(input: any): Promise<{
    formattedCode: string;
    modified: boolean;
    warnings?: string[];
  }> {
    const { originalCode, convertedCode, targetLanguage } = input;

    if (!convertedCode || typeof convertedCode !== "string") {
      return {
        formattedCode: convertedCode,
        modified: false,
        warnings: ["No converted code provided for formatting"],
      };
    }

    if (targetLanguage === "rust") {
      return this.formatRust(convertedCode);
    } else if (targetLanguage === "csharp" || targetLanguage === "c#") {
      return this.formatCSharp(convertedCode);
    }

    return {
      formattedCode: convertedCode,
      modified: false,
      warnings: [`Unknown target language: ${targetLanguage}`],
    };
  }

  private async formatBeforeValidation(input: any): Promise<{
    formattedCode: string;
    modified: boolean;
    warnings?: string[];
  }> {
    const { filePath, content } = input;

    if (!content || typeof content !== "string") {
      return {
        formattedCode: content,
        modified: false,
        warnings: ["No content provided for formatting"],
      };
    }

    const language = this.getLanguageFromFilePath(filePath);

    if (language === "rust") {
      return this.formatRust(content);
    } else if (language === "csharp") {
      return this.formatCSharp(content);
    }

    return {
      formattedCode: content,
      modified: false,
    };
  }

  private async formatChangedFile(input: any): Promise<{
    formattedCode: string;
    modified: boolean;
    warnings?: string[];
  }> {
    const { filePath, content } = input;

    if (!content || typeof content !== "string") {
      return {
        formattedCode: content,
        modified: false,
        warnings: ["No content provided for formatting"],
      };
    }

    const language = this.getLanguageFromFilePath(filePath);

    if (language === "rust") {
      return this.formatRust(content, filePath);
    } else if (language === "csharp") {
      return this.formatCSharp(content);
    }

    return {
      formattedCode: content,
      modified: false,
    };
  }

  private async formatRust(
    code: string,
    filePath?: string,
  ): Promise<{
    formattedCode: string;
    modified: boolean;
    warnings?: string[];
  }> {
    try {
      // Check if rustfmt is available
      try {
        execSync("rustfmt --version", { stdio: "pipe" });
      } catch {
        return {
          formattedCode: this.basicRustFormat(code),
          modified: true,
          warnings: ["rustfmt not available, using basic formatting"],
        };
      }

      // Create temporary file for rustfmt
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `temp_${Date.now()}.rs`);

      try {
        fs.writeFileSync(tempFile, code);

        // Run rustfmt
        const result = execSync(`rustfmt --emit stdout "${tempFile}"`, {
          encoding: "utf8",
          stdio: "pipe",
        });

        const formattedCode = result.toString();
        const modified = formattedCode !== code;

        return {
          formattedCode,
          modified,
        };
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    } catch (error) {
      return {
        formattedCode: this.basicRustFormat(code),
        modified: true,
        warnings: [
          `rustfmt failed: ${error instanceof Error ? error.message : String(error)}, using basic formatting`,
        ],
      };
    }
  }

  private basicRustFormat(code: string): string {
    const lines = code.split("\n");
    let indentLevel = 0;
    const formattedLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.length === 0) {
        formattedLines.push("");
        continue;
      }

      // Decrease indent for closing braces
      if (trimmed.startsWith("}")) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Add current line with proper indentation
      const indentation = "    ".repeat(indentLevel);
      formattedLines.push(indentation + trimmed);

      // Increase indent for opening braces
      if (trimmed.endsWith("{") || trimmed.includes("{")) {
        indentLevel++;
      }
    }

    return formattedLines.join("\n");
  }

  private async formatCSharp(code: string): Promise<{
    formattedCode: string;
    modified: boolean;
    warnings?: string[];
  }> {
    // Basic C# formatting - could be enhanced with external formatters
    try {
      const formattedCode = this.basicCSharpFormat(code);
      const modified = formattedCode !== code;

      return {
        formattedCode,
        modified,
        warnings: modified ? undefined : ["No formatting changes needed"],
      };
    } catch (error) {
      return {
        formattedCode: code,
        modified: false,
        warnings: [
          `C# formatting failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  private basicCSharpFormat(code: string): string {
    const lines = code.split("\n");
    let indentLevel = 0;
    const formattedLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.length === 0) {
        formattedLines.push("");
        continue;
      }

      // Decrease indent for closing braces
      if (trimmed.startsWith("}")) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Add current line with proper indentation
      const indentation = "    ".repeat(indentLevel);
      let formattedLine = indentation + trimmed;

      // Format common C# patterns
      formattedLine = this.formatCSharpPatterns(formattedLine);

      formattedLines.push(formattedLine);

      // Increase indent for opening braces
      if (
        trimmed.endsWith("{") ||
        (trimmed.includes("{") && !trimmed.includes("}"))
      ) {
        indentLevel++;
      }

      // Handle special cases for C# constructs
      if (
        trimmed.includes("namespace") ||
        trimmed.includes("class") ||
        trimmed.includes("interface")
      ) {
        // These will likely have opening braces
      }
    }

    return formattedLines.join("\n");
  }

  private formatCSharpPatterns(line: string): string {
    let formatted = line;

    // Add space after keywords
    formatted = formatted.replace(
      /\b(if|else|for|while|switch|catch|using)\(/g,
      "$1 (",
    );

    // Add space around operators
    formatted = formatted.replace(/([a-zA-Z0-9_])=([a-zA-Z0-9_])/g, "$1 = $2");
    formatted = formatted.replace(/([a-zA-Z0-9_])\+([a-zA-Z0-9_])/g, "$1 + $2");
    formatted = formatted.replace(/([a-zA-Z0-9_])-([a-zA-Z0-9_])/g, "$1 - $2");

    // Format property declarations
    formatted = formatted.replace(/{\s*get;\s*set;\s*}/g, "{ get; set; }");

    return formatted;
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

  private async isToolAvailable(command: string): Promise<boolean> {
    try {
      execSync(`${command} --version`, { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }
}
