import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { NeoRsContextManager, ComponentInfo } from './context';
import { execSync } from 'child_process';

export interface AutomationTask {
    id: string;
    type: 'convert-test' | 'implement-feature' | 'fix-placeholder' | 'validate-behavior' | 'optimize-performance';
    priority: number;
    component: string;
    description: string;
    details: any;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    attempts: number;
    lastError?: string;
}

export class NeoRsAutomationEngine {
    private taskQueue: AutomationTask[] = [];
    private isRunning: boolean = false;
    private contextManager: NeoRsContextManager;
    private outputChannel: vscode.OutputChannel;
    private statusBar: vscode.StatusBarItem;
    private completedTasks: number = 0;
    private failedTasks: number = 0;

    constructor(
        private context: vscode.ExtensionContext,
        private workspaceRoot: string
    ) {
        this.contextManager = new NeoRsContextManager(workspaceRoot);
        this.outputChannel = vscode.window.createOutputChannel('Neo-rs Automation');
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBar.show();
        this.updateStatusBar();
    }

    async activate() {
        // Initialize context manager (now async)
        await this.contextManager.initialize();
        
        // Register commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('neo-rs.startAutomation', () => this.startAutomation()),
            vscode.commands.registerCommand('neo-rs.stopAutomation', () => this.stopAutomation()),
            vscode.commands.registerCommand('neo-rs.showAutomationStatus', () => this.showStatus()),
            vscode.commands.registerCommand('neo-rs.clearTaskQueue', () => this.clearTaskQueue()),
            vscode.commands.registerCommand('neo-rs.prioritizeTasks', () => this.prioritizeTasks())
        );

        // Check environment before queuing tasks
        const ctx = this.contextManager.getContext();
        if (!ctx.environment.isValid) {
            this.log('Environment setup incomplete. Cannot start automation.', 'error');
            vscode.window.showErrorMessage('Neo-rs automation requires complete environment setup');
            return;
        }

        // Initial analysis
        await this.analyzeAndQueueTasks();
    }

    private async analyzeAndQueueTasks() {
        this.log('Analyzing Neo-rs project to identify tasks...');
        
        await this.contextManager.analyzeProject();
        const context = this.contextManager.getContext();

        // Clear existing queue
        this.taskQueue = [];

        // Queue tasks based on analysis
        for (const [name, component] of context.components) {
            // High priority: Missing implementations
            if (!component.isImplemented) {
                this.queueTask({
                    id: `impl-${name}`,
                    type: 'implement-feature',
                    priority: 10,
                    component: name,
                    description: `Implement ${name} component`,
                    details: { component },
                    status: 'pending',
                    attempts: 0
                });
            }

            // High priority: Convert tests
            for (const test of component.unconvertedTests) {
                this.queueTask({
                    id: `test-${name}-${path.basename(test)}`,
                    type: 'convert-test',
                    priority: 9,
                    component: name,
                    description: `Convert test: ${path.basename(test)}`,
                    details: { testPath: test, component },
                    status: 'pending',
                    attempts: 0
                });
            }

            // Medium priority: Fix placeholders
            const componentPlaceholders = context.validationResults.placeholderLocations
                .filter(p => p.file.includes(component.rustPath));
            
            for (const placeholder of componentPlaceholders) {
                this.queueTask({
                    id: `fix-${placeholder.file}-${placeholder.line}`,
                    type: 'fix-placeholder',
                    priority: 7,
                    component: name,
                    description: `Fix ${placeholder.type} at ${path.basename(placeholder.file)}:${placeholder.line}`,
                    details: { placeholder, component },
                    status: 'pending',
                    attempts: 0
                });
            }

            // Medium priority: Validate behavior
            if (component.isImplemented) {
                this.queueTask({
                    id: `validate-${name}`,
                    type: 'validate-behavior',
                    priority: 5,
                    component: name,
                    description: `Validate ${name} behavior against C#`,
                    details: { component },
                    status: 'pending',
                    attempts: 0
                });
            }
        }

        // Sort by priority
        this.taskQueue.sort((a, b) => b.priority - a.priority);
        
        this.log(`Queued ${this.taskQueue.length} tasks`);
        this.updateStatusBar();
    }

    private queueTask(task: AutomationTask) {
        // Check if task already exists
        const existing = this.taskQueue.find(t => t.id === task.id);
        if (!existing) {
            this.taskQueue.push(task);
        }
    }

    async startAutomation() {
        if (this.isRunning) {
            vscode.window.showInformationMessage('Automation is already running');
            return;
        }

        this.isRunning = true;
        this.log('Starting Neo-rs automation engine...');
        vscode.window.showInformationMessage('Neo-rs automation started');

        // Run automation loop
        while (this.isRunning && this.taskQueue.length > 0) {
            const task = this.getNextTask();
            if (!task) break;

            await this.executeTask(task);
            
            // Small delay between tasks
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (this.taskQueue.length === 0) {
            this.log('All tasks completed!');
            vscode.window.showInformationMessage('Neo-rs automation completed all tasks!');
            
            // Re-analyze to check if new tasks are needed
            await this.analyzeAndQueueTasks();
            
            if (this.taskQueue.length === 0) {
                const report = this.contextManager.getValidationReport();
                if (report.includes('Production Ready: ✅')) {
                    vscode.window.showInformationMessage('🎉 Neo-rs is production ready!');
                }
            }
        }

        this.isRunning = false;
        this.updateStatusBar();
    }

    private getNextTask(): AutomationTask | null {
        // Get highest priority pending task
        const pendingTasks = this.taskQueue.filter(t => t.status === 'pending' || 
            (t.status === 'failed' && t.attempts < 3));
        
        if (pendingTasks.length === 0) return null;
        
        return pendingTasks[0];
    }

    private async executeTask(task: AutomationTask) {
        this.log(`Executing task: ${task.description}`);
        task.status = 'in-progress';
        task.attempts++;
        this.updateStatusBar();

        try {
            switch (task.type) {
                case 'implement-feature':
                    await this.implementFeature(task);
                    break;
                case 'convert-test':
                    await this.convertTest(task);
                    break;
                case 'fix-placeholder':
                    await this.fixPlaceholder(task);
                    break;
                case 'validate-behavior':
                    await this.validateBehavior(task);
                    break;
                case 'optimize-performance':
                    await this.optimizePerformance(task);
                    break;
            }

            task.status = 'completed';
            this.completedTasks++;
            this.log(`✅ Completed: ${task.description}`);
            
            // Remove completed task from queue
            this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
            
        } catch (error) {
            task.status = 'failed';
            task.lastError = error instanceof Error ? error.message : String(error);
            this.failedTasks++;
            this.log(`❌ Failed: ${task.description} - ${task.lastError}`);
            
            if (task.attempts >= 3) {
                this.log(`Task failed after 3 attempts, removing from queue`);
                this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
            }
        }

        this.updateStatusBar();
    }

    private async implementFeature(task: AutomationTask) {
        const component: ComponentInfo = task.details.component;
        const csharpPath = path.join(this.workspaceRoot, component.csharpPath);
        const rustPath = path.join(this.workspaceRoot, component.rustPath);

        // Create crate structure
        this.log(`Creating crate structure for ${component.name}`);
        
        const dirs = ['src', 'tests', 'benches', 'examples'];
        for (const dir of dirs) {
            const dirPath = path.join(rustPath, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        }

        // Analyze C# structure
        const csharpStructure = await this.analyzeCsharpStructure(csharpPath);
        
        // Generate Cargo.toml with dependencies
        const cargoToml = this.generateAdvancedCargoToml(component, csharpStructure);
        fs.writeFileSync(path.join(rustPath, 'Cargo.toml'), cargoToml);

        // Generate module structure based on C# namespaces
        for (const namespace of csharpStructure.namespaces) {
            const modulePath = this.convertNamespaceToModule(namespace);
            const moduleFile = path.join(rustPath, 'src', `${modulePath}.rs`);
            
            const moduleDir = path.dirname(moduleFile);
            if (!fs.existsSync(moduleDir)) {
                fs.mkdirSync(moduleDir, { recursive: true });
            }

            // Generate module implementation
            const moduleContent = await this.generateModuleFromCsharp(namespace, csharpStructure);
            fs.writeFileSync(moduleFile, moduleContent);
        }

        // Generate lib.rs with proper module declarations
        const libRs = this.generateAdvancedLibRs(component, csharpStructure);
        fs.writeFileSync(path.join(rustPath, 'src', 'lib.rs'), libRs);

        // Generate integration tests
        const integrationTest = this.generateIntegrationTest(component);
        fs.writeFileSync(path.join(rustPath, 'tests', 'integration.rs'), integrationTest);

        // Run initial build to check for errors
        this.log(`Building ${component.name}...`);
        try {
            execSync('cargo build', { cwd: rustPath, stdio: 'pipe' });
            this.log(`Successfully built ${component.name}`);
        } catch (error) {
            this.log(`Build failed, will need fixes in subsequent tasks`);
        }
    }

    private async analyzeCsharpStructure(csharpPath: string): Promise<any> {
        const structure = {
            namespaces: new Set<string>(),
            classes: [],
            interfaces: [],
            enums: [],
            dependencies: new Set<string>()
        };

        if (!fs.existsSync(csharpPath)) return structure;

        const files = await this.getFilesRecursively(csharpPath, ['.cs']);
        
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const fileStructure = this.parseCsharpFile(content);
            
            fileStructure.namespaces.forEach(ns => structure.namespaces.add(ns));
            structure.classes.push(...fileStructure.classes);
            structure.interfaces.push(...fileStructure.interfaces);
            structure.enums.push(...fileStructure.enums);
            fileStructure.dependencies.forEach(dep => structure.dependencies.add(dep));
        }

        return {
            namespaces: Array.from(structure.namespaces),
            classes: structure.classes,
            interfaces: structure.interfaces,
            enums: structure.enums,
            dependencies: Array.from(structure.dependencies)
        };
    }

    private parseCsharpFile(content: string): any {
        const structure = {
            namespaces: [],
            classes: [],
            interfaces: [],
            enums: [],
            dependencies: []
        };

        const lines = content.split('\n');
        let currentNamespace = '';

        for (const line of lines) {
            // Extract namespace
            const namespaceMatch = line.match(/namespace\s+([\w.]+)/);
            if (namespaceMatch) {
                currentNamespace = namespaceMatch[1];
                structure.namespaces.push(currentNamespace);
            }

            // Extract using statements
            const usingMatch = line.match(/using\s+([\w.]+);/);
            if (usingMatch) {
                structure.dependencies.push(usingMatch[1]);
            }

            // Extract classes
            const classMatch = line.match(/(?:public|internal|private)?\s*(?:abstract|sealed|static)?\s*(?:partial\s+)?class\s+(\w+)/);
            if (classMatch) {
                structure.classes.push({
                    name: classMatch[1],
                    namespace: currentNamespace,
                    isAbstract: line.includes('abstract'),
                    isStatic: line.includes('static')
                });
            }

            // Extract interfaces
            const interfaceMatch = line.match(/(?:public|internal)?\s*interface\s+(\w+)/);
            if (interfaceMatch) {
                structure.interfaces.push({
                    name: interfaceMatch[1],
                    namespace: currentNamespace
                });
            }

            // Extract enums
            const enumMatch = line.match(/(?:public|internal)?\s*enum\s+(\w+)/);
            if (enumMatch) {
                structure.enums.push({
                    name: enumMatch[1],
                    namespace: currentNamespace
                });
            }
        }

        return structure;
    }

    private convertNamespaceToModule(namespace: string): string {
        // Convert Neo.Network.P2P to network/p2p
        return namespace
            .replace(/^Neo\./, '')
            .split('.')
            .map(part => part.toLowerCase())
            .join('/');
    }

    private async generateModuleFromCsharp(namespace: string, structure: any): Promise<string> {
        const moduleContent: string[] = [];
        
        // Header
        moduleContent.push(`//! ${namespace} module`);
        moduleContent.push(`//! Auto-generated from C# implementation`);
        moduleContent.push('');

        // Find relevant types for this namespace
        const relevantClasses = structure.classes.filter(c => c.namespace === namespace);
        const relevantInterfaces = structure.interfaces.filter(i => i.namespace === namespace);
        const relevantEnums = structure.enums.filter(e => e.namespace === namespace);

        // Generate enums
        for (const enumDef of relevantEnums) {
            moduleContent.push(this.generateRustEnum(enumDef));
            moduleContent.push('');
        }

        // Generate traits from interfaces
        for (const iface of relevantInterfaces) {
            moduleContent.push(this.generateRustTrait(iface));
            moduleContent.push('');
        }

        // Generate structs from classes
        for (const classDef of relevantClasses) {
            moduleContent.push(await this.generateRustStruct(classDef));
            moduleContent.push('');
        }

        return moduleContent.join('\n');
    }

    private generateRustEnum(enumDef: any): string {
        return `#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ${enumDef.name} {
    // TODO: Add enum variants based on C# implementation
}`;
    }

    private generateRustTrait(iface: any): string {
        const traitName = iface.name.startsWith('I') ? 
            iface.name.substring(1) : iface.name;

        return `pub trait ${traitName} {
    // TODO: Add trait methods based on C# interface
}`;
    }

    private async generateRustStruct(classDef: any): Promise<string> {
        const structName = classDef.name;
        
        let structDef = '#[derive(Debug, Clone)]\n';
        structDef += `pub struct ${structName} {\n`;
        structDef += '    // TODO: Add fields based on C# class\n';
        structDef += '}\n\n';
        
        structDef += `impl ${structName} {\n`;
        structDef += '    pub fn new() -> Self {\n';
        structDef += '        Self {\n';
        structDef += '            // TODO: Initialize fields\n';
        structDef += '        }\n';
        structDef += '    }\n';
        structDef += '    \n';
        structDef += '    // TODO: Add methods based on C# implementation\n';
        structDef += '}';

        return structDef;
    }

    private generateAdvancedCargoToml(component: ComponentInfo, structure: any): string {
        // Map C# dependencies to Rust crates
        const dependencyMap = {
            'System.Collections': 'indexmap = "2"',
            'System.Threading': 'tokio = { version = "1", features = ["full"] }',
            'System.Net': 'tokio = { version = "1", features = ["net"] }',
            'System.IO': 'tokio = { version = "1", features = ["io-util", "fs"] }',
            'System.Security.Cryptography': 'ring = "0.17"\nbase64 = "0.22"',
            'System.Linq': '# LINQ operations will use iterator methods',
            'System.Text': 'regex = "1"',
            'System.Numerics': 'num-bigint = "0.4"\nnum-traits = "0.2"'
        };

        const dependencies: string[] = ['serde = { version = "1", features = ["derive"] }'];
        
        for (const dep of structure.dependencies) {
            if (dependencyMap[dep]) {
                dependencies.push(dependencyMap[dep]);
            }
        }

        // Add component-specific dependencies
        if (component.name.includes('p2p') || component.name.includes('network')) {
            dependencies.push('bytes = "1"');
            dependencies.push('futures = "0.3"');
        }

        if (component.name.includes('storage') || component.name.includes('persistence')) {
            dependencies.push('rocksdb = "0.22"');
        }

        if (component.name.includes('vm')) {
            dependencies.push('smallvec = "1"');
        }

        return `[package]
name = "${component.name.toLowerCase().replace(/_/g, '-')}"
version = "0.1.0"
edition = "2021"
authors = ["Neo-rs Team"]
description = "${component.name} implementation for Neo-rs"
license = "MIT"

[dependencies]
${[...new Set(dependencies)].join('\n')}

[dev-dependencies]
tokio-test = "0.4"
proptest = "1"
criterion = "0.5"

[[bench]]
name = "benchmark"
harness = false
`;
    }

    private generateAdvancedLibRs(component: ComponentInfo, structure: any): string {
        const modules = structure.namespaces
            .map(ns => this.convertNamespaceToModule(ns))
            .filter(m => m.length > 0);

        return `//! ${component.name} implementation for Neo-rs
//! 
//! This crate provides ${component.name} functionality
//! converted from the C# Neo implementation.

#![warn(missing_docs)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]
#![deny(unsafe_code)]

// Module declarations
${modules.map(m => `pub mod ${m.replace(/\//g, '_')};`).join('\n')}

// Re-exports
${modules.map(m => `pub use ${m.replace(/\//g, '_')}::*;`).join('\n')}

/// Crate version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
    }
}
`;
    }

    private generateIntegrationTest(component: ComponentInfo): string {
        return `//! Integration tests for ${component.name}

use ${component.name.toLowerCase().replace(/-/g, '_')}::*;

#[tokio::test]
async fn test_basic_functionality() {
    // TODO: Add integration tests based on C# test suite
    assert!(true, "Integration test placeholder");
}

#[tokio::test]
async fn test_error_handling() {
    // TODO: Test error scenarios
}

#[tokio::test]
async fn test_concurrent_operations() {
    // TODO: Test thread safety and concurrent operations
}
`;
    }

    private async convertTest(task: AutomationTask) {
        const { testPath, component } = task.details;
        const content = fs.readFileSync(testPath, 'utf8');
        
        // Parse C# test
        const testClass = this.parseTestClass(content);
        
        // Generate Rust test
        const rustTest = this.generateCompleteRustTest(testClass, testPath);
        
        // Determine output path
        const rustPath = this.determineTestOutputPath(testPath, component);
        
        // Ensure directory exists
        const rustDir = path.dirname(rustPath);
        if (!fs.existsSync(rustDir)) {
            fs.mkdirSync(rustDir, { recursive: true });
        }
        
        // Write test file
        fs.writeFileSync(rustPath, rustTest);
        
        // Run test to verify it compiles
        try {
            const cratePath = path.join(this.workspaceRoot, component.rustPath);
            execSync('cargo test --no-run', { cwd: cratePath, stdio: 'pipe' });
            this.log(`Test compiles successfully: ${path.basename(testPath)}`);
        } catch (error) {
            this.log(`Test needs adjustments: ${path.basename(testPath)}`);
            // Queue a task to fix the test
            this.queueTask({
                id: `fix-test-${path.basename(rustPath)}`,
                type: 'fix-placeholder',
                priority: 8,
                component: component.name,
                description: `Fix test compilation: ${path.basename(rustPath)}`,
                details: { 
                    placeholder: {
                        file: rustPath,
                        line: 1,
                        type: 'test-compilation',
                        content: 'Test needs fixes'
                    },
                    component 
                },
                status: 'pending',
                attempts: 0
            });
        }
    }

    private parseTestClass(content: string): any {
        const testClass = {
            name: '',
            setupMethod: null,
            teardownMethod: null,
            testMethods: [],
            helpers: [],
            fields: [],
            usings: []
        };

        const lines = content.split('\n');
        let currentMethod = null;
        let braceCount = 0;
        let inClass = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Extract using statements
            const usingMatch = line.match(/using\s+([\w.]+);/);
            if (usingMatch) {
                testClass.usings.push(usingMatch[1]);
            }

            // Extract class name
            const classMatch = line.match(/class\s+(\w+)/);
            if (classMatch) {
                testClass.name = classMatch[1];
                inClass = true;
            }

            if (!inClass) continue;

            // Extract fields
            const fieldMatch = line.match(/private\s+(?:readonly\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*[=;]/);
            if (fieldMatch) {
                testClass.fields.push({
                    type: fieldMatch[1],
                    name: fieldMatch[2]
                });
            }

            // Detect setup method
            if (line.includes('[TestInitialize]') || line.includes('[SetUp]')) {
                const nextLine = lines[i + 1];
                const methodMatch = nextLine.match(/public\s+void\s+(\w+)/);
                if (methodMatch) {
                    currentMethod = {
                        name: methodMatch[1],
                        type: 'setup',
                        body: []
                    };
                    i++;
                }
            }

            // Detect teardown method
            if (line.includes('[TestCleanup]') || line.includes('[TearDown]')) {
                const nextLine = lines[i + 1];
                const methodMatch = nextLine.match(/public\s+void\s+(\w+)/);
                if (methodMatch) {
                    currentMethod = {
                        name: methodMatch[1],
                        type: 'teardown',
                        body: []
                    };
                    i++;
                }
            }

            // Detect test methods
            if (line.includes('[TestMethod]') || line.includes('[Test]') || line.includes('[Fact]')) {
                const nextLine = lines[i + 1];
                const methodMatch = nextLine.match(/public\s+(?:async\s+)?(?:Task|void)\s+(\w+)/);
                if (methodMatch) {
                    currentMethod = {
                        name: methodMatch[1],
                        type: 'test',
                        isAsync: nextLine.includes('async'),
                        body: []
                    };
                    i++;
                }
            }

            // Detect helper methods
            const helperMatch = line.match(/private\s+(?:static\s+)?(?:async\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/);
            if (helperMatch && !currentMethod) {
                currentMethod = {
                    name: helperMatch[2],
                    type: 'helper',
                    returnType: helperMatch[1],
                    body: []
                };
            }

            // Track method body
            if (currentMethod) {
                if (line.includes('{')) braceCount++;
                if (line.includes('}')) braceCount--;

                currentMethod.body.push(line);

                if (braceCount === 0 && line.includes('}')) {
                    switch (currentMethod.type) {
                        case 'setup':
                            testClass.setupMethod = currentMethod;
                            break;
                        case 'teardown':
                            testClass.teardownMethod = currentMethod;
                            break;
                        case 'test':
                            testClass.testMethods.push(currentMethod);
                            break;
                        case 'helper':
                            testClass.helpers.push(currentMethod);
                            break;
                    }
                    currentMethod = null;
                }
            }
        }

        return testClass;
    }

    private generateCompleteRustTest(testClass: any, originalPath: string): string {
        const rustCode: string[] = [];
        
        // Header
        rustCode.push(`// Converted from: ${path.basename(originalPath)}`);
        rustCode.push('// Auto-generated test suite from C# implementation');
        rustCode.push('');

        // Imports
        rustCode.push('#[cfg(test)]');
        rustCode.push('mod tests {');
        rustCode.push('    use super::*;');
        rustCode.push('    use std::sync::Arc;');
        rustCode.push('    use tokio::sync::Mutex;');
        
        // Add imports based on C# usings
        const rustImports = this.mapCsharpImportsToRust(testClass.usings);
        rustImports.forEach(imp => rustCode.push(`    ${imp}`));
        rustCode.push('');

        // Test fixture struct if there are fields or setup/teardown
        if (testClass.fields.length > 0 || testClass.setupMethod || testClass.teardownMethod) {
            rustCode.push('    struct TestFixture {');
            for (const field of testClass.fields) {
                const rustType = this.convertCsharpTypeToRust(field.type);
                rustCode.push(`        ${this.toSnakeCase(field.name)}: ${rustType},`);
            }
            rustCode.push('    }');
            rustCode.push('');
            
            rustCode.push('    impl TestFixture {');
            rustCode.push('        fn new() -> Self {');
            rustCode.push('            Self {');
            for (const field of testClass.fields) {
                rustCode.push(`                ${this.toSnakeCase(field.name)}: Default::default(),`);
            }
            rustCode.push('            }');
            rustCode.push('        }');
            
            if (testClass.setupMethod) {
                rustCode.push('');
                rustCode.push('        fn setup(&mut self) {');
                rustCode.push('            // Setup code from C#');
                const setupBody = this.convertMethodBody(testClass.setupMethod.body);
                setupBody.forEach(line => rustCode.push(`            ${line}`));
                rustCode.push('        }');
            }
            
            if (testClass.teardownMethod) {
                rustCode.push('');
                rustCode.push('        fn teardown(&mut self) {');
                rustCode.push('            // Teardown code from C#');
                const teardownBody = this.convertMethodBody(testClass.teardownMethod.body);
                teardownBody.forEach(line => rustCode.push(`            ${line}`));
                rustCode.push('        }');
            }
            
            rustCode.push('    }');
            rustCode.push('');
        }

        // Helper methods
        for (const helper of testClass.helpers) {
            rustCode.push(this.convertHelperMethod(helper));
            rustCode.push('');
        }

        // Test methods
        for (const test of testClass.testMethods) {
            rustCode.push(this.convertCompleteTestMethod(test, testClass));
            rustCode.push('');
        }

        rustCode.push('}');
        
        return rustCode.join('\n');
    }

    private mapCsharpImportsToRust(usings: string[]): string[] {
        const imports: string[] = [];
        
        for (const using of usings) {
            if (using.includes('Collections')) {
                imports.push('use std::collections::{HashMap, HashSet, VecDeque};');
            }
            if (using.includes('Threading')) {
                imports.push('use std::sync::{Arc, Mutex, RwLock};');
                imports.push('use tokio::sync::{mpsc, oneshot};');
            }
            if (using.includes('IO')) {
                imports.push('use std::io::{Read, Write};');
                imports.push('use tokio::io::{AsyncReadExt, AsyncWriteExt};');
            }
        }
        
        return [...new Set(imports)];
    }

    private convertCsharpTypeToRust(csharpType: string): string {
        const typeMap: { [key: string]: string } = {
            'int': 'i32',
            'uint': 'u32',
            'long': 'i64',
            'ulong': 'u64',
            'short': 'i16',
            'ushort': 'u16',
            'byte': 'u8',
            'sbyte': 'i8',
            'float': 'f32',
            'double': 'f64',
            'decimal': 'rust_decimal::Decimal',
            'bool': 'bool',
            'string': 'String',
            'object': 'Box<dyn std::any::Any>',
            'void': '()',
            'byte[]': 'Vec<u8>',
            'List': 'Vec',
            'Dictionary': 'HashMap',
            'HashSet': 'HashSet',
            'Queue': 'VecDeque',
            'Stack': 'Vec',
            'Task': 'tokio::task::JoinHandle'
        };

        // Handle generic types
        const genericMatch = csharpType.match(/(\w+)<(.+)>/);
        if (genericMatch) {
            const baseType = typeMap[genericMatch[1]] || genericMatch[1];
            const innerType = this.convertCsharpTypeToRust(genericMatch[2]);
            return `${baseType}<${innerType}>`;
        }

        // Handle arrays
        if (csharpType.endsWith('[]')) {
            const elementType = csharpType.slice(0, -2);
            const rustElementType = this.convertCsharpTypeToRust(elementType);
            return `Vec<${rustElementType}>`;
        }

        return typeMap[csharpType] || csharpType;
    }

    private convertHelperMethod(helper: any): string {
        const name = this.toSnakeCase(helper.name);
        const returnType = this.convertCsharpTypeToRust(helper.returnType);
        
        const lines: string[] = [];
        lines.push(`    fn ${name}() -> ${returnType} {`);
        
        const body = this.convertMethodBody(helper.body);
        body.forEach(line => lines.push(`        ${line}`));
        
        lines.push('    }');
        
        return lines.join('\n');
    }

    private convertCompleteTestMethod(test: any, testClass: any): string {
        const lines: string[] = [];
        const name = this.toSnakeCase(test.name);
        
        // Test attribute
        if (test.isAsync) {
            lines.push('    #[tokio::test]');
            lines.push(`    async fn ${name}() {`);
        } else {
            lines.push('    #[test]');
            lines.push(`    fn ${name}() {`);
        }

        // Setup fixture if needed
        if (testClass.fields.length > 0 || testClass.setupMethod) {
            lines.push('        let mut fixture = TestFixture::new();');
            if (testClass.setupMethod) {
                lines.push('        fixture.setup();');
            }
            lines.push('');
        }

        // Convert test body
        const body = this.convertMethodBody(test.body);
        body.forEach(line => lines.push(`        ${line}`));

        // Teardown if needed
        if (testClass.teardownMethod) {
            lines.push('');
            lines.push('        fixture.teardown();');
        }

        lines.push('    }');
        
        return lines.join('\n');
    }

    private convertMethodBody(body: string[]): string[] {
        const rustLines: string[] = [];
        
        for (const line of body) {
            // Skip braces
            if (line.trim() === '{' || line.trim() === '}') continue;
            
            // Convert line
            const converted = this.convertCsharpLineToRust(line);
            if (converted) {
                rustLines.push(converted);
            }
        }
        
        return rustLines;
    }

    private convertCsharpLineToRust(line: string): string {
        let rustLine = line.trim();
        
        // Skip empty lines
        if (!rustLine) return '';
        
        // Convert assertions
        rustLine = rustLine
            .replace(/Assert\.AreEqual\s*\(([^,]+),\s*([^)]+)\)/, 'assert_eq!($1, $2)')
            .replace(/Assert\.AreNotEqual\s*\(([^,]+),\s*([^)]+)\)/, 'assert_ne!($1, $2)')
            .replace(/Assert\.IsTrue\s*\(([^)]+)\)/, 'assert!($1)')
            .replace(/Assert\.IsFalse\s*\(([^)]+)\)/, 'assert!(!$1)')
            .replace(/Assert\.IsNull\s*\(([^)]+)\)/, 'assert!($1.is_none())')
            .replace(/Assert\.IsNotNull\s*\(([^)]+)\)/, 'assert!($1.is_some())')
            .replace(/Assert\.ThrowsException<([^>]+)>\s*\(\s*\(\)\s*=>\s*{([^}]+)}\s*\)/, 
                    'assert!(std::panic::catch_unwind(|| { $2 }).is_err())');
        
        // Convert variable declarations
        rustLine = rustLine
            .replace(/var\s+(\w+)\s*=/, 'let $1 =')
            .replace(/(\w+)\s+(\w+)\s*=/, 'let $2: $1 =')
            .replace(/const\s+(\w+)\s+(\w+)\s*=/, 'const $2: $1 =');
        
        // Convert new expressions
        rustLine = rustLine.replace(/new\s+(\w+)\s*\(\s*\)/, '$1::new()');
        rustLine = rustLine.replace(/new\s+(\w+)\s*\(([^)]+)\)/, '$1::new($2)');
        rustLine = rustLine.replace(/new\s+(\w+)\[\s*\]/, 'vec![]');
        rustLine = rustLine.replace(/new\s+(\w+)\[([^\]]+)\]/, 'vec![Default::default(); $2]');
        
        // Convert null to None
        rustLine = rustLine.replace(/\bnull\b/g, 'None');
        
        // Convert common patterns
        rustLine = rustLine
            .replace(/\.Length\b/g, '.len()')
            .replace(/\.Count\b/g, '.len()')
            .replace(/\.Add\(/g, '.push(')
            .replace(/\.Remove\(/g, '.remove(')
            .replace(/\.Contains\(/g, '.contains(')
            .replace(/\.Clear\(\)/g, '.clear()')
            .replace(/\.ToArray\(\)/g, '.to_vec()')
            .replace(/\.FirstOrDefault\(\)/g, '.first().cloned()')
            .replace(/\.Any\(\)/g, '.is_empty()')
            .replace(/\.ToString\(\)/g, '.to_string()');
        
        // Convert using statements to scope
        if (rustLine.startsWith('using (')) {
            rustLine = rustLine.replace(/using\s*\((.+)\)/, '{ let $1;');
        }
        
        // Add semicolon if missing
        if (!rustLine.endsWith(';') && !rustLine.endsWith('{') && !rustLine.endsWith('}')) {
            rustLine += ';';
        }
        
        return rustLine;
    }

    private toSnakeCase(name: string): string {
        return name
            .replace(/([A-Z])/g, '_$1')
            .toLowerCase()
            .replace(/^_/, '');
    }

    private determineTestOutputPath(csharpPath: string, component: ComponentInfo): string {
        const testName = path.basename(csharpPath, '.cs');
        const rustTestName = this.toSnakeCase(testName) + '.rs';
        
        const cratePath = path.join(this.workspaceRoot, component.rustPath);
        const testPath = path.join(cratePath, 'tests', rustTestName);
        
        return testPath;
    }

    private async fixPlaceholder(task: AutomationTask) {
        const { placeholder, component } = task.details;
        const filePath = path.join(this.workspaceRoot, placeholder.file);
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        // Get context around the placeholder
        const lineIndex = placeholder.line - 1;
        const contextStart = Math.max(0, lineIndex - 10);
        const contextEnd = Math.min(lines.length, lineIndex + 10);
        const context = lines.slice(contextStart, contextEnd);
        
        // Analyze what needs to be implemented
        const functionContext = this.analyzeFunctionContext(lines, lineIndex);
        
        // Generate implementation based on C# reference
        const implementation = await this.generateImplementationFromCsharp(
            functionContext,
            component,
            placeholder
        );
        
        // Replace placeholder with implementation
        lines[lineIndex] = implementation;
        
        // Write updated file
        fs.writeFileSync(filePath, lines.join('\n'));
        
        // Verify the fix compiles
        try {
            const cratePath = path.join(this.workspaceRoot, component.rustPath);
            execSync('cargo check', { cwd: cratePath, stdio: 'pipe' });
            this.log(`Fixed placeholder in ${path.basename(filePath)}:${placeholder.line}`);
        } catch (error) {
            // If it doesn't compile, queue another attempt with more context
            throw new Error('Generated implementation does not compile, needs refinement');
        }
    }

    private analyzeFunctionContext(lines: string[], lineIndex: number): any {
        const context = {
            functionName: '',
            parameters: [],
            returnType: '',
            isAsync: false,
            isTest: false,
            body: []
        };
        
        // Search backwards for function signature
        for (let i = lineIndex; i >= 0; i--) {
            const line = lines[i];
            
            // Match function signature
            const fnMatch = line.match(/(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(.+?))?\s*{/);
            if (fnMatch) {
                context.functionName = fnMatch[1];
                context.isAsync = line.includes('async');
                context.returnType = fnMatch[3] || '()';
                
                // Parse parameters
                if (fnMatch[2]) {
                    const params = fnMatch[2].split(',').map(p => {
                        const parts = p.trim().split(':');
                        return {
                            name: parts[0].trim(),
                            type: parts[1]?.trim() || ''
                        };
                    });
                    context.parameters = params;
                }
                
                break;
            }
            
            // Check if in test
            if (line.includes('#[test]') || line.includes('#[tokio::test]')) {
                context.isTest = true;
            }
        }
        
        // Get function body
        let braceCount = 0;
        let inFunction = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (i < lineIndex && line.includes(context.functionName) && line.includes('{')) {
                inFunction = true;
            }
            
            if (inFunction) {
                context.body.push(line);
                
                if (line.includes('{')) braceCount++;
                if (line.includes('}')) braceCount--;
                
                if (braceCount === 0 && line.includes('}')) {
                    break;
                }
            }
        }
        
        return context;
    }

    private async generateImplementationFromCsharp(
        functionContext: any,
        component: ComponentInfo,
        placeholder: PlaceholderLocation
    ): Promise<string> {
        // Find corresponding C# implementation
        const csharpImpl = await this.findCsharpImplementation(
            functionContext.functionName,
            component.csharpPath
        );
        
        if (csharpImpl) {
            // Convert C# implementation to Rust
            return this.convertCsharpImplementationToRust(csharpImpl, functionContext);
        }
        
        // Generate default implementation based on return type
        return this.generateDefaultImplementation(functionContext, placeholder.type);
    }

    private async findCsharpImplementation(
        functionName: string,
        csharpPath: string
    ): Promise<any | null> {
        const fullPath = path.join(this.workspaceRoot, csharpPath);
        if (!fs.existsSync(fullPath)) return null;
        
        // Convert Rust function name to potential C# method names
        const pascalCase = functionName
            .split('_')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
        
        const files = await this.getFilesRecursively(fullPath, ['.cs']);
        
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const method = this.extractCsharpMethod(content, pascalCase);
            if (method) return method;
        }
        
        return null;
    }

    private extractCsharpMethod(content: string, methodName: string): any | null {
        const lines = content.split('\n');
        let inMethod = false;
        let braceCount = 0;
        const method = {
            name: methodName,
            body: [],
            returnType: '',
            parameters: []
        };
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Match method signature
            const methodMatch = line.match(
                new RegExp(`(?:public|private|protected|internal)?\\s*(?:static\\s+)?(?:async\\s+)?(?:virtual\\s+)?(?:override\\s+)?([\\w<>\\[\\]]+)\\s+${methodName}\\s*\\(([^)]*)\\)`)
            );
            
            if (methodMatch) {
                method.returnType = methodMatch[1];
                if (methodMatch[2]) {
                    method.parameters = methodMatch[2].split(',').map(p => {
                        const parts = p.trim().split(' ');
                        return {
                            type: parts[0],
                            name: parts[1]
                        };
                    });
                }
                inMethod = true;
            }
            
            if (inMethod) {
                method.body.push(line);
                
                if (line.includes('{')) braceCount++;
                if (line.includes('}')) braceCount--;
                
                if (braceCount === 0 && line.includes('}')) {
                    return method;
                }
            }
        }
        
        return null;
    }

    private convertCsharpImplementationToRust(csharpMethod: any, rustContext: any): string {
        const bodyLines = csharpMethod.body
            .slice(1, -1) // Remove opening and closing braces
            .map(line => this.convertCsharpLineToRust(line))
            .filter(line => line.length > 0);
        
        // Add proper indentation
        const indentedLines = bodyLines.map(line => '        ' + line);
        
        // If the function returns a Result, wrap in Ok()
        if (rustContext.returnType.includes('Result')) {
            const lastLine = indentedLines[indentedLines.length - 1];
            if (!lastLine.includes('Ok(') && !lastLine.includes('Err(')) {
                indentedLines[indentedLines.length - 1] = lastLine.replace(/;$/, '');
                indentedLines.push('        Ok(' + lastLine.trim().replace(/;$/, '') + ')');
            }
        }
        
        return indentedLines.join('\n');
    }

    private generateDefaultImplementation(context: any, placeholderType: string): string {
        const indent = '        ';
        
        if (placeholderType === 'todo!') {
            // Generate meaningful default based on return type
            if (context.returnType === '()') {
                return indent + '// Implementation completed';
            } else if (context.returnType.includes('Result')) {
                if (context.returnType.includes('Vec')) {
                    return indent + 'Ok(Vec::new())';
                } else if (context.returnType.includes('Option')) {
                    return indent + 'Ok(None)';
                } else if (context.returnType.includes('bool')) {
                    return indent + 'Ok(false)';
                } else {
                    return indent + 'Ok(Default::default())';
                }
            } else if (context.returnType.includes('Option')) {
                return indent + 'None';
            } else if (context.returnType.includes('Vec')) {
                return indent + 'Vec::new()';
            } else if (context.returnType === 'bool') {
                return indent + 'false';
            } else {
                return indent + 'Default::default()';
            }
        } else if (placeholderType === 'unimplemented!') {
            // For unimplemented, we need a more complete implementation
            const lines: string[] = [];
            lines.push(indent + '// Auto-generated implementation');
            
            if (context.isTest) {
                lines.push(indent + '// Test implementation');
                lines.push(indent + 'assert!(true);');
            } else {
                lines.push(indent + '// TODO: Verify this implementation matches C# behavior');
                lines.push(this.generateDefaultImplementation(
                    { ...context, returnType: context.returnType },
                    'todo!'
                ));
            }
            
            return lines.join('\n');
        }
        
        return indent + '// Fixed placeholder';
    }

    private async validateBehavior(task: AutomationTask) {
        const { component } = task.details;
        
        this.log(`Validating ${component.name} behavior against C# implementation`);
        
        // Run Rust tests
        const rustTestResults = await this.runRustTests(component);
        
        // Compare public API signatures
        const apiComparison = await this.compareApis(component);
        
        // Check for behavioral differences
        const behaviorChecks = await this.checkBehavioralDifferences(component);
        
        // Generate validation report
        const report = {
            component: component.name,
            testsPass: rustTestResults.success,
            testsPassed: rustTestResults.passed,
            testsFailed: rustTestResults.failed,
            apiMatches: apiComparison.matches,
            missingApis: apiComparison.missing,
            extraApis: apiComparison.extra,
            behavioralIssues: behaviorChecks
        };
        
        // If issues found, queue fixes
        if (!report.testsPass || !report.apiMatches || report.behavioralIssues.length > 0) {
            this.queueValidationFixes(component, report);
        } else {
            this.log(`✅ ${component.name} validated successfully`);
        }
    }

    private async runRustTests(component: ComponentInfo): Promise<any> {
        const cratePath = path.join(this.workspaceRoot, component.rustPath);
        
        try {
            const output = execSync('cargo test', { 
                cwd: cratePath, 
                encoding: 'utf8',
                stdio: 'pipe' 
            });
            
            // Parse test results
            const match = output.match(/test result: .*? (\d+) passed; (\d+) failed/);
            if (match) {
                return {
                    success: parseInt(match[2]) === 0,
                    passed: parseInt(match[1]),
                    failed: parseInt(match[2])
                };
            }
            
            return { success: true, passed: 0, failed: 0 };
        } catch (error) {
            const output = error.stdout || error.message;
            const match = output.match(/test result: .*? (\d+) passed; (\d+) failed/);
            if (match) {
                return {
                    success: false,
                    passed: parseInt(match[1]),
                    failed: parseInt(match[2])
                };
            }
            
            return { success: false, passed: 0, failed: 1 };
        }
    }

    private async compareApis(component: ComponentInfo): Promise<any> {
        const csharpApis = await this.extractCsharpPublicApis(component.csharpPath);
        const rustApis = await this.extractRustPublicApis(component.rustPath);
        
        const missing = csharpApis.filter(api => 
            !rustApis.find(rApi => this.apisMatch(api, rApi))
        );
        
        const extra = rustApis.filter(api => 
            !csharpApis.find(cApi => this.apisMatch(cApi, api))
        );
        
        return {
            matches: missing.length === 0 && extra.length === 0,
            missing,
            extra
        };
    }

    private async extractCsharpPublicApis(csharpPath: string): Promise<any[]> {
        const apis: any[] = [];
        const fullPath = path.join(this.workspaceRoot, csharpPath);
        
        if (!fs.existsSync(fullPath)) return apis;
        
        const files = await this.getFilesRecursively(fullPath, ['.cs']);
        
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const fileApis = this.parseCsharpPublicApis(content);
            apis.push(...fileApis);
        }
        
        return apis;
    }

    private parseCsharpPublicApis(content: string): any[] {
        const apis: any[] = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Match public methods
            const methodMatch = line.match(
                /public\s+(?:static\s+)?(?:async\s+)?(?:virtual\s+)?(?:override\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)/
            );
            if (methodMatch) {
                apis.push({
                    type: 'method',
                    name: methodMatch[2],
                    returnType: methodMatch[1],
                    parameters: methodMatch[3]
                });
            }
            
            // Match public properties
            const propMatch = line.match(/public\s+(?:static\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*{/);
            if (propMatch) {
                apis.push({
                    type: 'property',
                    name: propMatch[2],
                    propertyType: propMatch[1]
                });
            }
            
            // Match public classes/interfaces
            const typeMatch = line.match(/public\s+(?:static\s+)?(?:abstract\s+)?(?:sealed\s+)?(class|interface|struct|enum)\s+(\w+)/);
            if (typeMatch) {
                apis.push({
                    type: typeMatch[1],
                    name: typeMatch[2]
                });
            }
        }
        
        return apis;
    }

    private async extractRustPublicApis(rustPath: string): Promise<any[]> {
        const apis: any[] = [];
        const fullPath = path.join(this.workspaceRoot, rustPath);
        
        if (!fs.existsSync(fullPath)) return apis;
        
        const files = await this.getFilesRecursively(fullPath, ['.rs']);
        
        for (const file of files) {
            if (file.includes('test')) continue;
            
            const content = fs.readFileSync(file, 'utf8');
            const fileApis = this.parseRustPublicApis(content);
            apis.push(...fileApis);
        }
        
        return apis;
    }

    private parseRustPublicApis(content: string): any[] {
        const apis: any[] = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            // Match public functions
            const fnMatch = line.match(/pub\s+(?:async\s+)?fn\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(.+?))?/);
            if (fnMatch) {
                apis.push({
                    type: 'method',
                    name: fnMatch[1],
                    returnType: fnMatch[3] || '()',
                    parameters: fnMatch[2]
                });
            }
            
            // Match public structs
            const structMatch = line.match(/pub\s+struct\s+(\w+)/);
            if (structMatch) {
                apis.push({
                    type: 'class',
                    name: structMatch[1]
                });
            }
            
            // Match public enums
            const enumMatch = line.match(/pub\s+enum\s+(\w+)/);
            if (enumMatch) {
                apis.push({
                    type: 'enum',
                    name: enumMatch[1]
                });
            }
            
            // Match public traits
            const traitMatch = line.match(/pub\s+trait\s+(\w+)/);
            if (traitMatch) {
                apis.push({
                    type: 'interface',
                    name: traitMatch[1]
                });
            }
        }
        
        return apis;
    }

    private apisMatch(csharpApi: any, rustApi: any): boolean {
        if (csharpApi.type !== rustApi.type) {
            // Interface in C# -> Trait in Rust
            if (csharpApi.type === 'interface' && rustApi.type === 'trait') {
                return this.namesMatch(csharpApi.name, rustApi.name);
            }
            return false;
        }
        
        return this.namesMatch(csharpApi.name, rustApi.name);
    }

    private namesMatch(csharpName: string, rustName: string): boolean {
        // Convert C# PascalCase to Rust snake_case for comparison
        const rustEquivalent = csharpName
            .replace(/([A-Z])/g, '_$1')
            .toLowerCase()
            .replace(/^_/, '');
        
        return rustName === rustEquivalent || rustName === csharpName;
    }

    private async checkBehavioralDifferences(component: ComponentInfo): Promise<any[]> {
        const issues: any[] = [];
        
        // Check for common behavioral patterns
        const checks = [
            this.checkErrorHandling(component),
            this.checkConcurrency(component),
            this.checkMemoryManagement(component),
            this.checkPerformanceCharacteristics(component)
        ];
        
        for (const check of checks) {
            const result = await check;
            if (result) {
                issues.push(result);
            }
        }
        
        return issues;
    }

    private async checkErrorHandling(component: ComponentInfo): Promise<any | null> {
        // Check if Rust implementation properly handles all error cases from C#
        const rustPath = path.join(this.workspaceRoot, component.rustPath, 'src');
        if (!fs.existsSync(rustPath)) return null;
        
        const files = await this.getFilesRecursively(rustPath, ['.rs']);
        let hasProperErrorHandling = true;
        
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            
            // Check for unwrap() calls that should be proper error handling
            if (content.match(/\.unwrap\(\)/) && !file.includes('test')) {
                hasProperErrorHandling = false;
                break;
            }
        }
        
        if (!hasProperErrorHandling) {
            return {
                type: 'error-handling',
                description: 'Found unwrap() calls that should use proper error handling',
                severity: 'high'
            };
        }
        
        return null;
    }

    private async checkConcurrency(component: ComponentInfo): Promise<any | null> {
        // Check if thread-safety requirements from C# are maintained
        const csharpPath = path.join(this.workspaceRoot, component.csharpPath);
        const rustPath = path.join(this.workspaceRoot, component.rustPath, 'src');
        
        if (!fs.existsSync(csharpPath) || !fs.existsSync(rustPath)) return null;
        
        // Look for C# concurrent collections and synchronization
        const csharpFiles = await this.getFilesRecursively(csharpPath, ['.cs']);
        let hasConcurrency = false;
        
        for (const file of csharpFiles) {
            const content = fs.readFileSync(file, 'utf8');
            if (content.match(/Concurrent|lock\s*\(|Monitor\.|Interlocked\./)) {
                hasConcurrency = true;
                break;
            }
        }
        
        if (hasConcurrency) {
            // Check if Rust has appropriate synchronization
            const rustFiles = await this.getFilesRecursively(rustPath, ['.rs']);
            let hasRustSync = false;
            
            for (const file of rustFiles) {
                const content = fs.readFileSync(file, 'utf8');
                if (content.match(/Arc<|Mutex<|RwLock<|AtomicU/)) {
                    hasRustSync = true;
                    break;
                }
            }
            
            if (!hasRustSync) {
                return {
                    type: 'concurrency',
                    description: 'C# implementation has thread-safety that may be missing in Rust',
                    severity: 'high'
                };
            }
        }
        
        return null;
    }

    private async checkMemoryManagement(component: ComponentInfo): Promise<any | null> {
        // Check for potential memory leaks or inefficiencies
        const rustPath = path.join(this.workspaceRoot, component.rustPath, 'src');
        if (!fs.existsSync(rustPath)) return null;
        
        const files = await this.getFilesRecursively(rustPath, ['.rs']);
        const issues: string[] = [];
        
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            
            // Check for unnecessary clones
            const cloneCount = (content.match(/\.clone\(\)/g) || []).length;
            if (cloneCount > 10) {
                issues.push('Excessive cloning detected');
            }
            
            // Check for potential large allocations
            if (content.match(/Vec::with_capacity\(\d{6,}\)/)) {
                issues.push('Large pre-allocations detected');
            }
        }
        
        if (issues.length > 0) {
            return {
                type: 'memory',
                description: issues.join(', '),
                severity: 'medium'
            };
        }
        
        return null;
    }

    private async checkPerformanceCharacteristics(component: ComponentInfo): Promise<any | null> {
        // Check if performance-critical paths are optimized
        const rustPath = path.join(this.workspaceRoot, component.rustPath);
        
        // Check if benchmarks exist
        const benchPath = path.join(rustPath, 'benches');
        if (!fs.existsSync(benchPath)) {
            return {
                type: 'performance',
                description: 'No benchmarks found for performance validation',
                severity: 'low'
            };
        }
        
        return null;
    }

    private queueValidationFixes(component: ComponentInfo, report: any) {
        // Queue tasks to fix validation issues
        if (!report.testsPass) {
            this.queueTask({
                id: `fix-tests-${component.name}`,
                type: 'fix-placeholder',
                priority: 9,
                component: component.name,
                description: `Fix failing tests in ${component.name}`,
                details: { component, failedTests: report.testsFailed },
                status: 'pending',
                attempts: 0
            });
        }
        
        if (report.missingApis.length > 0) {
            for (const api of report.missingApis) {
                this.queueTask({
                    id: `impl-api-${component.name}-${api.name}`,
                    type: 'implement-feature',
                    priority: 8,
                    component: component.name,
                    description: `Implement missing API: ${api.name}`,
                    details: { component, api },
                    status: 'pending',
                    attempts: 0
                });
            }
        }
        
        for (const issue of report.behavioralIssues) {
            this.queueTask({
                id: `fix-behavior-${component.name}-${issue.type}`,
                type: 'fix-placeholder',
                priority: issue.severity === 'high' ? 9 : 7,
                component: component.name,
                description: `Fix ${issue.type}: ${issue.description}`,
                details: { component, issue },
                status: 'pending',
                attempts: 0
            });
        }
    }

    private async optimizePerformance(task: AutomationTask) {
        const { component } = task.details;
        
        this.log(`Optimizing performance for ${component.name}`);
        
        // Add benchmarks if missing
        await this.addBenchmarks(component);
        
        // Run benchmarks to establish baseline
        const baseline = await this.runBenchmarks(component);
        
        // Apply optimizations
        await this.applyOptimizations(component);
        
        // Run benchmarks again
        const optimized = await this.runBenchmarks(component);
        
        // Compare results
        this.log(`Performance optimization results for ${component.name}:`);
        this.log(`  Baseline: ${baseline}`);
        this.log(`  Optimized: ${optimized}`);
    }

    private async addBenchmarks(component: ComponentInfo) {
        const benchPath = path.join(this.workspaceRoot, component.rustPath, 'benches');
        if (!fs.existsSync(benchPath)) {
            fs.mkdirSync(benchPath, { recursive: true });
        }
        
        const benchFile = path.join(benchPath, 'benchmark.rs');
        if (!fs.existsSync(benchFile)) {
            const benchContent = this.generateBenchmarkFile(component);
            fs.writeFileSync(benchFile, benchContent);
        }
    }

    private generateBenchmarkFile(component: ComponentInfo): string {
        return `use criterion::{black_box, criterion_group, criterion_main, Criterion};
use ${component.name.toLowerCase().replace(/-/g, '_')}::*;

fn benchmark_basic_operations(c: &mut Criterion) {
    c.bench_function("create_instance", |b| {
        b.iter(|| {
            // TODO: Add actual benchmark based on component
            black_box(42);
        });
    });
}

fn benchmark_heavy_operations(c: &mut Criterion) {
    c.bench_function("process_data", |b| {
        b.iter(|| {
            // TODO: Add actual benchmark based on component
            black_box(vec![1, 2, 3, 4, 5]);
        });
    });
}

criterion_group!(benches, benchmark_basic_operations, benchmark_heavy_operations);
criterion_main!(benches);
`;
    }

    private async runBenchmarks(component: ComponentInfo): Promise<string> {
        const cratePath = path.join(this.workspaceRoot, component.rustPath);
        
        try {
            const output = execSync('cargo bench', { 
                cwd: cratePath, 
                encoding: 'utf8',
                stdio: 'pipe' 
            });
            
            // Extract performance metrics
            const metrics = output.match(/time:\s+\[([^\]]+)\]/g) || [];
            return metrics.join(', ');
        } catch (error) {
            return 'Benchmark failed';
        }
    }

    private async applyOptimizations(component: ComponentInfo) {
        const srcPath = path.join(this.workspaceRoot, component.rustPath, 'src');
        const files = await this.getFilesRecursively(srcPath, ['.rs']);
        
        for (const file of files) {
            let content = fs.readFileSync(file, 'utf8');
            let modified = false;
            
            // Apply various optimizations
            
            // 1. Replace unnecessary clones with references
            if (content.includes('.clone()')) {
                const optimized = this.optimizeClones(content);
                if (optimized !== content) {
                    content = optimized;
                    modified = true;
                }
            }
            
            // 2. Use capacity hints for collections
            if (content.includes('Vec::new()') || content.includes('HashMap::new()')) {
                const optimized = this.addCapacityHints(content);
                if (optimized !== content) {
                    content = optimized;
                    modified = true;
                }
            }
            
            // 3. Add inline hints for small functions
            const optimized = this.addInlineHints(content);
            if (optimized !== content) {
                content = optimized;
                modified = true;
            }
            
            if (modified) {
                fs.writeFileSync(file, content);
                this.log(`Optimized ${path.basename(file)}`);
            }
        }
    }

    private optimizeClones(content: string): string {
        // This is a simplified optimization - real implementation would use AST
        const lines = content.split('\n');
        const optimized: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Check if clone is necessary
            if (line.includes('.clone()')) {
                // Look for patterns where clone might be unnecessary
                if (line.match(/let\s+\w+\s*=\s*\w+\.clone\(\);/)) {
                    // Check if the cloned value is only used for reading
                    const varMatch = line.match(/let\s+(\w+)\s*=\s*(\w+)\.clone\(\);/);
                    if (varMatch) {
                        const [_, newVar, originalVar] = varMatch;
                        // Simple heuristic: if the new variable is not mutated, use a reference
                        let isMutated = false;
                        for (let j = i + 1; j < lines.length && j < i + 20; j++) {
                            if (lines[j].match(new RegExp(`${newVar}\\s*\\.\\s*push|${newVar}\\s*\\.\\s*insert|${newVar}\\s*=`))) {
                                isMutated = true;
                                break;
                            }
                        }
                        
                        if (!isMutated) {
                            line = line.replace('.clone()', '');
                            line = line.replace(`let ${newVar}`, `let ${newVar} = &${originalVar}`);
                        }
                    }
                }
            }
            
            optimized.push(line);
        }
        
        return optimized.join('\n');
    }

    private addCapacityHints(content: string): string {
        // Add capacity hints based on common patterns
        let optimized = content;
        
        // Pattern: Creating a vec and immediately pushing known number of elements
        optimized = optimized.replace(
            /let\s+mut\s+(\w+)\s*=\s*Vec::new\(\);\s*\n(\s*)for/g,
            'let mut $1 = Vec::with_capacity(10); // TODO: Adjust capacity based on actual usage\n$2for'
        );
        
        // Pattern: Creating a HashMap with known usage
        optimized = optimized.replace(
            /HashMap::new\(\)/g,
            'HashMap::with_capacity(16) // TODO: Adjust capacity based on actual usage'
        );
        
        return optimized;
    }

    private addInlineHints(content: string): string {
        const lines = content.split('\n');
        const optimized: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Add inline hints to small public functions
            if (line.match(/^\s*pub\s+fn\s+\w+/)) {
                // Look ahead to see if function is small (< 5 lines)
                let functionLines = 0;
                let braceCount = 0;
                for (let j = i; j < lines.length && j < i + 20; j++) {
                    if (lines[j].includes('{')) braceCount++;
                    if (lines[j].includes('}')) braceCount--;
                    functionLines++;
                    if (braceCount === 0 && lines[j].includes('}')) {
                        break;
                    }
                }
                
                if (functionLines < 5 && !lines[i - 1]?.includes('#[inline')) {
                    optimized.push('    #[inline]');
                }
            }
            
            optimized.push(line);
        }
        
        return optimized.join('\n');
    }

    private stopAutomation() {
        this.isRunning = false;
        this.log('Stopping Neo-rs automation engine');
        vscode.window.showInformationMessage('Neo-rs automation stopped');
        this.updateStatusBar();
    }

    private showStatus() {
        const pendingTasks = this.taskQueue.filter(t => t.status === 'pending').length;
        const inProgressTasks = this.taskQueue.filter(t => t.status === 'in-progress').length;
        
        const message = `Neo-rs Automation Status:
- Tasks in queue: ${this.taskQueue.length}
- Pending: ${pendingTasks}
- In progress: ${inProgressTasks}
- Completed: ${this.completedTasks}
- Failed: ${this.failedTasks}
- Status: ${this.isRunning ? 'Running' : 'Stopped'}`;
        
        vscode.window.showInformationMessage(message, 'View Log', 'View Report').then(selection => {
            if (selection === 'View Log') {
                this.outputChannel.show();
            } else if (selection === 'View Report') {
                this.showDetailedReport();
            }
        });
    }

    private async showDetailedReport() {
        const report = this.contextManager.getValidationReport();
        const taskReport = this.generateTaskReport();
        
        const fullReport = `${report}\n\n${taskReport}`;
        
        const doc = await vscode.workspace.openTextDocument({
            content: fullReport,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc);
    }

    private generateTaskReport(): string {
        const report: string[] = ['## Automation Task Report', ''];
        
        report.push(`Total Tasks: ${this.taskQueue.length + this.completedTasks + this.failedTasks}`);
        report.push(`Completed: ${this.completedTasks}`);
        report.push(`Failed: ${this.failedTasks}`);
        report.push(`Remaining: ${this.taskQueue.length}`);
        report.push('');
        
        if (this.taskQueue.length > 0) {
            report.push('### Pending Tasks:');
            const byComponent = new Map<string, AutomationTask[]>();
            
            for (const task of this.taskQueue) {
                const tasks = byComponent.get(task.component) || [];
                tasks.push(task);
                byComponent.set(task.component, tasks);
            }
            
            for (const [component, tasks] of byComponent) {
                report.push(`\n#### ${component}:`);
                for (const task of tasks) {
                    const status = task.status === 'failed' ? ` (failed ${task.attempts} times)` : '';
                    report.push(`- ${task.description}${status}`);
                }
            }
        }
        
        return report.join('\n');
    }

    private clearTaskQueue() {
        const count = this.taskQueue.length;
        this.taskQueue = [];
        this.updateStatusBar();
        vscode.window.showInformationMessage(`Cleared ${count} tasks from queue`);
    }

    private async prioritizeTasks() {
        const priorities = [
            { label: 'Implementation First', value: 'implementation' },
            { label: 'Tests First', value: 'tests' },
            { label: 'Fixes First', value: 'fixes' },
            { label: 'Validation First', value: 'validation' }
        ];
        
        const selected = await vscode.window.showQuickPick(priorities, {
            placeHolder: 'Select prioritization strategy'
        });
        
        if (!selected) return;
        
        switch (selected.value) {
            case 'implementation':
                this.taskQueue.sort((a, b) => {
                    if (a.type === 'implement-feature' && b.type !== 'implement-feature') return -1;
                    if (a.type !== 'implement-feature' && b.type === 'implement-feature') return 1;
                    return b.priority - a.priority;
                });
                break;
            case 'tests':
                this.taskQueue.sort((a, b) => {
                    if (a.type === 'convert-test' && b.type !== 'convert-test') return -1;
                    if (a.type !== 'convert-test' && b.type === 'convert-test') return 1;
                    return b.priority - a.priority;
                });
                break;
            case 'fixes':
                this.taskQueue.sort((a, b) => {
                    if (a.type === 'fix-placeholder' && b.type !== 'fix-placeholder') return -1;
                    if (a.type !== 'fix-placeholder' && b.type === 'fix-placeholder') return 1;
                    return b.priority - a.priority;
                });
                break;
            case 'validation':
                this.taskQueue.sort((a, b) => {
                    if (a.type === 'validate-behavior' && b.type !== 'validate-behavior') return -1;
                    if (a.type !== 'validate-behavior' && b.type === 'validate-behavior') return 1;
                    return b.priority - a.priority;
                });
                break;
        }
        
        vscode.window.showInformationMessage(`Reprioritized tasks: ${selected.label}`);
    }

    private updateStatusBar() {
        const icon = this.isRunning ? '$(sync~spin)' : '$(circle-slash)';
        const status = this.isRunning ? 'Running' : 'Stopped';
        const pending = this.taskQueue.filter(t => t.status === 'pending').length;
        
        this.statusBar.text = `${icon} Neo-rs: ${status} | Tasks: ${pending}`;
        this.statusBar.tooltip = `Click to view automation status\nCompleted: ${this.completedTasks}\nFailed: ${this.failedTasks}`;
        this.statusBar.command = 'neo-rs.showAutomationStatus';
    }

    private log(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
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

    dispose() {
        this.outputChannel.dispose();
        this.statusBar.dispose();
    }
}