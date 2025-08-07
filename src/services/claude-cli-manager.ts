/**
 * Claude CLI Manager
 * Handles Claude CLI detection, installation, and session management
 */

import * as vscode from "vscode";
import { spawn, exec } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { promisify } from "util";
import { debugLog, errorLog, infoLog } from "../utils/logging";

const execAsync = promisify(exec);

export interface ClaudeCliInfo {
  installed: boolean;
  version?: string;
  path?: string;
  authenticated?: boolean;
  error?: string;
}

export class ClaudeCliManager {
  private static instance: ClaudeCliManager;
  private cliInfo: ClaudeCliInfo | null = null;
  private lastCheck: number = 0;
  private readonly CHECK_INTERVAL = 60000; // 1 minute cache

  private constructor() {}

  static getInstance(): ClaudeCliManager {
    if (!ClaudeCliManager.instance) {
      ClaudeCliManager.instance = new ClaudeCliManager();
    }
    return ClaudeCliManager.instance;
  }

  /**
   * Check if Claude CLI is installed and configured
   */
  async checkCliStatus(force: boolean = false): Promise<ClaudeCliInfo> {
    // Use cached result if recent
    if (!force && this.cliInfo && Date.now() - this.lastCheck < this.CHECK_INTERVAL) {
      return this.cliInfo;
    }

    debugLog("[ClaudeCliManager] Checking Claude CLI status...");

    // Step 1: Check if Claude CLI is installed
    const isInstalled = await this.isCliInstalled();
    
    if (!isInstalled) {
      this.cliInfo = {
        installed: false,
        error: "Claude CLI not found. Please install it first."
      };
      this.lastCheck = Date.now();
      return this.cliInfo;
    }

    // Step 2: Get version
    const version = await this.getCliVersion();

    // Step 3: Check authentication
    const isAuthenticated = await this.isAuthenticated();

    // Step 4: Get CLI path
    const cliPath = await this.getCliPath();

    this.cliInfo = {
      installed: true,
      version: version || "unknown",
      path: cliPath || "claude",
      authenticated: isAuthenticated,
      error: isAuthenticated ? undefined : "Not authenticated. Please run 'claude login' in terminal."
    };

    this.lastCheck = Date.now();
    return this.cliInfo;
  }

  /**
   * Check if Claude CLI is installed
   */
  private async isCliInstalled(): Promise<boolean> {
    const commands = this.getPlatformCommands();
    
    for (const cmd of commands) {
      try {
        const { stdout, stderr } = await execAsync(`${cmd} --version`);
        if (stdout || !stderr.includes("not found")) {
          debugLog(`[ClaudeCliManager] Found Claude CLI with command: ${cmd}`);
          return true;
        }
      } catch (error) {
        // Command not found, try next
        continue;
      }
    }

    return false;
  }

  /**
   * Get Claude CLI version
   */
  private async getCliVersion(): Promise<string | null> {
    const commands = this.getPlatformCommands();
    
    for (const cmd of commands) {
      try {
        const { stdout } = await execAsync(`${cmd} --version`);
        if (stdout) {
          const version = stdout.trim().match(/\d+\.\d+\.\d+/)?.[0];
          return version || stdout.trim();
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  /**
   * Check if Claude CLI is authenticated
   */
  private async isAuthenticated(): Promise<boolean> {
    const commands = this.getPlatformCommands();
    
    for (const cmd of commands) {
      try {
        // Try to run a simple command that requires auth
        const { stdout, stderr } = await execAsync(`${cmd} api models`, {
          timeout: 5000
        });
        
        // If we get a response without auth errors, we're authenticated
        if (stdout && !stderr.includes("authenticate") && !stderr.includes("login")) {
          return true;
        }
      } catch (error) {
        // Check if error is auth-related
        const errorStr = error.toString();
        if (errorStr.includes("authenticate") || errorStr.includes("login")) {
          return false;
        }
        // Other errors, try next command
        continue;
      }
    }

    return false;
  }

  /**
   * Get Claude CLI path
   */
  private async getCliPath(): Promise<string | null> {
    const commands = this.getPlatformCommands();
    
    for (const cmd of commands) {
      try {
        if (os.platform() === "win32") {
          const { stdout } = await execAsync(`where ${cmd}`);
          if (stdout) {
            return stdout.trim().split('\n')[0];
          }
        } else {
          const { stdout } = await execAsync(`which ${cmd}`);
          if (stdout) {
            return stdout.trim();
          }
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  /**
   * Get platform-specific commands to try
   */
  private getPlatformCommands(): string[] {
    const platform = os.platform();
    const homeDir = os.homedir();
    
    // Common commands across platforms
    const baseCommands = ["claude", "claude-cli"];
    
    // Platform-specific variations
    switch (platform) {
      case "win32":
        return [...baseCommands, "claude.exe", "claude.cmd", "claude.bat"];
      case "darwin":
        // Check Homebrew locations (both Intel and Apple Silicon)
        return [
          ...baseCommands,
          "/opt/homebrew/bin/claude",  // Apple Silicon
          "/usr/local/bin/claude",      // Intel Mac
          path.join(homeDir, ".local", "bin", "claude"),
          path.join(homeDir, "bin", "claude"),
          "/Applications/Claude.app/Contents/MacOS/claude"
        ];
      case "linux":
        return [
          ...baseCommands,
          "/usr/local/bin/claude",
          "/usr/bin/claude",
          path.join(homeDir, ".local", "bin", "claude"),
          path.join(homeDir, "bin", "claude")
        ];
      default:
        return baseCommands;
    }
  }

  /**
   * Show installation guide
   */
  async showInstallationGuide(): Promise<void> {
    const platform = os.platform();
    let instructions = "# Claude CLI Installation Guide\n\n";

    switch (platform) {
      case "win32":
        instructions += `## Windows Installation

### Option 1: Using pip (Recommended)
\`\`\`bash
pip install claude-cli
\`\`\`

### Option 2: Using pipx
\`\`\`bash
pipx install claude-cli
\`\`\`

### Option 3: Download from GitHub
1. Visit: https://github.com/anthropics/claude-cli/releases
2. Download the Windows installer
3. Run the installer
4. Restart your terminal

### After Installation:
1. Open a new terminal
2. Run: \`claude login\`
3. Follow the authentication prompts
`;
        break;

      case "darwin":
        instructions += `## macOS Installation

### Option 1: Using Homebrew (Recommended)
\`\`\`bash
brew install claude-cli
\`\`\`

### Option 2: Using pip
\`\`\`bash
pip3 install claude-cli
\`\`\`

### Option 3: Using pipx
\`\`\`bash
pipx install claude-cli
\`\`\`

### After Installation:
1. Open a new terminal
2. Run: \`claude login\`
3. Follow the authentication prompts
`;
        break;

      case "linux":
        instructions += `## Linux Installation

### Option 1: Using pip (Recommended)
\`\`\`bash
pip3 install claude-cli
\`\`\`

### Option 2: Using pipx
\`\`\`bash
pipx install claude-cli
\`\`\`

### Option 3: Using snap
\`\`\`bash
sudo snap install claude-cli
\`\`\`

### After Installation:
1. Open a new terminal
2. Run: \`claude login\`
3. Follow the authentication prompts
`;
        break;

      default:
        instructions += `## Generic Installation

### Using pip:
\`\`\`bash
pip install claude-cli
\`\`\`

### Using npm:
\`\`\`bash
npm install -g claude-cli
\`\`\`

### After Installation:
1. Open a new terminal
2. Run: \`claude login\`
3. Follow the authentication prompts
`;
    }

    instructions += `
## Troubleshooting

### Command not found:
- Make sure the installation directory is in your PATH
- Restart your terminal or VS Code after installation
- Try using the full path to the claude executable

### Authentication issues:
- Run \`claude login\` in your terminal
- Make sure you have a valid Claude account
- Check your internet connection

### Still having issues?
1. Check Claude CLI documentation: https://docs.anthropic.com/claude-cli
2. Visit the GitHub repository: https://github.com/anthropics/claude-cli
3. Contact support: https://support.anthropic.com
`;

    // Create a new document with the instructions
    const doc = await vscode.workspace.openTextDocument({
      content: instructions,
      language: "markdown"
    });

    await vscode.window.showTextDocument(doc);
  }

  /**
   * Attempt to install Claude CLI automatically
   */
  async attemptAutoInstall(): Promise<boolean> {
    const platform = os.platform();
    
    const choice = await vscode.window.showInformationMessage(
      "Claude CLI is not installed. Would you like to install it automatically?",
      "Install with pip",
      "Install with npm",
      "Show Manual Instructions",
      "Cancel"
    );

    if (!choice || choice === "Cancel") {
      return false;
    }

    if (choice === "Show Manual Instructions") {
      await this.showInstallationGuide();
      return false;
    }

    const terminal = vscode.window.createTerminal("Claude CLI Installation");
    terminal.show();

    if (choice === "Install with pip") {
      const pipCmd = platform === "win32" ? "pip" : "pip3";
      terminal.sendText(`${pipCmd} install claude-cli`);
      terminal.sendText("# After installation completes, run:");
      terminal.sendText("# claude login");
    } else if (choice === "Install with npm") {
      terminal.sendText("npm install -g claude-cli");
      terminal.sendText("# After installation completes, run:");
      terminal.sendText("# claude login");
    }

    vscode.window.showInformationMessage(
      "Installing Claude CLI... Please wait for the installation to complete, then run 'claude login' in the terminal."
    );

    // Wait a bit and check again
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const status = await this.checkCliStatus(true);
    return status.installed;
  }

  /**
   * Open terminal for authentication
   */
  async openAuthenticationTerminal(): Promise<void> {
    const terminal = vscode.window.createTerminal("Claude Authentication");
    terminal.show();
    terminal.sendText("claude login");
    
    vscode.window.showInformationMessage(
      "Please complete the authentication in the terminal, then try starting AutoClaude again."
    );
  }

  /**
   * Get detailed error message with solutions
   */
  getDetailedError(error: string): string {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes("not found") || errorLower.includes("not installed")) {
      return `Claude CLI is not installed on your system.

Solutions:
1. Install using pip: pip install claude-cli
2. Install using npm: npm install -g claude-cli
3. Download from: https://github.com/anthropics/claude-cli

After installation, restart VS Code and try again.`;
    }

    if (errorLower.includes("authenticate") || errorLower.includes("login")) {
      return `Claude CLI is not authenticated.

Solution:
1. Open a terminal
2. Run: claude login
3. Follow the authentication prompts
4. Restart VS Code and try again`;
    }

    if (errorLower.includes("permission") || errorLower.includes("access")) {
      return `Permission issue with Claude CLI.

Solutions:
1. Check file permissions for Claude CLI
2. Try running VS Code as administrator (Windows)
3. Reinstall Claude CLI with proper permissions`;
    }

    return `Claude CLI error: ${error}

For help, visit: https://docs.anthropic.com/claude-cli`;
  }
}

// Export singleton getter
export function getClaudeCliManager(): ClaudeCliManager {
  return ClaudeCliManager.getInstance();
}