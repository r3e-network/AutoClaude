import * as vscode from "vscode";
import { issueFixerAgent, ProductionIssue } from "../automation/IssueFixerAgent";
import * as path from "path";

export async function testAutoFixCommand(): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel("AutoClaude Auto-Fix Test");
  outputChannel.show();
  
  outputChannel.appendLine("Testing automatic issue fixing...\n");
  
  // Get the test file
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("No workspace folder open");
    return;
  }
  
  const testFile = path.join(workspaceFolders[0].uri.fsPath, "test-issue-fixing.ts");
  
  // Check if test file exists
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(testFile));
  } catch {
    vscode.window.showErrorMessage("Test file not found. Please create test-issue-fixing.ts in workspace root");
    return;
  }
  
  // Create test issues based on the file
  const issues: ProductionIssue[] = [
    {
      type: "todo",
      file: testFile,
      line: 6,
      message: "TODO: Implement user authentication",
      severity: "warning",
      fixable: true
    },
    {
      type: "hardcoded-secret",
      file: testFile,
      line: 11,
      message: "Hardcoded password detected",
      severity: "critical",
      fixable: true
    },
    {
      type: "hardcoded-secret",
      file: testFile,
      line: 12,
      message: "API key should not be hardcoded",
      severity: "critical",
      fixable: true
    },
    {
      type: "console-log",
      file: testFile,
      line: 15,
      message: "Console.log should be removed",
      severity: "warning",
      fixable: true
    },
    {
      type: "console-log",
      file: testFile,
      line: 16,
      message: "Console.error should be removed",
      severity: "warning",
      fixable: true
    },
    {
      type: "placeholder",
      file: testFile,
      line: 21,
      message: "Not implemented placeholder",
      severity: "error",
      fixable: true
    },
    {
      type: "placeholder",
      file: testFile,
      line: 34,
      message: "EXAMPLE placeholder should be replaced",
      severity: "error",
      fixable: true
    }
  ];
  
  outputChannel.appendLine(`Found ${issues.length} issues to fix:\n`);
  for (const issue of issues) {
    outputChannel.appendLine(`- ${issue.type} at line ${issue.line}: ${issue.message}`);
  }
  
  outputChannel.appendLine("\nFixing issues...");
  
  try {
    // Fix issues
    const fixedCount = await issueFixerAgent.fixIssuesInFile(testFile, issues);
    
    outputChannel.appendLine(`\n✅ Fixed ${fixedCount} issues`);
    
    // Generate report
    const report = issueFixerAgent.generateFixReport();
    outputChannel.appendLine("\nFix Report:");
    outputChannel.appendLine(report);
    
    // Show success message
    const action = await vscode.window.showInformationMessage(
      `Successfully fixed ${fixedCount} production readiness issues!`,
      "View File",
      "View Report"
    );
    
    if (action === "View File") {
      const doc = await vscode.workspace.openTextDocument(testFile);
      await vscode.window.showTextDocument(doc);
    } else if (action === "View Report") {
      outputChannel.show();
    }
    
  } catch (error) {
    outputChannel.appendLine(`\n❌ Error: ${error}`);
    vscode.window.showErrorMessage(`Failed to fix issues: ${error}`);
  }
}

// Register command
export function registerTestAutoFixCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    "autoclaude.testAutoFix",
    testAutoFixCommand
  );
  context.subscriptions.push(disposable);
}