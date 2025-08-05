import * as vscode from 'vscode';
import { ContextManager } from './contextManager';
import { ErrorRecoverySystem } from './errorRecovery';
import { SelfHealingSystem } from './selfHealing';
import { CommandOrchestrator } from './commandOrchestrator';
import { debugLog } from '../utils/logging';
import { addMessageToQueueFromWebview } from '../queue';
import { ScriptRunner } from '../scripts/index';
import { getEnhancedConfig } from '../config/enhanced-config';
import { detectNeoRsEnvironment, detectGitBranch, isNeoRsBranch } from '../config/index';

export class AutomationManager {
    private contextManager: ContextManager;
    private errorRecovery: ErrorRecoverySystem;
    private selfHealing: SelfHealingSystem;
    private scriptRunner: ScriptRunner;
    private _commandOrchestrator: CommandOrchestrator | null = null;
    private isEnabled: boolean = true;
    private config = getEnhancedConfig(this.workspacePath);
    private environmentInfo: {
        isNeoRs: boolean;
        branch: string | null;
        isNeoRsBranch: boolean;
        detectedAt: Date;
    } | null = null;
    
    constructor(private workspacePath: string) {
        this.contextManager = new ContextManager(workspacePath);
        this.errorRecovery = new ErrorRecoverySystem(this.contextManager, workspacePath);
        this.selfHealing = new SelfHealingSystem(workspacePath);
        this.scriptRunner = new ScriptRunner(workspacePath);
    }
    
    /**
     * Initialize automation features
     */
    async initialize() {
        try {
            debugLog('Initializing automation manager...');
            
            // Initialize enhanced configuration
            await this.config.initialize();
            
            // Detect environment first
            await this.detectEnvironment();
            
            await this.scriptRunner.initialize();
            await this.scriptRunner.loadUserScripts();
            
            // Initialize command orchestrator if context system is available
            const contextProvider = (global as any).contextProvider;
            if (contextProvider) {
                const taskManager = contextProvider.taskManager;
                this._commandOrchestrator = new CommandOrchestrator(
                    contextProvider,
                    taskManager,
                    this.workspacePath
                );
                debugLog('Command orchestrator initialized');
            }

            // Log environment information
            if (this.environmentInfo) {
                debugLog(`Environment detected: Neo-rs=${this.environmentInfo.isNeoRs}, Branch=${this.environmentInfo.branch}, Neo Branch=${this.environmentInfo.isNeoRsBranch}`);
                
                if (this.environmentInfo.isNeoRs) {
                    vscode.window.showInformationMessage('AutoClaude: Neo-rs environment detected. Enhanced features enabled.');
                }
            }
        } catch (error) {
            debugLog(`Failed to initialize automation manager: ${error}`);
            vscode.window.showErrorMessage(`Automation initialization failed: ${error instanceof Error ? error.message : String(error)}`);
            // Continue without automation rather than blocking the extension
            this.isEnabled = false;
        }
    }

    /**
     * Detect and configure environment-specific settings
     */
    private async detectEnvironment(): Promise<void> {
        try {
            const isNeoRs = detectNeoRsEnvironment(this.workspacePath);
            const branch = detectGitBranch(this.workspacePath);
            const isNeoRsBranchDetected = isNeoRsBranch(branch);

            this.environmentInfo = {
                isNeoRs,
                branch,
                isNeoRsBranch: isNeoRsBranchDetected,
                detectedAt: new Date()
            };

            // Apply environment-specific configurations
            if (isNeoRs || isNeoRsBranchDetected) {
                await this.configureForNeoRs();
            }

            debugLog(`Environment detection complete: Neo-rs=${isNeoRs}, Branch=${branch}, Neo Branch=${isNeoRsBranchDetected}`);
        } catch (error) {
            debugLog(`Environment detection failed: ${error}`);
            // Continue with default configuration
        }
    }

    /**
     * Configure automation for Neo-rs environment
     */
    private async configureForNeoRs(): Promise<void> {
        try {
            const currentConfig = this.config.getConfig();
            
            // Enable Neo-rs specific features
            if (!currentConfig.neoRs.enabled) {
                debugLog('Enabling Neo-rs features for detected environment');
                
                // This would typically update configuration, but we don't want to
                // modify user settings automatically. Instead, we log and notify.
                debugLog('Neo-rs environment detected - enhanced features available');
            }

            // Enable enhanced memory and agents for better C# to Rust conversion
            if (currentConfig.memory.enabled && currentConfig.agents.enabled) {
                debugLog('Memory and agent systems available for Neo-rs conversions');
            }

        } catch (error) {
            debugLog(`Neo-rs configuration failed: ${error}`);
        }
    }
    
    /**
     * Process message with enhanced automation
     */
    async processMessage(message: string, currentFile?: string): Promise<string> {
        if (!this.isEnabled) {
            return message;
        }
        
        try {
            debugLog('Processing message with automation...');
            
            // 1. Get relevant context files
            const relevantFiles = await this.contextManager.getRelevantFiles(
                currentFile || '',
                message
            );
            
            // 2. Track file modifications
            if (currentFile) {
                this.contextManager.trackFileModification(currentFile);
            }
            
            // 3. Generate enhanced prompt with context
            const enhancedPrompt = await this.contextManager.generateContextPrompt(
                relevantFiles,
                message
            );
            
            // 4. Add environment-aware automation instructions
            const automatedPrompt = this.addEnvironmentAwareInstructions(enhancedPrompt, message);
            
            debugLog(`Enhanced message with ${relevantFiles.length} context files`);
            
            return automatedPrompt;
        } catch (error) {
            debugLog(`Error processing message with automation: ${error}`);
            // Fallback to original message if automation fails
            return message;
        }
    }
    
    /**
     * Handle errors with recovery system
     */
    async handleError(error: string, context?: any): Promise<boolean> {
        try {
            debugLog('Handling error with automation...');
            
            // 1. Try self-healing first
            const healed = await this.selfHealing.diagnoseAndHeal(error);
            if (healed) {
                return true;
            }
            
            // 2. Use error recovery system
            const strategy = await this.errorRecovery.analyzeError(error, context);
            if (strategy) {
                return await this.errorRecovery.executeRecovery(strategy);
            }
            
            return false;
        } catch (recoveryError) {
            debugLog(`Error during error recovery: ${recoveryError}`);
            // Don't throw to avoid cascading failures
            return false;
        }
    }
    
    /**
     * Run comprehensive validation
     */
    async runValidation(): Promise<void> {
        try {
            debugLog('Running comprehensive validation...');
            
            // Run all enabled scripts
            const { allPassed, results } = await this.scriptRunner.runChecks();
            
            if (!allPassed) {
                // Generate fix instructions
                const failedScripts = Array.from(results.entries())
                    .filter(([_, result]) => !result.passed);
                
                const fixPrompt = this.generateValidationFixPrompt(failedScripts);
                addMessageToQueueFromWebview(fixPrompt);
            }
        } catch (error) {
            debugLog(`Validation error: ${error}`);
            vscode.window.showErrorMessage(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Add automation instructions to prompt
     */
    /**
     * Add environment-aware automation instructions
     */
    private addEnvironmentAwareInstructions(prompt: string, originalMessage: string): string {
        let instructions = `
=== Environment-Aware Automation Instructions ===
1. Ensure all code is production-ready with no TODOs or placeholders
2. Include comprehensive error handling
3. Add appropriate documentation for all public functions/classes
4. Follow the existing code style and conventions
5. Write tests for new functionality
6. Ensure changes maintain backward compatibility
7. Optimize for performance where applicable
8. Consider security implications of changes`;

        // Add Neo-rs specific instructions if in Neo environment
        if (this.environmentInfo && (this.environmentInfo.isNeoRs || this.environmentInfo.isNeoRsBranch)) {
            instructions += `

=== Neo-rs Specific Instructions ===
9. PRIORITY: Ensure 100% compatibility with C# Neo N3 implementation
10. Use appropriate Neo-rs type mappings (UInt160 → U160, UInt256 → U256, etc.)
11. Validate all Neo-specific patterns and conventions
12. Ensure smart contract compatibility and proper VM integration
13. Include Neo-rs specific error handling for blockchain operations
14. Consider Neo protocol requirements and constraints
15. Optimize for Neo blockchain performance characteristics
16. Validate against Neo N3 consensus mechanisms
17. Ensure proper handling of Neo cryptographic operations`;

            // Add conversion-specific instructions if message contains conversion keywords
            const isConversionTask = /convert|port|migrate|translate.*c#.*rust|rust.*c#/i.test(originalMessage);
            if (isConversionTask) {
                instructions += `

=== C# to Rust Conversion Instructions ===
18. Use pattern learning from previous successful conversions
19. Apply learned type mappings and idiom conversions
20. Validate converted code maintains identical functionality
21. Include comprehensive tests comparing C# and Rust behavior
22. Document any behavioral differences or limitations
23. Ensure memory safety and performance optimizations in Rust
24. Use appropriate Rust ownership patterns for Neo types`;
            }
        }

        // Add branch-specific instructions
        if (this.environmentInfo?.branch) {
            instructions += `

=== Branch Context ===
Current branch: ${this.environmentInfo.branch}
Environment detected at: ${this.environmentInfo.detectedAt.toISOString()}`;
        }

        const config = this.config.getConfig();
        
        // Add configuration-aware instructions
        if (config.memory.enabled) {
            instructions += `
- Pattern learning is available for improved conversions
- Previous conversion patterns will be referenced and applied`;
        }

        if (config.agents.enabled) {
            instructions += `
- Multi-agent coordination is available for complex tasks
- Specialized converter and validator agents can be utilized`;
        }

        if (config.hooks.enabled) {
            instructions += `
- Automated validation and formatting hooks are active
- Code will be automatically validated for syntax and Neo-rs compatibility`;
        }

        instructions += `

=== End Automation Instructions ===`;

        return prompt + instructions;
    }

    /**
     * Legacy method for backward compatibility
     */
    private addAutomationInstructions(prompt: string): string {
        return this.addEnvironmentAwareInstructions(prompt, '');
    }
    
    /**
     * Generate fix prompt for validation failures
     */
    private generateValidationFixPrompt(failures: Array<[string, any]>): string {
        let prompt = 'Please fix the following validation issues:\n\n';
        
        for (const [scriptId, result] of failures) {
            prompt += `**${scriptId}**:\n`;
            result.errors.forEach((error: string) => {
                prompt += `- ${error}\n`;
            });
            prompt += '\n';
        }
        
        prompt += '\nEnsure all fixes are complete and the code passes all validation checks.';
        
        return prompt;
    }
    
    /**
     * Enable/disable automation
     */
    setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
        debugLog(`Automation ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Execute high-level command with intelligent task decomposition
     */
    async executeCommand(command: string): Promise<string> {
        if (!this._commandOrchestrator) {
            return 'Command orchestrator not initialized. Please ensure the context system is running.';
        }
        
        try {
            debugLog(`Executing high-level command: ${command}`);
            
            // Execute command through orchestrator
            const result = await this._commandOrchestrator.executeCommand(command);
            
            if (result.success) {
                // Add follow-up message to queue if needed
                if (result.taskId) {
                    const followUp = `Task created: ${result.taskId}\n\n${result.message}`;
                    await addMessageToQueueFromWebview(followUp);
                }
                
                return result.message;
            } else {
                return `Command execution failed: ${result.message}`;
            }
        } catch (error) {
            debugLog(`Command execution error: ${error}`);
            return `Error executing command: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    
    /**
     * Get command suggestions based on current context
     */
    async getCommandSuggestions(): Promise<string[]> {
        if (!this._commandOrchestrator) {
            return [];
        }
        
        return await this._commandOrchestrator.getCommandSuggestions();
    }
    
    /**
     * Get active workflow status
     */
    getActiveWorkflows() {
        if (!this._commandOrchestrator) {
            return [];
        }
        
        return this._commandOrchestrator.getActiveWorkflows();
    }
    
    /**
     * Get automation statistics
     */
    getStatistics() {
        return {
            errorRecoveryStats: this.errorRecovery.getStatistics(),
            contextFilesTracked: this.contextManager['recentFiles'].length,
            scriptsAvailable: this.scriptRunner['config'].scripts.length,
            activeWorkflows: this._commandOrchestrator ? this._commandOrchestrator.getActiveWorkflows().length : 0,
            environmentInfo: this.environmentInfo,
            enhancedFeaturesEnabled: {
                memory: this.config.getConfig().memory.enabled,
                agents: this.config.getConfig().agents.enabled,
                hooks: this.config.getConfig().hooks.enabled,
                neoRs: this.config.getConfig().neoRs.enabled
            }
        };
    }

    /**
     * Get current environment information
     */
    getEnvironmentInfo() {
        return this.environmentInfo;
    }

    /**
     * Check if current environment is Neo-rs
     */
    isNeoRsEnvironment(): boolean {
        return this.environmentInfo ? 
            (this.environmentInfo.isNeoRs || this.environmentInfo.isNeoRsBranch) : false;
    }

    /**
     * Re-detect environment (useful after branch changes)
     */
    async refreshEnvironment(): Promise<void> {
        await this.detectEnvironment();
        debugLog('Environment refreshed');
    }
    
    /**
     * Get the command orchestrator instance
     */
    get commandOrchestrator(): CommandOrchestrator | null {
        return this._commandOrchestrator;
    }
}