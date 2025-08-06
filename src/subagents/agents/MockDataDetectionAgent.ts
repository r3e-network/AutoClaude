import * as fs from "fs";
import * as path from "path";
import { BaseProductionAgent } from "../BaseProductionAgent";
import { debugLog } from "../../utils/logging";

interface MockDataIssue {
  file: string;
  line: number;
  type: string;
  pattern: string;
  content: string;
  severity: "error" | "warning";
  suggestion: string;
}

export class MockDataDetectionAgent extends BaseProductionAgent {
  name = "Mock Data Detection Agent";
  description = "Detects and reports mock, sample, and placeholder data in production code";
  capabilities = [
    "Detect sample and example data",
    "Find mock implementations",
    "Identify test values and IDs",
    "Detect placeholder names and emails",
    "Find temporary code comments",
    "Validate production readiness"
  ];

  // Comprehensive patterns for detecting mock/sample data
  private readonly mockPatterns = [
    // Sample data patterns
    {
      pattern: /\/\/.*(?:sample|example)\s+data/gi,
      type: "SAMPLE_DATA",
      severity: "error" as const,
      message: "Sample data comment found",
      suggestion: "Remove sample data and implement real data fetching"
    },
    {
      pattern: /return\s+\[[\s\S]*?(?:abc123|def456|test|dummy|sample)[\s\S]*?\]/gi,
      type: "HARDCODED_TEST_DATA",
      severity: "error" as const,
      message: "Hardcoded test data in return statement",
      suggestion: "Replace with actual data from database or API"
    },
    {
      pattern: /(?:mock|dummy|fake|sample)(?:Data|Service|Client|Response|Implementation)/gi,
      type: "MOCK_IMPLEMENTATION",
      severity: "error" as const,
      message: "Mock implementation found",
      suggestion: "Replace mock with real implementation"
    },
    {
      pattern: /["'](?:abc123|def456|xyz789|123456|test-id|dummy-id)["']/g,
      type: "TEST_ID",
      severity: "error" as const,
      message: "Hardcoded test ID found",
      suggestion: "Use generated IDs or fetch from database"
    },
    {
      pattern: /["'](?:John Doe|Jane Doe|Test User|Sample User)["']/gi,
      type: "PLACEHOLDER_NAME",
      severity: "error" as const,
      message: "Placeholder name found",
      suggestion: "Use real user data or configuration"
    },
    {
      pattern: /["'](?:test@example\.com|sample@test\.com|user@example\.com)["']/gi,
      type: "TEST_EMAIL",
      severity: "error" as const,
      message: "Test email address found",
      suggestion: "Use real email addresses from user data"
    },
    {
      pattern: /["'](?:https?:\/\/)?(?:example|test|sample|dummy)\.(?:com|org|net)["']/g,
      type: "TEST_URL",
      severity: "error" as const,
      message: "Test URL found",
      suggestion: "Use environment variables or configuration for URLs"
    },
    {
      pattern: /lorem\s+ipsum/gi,
      type: "LOREM_IPSUM",
      severity: "error" as const,
      message: "Lorem ipsum placeholder text found",
      suggestion: "Replace with actual content"
    },
    {
      pattern: /\/\/.*(?:for now|temporarily|will be replaced|to be implemented)/gi,
      type: "TEMPORARY_CODE",
      severity: "warning" as const,
      message: "Temporary implementation comment",
      suggestion: "Complete the implementation or remove temporary code"
    },
    {
      pattern: /(?:foo|bar|baz)(?:\d+)?(?:\s*[,;\]}])/g,
      type: "PLACEHOLDER_VALUE",
      severity: "warning" as const,
      message: "Common placeholder value found",
      suggestion: "Use meaningful variable names and values"
    },
    {
      pattern: /TODO:.*(?:implement|add|create|fix)/gi,
      type: "UNIMPLEMENTED",
      severity: "error" as const,
      message: "Unimplemented functionality",
      suggestion: "Complete the implementation before production"
    },
    {
      pattern: /throw\s+new\s+Error\s*\(\s*["']Not implemented["']\s*\)/gi,
      type: "NOT_IMPLEMENTED",
      severity: "error" as const,
      message: "Not implemented error",
      suggestion: "Implement the functionality or remove the method"
    },
    {
      pattern: /console\.(log|debug|info|warn|error)\s*\(/g,
      type: "DEBUG_STATEMENT",
      severity: "warning" as const,
      message: "Console statement found",
      suggestion: "Use proper logging framework instead of console"
    },
    {
      pattern: /localhost:\d+|127\.0\.0\.1:\d+/g,
      type: "HARDCODED_HOST",
      severity: "error" as const,
      message: "Hardcoded localhost URL",
      suggestion: "Use environment variables for host configuration"
    }
  ];

  // Files and directories to exclude
  private readonly excludePatterns = [
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
    /\.mock\.[jt]sx?$/,
    /__tests__/,
    /__mocks__/,
    /test\//,
    /tests\//,
    /mock\//,
    /mocks\//,
    /fixtures\//,
    /\.d\.ts$/,
    /node_modules/,
    /dist\//,
    /build\//,
    /coverage\//
  ];

  async executeSimple(spec?: string): Promise<{ success: boolean; message: string; data?: any; confidence?: string; suggestions?: string[] }> {
    const workspacePath = spec || this.workspaceRoot;
    try {
      debugLog(`MockDataDetectionAgent: Starting scan of ${workspacePath}`);
      
      const issues: MockDataIssue[] = [];
      const srcDir = path.join(workspacePath, "src");
      
      if (!fs.existsSync(srcDir)) {
        return {
          success: false,
          message: "No src directory found in workspace",
          data: { error: "Source directory not found" },
          confidence: "high"
        };
      }

      // Scan all files in the project
      this.scanDirectory(srcDir, issues);

      // Analyze results
      const criticalIssues = issues.filter(i => i.severity === "error");
      const warnings = issues.filter(i => i.severity === "warning");

      // Generate report
      const report = this.generateReport(issues);

      // Determine success based on critical issues
      const success = criticalIssues.length === 0;

      return {
        success,
        message: success 
          ? `✅ No mock data found in production code. ${warnings.length} warnings.`
          : `❌ Found ${criticalIssues.length} critical mock data issues and ${warnings.length} warnings`,
        data: {
          totalIssues: issues.length,
          criticalIssues: criticalIssues.length,
          warnings: warnings.length,
          issues: issues.slice(0, 100), // Limit to first 100 issues
          report,
          summary: this.generateSummary(issues)
        },
        confidence: "high",
        suggestions: this.generateSuggestions(issues)
      };

    } catch (error) {
      debugLog(`MockDataDetectionAgent: Error during scan - ${error}`);
      return {
        success: false,
        message: `Error scanning for mock data: ${error instanceof Error ? error.message : String(error)}`,
        data: { error: String(error) },
        confidence: "low"
      };
    }
  }

  private scanDirectory(dir: string, issues: MockDataIssue[]): void {
    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        
        // Skip if matches exclude pattern
        if (this.shouldExclude(fullPath)) {
          continue;
        }

        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          this.scanDirectory(fullPath, issues);
        } else if (stat.isFile() && this.isSourceFile(item)) {
          this.scanFile(fullPath, issues);
        }
      }
    } catch (error) {
      debugLog(`Error scanning directory ${dir}: ${error}`);
    }
  }

  private scanFile(filePath: string, issues: MockDataIssue[]): void {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (const patternDef of this.mockPatterns) {
        const matches = content.matchAll(patternDef.pattern);
        
        for (const match of matches) {
          const lineNumber = content.substring(0, match.index).split("\n").length;
          const line = lines[lineNumber - 1] || "";
          
          issues.push({
            file: filePath,
            line: lineNumber,
            type: patternDef.type,
            pattern: patternDef.pattern.source.substring(0, 50) + "...",
            content: line.trim().substring(0, 100),
            severity: patternDef.severity,
            suggestion: patternDef.suggestion
          });
        }
      }
    } catch (error) {
      debugLog(`Error scanning file ${filePath}: ${error}`);
    }
  }

  private shouldExclude(filePath: string): boolean {
    return this.excludePatterns.some(pattern => pattern.test(filePath));
  }

  private isSourceFile(filename: string): boolean {
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
    return extensions.some(ext => filename.endsWith(ext));
  }

  private generateReport(issues: MockDataIssue[]): string {
    if (issues.length === 0) {
      return "✅ No mock or sample data detected in production code!";
    }

    const byType = new Map<string, MockDataIssue[]>();
    
    for (const issue of issues) {
      if (!byType.has(issue.type)) {
        byType.set(issue.type, []);
      }
      byType.get(issue.type)!.push(issue);
    }

    let report = `# Mock Data Detection Report\n\n`;
    report += `Total Issues: ${issues.length}\n\n`;

    for (const [type, typeIssues] of byType) {
      report += `## ${type} (${typeIssues.length} instances)\n\n`;
      
      // Show first 5 examples
      const examples = typeIssues.slice(0, 5);
      for (const issue of examples) {
        const relativePath = issue.file.replace(process.cwd(), "");
        report += `- ${relativePath}:${issue.line}\n`;
        report += `  \`${issue.content}\`\n`;
        report += `  💡 ${issue.suggestion}\n\n`;
      }
      
      if (typeIssues.length > 5) {
        report += `... and ${typeIssues.length - 5} more\n\n`;
      }
    }

    return report;
  }

  private generateSummary(issues: MockDataIssue[]): Record<string, number> {
    const summary: Record<string, number> = {};
    
    for (const issue of issues) {
      summary[issue.type] = (summary[issue.type] || 0) + 1;
    }
    
    return summary;
  }

  private generateSuggestions(issues: MockDataIssue[]): string[] {
    const suggestions: string[] = [];
    
    if (issues.length === 0) {
      suggestions.push("✅ Code is clean - no mock data detected!");
      return suggestions;
    }

    const criticalCount = issues.filter(i => i.severity === "error").length;
    const warningCount = issues.filter(i => i.severity === "warning").length;

    if (criticalCount > 0) {
      suggestions.push(`🔴 Fix ${criticalCount} critical mock data issues before production`);
    }

    if (warningCount > 0) {
      suggestions.push(`🟡 Review ${warningCount} warnings for potential improvements`);
    }

    // Type-specific suggestions
    const types = new Set(issues.map(i => i.type));
    
    if (types.has("SAMPLE_DATA") || types.has("HARDCODED_TEST_DATA")) {
      suggestions.push("Replace all sample data with real data from databases or APIs");
    }
    
    if (types.has("MOCK_IMPLEMENTATION")) {
      suggestions.push("Replace mock implementations with production-ready code");
    }
    
    if (types.has("TEST_ID") || types.has("TEST_EMAIL") || types.has("TEST_URL")) {
      suggestions.push("Use environment variables for configuration instead of hardcoded test values");
    }
    
    if (types.has("TEMPORARY_CODE")) {
      suggestions.push("Complete all temporary implementations before deployment");
    }
    
    if (types.has("NOT_IMPLEMENTED") || types.has("UNIMPLEMENTED")) {
      suggestions.push("Implement all pending functionality or remove unused code");
    }
    
    if (types.has("DEBUG_STATEMENT")) {
      suggestions.push("Replace console statements with proper logging framework");
    }
    
    if (types.has("HARDCODED_HOST")) {
      suggestions.push("Move hardcoded URLs to environment configuration");
    }

    // General recommendations
    suggestions.push("Run 'npm run mock-check' regularly to prevent mock data");
    suggestions.push("Add pre-commit hooks to catch mock data before commits");
    suggestions.push("Consider adding this check to your CI/CD pipeline");

    return suggestions;
  }
}

// Register the agent
export default MockDataDetectionAgent;