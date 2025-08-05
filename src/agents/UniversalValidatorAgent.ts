/**
 * Universal Validator Agent - Multi-Language Code Validation
 * 
 * This agent handles code validation, syntax checking, and compatibility verification
 * for any supported language pair with extensible validation rules.
 */

import { Agent, Task, AgentResult } from './index';
import { getMemoryManager } from '../memory';
import { getEnhancedConfig } from '../config/enhanced-config';

export class UniversalValidatorAgent implements Agent {
    public readonly id: string;
    public readonly type: string = 'universal-validator';
    public status: 'idle' | 'busy' | 'error' = 'idle';
    public readonly capabilities: string[] = [
        'multi-language-validation',
        'syntax-validation',
        'compatibility-checking',
        'code-analysis',
        'error-detection',
        'performance-analysis',
        'security-scanning'
    ];
    public lastActivity: Date = new Date();
    public taskCount: number = 0;
    public errorCount: number = 0;

    private memoryManager: any;
    private config: any;
    private supportedLanguages: string[] = [];
    private validationRules: Map<string, any> = new Map();

    constructor(id: string, private workspacePath?: string) {
        this.id = id;
        if (workspacePath) {
            this.memoryManager = getMemoryManager(workspacePath);
            this.config = getEnhancedConfig(workspacePath);
        }
        this.initializeValidationRules();
    }

    async initialize(): Promise<void> {
        if (this.config) {
            await this.config.initialize();
            const enhancedConfig = this.config.getConfig();
            
            // Extract supported languages from conversion pairs
            const languages = new Set<string>();
            enhancedConfig.languageConversion.supportedPairs.forEach((pair: { from: string; to: string; name: string; typeMappings?: Record<string, string>; specialValidation?: boolean }) => {
                languages.add(pair.from);
                languages.add(pair.to);
            });
            this.supportedLanguages = Array.from(languages);
        }
    }

    async processTask(task: Task): Promise<AgentResult> {
        this.status = 'busy';
        this.lastActivity = new Date();
        
        try {
            const startTime = Date.now();
            let result: any;

            switch (task.type) {
                case 'validate-syntax':
                    result = await this.validateSyntax(task.input);
                    break;
                case 'validate-compatibility':
                    result = await this.validateCompatibility(task.input);
                    break;
                case 'analyze-code':
                    result = await this.analyzeCode(task.input);
                    break;
                case 'detect-errors':
                    result = await this.detectErrors(task.input);
                    break;
                case 'validate-conversion':
                    result = await this.validateConversion(task.input);
                    break;
                case 'security-scan':
                    result = await this.performSecurityScan(task.input);
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

    private initializeValidationRules(): void {
        // C# validation rules
        this.validationRules.set('csharp', {
            syntaxPatterns: {
                classDeclaration: /public\s+class\s+\w+/,
                methodDeclaration: /public\s+\w+\s+\w+\s*\([^)]*\)/,
                propertyDeclaration: /public\s+\w+\s+\w+\s*{\s*get;\s*set;\s*}/,
                usingStatement: /using\s+[\w.]+;/,
                namespaceDeclaration: /namespace\s+[\w.]+/
            },
            commonErrors: [
                { pattern: /;\s*;/, message: 'Double semicolon detected' },
                { pattern: /\)\s*{/, message: 'Missing space before opening brace' }
            ],
            bestPractices: [
                { pattern: /catch\s*\(\s*Exception\s*\)/, message: 'Avoid catching generic Exception' },
                { pattern: /public\s+class\s+\w+\s*{\s*}/, message: 'Empty class detected' }
            ]
        });

        // Rust validation rules
        this.validationRules.set('rust', {
            syntaxPatterns: {
                functionDeclaration: /fn\s+\w+\s*\([^)]*\)/,
                structDeclaration: /struct\s+\w+/,
                implBlock: /impl\s+\w+/,
                useStatement: /use\s+[\w:]+;/,
                matchExpression: /match\s+\w+\s*{/
            },
            commonErrors: [
                { pattern: /;\s*}/, message: 'Unnecessary semicolon before closing brace' },
                { pattern: /\bmut\s+mut\b/, message: 'Double mut keyword' }
            ],
            bestPractices: [
                { pattern: /unwrap\(\)/, message: 'Consider using ? operator instead of unwrap()' },
                { pattern: /clone\(\)\.clone\(\)/, message: 'Redundant clone() calls' }
            ]
        });

        // JavaScript/TypeScript validation rules
        this.validationRules.set('javascript', {
            syntaxPatterns: {
                functionDeclaration: /function\s+\w+\s*\([^)]*\)/,
                arrowFunction: /\w+\s*=\s*\([^)]*\)\s*=>/,
                classDeclaration: /class\s+\w+/,
                importStatement: /import\s+.*\s+from\s+['"][^'"]+['"]/,
                exportStatement: /export\s+(default\s+)?/
            },
            commonErrors: [
                { pattern: /==(?!=)/, message: 'Use === instead of ==' },
                { pattern: /var\s+/, message: 'Use let or const instead of var' }
            ],
            bestPractices: [
                { pattern: /console\.log/, message: 'Remove console.log statements in production' },
                { pattern: /debugger;/, message: 'Remove debugger statements' }
            ]
        });

        this.validationRules.set('typescript', {
            ...this.validationRules.get('javascript'),
            syntaxPatterns: {
                ...this.validationRules.get('javascript').syntaxPatterns,
                interfaceDeclaration: /interface\s+\w+/,
                typeDeclaration: /type\s+\w+\s*=/,
                genericType: /<\w+>/
            },
            commonErrors: [
                ...this.validationRules.get('javascript').commonErrors,
                { pattern: /:\s*any/, message: 'Avoid using any type' }
            ]
        });

        // Python validation rules
        this.validationRules.set('python', {
            syntaxPatterns: {
                functionDeclaration: /def\s+\w+\s*\([^)]*\):/,
                classDeclaration: /class\s+\w+.*:/,
                importStatement: /import\s+\w+/,
                fromImport: /from\s+\w+\s+import\s+\w+/
            },
            commonErrors: [
                { pattern: /except:/, message: 'Avoid bare except clauses' },
                { pattern: /\t/, message: 'Use spaces instead of tabs' }
            ],
            bestPractices: [
                { pattern: /print\s*\(/, message: 'Consider using logging instead of print' },
                { pattern: /global\s+/, message: 'Avoid using global variables' }
            ]
        });

        // Java validation rules
        this.validationRules.set('java', {
            syntaxPatterns: {
                classDeclaration: /public\s+class\s+\w+/,
                methodDeclaration: /(public|private|protected)\s+\w+\s+\w+\s*\([^)]*\)/,
                importStatement: /import\s+[\w.]+;/,
                packageDeclaration: /package\s+[\w.]+;/
            },
            commonErrors: [
                { pattern: /;\s*;/, message: 'Double semicolon detected' },
                { pattern: /==\s*null/, message: 'Consider using Objects.isNull()' }
            ],
            bestPractices: [
                { pattern: /System\.out\.println/, message: 'Use logging framework instead of println' },
                { pattern: /catch\s*\(\s*Exception\s+\w+\s*\)/, message: 'Avoid catching generic Exception' }
            ]
        });

        // Kotlin validation rules
        this.validationRules.set('kotlin', {
            syntaxPatterns: {
                classDeclaration: /class\s+\w+/,
                functionDeclaration: /fun\s+\w+\s*\([^)]*\)/,
                valDeclaration: /val\s+\w+/,
                varDeclaration: /var\s+\w+/
            },
            commonErrors: [
                { pattern: /!!\s*\./, message: 'Avoid using !! operator' },
                { pattern: /as\s+\w+/, message: 'Consider using safe cast (as?) instead' }
            ],
            bestPractices: [
                { pattern: /println/, message: 'Consider using logging framework' },
                { pattern: /var\s+/, message: 'Prefer val over var when possible' }
            ]
        });
    }

    private async validateSyntax(input: { 
        code: string; 
        language: string;
        strict?: boolean;
    }): Promise<{
        isValid: boolean;
        errors: Array<{ line: number; column: number; message: string; severity: 'error' | 'warning' }>;
        suggestions: string[];
    }> {
        const { code, language, strict = false } = input;
        const errors: Array<{ line: number; column: number; message: string; severity: 'error' | 'warning' }> = [];
        const suggestions: string[] = [];

        // Get validation rules for the language
        const rules = this.validationRules.get(language);
        if (!rules) {
            return {
                isValid: false,
                errors: [{ line: 1, column: 1, message: `Unsupported language: ${language}`, severity: 'error' }],
                suggestions: [`Supported languages: ${this.supportedLanguages.join(', ')}`]
            };
        }

        const lines = code.split('\n');
        
        // Check for common errors
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            rules.commonErrors.forEach((errorRule: { pattern: RegExp; message: string }) => {
                if (errorRule.pattern.test(line)) {
                    errors.push({
                        line: lineNum,
                        column: line.search(errorRule.pattern) + 1,
                        message: errorRule.message,
                        severity: 'error'
                    });
                }
            });

            // Check best practices in strict mode
            if (strict) {
                rules.bestPractices.forEach((practiceRule: { pattern: RegExp; message: string }) => {
                    if (practiceRule.pattern.test(line)) {
                        errors.push({
                            line: lineNum,
                            column: line.search(practiceRule.pattern) + 1,
                            message: practiceRule.message,
                            severity: 'warning'
                        });
                    }
                });
            }
        });

        // Add language-specific suggestions
        if (!Object.values(rules.syntaxPatterns).some((pattern: unknown) => (pattern as RegExp).test(code))) {
            suggestions.push(`Code doesn't appear to contain typical ${language} patterns`);
        }

        return {
            isValid: errors.filter(e => e.severity === 'error').length === 0,
            errors,
            suggestions
        };
    }

    private async validateCompatibility(input: { 
        originalCode: string;
        originalLanguage: string;
        convertedCode: string;
        convertedLanguage: string;
    }): Promise<{
        isCompatible: boolean;
        compatibilityScore: number;
        issues: Array<{ type: string; description: string; severity: 'critical' | 'major' | 'minor' }>;
        recommendations: string[];
    }> {
        const { originalCode, originalLanguage, convertedCode, convertedLanguage } = input;
        const issues: Array<{ type: string; description: string; severity: 'critical' | 'major' | 'minor' }> = [];
        const recommendations: string[] = [];
        
        let compatibilityScore = 100;

        // Get language pair configuration
        const conversionPair = await this.getConversionPair(originalLanguage, convertedLanguage);
        
        if (!conversionPair) {
            issues.push({
                type: 'unsupported_conversion',
                description: `Conversion from ${originalLanguage} to ${convertedLanguage} is not configured`,
                severity: 'critical'
            });
            return {
                isCompatible: false,
                compatibilityScore: 0,
                issues,
                recommendations: ['Configure conversion rules for this language pair']
            };
        }

        // Structural validation
        const structuralValidation = await this.validateStructuralIntegrity(
            originalCode, 
            convertedCode, 
            originalLanguage, 
            convertedLanguage
        );
        
        if (!structuralValidation.isValid) {
            issues.push(...structuralValidation.issues);
            compatibilityScore -= structuralValidation.penaltyScore;
        }

        // Type mapping validation
        if (conversionPair.typeMappings) {
            const typeMappingValidation = await this.validateTypeMappings(
                originalCode,
                convertedCode,
                conversionPair.typeMappings
            );
            
            if (!typeMappingValidation.isValid) {
                issues.push(...typeMappingValidation.issues);
                compatibilityScore -= typeMappingValidation.penaltyScore;
            }
        }

        // Functional equivalence validation
        const functionalValidation = await this.validateFunctionalEquivalence(
            originalCode,
            convertedCode,
            originalLanguage,
            convertedLanguage
        );
        
        if (!functionalValidation.isValid) {
            issues.push(...functionalValidation.issues);
            compatibilityScore -= functionalValidation.penaltyScore;
        }

        // Generate recommendations
        if (issues.length > 0) {
            recommendations.push('Review and fix the identified compatibility issues');
            if (issues.some(i => i.severity === 'critical')) {
                recommendations.push('Critical issues must be resolved for proper functionality');
            }
        }

        // Record validation results for learning
        if (this.memoryManager) {
            await this.memoryManager.recordValidation(
                originalCode,
                convertedCode,
                `${originalLanguage}_to_${convertedLanguage}_compatibility`,
                compatibilityScore / 100,
                issues.length === 0
            );
        }

        return {
            isCompatible: compatibilityScore >= 80 && issues.filter(i => i.severity === 'critical').length === 0,
            compatibilityScore: Math.max(0, compatibilityScore),
            issues,
            recommendations
        };
    }

    private async analyzeCode(input: { 
        code: string; 
        language: string;
        analysisTypes?: Array<'complexity' | 'performance' | 'security' | 'maintainability'>;
    }): Promise<{
        complexity: number;
        maintainability: number;
        performance: number;
        security: number;
        recommendations: string[];
        metrics: Record<string, any>;
    }> {
        const { code, language, analysisTypes = ['complexity', 'maintainability', 'performance', 'security'] } = input;
        const lines = code.split('\n');
        
        let complexity = 1; // Base complexity
        let maintainability = 100;
        let performance = 100;
        let security = 100;
        const recommendations: string[] = [];
        const metrics: Record<string, any> = {};

        // Language-specific analysis
        const analyzer = this.getLanguageAnalyzer(language);
        
        if (analysisTypes.includes('complexity')) {
            const complexityResult = analyzer.analyzeComplexity(code, lines);
            complexity = complexityResult.score;
            metrics.complexity = complexityResult.details;
            recommendations.push(...complexityResult.recommendations);
        }

        if (analysisTypes.includes('maintainability')) {
            const maintainabilityResult = analyzer.analyzeMaintainability(code, lines);
            maintainability = maintainabilityResult.score;
            metrics.maintainability = maintainabilityResult.details;
            recommendations.push(...maintainabilityResult.recommendations);
        }

        if (analysisTypes.includes('performance')) {
            const performanceResult = analyzer.analyzePerformance(code, lines);
            performance = performanceResult.score;
            metrics.performance = performanceResult.details;
            recommendations.push(...performanceResult.recommendations);
        }

        if (analysisTypes.includes('security')) {
            const securityResult = analyzer.analyzeSecurity(code, lines);
            security = securityResult.score;
            metrics.security = securityResult.details;
            recommendations.push(...securityResult.recommendations);
        }

        return {
            complexity,
            maintainability: Math.max(0, maintainability),
            performance: Math.max(0, performance),
            security: Math.max(0, security),
            recommendations: [...new Set(recommendations)], // Remove duplicates
            metrics
        };
    }

    private async detectErrors(input: { 
        code: string; 
        language: string;
        includeWarnings?: boolean;
    }): Promise<{
        errors: Array<{ line: number; type: string; message: string; suggestion?: string }>;
        warnings: Array<{ line: number; type: string; message: string; suggestion?: string }>;
        summary: { errorCount: number; warningCount: number; criticalErrors: number };
    }> {
        const { code, language, includeWarnings = true } = input;
        const lines = code.split('\n');
        const errors: Array<{ line: number; type: string; message: string; suggestion?: string }> = [];
        const warnings: Array<{ line: number; type: string; message: string; suggestion?: string }> = [];

        // Get language-specific error detection rules
        const detector = this.getErrorDetector(language);
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            // Detect errors
            const errorResults = detector.detectErrors(line, lineNum);
            errors.push(...errorResults);
            
            // Detect warnings if requested
            if (includeWarnings) {
                const warningResults = detector.detectWarnings(line, lineNum);
                warnings.push(...warningResults);
            }
        });

        // Cross-line analysis
        const crossLineErrors = detector.detectCrossLineErrors(lines);
        errors.push(...crossLineErrors.errors);
        warnings.push(...crossLineErrors.warnings);

        const criticalErrors = errors.filter(e => e.type.includes('critical')).length;

        return {
            errors,
            warnings,
            summary: {
                errorCount: errors.length,
                warningCount: warnings.length,
                criticalErrors
            }
        };
    }

    private async validateConversion(input: {
        originalCode: string;
        convertedCode: string;
        sourceLanguage: string;
        targetLanguage: string;
        validationLevel?: 'basic' | 'standard' | 'strict';
    }): Promise<{
        isValid: boolean;
        validationScore: number;
        syntaxValidation: any;
        compatibilityValidation: any;
        codeAnalysis: any;
        recommendation: string;
    }> {
        const { originalCode, convertedCode, sourceLanguage, targetLanguage, validationLevel = 'standard' } = input;
        
        // Syntax validation
        const syntaxValidation = await this.validateSyntax({
            code: convertedCode,
            language: targetLanguage,
            strict: validationLevel === 'strict'
        });

        // Compatibility validation
        const compatibilityValidation = await this.validateCompatibility({
            originalCode,
            originalLanguage: sourceLanguage,
            convertedCode,
            convertedLanguage: targetLanguage
        });

        // Code analysis
        const analysisTypes = validationLevel === 'basic' 
            ? ['complexity' as const] 
            : ['complexity' as const, 'maintainability' as const, 'performance' as const, 'security' as const];
            
        const codeAnalysis = await this.analyzeCode({
            code: convertedCode,
            language: targetLanguage,
            analysisTypes
        });

        // Calculate overall validation score
        const syntaxScore = syntaxValidation.isValid ? 100 : 50;
        const compatScore = compatibilityValidation.compatibilityScore;
        const analysisScore = (codeAnalysis.maintainability + codeAnalysis.performance + codeAnalysis.security) / 3;
        
        const validationScore = (syntaxScore * 0.3 + compatScore * 0.5 + analysisScore * 0.2);
        const isValid = validationScore >= 75 && syntaxValidation.isValid && compatibilityValidation.isCompatible;

        // Generate recommendation
        let recommendation = '';
        if (isValid) {
            recommendation = 'Conversion validated successfully. Code is ready for use.';
        } else if (syntaxScore < 100) {
            recommendation = 'Fix syntax errors before proceeding.';
        } else if (compatScore < 80) {
            recommendation = 'Address compatibility issues to ensure proper functionality.';
        } else {
            recommendation = 'Improve code quality based on analysis recommendations.';
        }

        return {
            isValid,
            validationScore,
            syntaxValidation,
            compatibilityValidation,
            codeAnalysis,
            recommendation
        };
    }

    private async performSecurityScan(input: {
        code: string;
        language: string;
        scanLevel?: 'basic' | 'standard' | 'comprehensive';
    }): Promise<{
        vulnerabilities: Array<{
            type: string;
            severity: 'critical' | 'high' | 'medium' | 'low';
            line: number;
            description: string;
            recommendation: string;
        }>;
        securityScore: number;
        summary: string;
    }> {
        const { code, language, scanLevel = 'standard' } = input;
        const vulnerabilities: Array<{
            type: string;
            severity: 'critical' | 'high' | 'medium' | 'low';
            line: number;
            description: string;
            recommendation: string;
        }> = [];

        // Get language-specific security scanner
        const scanner = this.getSecurityScanner(language);
        const lines = code.split('\n');

        // Perform security scan
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            const lineVulnerabilities = scanner.scanLine(line, lineNum, scanLevel);
            vulnerabilities.push(...lineVulnerabilities);
        });

        // Cross-line security analysis
        if (scanLevel !== 'basic') {
            const crossLineVulnerabilities = scanner.scanCrossLine(lines, scanLevel);
            vulnerabilities.push(...crossLineVulnerabilities);
        }

        // Calculate security score
        let securityScore = 100;
        vulnerabilities.forEach(vuln => {
            switch (vuln.severity) {
                case 'critical': securityScore -= 25; break;
                case 'high': securityScore -= 15; break;
                case 'medium': securityScore -= 10; break;
                case 'low': securityScore -= 5; break;
            }
        });
        securityScore = Math.max(0, securityScore);

        // Generate summary
        const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
        const highCount = vulnerabilities.filter(v => v.severity === 'high').length;
        
        let summary = `Security score: ${securityScore}/100. `;
        if (criticalCount > 0) {
            summary += `Found ${criticalCount} critical vulnerabilities that must be fixed immediately. `;
        } else if (highCount > 0) {
            summary += `Found ${highCount} high severity issues that should be addressed. `;
        } else if (vulnerabilities.length > 0) {
            summary += `Found ${vulnerabilities.length} potential security issues. `;
        } else {
            summary += 'No security vulnerabilities detected. ';
        }

        return {
            vulnerabilities,
            securityScore,
            summary
        };
    }

    private async getConversionPair(from: string, to: string): Promise<any | null> {
        if (!this.config) return null;
        
        const enhancedConfig = this.config.getConfig();
        return enhancedConfig.languageConversion.supportedPairs.find(
            (pair: { from: string; to: string; name: string; typeMappings?: Record<string, string>; specialValidation?: boolean }) => pair.from === from && pair.to === to
        );
    }

    private async validateStructuralIntegrity(
        originalCode: string,
        convertedCode: string,
        originalLanguage: string,
        convertedLanguage: string
    ): Promise<{
        isValid: boolean;
        penaltyScore: number;
        issues: Array<{ type: string; description: string; severity: 'critical' | 'major' | 'minor' }>;
    }> {
        const issues: Array<{ type: string; description: string; severity: 'critical' | 'major' | 'minor' }> = [];
        let penaltyScore = 0;

        // Count structural elements
        const originalElements = this.countStructuralElements(originalCode, originalLanguage);
        const convertedElements = this.countStructuralElements(convertedCode, convertedLanguage);

        // Compare counts
        const elementTypes = ['classes', 'functions', 'methods', 'properties'];
        elementTypes.forEach(elementType => {
            const diff = Math.abs(originalElements[elementType] - convertedElements[elementType]);
            if (diff > 0) {
                issues.push({
                    type: 'structural_mismatch',
                    description: `${elementType} count mismatch: ${originalElements[elementType]} vs ${convertedElements[elementType]}`,
                    severity: diff > 2 ? 'major' : 'minor'
                });
                penaltyScore += diff > 2 ? 15 : 5;
            }
        });

        return {
            isValid: penaltyScore < 20,
            penaltyScore,
            issues
        };
    }

    private async validateTypeMappings(
        originalCode: string,
        convertedCode: string,
        typeMappings: Record<string, string>
    ): Promise<{
        isValid: boolean;
        penaltyScore: number;
        issues: Array<{ type: string; description: string; severity: 'critical' | 'major' | 'minor' }>;
    }> {
        const issues: Array<{ type: string; description: string; severity: 'critical' | 'major' | 'minor' }> = [];
        let penaltyScore = 0;

        for (const [sourceType, targetType] of Object.entries(typeMappings)) {
            if (originalCode.includes(sourceType) && !convertedCode.includes(targetType)) {
                issues.push({
                    type: 'missing_type_conversion',
                    description: `Type '${sourceType}' should be converted to '${targetType}'`,
                    severity: 'major'
                });
                penaltyScore += 10;
            }
        }

        return {
            isValid: penaltyScore < 20,
            penaltyScore,
            issues
        };
    }

    private async validateFunctionalEquivalence(
        originalCode: string,
        convertedCode: string,
        originalLanguage: string,
        convertedLanguage: string
    ): Promise<{
        isValid: boolean;
        penaltyScore: number;
        issues: Array<{ type: string; description: string; severity: 'critical' | 'major' | 'minor' }>;
    }> {
        const issues: Array<{ type: string; description: string; severity: 'critical' | 'major' | 'minor' }> = [];
        let penaltyScore = 0;

        // Check for critical functional keywords
        const functionalKeywords = {
            controlFlow: ['if', 'else', 'for', 'while', 'switch', 'match'],
            errorHandling: ['try', 'catch', 'throw', 'except', 'raise', 'Result', 'Option'],
            returns: ['return', 'yield']
        };

        Object.entries(functionalKeywords).forEach(([category, keywords]) => {
            const originalCount = keywords.reduce((sum, kw) => 
                sum + (originalCode.split(new RegExp(`\\b${kw}\\b`)).length - 1), 0
            );
            const convertedCount = keywords.reduce((sum, kw) => 
                sum + (convertedCode.split(new RegExp(`\\b${kw}\\b`)).length - 1), 0
            );

            const diff = Math.abs(originalCount - convertedCount);
            if (diff > 3) {
                issues.push({
                    type: 'functional_difference',
                    description: `Significant difference in ${category} structures`,
                    severity: 'major'
                });
                penaltyScore += 15;
            }
        });

        return {
            isValid: penaltyScore < 30,
            penaltyScore,
            issues
        };
    }

    private countStructuralElements(code: string, language: string): Record<string, number> {
        const counts = {
            classes: 0,
            functions: 0,
            methods: 0,
            properties: 0
        };

        const patterns = {
            csharp: {
                classes: /class\s+\w+/g,
                methods: /public\s+\w+\s+\w+\s*\([^)]*\)/g,
                properties: /public\s+\w+\s+\w+\s*{\s*get;\s*set;\s*}/g
            },
            rust: {
                classes: /struct\s+\w+/g,
                functions: /fn\s+\w+/g,
                methods: /impl\s+.*\s*{[\s\S]*?fn\s+\w+/g
            },
            javascript: {
                classes: /class\s+\w+/g,
                functions: /function\s+\w+/g,
                methods: /\w+\s*\([^)]*\)\s*{/g
            },
            typescript: {
                classes: /class\s+\w+/g,
                functions: /function\s+\w+/g,
                methods: /\w+\s*\([^)]*\)\s*:/g,
                properties: /\w+\s*:\s*\w+/g
            },
            python: {
                classes: /class\s+\w+/g,
                functions: /def\s+\w+/g,
                methods: /def\s+\w+\s*\(self/g
            },
            java: {
                classes: /class\s+\w+/g,
                methods: /(public|private|protected)\s+\w+\s+\w+\s*\([^)]*\)/g
            },
            kotlin: {
                classes: /class\s+\w+/g,
                functions: /fun\s+\w+/g,
                properties: /val\s+\w+|var\s+\w+/g
            }
        };

        const langPatterns = patterns[language as keyof typeof patterns];
        if (langPatterns) {
            Object.entries(langPatterns).forEach(([element, pattern]) => {
                const matches = code.match(pattern as RegExp);
                counts[element as keyof typeof counts] = matches ? matches.length : 0;
            });
            
            // Functions include both standalone functions and methods
            counts.functions = counts.functions + counts.methods;
        }

        return counts;
    }

    private getLanguageAnalyzer(language: string): any {
        // Return language-specific analyzer
        return {
            analyzeComplexity: (code: string, lines: string[]) => {
                let complexity = 1;
                const details: any = { cyclomaticComplexity: 1, cognitiveComplexity: 0 };
                const recommendations: string[] = [];

                // Count control flow statements
                const controlFlowPatterns = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch'];
                controlFlowPatterns.forEach(pattern => {
                    const count = (code.match(new RegExp(`\\b${pattern}\\b`, 'g')) || []).length;
                    complexity += count;
                    details.cyclomaticComplexity += count;
                });

                // Cognitive complexity (nesting)
                let nestingLevel = 0;
                lines.forEach(line => {
                    if (line.includes('{')) nestingLevel++;
                    if (line.includes('}')) nestingLevel--;
                    if (nestingLevel > 3) {
                        details.cognitiveComplexity += nestingLevel - 3;
                    }
                });

                if (complexity > 10) {
                    recommendations.push('Consider breaking down complex functions');
                }

                return { score: complexity, details, recommendations };
            },

            analyzeMaintainability: (code: string, lines: string[]) => {
                let score = 100;
                const details: any = { longLines: 0, largeFiles: false, namingIssues: 0 };
                const recommendations: string[] = [];

                // Check line length
                lines.forEach(line => {
                    if (line.length > 120) {
                        details.longLines++;
                        score -= 1;
                    }
                });

                // Check file size
                if (lines.length > 500) {
                    details.largeFiles = true;
                    score -= 10;
                    recommendations.push('Consider splitting large files');
                }

                // Check naming conventions (simplified)
                const badNames = code.match(/\b[a-z]\b/g) || [];
                details.namingIssues = badNames.length;
                score -= badNames.length * 2;

                if (details.longLines > 5) {
                    recommendations.push('Break long lines for better readability');
                }

                return { score: Math.max(0, score), details, recommendations };
            },

            analyzePerformance: (code: string, lines: string[]) => {
                let score = 100;
                const details: any = { inefficientPatterns: [], memoryIssues: [] };
                const recommendations: string[] = [];

                // Language-specific performance checks
                const performancePatterns = {
                    stringConcatenation: /\+\s*["']/g,
                    nestedLoops: /for.*for|while.*while/gs,
                    unnecessaryAllocations: /new\s+\w+\(\)/g
                };

                Object.entries(performancePatterns).forEach(([issue, pattern]) => {
                    const matches = code.match(pattern) || [];
                    if (matches.length > 0) {
                        details.inefficientPatterns.push({ issue, count: matches.length });
                        score -= matches.length * 5;
                    }
                });

                if (details.inefficientPatterns.length > 0) {
                    recommendations.push('Review performance-critical sections');
                }

                return { score: Math.max(0, score), details, recommendations };
            },

            analyzeSecurity: (code: string, lines: string[]) => {
                let score = 100;
                const details: any = { vulnerabilities: [] };
                const recommendations: string[] = [];

                // Common security patterns
                const securityPatterns = {
                    sqlInjection: /SELECT.*\+|WHERE.*\+/gi,
                    hardcodedSecrets: /password\s*=\s*["'][^"']+["']|api_key\s*=\s*["'][^"']+["']/gi,
                    unsafeEval: /eval\s*\(/g,
                    insecureRandom: /Math\.random/g
                };

                Object.entries(securityPatterns).forEach(([vuln, pattern]) => {
                    const matches = code.match(pattern) || [];
                    if (matches.length > 0) {
                        details.vulnerabilities.push({ type: vuln, count: matches.length });
                        score -= matches.length * 10;
                        recommendations.push(`Review potential ${vuln} vulnerabilities`);
                    }
                });

                return { score: Math.max(0, score), details, recommendations };
            }
        };
    }

    private getErrorDetector(language: string): any {
        const rules = this.validationRules.get(language) || this.validationRules.get('javascript');
        
        return {
            detectErrors: (line: string, lineNum: number) => {
                const errors: Array<{ line: number; type: string; message: string; suggestion?: string }> = [];
                
                // Language-specific error detection
                if (language === 'rust' && line.includes('null')) {
                    errors.push({
                        line: lineNum,
                        type: 'invalid_null',
                        message: 'Rust does not have null values',
                        suggestion: 'Use Option<T> for nullable values'
                    });
                }

                if (language === 'python' && line.includes('++')) {
                    errors.push({
                        line: lineNum,
                        type: 'invalid_operator',
                        message: 'Python does not support ++ operator',
                        suggestion: 'Use += 1 instead'
                    });
                }

                return errors;
            },

            detectWarnings: (line: string, lineNum: number) => {
                const warnings: Array<{ line: number; type: string; message: string; suggestion?: string }> = [];
                
                // Common warnings
                if (line.includes('TODO') || line.includes('FIXME')) {
                    warnings.push({
                        line: lineNum,
                        type: 'incomplete_implementation',
                        message: 'Incomplete implementation marker found',
                        suggestion: 'Complete the implementation before production'
                    });
                }

                if (line.includes('console.log') || line.includes('print(') || line.includes('println')) {
                    warnings.push({
                        line: lineNum,
                        type: 'debug_output',
                        message: 'Debug output found',
                        suggestion: 'Remove or replace with proper logging'
                    });
                }

                return warnings;
            },

            detectCrossLineErrors: (lines: string[]) => {
                const errors: Array<{ line: number; type: string; message: string; suggestion?: string }> = [];
                const warnings: Array<{ line: number; type: string; message: string; suggestion?: string }> = [];
                
                // Check for unclosed braces
                let braceCount = 0;
                lines.forEach((line, index) => {
                    braceCount += (line.match(/{/g) || []).length;
                    braceCount -= (line.match(/}/g) || []).length;
                });
                
                if (braceCount !== 0) {
                    errors.push({
                        line: lines.length,
                        type: 'syntax_error',
                        message: `Unclosed braces: ${braceCount > 0 ? 'missing }' : 'extra }'}`,
                        suggestion: 'Check brace matching'
                    });
                }

                return { errors, warnings };
            }
        };
    }

    private getSecurityScanner(language: string): any {
        return {
            scanLine: (line: string, lineNum: number, scanLevel: string) => {
                const vulnerabilities: Array<{
                    type: string;
                    severity: 'critical' | 'high' | 'medium' | 'low';
                    line: number;
                    description: string;
                    recommendation: string;
                }> = [];

                // SQL Injection
                if (line.match(/SELECT.*\+|WHERE.*\+|query.*\+/i)) {
                    vulnerabilities.push({
                        type: 'sql_injection',
                        severity: 'critical',
                        line: lineNum,
                        description: 'Potential SQL injection vulnerability',
                        recommendation: 'Use parameterized queries or prepared statements'
                    });
                }

                // Hardcoded credentials
                if (line.match(/password\s*=\s*["'][^"']+["']|api_key\s*=\s*["'][^"']+["']/i)) {
                    vulnerabilities.push({
                        type: 'hardcoded_credentials',
                        severity: 'high',
                        line: lineNum,
                        description: 'Hardcoded credentials detected',
                        recommendation: 'Use environment variables or secure configuration'
                    });
                }

                // Unsafe operations
                if (language === 'rust' && line.includes('unsafe')) {
                    vulnerabilities.push({
                        type: 'unsafe_code',
                        severity: 'medium',
                        line: lineNum,
                        description: 'Unsafe code block detected',
                        recommendation: 'Review unsafe code for memory safety'
                    });
                }

                if (scanLevel !== 'basic') {
                    // Command injection
                    if (line.match(/exec\(|system\(|eval\(/)) {
                        vulnerabilities.push({
                            type: 'command_injection',
                            severity: 'high',
                            line: lineNum,
                            description: 'Potential command injection',
                            recommendation: 'Validate and sanitize all inputs'
                        });
                    }
                }

                return vulnerabilities;
            },

            scanCrossLine: (lines: string[], scanLevel: string) => {
                const vulnerabilities: Array<{
                    type: string;
                    severity: 'critical' | 'high' | 'medium' | 'low';
                    line: number;
                    description: string;
                    recommendation: string;
                }> = [];

                // Check for missing input validation
                const userInputPatterns = ['request.', 'req.body', 'req.query', 'input(', 'gets('];
                const validationPatterns = ['validate', 'sanitize', 'check', 'verify'];
                
                let hasUserInput = false;
                let hasValidation = false;
                
                lines.forEach((line, index) => {
                    if (userInputPatterns.some(p => line.includes(p))) hasUserInput = true;
                    if (validationPatterns.some(p => line.includes(p))) hasValidation = true;
                });

                if (hasUserInput && !hasValidation && scanLevel === 'comprehensive') {
                    vulnerabilities.push({
                        type: 'missing_input_validation',
                        severity: 'medium',
                        line: 0,
                        description: 'User input detected without apparent validation',
                        recommendation: 'Add input validation for all user-provided data'
                    });
                }

                return vulnerabilities;
            }
        };
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
        supportedLanguages: string[];
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
            supportedLanguages: this.supportedLanguages
        };
    }
}