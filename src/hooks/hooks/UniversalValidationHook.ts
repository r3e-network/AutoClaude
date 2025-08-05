/**
 * Universal Validation Hook - Ensures compatibility for any language conversion
 * 
 * This hook validates that code conversions maintain 100% compatibility
 * between source and target languages, supporting multiple language pairs.
 */

import * as path from 'path';
import { Hook, HookContext, HookResult, HOOK_PRIORITIES } from '../index';
import { getMemoryManager } from '../../memory';
import { getEnhancedConfig } from '../../config/enhanced-config';

export class UniversalValidationHook implements Hook {
    public readonly id: string = 'universal-validation';
    public readonly name: string = 'Universal Validation Hook';
    public readonly description: string = 'Validates language conversion compatibility';
    public readonly priority: number = HOOK_PRIORITIES.CRITICAL;
    public enabled: boolean = true;
    public readonly blocking: boolean = true;
    public readonly timeout: number = 60000; // 60 seconds

    private memoryManager: any;
    private config: any;

    constructor() {
        // Initialize when needed
    }

    private async getMemoryManager(workspacePath?: string): Promise<any> {
        if (!this.memoryManager && workspacePath) {
            this.memoryManager = getMemoryManager(workspacePath);
        }
        return this.memoryManager;
    }

    private async getConfig(workspacePath?: string): Promise<any> {
        if (!this.config && workspacePath) {
            this.config = getEnhancedConfig(workspacePath);
            await this.config.initialize();
        }
        return this.config;
    }

    async execute(context: HookContext): Promise<HookResult> {
        const startTime = Date.now();
        
        try {
            const { input, operation } = context;
            
            if (!input || typeof input !== 'object') {
                return {
                    success: true,
                    modified: false,
                    duration: Date.now() - startTime
                };
            }

            const config = await this.getConfig(context.workspacePath);
            const enhancedConfig = config?.getConfig();
            
            if (!enhancedConfig?.languageConversion?.enabled) {
                return {
                    success: true,
                    modified: false,
                    duration: Date.now() - startTime
                };
            }

            let validationResult: any = null;

            switch (operation) {
                case 'post-conversion':
                    validationResult = await this.validateConversion(input, enhancedConfig);
                    break;
                case 'pre-validation':
                    validationResult = await this.validateBeforeProcessing(input, enhancedConfig);
                    break;
                case 'post-validation':
                    validationResult = await this.validateFinalResult(input, enhancedConfig);
                    break;
                default:
                    return {
                        success: true,
                        modified: false,
                        duration: Date.now() - startTime
                    };
            }

            const duration = Date.now() - startTime;

            if (validationResult && !validationResult.isValid) {
                return {
                    success: false,
                    modified: false,
                    error: `Validation failed: ${validationResult.errors.join(', ')}`,
                    metadata: { validationResult },
                    duration
                };
            }

            return {
                success: true,
                modified: false,
                output: validationResult,
                metadata: { validationResult },
                duration
            };

        } catch (error) {
            return {
                success: false,
                modified: false,
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - startTime
            };
        }
    }

    private async validateConversion(input: any, config: any): Promise<{
        isValid: boolean;
        compatibilityScore: number;
        errors: string[];
        warnings: string[];
        validationDetails: any;
    }> {
        const { originalCode, convertedCode, metadata } = input;
        
        if (!originalCode || !convertedCode) {
            return {
                isValid: false,
                compatibilityScore: 0,
                errors: ['Missing original or converted code'],
                warnings: [],
                validationDetails: {}
            };
        }

        const errors: string[] = [];
        const warnings: string[] = [];
        let compatibilityScore = 100;

        // Detect language pair
        const languagePair = await this.detectLanguagePair(originalCode, convertedCode, metadata);
        
        if (!languagePair) {
            warnings.push('Could not detect specific language pair, using generic validation');
        }

        // Apply language-specific validation
        const validationResult = await this.validateLanguagePair(
            originalCode, 
            convertedCode, 
            languagePair,
            config
        );

        errors.push(...validationResult.errors);
        warnings.push(...validationResult.warnings);
        compatibilityScore = validationResult.compatibilityScore;

        const finalScore = Math.max(0, compatibilityScore);
        const isValid = finalScore >= 80 && errors.length === 0;

        // Record validation results for learning
        const memoryManager = await this.getMemoryManager(config.workspacePath);
        if (memoryManager) {
            await memoryManager.recordValidation(
                originalCode,
                convertedCode,
                `${languagePair?.from}_to_${languagePair?.to}_compatibility`,
                finalScore / 100,
                isValid
            );
        }

        return {
            isValid,
            compatibilityScore: finalScore,
            errors,
            warnings,
            validationDetails: {
                languagePair,
                ...validationResult
            }
        };
    }

    private async detectLanguagePair(
        originalCode: string, 
        convertedCode: string, 
        metadata?: any
    ): Promise<{ from: string; to: string; name: string } | null> {
        // Check metadata first
        if (metadata?.sourceLanguage && metadata?.targetLanguage) {
            return {
                from: metadata.sourceLanguage,
                to: metadata.targetLanguage,
                name: `${metadata.sourceLanguage} to ${metadata.targetLanguage}`
            };
        }

        // Language detection heuristics
        const languagePatterns = {
            csharp: {
                patterns: ['public class', 'namespace', 'using System', 'void Main'],
                extensions: ['.cs']
            },
            rust: {
                patterns: ['fn main()', 'pub struct', 'impl', 'use std::', 'let mut'],
                extensions: ['.rs']
            },
            javascript: {
                patterns: ['function', 'const', 'let', 'var', 'console.log', '=>'],
                extensions: ['.js', '.jsx']
            },
            typescript: {
                patterns: ['interface', 'type', ': string', ': number', 'export class'],
                extensions: ['.ts', '.tsx']
            },
            python: {
                patterns: ['def ', 'import ', 'from ', '__init__', 'self.', 'class '],
                extensions: ['.py']
            },
            java: {
                patterns: ['public class', 'import java', 'void main', 'static'],
                extensions: ['.java']
            }
        };

        let sourceLanguage = null;
        let targetLanguage = null;

        // Detect source language
        for (const [lang, info] of Object.entries(languagePatterns)) {
            const matchCount = info.patterns.filter(pattern => 
                originalCode.includes(pattern)
            ).length;
            
            if (matchCount >= 2) {
                sourceLanguage = lang;
                break;
            }
        }

        // Detect target language
        for (const [lang, info] of Object.entries(languagePatterns)) {
            const matchCount = info.patterns.filter(pattern => 
                convertedCode.includes(pattern)
            ).length;
            
            if (matchCount >= 2) {
                targetLanguage = lang;
                break;
            }
        }

        if (sourceLanguage && targetLanguage) {
            return {
                from: sourceLanguage,
                to: targetLanguage,
                name: `${sourceLanguage} to ${targetLanguage}`
            };
        }

        return null;
    }

    private async validateLanguagePair(
        originalCode: string,
        convertedCode: string,
        languagePair: { from: string; to: string } | null,
        config: any
    ): Promise<{
        compatibilityScore: number;
        errors: string[];
        warnings: string[];
        typeValidation?: any;
        structureValidation?: any;
    }> {
        let compatibilityScore = 100;
        const errors: string[] = [];
        const warnings: string[] = [];
        const results: any = {};

        if (!languagePair) {
            // Generic validation
            results.structureValidation = await this.validateStructure(originalCode, convertedCode);
            compatibilityScore = results.structureValidation.score;
            errors.push(...results.structureValidation.errors);
            warnings.push(...results.structureValidation.warnings);
        } else {
            // Find specific validation configuration
            const conversionPair = config.languageConversion.supportedPairs.find(
                (pair: any) => pair.from === languagePair.from && pair.to === languagePair.to
            );

            if (conversionPair) {
                // Type validation
                if (conversionPair.typeMappings) {
                    results.typeValidation = await this.validateTypeMappings(
                        originalCode,
                        convertedCode,
                        conversionPair.typeMappings
                    );
                    if (!results.typeValidation.isValid) {
                        compatibilityScore -= 30;
                        errors.push(...results.typeValidation.errors);
                    }
                    warnings.push(...results.typeValidation.warnings);
                }

                // Special validation for specific pairs
                if (conversionPair.specialValidation) {
                    results.specialValidation = await this.performSpecialValidation(
                        originalCode,
                        convertedCode,
                        languagePair
                    );
                    if (!results.specialValidation.isValid) {
                        compatibilityScore -= 25;
                        errors.push(...results.specialValidation.errors);
                    }
                    warnings.push(...results.specialValidation.warnings);
                }
            }

            // Structure validation
            results.structureValidation = await this.validateStructure(originalCode, convertedCode);
            if (!results.structureValidation.isValid) {
                compatibilityScore -= 20;
                errors.push(...results.structureValidation.errors);
            }
            warnings.push(...results.structureValidation.warnings);
        }

        return {
            compatibilityScore: Math.max(0, compatibilityScore),
            errors,
            warnings,
            ...results
        };
    }

    private async validateTypeMappings(
        originalCode: string,
        convertedCode: string,
        typeMappings: Record<string, string>
    ): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        for (const [sourceType, targetType] of Object.entries(typeMappings)) {
            if (originalCode.includes(sourceType)) {
                if (!convertedCode.includes(targetType)) {
                    errors.push(`Type '${sourceType}' should be converted to '${targetType}'`);
                } else {
                    // Check usage count
                    const sourceCount = (originalCode.match(new RegExp(sourceType, 'g')) || []).length;
                    const targetCount = (convertedCode.match(new RegExp(targetType, 'g')) || []).length;
                    
                    if (Math.abs(sourceCount - targetCount) > 2) {
                        warnings.push(`Usage count mismatch for ${sourceType} -> ${targetType}: ${sourceCount} vs ${targetCount}`);
                    }
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    private async validateStructure(
        originalCode: string,
        convertedCode: string
    ): Promise<{
        isValid: boolean;
        score: number;
        errors: string[];
        warnings: string[];
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];
        let score = 100;

        // Count structural elements
        const originalLines = originalCode.split('\n').length;
        const convertedLines = convertedCode.split('\n').length;

        // Allow for reasonable variation in line count
        const lineRatio = Math.min(originalLines, convertedLines) / Math.max(originalLines, convertedLines);
        if (lineRatio < 0.5) {
            warnings.push(`Significant line count difference: ${originalLines} vs ${convertedLines}`);
            score -= 10;
        }

        // Check for preserved structure markers
        const structureMarkers = ['class', 'function', 'method', 'interface', 'struct'];
        for (const marker of structureMarkers) {
            const originalCount = (originalCode.match(new RegExp(marker, 'gi')) || []).length;
            const convertedCount = (convertedCode.match(new RegExp(marker, 'gi')) || []).length;
            
            if (originalCount > 0 && convertedCount === 0) {
                warnings.push(`Structure element '${marker}' appears to be missing in conversion`);
                score -= 5;
            }
        }

        return {
            isValid: score >= 70,
            score: Math.max(0, score),
            errors,
            warnings
        };
    }

    private async performSpecialValidation(
        originalCode: string,
        convertedCode: string,
        languagePair: { from: string; to: string }
    ): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        // C# to Rust specific validations (Neo-rs compatibility)
        if (languagePair.from === 'csharp' && languagePair.to === 'rust') {
            // Check for Neo-specific patterns
            if (originalCode.includes('ApplicationEngine') && !convertedCode.includes('ApplicationEngine')) {
                errors.push('ApplicationEngine integration not found in Rust conversion');
            }

            if (originalCode.includes('Storage.Get') || originalCode.includes('Storage.Put')) {
                if (!convertedCode.includes('storage') && !convertedCode.includes('Storage')) {
                    errors.push('Storage operations not properly converted');
                }
            }

            // Check for proper error handling conversion
            if (originalCode.includes('throw new') && !convertedCode.includes('Result<')) {
                warnings.push('Exception handling should use Result<T, E> pattern in Rust');
            }
        }

        // Add more language-specific validations as needed

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    private async validateBeforeProcessing(input: any, config: any): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
        languageDetected?: string;
    }> {
        const { filePath, content } = input;
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!content) {
            return {
                isValid: false,
                errors: ['No content provided'],
                warnings: [],
            };
        }

        // Detect source language
        const language = await this.detectLanguage(content, filePath);
        
        if (language) {
            // Check if we have conversion support for this language
            const supportedConversions = config.languageConversion.supportedPairs.filter(
                (pair: any) => pair.from === language
            );
            
            if (supportedConversions.length > 0) {
                const targets = supportedConversions.map((p: any) => p.to).join(', ');
                warnings.push(`${language} detected - conversions available to: ${targets}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            ...(language && { languageDetected: language })
        };
    }

    private async validateFinalResult(input: any, config: any): Promise<{
        isValid: boolean;
        overallCompatibility: number;
        finalChecks: any[];
        readyForProduction: boolean;
    }> {
        const { originalCode, convertedCode, validationResults } = input;
        
        const finalChecks: any[] = [];
        let overallCompatibility = 100;

        // Comprehensive final validation
        const structuralCheck = await this.validateStructuralIntegrity(originalCode, convertedCode);
        finalChecks.push({ type: 'structural', result: structuralCheck });
        if (!structuralCheck.isValid) overallCompatibility -= 20;

        const functionalCheck = await this.validateFunctionalEquivalence(originalCode, convertedCode);
        finalChecks.push({ type: 'functional', result: functionalCheck });
        if (!functionalCheck.isValid) overallCompatibility -= 25;

        overallCompatibility = Math.max(0, overallCompatibility);
        const isValid = overallCompatibility >= 85;
        const readyForProduction = overallCompatibility >= 95;

        return {
            isValid,
            overallCompatibility,
            finalChecks,
            readyForProduction
        };
    }

    private async detectLanguage(code: string, filePath?: string): Promise<string | null> {
        // Check file extension first
        if (filePath) {
            const ext = path.extname(filePath).toLowerCase();
            const extMap: Record<string, string> = {
                '.cs': 'csharp',
                '.rs': 'rust',
                '.js': 'javascript',
                '.jsx': 'javascript',
                '.ts': 'typescript',
                '.tsx': 'typescript',
                '.py': 'python',
                '.java': 'java',
                '.kt': 'kotlin',
                '.go': 'go',
                '.cpp': 'cpp',
                '.cc': 'cpp',
                '.swift': 'swift'
            };
            
            if (extMap[ext]) {
                return extMap[ext];
            }
        }

        // Fall back to content analysis
        const languagePatterns: Record<string, string[]> = {
            csharp: ['namespace ', 'using System', 'public class', 'static void'],
            rust: ['fn main()', 'let mut', 'impl ', 'pub struct'],
            javascript: ['function ', 'const ', 'console.log', '=>'],
            python: ['def ', 'import ', '__init__', 'self.'],
            java: ['public class', 'import java', 'public static void main']
        };

        for (const [lang, patterns] of Object.entries(languagePatterns)) {
            const matches = patterns.filter(p => code.includes(p)).length;
            if (matches >= 2) {
                return lang;
            }
        }

        return null;
    }

    private async validateStructuralIntegrity(originalCode: string, convertedCode: string): Promise<{
        isValid: boolean;
        structureScore: number;
        issues: string[];
    }> {
        const issues: string[] = [];
        let structureScore = 100;

        // Count major structural elements
        const structureElements = [
            { pattern: /class\s+\w+/g, name: 'classes' },
            { pattern: /function\s+\w+|fn\s+\w+|def\s+\w+/g, name: 'functions' },
            { pattern: /interface\s+\w+|trait\s+\w+/g, name: 'interfaces/traits' },
            { pattern: /struct\s+\w+/g, name: 'structs' }
        ];

        for (const element of structureElements) {
            const originalCount = (originalCode.match(element.pattern) || []).length;
            const convertedCount = (convertedCode.match(element.pattern) || []).length;
            
            if (originalCount > 0 && Math.abs(originalCount - convertedCount) > 2) {
                issues.push(`${element.name} count mismatch: ${originalCount} vs ${convertedCount}`);
                structureScore -= 15;
            }
        }

        return {
            isValid: structureScore >= 70,
            structureScore: Math.max(0, structureScore),
            issues
        };
    }

    private async validateFunctionalEquivalence(originalCode: string, convertedCode: string): Promise<{
        isValid: boolean;
        functionalScore: number;
        equivalenceIssues: string[];
    }> {
        const equivalenceIssues: string[] = [];
        let functionalScore = 100;

        // Check for critical functional keywords
        const criticalKeywords = ['return', 'throw', 'try', 'catch', 'if', 'else', 'for', 'while'];
        
        for (const keyword of criticalKeywords) {
            const originalCount = (originalCode.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
            const convertedCount = (convertedCode.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
            
            if (Math.abs(originalCount - convertedCount) > 3) {
                equivalenceIssues.push(`Significant difference in ${keyword} usage: ${originalCount} vs ${convertedCount}`);
                functionalScore -= 10;
            }
        }

        return {
            isValid: functionalScore >= 80,
            functionalScore: Math.max(0, functionalScore),
            equivalenceIssues
        };
    }
}