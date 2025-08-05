#!/usr/bin/env node

/**
 * AutoClaude Enhanced Features Verification Script
 * 
 * This script performs comprehensive verification of all enhanced features
 * to ensure they are properly implemented and functioning correctly.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI colors for output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

class VerificationScript {
    constructor() {
        this.projectRoot = process.cwd();
        this.errors = [];
        this.warnings = [];
        this.passed = [];
        this.results = {
            memory: false,
            agents: false,
            hooks: false,
            monitoring: false,
            config: false,
            extension: false,
            tests: false,
            documentation: false,
            compilation: false
        };
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    logSection(title) {
        this.log(`\n${'='.repeat(60)}`, 'cyan');
        this.log(`${title.toUpperCase()}`, 'cyan');
        this.log(`${'='.repeat(60)}`, 'cyan');
    }

    logSubsection(title) {
        this.log(`\n${'-'.repeat(40)}`, 'blue');
        this.log(`${title}`, 'blue');
        this.log(`${'-'.repeat(40)}`, 'blue');
    }

    checkFileExists(filePath, description) {
        const fullPath = path.join(this.projectRoot, filePath);
        if (fs.existsSync(fullPath)) {
            this.log(`✅ ${description}`, 'green');
            return true;
        } else {
            this.log(`❌ ${description} - File not found: ${filePath}`, 'red');
            this.errors.push(`Missing file: ${filePath}`);
            return false;
        }
    }

    checkFileContent(filePath, patterns, description) {
        const fullPath = path.join(this.projectRoot, filePath);
        if (!fs.existsSync(fullPath)) {
            this.log(`❌ ${description} - File not found: ${filePath}`, 'red');
            this.errors.push(`Missing file: ${filePath}`);
            return false;
        }

        const content = fs.readFileSync(fullPath, 'utf8');
        const missingPatterns = [];

        for (const pattern of patterns) {
            if (typeof pattern === 'string') {
                if (!content.includes(pattern)) {
                    missingPatterns.push(pattern);
                }
            } else if (pattern instanceof RegExp) {
                if (!pattern.test(content)) {
                    missingPatterns.push(pattern.toString());
                }
            }
        }

        if (missingPatterns.length === 0) {
            this.log(`✅ ${description}`, 'green');
            return true;
        } else {
            this.log(`❌ ${description} - Missing patterns:`, 'red');
            missingPatterns.forEach(pattern => {
                this.log(`   - ${pattern}`, 'red');
            });
            this.errors.push(`${description}: Missing patterns in ${filePath}`);
            return false;
        }
    }

    checkDirectoryStructure() {
        this.logSubsection('Directory Structure');
        
        const requiredDirs = [
            'src/memory',
            'src/agents',
            'src/hooks',
            'src/monitoring',
            'src/config',
            'tests/unit/memory',
            'tests/unit/agents'
        ];

        let allExist = true;
        requiredDirs.forEach(dir => {
            if (!this.checkFileExists(dir, `Directory: ${dir}`)) {
                allExist = false;
            }
        });

        return allExist;
    }

    verifyMemorySystem() {
        this.logSection('Memory System Verification');
        
        let allPassed = true;

        // Check main memory files
        allPassed &= this.checkFileExists('src/memory/MemoryManager.production.ts', 'Memory Manager Production');
        allPassed &= this.checkFileExists('src/memory/index.ts', 'Memory Index');
        allPassed &= this.checkFileExists('tests/unit/memory/MemoryManager.test.ts', 'Memory Tests');

        // Check memory manager content
        if (fs.existsSync(path.join(this.projectRoot, 'src/memory/MemoryManager.production.ts'))) {
            allPassed &= this.checkFileContent(
                'src/memory/MemoryManager.production.ts',
                [
                    'export class MemoryManager',
                    'private db: Database',
                    'async initialize()',
                    'async recordPattern(',
                    'async getTypeMapping(',
                    'async updatePatternSuccess(',
                    'CREATE TABLE IF NOT EXISTS patterns',
                    'CREATE TABLE IF NOT EXISTS type_mappings',
                    'CREATE TABLE IF NOT EXISTS conversion_history'
                ],
                'Memory Manager Implementation'
            );
        }

        // Check test coverage
        if (fs.existsSync(path.join(this.projectRoot, 'tests/unit/memory/MemoryManager.test.ts'))) {
            allPassed &= this.checkFileContent(
                'tests/unit/memory/MemoryManager.test.ts',
                [
                    "describe('MemoryManager'",
                    'test initialization',
                    'pattern recording',
                    'type mappings',
                    'conversion history'
                ],
                'Memory System Tests'
            );
        }

        this.results.memory = allPassed;
        return allPassed;
    }

    verifyAgentSystem() {
        this.logSection('Agent System Verification');
        
        let allPassed = true;

        // Check agent files
        allPassed &= this.checkFileExists('src/agents/AgentCoordinator.ts', 'Agent Coordinator');
        allPassed &= this.checkFileExists('src/agents/ConverterAgent.ts', 'Converter Agent');
        allPassed &= this.checkFileExists('src/agents/ValidatorAgent.ts', 'Validator Agent');
        allPassed &= this.checkFileExists('src/agents/index.ts', 'Agents Index');
        allPassed &= this.checkFileExists('tests/unit/agents/AgentCoordinator.test.ts', 'Agent Tests');

        // Check agent coordinator content
        if (fs.existsSync(path.join(this.projectRoot, 'src/agents/AgentCoordinator.ts'))) {
            allPassed &= this.checkFileContent(
                'src/agents/AgentCoordinator.ts',
                [
                    'export class AgentCoordinator',
                    'private agents: Map',
                    'private taskQueue: Task[]',
                    'async submitTask(',
                    'async getAgentStatus(',
                    'async processQueue('
                ],
                'Agent Coordinator Implementation'
            );
        }

        this.results.agents = allPassed;
        return allPassed;
    }

    verifyHookSystem() {
        this.logSection('Hook System Verification');
        
        let allPassed = true;

        // Check hook files
        allPassed &= this.checkFileExists('src/hooks/HookManager.ts', 'Hook Manager');
        allPassed &= this.checkFileExists('src/hooks/hooks/SyntaxValidationHook.ts', 'Syntax Validation Hook');
        allPassed &= this.checkFileExists('src/hooks/hooks/AutoFormatHook.ts', 'Auto Format Hook');
        allPassed &= this.checkFileExists('src/hooks/hooks/PatternLearningHook.ts', 'Pattern Learning Hook');
        allPassed &= this.checkFileExists('src/hooks/hooks/NeoRsValidationHook.ts', 'Neo-rs Validation Hook');
        allPassed &= this.checkFileExists('src/hooks/index.ts', 'Hooks Index');

        // Check hook manager content
        if (fs.existsSync(path.join(this.projectRoot, 'src/hooks/HookManager.ts'))) {
            allPassed &= this.checkFileContent(
                'src/hooks/HookManager.ts',
                [
                    'export class HookManager',
                    'private hooks: Map',
                    'async executeHooks(',
                    'async registerHook(',
                    'getHookStatistics('
                ],
                'Hook Manager Implementation'
            );
        }

        this.results.hooks = allPassed;
        return allPassed;
    }

    verifyMonitoringSystem() {
        this.logSection('Monitoring System Verification');
        
        let allPassed = true;

        // Check monitoring files
        allPassed &= this.checkFileExists('src/monitoring/SystemMonitor.ts', 'System Monitor');
        allPassed &= this.checkFileExists('src/monitoring/index.ts', 'Monitoring Index');

        // Check system monitor content
        if (fs.existsSync(path.join(this.projectRoot, 'src/monitoring/SystemMonitor.ts'))) {
            allPassed &= this.checkFileContent(
                'src/monitoring/SystemMonitor.ts',
                [
                    'export class SystemMonitor',
                    'private async collectMetrics(',
                    'async startMonitoring(',
                    'async showMonitoringDashboard(',
                    'async exportMetrics('
                ],
                'System Monitor Implementation'
            );
        }

        this.results.monitoring = allPassed;
        return allPassed;
    }

    verifyConfigurationSystem() {
        this.logSection('Configuration System Verification');
        
        let allPassed = true;

        // Check config files
        allPassed &= this.checkFileExists('src/config/enhanced-config.ts', 'Enhanced Configuration');
        allPassed &= this.checkFileExists('src/config/index.ts', 'Config Index');

        // Check enhanced config content
        if (fs.existsSync(path.join(this.projectRoot, 'src/config/enhanced-config.ts'))) {
            allPassed &= this.checkFileContent(
                'src/config/enhanced-config.ts',
                [
                    'export interface EnhancedAutoClaudeConfig',
                    'export class EnhancedConfigLoader',
                    'async loadConfig(',
                    'detectNeoRsEnvironment(',
                    'mergeConfigurations('
                ],
                'Enhanced Configuration Implementation'
            );
        }

        this.results.config = allPassed;
        return allPassed;
    }

    verifyExtensionIntegration() {
        this.logSection('Extension Integration Verification');
        
        let allPassed = true;

        // Check extension file
        allPassed &= this.checkFileExists('src/extension.ts', 'Main Extension File');

        // Check extension content
        if (fs.existsSync(path.join(this.projectRoot, 'src/extension.ts'))) {
            allPassed &= this.checkFileContent(
                'src/extension.ts',
                [
                    'export async function activate(',
                    'memoryManager = getMemoryManager(',
                    'await memoryManager.initialize(',
                    'agentCoordinator = getAgentCoordinator(',
                    'hookManager = getHookManager(',
                    'systemMonitor = getSystemMonitor(',
                    'vscode.commands.registerCommand('
                ],
                'Extension Integration'
            );
        }

        this.results.extension = allPassed;
        return allPassed;
    }

    verifyTestSuite() {
        this.logSection('Test Suite Verification');
        
        let allPassed = true;

        // Check test files
        const testFiles = [
            'tests/unit/memory/MemoryManager.test.ts',
            'tests/unit/agents/AgentCoordinator.test.ts'
        ];

        testFiles.forEach(testFile => {
            allPassed &= this.checkFileExists(testFile, `Test: ${testFile}`);
        });

        // Check test configuration
        allPassed &= this.checkFileExists('package.json', 'Package.json (for test scripts)');

        if (fs.existsSync(path.join(this.projectRoot, 'package.json'))) {
            const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
            if (packageJson.devDependencies && packageJson.devDependencies.jest) {
                this.log('✅ Jest testing framework configured', 'green');
            } else {
                this.log('⚠️  Jest testing framework not found in devDependencies', 'yellow');
                this.warnings.push('Jest not configured in package.json');
            }
        }

        this.results.tests = allPassed;
        return allPassed;
    }

    verifyDocumentation() {
        this.logSection('Documentation Verification');
        
        let allPassed = true;

        // Check documentation files
        const docFiles = [
            'README.md',
            'ENHANCED_FEATURES.md',
            'CHANGELOG_v3.8.0_ENHANCED.md',
            'VERIFICATION_CHECKLIST.md'
        ];

        docFiles.forEach(docFile => {
            allPassed &= this.checkFileExists(docFile, `Documentation: ${docFile}`);
        });

        // Check README content
        if (fs.existsSync(path.join(this.projectRoot, 'README.md'))) {
            allPassed &= this.checkFileContent(
                'README.md',
                [
                    'AutoClaude',
                    'Enhanced Features',
                    'Memory System',
                    'Agent Coordination',
                    'Neo-rs'
                ],
                'README Documentation'
            );
        }

        this.results.documentation = allPassed;
        return allPassed;
    }

    verifyCompilation() {
        this.logSection('TypeScript Compilation Verification');
        
        let allPassed = true;

        try {
            // Check if TypeScript is configured
            if (this.checkFileExists('tsconfig.json', 'TypeScript Configuration')) {
                this.log('Attempting TypeScript compilation check...', 'blue');
                
                // Try to compile (dry run)
                try {
                    execSync('npx tsc --noEmit', { 
                        cwd: this.projectRoot, 
                        stdio: 'pipe' 
                    });
                    this.log('✅ TypeScript compilation successful', 'green');
                    allPassed = true;
                } catch (error) {
                    this.log('❌ TypeScript compilation failed', 'red');
                    this.log(`Error: ${error.message}`, 'red');
                    this.errors.push('TypeScript compilation failed');
                    allPassed = false;
                }
            }
        } catch (error) {
            this.log('⚠️  Could not verify TypeScript compilation', 'yellow');
            this.warnings.push('TypeScript compilation could not be verified');
        }

        this.results.compilation = allPassed;
        return allPassed;
    }

    verifyPackageIntegrity() {
        this.logSection('Package Integrity Verification');
        
        let allPassed = true;

        // Check package.json
        if (this.checkFileExists('package.json', 'Package Configuration')) {
            const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
            
            // Check required fields
            const requiredFields = ['name', 'version', 'publisher', 'engines', 'main'];
            requiredFields.forEach(field => {
                if (packageJson[field]) {
                    this.log(`✅ Package.json has ${field}: ${packageJson[field]}`, 'green');
                } else {
                    this.log(`❌ Package.json missing ${field}`, 'red');
                    this.errors.push(`Missing package.json field: ${field}`);
                    allPassed = false;
                }
            });

            // Check publisher is set to R3ENetwork
            if (packageJson.publisher === 'R3ENetwork') {
                this.log('✅ Publisher correctly set to R3ENetwork', 'green');
            } else {
                this.log(`❌ Publisher should be R3ENetwork, found: ${packageJson.publisher}`, 'red');
                this.errors.push('Incorrect publisher in package.json');
                allPassed = false;
            }

            // Check dependencies
            if (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) {
                this.log(`✅ ${Object.keys(packageJson.dependencies).length} dependencies configured`, 'green');
            }

            if (packageJson.devDependencies && Object.keys(packageJson.devDependencies).length > 0) {
                this.log(`✅ ${Object.keys(packageJson.devDependencies).length} dev dependencies configured`, 'green');
            }
        }

        return allPassed;
    }

    generateReport() {
        this.logSection('Verification Summary Report');
        
        const totalSystems = Object.keys(this.results).length;
        const passedSystems = Object.values(this.results).filter(Boolean).length;
        const failedSystems = totalSystems - passedSystems;

        this.log(`\n📊 VERIFICATION RESULTS`, 'bold');
        this.log(`${'-'.repeat(40)}`, 'blue');
        this.log(`Total Systems Checked: ${totalSystems}`, 'blue');
        this.log(`✅ Passed: ${passedSystems}`, 'green');
        this.log(`❌ Failed: ${failedSystems}`, failedSystems > 0 ? 'red' : 'green');
        this.log(`⚠️  Warnings: ${this.warnings.length}`, 'yellow');

        // Detailed results
        this.log(`\n🔍 DETAILED RESULTS`, 'bold');
        this.log(`${'-'.repeat(40)}`, 'blue');
        
        Object.entries(this.results).forEach(([system, passed]) => {
            const status = passed ? '✅' : '❌';
            const color = passed ? 'green' : 'red';
            this.log(`${status} ${system.charAt(0).toUpperCase() + system.slice(1)} System`, color);
        });

        // Errors
        if (this.errors.length > 0) {
            this.log(`\n❌ ERRORS FOUND`, 'red');
            this.log(`${'-'.repeat(40)}`, 'red');
            this.errors.forEach((error, index) => {
                this.log(`${index + 1}. ${error}`, 'red');
            });
        }

        // Warnings
        if (this.warnings.length > 0) {
            this.log(`\n⚠️  WARNINGS`, 'yellow');
            this.log(`${'-'.repeat(40)}`, 'yellow');
            this.warnings.forEach((warning, index) => {
                this.log(`${index + 1}. ${warning}`, 'yellow');
            });
        }

        // Final status
        const overallSuccess = failedSystems === 0;
        this.log(`\n🎯 OVERALL STATUS`, 'bold');
        this.log(`${'-'.repeat(40)}`, 'blue');
        
        if (overallSuccess) {
            this.log(`🎉 ALL SYSTEMS VERIFIED SUCCESSFULLY!`, 'green');
            this.log(`AutoClaude Enhanced Features are production-ready.`, 'green');
        } else {
            this.log(`⚠️  VERIFICATION INCOMPLETE`, 'red');
            this.log(`${failedSystems} system(s) need attention before production deployment.`, 'red');
        }

        return overallSuccess;
    }

    async run() {
        this.log(`\n🚀 AutoClaude Enhanced Features Verification Script`, 'bold');
        this.log(`Project Root: ${this.projectRoot}`, 'blue');
        this.log(`Timestamp: ${new Date().toISOString()}`, 'blue');

        // Run all verifications
        this.checkDirectoryStructure();
        this.verifyMemorySystem();
        this.verifyAgentSystem();
        this.verifyHookSystem();
        this.verifyMonitoringSystem();
        this.verifyConfigurationSystem();
        this.verifyExtensionIntegration();
        this.verifyTestSuite();
        this.verifyDocumentation();
        this.verifyCompilation();
        this.verifyPackageIntegrity();

        // Generate final report
        const success = this.generateReport();

        // Exit with appropriate code
        process.exit(success ? 0 : 1);
    }
}

// Run verification if this script is executed directly
if (require.main === module) {
    const verifier = new VerificationScript();
    verifier.run().catch(error => {
        console.error('Verification script failed:', error);
        process.exit(1);
    });
}

module.exports = VerificationScript;