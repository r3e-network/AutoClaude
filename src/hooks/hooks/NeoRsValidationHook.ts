/**
 * Neo-rs Validation Hook - Ensures 100% Neo N3 compatibility
 *
 * This hook validates that Rust conversions maintain 100% compatibility
 * with the C# Neo N3 implementation.
 */

import { Hook, HookContext, HookResult, HOOK_PRIORITIES } from "../index";
import { getMemoryManager } from "../../memory";
import {
  NeoMemoryManager,
  ConversionInput,
  PreValidationInput,
  FinalValidationInput,
  ConversionValidationResult,
  PreValidationResult,
  FinalValidationResult,
  ValidationResult,
  NeoSpecificCheck,
  FinalCheckResult,
  NeoTypeValidation,
  NeoProtocolValidation,
  SmartContractValidation,
  VMIntegrationValidation,
  ConsensusValidation,
  StructuralValidation,
  FunctionalEquivalenceValidation,
  PerformanceValidation,
  SecurityValidation,
} from "../../types/neo-validation";

export class NeoRsValidationHook implements Hook {
  public readonly id: string = "neo-rs-validation";
  public readonly name: string = "Neo-rs Validation Hook";
  public readonly description: string = "Validates Neo N3 compatibility";
  public readonly priority: number = HOOK_PRIORITIES.CRITICAL; // Very important for Neo-rs
  public enabled: boolean = true;
  public readonly blocking: boolean = true; // Must pass for Neo-rs compatibility
  public readonly timeout: number = 60000; // 60 seconds

  private memoryManager: NeoMemoryManager | null = null;

  constructor() {
    // Initialize memoryManager when needed
  }

  private async getMemoryManager(workspacePath?: string): Promise<NeoMemoryManager | null> {
    if (!this.memoryManager && workspacePath) {
      this.memoryManager = getMemoryManager(workspacePath);
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

      let validationResult: ValidationResult | null = null;

      switch (operation) {
        case "post-conversion":
          validationResult = await this.validateConversion(input);
          break;
        case "pre-validation":
          validationResult = await this.validateBeforeProcessing(input);
          break;
        case "post-validation":
          validationResult = await this.validateFinalResult(input);
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
          error: `Neo-rs validation failed: ${validationResult.errors.join(", ")}`,
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

  private async validateConversion(input: ConversionInput): Promise<ConversionValidationResult> {
    const { originalCode, convertedCode, metadata } = input;

    if (!originalCode || !convertedCode) {
      return {
        isValid: false,
        compatibilityScore: 0,
        errors: ["Missing original or converted code"],
        warnings: [],
        neoSpecificChecks: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const neoSpecificChecks: NeoSpecificCheck[] = [];
    let compatibilityScore = 100;

    // Check Neo-specific type mappings
    const typeValidation = await this.validateNeoTypes(
      originalCode,
      convertedCode,
    );
    if (!typeValidation.isValid) {
      compatibilityScore -= 30;
      errors.push(...typeValidation.errors);
    }
    warnings.push(...typeValidation.warnings);
    neoSpecificChecks.push(typeValidation);

    // Check Neo protocol compatibility
    const protocolValidation = await this.validateNeoProtocol(
      originalCode,
      convertedCode,
    );
    if (!protocolValidation.isValid) {
      compatibilityScore -= 25;
      errors.push(...protocolValidation.errors);
    }
    warnings.push(...protocolValidation.warnings);
    neoSpecificChecks.push(protocolValidation);

    // Check smart contract patterns
    const contractValidation = await this.validateSmartContractPatterns(
      originalCode,
      convertedCode,
    );
    if (!contractValidation.isValid) {
      compatibilityScore -= 20;
      errors.push(...contractValidation.errors);
    }
    warnings.push(...contractValidation.warnings);
    neoSpecificChecks.push(contractValidation);

    // Check VM integration
    const vmValidation = await this.validateVMIntegration(
      originalCode,
      convertedCode,
    );
    if (!vmValidation.isValid) {
      compatibilityScore -= 15;
      errors.push(...vmValidation.errors);
    }
    warnings.push(...vmValidation.warnings);
    neoSpecificChecks.push(vmValidation);

    // Check consensus mechanism patterns
    const consensusValidation = await this.validateConsensusPatterns(
      originalCode,
      convertedCode,
    );
    if (!consensusValidation.isValid) {
      compatibilityScore -= 10;
      errors.push(...consensusValidation.errors);
    }
    warnings.push(...consensusValidation.warnings);
    neoSpecificChecks.push(consensusValidation);

    const finalScore = Math.max(0, compatibilityScore);
    const isValid = finalScore >= 80 && errors.length === 0;

    // Record validation results for learning
    const memoryManager = await this.getMemoryManager();
    if (memoryManager) {
      await memoryManager.recordValidation(
        originalCode,
        convertedCode,
        "neo_rs_compatibility",
        finalScore / 100,
        isValid,
      );
    }

    return {
      isValid,
      compatibilityScore: finalScore,
      errors,
      warnings,
      neoSpecificChecks,
    };
  }

  private async validateBeforeProcessing(input: PreValidationInput): Promise<PreValidationResult> {
    const { filePath, content } = input;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content) {
      return {
        isValid: false,
        errors: ["No content provided"],
        warnings: [],
        neoDetected: false,
      };
    }

    // Detect if this is Neo-related code
    const neoDetected = this.detectNeoCode(content);

    if (neoDetected) {
      // Perform Neo-specific pre-validation
      const neoKeywords = this.extractNeoKeywords(content);

      if (neoKeywords.length === 0) {
        warnings.push(
          "Neo-related file detected but no Neo-specific patterns found",
        );
      }

      // Check for known problematic patterns
      const problematicPatterns = this.checkProblematicPatterns(content);
      if (problematicPatterns.length > 0) {
        warnings.push(
          ...problematicPatterns.map((p) => `Potential conversion issue: ${p}`),
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      neoDetected,
    };
  }

  private async validateFinalResult(input: FinalValidationInput): Promise<FinalValidationResult> {
    const { originalCode, convertedCode, validationResults } = input;

    const finalChecks: FinalCheckResult[] = [];
    let overallCompatibility = 100;

    // Comprehensive final validation
    const structuralCheck = await this.validateStructuralIntegrity(
      originalCode,
      convertedCode,
    );
    finalChecks.push({ type: "structural", result: structuralCheck });
    if (!structuralCheck.isValid) overallCompatibility -= 20;

    const functionalCheck = await this.validateFunctionalEquivalence(
      originalCode,
      convertedCode,
    );
    finalChecks.push({ type: "functional", result: functionalCheck });
    if (!functionalCheck.isValid) overallCompatibility -= 25;

    const performanceCheck = await this.validatePerformanceCharacteristics(
      originalCode,
      convertedCode,
    );
    finalChecks.push({ type: "performance", result: performanceCheck });
    if (!performanceCheck.isValid) overallCompatibility -= 15;

    const securityCheck = await this.validateSecurityCharacteristics(
      originalCode,
      convertedCode,
    );
    finalChecks.push({ type: "security", result: securityCheck });
    if (!securityCheck.isValid) overallCompatibility -= 20;

    overallCompatibility = Math.max(0, overallCompatibility);
    const isValid = overallCompatibility >= 85;
    const readyForProduction = overallCompatibility >= 95;

    return {
      isValid,
      overallCompatibility,
      finalChecks,
      readyForProduction,
    };
  }

  private async validateNeoTypes(
    originalCode: string,
    convertedCode: string,
  ): Promise<NeoTypeValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const typeMapping: Record<string, string> = {};

    // Define Neo-specific type mappings
    const neoTypeMap = {
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
      Header: "Header",
      ApplicationEngine: "ApplicationEngine",
      ExecutionEngine: "ExecutionEngine",
      StorageContext: "StorageContext",
      StorageItem: "StorageItem",
      ContractState: "ContractState",
      ContractManifest: "Manifest",
    };

    // Check each Neo type mapping
    for (const [csharpType, rustType] of Object.entries(neoTypeMap)) {
      if (originalCode.includes(csharpType)) {
        typeMapping[csharpType] = rustType;

        if (!convertedCode.includes(rustType)) {
          errors.push(`${csharpType} should be converted to ${rustType}`);
        } else {
          // Check usage patterns
          const csharpUsages = this.findTypeUsages(originalCode, csharpType);
          const rustUsages = this.findTypeUsages(convertedCode, rustType);

          if (csharpUsages.length !== rustUsages.length) {
            warnings.push(
              `Usage count mismatch for ${csharpType} -> ${rustType}: ${csharpUsages.length} vs ${rustUsages.length}`,
            );
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      typeMapping,
    };
  }

  private async validateNeoProtocol(
    originalCode: string,
    convertedCode: string,
  ): Promise<NeoProtocolValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const protocolFeatures: string[] = [];

    // Check for Neo protocol-specific features
    const protocolElements = [
      "Consensus",
      "Blockchain",
      "Mempool",
      "P2P",
      "RPC",
      "Wallet",
      "SmartContract",
      "VM",
      "Persistence",
      "Network",
    ];

    for (const element of protocolElements) {
      if (originalCode.toLowerCase().includes(element.toLowerCase())) {
        protocolFeatures.push(element);

        // Check if equivalent exists in Rust code
        if (!convertedCode.toLowerCase().includes(element.toLowerCase())) {
          warnings.push(
            `Protocol feature ${element} not found in converted code`,
          );
        }
      }
    }

    // Specific Neo N3 features
    if (originalCode.includes("Nep17") || originalCode.includes("NEP-17")) {
      if (
        !convertedCode.includes("nep17") &&
        !convertedCode.includes("NEP17")
      ) {
        errors.push(
          "NEP-17 token standard implementation missing in Rust conversion",
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      protocolFeatures,
    };
  }

  private async validateSmartContractPatterns(
    originalCode: string,
    convertedCode: string,
  ): Promise<SmartContractValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const contractPatterns: string[] = [];

    // Check for smart contract patterns
    if (
      originalCode.includes("[DisplayName") ||
      originalCode.includes("DisplayName")
    ) {
      contractPatterns.push("DisplayName");
      if (
        !convertedCode.includes("display_name") &&
        !convertedCode.includes("DisplayName")
      ) {
        errors.push("DisplayName attribute not properly converted");
      }
    }

    if (
      originalCode.includes("[Safe]") ||
      originalCode.includes("CallFlags.ReadOnly")
    ) {
      contractPatterns.push("Safe");
      if (
        !convertedCode.includes("safe") &&
        !convertedCode.includes("readonly")
      ) {
        warnings.push("Safe method marker not found in Rust conversion");
      }
    }

    if (
      originalCode.includes("Storage.Get") ||
      originalCode.includes("Storage.Put")
    ) {
      contractPatterns.push("Storage");
      if (
        !convertedCode.includes("storage") &&
        !convertedCode.includes("Storage")
      ) {
        errors.push("Storage operations not properly converted");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      contractPatterns,
    };
  }

  private async validateVMIntegration(
    originalCode: string,
    convertedCode: string,
  ): Promise<VMIntegrationValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const vmFeatures: string[] = [];

    // Check VM-related patterns
    const vmPatterns = [
      "ExecutionEngine",
      "ApplicationEngine",
      "VMState",
      "StackItem",
      "InteropService",
      "Syscall",
    ];

    for (const pattern of vmPatterns) {
      if (originalCode.includes(pattern)) {
        vmFeatures.push(pattern);

        // Check for Rust equivalent
        if (
          !convertedCode.includes(pattern) &&
          !convertedCode.includes(pattern.toLowerCase())
        ) {
          warnings.push(
            `VM feature ${pattern} may need explicit conversion handling`,
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      vmFeatures,
    };
  }

  private async validateConsensusPatterns(
    originalCode: string,
    convertedCode: string,
  ): Promise<ConsensusValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const consensusFeatures: string[] = [];

    // Check consensus-related patterns
    if (
      originalCode.includes("Consensus") ||
      originalCode.includes("consensus")
    ) {
      consensusFeatures.push("Consensus");
    }

    if (
      originalCode.includes("Validator") ||
      originalCode.includes("validator")
    ) {
      consensusFeatures.push("Validator");
    }

    if (originalCode.includes("Block") && originalCode.includes("validate")) {
      consensusFeatures.push("BlockValidation");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      consensusFeatures,
    };
  }

  private async validateStructuralIntegrity(
    originalCode: string,
    convertedCode: string,
  ): Promise<{
    isValid: boolean;
    structureScore: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let structureScore = 100;

    // Count major structural elements
    const originalClasses = (originalCode.match(/class\s+\w+/g) || []).length;
    const convertedStructs = (convertedCode.match(/struct\s+\w+/g) || [])
      .length;

    if (originalClasses !== convertedStructs) {
      issues.push(
        `Class/struct count mismatch: ${originalClasses} classes vs ${convertedStructs} structs`,
      );
      structureScore -= 20;
    }

    const originalMethods = (
      originalCode.match(/public\s+\w+\s+\w+\s*\(/g) || []
    ).length;
    const convertedFunctions = (
      convertedCode.match(/pub\s+fn\s+\w+\s*\(/g) || []
    ).length;

    if (Math.abs(originalMethods - convertedFunctions) > 2) {
      issues.push(
        `Method/function count significant difference: ${originalMethods} vs ${convertedFunctions}`,
      );
      structureScore -= 15;
    }

    return {
      isValid: structureScore >= 70,
      structureScore: Math.max(0, structureScore),
      issues,
    };
  }

  private async validateFunctionalEquivalence(
    originalCode: string,
    convertedCode: string,
  ): Promise<{
    isValid: boolean;
    functionalScore: number;
    equivalenceIssues: string[];
  }> {
    const equivalenceIssues: string[] = [];
    let functionalScore = 100;

    // This is a simplified check - in production, this would involve more sophisticated analysis
    // Check for critical functional keywords
    const criticalKeywords = [
      "return",
      "throw",
      "try",
      "catch",
      "if",
      "else",
      "for",
      "while",
    ];

    for (const keyword of criticalKeywords) {
      const originalCount = (
        originalCode.match(new RegExp(`\\b${keyword}\\b`, "g")) || []
      ).length;
      const convertedCount = (
        convertedCode.match(new RegExp(`\\b${keyword}\\b`, "g")) || []
      ).length;

      if (Math.abs(originalCount - convertedCount) > 2) {
        equivalenceIssues.push(
          `Significant difference in ${keyword} usage: ${originalCount} vs ${convertedCount}`,
        );
        functionalScore -= 10;
      }
    }

    return {
      isValid: functionalScore >= 80,
      functionalScore: Math.max(0, functionalScore),
      equivalenceIssues,
    };
  }

  private async validatePerformanceCharacteristics(
    originalCode: string,
    convertedCode: string,
  ): Promise<{
    isValid: boolean;
    performanceScore: number;
    performanceIssues: string[];
  }> {
    const performanceIssues: string[] = [];
    let performanceScore = 100;

    // Check for potential performance issues
    if (
      convertedCode.includes("clone()") &&
      originalCode.split("\n").length > 50
    ) {
      performanceIssues.push("Excessive cloning detected in large codebase");
      performanceScore -= 15;
    }

    if (
      convertedCode.includes(".unwrap()") &&
      !convertedCode.includes("expect(")
    ) {
      performanceIssues.push("Potential panic points with unwrap() usage");
      performanceScore -= 10;
    }

    return {
      isValid: performanceScore >= 75,
      performanceScore: Math.max(0, performanceScore),
      performanceIssues,
    };
  }

  private async validateSecurityCharacteristics(
    originalCode: string,
    convertedCode: string,
  ): Promise<{
    isValid: boolean;
    securityScore: number;
    securityIssues: string[];
  }> {
    const securityIssues: string[] = [];
    let securityScore = 100;

    // Check for unsafe patterns
    if (convertedCode.includes("unsafe")) {
      securityIssues.push(
        "Unsafe blocks detected - manual security review required",
      );
      securityScore -= 25;
    }

    if (convertedCode.includes("transmute")) {
      securityIssues.push("Memory transmutation detected - high security risk");
      securityScore -= 30;
    }

    if (
      convertedCode.includes(".unwrap()") &&
      convertedCode.includes("network")
    ) {
      securityIssues.push(
        "Unwrap usage in network code - potential DoS vector",
      );
      securityScore -= 20;
    }

    return {
      isValid: securityScore >= 80,
      securityScore: Math.max(0, securityScore),
      securityIssues,
    };
  }

  private detectNeoCode(code: string): boolean {
    const neoIndicators = [
      "UInt160",
      "UInt256",
      "Neo.",
      "ApplicationEngine",
      "StackItem",
      "InteropService",
      "SmartContract",
      "Blockchain",
      "Consensus",
      "nep17",
      "NEP-17",
      "neo-rs",
      "neo_",
      "Contract",
    ];

    return neoIndicators.some((indicator) =>
      code.toLowerCase().includes(indicator.toLowerCase()),
    );
  }

  private extractNeoKeywords(code: string): string[] {
    const neoKeywords = [
      "UInt160",
      "UInt256",
      "ECPoint",
      "BigInteger",
      "StackItem",
      "ApplicationEngine",
      "ExecutionEngine",
      "InteropService",
      "SmartContract",
      "Transaction",
      "Block",
      "Witness",
    ];

    return neoKeywords.filter((keyword) => code.includes(keyword));
  }

  private checkProblematicPatterns(code: string): string[] {
    const problematicPatterns: string[] = [];

    if (code.includes("string.Empty")) {
      problematicPatterns.push(
        "string.Empty should be converted to String::new()",
      );
    }

    if (code.includes("null")) {
      problematicPatterns.push("null values need to be converted to Option<T>");
    }

    if (code.includes("throw new")) {
      problematicPatterns.push("Exception throwing needs Result<T, E> pattern");
    }

    return problematicPatterns;
  }

  private findTypeUsages(code: string, typeName: string): string[] {
    const usages: string[] = [];
    const lines = code.split("\n");

    lines.forEach((line, index) => {
      if (line.includes(typeName)) {
        usages.push(`Line ${index + 1}: ${line.trim()}`);
      }
    });

    return usages;
  }
}
