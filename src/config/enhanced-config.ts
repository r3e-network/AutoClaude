import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { debugLog } from "../utils/logging";
import {
  DeepMergeObject,
  NestedObject,
  NestedValue,
  ConfigurationOverride,
} from "../types/enhanced-config";

// Enhanced configuration interface
export interface EnhancedAutoClaudeConfig {
  // Hook system configuration
  hooks: {
    enabled: boolean;
    autoFormat: boolean;
    validateSyntax: boolean;
    learnPatterns: boolean;
    customHooksPath?: string;
    hookTimeout: number;
    enableAsyncHooks: boolean;
  };

  // Agent system configuration
  agents: {
    enabled: boolean;
    maxConcurrent: number;
    coordinationStrategy: "sequential" | "parallel" | "adaptive";
    agentTimeout: number;
    enableSpecializedAgents: boolean;
    retryFailedTasks: boolean;
    maxRetries: number;
  };

  // Memory system configuration
  memory: {
    enabled: boolean;
    dbPath?: string;
    pruneAfterDays: number;
    maxSizeMB: number;
    enableCompression: boolean;
    enableAutoBackup: boolean;
    backupInterval: number;
    patternConfidenceThreshold: number;
  };

  // Universal language conversion configuration
  languageConversion: {
    enabled: boolean;
    autoDetectEnvironment: boolean;
    parallelConversion: boolean;
    strictValidation: boolean;
    maxFilesPerBatch: number;
    enableTypeMapping: boolean;
    enablePatternLearning: boolean;
    generateCompatibilityReport: boolean;
    supportedPairs: Array<{
      from: string;
      to: string;
      name: string;
      typeMappings?: Record<string, string>;
      specialValidation?: boolean;
    }>;
  };

  // Neo-rs specific configuration (legacy - for backward compatibility)
  neoRs: {
    enabled: boolean;
    autoDetectEnvironment: boolean;
    parallelConversion: boolean;
    strictValidation: boolean;
    maxFilesPerBatch: number;
    enableTypeMapping: boolean;
    enablePatternLearning: boolean;
    generateCompatibilityReport: boolean;
  };

  // Performance and monitoring
  performance: {
    enableMetrics: boolean;
    metricsInterval: number;
    enableProfiling: boolean;
    maxMemoryUsage: number;
    enableQueryOptimization: boolean;
  };

  // Logging configuration
  logging: {
    level: "debug" | "info" | "warn" | "error";
    enableFileLogging: boolean;
    logFilePath?: string;
    maxLogFiles: number;
    maxLogSizeMB: number;
  };
}

// Default configuration
const DEFAULT_CONFIG: EnhancedAutoClaudeConfig = {
  hooks: {
    enabled: true,
    autoFormat: true,
    validateSyntax: true,
    learnPatterns: true,
    hookTimeout: 30000, // 30 seconds
    enableAsyncHooks: true,
  },
  agents: {
    enabled: true,
    maxConcurrent: 5,
    coordinationStrategy: "adaptive",
    agentTimeout: 300000, // 5 minutes
    enableSpecializedAgents: true,
    retryFailedTasks: true,
    maxRetries: 3,
  },
  memory: {
    enabled: true,
    pruneAfterDays: 30,
    maxSizeMB: 100,
    enableCompression: true,
    enableAutoBackup: true,
    backupInterval: 24 * 60 * 60 * 1000, // 24 hours
    patternConfidenceThreshold: 0.7,
  },
  languageConversion: {
    enabled: true,
    autoDetectEnvironment: true,
    parallelConversion: true,
    strictValidation: true,
    maxFilesPerBatch: 10,
    enableTypeMapping: true,
    enablePatternLearning: true,
    generateCompatibilityReport: true,
    supportedPairs: [
      {
        from: "csharp",
        to: "rust",
        name: "C# to Rust",
        typeMappings: {
          string: "String",
          int: "i32",
          long: "i64",
          bool: "bool",
          "byte[]": "Vec<u8>",
          "List<T>": "Vec<T>",
          "Dictionary<K,V>": "HashMap<K,V>",
          UInt160: "U160",
          UInt256: "U256",
          BigInteger: "num_bigint::BigInt",
        },
        specialValidation: true,
      },
      {
        from: "javascript",
        to: "typescript",
        name: "JavaScript to TypeScript",
        typeMappings: {
          var: "let",
          function: "function",
          null: "null | undefined",
          Object: "Record<string, unknown>",
        },
        specialValidation: false,
      },
      {
        from: "python",
        to: "rust",
        name: "Python to Rust",
        typeMappings: {
          str: "String",
          int: "i64",
          float: "f64",
          bool: "bool",
          list: "Vec",
          dict: "HashMap",
          None: "Option::None",
        },
        specialValidation: false,
      },
      {
        from: "java",
        to: "kotlin",
        name: "Java to Kotlin",
        typeMappings: {
          String: "String",
          int: "Int",
          long: "Long",
          boolean: "Boolean",
          "List<T>": "List<T>",
          "Map<K,V>": "Map<K,V>",
          null: "null",
        },
        specialValidation: false,
      },
    ],
  },
  neoRs: {
    enabled: false, // Enabled only on neo-rs branch or C# to Rust conversions
    autoDetectEnvironment: true,
    parallelConversion: true,
    strictValidation: true,
    maxFilesPerBatch: 10,
    enableTypeMapping: true,
    enablePatternLearning: true,
    generateCompatibilityReport: true,
  },
  performance: {
    enableMetrics: true,
    metricsInterval: 60000, // 1 minute
    enableProfiling: false,
    maxMemoryUsage: 512, // 512MB
    enableQueryOptimization: true,
  },
  logging: {
    level: "info",
    enableFileLogging: true,
    maxLogFiles: 5,
    maxLogSizeMB: 10,
  },
};

export class EnhancedConfigManager {
  private config: EnhancedAutoClaudeConfig;
  private configPath: string;
  private watchers: vscode.Disposable[] = [];

  constructor(private workspacePath: string) {
    this.configPath = path.join(
      workspacePath,
      ".autoclaude",
      "enhanced-config.json",
    );
    this.config = { ...DEFAULT_CONFIG };
  }

  async initialize(): Promise<void> {
    try {
      // Load configuration from file
      await this.loadConfig();

      // Override with VS Code settings
      this.mergeVSCodeSettings();

      // Detect project environment and enable relevant features
      await this.detectProjectEnvironment();

      // Setup file watcher for config changes
      this.setupConfigWatcher();

      debugLog("Enhanced configuration initialized");
    } catch (error) {
      debugLog(`Failed to initialize enhanced config: ${error}`);
      // Use default config on error
    }
  }

  private async loadConfig(): Promise<void> {
    if (fs.existsSync(this.configPath)) {
      try {
        const configData = fs.readFileSync(this.configPath, "utf8");
        const fileConfig = JSON.parse(configData);

        // Deep merge with defaults
        this.config = this.deepMerge(DEFAULT_CONFIG, fileConfig);

        debugLog("Configuration loaded from file");
      } catch (error) {
        debugLog(`Failed to load config file: ${error}`);
      }
    } else {
      // Create default config file
      await this.saveConfig();
    }
  }

  private mergeVSCodeSettings(): void {
    const vscodeConfig = vscode.workspace.getConfiguration("autoclaude");

    // Map VS Code settings to enhanced config
    const mappings = [
      ["hooks.enabled", "enhanced.hooks.enabled"],
      ["agents.enabled", "enhanced.agents.enabled"],
      ["memory.enabled", "enhanced.memory.enabled"],
      ["neoRs.enabled", "enhanced.neoRs.enabled"],
      ["agents.maxConcurrent", "enhanced.agents.maxConcurrent"],
      ["memory.maxSizeMB", "enhanced.memory.maxSizeMB"],
      ["logging.level", "enhanced.logging.level"],
    ];

    for (const [vscodeKey, configPath] of mappings) {
      const value = vscodeConfig.get(vscodeKey);
      if (value !== undefined) {
        this.setNestedValue(this.config, configPath, value);
      }
    }
  }

  private async detectProjectEnvironment(): Promise<void> {
    try {
      // Check current git branch
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      let currentBranch = "";
      try {
        const { stdout } = await execAsync("git branch --show-current", {
          cwd: this.workspacePath,
        });
        currentBranch = stdout.trim();
      } catch (error) {
        debugLog("Not a git repository or git not available");
      }

      // Enable neo-rs features if on neo-rs branch
      if (currentBranch === "neo-rs") {
        this.config.neoRs.enabled = true;
        debugLog("Neo-rs branch detected, enabling neo-rs features");
      }

      // Detect project languages and enable appropriate conversion pairs
      const detectedLanguages = await this.detectProjectLanguages();
      await this.configureLanguageConversions(detectedLanguages);

      // Check for specific project indicators
      const projectIndicators = [
        // Neo-rs indicators
        { files: ["neo-rs", "neo-config.json", "Neo.VM"], type: "neo-rs" },
        // React/TypeScript indicators
        {
          files: ["package.json", "tsconfig.json", "src/index.tsx"],
          type: "react-ts",
        },
        // Python indicators
        {
          files: ["requirements.txt", "setup.py", "pyproject.toml"],
          type: "python",
        },
        // Rust indicators
        { files: ["Cargo.toml", "src/main.rs", "src/lib.rs"], type: "rust" },
        // Java indicators
        { files: ["pom.xml", "build.gradle", "src/main/java"], type: "java" },
        // C# indicators
        { files: ["*.csproj", "*.sln", "Program.cs"], type: "csharp" },
      ];

      for (const indicator of projectIndicators) {
        const hasIndicator = indicator.files.some((file) => {
          const fullPath = path.join(this.workspacePath, file);
          return (
            fs.existsSync(fullPath) ||
            (file.includes("*") && this.globMatch(this.workspacePath, file))
          );
        });

        if (hasIndicator) {
          debugLog(`Detected ${indicator.type} project`);
          await this.enableFeaturesForProjectType(indicator.type);
          break;
        }
      }
    } catch (error) {
      debugLog(`Failed to detect project environment: ${error}`);
    }
  }

  private async detectProjectLanguages(): Promise<string[]> {
    const languages: string[] = [];

    // Check for language-specific files
    const languageIndicators = {
      csharp: ["*.cs", "*.csproj", "*.sln"],
      rust: ["*.rs", "Cargo.toml"],
      javascript: ["*.js", "*.jsx", "package.json"],
      typescript: ["*.ts", "*.tsx", "tsconfig.json"],
      python: ["*.py", "requirements.txt", "setup.py"],
      java: ["*.java", "pom.xml", "build.gradle"],
      kotlin: ["*.kt", "*.kts"],
      go: ["*.go", "go.mod"],
      cpp: ["*.cpp", "*.hpp", "*.cc", "*.h"],
      swift: ["*.swift", "Package.swift"],
    };

    for (const [lang, patterns] of Object.entries(languageIndicators)) {
      const hasLang = patterns.some((pattern) => {
        if (pattern.includes("*")) {
          return this.globMatch(this.workspacePath, pattern);
        }
        return fs.existsSync(path.join(this.workspacePath, pattern));
      });

      if (hasLang) {
        languages.push(lang);
      }
    }

    return languages;
  }

  private async configureLanguageConversions(
    detectedLanguages: string[],
  ): Promise<void> {
    // Enable relevant conversion pairs based on detected languages
    if (
      detectedLanguages.includes("csharp") &&
      detectedLanguages.includes("rust")
    ) {
      this.config.neoRs.enabled = true;
      debugLog("C# and Rust detected - enabling Neo-rs features");
    }

    // Add more language pair configurations as needed
    if (
      detectedLanguages.includes("javascript") &&
      !detectedLanguages.includes("typescript")
    ) {
      debugLog("JavaScript project detected - TypeScript conversion available");
    }

    if (
      detectedLanguages.includes("python") &&
      detectedLanguages.includes("rust")
    ) {
      debugLog(
        "Python and Rust detected - Python to Rust conversion available",
      );
    }
  }

  private async enableFeaturesForProjectType(
    projectType: string,
  ): Promise<void> {
    switch (projectType) {
      case "neo-rs":
        this.config.neoRs.enabled = true;
        this.config.languageConversion.strictValidation = true;
        debugLog(
          "Neo-rs project: Enabling strict validation and Neo-rs features",
        );
        break;
      case "react-ts":
        // Enable TypeScript-specific features
        debugLog("React/TypeScript project detected");
        break;
      case "python":
        // Enable Python-specific features
        debugLog("Python project detected");
        break;
      case "rust":
        // Enable Rust-specific features
        debugLog("Rust project detected");
        break;
      case "java":
        // Enable Java-specific features
        debugLog("Java project detected");
        break;
      case "csharp":
        // Enable C#-specific features
        debugLog("C# project detected");
        if (
          fs.existsSync(path.join(this.workspacePath, "Neo.VM")) ||
          fs.existsSync(path.join(this.workspacePath, "neo-cli"))
        ) {
          this.config.neoRs.enabled = true;
          debugLog(
            "Neo C# project detected - enabling Neo-rs conversion features",
          );
        }
        break;
    }
  }

  private globMatch(directory: string, pattern: string): boolean {
    try {
      const glob = require("glob");
      const matches = glob.sync(pattern, { cwd: directory });
      return matches.length > 0;
    } catch (error) {
      return false;
    }
  }

  private setupConfigWatcher(): void {
    if (fs.existsSync(this.configPath)) {
      const watcher = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.fsPath === this.configPath) {
          this.loadConfig();
          debugLog("Configuration reloaded due to file change");
        }
      });

      this.watchers.push(watcher);
    }
  }

  async saveConfig(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        "utf8",
      );

      debugLog("Configuration saved");
    } catch (error) {
      debugLog(`Failed to save config: ${error}`);
    }
  }

  getConfig(): EnhancedAutoClaudeConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<EnhancedAutoClaudeConfig>): void {
    this.config = this.deepMerge(this.config, updates);
    this.saveConfig();
  }

  // Feature detection methods
  isHooksEnabled(): boolean {
    return this.config.hooks.enabled;
  }

  isAgentsEnabled(): boolean {
    return this.config.agents.enabled;
  }

  isMemoryEnabled(): boolean {
    return this.config.memory.enabled;
  }

  isNeoRsEnabled(): boolean {
    return this.config.neoRs.enabled;
  }

  isPerformanceMonitoringEnabled(): boolean {
    return this.config.performance.enableMetrics;
  }

  // Configuration validation
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate hook configuration
    if (this.config.hooks.hookTimeout < 1000) {
      errors.push("Hook timeout must be at least 1000ms");
    }

    // Validate agent configuration
    if (
      this.config.agents.maxConcurrent < 1 ||
      this.config.agents.maxConcurrent > 50
    ) {
      errors.push("Max concurrent agents must be between 1 and 50");
    }

    // Validate memory configuration
    if (
      this.config.memory.maxSizeMB < 10 ||
      this.config.memory.maxSizeMB > 1000
    ) {
      errors.push("Memory max size must be between 10MB and 1000MB");
    }

    // Validate neo-rs configuration
    if (
      this.config.neoRs.maxFilesPerBatch < 1 ||
      this.config.neoRs.maxFilesPerBatch > 100
    ) {
      errors.push("Neo-rs max files per batch must be between 1 and 100");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Utility methods
  private deepMerge(target: DeepMergeObject, source: DeepMergeObject): DeepMergeObject {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  private setNestedValue(obj: NestedObject, path: string, value: NestedValue): void {
    const keys = path.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  // Neo-rs environment detection method for compatibility with verification script
  async detectNeoRsEnvironment(): Promise<boolean> {
    try {
      // Check for Neo-rs specific indicators
      const neoRsIndicators = [
        "neo-rs",
        "neo-config.json",
        "Neo.VM",
        "neo-cli",
        "neo-express.json",
        "neo-devpack-dotnet",
        "contracts",
        "src/contract.cs",
      ];

      // Check current git branch
      let isNeoRsBranch = false;
      try {
        const { exec } = require("child_process");
        const { promisify } = require("util");
        const execAsync = promisify(exec);

        const { stdout } = await execAsync("git branch --show-current", {
          cwd: this.workspacePath,
        });
        const currentBranch = stdout.trim();
        isNeoRsBranch =
          currentBranch === "neo-rs" || currentBranch.includes("neo");
      } catch (error) {
        debugLog("Could not detect git branch for Neo-rs detection");
      }

      // Check for Neo-rs file indicators
      const hasNeoRsFiles = neoRsIndicators.some((indicator) => {
        const fullPath = path.join(this.workspacePath, indicator);
        return fs.existsSync(fullPath);
      });

      // Check package.json for Neo-related dependencies
      let hasNeoDependencies = false;
      const packageJsonPath = path.join(this.workspacePath, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, "utf8"),
          );
          const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
          };

          hasNeoDependencies = Object.keys(allDeps).some(
            (dep) => dep.includes("neo") || dep.includes("Neo"),
          );
        } catch (error) {
          debugLog("Could not parse package.json for Neo dependency detection");
        }
      }

      // Check for C# project files with Neo references
      let hasNeoCSProject = false;
      try {
        const csProjFiles = this.globMatch(this.workspacePath, "*.csproj");
        if (csProjFiles) {
          // Additional Neo detection logic can be added here
          hasNeoCSProject = true;
        }
      } catch (error) {
        debugLog("Could not check for C# project files");
      }

      const isNeoRsEnvironment =
        isNeoRsBranch || hasNeoRsFiles || hasNeoDependencies || hasNeoCSProject;

      if (isNeoRsEnvironment) {
        debugLog("Neo-rs environment detected");
        // Auto-enable Neo-rs features
        this.config.neoRs.enabled = true;
        this.config.languageConversion.strictValidation = true;
      }

      return isNeoRsEnvironment;
    } catch (error) {
      debugLog(`Error during Neo-rs environment detection: ${error}`);
      return false;
    }
  }

  dispose(): void {
    this.watchers.forEach((watcher) => watcher.dispose());
    this.watchers = [];
  }
}

// Enhanced configuration loader class for compatibility
export class EnhancedConfigLoader {
  constructor(private workspacePath: string) {}

  async loadConfig(): Promise<EnhancedAutoClaudeConfig> {
    const manager = getEnhancedConfig(this.workspacePath);
    await manager.initialize();
    return manager.getConfig();
  }

  mergeConfigurations(
    base: EnhancedAutoClaudeConfig,
    override: Partial<EnhancedAutoClaudeConfig>,
  ): EnhancedAutoClaudeConfig {
    const merged = JSON.parse(JSON.stringify(base)); // Deep clone

    function deepMerge(target: ConfigurationOverride, source: ConfigurationOverride): void {
      for (const key in source) {
        if (
          source[key] &&
          typeof source[key] === "object" &&
          !Array.isArray(source[key])
        ) {
          if (!target[key]) target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }

    deepMerge(merged, override);
    return merged;
  }

  validateConfiguration(config: Partial<EnhancedAutoClaudeConfig>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate hook configuration
    if (config.hooks) {
      if (config.hooks.hookTimeout && config.hooks.hookTimeout < 1000) {
        warnings.push("Hook timeout should be at least 1000ms");
      }
    }

    // Validate agent configuration
    if (config.agents) {
      if (
        config.agents.maxConcurrent &&
        (config.agents.maxConcurrent < 1 || config.agents.maxConcurrent > 50)
      ) {
        errors.push("Max concurrent agents should be between 1 and 50");
      }
    }

    // Validate memory configuration
    if (config.memory) {
      if (config.memory.maxSizeMB && config.memory.maxSizeMB < 10) {
        warnings.push("Memory size should be at least 10MB");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// Global configuration merge utility
export function mergeConfigurations(
  base: EnhancedAutoClaudeConfig,
  override: Partial<EnhancedAutoClaudeConfig>,
): EnhancedAutoClaudeConfig {
  const loader = new EnhancedConfigLoader("");
  return loader.mergeConfigurations(base, override);
}

// Singleton instance
let configManagerInstance: EnhancedConfigManager | null = null;

export function getEnhancedConfig(
  workspacePath: string,
): EnhancedConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new EnhancedConfigManager(workspacePath);
  }
  return configManagerInstance;
}
