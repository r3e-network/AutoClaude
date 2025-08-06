/**
 * Pattern Learning Hook - Learns from successful conversions
 *
 * This hook extracts patterns from successful C# to Rust conversions
 * and stores them in the memory system for future use.
 */

import { Hook, HookContext, HookResult, HOOK_PRIORITIES } from "../index";
import { getMemoryManager } from "../../memory";
import {
  PatternLearningMemoryManager,
  LearningResult,
  ConversionInput,
  ValidationInput,
  ValidationResult,
  ExistingPattern,
} from "../../types/pattern-learning";

export class PatternLearningHook implements Hook {
  public readonly id: string = "pattern-learning";
  public readonly name: string = "Pattern Learning Hook";
  public readonly description: string =
    "Learns patterns from successful conversions";
  public readonly priority: number = HOOK_PRIORITIES.LOW; // Run after other processing
  public enabled: boolean = true;
  public readonly blocking: boolean = false;
  public readonly timeout: number = 15000; // 15 seconds

  private memoryManager: PatternLearningMemoryManager | null = null;

  constructor() {
    // Initialize memoryManager when needed
  }

  private async getMemoryManager(workspacePath?: string): Promise<PatternLearningMemoryManager | null> {
    if (!this.memoryManager && workspacePath) {
      this.memoryManager = getMemoryManager(workspacePath) as PatternLearningMemoryManager;
    }
    return this.memoryManager;
  }

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

      let learningResult: LearningResult | null = null;

      switch (operation) {
        case "post-conversion":
          learningResult = await this.learnFromConversion(input);
          break;
        case "post-validation":
          learningResult = await this.learnFromValidation(input);
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
        modified: false,
        output: learningResult,
        metadata: { learningResult },
        duration,
      };
    } catch (error) {
      return {
        success: true, // Non-blocking - learning failure shouldn't stop processing
        modified: false,
        warnings: [
          `Pattern learning failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
        duration: Date.now() - startTime,
      };
    }
  }

  private async learnFromConversion(input: ConversionInput): Promise<{
    patternsLearned: number;
    newPatterns: string[];
    updatedPatterns: string[];
  }> {
    const { originalCode, convertedCode, success, confidence } = input;

    if (!success || !originalCode || !convertedCode) {
      return {
        patternsLearned: 0,
        newPatterns: [],
        updatedPatterns: [],
      };
    }

    const patterns = this.extractPatterns(originalCode, convertedCode);
    const newPatterns: string[] = [];
    const updatedPatterns: string[] = [];

    for (const pattern of patterns) {
      try {
        // Check if pattern already exists
        const memoryManager = await this.getMemoryManager();
        if (!memoryManager) continue;
        const existingPatterns = await memoryManager.getPatterns(
          pattern.category,
          0.1,
        );
        const existing = existingPatterns.find(
          (p: ExistingPattern) =>
            p.input_pattern === pattern.input &&
            p.output_pattern === pattern.output,
        );

        if (existing) {
          // Update existing pattern with higher confidence
          const newConfidence = Math.max(
            existing.confidence,
            pattern.confidence,
          );
          await memoryManager.updatePatternSuccess(
            existing.id,
            true,
            newConfidence,
          );
          updatedPatterns.push(pattern.input);
        } else {
          // Record new pattern
          await memoryManager.recordPattern(
            pattern.input,
            pattern.output,
            pattern.category,
            pattern.confidence,
          );
          newPatterns.push(pattern.input);
        }
      } catch (error) {
        // Continue with other patterns if one fails
        console.warn(`Failed to record pattern: ${error}`);
      }
    }

    return {
      patternsLearned: newPatterns.length + updatedPatterns.length,
      newPatterns,
      updatedPatterns,
    };
  }

  private async learnFromValidation(input: ValidationInput): Promise<{
    validationPatternsLearned: number;
    successfulPatterns: string[];
    failedPatterns: string[];
  }> {
    const { originalCode, convertedCode, validationResult, success } = input;

    if (!originalCode || !convertedCode || !validationResult) {
      return {
        validationPatternsLearned: 0,
        successfulPatterns: [],
        failedPatterns: [],
      };
    }

    const successfulPatterns: string[] = [];
    const failedPatterns: string[] = [];

    try {
      // Record validation result for learning
      const memoryManager = await this.getMemoryManager();
      if (memoryManager) {
        await memoryManager.recordValidation(
          originalCode,
          convertedCode,
          "conversion_validation",
          validationResult.compatibilityScore / 100,
          success,
        );
      }

      if (success && validationResult.compatibilityScore > 80) {
        // Learn from successful validation
        const patterns = this.extractValidationPatterns(
          originalCode,
          convertedCode,
          validationResult,
        );

        for (const pattern of patterns) {
          try {
            if (memoryManager) {
              await memoryManager.recordPattern(
                pattern.input,
                pattern.output,
                "validated_conversion",
                pattern.confidence,
              );
            }
            successfulPatterns.push(pattern.input);
          } catch (error) {
            failedPatterns.push(pattern.input);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to learn from validation: ${error}`);
    }

    return {
      validationPatternsLearned: successfulPatterns.length,
      successfulPatterns,
      failedPatterns,
    };
  }

  private extractPatterns(
    originalCode: string,
    convertedCode: string,
  ): Array<{
    input: string;
    output: string;
    category: string;
    confidence: number;
  }> {
    const patterns: Array<{
      input: string;
      output: string;
      category: string;
      confidence: number;
    }> = [];

    const originalLines = originalCode.split("\n");
    const convertedLines = convertedCode.split("\n");

    // Extract line-by-line patterns
    const maxLines = Math.min(originalLines.length, convertedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i].trim();
      const convertedLine = convertedLines[i].trim();

      if (
        originalLine.length > 0 &&
        convertedLine.length > 0 &&
        originalLine !== convertedLine
      ) {
        // Detect pattern type
        const category = this.detectPatternCategory(
          originalLine,
          convertedLine,
        );
        const confidence = this.calculatePatternConfidence(
          originalLine,
          convertedLine,
          category,
        );

        if (confidence > 0.5) {
          patterns.push({
            input: originalLine,
            output: convertedLine,
            category,
            confidence,
          });
        }
      }
    }

    // Extract common code block patterns
    patterns.push(...this.extractBlockPatterns(originalCode, convertedCode));

    // Extract type conversion patterns
    patterns.push(...this.extractTypePatterns(originalCode, convertedCode));

    return patterns;
  }

  private extractValidationPatterns(
    originalCode: string,
    convertedCode: string,
    validationResult: ValidationResult,
  ): Array<{
    input: string;
    output: string;
    category: string;
    confidence: number;
  }> {
    const patterns: Array<{
      input: string;
      output: string;
      category: string;
      confidence: number;
    }> = [];

    // Extract patterns from successful Neo-specific conversions
    if (validationResult.compatibilityScore > 90) {
      const neoPatterns = this.extractNeoSpecificPatterns(
        originalCode,
        convertedCode,
      );
      patterns.push(...neoPatterns);
    }

    return patterns;
  }

  private extractBlockPatterns(
    originalCode: string,
    convertedCode: string,
  ): Array<{
    input: string;
    output: string;
    category: string;
    confidence: number;
  }> {
    const patterns: Array<{
      input: string;
      output: string;
      category: string;
      confidence: number;
    }> = [];

    // Class declaration patterns
    const classMatch = originalCode.match(/public\s+class\s+(\w+)/);
    const structMatch = convertedCode.match(/pub\s+struct\s+(\w+)/);

    if (classMatch && structMatch && classMatch[1] === structMatch[1]) {
      patterns.push({
        input: `public class ${classMatch[1]}`,
        output: `pub struct ${structMatch[1]}`,
        category: "class_to_struct",
        confidence: 0.9,
      });
    }

    // Method patterns
    const methodRegex = /public\s+(\w+)\s+(\w+)\s*\(([^)]*)\)/g;
    const functionRegex = /pub\s+fn\s+(\w+)\s*\(([^)]*)\)\s*->\s*(\w+)/g;

    let methodMatch;
    let functionMatch;

    while ((methodMatch = methodRegex.exec(originalCode)) !== null) {
      functionRegex.lastIndex = 0;
      while ((functionMatch = functionRegex.exec(convertedCode)) !== null) {
        if (methodMatch[2] === functionMatch[1]) {
          // Same method name
          patterns.push({
            input: methodMatch[0],
            output: functionMatch[0],
            category: "method_conversion",
            confidence: 0.8,
          });
          break;
        }
      }
    }

    return patterns;
  }

  private extractTypePatterns(
    originalCode: string,
    convertedCode: string,
  ): Array<{
    input: string;
    output: string;
    category: string;
    confidence: number;
  }> {
    const patterns: Array<{
      input: string;
      output: string;
      category: string;
      confidence: number;
    }> = [];

    // Common type mappings
    const typeMap = [
      { from: "string", to: "String", confidence: 0.95 },
      { from: "int", to: "i32", confidence: 0.95 },
      { from: "bool", to: "bool", confidence: 1.0 },
      { from: "byte[]", to: "Vec<u8>", confidence: 0.9 },
      { from: "UInt256", to: "U256", confidence: 0.95 },
      { from: "UInt160", to: "U160", confidence: 0.95 },
      { from: "BigInteger", to: "num_bigint::BigInt", confidence: 0.9 },
    ];

    for (const { from, to, confidence } of typeMap) {
      if (originalCode.includes(from) && convertedCode.includes(to)) {
        patterns.push({
          input: from,
          output: to,
          category: "type_mapping",
          confidence,
        });
      }
    }

    return patterns;
  }

  private extractNeoSpecificPatterns(
    originalCode: string,
    convertedCode: string,
  ): Array<{
    input: string;
    output: string;
    category: string;
    confidence: number;
  }> {
    const patterns: Array<{
      input: string;
      output: string;
      category: string;
      confidence: number;
    }> = [];

    // Neo-specific type patterns
    const neoTypes = [
      "UInt160",
      "UInt256",
      "ECPoint",
      "StackItem",
      "InteropService",
      "ApplicationEngine",
      "ExecutionEngine",
      "StorageContext",
      "ContractState",
    ];

    for (const neoType of neoTypes) {
      if (originalCode.includes(neoType)) {
        // Find corresponding Rust usage
        const lines = convertedCode.split("\n");
        for (const line of lines) {
          if (
            line.includes("U160") ||
            line.includes("U256") ||
            line.includes("PublicKey")
          ) {
            patterns.push({
              input: neoType,
              output: line.trim(),
              category: "neo_type_conversion",
              confidence: 0.85,
            });
            break;
          }
        }
      }
    }

    return patterns;
  }

  private detectPatternCategory(
    originalLine: string,
    convertedLine: string,
  ): string {
    if (
      originalLine.includes("public class") &&
      convertedLine.includes("pub struct")
    ) {
      return "class_declaration";
    }

    if (originalLine.includes("public") && convertedLine.includes("pub fn")) {
      return "method_declaration";
    }

    if (originalLine.includes("get;") && originalLine.includes("set;")) {
      return "property_declaration";
    }

    if (originalLine.includes("UInt") || originalLine.includes("BigInteger")) {
      return "neo_type_conversion";
    }

    if (
      originalLine.includes("string") ||
      originalLine.includes("int") ||
      originalLine.includes("bool")
    ) {
      return "basic_type_conversion";
    }

    return "syntax_pattern";
  }

  private calculatePatternConfidence(
    originalLine: string,
    convertedLine: string,
    category: string,
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence for well-known patterns
    switch (category) {
      case "class_declaration":
        confidence = 0.9;
        break;
      case "method_declaration":
        confidence = 0.8;
        break;
      case "neo_type_conversion":
        confidence = 0.85;
        break;
      case "basic_type_conversion":
        confidence = 0.95;
        break;
    }

    // Adjust based on line complexity
    const complexity = Math.min(originalLine.length, convertedLine.length);
    if (complexity > 100) {
      confidence *= 0.9; // Reduce confidence for complex lines
    }

    // Boost confidence if both lines have similar structure
    const originalWords = originalLine.split(/\s+/).length;
    const convertedWords = convertedLine.split(/\s+/).length;
    const wordRatio =
      Math.min(originalWords, convertedWords) /
      Math.max(originalWords, convertedWords);

    confidence *= wordRatio;

    return Math.min(1.0, Math.max(0.1, confidence));
  }
}
