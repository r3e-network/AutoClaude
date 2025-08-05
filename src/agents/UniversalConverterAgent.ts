/**
 * Universal Converter Agent - Multi-Language Code Conversion
 * 
 * This agent handles intelligent code conversion between any supported language pair
 * with pattern learning and language-specific optimizations.
 */

import { Agent, Task, AgentResult } from './index';
import { getMemoryManager } from '../memory';
import { getEnhancedConfig } from '../config/enhanced-config';

export class UniversalConverterAgent implements Agent {
    public readonly id: string;
    public readonly type: string = 'universal-converter';
    public status: 'idle' | 'busy' | 'error' = 'idle';
    public readonly capabilities: string[] = [
        'multi-language-conversion',
        'pattern-learning',
        'type-mapping',
        'syntax-conversion',
        'intelligent-detection'
    ];
    public lastActivity: Date = new Date();
    public taskCount: number = 0;
    public errorCount: number = 0;

    private memoryManager: any;
    private config: any;
    private supportedPairs: Array<{ from: string; to: string; name: string; typeMappings?: Record<string, string> }> = [];

    constructor(id: string, private workspacePath?: string) {
        this.id = id;
        if (workspacePath) {
            this.memoryManager = getMemoryManager(workspacePath);
            this.config = getEnhancedConfig(workspacePath);
        }
    }

    async initialize(): Promise<void> {
        if (this.config) {
            await this.config.initialize();
            const enhancedConfig = this.config.getConfig();
            this.supportedPairs = enhancedConfig.languageConversion.supportedPairs;
        }
    }

    async processTask(task: Task): Promise<AgentResult> {
        this.status = 'busy';
        this.lastActivity = new Date();
        
        try {
            const startTime = Date.now();
            let result: any;

            // Auto-detect language pair if not specified
            if (task.type === 'convert-file' || task.type === 'convert-snippet') {
                const detectedPair = await this.detectLanguagePair(task.input);
                if (detectedPair) {
                    task.input.sourceLanguage = detectedPair.from;
                    task.input.targetLanguage = detectedPair.to;
                }
            }

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
                case 'suggest-conversion':
                    result = await this.suggestConversion(task.input);
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

    private async convertFile(input: { 
        filePath: string; 
        content: string;
        sourceLanguage?: string;
        targetLanguage?: string;
    }): Promise<{
        convertedContent: string;
        confidence: number;
        patternsUsed: string[];
        languagePair: { from: string; to: string };
    }> {
        const { filePath, content, sourceLanguage, targetLanguage } = input;
        
        // Detect languages if not provided
        const detectedPair = await this.detectLanguagePair({ content, filePath, sourceLanguage, targetLanguage });
        if (!detectedPair) {
            throw new Error('Could not detect source and target languages');
        }

        // Get language-specific converter
        const converter = await this.getLanguageConverter(detectedPair.from, detectedPair.to);
        
        // Check for learned patterns
        const patterns = await this.memoryManager.getPatterns(`${detectedPair.from}_to_${detectedPair.to}`, 0.7);
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

        // Apply converter transformations
        const conversionResult = await converter.convert(convertedContent);
        convertedContent = conversionResult.content;
        patternsUsed.push(...conversionResult.patternsUsed);
        confidence = Math.max(confidence, conversionResult.confidence);

        // Record successful conversion for learning
        if (patternsUsed.length > 0) {
            await this.memoryManager.recordPattern(
                content,
                convertedContent,
                `${detectedPair.from}_to_${detectedPair.to}_conversion`,
                confidence
            );
        }

        return {
            convertedContent,
            confidence,
            patternsUsed,
            languagePair: detectedPair
        };
    }

    private async convertSnippet(input: { 
        snippet: string; 
        context?: string;
        sourceLanguage?: string;
        targetLanguage?: string;
    }): Promise<{
        convertedSnippet: string;
        confidence: number;
        explanation: string;
        languagePair: { from: string; to: string };
    }> {
        const { snippet, context, sourceLanguage, targetLanguage } = input;
        
        // Detect languages if not provided
        const detectedPair = await this.detectLanguagePair({ 
            content: snippet, 
            context, 
            sourceLanguage, 
            targetLanguage 
        });
        
        if (!detectedPair) {
            throw new Error('Could not detect source and target languages');
        }

        // Get language-specific converter
        const converter = await this.getLanguageConverter(detectedPair.from, detectedPair.to);
        
        // Convert snippet
        const result = await converter.convertSnippet(snippet, context);
        
        return {
            convertedSnippet: result.converted,
            confidence: result.confidence,
            explanation: result.explanation,
            languagePair: detectedPair
        };
    }

    private async learnPattern(input: { 
        inputPattern: string; 
        outputPattern: string; 
        category: string; 
        confidence: number;
        languagePair?: { from: string; to: string };
    }): Promise<{ success: boolean; patternId?: string }> {
        const { inputPattern, outputPattern, category, confidence, languagePair } = input;
        
        try {
            // Add language pair to category if provided
            let patternCategory = category;
            if (languagePair) {
                patternCategory = `${languagePair.from}_to_${languagePair.to}_${category}`;
            }
            
            const patternId = await this.memoryManager.recordPattern(
                inputPattern,
                outputPattern,
                patternCategory,
                confidence
            );
            
            return { success: true, patternId };
        } catch (error) {
            return { success: false };
        }
    }

    private async suggestConversion(input: { 
        content: string;
        filePath?: string;
    }): Promise<{
        detectedLanguage: string | null;
        availableConversions: Array<{ to: string; name: string; confidence: number }>;
        recommendation: string;
    }> {
        const { content, filePath } = input;
        
        // Detect source language
        const detectedLanguage = await this.detectLanguage(content, filePath);
        
        if (!detectedLanguage) {
            return {
                detectedLanguage: null,
                availableConversions: [],
                recommendation: 'Could not detect the source language. Please specify manually.'
            };
        }

        // Find available conversions
        const availableConversions = this.supportedPairs
            .filter(pair => pair.from === detectedLanguage)
            .map(pair => ({
                to: pair.to,
                name: pair.name,
                confidence: this.getConversionConfidence(detectedLanguage, pair.to)
            }));

        // Generate recommendation
        let recommendation = `Detected ${detectedLanguage} code. `;
        if (availableConversions.length > 0) {
            const best = availableConversions.sort((a, b) => b.confidence - a.confidence)[0];
            recommendation += `Recommended conversion: ${best.name} (${best.confidence}% confidence)`;
        } else {
            recommendation += 'No conversions available for this language.';
        }

        return {
            detectedLanguage,
            availableConversions,
            recommendation
        };
    }

    private async detectLanguagePair(input: {
        content?: string;
        filePath?: string;
        context?: string;
        sourceLanguage?: string;
        targetLanguage?: string;
    }): Promise<{ from: string; to: string } | null> {
        // If both languages are specified, return them
        if (input.sourceLanguage && input.targetLanguage) {
            return { from: input.sourceLanguage, to: input.targetLanguage };
        }

        // Try to detect from content
        const detectedSource = input.sourceLanguage || await this.detectLanguage(input.content || '', input.filePath);
        
        if (!detectedSource) {
            return null;
        }

        // If target language is specified, use it
        if (input.targetLanguage) {
            return { from: detectedSource, to: input.targetLanguage };
        }

        // Try to infer target language from context or configuration
        const inferredTarget = await this.inferTargetLanguage(detectedSource, input.context);
        
        if (inferredTarget) {
            return { from: detectedSource, to: inferredTarget };
        }

        return null;
    }

    private async detectLanguage(code: string, filePath?: string): Promise<string | null> {
        // Check file extension first
        if (filePath) {
            const ext = filePath.split('.').pop()?.toLowerCase();
            const extMap: Record<string, string> = {
                'cs': 'csharp',
                'rs': 'rust',
                'js': 'javascript',
                'jsx': 'javascript',
                'ts': 'typescript',
                'tsx': 'typescript',
                'py': 'python',
                'java': 'java',
                'kt': 'kotlin',
                'go': 'go',
                'cpp': 'cpp',
                'cc': 'cpp',
                'swift': 'swift'
            };
            
            if (ext && extMap[ext]) {
                return extMap[ext];
            }
        }

        // Language detection patterns
        const languagePatterns: Record<string, string[]> = {
            csharp: ['namespace ', 'using System', 'public class', 'static void', 'public interface'],
            rust: ['fn main()', 'let mut', 'impl ', 'pub struct', 'use std::', 'match ', '->'],
            javascript: ['function ', 'const ', 'console.log', '=>', 'require(', 'export '],
            typescript: ['interface ', 'type ', ': string', ': number', 'export class', 'implements '],
            python: ['def ', 'import ', '__init__', 'self.', 'class ', 'from ', '    '],
            java: ['public class', 'import java', 'public static void main', 'private ', 'extends '],
            kotlin: ['fun ', 'val ', 'var ', 'class ', 'object ', 'companion object'],
            go: ['package ', 'func ', 'type ', 'struct {', 'interface {', 'chan '],
            cpp: ['#include', 'std::', 'template<', 'namespace ', 'class ', 'public:', 'private:'],
            swift: ['import ', 'func ', 'var ', 'let ', 'class ', 'struct ', 'protocol ']
        };

        for (const [lang, patterns] of Object.entries(languagePatterns)) {
            const matches = patterns.filter(p => code.includes(p)).length;
            if (matches >= 2) {
                return lang;
            }
        }

        return null;
    }

    private async inferTargetLanguage(sourceLanguage: string, context?: string): Promise<string | null> {
        // Check workspace configuration
        if (this.config) {
            const enhancedConfig = this.config.getConfig();
            
            // Check if neo-rs is enabled and source is C#
            if (enhancedConfig.neoRs.enabled && sourceLanguage === 'csharp') {
                return 'rust';
            }
        }

        // Common conversion patterns
        const commonConversions: Record<string, string> = {
            'javascript': 'typescript',
            'java': 'kotlin',
            'csharp': 'rust', // Default for C# if no other context
            'python': 'rust'  // Popular for performance optimization
        };

        return commonConversions[sourceLanguage] || null;
    }

    private async getLanguageConverter(from: string, to: string): Promise<{
        convert: (content: string) => Promise<{ content: string; confidence: number; patternsUsed: string[] }>;
        convertSnippet: (snippet: string, context?: string) => Promise<{ converted: string; confidence: number; explanation: string }>;
    }> {
        // Find the conversion pair configuration
        const conversionPair = this.supportedPairs.find(
            pair => pair.from === from && pair.to === to
        );

        if (!conversionPair) {
            throw new Error(`Unsupported conversion: ${from} to ${to}`);
        }

        // Return converter implementation based on language pair
        if (from === 'csharp' && to === 'rust') {
            return this.getCSharpToRustConverter(conversionPair);
        } else if (from === 'javascript' && to === 'typescript') {
            return this.getJavaScriptToTypeScriptConverter(conversionPair);
        } else if (from === 'python' && to === 'rust') {
            return this.getPythonToRustConverter(conversionPair);
        } else if (from === 'java' && to === 'kotlin') {
            return this.getJavaToKotlinConverter(conversionPair);
        }

        // Default generic converter
        return this.getGenericConverter(conversionPair);
    }

    private getCSharpToRustConverter(conversionPair: any) {
        return {
            convert: async (content: string) => {
                let converted = content;
                const patternsUsed: string[] = [];
                let confidence = 0.7;

                // Apply type mappings
                if (conversionPair.typeMappings) {
                    for (const [csType, rustType] of Object.entries(conversionPair.typeMappings)) {
                        const regex = new RegExp(`\\b${this.escapeRegex(csType)}\\b`, 'g');
                        if (regex.test(converted)) {
                            converted = converted.replace(regex, rustType as string);
                            patternsUsed.push(`${csType} -> ${rustType}`);
                        }
                    }
                }

                // C# to Rust specific conversions
                converted = converted
                    .replace(/public\s+class\s+(\w+)/g, 'pub struct $1')
                    .replace(/public\s+interface\s+(\w+)/g, 'pub trait $1')
                    .replace(/public\s+(\w+)\s+(\w+)\s*\{[\s\S]*?get;[\s\S]*?set;[\s\S]*?\}/g, 'pub $2: $1,')
                    .replace(/public\s+static\s+(\w+)\s+(\w+)/g, 'pub static $2: $1')
                    .replace(/namespace\s+([\w.]+)/g, 'mod $1')
                    .replace(/using\s+([\w.]+);/g, 'use $1;')
                    .replace(/new\s+(\w+)\(\)/g, '$1::new()')
                    .replace(/throw\s+new\s+(\w+)\((.*?)\);/g, 'return Err($1::new($2));');

                return { content: converted, confidence, patternsUsed };
            },
            convertSnippet: async (snippet: string, context?: string) => {
                const result = await this.getCSharpToRustConverter(conversionPair).convert(snippet);
                return {
                    converted: result.content,
                    confidence: result.confidence,
                    explanation: `Converted C# to Rust: ${result.patternsUsed.join(', ')}`
                };
            }
        };
    }

    private getJavaScriptToTypeScriptConverter(conversionPair: any) {
        return {
            convert: async (content: string) => {
                let converted = content;
                const patternsUsed: string[] = [];
                let confidence = 0.9; // High confidence for JS to TS

                // Add type annotations
                converted = converted
                    .replace(/function\s+(\w+)\s*\((.*?)\)/g, 'function $1($2): any')
                    .replace(/const\s+(\w+)\s*=/g, 'const $1: any =')
                    .replace(/let\s+(\w+)\s*=/g, 'let $1: any =')
                    .replace(/var\s+(\w+)\s*=/g, 'let $1: any =');

                patternsUsed.push('Added type annotations');

                return { content: converted, confidence, patternsUsed };
            },
            convertSnippet: async (snippet: string, context?: string) => {
                const result = await this.getJavaScriptToTypeScriptConverter(conversionPair).convert(snippet);
                return {
                    converted: result.content,
                    confidence: result.confidence,
                    explanation: 'Added TypeScript type annotations'
                };
            }
        };
    }

    private getPythonToRustConverter(conversionPair: any) {
        return {
            convert: async (content: string) => {
                let converted = content;
                const patternsUsed: string[] = [];
                let confidence = 0.6;

                // Python to Rust conversions
                converted = converted
                    .replace(/def\s+(\w+)\s*\((.*?)\):/g, 'fn $1($2) {')
                    .replace(/class\s+(\w+):/g, 'struct $1 {')
                    .replace(/self\./g, 'self.')
                    .replace(/import\s+(\w+)/g, 'use $1;')
                    .replace(/from\s+(\w+)\s+import\s+(\w+)/g, 'use $1::$2;')
                    .replace(/None/g, 'None')
                    .replace(/True/g, 'true')
                    .replace(/False/g, 'false');

                patternsUsed.push('Basic Python to Rust syntax conversion');

                return { content: converted, confidence, patternsUsed };
            },
            convertSnippet: async (snippet: string, context?: string) => {
                const result = await this.getPythonToRustConverter(conversionPair).convert(snippet);
                return {
                    converted: result.content,
                    confidence: result.confidence,
                    explanation: 'Converted Python syntax to Rust'
                };
            }
        };
    }

    private getJavaToKotlinConverter(conversionPair: any) {
        return {
            convert: async (content: string) => {
                let converted = content;
                const patternsUsed: string[] = [];
                let confidence = 0.8;

                // Java to Kotlin conversions
                converted = converted
                    .replace(/public\s+class\s+(\w+)/g, 'class $1')
                    .replace(/private\s+(\w+)\s+(\w+);/g, 'private var $2: $1')
                    .replace(/public\s+void\s+(\w+)/g, 'fun $1')
                    .replace(/public\s+(\w+)\s+(\w+)/g, 'fun $2: $1')
                    .replace(/System\.out\.println/g, 'println')
                    .replace(/new\s+(\w+)/g, '$1');

                patternsUsed.push('Java to Kotlin syntax conversion');

                return { content: converted, confidence, patternsUsed };
            },
            convertSnippet: async (snippet: string, context?: string) => {
                const result = await this.getJavaToKotlinConverter(conversionPair).convert(snippet);
                return {
                    converted: result.content,
                    confidence: result.confidence,
                    explanation: 'Converted Java to Kotlin syntax'
                };
            }
        };
    }

    private getGenericConverter(conversionPair: any) {
        return {
            convert: async (content: string) => {
                let converted = content;
                const patternsUsed: string[] = [];
                let confidence = 0.5;

                // Apply type mappings if available
                if (conversionPair.typeMappings) {
                    for (const [sourceType, targetType] of Object.entries(conversionPair.typeMappings)) {
                        const regex = new RegExp(`\\b${this.escapeRegex(sourceType)}\\b`, 'g');
                        if (regex.test(converted)) {
                            converted = converted.replace(regex, targetType as string);
                            patternsUsed.push(`${sourceType} -> ${targetType}`);
                        }
                    }
                }

                return { content: converted, confidence, patternsUsed };
            },
            convertSnippet: async (snippet: string, context?: string) => {
                const result = await this.getGenericConverter(conversionPair).convert(snippet);
                return {
                    converted: result.content,
                    confidence: result.confidence,
                    explanation: 'Applied available type mappings'
                };
            }
        };
    }

    private getConversionConfidence(from: string, to: string): number {
        // Confidence scores based on conversion complexity
        const confidenceMap: Record<string, number> = {
            'javascript_typescript': 95,
            'java_kotlin': 85,
            'csharp_rust': 75,
            'python_rust': 65
        };

        const key = `${from}_${to}`;
        return confidenceMap[key] || 50;
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
        supportedConversions: Array<{ from: string; to: string; name: string }>;
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
            },
            supportedConversions: this.supportedPairs.map(pair => ({
                from: pair.from,
                to: pair.to,
                name: pair.name
            }))
        };
    }
}