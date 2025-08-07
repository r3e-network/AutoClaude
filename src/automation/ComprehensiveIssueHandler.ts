/**
 * Comprehensive Issue Handler
 * Ensures ALL types of issues are properly identified, categorized, and queued for Claude
 * with robust error handling and recovery mechanisms
 */

import * as vscode from "vscode";
import { debugLog } from "../utils/logging";
import { addMessageToQueueFromWebview } from "../queue/manager";
import { MessageMetadata } from "../types";

// Comprehensive list of all possible issue types
export type IssueType = 
  // Code Quality Issues
  | "todo"                    // TODO/FIXME comments
  | "hardcoded-secret"        // Passwords, API keys, tokens
  | "placeholder"             // NotImplementedException, stub methods
  | "console-log"             // Debug output in production
  | "commented-code"          // Large blocks of commented code
  | "dead-code"              // Unreachable or unused code
  | "magic-number"           // Hardcoded numeric values
  | "long-method"            // Methods exceeding complexity threshold
  | "duplicate-code"         // Copy-pasted code blocks
  
  // Security Issues
  | "security-vulnerability"  // SQL injection, XSS, etc.
  | "insecure-random"        // Using Math.random for security
  | "weak-crypto"            // Weak encryption algorithms
  | "path-traversal"         // Potential path traversal attacks
  | "command-injection"      // Potential command injection
  
  // Error Handling Issues
  | "empty-catch"            // Empty catch blocks
  | "generic-exception"      // Catching generic Exception
  | "missing-error-handling" // No try-catch where needed
  | "swallowed-exception"    // Exceptions caught but not handled
  | "no-error-logging"       // Errors not being logged
  
  // Validation Issues  
  | "missing-validation"     // No input validation
  | "weak-validation"        // Insufficient validation
  | "no-null-check"         // Missing null/undefined checks
  | "no-bounds-check"       // Missing array bounds checking
  | "no-type-check"         // Missing type validation
  
  // Testing Issues
  | "no-tests"              // No test coverage
  | "failing-test"          // Tests that are failing
  | "disabled-test"         // Tests that are commented out
  | "insufficient-coverage" // Low test coverage
  | "mock-in-production"    // Test mocks in production code
  
  // Documentation Issues
  | "missing-docs"          // No documentation
  | "outdated-docs"         // Documentation doesn't match code
  | "no-api-docs"           // Public APIs without docs
  | "no-readme"             // Missing README
  
  // Performance Issues
  | "n-plus-one"            // N+1 query problems
  | "memory-leak"           // Potential memory leaks
  | "infinite-loop"         // Possible infinite loops
  | "blocking-io"           // Synchronous I/O in async context
  | "inefficient-algorithm" // O(n²) or worse algorithms
  
  // Dependency Issues
  | "outdated-dependency"   // Old package versions
  | "vulnerable-dependency" // Known vulnerabilities
  | "unused-dependency"     // Dependencies not being used
  | "missing-dependency"    // Required deps not installed
  
  // Code Style Issues
  | "naming-convention"     // Variables/methods not following conventions
  | "inconsistent-style"    // Mixed coding styles
  | "no-linting"           // Linting errors
  | "formatting"           // Code formatting issues
  
  // Architecture Issues
  | "circular-dependency"   // Circular imports
  | "tight-coupling"       // Classes too tightly coupled
  | "god-class"           // Classes doing too much
  | "layering-violation"  // Breaking architectural layers
  
  // Other Issues
  | "deprecation"         // Using deprecated APIs
  | "compatibility"       // Browser/version compatibility
  | "accessibility"       // A11y violations
  | "i18n"               // Hardcoded strings that should be localized
  | "unknown";           // Catch-all for unrecognized issues

export interface ComprehensiveIssue {
  type: IssueType;
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: "critical" | "error" | "warning" | "info";
  category: "security" | "quality" | "performance" | "testing" | "documentation" | "style" | "architecture" | "other";
  context?: string;
  codeSnippet?: string;
  suggestedFix?: string;
  autoFixable: boolean;
  priority: number; // 1-10, higher is more important
}

export class ComprehensiveIssueHandler {
  private queuedCount = 0;
  private processedCount = 0;
  private failedCount = 0;
  private retryQueue: ComprehensiveIssue[] = [];
  private issuePatterns: Map<IssueType, RegExp[]> = new Map();
  
  constructor(private workspaceRoot: string) {
    this.initializeIssuePatterns();
  }

  /**
   * Initialize patterns for detecting various issue types
   */
  private initializeIssuePatterns(): void {
    // TODO/FIXME patterns
    this.issuePatterns.set("todo", [
      /\b(TODO|FIXME|HACK|BUG|XXX|OPTIMIZE|REFACTOR)\b:?\s*/gi,
      /\/\/\s*@(todo|fixme)/gi,
      /\/\*\s*(TODO|FIXME)[^*]*\*\//gi
    ]);

    // Hardcoded secrets patterns
    this.issuePatterns.set("hardcoded-secret", [
      /password\s*=\s*["'][^"']+["']/gi,
      /api[_-]?key\s*=\s*["'][^"']+["']/gi,
      /secret\s*=\s*["'][^"']+["']/gi,
      /token\s*=\s*["'][^"']+["']/gi,
      /private[_-]?key\s*=\s*["'][^"']+["']/gi,
      /aws[_-]?access[_-]?key/gi,
      /sk-[a-zA-Z0-9]{32,}/g // OpenAI API keys
    ]);

    // Console logging patterns
    this.issuePatterns.set("console-log", [
      /console\.(log|error|warn|info|debug|trace)\(/g,
      /print\(/g, // Python
      /println\(/g, // Java/Kotlin
      /fmt\.Print/g, // Go
      /Debug\.Write/g // C#
    ]);

    // Placeholder patterns
    this.issuePatterns.set("placeholder", [
      /throw\s+new\s+(NotImplementedException|NotImplementedError)/g,
      /unimplemented!\(\)/g, // Rust
      /pass\s*#\s*placeholder/gi,
      /return\s+nil\s*\/\/\s*placeholder/gi,
      /\/\/\s*(stub|mock|dummy|placeholder)/gi
    ]);

    // Empty catch blocks
    this.issuePatterns.set("empty-catch", [
      /catch\s*\([^)]*\)\s*{\s*}/g,
      /catch\s*{\s*}/g,
      /except\s*:\s*pass/g // Python
    ]);

    // Add more patterns for other issue types...
  }

  /**
   * Process ALL validation results and queue everything for Claude
   */
  async processAllValidationResults(validationResult: any): Promise<{
    success: boolean;
    queued: number;
    failed: number;
    retried: number;
  }> {
    try {
      debugLog("Processing comprehensive validation results");
      
      const allIssues = new Map<string, ComprehensiveIssue[]>();
      
      // Parse ALL types of issues from validation results
      await this.extractAllIssues(validationResult, allIssues);
      
      // Also scan the codebase for additional issues
      await this.scanCodebaseForIssues(allIssues);
      
      // Queue all issues with retry logic
      const result = await this.queueAllIssuesWithRetry(allIssues);
      
      // Handle any failed items
      if (this.retryQueue.length > 0) {
        await this.processRetryQueue();
      }
      
      // Generate comprehensive report
      const report = this.generateComprehensiveReport(allIssues);
      
      // Queue the master fix message
      await this.queueMasterFixMessage(report, allIssues);
      
      return {
        success: true,
        queued: this.queuedCount,
        failed: this.failedCount,
        retried: this.retryQueue.length
      };
      
    } catch (error) {
      debugLog(`Comprehensive issue processing failed: ${error}`);
      
      // Fallback: Queue a simple message to Claude about the failure
      await this.queueFailureRecoveryMessage(error);
      
      return {
        success: false,
        queued: this.queuedCount,
        failed: this.failedCount,
        retried: 0
      };
    }
  }

  /**
   * Extract ALL issues from validation results
   */
  private async extractAllIssues(
    validationResult: any, 
    allIssues: Map<string, ComprehensiveIssue[]>
  ): Promise<void> {
    // Process different sections of validation results
    const sections = [
      { data: validationResult.errors, severity: "error" as const },
      { data: validationResult.warnings, severity: "warning" as const },
      { data: validationResult.criticalIssues, severity: "critical" as const },
      { data: validationResult.info, severity: "info" as const },
      { data: validationResult.suggestions, severity: "info" as const },
      { data: validationResult.todos, severity: "warning" as const },
      { data: validationResult.securityIssues, severity: "critical" as const },
      { data: validationResult.performanceIssues, severity: "warning" as const },
      { data: validationResult.testFailures, severity: "error" as const },
      { data: validationResult.styleIssues, severity: "info" as const }
    ];

    for (const section of sections) {
      if (section.data && Array.isArray(section.data)) {
        for (const item of section.data) {
          const issue = this.parseIssue(item, section.severity);
          if (issue) {
            const file = issue.file || "unknown";
            if (!allIssues.has(file)) {
              allIssues.set(file, []);
            }
            allIssues.get(file)!.push(issue);
          }
        }
      }
    }

    // Also check for raw text that might contain issues
    if (validationResult.rawOutput) {
      this.extractIssuesFromRawText(validationResult.rawOutput, allIssues);
    }
  }

  /**
   * Parse any type of issue into ComprehensiveIssue
   */
  private parseIssue(item: any, defaultSeverity: ComprehensiveIssue["severity"]): ComprehensiveIssue | null {
    try {
      let message = "";
      let file = "";
      let line = 0;
      let column = 0;
      
      // Handle different input formats
      if (typeof item === 'string') {
        message = item;
        const parsed = this.parseLocationFromMessage(message);
        file = parsed.file;
        line = parsed.line;
        column = parsed.column;
      } else if (typeof item === 'object' && item !== null) {
        message = item.message || item.description || item.text || String(item);
        file = item.file || item.fileName || item.path || item.location?.file || "";
        line = item.line || item.lineNumber || item.location?.line || 0;
        column = item.column || item.col || item.location?.column || 0;
      }

      if (!message) {
        return null;
      }

      // Determine issue type and details
      const issueType = this.detectIssueType(message);
      const category = this.getIssueCategory(issueType);
      const priority = this.calculatePriority(issueType, defaultSeverity);
      const autoFixable = this.isAutoFixable(issueType);

      return {
        type: issueType,
        file: file || "unknown",
        line: line || 0,
        column,
        message,
        severity: defaultSeverity,
        category,
        priority,
        autoFixable,
        context: item.context,
        codeSnippet: item.snippet || item.code
      };
      
    } catch (error) {
      debugLog(`Failed to parse issue: ${error}`);
      return null;
    }
  }

  /**
   * Detect issue type from message content
   */
  private detectIssueType(message: string): IssueType {
    const lowerMessage = message.toLowerCase();
    
    // Check each pattern
    for (const [type, patterns] of this.issuePatterns) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          return type;
        }
      }
    }
    
    // Keyword-based detection
    const keywordMap: Record<string, IssueType> = {
      "todo": "todo",
      "fixme": "todo",
      "password": "hardcoded-secret",
      "api key": "hardcoded-secret",
      "secret": "hardcoded-secret",
      "token": "hardcoded-secret",
      "console.log": "console-log",
      "placeholder": "placeholder",
      "not implemented": "placeholder",
      "stub": "placeholder",
      "mock": "placeholder",
      "empty catch": "empty-catch",
      "security": "security-vulnerability",
      "sql injection": "security-vulnerability",
      "xss": "security-vulnerability",
      "validation": "missing-validation",
      "null check": "no-null-check",
      "test": "no-tests",
      "failing": "failing-test",
      "coverage": "insufficient-coverage",
      "documentation": "missing-docs",
      "deprecated": "deprecation",
      "memory leak": "memory-leak",
      "n+1": "n-plus-one",
      "circular": "circular-dependency",
      "dependency": "outdated-dependency",
      "vulnerable": "vulnerable-dependency"
    };

    for (const [keyword, type] of Object.entries(keywordMap)) {
      if (lowerMessage.includes(keyword)) {
        return type;
      }
    }

    return "unknown";
  }

  /**
   * Scan codebase for additional issues not caught by validation
   */
  private async scanCodebaseForIssues(allIssues: Map<string, ComprehensiveIssue[]>): Promise<void> {
    try {
      const files = await vscode.workspace.findFiles(
        "**/*.{ts,js,tsx,jsx,py,java,cs,go,rs,cpp,c,h,hpp}",
        "**/node_modules/**",
        1000 // Limit to 1000 files for performance
      );

      for (const file of files) {
        const content = await vscode.workspace.fs.readFile(file)
          .then(buffer => new TextDecoder().decode(buffer));
        
        const fileIssues = this.scanFileContent(file.fsPath, content);
        if (fileIssues.length > 0) {
          if (!allIssues.has(file.fsPath)) {
            allIssues.set(file.fsPath, []);
          }
          allIssues.get(file.fsPath)!.push(...fileIssues);
        }
      }
    } catch (error) {
      debugLog(`Codebase scan failed: ${error}`);
    }
  }

  /**
   * Scan file content for issues
   */
  private scanFileContent(filePath: string, content: string): ComprehensiveIssue[] {
    const issues: ComprehensiveIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for various issue patterns
      for (const [type, patterns] of this.issuePatterns) {
        for (const pattern of patterns) {
          pattern.lastIndex = 0; // Reset regex
          if (pattern.test(line)) {
            issues.push({
              type,
              file: filePath,
              line: lineNumber,
              message: `${type} detected: ${line.trim()}`,
              severity: this.getDefaultSeverity(type),
              category: this.getIssueCategory(type),
              priority: this.getDefaultPriority(type),
              autoFixable: this.isAutoFixable(type),
              codeSnippet: line
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Queue all issues with retry logic
   */
  private async queueAllIssuesWithRetry(
    allIssues: Map<string, ComprehensiveIssue[]>
  ): Promise<void> {
    // Group issues by priority and severity
    const criticalIssues: ComprehensiveIssue[] = [];
    const errorIssues: ComprehensiveIssue[] = [];
    const warningIssues: ComprehensiveIssue[] = [];
    const infoIssues: ComprehensiveIssue[] = [];

    for (const fileIssues of allIssues.values()) {
      for (const issue of fileIssues) {
        switch (issue.severity) {
          case "critical":
            criticalIssues.push(issue);
            break;
          case "error":
            errorIssues.push(issue);
            break;
          case "warning":
            warningIssues.push(issue);
            break;
          case "info":
            infoIssues.push(issue);
            break;
        }
      }
    }

    // Queue with appropriate batch sizes and retry logic
    await this.queueIssueBatch(criticalIssues, "critical", 1, 3); // Small batches, multiple retries
    await this.queueIssueBatch(errorIssues, "error", 5, 2);
    await this.queueIssueBatch(warningIssues, "warning", 10, 1);
    await this.queueIssueBatch(infoIssues, "info", 20, 1);
  }

  /**
   * Queue a batch of issues with retry logic
   */
  private async queueIssueBatch(
    issues: ComprehensiveIssue[],
    severity: string,
    batchSize: number,
    maxRetries: number
  ): Promise<void> {
    if (issues.length === 0) return;

    for (let i = 0; i < issues.length; i += batchSize) {
      const batch = issues.slice(i, Math.min(i + batchSize, issues.length));
      let retries = 0;
      let queued = false;

      while (retries < maxRetries && !queued) {
        try {
          const message = this.createDetailedFixMessage(batch, severity);
          await this.queueMessage(message, severity, batch);
          queued = true;
          this.queuedCount++;
        } catch (error) {
          retries++;
          debugLog(`Failed to queue batch (attempt ${retries}/${maxRetries}): ${error}`);
          
          if (retries >= maxRetries) {
            this.retryQueue.push(...batch);
            this.failedCount++;
          } else {
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
          }
        }
      }
    }
  }

  /**
   * Create detailed fix message for Claude
   */
  private createDetailedFixMessage(issues: ComprehensiveIssue[], severity: string): string {
    const issuesByType = new Map<IssueType, ComprehensiveIssue[]>();
    
    for (const issue of issues) {
      if (!issuesByType.has(issue.type)) {
        issuesByType.set(issue.type, []);
      }
      issuesByType.get(issue.type)!.push(issue);
    }

    let message = `🚨 ${severity.toUpperCase()} Issues Requiring Fixes\n\n`;
    message += `Total: ${issues.length} issues across ${new Set(issues.map(i => i.file)).size} files\n\n`;

    for (const [type, typeIssues] of issuesByType) {
      message += `## ${this.getIssueTypeTitle(type)} (${typeIssues.length} issues)\n\n`;
      
      const byFile = new Map<string, ComprehensiveIssue[]>();
      for (const issue of typeIssues) {
        if (!byFile.has(issue.file)) {
          byFile.set(issue.file, []);
        }
        byFile.get(issue.file)!.push(issue);
      }

      for (const [file, fileIssues] of byFile) {
        const relativePath = file.replace(this.workspaceRoot + "/", "");
        message += `### ${relativePath}\n`;
        
        for (const issue of fileIssues) {
          message += `- Line ${issue.line}`;
          if (issue.column) message += `:${issue.column}`;
          message += `: ${issue.message}\n`;
          
          if (issue.codeSnippet) {
            message += `  \`\`\`\n  ${issue.codeSnippet}\n  \`\`\`\n`;
          }
          
          if (issue.suggestedFix) {
            message += `  **Suggested Fix**: ${issue.suggestedFix}\n`;
          }
        }
        message += "\n";
      }
    }

    message += this.getComprehensiveFixInstructions(issuesByType);
    message += this.getQualityRequirements();
    
    return message;
  }

  /**
   * Get comprehensive fix instructions
   */
  private getComprehensiveFixInstructions(issuesByType: Map<IssueType, ComprehensiveIssue[]>): string {
    let instructions = "\n## Comprehensive Fix Instructions:\n\n";
    
    // Add specific instructions for each issue type present
    const instructionMap: Partial<Record<IssueType, string>> = {
      "todo": "- Implement all TODO items with complete, production-ready code\n- Remove TODO comments after implementation\n",
      "hardcoded-secret": "- Move ALL secrets to environment variables\n- Add proper configuration management\n- Document required environment variables\n",
      "placeholder": "- Replace ALL placeholders with real implementations\n- Remove stub/mock/dummy code\n",
      "console-log": "- Remove ALL console.log statements\n- Replace with proper logging framework\n",
      "empty-catch": "- Add proper error handling in all catch blocks\n- Log errors appropriately\n- Implement recovery strategies\n",
      "missing-validation": "- Add comprehensive input validation\n- Check for null/undefined\n- Validate data types and ranges\n",
      "no-tests": "- Write comprehensive unit tests\n- Achieve >80% code coverage\n",
      "missing-docs": "- Add JSDoc/docstring comments\n- Document all public APIs\n",
      "security-vulnerability": "- Fix ALL security issues immediately\n- Follow OWASP guidelines\n",
      "memory-leak": "- Fix memory leaks\n- Ensure proper cleanup\n",
      "deprecated": "- Replace deprecated APIs with modern alternatives\n"
    };

    for (const type of issuesByType.keys()) {
      if (instructionMap[type]) {
        instructions += `### ${this.getIssueTypeTitle(type)}\n${instructionMap[type]}\n`;
      }
    }

    return instructions;
  }

  /**
   * Get quality requirements
   */
  private getQualityRequirements(): string {
    return `
## Quality Requirements:
1. ✅ ALL issues must be fixed completely
2. ✅ Code must remain functional after fixes
3. ✅ Follow project coding standards
4. ✅ No new issues introduced
5. ✅ All tests must pass
6. ✅ Security best practices followed
7. ✅ Performance not degraded
8. ✅ Proper error handling throughout
9. ✅ Clean, maintainable code
10. ✅ Production-ready implementations only

## IMPORTANT:
- Fix EVERY issue listed above
- Do not skip any issues
- Ensure comprehensive solutions
- Test your fixes
- Maintain backward compatibility
`;
  }

  /**
   * Queue message to Claude
   */
  private async queueMessage(
    message: string,
    severity: string,
    issues: ComprehensiveIssue[]
  ): Promise<void> {
    const priority = severity === "critical" ? 10 : 
                    severity === "error" ? 8 : 
                    severity === "warning" ? 5 : 3;

    const metadata: MessageMetadata = {
      source: "comprehensive-issue-handler",
      timestamp: Date.now(),
      priority,
      context: {
        issueCount: issues.length,
        issueTypes: [...new Set(issues.map(i => i.type))],
        severity,
        categories: [...new Set(issues.map(i => i.category))]
      }
    };

    addMessageToQueueFromWebview(message, undefined, metadata);
    this.processedCount++;
    debugLog(`Queued comprehensive fix message: ${severity} with ${issues.length} issues`);
  }

  /**
   * Queue master fix message
   */
  private async queueMasterFixMessage(
    report: string,
    allIssues: Map<string, ComprehensiveIssue[]>
  ): Promise<void> {
    const totalIssues = Array.from(allIssues.values()).flat().length;
    
    const message = `
🚨 COMPREHENSIVE PRODUCTION READINESS FIX REQUIRED 🚨

You need to fix ALL ${totalIssues} issues identified across the entire codebase.
This is a critical task to make the code production-ready.

${report}

## YOUR MISSION:
1. Fix EVERY single issue listed
2. Ensure NO issues remain
3. Make the code 100% production-ready
4. Follow all best practices
5. Implement complete solutions (no placeholders)

## Approach:
1. Start with critical security issues
2. Then fix errors and broken functionality  
3. Then handle warnings and code quality
4. Finally address style and documentation

## Success Criteria:
- ✅ All ${totalIssues} issues resolved
- ✅ Code passes all production readiness checks
- ✅ No new issues introduced
- ✅ All tests passing
- ✅ Code is secure, performant, and maintainable

Please proceed to fix ALL issues systematically. Do not skip any issues.
`;

    const metadata: MessageMetadata = {
      source: "master-fix-coordinator",
      timestamp: Date.now(),
      priority: 10, // Highest priority
      context: {
        type: "comprehensive-fix",
        totalIssues,
        fileCount: allIssues.size
      }
    };

    addMessageToQueueFromWebview(message, undefined, metadata);
    debugLog(`Queued master fix message for ${totalIssues} issues`);
  }

  /**
   * Process retry queue
   */
  private async processRetryQueue(): Promise<void> {
    if (this.retryQueue.length === 0) return;

    debugLog(`Processing retry queue with ${this.retryQueue.length} issues`);
    
    // Group retry issues and try one more time
    const message = this.createDetailedFixMessage(this.retryQueue, "RETRY");
    
    try {
      await this.queueMessage(message, "critical", this.retryQueue);
      this.retryQueue = [];
    } catch (error) {
      debugLog(`Retry queue processing failed: ${error}`);
    }
  }

  /**
   * Queue failure recovery message
   */
  private async queueFailureRecoveryMessage(error: any): Promise<void> {
    const message = `
⚠️ VALIDATION PROCESSING ERROR - MANUAL FIX REQUIRED

The automatic validation processing encountered an error.
Please manually review and fix all production readiness issues.

Error: ${error?.message || error}

## What to do:
1. Review all code for production readiness issues
2. Fix all TODOs, placeholders, and hardcoded values
3. Add proper error handling everywhere
4. Remove all console.log statements
5. Add comprehensive input validation
6. Ensure all tests pass
7. Add missing documentation
8. Review security best practices

Please ensure the code is 100% production-ready.
`;

    const metadata: MessageMetadata = {
      source: "error-recovery",
      timestamp: Date.now(),
      priority: 10
    };

    addMessageToQueueFromWebview(message, undefined, metadata);
  }

  // Helper methods

  private getIssueCategory(type: IssueType): ComprehensiveIssue["category"] {
    const categoryMap: Record<IssueType, ComprehensiveIssue["category"]> = {
      "todo": "quality",
      "hardcoded-secret": "security",
      "placeholder": "quality",
      "console-log": "quality",
      "commented-code": "quality",
      "dead-code": "quality",
      "magic-number": "quality",
      "long-method": "quality",
      "duplicate-code": "quality",
      "security-vulnerability": "security",
      "insecure-random": "security",
      "weak-crypto": "security",
      "path-traversal": "security",
      "command-injection": "security",
      "empty-catch": "quality",
      "generic-exception": "quality",
      "missing-error-handling": "quality",
      "swallowed-exception": "quality",
      "no-error-logging": "quality",
      "missing-validation": "quality",
      "weak-validation": "quality",
      "no-null-check": "quality",
      "no-bounds-check": "quality",
      "no-type-check": "quality",
      "no-tests": "testing",
      "failing-test": "testing",
      "disabled-test": "testing",
      "insufficient-coverage": "testing",
      "mock-in-production": "testing",
      "missing-docs": "documentation",
      "outdated-docs": "documentation",
      "no-api-docs": "documentation",
      "no-readme": "documentation",
      "n-plus-one": "performance",
      "memory-leak": "performance",
      "infinite-loop": "performance",
      "blocking-io": "performance",
      "inefficient-algorithm": "performance",
      "outdated-dependency": "other",
      "vulnerable-dependency": "security",
      "unused-dependency": "other",
      "missing-dependency": "other",
      "naming-convention": "style",
      "inconsistent-style": "style",
      "no-linting": "style",
      "formatting": "style",
      "circular-dependency": "architecture",
      "tight-coupling": "architecture",
      "god-class": "architecture",
      "layering-violation": "architecture",
      "deprecation": "other",
      "compatibility": "other",
      "accessibility": "other",
      "i18n": "other",
      "unknown": "other"
    };
    
    return categoryMap[type] || "other";
  }

  private calculatePriority(type: IssueType, severity: ComprehensiveIssue["severity"]): number {
    const basePriority = {
      "critical": 8,
      "error": 6,
      "warning": 4,
      "info": 2
    }[severity];

    const typeBonus = {
      "security-vulnerability": 2,
      "hardcoded-secret": 2,
      "command-injection": 2,
      "path-traversal": 2,
      "missing-error-handling": 1,
      "missing-validation": 1,
      "memory-leak": 1
    }[type] || 0;

    return Math.min(10, basePriority + typeBonus);
  }

  private isAutoFixable(type: IssueType): boolean {
    const autoFixable: IssueType[] = [
      "todo",
      "hardcoded-secret",
      "console-log",
      "placeholder",
      "empty-catch",
      "commented-code",
      "magic-number",
      "missing-validation",
      "no-null-check",
      "formatting",
      "naming-convention"
    ];
    
    return autoFixable.includes(type);
  }

  private getDefaultSeverity(type: IssueType): ComprehensiveIssue["severity"] {
    const severityMap: Record<IssueType, ComprehensiveIssue["severity"]> = {
      "security-vulnerability": "critical",
      "hardcoded-secret": "critical",
      "command-injection": "critical",
      "path-traversal": "critical",
      "weak-crypto": "critical",
      "vulnerable-dependency": "critical",
      "missing-error-handling": "error",
      "empty-catch": "error",
      "failing-test": "error",
      "missing-validation": "error",
      "memory-leak": "error",
      "infinite-loop": "error",
      "todo": "warning",
      "console-log": "warning",
      "placeholder": "warning",
      "deprecated": "warning",
      "outdated-dependency": "warning",
      "no-tests": "warning",
      "missing-docs": "info",
      "formatting": "info",
      "naming-convention": "info",
      "unknown": "info"
    };
    
    // Default mapping for any unmapped types
    return severityMap[type] || "warning";
  }

  private getDefaultPriority(type: IssueType): number {
    return this.calculatePriority(type, this.getDefaultSeverity(type));
  }

  private getIssueTypeTitle(type: IssueType): string {
    const titles: Record<IssueType, string> = {
      "todo": "TODO/FIXME Comments",
      "hardcoded-secret": "Hardcoded Secrets",
      "placeholder": "Placeholder Code",
      "console-log": "Console Logging",
      "commented-code": "Commented Code",
      "dead-code": "Dead Code",
      "magic-number": "Magic Numbers",
      "long-method": "Long Methods",
      "duplicate-code": "Duplicate Code",
      "security-vulnerability": "Security Vulnerabilities",
      "insecure-random": "Insecure Random",
      "weak-crypto": "Weak Cryptography",
      "path-traversal": "Path Traversal",
      "command-injection": "Command Injection",
      "empty-catch": "Empty Catch Blocks",
      "generic-exception": "Generic Exceptions",
      "missing-error-handling": "Missing Error Handling",
      "swallowed-exception": "Swallowed Exceptions",
      "no-error-logging": "No Error Logging",
      "missing-validation": "Missing Validation",
      "weak-validation": "Weak Validation",
      "no-null-check": "No Null Checks",
      "no-bounds-check": "No Bounds Checking",
      "no-type-check": "No Type Checking",
      "no-tests": "No Tests",
      "failing-test": "Failing Tests",
      "disabled-test": "Disabled Tests",
      "insufficient-coverage": "Insufficient Coverage",
      "mock-in-production": "Mocks in Production",
      "missing-docs": "Missing Documentation",
      "outdated-docs": "Outdated Documentation",
      "no-api-docs": "No API Documentation",
      "no-readme": "No README",
      "n-plus-one": "N+1 Queries",
      "memory-leak": "Memory Leaks",
      "infinite-loop": "Infinite Loops",
      "blocking-io": "Blocking I/O",
      "inefficient-algorithm": "Inefficient Algorithms",
      "outdated-dependency": "Outdated Dependencies",
      "vulnerable-dependency": "Vulnerable Dependencies",
      "unused-dependency": "Unused Dependencies",
      "missing-dependency": "Missing Dependencies",
      "naming-convention": "Naming Conventions",
      "inconsistent-style": "Inconsistent Style",
      "no-linting": "Linting Issues",
      "formatting": "Formatting Issues",
      "circular-dependency": "Circular Dependencies",
      "tight-coupling": "Tight Coupling",
      "god-class": "God Classes",
      "layering-violation": "Layering Violations",
      "deprecation": "Deprecated APIs",
      "compatibility": "Compatibility Issues",
      "accessibility": "Accessibility Issues",
      "i18n": "Internationalization",
      "unknown": "Unknown Issues"
    };
    
    return titles[type] || type.toUpperCase();
  }

  private parseLocationFromMessage(message: string): { file: string; line: number; column: number } {
    // Try various patterns to extract file location
    const patterns = [
      /^([^:]+):(\d+):(\d+):\s*(.+)$/,  // file.ts:10:5: message
      /^([^:]+):(\d+):\s*(.+)$/,         // file.ts:10: message
      /\[([^:]+):(\d+):?(\d+)?\]/,       // [file.ts:10:5] or [file.ts:10]
      /in\s+([^\s]+)\s+at\s+line\s+(\d+)/i, // in file.ts at line 10
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          file: match[1],
          line: parseInt(match[2], 10) || 0,
          column: parseInt(match[3], 10) || 0
        };
      }
    }

    return { file: "", line: 0, column: 0 };
  }

  private extractIssuesFromRawText(rawText: string, allIssues: Map<string, ComprehensiveIssue[]>): void {
    const lines = rawText.split('\n');
    
    for (const line of lines) {
      // Look for issue patterns in raw text
      for (const [type, patterns] of this.issuePatterns) {
        for (const pattern of patterns) {
          if (pattern.test(line)) {
            const location = this.parseLocationFromMessage(line);
            const issue: ComprehensiveIssue = {
              type,
              file: location.file || "unknown",
              line: location.line,
              column: location.column,
              message: line.trim(),
              severity: this.getDefaultSeverity(type),
              category: this.getIssueCategory(type),
              priority: this.getDefaultPriority(type),
              autoFixable: this.isAutoFixable(type)
            };
            
            const file = issue.file;
            if (!allIssues.has(file)) {
              allIssues.set(file, []);
            }
            allIssues.get(file)!.push(issue);
          }
        }
      }
    }
  }

  /**
   * Generate comprehensive report
   */
  private generateComprehensiveReport(allIssues: Map<string, ComprehensiveIssue[]>): string {
    const totalIssues = Array.from(allIssues.values()).flat();
    const byCategory = new Map<string, number>();
    const bySeverity = new Map<string, number>();
    const byType = new Map<IssueType, number>();

    for (const issue of totalIssues) {
      byCategory.set(issue.category, (byCategory.get(issue.category) || 0) + 1);
      bySeverity.set(issue.severity, (bySeverity.get(issue.severity) || 0) + 1);
      byType.set(issue.type, (byType.get(issue.type) || 0) + 1);
    }

    let report = `# Comprehensive Issue Report\n\n`;
    report += `## Summary\n`;
    report += `- Total Issues: ${totalIssues.length}\n`;
    report += `- Files Affected: ${allIssues.size}\n\n`;
    
    report += `## By Severity\n`;
    for (const [severity, count] of bySeverity) {
      report += `- ${severity}: ${count}\n`;
    }
    
    report += `\n## By Category\n`;
    for (const [category, count] of byCategory) {
      report += `- ${category}: ${count}\n`;
    }
    
    report += `\n## Top Issue Types\n`;
    const sortedTypes = Array.from(byType.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    for (const [type, count] of sortedTypes) {
      report += `- ${this.getIssueTypeTitle(type)}: ${count}\n`;
    }

    return report;
  }
}

// Export singleton
let instance: ComprehensiveIssueHandler | null = null;

export function getComprehensiveIssueHandler(workspaceRoot?: string): ComprehensiveIssueHandler {
  if (!instance && workspaceRoot) {
    instance = new ComprehensiveIssueHandler(workspaceRoot);
  }
  if (!instance) {
    throw new Error("ComprehensiveIssueHandler not initialized");
  }
  return instance;
}

export function resetComprehensiveIssueHandler(): void {
  instance = null;
}