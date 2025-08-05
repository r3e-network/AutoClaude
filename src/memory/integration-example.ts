import * as vscode from 'vscode';
import { MemoryManager, getMemoryManager } from './MemoryManager';
import { debugLog } from '../utils/logging';

/**
 * Example integration showing how the memory system works with
 * AutoClaude's hooks and agents for neo-rs conversion
 */

// Example 1: Hook Integration with Memory
export class MemoryAwareHooks {
    private memory: MemoryManager;

    constructor(workspacePath: string) {
        this.memory = getMemoryManager(workspacePath);
    }

    /**
     * Post-conversion hook that learns from successful conversions
     */
    async postConversionHook(
        sourceFile: string,
        targetFile: string,
        csharpCode: string,
        rustCode: string,
        success: boolean
    ): Promise<void> {
        if (success) {
            // Extract and record patterns
            const patterns = this.extractPatterns(csharpCode, rustCode);
            
            for (const pattern of patterns) {
                await this.memory.recordPattern(
                    pattern.csharp,
                    pattern.rust,
                    pattern.type,
                    0.8, // Initial confidence
                    {
                        sourceFile,
                        firstSeen: new Date().toISOString()
                    }
                );
            }

            debugLog(`Learned ${patterns.length} patterns from ${sourceFile}`);
        }
    }

    /**
     * Pre-conversion hook that suggests patterns from memory
     */
    async preConversionHook(csharpCode: string): Promise<any> {
        // Find similar patterns
        const patterns = await this.memory.findSimilarPatterns(csharpCode, 'syntax', 3);
        
        if (patterns.length > 0) {
            debugLog(`Found ${patterns.length} similar patterns to apply`);
            return {
                suggestedPatterns: patterns,
                confidence: patterns[0].confidence
            };
        }

        return null;
    }

    private extractPatterns(csharpCode: string, rustCode: string): any[] {
        const patterns = [];

        // Extract class to struct patterns
        const classMatch = csharpCode.match(/public\s+class\s+(\w+)(?:\s*:\s*(\w+))?/);
        const structMatch = rustCode.match(/pub\s+struct\s+(\w+)/);
        
        if (classMatch && structMatch) {
            patterns.push({
                type: 'syntax',
                csharp: `public class ${classMatch[1]}${classMatch[2] ? ' : ' + classMatch[2] : ''}`,
                rust: `pub struct ${structMatch[1]}`
            });
        }

        // Extract method patterns
        const methodRegex = /public\s+(\w+)\s+(\w+)\s*\([^)]*\)/g;
        let match;
        
        while ((match = methodRegex.exec(csharpCode)) !== null) {
            const rustMethod = rustCode.match(new RegExp(`pub\\s+fn\\s+${match[2].toLowerCase()}`));
            if (rustMethod) {
                patterns.push({
                    type: 'syntax',
                    csharp: match[0],
                    rust: rustMethod[0]
                });
            }
        }

        return patterns;
    }
}

// Example 2: Agent with Memory
export class ConverterAgentWithMemory {
    private memory: MemoryManager;
    private agentId: string;

    constructor(workspacePath: string, agentId: string) {
        this.memory = getMemoryManager(workspacePath);
        this.agentId = agentId;
    }

    /**
     * Convert C# code using learned patterns
     */
    async convert(csharpCode: string, filePath: string): Promise<string> {
        // Check memory for similar conversions
        const previousConversion = await this.memory.recallAgentMemory(
            this.agentId,
            `conversion:${this.hashCode(csharpCode)}`
        );

        if (previousConversion) {
            debugLog('Using cached conversion from memory');
            return previousConversion.rustCode;
        }

        // Find applicable patterns
        const patterns = await this.memory.findSimilarPatterns(csharpCode, undefined, 10);
        
        // Apply patterns (simplified example)
        let rustCode = csharpCode;
        
        for (const pattern of patterns) {
            if (pattern.confidence > 0.7) {
                rustCode = this.applyPattern(rustCode, pattern);
            }
        }

        // Learn from this conversion
        await this.memory.storeAgentMemory(
            this.agentId,
            `conversion:${this.hashCode(csharpCode)}`,
            {
                rustCode,
                patterns: patterns.map(p => p.pattern_hash),
                timestamp: new Date().toISOString()
            },
            0.8 // High importance
        );

        return rustCode;
    }

    /**
     * Update agent's knowledge based on validation results
     */
    async learnFromValidation(
        csharpCode: string,
        rustCode: string,
        validationResult: any
    ): Promise<void> {
        const patterns = await this.memory.recallAgentMemory(
            this.agentId,
            `conversion:${this.hashCode(csharpCode)}`
        );

        if (patterns && patterns.patterns) {
            // Update pattern success/failure
            for (const patternHash of patterns.patterns) {
                await this.memory.updatePatternSuccess(
                    patternHash,
                    validationResult.success
                );
            }
        }

        // Store validation insights
        await this.memory.storeAgentMemory(
            this.agentId,
            'validation_insights',
            {
                totalValidations: (await this.getValidationCount()) + 1,
                successRate: await this.calculateSuccessRate(validationResult.success),
                commonIssues: await this.updateCommonIssues(validationResult.issues)
            },
            0.9
        );
    }

    private applyPattern(code: string, pattern: any): string {
        // Simplified pattern application
        return code.replace(
            new RegExp(pattern.csharp_pattern, 'g'),
            pattern.rust_pattern
        );
    }

    private hashCode(code: string): string {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(code).digest('hex').substring(0, 8);
    }

    private async getValidationCount(): Promise<number> {
        const insights = await this.memory.recallAgentMemory(this.agentId, 'validation_insights');
        return insights?.totalValidations || 0;
    }

    private async calculateSuccessRate(currentSuccess: boolean): Promise<number> {
        const insights = await this.memory.recallAgentMemory(this.agentId, 'validation_insights');
        const total = (insights?.totalValidations || 0) + 1;
        const successes = (insights?.successRate || 0) * (total - 1) + (currentSuccess ? 1 : 0);
        return successes / total;
    }

    private async updateCommonIssues(newIssues: string[]): Promise<string[]> {
        const insights = await this.memory.recallAgentMemory(this.agentId, 'validation_insights');
        const issues = insights?.commonIssues || [];
        
        // Add new issues and keep top 10 most common
        const issueMap = new Map<string, number>();
        
        [...issues, ...newIssues].forEach(issue => {
            issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
        });

        return Array.from(issueMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([issue]) => issue);
    }
}

// Example 3: Project Progress Tracking
export class ProjectProgressTracker {
    private memory: MemoryManager;

    constructor(workspacePath: string) {
        this.memory = getMemoryManager(workspacePath);
    }

    /**
     * Initialize tracking for a neo-rs module
     */
    async startModuleConversion(moduleName: string): Promise<void> {
        const project = await this.memory.getOrCreateProject(
            vscode.workspace.workspaceFolders![0].uri.fsPath,
            moduleName
        );

        // Count files to convert
        const files = await vscode.workspace.findFiles(
            `**/${moduleName}/**/*.cs`,
            '**/node_modules/**'
        );

        await this.memory.updateProjectProgress(
            project.project_path,
            moduleName,
            {
                files_total: files.length,
                conversion_status: 'in_progress'
            }
        );

        debugLog(`Started tracking ${moduleName} with ${files.length} files`);
    }

    /**
     * Update progress after file conversion
     */
    async updateFileProgress(
        moduleName: string,
        fileName: string,
        success: boolean
    ): Promise<void> {
        const project = await this.memory.getOrCreateProject(
            vscode.workspace.workspaceFolders![0].uri.fsPath,
            moduleName
        );

        if (success) {
            await this.memory.updateProjectProgress(
                project.project_path,
                moduleName,
                {
                    files_converted: project.files_converted + 1
                }
            );
        }

        // Check if module is complete
        if (project.files_converted + 1 === project.files_total) {
            await this.memory.updateProjectProgress(
                project.project_path,
                moduleName,
                {
                    conversion_status: 'completed'
                }
            );

            vscode.window.showInformationMessage(
                `✅ Module ${moduleName} conversion complete!`
            );
        }
    }

    /**
     * Get conversion statistics
     */
    async getStats(): Promise<void> {
        const stats = await this.memory.getConversionStats();
        
        const message = `
Conversion Statistics:
- Total Conversions: ${stats.overall.total_conversions}
- Success Rate: ${(stats.overall.successful / stats.overall.total_conversions * 100).toFixed(1)}%
- Average Duration: ${(stats.overall.avg_duration_ms / 1000).toFixed(1)}s
- Patterns Learned: ${stats.patterns.total_patterns}
- Pattern Confidence: ${(stats.patterns.avg_confidence * 100).toFixed(1)}%
        `;

        vscode.window.showInformationMessage(message);
    }
}

// Example 4: Memory-Enhanced VS Code Commands
export function registerMemoryCommands(context: vscode.ExtensionContext) {
    const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const memory = getMemoryManager(workspacePath);

    // Command: Show learned patterns
    context.subscriptions.push(
        vscode.commands.registerCommand('autoclaude.showLearnedPatterns', async () => {
            const stats = await memory.getConversionStats();
            
            const panel = vscode.window.createWebviewPanel(
                'learnedPatterns',
                'Learned Conversion Patterns',
                vscode.ViewColumn.One,
                {}
            );

            panel.webview.html = `
                <html>
                <body>
                    <h1>Top Conversion Patterns</h1>
                    <table>
                        <tr>
                            <th>C# Pattern</th>
                            <th>Rust Pattern</th>
                            <th>Confidence</th>
                            <th>Usage</th>
                        </tr>
                        ${stats.topPatterns.map((p: any) => `
                            <tr>
                                <td><code>${p.csharp_pattern}</code></td>
                                <td><code>${p.rust_pattern}</code></td>
                                <td>${(p.confidence * 100).toFixed(1)}%</td>
                                <td>${p.usage_count}</td>
                            </tr>
                        `).join('')}
                    </table>
                </body>
                </html>
            `;
        })
    );

    // Command: Export memory
    context.subscriptions.push(
        vscode.commands.registerCommand('autoclaude.exportMemory', async () => {
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('autoclaude-memory.json'),
                filters: {
                    'JSON files': ['json']
                }
            });

            if (uri) {
                await memory.exportMemory(uri.fsPath);
                vscode.window.showInformationMessage('Memory exported successfully');
            }
        })
    );

    // Command: Prune old memory
    context.subscriptions.push(
        vscode.commands.registerCommand('autoclaude.pruneMemory', async () => {
            await memory.pruneOldMemory(30);
            vscode.window.showInformationMessage('Old memory entries pruned');
        })
    );
}

// Initialize memory system when extension activates
export async function initializeMemorySystem(context: vscode.ExtensionContext): Promise<void> {
    const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const memory = getMemoryManager(workspacePath);

    try {
        await memory.initialize();
        debugLog('Memory system initialized successfully');

        // Register commands
        registerMemoryCommands(context);

        // Setup automatic memory pruning
        const pruneInterval = setInterval(async () => {
            await memory.pruneOldMemory(30);
        }, 24 * 60 * 60 * 1000); // Daily

        context.subscriptions.push({
            dispose: () => {
                clearInterval(pruneInterval);
                memory.close();
            }
        });

    } catch (error) {
        debugLog(`Failed to initialize memory system: ${error}`);
        vscode.window.showErrorMessage('Failed to initialize memory system');
    }
}