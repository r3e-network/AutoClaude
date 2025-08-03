import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface NeoRsContext {
    csharpSourcePath: string;
    rustProjectPath: string;
    components: Map<string, ComponentInfo>;
    validationResults: ValidationResults;
}

export interface ComponentInfo {
    name: string;
    csharpPath: string;
    rustPath: string;
    isImplemented: boolean;
    hasAllTests: boolean;
    isProductionReady: boolean;
    missingFeatures: string[];
    unconvertedTests: string[];
}

export interface ValidationResults {
    hasPlaceholders: boolean;
    placeholderLocations: PlaceholderLocation[];
    testCoverage: number;
    missingTests: string[];
    functionalDiscrepancies: Discrepancy[];
    isProductionReady: boolean;
}

export interface PlaceholderLocation {
    file: string;
    line: number;
    type: string;
    content: string;
}

export interface Discrepancy {
    component: string;
    csharpBehavior: string;
    rustBehavior: string;
    severity: 'error' | 'warning';
}

export class NeoRsContextManager {
    private context: NeoRsContext;
    private config: any;

    constructor(private workspaceRoot: string) {
        this.loadConfiguration();
        this.initializeContext();
    }

    private loadConfiguration() {
        const configPath = path.join(this.workspaceRoot, 'neo-rs-config.json');
        if (fs.existsSync(configPath)) {
            this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } else {
            throw new Error('neo-rs-config.json not found');
        }
    }

    private initializeContext() {
        this.context = {
            csharpSourcePath: path.join(this.workspaceRoot, this.config.csharpSourcePath),
            rustProjectPath: path.join(this.workspaceRoot, this.config.rustProjectPath),
            components: new Map(),
            validationResults: {
                hasPlaceholders: false,
                placeholderLocations: [],
                testCoverage: 0,
                missingTests: [],
                functionalDiscrepancies: [],
                isProductionReady: false
            }
        };

        // Initialize components
        for (const [name, info] of Object.entries(this.config.components)) {
            this.context.components.set(name, {
                name,
                csharpPath: (info as any).csharpPath,
                rustPath: (info as any).rustPath,
                isImplemented: false,
                hasAllTests: false,
                isProductionReady: false,
                missingFeatures: [],
                unconvertedTests: []
            });
        }
    }

    async analyzeProject(): Promise<void> {
        vscode.window.showInformationMessage('Analyzing Neo-rs project structure...');
        
        // Analyze each component
        for (const [name, component] of this.context.components) {
            await this.analyzeComponent(component);
        }

        // Run validation checks
        await this.validateProductionReadiness();
        await this.checkTestCoverage();
        await this.findPlaceholders();
    }

    private async analyzeComponent(component: ComponentInfo): Promise<void> {
        const rustPath = path.join(this.workspaceRoot, component.rustPath);
        const csharpPath = path.join(this.workspaceRoot, component.csharpPath);

        // Check if Rust implementation exists
        component.isImplemented = fs.existsSync(rustPath);

        if (component.isImplemented) {
            // Analyze Rust implementation
            await this.analyzeRustImplementation(component, rustPath);
        }

        // Analyze C# source to find what needs to be implemented
        if (fs.existsSync(csharpPath)) {
            await this.analyzeCsharpSource(component, csharpPath);
        }
    }

    private async analyzeRustImplementation(component: ComponentInfo, rustPath: string): Promise<void> {
        // Check for placeholders
        const placeholders = await this.scanForPlaceholders(rustPath);
        if (placeholders.length > 0) {
            component.isProductionReady = false;
            this.context.validationResults.hasPlaceholders = true;
            this.context.validationResults.placeholderLocations.push(...placeholders);
        }

        // Check test coverage
        const testFiles = await this.findTestFiles(rustPath);
        component.hasAllTests = testFiles.length > 0; // This is simplified, should compare with C#
    }

    private async analyzeCsharpSource(component: ComponentInfo, csharpPath: string): Promise<void> {
        // Find all C# test files
        const csharpTests = await this.findCsharpTests(csharpPath);
        
        // Check which tests are missing in Rust
        for (const test of csharpTests) {
            const rustEquivalent = await this.findRustTestEquivalent(test, component.rustPath);
            if (!rustEquivalent) {
                component.unconvertedTests.push(test);
            }
        }
    }

    private async scanForPlaceholders(directory: string): Promise<PlaceholderLocation[]> {
        const placeholders: PlaceholderLocation[] = [];
        const patterns = this.config.validationRules.noPlaceholders.patterns;
        
        // Recursively scan directory for placeholder patterns
        const files = await this.getFilesRecursively(directory, ['.rs']);
        
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            
            lines.forEach((line, index) => {
                for (const pattern of patterns) {
                    if (line.includes(pattern)) {
                        placeholders.push({
                            file: path.relative(this.workspaceRoot, file),
                            line: index + 1,
                            type: pattern,
                            content: line.trim()
                        });
                    }
                }
            });
        }
        
        return placeholders;
    }

    private async findTestFiles(directory: string): Promise<string[]> {
        if (!fs.existsSync(directory)) return [];
        
        const testFiles: string[] = [];
        const files = await this.getFilesRecursively(directory, ['.rs']);
        
        for (const file of files) {
            if (file.includes('test') || file.includes('tests')) {
                testFiles.push(file);
            }
        }
        
        return testFiles;
    }

    private async findCsharpTests(directory: string): Promise<string[]> {
        if (!fs.existsSync(directory)) return [];
        
        const testFiles: string[] = [];
        const files = await this.getFilesRecursively(directory, ['.cs']);
        
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            if (content.includes('[TestMethod]') || content.includes('[Test]') || content.includes('[Fact]')) {
                testFiles.push(file);
            }
        }
        
        return testFiles;
    }

    private async findRustTestEquivalent(csharpTest: string, rustPath: string): Promise<string | null> {
        // This is a simplified implementation
        // In reality, we'd parse the C# test name and look for equivalent Rust test
        const testName = path.basename(csharpTest, '.cs');
        const rustTestName = testName.toLowerCase().replace(/test/i, '_test');
        
        const possiblePaths = [
            path.join(rustPath, 'tests', `${rustTestName}.rs`),
            path.join(rustPath, 'src', 'tests', `${rustTestName}.rs`),
            path.join(rustPath, 'src', 'lib.rs') // inline tests
        ];
        
        for (const testPath of possiblePaths) {
            if (fs.existsSync(testPath)) {
                return testPath;
            }
        }
        
        return null;
    }

    private async validateProductionReadiness(): Promise<void> {
        let isReady = true;
        
        // Check all components
        for (const [name, component] of this.context.components) {
            if (!component.isImplemented || !component.hasAllTests || !component.isProductionReady) {
                isReady = false;
                break;
            }
        }
        
        // Check for placeholders
        if (this.context.validationResults.hasPlaceholders) {
            isReady = false;
        }
        
        // Check test coverage
        if (this.context.validationResults.testCoverage < this.config.validationRules.testCoverage.minimum) {
            isReady = false;
        }
        
        this.context.validationResults.isProductionReady = isReady;
    }

    private async checkTestCoverage(): Promise<void> {
        // This would integrate with cargo-tarpaulin or similar
        // For now, we'll use a simplified approach
        let totalTests = 0;
        let implementedTests = 0;
        
        for (const [name, component] of this.context.components) {
            const csharpTests = await this.findCsharpTests(
                path.join(this.workspaceRoot, component.csharpPath)
            );
            totalTests += csharpTests.length;
            implementedTests += csharpTests.length - component.unconvertedTests.length;
        }
        
        this.context.validationResults.testCoverage = 
            totalTests > 0 ? (implementedTests / totalTests) * 100 : 0;
    }

    private async findPlaceholders(): Promise<void> {
        this.context.validationResults.placeholderLocations = [];
        
        for (const [name, component] of this.context.components) {
            if (component.isImplemented) {
                const placeholders = await this.scanForPlaceholders(
                    path.join(this.workspaceRoot, component.rustPath)
                );
                this.context.validationResults.placeholderLocations.push(...placeholders);
            }
        }
        
        this.context.validationResults.hasPlaceholders = 
            this.context.validationResults.placeholderLocations.length > 0;
    }

    private async getFilesRecursively(directory: string, extensions: string[]): Promise<string[]> {
        const files: string[] = [];
        
        if (!fs.existsSync(directory)) {
            return files;
        }
        
        const items = fs.readdirSync(directory);
        
        for (const item of items) {
            const fullPath = path.join(directory, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && item !== 'target' && item !== 'node_modules') {
                files.push(...await this.getFilesRecursively(fullPath, extensions));
            } else if (stat.isFile()) {
                const ext = path.extname(item);
                if (extensions.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
        
        return files;
    }

    getContext(): NeoRsContext {
        return this.context;
    }

    getValidationReport(): string {
        const report: string[] = ['Neo-rs Validation Report', '=======================', ''];
        
        // Overall status
        report.push(`Production Ready: ${this.context.validationResults.isProductionReady ? '✅' : '❌'}`);
        report.push(`Test Coverage: ${this.context.validationResults.testCoverage.toFixed(2)}%`);
        report.push(`Has Placeholders: ${this.context.validationResults.hasPlaceholders ? '❌' : '✅'}`);
        report.push('');
        
        // Component status
        report.push('Component Status:');
        for (const [name, component] of this.context.components) {
            const status = component.isProductionReady ? '✅' : '❌';
            report.push(`  ${name}: ${status}`);
            if (component.unconvertedTests.length > 0) {
                report.push(`    - ${component.unconvertedTests.length} unconverted tests`);
            }
            if (component.missingFeatures.length > 0) {
                report.push(`    - ${component.missingFeatures.length} missing features`);
            }
        }
        report.push('');
        
        // Placeholders
        if (this.context.validationResults.placeholderLocations.length > 0) {
            report.push('Placeholders Found:');
            for (const placeholder of this.context.validationResults.placeholderLocations.slice(0, 10)) {
                report.push(`  ${placeholder.file}:${placeholder.line} - ${placeholder.type}`);
            }
            if (this.context.validationResults.placeholderLocations.length > 10) {
                report.push(`  ... and ${this.context.validationResults.placeholderLocations.length - 10} more`);
            }
        }
        
        return report.join('\n');
    }
}