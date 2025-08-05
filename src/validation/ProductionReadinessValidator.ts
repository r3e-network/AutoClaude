import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { log } from '../utils/productionLogger';
import { SubAgentRunner } from '../subagents/SubAgentRunner';

/**
 * Production Readiness Validator
 * 
 * Ensures all code is production-ready before task completion:
 * - No placeholders or mock implementations
 * - No TODOs, FIXMEs, or other markers
 * - No simplified or stub implementations
 * - Complete error handling
 * - Proper typing (no 'any' types)
 * - All tests passing
 * - Code properly formatted
 * - No console.log statements
 * - No hardcoded values
 * - Security best practices followed
 */
export class ProductionReadinessValidator {
    private static instance: ProductionReadinessValidator | null = null;
    private subAgentRunner: SubAgentRunner;
    
    // Comprehensive list of forbidden patterns
    private readonly FORBIDDEN_PATTERNS = [
        // Development markers
        { pattern: /\/\/\s*TODO\s*:/gi, message: 'TODO comment found', severity: 'error' },
        { pattern: /\/\/\s*FIXME\s*:/gi, message: 'FIXME comment found', severity: 'error' },
        { pattern: /\/\/\s*HACK\s*:/gi, message: 'HACK comment found', severity: 'warning' },
        { pattern: /\/\/\s*BUG\s*:/gi, message: 'BUG comment found', severity: 'error' },
        { pattern: /\/\/\s*XXX\s*:/gi, message: 'XXX comment found', severity: 'warning' },
        { pattern: /\/\/\s*OPTIMIZE\s*:/gi, message: 'OPTIMIZE comment found', severity: 'warning' },
        { pattern: /\/\/\s*REFACTOR\s*:/gi, message: 'REFACTOR comment found', severity: 'warning' },
        
        // Placeholder implementations
        { pattern: /placeholder/gi, message: 'Placeholder found', severity: 'error' },
        { pattern: /mock(?!ing|ito)/gi, message: 'Mock implementation found', severity: 'error' },
        { pattern: /stub(?!born)/gi, message: 'Stub implementation found', severity: 'error' },
        { pattern: /dummy/gi, message: 'Dummy implementation found', severity: 'error' },
        { pattern: /fake(?!r)/gi, message: 'Fake implementation found', severity: 'error' },
        { pattern: /temp(?!late|erature)/gi, message: 'Temporary implementation found', severity: 'warning' },
        { pattern: /test(?!ing|s|ed|able)\s+data/gi, message: 'Test data found', severity: 'error' },
        
        // Simplified implementations
        { pattern: /simplified/gi, message: 'Simplified implementation found', severity: 'error' },
        { pattern: /simplistic/gi, message: 'Simplistic implementation found', severity: 'error' },
        { pattern: /basic\s+implementation/gi, message: 'Basic implementation found', severity: 'warning' },
        { pattern: /minimal\s+implementation/gi, message: 'Minimal implementation found', severity: 'warning' },
        
        // Not implemented patterns
        { pattern: /not\s+implemented/gi, message: 'Not implemented found', severity: 'error' },
        { pattern: /throw\s+new\s+Error\s*\(\s*['"`]Not\s+implemented/gi, message: 'Not implemented error found', severity: 'error' },
        { pattern: /return\s+null\s*;\s*\/\/\s*placeholder/gi, message: 'Placeholder return found', severity: 'error' },
        { pattern: /return\s+undefined\s*;\s*\/\/\s*placeholder/gi, message: 'Placeholder return found', severity: 'error' },
        { pattern: /\/\/\s*implement\s+later/gi, message: 'Implement later comment found', severity: 'error' },
        { pattern: /\/\/\s*finish\s+this/gi, message: 'Unfinished implementation found', severity: 'error' },
        
        // Console logging
        { pattern: /console\.(log|debug|info|warn|error)\s*\(/g, message: 'Console statement found', severity: 'error' },
        
        // Hardcoded values
        { pattern: /localhost:\d+/g, message: 'Hardcoded localhost URL found', severity: 'error' },
        { pattern: /127\.0\.0\.1/g, message: 'Hardcoded IP address found', severity: 'error' },
        { pattern: /password\s*=\s*['"`][^'"`]+['"`]/gi, message: 'Hardcoded password found', severity: 'critical' },
        { pattern: /api[_\-]?key\s*=\s*['"`][^'"`]+['"`]/gi, message: 'Hardcoded API key found', severity: 'critical' },
        { pattern: /secret\s*=\s*['"`][^'"`]+['"`]/gi, message: 'Hardcoded secret found', severity: 'critical' },
        
        // Poor error handling
        { pattern: /catch\s*\(\s*\w*\s*\)\s*{\s*}/g, message: 'Empty catch block found', severity: 'error' },
        { pattern: /catch\s*\(\s*\w*\s*\)\s*{\s*\/\/\s*ignore/gi, message: 'Ignored error found', severity: 'error' },
        { pattern: /\.catch\s*\(\s*\(\s*\)\s*=>\s*{\s*}\s*\)/g, message: 'Empty promise catch found', severity: 'error' },
        
        // TypeScript any types
        { pattern: /:\s*any(?:\s|;|,|\)|$)/g, message: 'TypeScript any type found', severity: 'warning' },
        { pattern: /as\s+any(?:\s|;|,|\)|$)/g, message: 'TypeScript any cast found', severity: 'warning' },
        
        // Incomplete implementations
        { pattern: /coming\s+soon/gi, message: 'Coming soon found', severity: 'error' },
        { pattern: /work\s+in\s+progress/gi, message: 'Work in progress found', severity: 'error' },
        { pattern: /under\s+construction/gi, message: 'Under construction found', severity: 'error' },
        { pattern: /to\s+be\s+implemented/gi, message: 'To be implemented found', severity: 'error' },
        
        // Development/debug code
        { pattern: /debugger\s*;/g, message: 'Debugger statement found', severity: 'error' },
        { pattern: /alert\s*\(/g, message: 'Alert statement found', severity: 'error' },
        { pattern: /confirm\s*\(/g, message: 'Confirm statement found', severity: 'warning' },
        
        // Comments indicating problems
        { pattern: /\/\/\s*this\s+is\s+bad/gi, message: 'Bad code comment found', severity: 'error' },
        { pattern: /\/\/\s*quick\s+and\s+dirty/gi, message: 'Quick and dirty comment found', severity: 'error' },
        { pattern: /\/\/\s*temporary\s+fix/gi, message: 'Temporary fix comment found', severity: 'error' },
        { pattern: /\/\/\s*workaround/gi, message: 'Workaround comment found', severity: 'warning' },
        
        // Incomplete documentation
        { pattern: /@param\s+\{[^}]*\}\s*$/gm, message: 'Incomplete param documentation', severity: 'warning' },
        { pattern: /@returns?\s*$/gm, message: 'Incomplete return documentation', severity: 'warning' },
        
        // AI/Assistant references (should not be in code)
        { pattern: /claude|ai\s+assistant|generated\s+by\s+ai/gi, message: 'AI reference found in code', severity: 'error' }
    ];
    
    // File extensions to check
    private readonly FILE_EXTENSIONS = [
        '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
        '.py', '.java', '.cs', '.go', '.rs', '.cpp', '.c',
        '.rb', '.php', '.swift', '.kt', '.scala', '.r'
    ];
    
    constructor(private workspaceRoot: string) {
        this.subAgentRunner = new SubAgentRunner(workspaceRoot);
    }
    
    static getInstance(workspaceRoot: string): ProductionReadinessValidator {
        if (!ProductionReadinessValidator.instance) {
            ProductionReadinessValidator.instance = new ProductionReadinessValidator(workspaceRoot);
        }
        return ProductionReadinessValidator.instance;
    }
    
    /**
     * Validate that all code is production ready
     * @returns Validation result with details of any issues found
     */
    async validateProductionReadiness(changedFiles?: string[]): Promise<ValidationResult> {
        log.info('Starting production readiness validation');
        
        const result: ValidationResult = {
            isProductionReady: true,
            errors: [],
            warnings: [],
            criticalIssues: [],
            checkedFiles: 0,
            totalIssues: 0
        };
        
        try {
            // Step 1: Run SubAgent production readiness check
            const subAgentResult = await this.runSubAgentCheck();
            if (!subAgentResult.passed) {
                result.isProductionReady = false;
                result.errors.push(...subAgentResult.errors);
            }
            
            // Step 2: Check for forbidden patterns
            const patternResult = await this.checkForbiddenPatterns(changedFiles);
            result.errors.push(...patternResult.errors);
            result.warnings.push(...patternResult.warnings);
            result.criticalIssues.push(...patternResult.criticalIssues);
            result.checkedFiles = patternResult.checkedFiles;
            
            if (patternResult.errors.length > 0 || patternResult.criticalIssues.length > 0) {
                result.isProductionReady = false;
            }
            
            // Step 3: Run build check
            const buildResult = await this.runBuildCheck();
            if (!buildResult.passed) {
                result.isProductionReady = false;
                result.errors.push(...buildResult.errors);
            }
            
            // Step 4: Run test check
            const testResult = await this.runTestCheck();
            if (!testResult.passed) {
                result.isProductionReady = false;
                result.errors.push(...testResult.errors);
            }
            
            // Step 5: Check code formatting
            const formatResult = await this.runFormatCheck();
            if (!formatResult.passed) {
                result.warnings.push(...formatResult.errors);
            }
            
            // Step 6: Security check
            const securityResult = await this.runSecurityCheck();
            if (!securityResult.passed) {
                result.isProductionReady = false;
                result.criticalIssues.push(...securityResult.errors);
            }
            
            // Calculate total issues
            result.totalIssues = result.errors.length + result.warnings.length + result.criticalIssues.length;
            
            // Log results
            if (result.isProductionReady) {
                log.info('Production readiness validation PASSED', {
                    checkedFiles: result.checkedFiles,
                    warnings: result.warnings.length
                });
            } else {
                log.error('Production readiness validation FAILED', {
                    errors: result.errors.length,
                    warnings: result.warnings.length,
                    criticalIssues: result.criticalIssues.length,
                    totalIssues: result.totalIssues
                });
            }
            
        } catch (error) {
            log.error('Production readiness validation error', error as Error);
            result.isProductionReady = false;
            result.errors.push({
                file: 'validator',
                line: 0,
                message: `Validation error: ${(error as Error).message}`,
                severity: 'error'
            });
        }
        
        return result;
    }
    
    /**
     * Check for forbidden patterns in code
     */
    private async checkForbiddenPatterns(changedFiles?: string[]): Promise<PatternCheckResult> {
        const result: PatternCheckResult = {
            errors: [],
            warnings: [],
            criticalIssues: [],
            checkedFiles: 0
        };
        
        try {
            // Get files to check
            const files = changedFiles || await this.getAllSourceFiles();
            
            for (const file of files) {
                if (this.shouldCheckFile(file)) {
                    const issues = await this.checkFileForPatterns(file);
                    
                    // Categorize issues by severity
                    for (const issue of issues) {
                        switch (issue.severity) {
                            case 'critical':
                                result.criticalIssues.push(issue);
                                break;
                            case 'error':
                                result.errors.push(issue);
                                break;
                            case 'warning':
                                result.warnings.push(issue);
                                break;
                        }
                    }
                    
                    result.checkedFiles++;
                }
            }
            
        } catch (error) {
            log.error('Pattern check error', error as Error);
            result.errors.push({
                file: 'pattern-check',
                line: 0,
                message: `Pattern check error: ${(error as Error).message}`,
                severity: 'error'
            });
        }
        
        return result;
    }
    
    /**
     * Check a single file for forbidden patterns
     */
    private async checkFileForPatterns(filePath: string): Promise<ValidationIssue[]> {
        const issues: ValidationIssue[] = [];
        
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            
            // Check each pattern
            for (const forbiddenPattern of this.FORBIDDEN_PATTERNS) {
                const matches = content.matchAll(forbiddenPattern.pattern);
                
                for (const match of matches) {
                    const lineNumber = this.getLineNumber(content, match.index || 0);
                    const lineContent = lines[lineNumber - 1]?.trim() || '';
                    
                    issues.push({
                        file: filePath,
                        line: lineNumber,
                        message: `${forbiddenPattern.message}: "${lineContent.substring(0, 100)}${lineContent.length > 100 ? '...' : ''}"`,
                        severity: forbiddenPattern.severity as 'error' | 'warning' | 'critical'
                    });
                }
            }
            
        } catch (error) {
            log.warn(`Failed to check file ${filePath}`, error as Error);
        }
        
        return issues;
    }
    
    /**
     * Run SubAgent production readiness check
     */
    private async runSubAgentCheck(): Promise<CheckResult> {
        try {
            await this.subAgentRunner.initialize();
            const result = await this.subAgentRunner.runSingleAgent('production-readiness');
            
            return {
                passed: result?.passed || false,
                errors: result?.errors?.map(e => ({
                    file: 'production-check',
                    line: 0,
                    message: e,
                    severity: 'error' as const
                })) || []
            };
        } catch (error) {
            log.error('SubAgent check failed', error as Error);
            return {
                passed: false,
                errors: [{
                    file: 'production-check',
                    line: 0,
                    message: `SubAgent check failed: ${(error as Error).message}`,
                    severity: 'error'
                }]
            };
        }
    }
    
    /**
     * Run build check
     */
    private async runBuildCheck(): Promise<CheckResult> {
        try {
            const result = await this.subAgentRunner.runSingleAgent('build-check');
            
            return {
                passed: result?.passed || false,
                errors: result?.errors?.map(e => ({
                    file: 'build-check',
                    line: 0,
                    message: e,
                    severity: 'error' as const
                })) || []
            };
        } catch (error) {
            log.error('Build check failed', error as Error);
            return {
                passed: false,
                errors: [{
                    file: 'build-check',
                    line: 0,
                    message: `Build check failed: ${(error as Error).message}`,
                    severity: 'error'
                }]
            };
        }
    }
    
    /**
     * Run test check
     */
    private async runTestCheck(): Promise<CheckResult> {
        try {
            const result = await this.subAgentRunner.runSingleAgent('test-check');
            
            return {
                passed: result?.passed || false,
                errors: result?.errors?.map(e => ({
                    file: 'test-check',
                    line: 0,
                    message: e,
                    severity: 'error' as const
                })) || []
            };
        } catch (error) {
            log.error('Test check failed', error as Error);
            return {
                passed: false,
                errors: [{
                    file: 'test-check',
                    line: 0,
                    message: `Test check failed: ${(error as Error).message}`,
                    severity: 'error'
                }]
            };
        }
    }
    
    /**
     * Run format check
     */
    private async runFormatCheck(): Promise<CheckResult> {
        try {
            const result = await this.subAgentRunner.runSingleAgent('format-check');
            
            return {
                passed: result?.passed || false,
                errors: result?.errors?.map(e => ({
                    file: 'format-check',
                    line: 0,
                    message: e,
                    severity: 'warning' as const
                })) || []
            };
        } catch (error) {
            log.warn('Format check failed', error as Error);
            return {
                passed: true, // Don't fail on format issues
                errors: [{
                    file: 'format-check',
                    line: 0,
                    message: `Format check failed: ${(error as Error).message}`,
                    severity: 'warning'
                }]
            };
        }
    }
    
    /**
     * Run security check
     */
    private async runSecurityCheck(): Promise<CheckResult> {
        try {
            const result = await this.subAgentRunner.runSingleAgent('security-audit');
            
            return {
                passed: result?.passed || false,
                errors: result?.errors?.map(e => ({
                    file: 'security-check',
                    line: 0,
                    message: e,
                    severity: 'critical' as const
                })) || []
            };
        } catch (error) {
            log.error('Security check failed', error as Error);
            return {
                passed: false,
                errors: [{
                    file: 'security-check',
                    line: 0,
                    message: `Security check failed: ${(error as Error).message}`,
                    severity: 'critical'
                }]
            };
        }
    }
    
    /**
     * Get all source files in the workspace
     */
    private async getAllSourceFiles(): Promise<string[]> {
        const files: string[] = [];
        
        try {
            const includePattern = `**/*{${this.FILE_EXTENSIONS.join(',')}}`;
            const excludePattern = '**/node_modules/**';
            
            const uris = await vscode.workspace.findFiles(includePattern, excludePattern);
            files.push(...uris.map(uri => uri.fsPath));
            
        } catch (error) {
            log.error('Failed to get source files', error as Error);
        }
        
        return files;
    }
    
    /**
     * Check if a file should be validated
     */
    private shouldCheckFile(filePath: string): boolean {
        // Skip node_modules
        if (filePath.includes('node_modules')) return false;
        
        // Skip build directories
        if (filePath.includes('/out/') || filePath.includes('/dist/') || filePath.includes('/build/')) return false;
        
        // Skip test files for certain checks
        if (filePath.includes('.test.') || filePath.includes('.spec.')) {
            // Still check test files for some patterns
            return true;
        }
        
        // Check if file has valid extension
        const ext = path.extname(filePath);
        return this.FILE_EXTENSIONS.includes(ext);
    }
    
    /**
     * Get line number from character index
     */
    private getLineNumber(content: string, index: number): number {
        const lines = content.substring(0, index).split('\n');
        return lines.length;
    }
    
    /**
     * Format validation result for display
     */
    formatValidationResult(result: ValidationResult): string {
        const lines: string[] = [];
        
        lines.push('🔍 Production Readiness Validation Report');
        lines.push('=' .repeat(50));
        
        if (result.isProductionReady) {
            lines.push('✅ PASSED - Code is production ready!');
        } else {
            lines.push('❌ FAILED - Code is NOT production ready');
        }
        
        lines.push(`\nChecked ${result.checkedFiles} files`);
        lines.push(`Total issues: ${result.totalIssues}`);
        
        if (result.criticalIssues.length > 0) {
            lines.push('\n🚨 CRITICAL ISSUES:');
            for (const issue of result.criticalIssues.slice(0, 10)) {
                lines.push(`  • ${issue.file}:${issue.line} - ${issue.message}`);
            }
            if (result.criticalIssues.length > 10) {
                lines.push(`  ... and ${result.criticalIssues.length - 10} more`);
            }
        }
        
        if (result.errors.length > 0) {
            lines.push('\n❌ ERRORS:');
            for (const error of result.errors.slice(0, 10)) {
                lines.push(`  • ${error.file}:${error.line} - ${error.message}`);
            }
            if (result.errors.length > 10) {
                lines.push(`  ... and ${result.errors.length - 10} more`);
            }
        }
        
        if (result.warnings.length > 0) {
            lines.push('\n⚠️  WARNINGS:');
            for (const warning of result.warnings.slice(0, 5)) {
                lines.push(`  • ${warning.file}:${warning.line} - ${warning.message}`);
            }
            if (result.warnings.length > 5) {
                lines.push(`  ... and ${result.warnings.length - 5} more`);
            }
        }
        
        if (!result.isProductionReady) {
            lines.push('\n📋 Required Actions:');
            lines.push('  1. Fix all critical issues and errors');
            lines.push('  2. Remove all TODOs, placeholders, and incomplete implementations');
            lines.push('  3. Ensure all tests pass');
            lines.push('  4. Remove all console.log statements');
            lines.push('  5. Fix security vulnerabilities');
            lines.push('  6. Complete all documentation');
        }
        
        return lines.join('\n');
    }
}

// Type definitions
export interface ValidationResult {
    isProductionReady: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    criticalIssues: ValidationIssue[];
    checkedFiles: number;
    totalIssues: number;
}

export interface ValidationIssue {
    file: string;
    line: number;
    message: string;
    severity: 'error' | 'warning' | 'critical';
}

interface PatternCheckResult {
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    criticalIssues: ValidationIssue[];
    checkedFiles: number;
}

interface CheckResult {
    passed: boolean;
    errors: ValidationIssue[];
}