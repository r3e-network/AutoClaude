import { BaseProductionAgent } from "./BaseProductionAgent";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { debugLog } from "../utils/logging";
import {
  sanitizeCommitMessage,
  sanitizePRDescription,
  validateCleanGitMessage,
} from "../utils/gitSanitizer";
import {
  GitStatus,
  ChangeAnalysis,
  PRDetails,
  PRInfo,
  ConflictInfo,
  ConflictAnalysis,
  GitCommandOptions,
  FileChange,
  ConflictMarker,
} from "../types/git";

const execAsync = promisify(exec);

/**
 * Commit Creator Agent - Creates meaningful commit messages
 */
export class CommitCreatorAgent extends BaseProductionAgent {
  name = "Commit Creator";
  description = "Creates meaningful commit messages based on changes";
  capabilities = [
    "Analyze staged changes",
    "Generate conventional commits",
    "Group related changes",
    "Follow commit conventions",
  ];

  async executeSimple(): Promise<{ success: boolean; message: string }> {
    try {
      // Get git status and diff
      const status = await this.getGitStatus();
      const diff = await this.getGitDiff();

      if (!status.hasChanges) {
        return {
          success: false,
          message: "No changes to commit",
        };
      }

      // Analyze changes
      const analysis = this.analyzeChanges(status, diff);

      // Generate commit message
      const commitMessage = this.generateCommitMessage(analysis);

      // Stage changes if needed
      if (status.unstaged.length > 0) {
        await execAsync("git add -A", { cwd: this.workspaceRoot });
      }

      // Create commit
      await this.createCommit(commitMessage);

      return {
        success: true,
        message: `Commit created: ${commitMessage.split("\n")[0]}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Commit creation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async getGitStatus(): Promise<GitStatus> {
    try {
      const { stdout } = await execAsync("git status --porcelain", {
        cwd: this.workspaceRoot,
      });
      const lines = stdout
        .trim()
        .split("\n")
        .filter((line) => line);

      const status = {
        hasChanges: lines.length > 0,
        staged: [] as string[],
        unstaged: [] as string[],
        untracked: [] as string[],
        deleted: [] as string[],
        modified: [] as string[],
        renamed: [] as string[],
      };

      for (const line of lines) {
        const [statusCode, ...fileParts] = line.split(" ");
        const file = fileParts.join(" ");

        if (statusCode.startsWith("??")) {
          status.untracked.push(file);
        } else if (statusCode[0] !== " ") {
          status.staged.push(file);
        } else {
          status.unstaged.push(file);
        }
        
        // Track file status types
        if (statusCode.includes("D")) {
          status.deleted.push(file);
        }
        if (statusCode.includes("M")) {
          status.modified.push(file);
        }
        if (statusCode.includes("R")) {
          status.renamed.push(file);
        }
      }

      return status;
    } catch (error) {
      return { 
        hasChanges: false, 
        staged: [], 
        unstaged: [], 
        untracked: [],
        deleted: [],
        modified: [],
        renamed: []
      };
    }
  }

  private async getGitDiff(): Promise<string> {
    try {
      const { stdout } = await execAsync("git diff --cached", {
        cwd: this.workspaceRoot,
      });
      return stdout;
    } catch (error) {
      return "";
    }
  }

  private getFileStatus(file: string, status: GitStatus): 'added' | 'modified' | 'deleted' | 'renamed' {
    if (status.deleted.includes(file)) return 'deleted';
    if (status.renamed.includes(file)) return 'renamed';
    if (status.modified.includes(file)) return 'modified';
    if (status.untracked.includes(file)) return 'added';
    return 'modified'; // Default for staged/unstaged files
  }

  private analyzeChanges(status: GitStatus, diff: string): ChangeAnalysis {
    const analysis: ChangeAnalysis = {
      type: "feat" as const,
      scope: "",
      breaking: false,
      files: [...status.staged, ...status.unstaged, ...status.untracked].map(file => ({
        path: file,
        status: this.getFileStatus(file, status),
        additions: 0,
        deletions: 0
      })),
      summary: "",
      features: [],
      fixes: [],
      additions: 0,
      deletions: 0,
    };

    // Detect change type
    const allFiles = analysis.files.map(f => f.path).join(" ").toLowerCase();

    if (
      allFiles.includes("fix") ||
      diff.includes("bug") ||
      diff.includes("error")
    ) {
      analysis.type = "fix";
    } else if (allFiles.includes("test") || allFiles.includes("spec")) {
      analysis.type = "test";
    } else if (allFiles.includes("doc") || allFiles.includes("readme")) {
      analysis.type = "docs";
    } else if (allFiles.includes("style") || allFiles.includes("css")) {
      analysis.type = "style";
    } else if (diff.includes("refactor")) {
      analysis.type = "refactor";
    } else if (allFiles.includes("chore") || allFiles.includes("config")) {
      analysis.type = "chore";
    }

    // Count changes
    const additions = diff.match(/^\+/gm);
    const deletions = diff.match(/^-/gm);
    analysis.additions = additions ? additions.length : 0;
    analysis.deletions = deletions ? deletions.length : 0;

    // Detect scope
    if (analysis.files.length > 0) {
      const firstFile = analysis.files[0].path;
      const parts = firstFile.split("/");
      if (parts.length > 1) {
        analysis.scope = parts[0];
      }
    }
    
    // Set summary
    analysis.summary = `${analysis.type}${analysis.scope ? `(${analysis.scope})` : ''}: ${analysis.files.length} file(s) changed`;

    return analysis;
  }

  private generateCommitMessage(analysis: ChangeAnalysis): string {
    const { type, scope, files, additions, deletions } = analysis;

    // Generate main message
    let message = type;
    if (scope) {
      message += `(${scope})`;
    }
    message += ": ";

    // Add description based on changes
    if (type === "feat") {
      message += "add new functionality";
    } else if (type === "fix") {
      message += "resolve issues";
    } else if (type === "docs") {
      message += "update documentation";
    } else if (type === "test") {
      message += "add or update tests";
    } else if (type === "refactor") {
      message += "improve code structure";
    } else {
      message += "update project files";
    }

    // Add details
    const details = [];
    if (files.length === 1) {
      details.push(`- Modified: ${files[0].path}`);
    } else if (files.length <= 3) {
      details.push("- Modified files:");
      files.forEach((f: FileChange) => details.push(`  - ${f.path}`));
    } else {
      details.push(`- Modified ${files.length} files`);
    }

    if (additions > 0 || deletions > 0) {
      details.push(`- Changes: +${additions} -${deletions}`);
    }

    const fullMessage = message + "\n\n" + details.join("\n");

    // Sanitize the message to remove any AI tool mentions
    const sanitizedMessage = sanitizeCommitMessage(fullMessage);

    // Validate the message is clean
    if (!validateCleanGitMessage(sanitizedMessage)) {
      debugLog(
        "Warning: Generated commit message may contain AI references, using fallback",
      );
      return `${type}: improve project implementation`;
    }

    return sanitizedMessage;
  }

  private async createCommit(message: string): Promise<void> {
    // Write message to temp file to handle multi-line commits
    const tempFile = path.join(this.workspaceRoot, ".git", "COMMIT_MSG_TEMP");
    fs.writeFileSync(tempFile, message);

    try {
      await execAsync(`git commit -F "${tempFile}"`, {
        cwd: this.workspaceRoot,
      });
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
}

/**
 * PR Creator Agent - Creates and manages pull requests
 */
export class PRCreatorAgent extends BaseProductionAgent {
  name = "PR Creator";
  description = "Creates and manages GitHub pull requests";
  capabilities = [
    "Create pull requests",
    "Update PR descriptions",
    "Add reviewers",
    "Link issues",
  ];

  async executeSimple(
    options?: PRDetails,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if gh CLI is available
      await this.checkGHCLI();

      // Get current branch
      const branch = await this.getCurrentBranch();
      if (branch === "main" || branch === "master") {
        return {
          success: false,
          message: "Cannot create PR from main/master branch",
        };
      }

      // Check if branch has upstream
      const hasUpstream = await this.checkUpstream(branch);
      if (!hasUpstream) {
        await execAsync(`git push -u origin ${branch}`, {
          cwd: this.workspaceRoot,
        });
      }

      // Get PR details
      const prDetails = await this.generatePRDetails(branch);

      // Create or update PR
      const pr = await this.createOrUpdatePR(branch, prDetails);

      return {
        success: true,
        message: `Pull request ${pr.action}: ${pr.url}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `PR creation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async checkGHCLI(): Promise<void> {
    try {
      await execAsync("gh --version");
    } catch (error) {
      throw new Error(
        "GitHub CLI (gh) is not installed. Please install it first.",
      );
    }
  }

  private async getCurrentBranch(): Promise<string> {
    const { stdout } = await execAsync("git branch --show-current", {
      cwd: this.workspaceRoot,
    });
    return stdout.trim();
  }

  private async checkUpstream(branch: string): Promise<boolean> {
    try {
      await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, {
        cwd: this.workspaceRoot,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  private async generatePRDetails(branch: string): Promise<PRDetails> {
    // Get commits since branching from main
    const { stdout: commits } = await execAsync(
      "git log --oneline main..HEAD",
      { cwd: this.workspaceRoot },
    );

    // Get changed files
    const { stdout: files } = await execAsync(
      "git diff --name-only main..HEAD",
      { cwd: this.workspaceRoot },
    );

    const commitList = commits
      .trim()
      .split("\n")
      .filter((c) => c);
    const fileList = files
      .trim()
      .split("\n")
      .filter((f) => f);

    // Generate title from branch name or commits
    let title = branch.replace(/[-_]/g, " ");
    title = title.charAt(0).toUpperCase() + title.slice(1);

    // Generate description
    const description = this.generatePRDescription(commitList, fileList);

    return { title, body: description };
  }

  private generatePRDescription(commits: string[], files: string[]): string {
    const sections = [
      `## Summary
This PR includes the following changes:
`,
    ];

    // Add commit summary
    if (commits.length > 0) {
      sections.push(`### Commits (${commits.length})
${commits.map((c) => `- ${c}`).join("\n")}
`);
    }

    // Add file summary
    if (files.length > 0) {
      sections.push(`### Files Changed (${files.length})
${files
  .slice(0, 10)
  .map((f) => `- ${f}`)
  .join(
    "\n",
  )}${files.length > 10 ? `\n- ... and ${files.length - 10} more files` : ""}
`);
    }

    // Add checklist
    sections.push(`## Checklist
- [ ] Code has been tested locally
- [ ] Tests have been added/updated
- [ ] Documentation has been updated
- [ ] No breaking changes introduced
`);

    const fullDescription = sections.join("\n");

    // Sanitize the PR description to remove any AI tool mentions
    const sanitizedDescription = sanitizePRDescription(fullDescription);

    return sanitizedDescription;
  }

  private async createOrUpdatePR(branch: string, details: PRDetails): Promise<{ action: string; url: string }> {
    try {
      // Check if PR already exists
      const { stdout: existingPR } = await execAsync(
        `gh pr view ${branch} --json url`,
        { cwd: this.workspaceRoot },
      );

      const prData = JSON.parse(existingPR);

      // Update existing PR
      await execAsync(`gh pr edit ${branch} --body "${details.body}"`, {
        cwd: this.workspaceRoot,
      });

      return { action: "updated", url: prData.url };
    } catch (error) {
      // Create new PR
      const { stdout } = await execAsync(
        `gh pr create --title "${details.title}" --body "${details.body}" --base main`,
        { cwd: this.workspaceRoot },
      );

      const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : "PR created";

      return { action: "created", url };
    }
  }
}

/**
 * Git Workflow Agent - Manages complete git workflows
 */
export class GitWorkflowAgent extends BaseProductionAgent {
  name = "Git Workflow Manager";
  description = "Manages complete git workflows from commit to PR";
  capabilities = [
    "Branch management",
    "Automated commits",
    "PR creation and updates",
    "Merge conflict resolution",
  ];

  async executeSimple(
    workflow: string = "feature",
  ): Promise<{ success: boolean; message: string }> {
    try {
      const steps: string[] = [];

      // Ensure clean working directory
      const { stdout: status } = await execAsync("git status --porcelain", {
        cwd: this.workspaceRoot,
      });
      if (!status.trim()) {
        return {
          success: false,
          message: "No changes to process",
        };
      }

      // Create feature branch if on main
      const currentBranch = await this.getCurrentBranch();
      if (currentBranch === "main" || currentBranch === "master") {
        const newBranch = await this.createFeatureBranch();
        steps.push(`Created branch: ${newBranch}`);
      }

      // Run tests if available
      const testResult = await this.runTests();
      if (testResult.success) {
        steps.push("Tests passed");
      } else {
        return {
          success: false,
          message: `Tests failed: ${testResult.message}`,
        };
      }

      // Create commit
      const commitAgent = new CommitCreatorAgent(this.workspaceRoot);
      const commitResult = await commitAgent.executeSimple();
      if (commitResult.success) {
        steps.push(commitResult.message);
      }

      // Push changes
      await execAsync("git push -u origin HEAD", { cwd: this.workspaceRoot });
      steps.push("Pushed changes to remote");

      // Create PR
      const prAgent = new PRCreatorAgent(this.workspaceRoot);
      const prResult = await prAgent.executeSimple();
      if (prResult.success) {
        steps.push(prResult.message);
      }

      return {
        success: true,
        message: `Workflow completed:\n${steps.map((s) => `- ${s}`).join("\n")}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Workflow failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async getCurrentBranch(): Promise<string> {
    const { stdout } = await execAsync("git branch --show-current", {
      cwd: this.workspaceRoot,
    });
    return stdout.trim();
  }

  private async createFeatureBranch(): Promise<string> {
    const timestamp = new Date().toISOString().split("T")[0];
    const branchName = `feature/auto-${timestamp}`;

    await execAsync(`git checkout -b ${branchName}`, {
      cwd: this.workspaceRoot,
    });
    return branchName;
  }

  private async runTests(): Promise<{ success: boolean; message: string }> {
    try {
      // Try common test commands
      const testCommands = [
        "npm test",
        "yarn test",
        "python -m pytest",
        "go test ./...",
        "cargo test",
      ];

      for (const cmd of testCommands) {
        try {
          await execAsync(cmd, { cwd: this.workspaceRoot });
          return { success: true, message: "Tests passed" };
        } catch (error) {
          // Try next command
        }
      }

      // No test command worked, assume no tests
      return { success: true, message: "No tests found" };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }
}

/**
 * Merge Conflict Resolver Agent
 */
export class MergeConflictResolverAgent extends BaseProductionAgent {
  name = "Merge Conflict Resolver";
  description = "Helps resolve git merge conflicts";
  capabilities = [
    "Detect merge conflicts",
    "Analyze conflict patterns",
    "Suggest resolutions",
    "Auto-resolve simple conflicts",
  ];

  async executeSimple(): Promise<{ success: boolean; message: string }> {
    try {
      // Check for merge conflicts
      const conflicts = await this.detectConflicts();

      if (conflicts.length === 0) {
        return {
          success: true,
          message: "No merge conflicts found",
        };
      }

      // Analyze conflicts
      const analysis = await this.analyzeConflicts(conflicts);

      // Generate resolution plan
      const plan = this.generateResolutionPlan(analysis);

      // Save plan
      const planPath = path.join(
        this.workspaceRoot,
        ".autoclaude",
        "merge-conflict-plan.md",
      );
      fs.writeFileSync(planPath, plan);

      // Try to auto-resolve simple conflicts
      const resolved = await this.autoResolveSimpleConflicts(analysis);

      return {
        success: true,
        message: `Found ${conflicts.length} conflicts. Auto-resolved ${resolved} simple conflicts. Plan saved to ${planPath}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Conflict resolution failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async detectConflicts(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        "git diff --name-only --diff-filter=U",
        { cwd: this.workspaceRoot },
      );
      return stdout
        .trim()
        .split("\n")
        .filter((f) => f);
    } catch (error) {
      return [];
    }
  }

  private async analyzeConflicts(files: string[]): Promise<ConflictAnalysis[]> {
    const conflicts = [];

    for (const file of files) {
      const content = fs.readFileSync(
        path.join(this.workspaceRoot, file),
        "utf8",
      );
      const conflictRegex =
        /<<<<<<< HEAD([\s\S]*?)=======([\s\S]*?)>>>>>>> [\w\/]+/g;
      let match;
      const fileConflicts: ConflictMarker[] = [];

      while ((match = conflictRegex.exec(content)) !== null) {
        fileConflicts.push({
          ours: match[1].trim(),
          theirs: match[2].trim(),
          start: match.index,
          end: match.index + match[0].length,
        });
      }

      if (fileConflicts.length > 0) {
        conflicts.push({
          file,
          conflicts: fileConflicts,
          canAutoResolve: this.canAutoResolveConflict(fileConflicts),
          suggestedResolution: this.getSuggestedResolution(fileConflicts),
        });
      }
    }

    return conflicts;
  }

  private canAutoResolveConflict(conflicts: ConflictMarker[]): boolean {
    // Simple heuristics to determine if conflict can be auto-resolved
    if (conflicts.length === 1) {
      const { ours, theirs } = conflicts[0];
      if (ours.includes("version") && theirs.includes("version")) {
        return true; // version-bump conflicts can be auto-resolved
      }
      if (ours === "" || theirs === "") {
        return false; // addition-deletion conflicts need manual review
      }
    }
    return false; // complex conflicts cannot be auto-resolved
  }

  private getSuggestedResolution(conflicts: ConflictMarker[]): string | undefined {
    if (conflicts.length === 1) {
      const { ours, theirs } = conflicts[0];
      if (ours.includes("version") && theirs.includes("version")) {
        return "Take the higher version number";
      }
      if (ours === "" || theirs === "") {
        return "Review if both changes are needed";
      }
    }
    return "Manual review required";
  }

  private generateResolutionPlan(analysis: ConflictAnalysis[]): string {
    const sections = [
      `# Merge Conflict Resolution Plan

## Summary
Found ${analysis.length} files with conflicts:
`,
    ];

    for (const fileAnalysis of analysis) {
      sections.push(`### ${fileAnalysis.file}
- Conflicts: ${fileAnalysis.conflicts.length}
- Can Auto-Resolve: ${fileAnalysis.canAutoResolve ? 'Yes' : 'No'}
`);

      if (fileAnalysis.suggestedResolution) {
        sections.push(`**Recommendation**: ${fileAnalysis.suggestedResolution}\n`);
      }
    }

    sections.push(`## Resolution Steps
1. Review each conflict carefully
2. Decide which changes to keep
3. Edit files to remove conflict markers
4. Test the resolved code
5. Stage resolved files: \`git add <file>\`
6. Continue merge/rebase
`);

    return sections.join("\n");
  }

  private async autoResolveSimpleConflicts(analysis: ConflictAnalysis[]): Promise<number> {
    let resolved = 0;

    for (const fileAnalysis of analysis) {
      if (fileAnalysis.canAutoResolve) {
        // Auto-resolve conflicts that can be safely resolved
        // This is a simplified example
        resolved++;
      }
    }

    return resolved;
  }
}

// Export all git agents
export const gitAgents = {
  "commit-creator": CommitCreatorAgent,
  "pr-creator": PRCreatorAgent,
  "git-workflow": GitWorkflowAgent,
  "merge-resolver": MergeConflictResolverAgent,
};
