/**
 * Claude Update Manager
 * Automatically detects and installs Claude Code updates
 */

import * as vscode from "vscode";
import { execSync, spawn } from "child_process";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import { debugLog, errorLog, infoLog } from "../utils/logging";
import { getClaudeCliManager } from "./claude-cli-manager";

export interface VersionInfo {
  current: string;
  latest: string;
  isUpdateAvailable: boolean;
  releaseNotes?: string;
  downloadUrl?: string;
  publishedAt?: Date;
}

export interface UpdateConfig {
  autoCheck: boolean;
  autoInstall: boolean;
  checkInterval: number; // hours
  notifyOnUpdate: boolean;
  preReleaseChannel: boolean;
}

export class ClaudeUpdateManager {
  private static instance: ClaudeUpdateManager;
  private lastCheckTime: number = 0;
  private currentVersion: string | null = null;
  private latestVersion: string | null = null;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private config: UpdateConfig;
  
  private readonly DEFAULT_CONFIG: UpdateConfig = {
    autoCheck: true,
    autoInstall: false,
    checkInterval: 24, // Check daily
    notifyOnUpdate: true,
    preReleaseChannel: false
  };

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): ClaudeUpdateManager {
    if (!ClaudeUpdateManager.instance) {
      ClaudeUpdateManager.instance = new ClaudeUpdateManager();
    }
    return ClaudeUpdateManager.instance;
  }

  /**
   * Initialize update manager and start checking
   */
  async initialize(): Promise<void> {
    infoLog("[UpdateManager] Initializing Claude update manager");
    
    // Load saved state
    this.loadState();
    
    // Get current version
    await this.getCurrentVersion();
    
    // Start auto-checking if enabled
    if (this.config.autoCheck) {
      this.startAutoCheck();
      
      // Do initial check after a delay
      setTimeout(() => {
        this.checkForUpdates().catch(error => {
          debugLog(`[UpdateManager] Initial update check failed: ${error}`);
        });
      }, 5000);
    }
  }

  /**
   * Get current Claude version
   */
  async getCurrentVersion(): Promise<string | null> {
    try {
      const cliManager = getClaudeCliManager();
      const status = await cliManager.checkCliStatus();
      
      if (status.installed && status.version) {
        // Extract version number from string like "1.0.70 (Claude Code)"
        const versionMatch = status.version.match(/(\d+\.\d+\.\d+)/);
        this.currentVersion = versionMatch ? versionMatch[1] : status.version;
        debugLog(`[UpdateManager] Current Claude version: ${this.currentVersion}`);
        return this.currentVersion;
      }
    } catch (error) {
      errorLog("[UpdateManager] Failed to get current version", error as Error);
    }
    
    return null;
  }

  /**
   * Check for updates
   */
  async checkForUpdates(silent: boolean = false): Promise<VersionInfo | null> {
    try {
      debugLog("[UpdateManager] Checking for Claude updates...");
      
      // Get current version
      const current = await this.getCurrentVersion();
      if (!current) {
        if (!silent) {
          vscode.window.showWarningMessage("Claude is not installed. Cannot check for updates.");
        }
        return null;
      }
      
      // Get latest version from multiple sources
      const latest = await this.getLatestVersion();
      if (!latest) {
        debugLog("[UpdateManager] Could not determine latest version");
        return null;
      }
      
      const isUpdateAvailable = this.compareVersions(current, latest) < 0;
      
      const versionInfo: VersionInfo = {
        current,
        latest,
        isUpdateAvailable
      };
      
      // Save state
      this.lastCheckTime = Date.now();
      this.latestVersion = latest;
      this.saveState();
      
      // Notify user if update available
      if (isUpdateAvailable && this.config.notifyOnUpdate && !silent) {
        this.notifyUpdateAvailable(versionInfo);
      }
      
      debugLog(`[UpdateManager] Version check - Current: ${current}, Latest: ${latest}, Update: ${isUpdateAvailable}`);
      
      return versionInfo;
      
    } catch (error) {
      errorLog("[UpdateManager] Update check failed", error as Error);
      if (!silent) {
        vscode.window.showErrorMessage(`Failed to check for Claude updates: ${error}`);
      }
      return null;
    }
  }

  /**
   * Get latest version from various sources
   */
  private async getLatestVersion(): Promise<string | null> {
    // Try multiple methods to get latest version
    
    // Method 1: Check Homebrew (macOS)
    if (os.platform() === "darwin") {
      try {
        const brewVersion = await this.getBrewLatestVersion();
        if (brewVersion) return brewVersion;
      } catch (error) {
        debugLog(`[UpdateManager] Homebrew check failed: ${error}`);
      }
    }
    
    // Method 2: Check npm registry
    try {
      const npmVersion = await this.getNpmLatestVersion();
      if (npmVersion) return npmVersion;
    } catch (error) {
      debugLog(`[UpdateManager] npm check failed: ${error}`);
    }
    
    // Method 3: Check GitHub releases
    try {
      const githubVersion = await this.getGithubLatestVersion();
      if (githubVersion) return githubVersion;
    } catch (error) {
      debugLog(`[UpdateManager] GitHub check failed: ${error}`);
    }
    
    // Method 4: Check Anthropic API
    try {
      const apiVersion = await this.getAnthropicLatestVersion();
      if (apiVersion) return apiVersion;
    } catch (error) {
      debugLog(`[UpdateManager] Anthropic API check failed: ${error}`);
    }
    
    return null;
  }

  /**
   * Get latest version from Homebrew
   */
  private async getBrewLatestVersion(): Promise<string | null> {
    try {
      // Update brew formulae
      execSync("brew update", { encoding: "utf8", stdio: "pipe" });
      
      // Get info about claude formula
      const info = execSync("brew info claude --json", { encoding: "utf8" });
      const data = JSON.parse(info);
      
      if (data && data[0] && data[0].versions) {
        return data[0].versions.stable;
      }
    } catch (error) {
      // Brew might not be installed or formula doesn't exist
    }
    return null;
  }

  /**
   * Get latest version from npm
   */
  private async getNpmLatestVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      https.get("https://registry.npmjs.org/claude-cli/latest", (res) => {
        let data = "";
        
        res.on("data", (chunk) => {
          data += chunk;
        });
        
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json.version || null);
          } catch {
            resolve(null);
          }
        });
      }).on("error", () => {
        resolve(null);
      });
    });
  }

  /**
   * Get latest version from GitHub
   */
  private async getGithubLatestVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const options = {
        hostname: "api.github.com",
        path: "/repos/anthropics/claude-cli/releases/latest",
        headers: {
          "User-Agent": "AutoClaude-VSCode"
        }
      };
      
      https.get(options, (res) => {
        let data = "";
        
        res.on("data", (chunk) => {
          data += chunk;
        });
        
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.tag_name) {
              // Remove 'v' prefix if present
              const version = json.tag_name.replace(/^v/, "");
              resolve(version);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      }).on("error", () => {
        resolve(null);
      });
    });
  }

  /**
   * Get latest version from Anthropic API
   */
  private async getAnthropicLatestVersion(): Promise<string | null> {
    // This would require an API endpoint from Anthropic
    // For now, return null as this might not be available
    return null;
  }

  /**
   * Compare version strings
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    
    return 0;
  }

  /**
   * Notify user about available update
   */
  private async notifyUpdateAvailable(versionInfo: VersionInfo): Promise<void> {
    const message = `Claude update available: ${versionInfo.current} → ${versionInfo.latest}`;
    
    const action = await vscode.window.showInformationMessage(
      message,
      "Install Now",
      "View Details",
      "Later"
    );
    
    if (action === "Install Now") {
      await this.installUpdate(versionInfo);
    } else if (action === "View Details") {
      await this.showUpdateDetails(versionInfo);
    }
  }

  /**
   * Install update
   */
  async installUpdate(versionInfo: VersionInfo): Promise<boolean> {
    try {
      infoLog(`[UpdateManager] Installing Claude update: ${versionInfo.latest}`);
      
      const platform = os.platform();
      let success = false;
      
      // Platform-specific update commands
      if (platform === "darwin") {
        // Try Homebrew first
        success = await this.updateWithBrew();
        
        if (!success) {
          // Try pip
          success = await this.updateWithPip();
        }
      } else if (platform === "win32") {
        // Try pip
        success = await this.updateWithPip();
        
        if (!success) {
          // Try npm
          success = await this.updateWithNpm();
        }
      } else {
        // Linux - try pip first
        success = await this.updateWithPip();
        
        if (!success) {
          // Try package manager
          success = await this.updateWithPackageManager();
        }
      }
      
      if (success) {
        vscode.window.showInformationMessage(
          `Claude updated successfully to version ${versionInfo.latest}!`,
          "Restart Extension"
        ).then(action => {
          if (action === "Restart Extension") {
            vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        });
        
        // Update current version
        this.currentVersion = versionInfo.latest;
        this.saveState();
        
        return true;
      } else {
        vscode.window.showErrorMessage(
          "Failed to update Claude automatically. Please update manually.",
          "Show Instructions"
        ).then(action => {
          if (action === "Show Instructions") {
            this.showManualUpdateInstructions();
          }
        });
        
        return false;
      }
      
    } catch (error) {
      errorLog("[UpdateManager] Update installation failed", error as Error);
      vscode.window.showErrorMessage(`Failed to install update: ${error}`);
      return false;
    }
  }

  /**
   * Update using Homebrew
   */
  private async updateWithBrew(): Promise<boolean> {
    return new Promise((resolve) => {
      const terminal = vscode.window.createTerminal("Claude Update");
      terminal.show();
      
      terminal.sendText("echo 'Updating Claude via Homebrew...'");
      terminal.sendText("brew upgrade claude");
      terminal.sendText("echo 'Update complete! You may need to restart VS Code.'");
      
      // Check after a delay
      setTimeout(async () => {
        const newVersion = await this.getCurrentVersion();
        resolve(newVersion !== this.currentVersion);
      }, 10000);
    });
  }

  /**
   * Update using pip
   */
  private async updateWithPip(): Promise<boolean> {
    return new Promise((resolve) => {
      const terminal = vscode.window.createTerminal("Claude Update");
      terminal.show();
      
      const pipCmd = os.platform() === "win32" ? "pip" : "pip3";
      terminal.sendText(`echo 'Updating Claude via ${pipCmd}...'`);
      terminal.sendText(`${pipCmd} install --upgrade claude-cli`);
      terminal.sendText("echo 'Update complete! You may need to restart VS Code.'");
      
      // Check after a delay
      setTimeout(async () => {
        const newVersion = await this.getCurrentVersion();
        resolve(newVersion !== this.currentVersion);
      }, 10000);
    });
  }

  /**
   * Update using npm
   */
  private async updateWithNpm(): Promise<boolean> {
    return new Promise((resolve) => {
      const terminal = vscode.window.createTerminal("Claude Update");
      terminal.show();
      
      terminal.sendText("echo 'Updating Claude via npm...'");
      terminal.sendText("npm update -g claude-cli");
      terminal.sendText("echo 'Update complete! You may need to restart VS Code.'");
      
      // Check after a delay
      setTimeout(async () => {
        const newVersion = await this.getCurrentVersion();
        resolve(newVersion !== this.currentVersion);
      }, 10000);
    });
  }

  /**
   * Update using system package manager
   */
  private async updateWithPackageManager(): Promise<boolean> {
    const distro = this.detectLinuxDistro();
    
    return new Promise((resolve) => {
      const terminal = vscode.window.createTerminal("Claude Update");
      terminal.show();
      
      if (distro === "ubuntu" || distro === "debian") {
        terminal.sendText("echo 'Updating Claude via apt...'");
        terminal.sendText("sudo apt update && sudo apt upgrade claude");
      } else if (distro === "fedora" || distro === "rhel") {
        terminal.sendText("echo 'Updating Claude via dnf...'");
        terminal.sendText("sudo dnf upgrade claude");
      } else if (distro === "arch") {
        terminal.sendText("echo 'Updating Claude via pacman...'");
        terminal.sendText("sudo pacman -Syu claude");
      } else {
        resolve(false);
        return;
      }
      
      terminal.sendText("echo 'Update complete! You may need to restart VS Code.'");
      
      // Check after a delay
      setTimeout(async () => {
        const newVersion = await this.getCurrentVersion();
        resolve(newVersion !== this.currentVersion);
      }, 10000);
    });
  }

  /**
   * Detect Linux distribution
   */
  private detectLinuxDistro(): string {
    try {
      if (fs.existsSync("/etc/os-release")) {
        const content = fs.readFileSync("/etc/os-release", "utf8");
        if (content.includes("Ubuntu")) return "ubuntu";
        if (content.includes("Debian")) return "debian";
        if (content.includes("Fedora")) return "fedora";
        if (content.includes("Red Hat")) return "rhel";
        if (content.includes("Arch")) return "arch";
      }
    } catch {
      // Ignore
    }
    return "unknown";
  }

  /**
   * Show update details
   */
  private async showUpdateDetails(versionInfo: VersionInfo): Promise<void> {
    const content = `# Claude Update Available

## Version Information
- **Current Version**: ${versionInfo.current}
- **Latest Version**: ${versionInfo.latest}
- **Update Available**: ${versionInfo.isUpdateAvailable ? "✅ Yes" : "❌ No"}

## Update Methods

### Automatic Update
Click "Install Now" when prompted, or run the command:
\`AutoClaude: Update Claude\`

### Manual Update

#### macOS (Homebrew)
\`\`\`bash
brew upgrade claude
\`\`\`

#### Using pip
\`\`\`bash
pip install --upgrade claude-cli
\`\`\`

#### Using npm
\`\`\`bash
npm update -g claude-cli
\`\`\`

## What's New
Check the [Claude Release Notes](https://github.com/anthropics/claude-cli/releases) for details.

## After Updating
Restart VS Code to ensure the new version is properly loaded.
`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: "markdown"
    });
    
    await vscode.window.showTextDocument(doc);
  }

  /**
   * Show manual update instructions
   */
  private async showManualUpdateInstructions(): Promise<void> {
    const platform = os.platform();
    let instructions = "# Manual Claude Update Instructions\n\n";
    
    if (platform === "darwin") {
      instructions += `## macOS

### Using Homebrew (Recommended)
\`\`\`bash
brew update
brew upgrade claude
\`\`\`

### Using pip
\`\`\`bash
pip3 install --upgrade claude-cli
\`\`\`
`;
    } else if (platform === "win32") {
      instructions += `## Windows

### Using pip
\`\`\`bash
pip install --upgrade claude-cli
\`\`\`

### Using npm
\`\`\`bash
npm update -g claude-cli
\`\`\`
`;
    } else {
      instructions += `## Linux

### Using pip
\`\`\`bash
pip3 install --upgrade claude-cli
\`\`\`

### Using package manager
\`\`\`bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade claude

# Fedora
sudo dnf upgrade claude

# Arch
sudo pacman -Syu claude
\`\`\`
`;
    }
    
    instructions += `
## After Updating
1. Close all terminal windows
2. Restart VS Code
3. Try starting AutoClaude again

## Verify Update
Run this command to verify the new version:
\`\`\`bash
claude --version
\`\`\`
`;

    const doc = await vscode.workspace.openTextDocument({
      content: instructions,
      language: "markdown"
    });
    
    await vscode.window.showTextDocument(doc);
  }

  /**
   * Start automatic update checking
   */
  private startAutoCheck(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }
    
    const intervalMs = this.config.checkInterval * 60 * 60 * 1000; // Convert hours to ms
    
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates(true).catch(error => {
        debugLog(`[UpdateManager] Auto-check failed: ${error}`);
      });
    }, intervalMs);
    
    debugLog(`[UpdateManager] Auto-check started, interval: ${this.config.checkInterval} hours`);
  }

  /**
   * Stop automatic update checking
   */
  stopAutoCheck(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  /**
   * Load configuration
   */
  private loadConfig(): UpdateConfig {
    const vsConfig = vscode.workspace.getConfiguration("autoclaude.updates");
    
    return {
      autoCheck: vsConfig.get<boolean>("autoCheck", this.DEFAULT_CONFIG.autoCheck),
      autoInstall: vsConfig.get<boolean>("autoInstall", this.DEFAULT_CONFIG.autoInstall),
      checkInterval: vsConfig.get<number>("checkInterval", this.DEFAULT_CONFIG.checkInterval),
      notifyOnUpdate: vsConfig.get<boolean>("notifyOnUpdate", this.DEFAULT_CONFIG.notifyOnUpdate),
      preReleaseChannel: vsConfig.get<boolean>("preReleaseChannel", this.DEFAULT_CONFIG.preReleaseChannel)
    };
  }

  /**
   * Save state to global storage
   */
  private saveState(): void {
    const state = {
      lastCheckTime: this.lastCheckTime,
      currentVersion: this.currentVersion,
      latestVersion: this.latestVersion
    };
    
    // Save to a state file or VS Code global state
    try {
      const stateFile = path.join(os.tmpdir(), "autoclaude-update-state.json");
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      debugLog(`[UpdateManager] Failed to save state: ${error}`);
    }
  }

  /**
   * Load state from storage
   */
  private loadState(): void {
    try {
      const stateFile = path.join(os.tmpdir(), "autoclaude-update-state.json");
      if (fs.existsSync(stateFile)) {
        const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
        this.lastCheckTime = state.lastCheckTime || 0;
        this.currentVersion = state.currentVersion || null;
        this.latestVersion = state.latestVersion || null;
      }
    } catch (error) {
      debugLog(`[UpdateManager] Failed to load state: ${error}`);
    }
  }

  /**
   * Get update status
   */
  getStatus(): {
    currentVersion: string | null;
    latestVersion: string | null;
    lastCheckTime: number;
    autoCheckEnabled: boolean;
    updateAvailable: boolean;
  } {
    return {
      currentVersion: this.currentVersion,
      latestVersion: this.latestVersion,
      lastCheckTime: this.lastCheckTime,
      autoCheckEnabled: this.config.autoCheck,
      updateAvailable: this.currentVersion && this.latestVersion 
        ? this.compareVersions(this.currentVersion, this.latestVersion) < 0
        : false
    };
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.stopAutoCheck();
    this.saveState();
  }
}

// Export singleton getter
export function getClaudeUpdateManager(): ClaudeUpdateManager {
  return ClaudeUpdateManager.getInstance();
}