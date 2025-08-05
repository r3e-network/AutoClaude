/**
 * Configuration Module - Enhanced AutoClaude Configuration System
 * 
 * This module provides enhanced configuration management with auto-detection,
 * validation, and workspace-specific settings.
 */

export { EnhancedConfigLoader } from './enhanced-config';

// Configuration interfaces
export interface AutoClaudeConfig {
    // Core settings
    core: {
        enabled: boolean;
        debugMode: boolean;
        logLevel: 'error' | 'warn' | 'info' | 'debug';
        workspaceIsolation: boolean;
    };

    // Enhanced features
    enhanced: {
        memory: {
            enabled: boolean;
            dbPath?: string;
            maxSizeMB: number;
            pruneAfterDays: number;
            enableCompression: boolean;
            enableAutoBackup: boolean;
            patternConfidenceThreshold: number;
        };
        agents: {
            enabled: boolean;
            maxConcurrent: number;
            coordinationStrategy: 'sequential' | 'parallel' | 'adaptive';
            retryFailedTasks: boolean;
            maxRetries: number;
            agentTimeout: number;
        };
        hooks: {
            enabled: boolean;
            autoFormat: boolean;
            validateSyntax: boolean;
            learnPatterns: boolean;
            hookTimeout: number;
            enableAsyncHooks: boolean;
        };
        monitoring: {
            enabled: boolean;
            metricsInterval: number;
            alertThresholds: {
                cpu: number;
                memory: number;
                disk: number;
                errorRate: number;
                queueSize: number;
            };
            enableNotifications: boolean;
            retentionDays: number;
        };
    };

    // Neo-rs specific settings
    neoRs: {
        enabled: boolean;
        autoDetectEnvironment: boolean;
        parallelConversion: boolean;
        strictValidation: boolean;
        generateCompatibilityReport: boolean;
        typeValidation: {
            enabled: boolean;
            strictMode: boolean;
            customMappings: Record<string, string>;
        };
        conversionSettings: {
            preserveComments: boolean;
            generateTests: boolean;
            includeDocumentation: boolean;
            optimizePerformance: boolean;
        };
    };

    // Development settings
    development: {
        enableExperimentalFeatures: boolean;
        verboseLogging: boolean;
        profilePerformance: boolean;
        enableDebugMode: boolean;
    };
}

// Default configuration
export const DEFAULT_CONFIG: AutoClaudeConfig = {
    core: {
        enabled: true,
        debugMode: false,
        logLevel: 'info',
        workspaceIsolation: true
    },
    enhanced: {
        memory: {
            enabled: true,
            maxSizeMB: 100,
            pruneAfterDays: 30,
            enableCompression: true,
            enableAutoBackup: true,
            patternConfidenceThreshold: 0.7
        },
        agents: {
            enabled: true,
            maxConcurrent: 5,
            coordinationStrategy: 'adaptive',
            retryFailedTasks: true,
            maxRetries: 3,
            agentTimeout: 300000
        },
        hooks: {
            enabled: true,
            autoFormat: true,
            validateSyntax: true,
            learnPatterns: true,
            hookTimeout: 30000,
            enableAsyncHooks: true
        },
        monitoring: {
            enabled: true,
            metricsInterval: 5000,
            alertThresholds: {
                cpu: 80,
                memory: 85,
                disk: 90,
                errorRate: 10,
                queueSize: 100
            },
            enableNotifications: true,
            retentionDays: 7
        }
    },
    neoRs: {
        enabled: false, // Enabled automatically when detected
        autoDetectEnvironment: true,
        parallelConversion: true,
        strictValidation: true,
        generateCompatibilityReport: true,
        typeValidation: {
            enabled: true,
            strictMode: true,
            customMappings: {}
        },
        conversionSettings: {
            preserveComments: true,
            generateTests: true,
            includeDocumentation: true,
            optimizePerformance: true
        }
    },
    development: {
        enableExperimentalFeatures: false,
        verboseLogging: false,
        profilePerformance: false,
        enableDebugMode: false
    }
};

// Configuration validation
export interface ConfigValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    fixedValues: Record<string, any>;
}

export function validateConfig(config: Partial<AutoClaudeConfig>): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fixedValues: Record<string, any> = {};

    // Validate core settings
    if (config.core) {
        if (config.core.logLevel && !['error', 'warn', 'info', 'debug'].includes(config.core.logLevel)) {
            errors.push(`Invalid log level: ${config.core.logLevel}`);
        }
    }

    // Validate enhanced settings
    if (config.enhanced?.memory) {
        const memory = config.enhanced.memory;
        
        if (memory.maxSizeMB !== undefined && (memory.maxSizeMB < 10 || memory.maxSizeMB > 10000)) {
            warnings.push('Memory size should be between 10MB and 10GB');
            fixedValues['enhanced.memory.maxSizeMB'] = Math.max(10, Math.min(10000, memory.maxSizeMB));
        }

        if (memory.patternConfidenceThreshold !== undefined && 
            (memory.patternConfidenceThreshold < 0 || memory.patternConfidenceThreshold > 1)) {
            errors.push('Pattern confidence threshold must be between 0 and 1');
        }
    }

    if (config.enhanced?.agents) {
        const agents = config.enhanced.agents;
        
        if (agents.maxConcurrent !== undefined && (agents.maxConcurrent < 1 || agents.maxConcurrent > 50)) {
            warnings.push('Max concurrent agents should be between 1 and 50');
            fixedValues['enhanced.agents.maxConcurrent'] = Math.max(1, Math.min(50, agents.maxConcurrent));
        }

        if (agents.coordinationStrategy && 
            !['sequential', 'parallel', 'adaptive'].includes(agents.coordinationStrategy)) {
            errors.push(`Invalid coordination strategy: ${agents.coordinationStrategy}`);
        }
    }

    // Validate monitoring thresholds
    if (config.enhanced?.monitoring?.alertThresholds) {
        const thresholds = config.enhanced.monitoring.alertThresholds;
        
        const thresholdValidation = [
            { key: 'cpu', min: 10, max: 100 },
            { key: 'memory', min: 10, max: 100 },
            { key: 'disk', min: 10, max: 100 },
            { key: 'errorRate', min: 1, max: 100 },
            { key: 'queueSize', min: 10, max: 10000 }
        ];

        for (const { key, min, max } of thresholdValidation) {
            const value = (thresholds as any)[key];
            if (value !== undefined && (value < min || value > max)) {
                warnings.push(`${key} threshold should be between ${min} and ${max}`);
                fixedValues[`enhanced.monitoring.alertThresholds.${key}`] = Math.max(min, Math.min(max, value));
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        fixedValues
    };
}

export function mergeConfigs(base: AutoClaudeConfig, override: Partial<AutoClaudeConfig>): AutoClaudeConfig {
    const merged = JSON.parse(JSON.stringify(base)); // Deep clone

    function deepMerge(target: any, source: any): void {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
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

export function getConfigPath(workspaceRoot?: string): string {
    const path = require('path');
    
    if (workspaceRoot) {
        return path.join(workspaceRoot, '.autoclaude', 'config.json');
    }
    
    // Global config path
    const os = require('os');
    return path.join(os.homedir(), '.autoclaude', 'config.json');
}

export function loadConfigFromFile(configPath: string): Partial<AutoClaudeConfig> | null {
    try {
        const fs = require('fs');
        
        if (!fs.existsSync(configPath)) {
            return null;
        }

        const content = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.warn(`Failed to load config from ${configPath}:`, error);
        return null;
    }
}

export function saveConfigToFile(config: AutoClaudeConfig, configPath: string): boolean {
    try {
        const fs = require('fs');
        const path = require('path');
        
        // Ensure directory exists
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error(`Failed to save config to ${configPath}:`, error);
        return false;
    }
}

// Environment detection utilities
export function detectNeoRsEnvironment(workspaceRoot: string): boolean {
    try {
        const fs = require('fs');
        const path = require('path');

        // Check for neo-rs indicators
        const indicators = [
            'Cargo.toml',
            'neo-rs',
            'src/lib.rs',
            '.git'
        ];

        for (const indicator of indicators) {
            const fullPath = path.join(workspaceRoot, indicator);
            if (fs.existsSync(fullPath)) {
                // Check content for neo-related patterns
                if (indicator === 'Cargo.toml') {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    if (content.includes('neo') || content.includes('blockchain')) {
                        return true;
                    }
                } else if (indicator === '.git') {
                    // Check git remote for neo-related repositories
                    const gitConfig = path.join(fullPath, 'config');
                    if (fs.existsSync(gitConfig)) {
                        const content = fs.readFileSync(gitConfig, 'utf8');
                        if (content.includes('neo-project') || content.includes('neo-rs')) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    } catch (error) {
        console.warn('Failed to detect neo-rs environment:', error);
        return false;
    }
}

export function detectGitBranch(workspaceRoot: string): string | null {
    try {
        const fs = require('fs');
        const path = require('path');
        
        const gitHead = path.join(workspaceRoot, '.git', 'HEAD');
        if (!fs.existsSync(gitHead)) {
            return null;
        }

        const content = fs.readFileSync(gitHead, 'utf8').trim();
        const match = content.match(/ref: refs\/heads\/(.+)/);
        
        return match ? match[1] : null;
    } catch (error) {
        console.warn('Failed to detect git branch:', error);
        return null;
    }
}

// Configuration utilities
export function isNeoRsBranch(branch: string | null): boolean {
    if (!branch) return false;
    
    const neoPatterns = ['neo-rs', 'neo_rs', 'neo', 'blockchain', 'rust-port'];
    return neoPatterns.some(pattern => branch.toLowerCase().includes(pattern));
}

export function getEnvironmentSpecificConfig(
    baseConfig: AutoClaudeConfig,
    workspaceRoot: string
): AutoClaudeConfig {
    const config = JSON.parse(JSON.stringify(baseConfig)); // Deep clone

    // Auto-detect and configure Neo-rs features
    if (detectNeoRsEnvironment(workspaceRoot)) {
        config.neoRs.enabled = true;
        
        // Enhanced settings for Neo-rs
        config.enhanced.memory.patternConfidenceThreshold = 0.8; // Higher threshold for Neo
        config.enhanced.agents.maxConcurrent = 3; // Conservative for complex conversions
        config.enhanced.hooks.validateSyntax = true; // Critical for Neo compatibility
        config.neoRs.strictValidation = true;
    }

    // Branch-specific configuration
    const branch = detectGitBranch(workspaceRoot);
    if (isNeoRsBranch(branch)) {
        config.neoRs.enabled = true;
        config.development.enableExperimentalFeatures = true;
    }

    return config;
}