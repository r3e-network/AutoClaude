/**
 * Production Issue Queue Manager
 * Sends production readiness issues to Claude for intelligent fixing
 */

import * as vscode from "vscode";
import { debugLog } from "../utils/logging";
import { addMessageToQueueFromWebview } from "../queue/manager";
import { MessageMetadata } from "../types";
import { messageQueue } from "../core/state";

export interface ProductionIssue {
  type: "todo" | "hardcoded-secret" | "placeholder" | "console-log" | "security" | "test-failure" | "error-handling" | "missing-validation";
  file: string;
  line: number;
  message: string;
  severity: "critical" | "error" | "warning";
  context?: string;
  codeSnippet?: string;
}

export class ProductionIssueQueueManager {
  private issueCount = 0;
  private processedCount = 0;
  
  constructor(private workspaceRoot: string) {}

  /**
   * Send production issues to Claude for fixing
   */
  async queueIssuesForClaude(issues: Map<string, ProductionIssue[]>): Promise<{
    queued: number;
    messages: string[];
  }> {
    const messages: string[] = [];
    let queuedCount = 0;

    try {
      // Group issues by severity and type for efficient processing
      const criticalIssues: ProductionIssue[] = [];
      const errorIssues: ProductionIssue[] = [];
      const warningIssues: ProductionIssue[] = [];

      for (const [filePath, fileIssues] of issues) {
        for (const issue of fileIssues) {
          if (issue.severity === "critical") {
            criticalIssues.push(issue);
          } else if (issue.severity === "error") {
            errorIssues.push(issue);
          } else {
            warningIssues.push(issue);
          }
        }
      }

      // Process critical issues first
      if (criticalIssues.length > 0) {
        const message = await this.createFixMessage(criticalIssues, "CRITICAL");
        messages.push(message);
        await this.queueMessage(message, "critical", criticalIssues);
        queuedCount++;
      }

      // Then process errors
      if (errorIssues.length > 0) {
        const batchSize = 10; // Process errors in batches
        for (let i = 0; i < errorIssues.length; i += batchSize) {
          const batch = errorIssues.slice(i, i + batchSize);
          const message = await this.createFixMessage(batch, "ERROR");
          messages.push(message);
          await this.queueMessage(message, "error", batch);
          queuedCount++;
        }
      }

      // Finally process warnings
      if (warningIssues.length > 0) {
        const batchSize = 20; // Larger batches for warnings
        for (let i = 0; i < warningIssues.length; i += batchSize) {
          const batch = warningIssues.slice(i, i + batchSize);
          const message = await this.createFixMessage(batch, "WARNING");
          messages.push(message);
          await this.queueMessage(message, "warning", batch);
          queuedCount++;
        }
      }

      debugLog(`Queued ${queuedCount} messages for ${issues.size} files with production issues`);

      return {
        queued: queuedCount,
        messages
      };
    } catch (error) {
      debugLog(`Failed to queue issues: ${error}`);
      throw error;
    }
  }

  /**
   * Create a fix message for Claude
   */
  private async createFixMessage(issues: ProductionIssue[], severity: string): Promise<string> {
    // Group issues by type for better context
    const issuesByType = new Map<string, ProductionIssue[]>();
    for (const issue of issues) {
      if (!issuesByType.has(issue.type)) {
        issuesByType.set(issue.type, []);
      }
      issuesByType.get(issue.type)!.push(issue);
    }

    // Build the message
    let message = `🚨 Production Readiness ${severity} Issues - Please fix the following issues:\n\n`;
    
    // Add summary
    message += `Summary: ${issues.length} ${severity.toLowerCase()} issues found across ${new Set(issues.map(i => i.file)).size} files\n\n`;
    
    // Add issues by type
    for (const [type, typeIssues] of issuesByType) {
      message += `## ${this.getIssueTypeTitle(type)} (${typeIssues.length} issues)\n\n`;
      
      // Group by file
      const byFile = new Map<string, ProductionIssue[]>();
      for (const issue of typeIssues) {
        if (!byFile.has(issue.file)) {
          byFile.set(issue.file, []);
        }
        byFile.get(issue.file)!.push(issue);
      }
      
      for (const [file, fileIssues] of byFile) {
        const relativePath = file.replace(this.workspaceRoot + "/", "");
        message += `### File: ${relativePath}\n`;
        
        for (const issue of fileIssues) {
          message += `- Line ${issue.line}: ${issue.message}\n`;
          if (issue.codeSnippet) {
            message += `  \`\`\`\n  ${issue.codeSnippet}\n  \`\`\`\n`;
          }
        }
        message += "\n";
      }
    }

    // Add specific instructions based on issue types
    message += this.getFixInstructions(issuesByType);
    
    // Add validation requirement
    message += "\n## Requirements:\n";
    message += "1. Fix all issues listed above\n";
    message += "2. Ensure the code remains functional after fixes\n";
    message += "3. Follow the project's coding standards\n";
    message += "4. Add proper error handling where missing\n";
    message += "5. Replace all placeholders with production-ready implementations\n";
    message += "6. Remove all debugging code (console.log, etc.)\n";
    message += "7. Use environment variables for any sensitive data\n";
    message += "8. Ensure all TODOs are either implemented or have a clear plan\n";
    
    return message;
  }

  /**
   * Get human-readable title for issue type
   */
  private getIssueTypeTitle(type: string): string {
    const titles: Record<string, string> = {
      "todo": "TODO/FIXME Comments",
      "hardcoded-secret": "Hardcoded Secrets & Credentials",
      "placeholder": "Placeholder Implementations",
      "console-log": "Console Logging Statements",
      "security": "Security Vulnerabilities",
      "test-failure": "Test Failures",
      "error-handling": "Missing Error Handling",
      "missing-validation": "Missing Input Validation"
    };
    return titles[type] || type.toUpperCase();
  }

  /**
   * Get specific fix instructions based on issue types
   */
  private getFixInstructions(issuesByType: Map<string, ProductionIssue[]>): string {
    let instructions = "\n## Fix Instructions:\n\n";
    
    if (issuesByType.has("todo")) {
      instructions += "### For TODO/FIXME items:\n";
      instructions += "- Implement the functionality described in the TODO\n";
      instructions += "- If it's a complex feature, create a proper implementation\n";
      instructions += "- Remove the TODO comment after implementation\n\n";
    }
    
    if (issuesByType.has("hardcoded-secret")) {
      instructions += "### For Hardcoded Secrets:\n";
      instructions += "- Move all passwords, API keys, and tokens to environment variables\n";
      instructions += "- Use proper configuration management (e.g., process.env, ConfigurationManager)\n";
      instructions += "- Add validation to ensure required environment variables are set\n";
      instructions += "- Document the required environment variables\n\n";
    }
    
    if (issuesByType.has("placeholder")) {
      instructions += "### For Placeholder Code:\n";
      instructions += "- Replace all 'Not Implemented' exceptions with actual implementations\n";
      instructions += "- Remove mock/stub/dummy markers and implement real functionality\n";
      instructions += "- Replace EXAMPLE placeholders with project-specific values\n";
      instructions += "- Ensure all methods have complete implementations\n\n";
    }
    
    if (issuesByType.has("console-log")) {
      instructions += "### For Console Logging:\n";
      instructions += "- Remove all console.log, console.error, console.warn statements\n";
      instructions += "- Replace with proper logging using the project's logging framework\n";
      instructions += "- Use debugLog() for debug output that should remain\n";
      instructions += "- Ensure no debugging output goes to production\n\n";
    }
    
    if (issuesByType.has("error-handling")) {
      instructions += "### For Error Handling:\n";
      instructions += "- Add proper try-catch blocks where needed\n";
      instructions += "- Never have empty catch blocks\n";
      instructions += "- Log errors appropriately\n";
      instructions += "- Provide meaningful error messages to users\n";
      instructions += "- Implement proper error recovery strategies\n\n";
    }
    
    if (issuesByType.has("missing-validation")) {
      instructions += "### For Input Validation:\n";
      instructions += "- Validate all user inputs\n";
      instructions += "- Check for null/undefined values\n";
      instructions += "- Validate data types and ranges\n";
      instructions += "- Sanitize inputs to prevent injection attacks\n";
      instructions += "- Return clear validation error messages\n\n";
    }
    
    return instructions;
  }

  /**
   * Queue a message for Claude to process
   */
  private async queueMessage(
    message: string, 
    priority: "critical" | "error" | "warning",
    issues: ProductionIssue[]
  ): Promise<void> {
    const metadata: MessageMetadata = {
      source: "production-issue-fixer",
      timestamp: Date.now(),
      priority: priority === "critical" ? 10 : priority === "error" ? 7 : 5,
      context: {
        issueCount: issues.length,
        issueTypes: [...new Set(issues.map(i => i.type))],
        files: [...new Set(issues.map(i => i.file))],
        severity: priority
      }
    };

    // Add to queue with high priority for critical issues
    addMessageToQueueFromWebview(message, undefined, metadata);
    this.processedCount++;
    
    debugLog(`Queued ${priority} fix message with ${issues.length} issues`);
  }

  /**
   * Create a comprehensive fix-all message
   */
  async queueComprehensiveFixMessage(validationReport: string): Promise<void> {
    const message = `🚨 PRODUCTION READINESS VALIDATION FAILED - Comprehensive Fix Required

The production readiness validation has identified multiple issues that need to be fixed.
Please review and fix ALL issues to ensure the code is production-ready.

## Validation Report:
${validationReport}

## Your Task:
1. Analyze all the issues reported above
2. Fix each issue systematically
3. Ensure no placeholders, TODOs, or debugging code remains
4. Replace all hardcoded values with proper configuration
5. Add comprehensive error handling
6. Implement all missing functionality
7. Validate all inputs and outputs
8. Ensure the code follows production best practices

## Priority Order:
1. CRITICAL: Security issues, hardcoded secrets
2. ERROR: Missing implementations, placeholders
3. WARNING: TODOs, console.logs, code style issues

## Important:
- Make sure ALL issues are resolved
- The code must pass production readiness validation after your fixes
- Maintain backward compatibility
- Add tests for any new functionality
- Document any significant changes

Please fix all these issues to make the codebase production-ready.`;

    const metadata: MessageMetadata = {
      source: "production-validator",
      timestamp: Date.now(),
      priority: 10, // Highest priority
      context: {
        type: "comprehensive-fix",
        validationFailed: true
      }
    };

    addMessageToQueueFromWebview(message, undefined, metadata);
    this.processedCount++;
    debugLog("Queued comprehensive production fix message");
  }

  /**
   * Queue issues from a validation result
   */
  async queueValidationIssues(validationResult: any): Promise<void> {
    const issues = new Map<string, ProductionIssue[]>();
    
    // Parse validation errors into issues
    if (validationResult.errors && Array.isArray(validationResult.errors)) {
      for (const error of validationResult.errors) {
        const issue = this.parseValidationError(error);
        if (issue) {
          if (!issues.has(issue.file)) {
            issues.set(issue.file, []);
          }
          issues.get(issue.file)!.push(issue);
        }
      }
    }

    // Parse critical issues
    if (validationResult.criticalIssues && Array.isArray(validationResult.criticalIssues)) {
      for (const critical of validationResult.criticalIssues) {
        const issue = this.parseValidationError(critical, "critical");
        if (issue) {
          if (!issues.has(issue.file)) {
            issues.set(issue.file, []);
          }
          issues.get(issue.file)!.push(issue);
        }
      }
    }

    // Queue all issues for Claude
    if (issues.size > 0) {
      const result = await this.queueIssuesForClaude(issues);
      
      vscode.window.showInformationMessage(
        `Queued ${result.queued} messages to fix ${this.countTotalIssues(issues)} production issues`
      );
    }
  }

  /**
   * Parse a validation error into a ProductionIssue
   */
  private parseValidationError(error: any, severityOverride?: "critical" | "error" | "warning"): ProductionIssue | null {
    let file = "";
    let line = 0;
    let message = typeof error === 'string' ? error : (error.message || String(error));

    // Extract file and line from error
    const filePatterns = [
      /^([^:]+):(\d+):\s*(.+)$/,
      /\[([^:]+):(\d+)\]\s*(.+)$/,
      /in\s+([^\s]+)\s+at\s+line\s+(\d+):\s*(.+)$/i,
    ];

    for (const pattern of filePatterns) {
      const match = message.match(pattern);
      if (match) {
        file = match[1];
        line = parseInt(match[2], 10);
        message = match[3] || message;
        break;
      }
    }

    if (!file && typeof error === 'object' && error !== null) {
      file = error.file || error.fileName || error.path || "";
      line = error.line || error.lineNumber || 0;
    }

    if (!file) {
      return null;
    }

    // Determine issue type
    let type: ProductionIssue["type"] = "placeholder";
    let severity: ProductionIssue["severity"] = severityOverride || "warning";

    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes("todo") || lowerMessage.includes("fixme")) {
      type = "todo";
    } else if (lowerMessage.includes("password") || lowerMessage.includes("secret") || lowerMessage.includes("key")) {
      type = "hardcoded-secret";
      severity = severityOverride || "critical";
    } else if (lowerMessage.includes("console.log") || lowerMessage.includes("console.error")) {
      type = "console-log";
    } else if (lowerMessage.includes("placeholder") || lowerMessage.includes("not implemented")) {
      type = "placeholder";
      severity = severityOverride || "error";
    } else if (lowerMessage.includes("security")) {
      type = "security";
      severity = severityOverride || "critical";
    } else if (lowerMessage.includes("test") || lowerMessage.includes("failing")) {
      type = "test-failure";
      severity = severityOverride || "error";
    } else if (lowerMessage.includes("catch") || lowerMessage.includes("error handling")) {
      type = "error-handling";
      severity = severityOverride || "error";
    } else if (lowerMessage.includes("validation") || lowerMessage.includes("validate")) {
      type = "missing-validation";
      severity = severityOverride || "warning";
    }

    return {
      type,
      file,
      line,
      message,
      severity
    };
  }

  /**
   * Count total issues
   */
  private countTotalIssues(issues: Map<string, ProductionIssue[]>): number {
    let count = 0;
    for (const fileIssues of issues.values()) {
      count += fileIssues.length;
    }
    return count;
  }

  /**
   * Generate a status report
   */
  generateStatusReport(): string {
    return `
Production Issue Queue Status
==============================
Total Issues Identified: ${this.issueCount}
Messages Queued: ${this.processedCount}
Files Affected: ${this.issueCount > 0 ? "Multiple" : "None"}

The issues have been queued for Claude to fix automatically.
Claude will process each issue and implement production-ready solutions.
    `;
  }
}

// Export singleton
let instance: ProductionIssueQueueManager | null = null;

export function getProductionIssueQueueManager(workspaceRoot?: string): ProductionIssueQueueManager {
  if (!instance && workspaceRoot) {
    instance = new ProductionIssueQueueManager(workspaceRoot);
  }
  if (!instance) {
    throw new Error("ProductionIssueQueueManager not initialized with workspace root");
  }
  return instance;
}

export function resetProductionIssueQueueManager(): void {
  instance = null;
}