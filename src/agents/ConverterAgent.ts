/**
 * Converter Agent - Specialized C# to Rust Conversion
 * 
 * This agent handles intelligent C# to Rust code conversion with pattern learning
 * and Neo-rs specific optimizations.
 */

import { Agent, Task, AgentResult } from './index';
import { getMemoryManager } from '../memory';

export class ConverterAgent implements Agent {
    public readonly id: string;
    public readonly type: string = 'converter';
    public status: 'idle' | 'busy' | 'error' = 'idle';
    public readonly capabilities: string[] = [
        'csharp-to-rust',
        'pattern-learning',
        'neo-types',
        'syntax-conversion'
    ];
    public lastActivity: Date = new Date();
    public taskCount: number = 0;
    public errorCount: number = 0;

    private memoryManager: any;

    constructor(id: string, workspacePath?: string) {
        this.id = id;
        if (workspacePath) {
            const { getMemoryManager } = require('../memory');
            this.memoryManager = getMemoryManager(workspacePath);
        }
    }

    async processTask(task: Task): Promise<AgentResult> {
        this.status = 'busy';
        this.lastActivity = new Date();
        
        try {
            const startTime = Date.now();
            let result: any;

            switch (task.type) {
                case 'convert-file':
                    result = await this.convertFile(task.input);
                    break;
                case 'convert-snippet':
                    result = await this.convertSnippet(task.input);
                    break;
                case 'learn-pattern':
                    result = await this.learnPattern(task.input);
                    break;
                default:
                    throw new Error(`Unsupported task type: ${task.type}`);
            }

            const duration = Date.now() - startTime;
            this.taskCount++;
            this.status = 'idle';

            return {
                success: true,
                output: result,
                metrics: {
                    duration,
                    memoryUsage: process.memoryUsage().heapUsed,
                    cpuUsage: process.cpuUsage().user
                }
            };
        } catch (error) {
            this.errorCount++;
            this.status = 'error';
            
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private async convertFile(input: { filePath: string; content: string }): Promise<{
        convertedContent: string;
        confidence: number;
        patternsUsed: string[];
    }> {
        const { filePath, content } = input;
        
        // Check for learned patterns
        const patterns = await this.memoryManager.getPatterns('syntax', 0.7);
        const patternsUsed: string[] = [];
        let convertedContent = content;
        let confidence = 0.5; // Base confidence

        // Apply learned patterns
        for (const pattern of patterns) {
            if (convertedContent.includes(pattern.input_pattern)) {
                convertedContent = convertedContent.replace(
                    new RegExp(this.escapeRegex(pattern.input_pattern), 'g'),
                    pattern.output_pattern
                );
                patternsUsed.push(pattern.input_pattern);
                confidence = Math.max(confidence, pattern.confidence);
            }
        }

        // Apply built-in Neo-rs type mappings
        const neoTypeMap = await this.getNeoTypeMap();
        for (const [csharpType, rustType] of Object.entries(neoTypeMap)) {
            const regex = new RegExp(`\\b${this.escapeRegex(csharpType)}\\b`, 'g');
            if (regex.test(convertedContent)) {
                convertedContent = convertedContent.replace(regex, rustType);
                patternsUsed.push(`${csharpType} -> ${rustType}`);
                confidence = Math.max(confidence, 0.9);
            }
        }

        // Record successful conversion for learning
        if (patternsUsed.length > 0) {
            await this.memoryManager.recordPattern(
                content,
                convertedContent,
                'file_conversion',
                confidence
            );
        }

        return {
            convertedContent,
            confidence,
            patternsUsed
        };
    }

    private async convertSnippet(input: { snippet: string; context?: string }): Promise<{
        convertedSnippet: string;
        confidence: number;
        explanation: string;
    }> {
        const { snippet, context } = input;
        
        // Simple pattern-based conversion for common constructs
        let converted = snippet;
        let confidence = 0.6;
        const explanations: string[] = [];

        // Class declaration
        if (/public\s+class\s+(\w+)/.test(converted)) {
            converted = converted.replace(/public\s+class\s+(\w+)/, 'pub struct $1');
            explanations.push('Converted C# class to Rust struct');
            confidence = 0.8;
        }

        // Method declaration
        if (/public\s+(\w+)\s+(\w+)\s*\(([^)]*)\)/.test(converted)) {
            converted = converted.replace(
                /public\s+(\w+)\s+(\w+)\s*\(([^)]*)\)/,
                'pub fn $2($3) -> $1'
            );
            explanations.push('Converted C# method to Rust function');
            confidence = 0.7;
        }

        // Property declaration
        if (/public\s+(\w+)\s+(\w+)\s*{\s*get;\s*set;\s*}/.test(converted)) {
            converted = converted.replace(
                /public\s+(\w+)\s+(\w+)\s*{\s*get;\s*set;\s*}/,
                'pub $2: $1,'
            );
            explanations.push('Converted C# property to Rust field');
            confidence = 0.75;
        }

        return {
            convertedSnippet: converted,
            confidence,
            explanation: explanations.join('; ')
        };
    }

    private async learnPattern(input: { 
        inputPattern: string; 
        outputPattern: string; 
        category: string; 
        confidence: number;
    }): Promise<{ success: boolean; patternId?: string }> {
        const { inputPattern, outputPattern, category, confidence } = input;
        
        try {
            const patternId = await this.memoryManager.recordPattern(
                inputPattern,
                outputPattern,
                category,
                confidence
            );
            
            return { success: true, patternId };
        } catch (error) {
            return { success: false };
        }
    }

    private async getNeoTypeMap(): Promise<Record<string, string>> {
        // Try to get from memory first
        const typeMapping = await this.memoryManager.getTypeMapping('*', 'Neo');
        if (typeMapping) {
            return typeMapping;
        }

        // Built-in Neo-rs type mappings
        return {
            'UInt160': 'U160',
            'UInt256': 'U256',
            'ECPoint': 'PublicKey',
            'BigInteger': 'num_bigint::BigInt',
            'StackItem': 'StackItem',
            'InteropService': 'InteropService',
            'Script': 'Script',
            'Witness': 'Witness',
            'Transaction': 'Transaction',
            'Block': 'Block',
            'Header': 'Header',
            'Merkle': 'MerkleTree',
            'SmartContract': 'Contract',
            'ApplicationEngine': 'ApplicationEngine',
            'ExecutionEngine': 'ExecutionEngine',
            'StorageContext': 'StorageContext',
            'StorageItem': 'StorageItem',
            'ContractState': 'ContractState',
            'ManifestPermission': 'Permission',
            'ContractManifest': 'Manifest',
            'byte[]': 'Vec<u8>',
            'string': 'String',
            'bool': 'bool',
            'int': 'i32',
            'uint': 'u32',
            'long': 'i64',
            'ulong': 'u64'
        };
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getStatus(): {
        id: string;
        type: string;
        status: string;
        capabilities: string[];
        stats: {
            taskCount: number;
            errorCount: number;
            successRate: number;
            lastActivity: Date;
        };
    } {
        return {
            id: this.id,
            type: this.type,
            status: this.status,
            capabilities: this.capabilities,
            stats: {
                taskCount: this.taskCount,
                errorCount: this.errorCount,
                successRate: this.taskCount > 0 ? (this.taskCount - this.errorCount) / this.taskCount : 0,
                lastActivity: this.lastActivity
            }
        };
    }
}