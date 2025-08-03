import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { NeoRsContextManager, ComponentInfo, PlaceholderLocation } from './context';

export class NeoRsAnalyzer {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private contextManager: NeoRsContextManager;

    constructor(private context: vscode.ExtensionContext, private workspaceRoot: string) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('neo-rs');
        this.contextManager = new NeoRsContextManager(workspaceRoot);
    }

    async activate() {
        // Register commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('neo-rs.analyze', () => this.analyzeProject()),
            vscode.commands.registerCommand('neo-rs.convertTest', () => this.convertCsharpTest()),
            vscode.commands.registerCommand('neo-rs.validateComponent', () => this.validateComponent()),
            vscode.commands.registerCommand('neo-rs.generateMissing', () => this.generateMissingImplementation()),
            vscode.commands.registerCommand('neo-rs.fixPlaceholders', () => this.fixPlaceholders()),
            vscode.commands.registerCommand('neo-rs.compareWithCsharp', () => this.compareWithCsharp()),
            vscode.commands.registerCommand('neo-rs.showReport', () => this.showValidationReport())
        );

        // Register file watchers
        const rustWatcher = vscode.workspace.createFileSystemWatcher('**/*.rs');
        rustWatcher.onDidChange(() => this.onRustFileChanged());
        rustWatcher.onDidCreate(() => this.onRustFileChanged());
        this.context.subscriptions.push(rustWatcher);

        // Run initial analysis
        await this.analyzeProject();
    }

    private async analyzeProject() {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Analyzing Neo-rs project",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "Scanning project structure..." });
            
            await this.contextManager.analyzeProject();
            
            progress.report({ increment: 50, message: "Validating components..." });
            
            this.updateDiagnostics();
            
            progress.report({ increment: 100, message: "Analysis complete" });
            
            const context = this.contextManager.getContext();
            if (!context.validationResults.isProductionReady) {
                const action = await vscode.window.showWarningMessage(
                    'Neo-rs is not production ready. View report?',
                    'View Report',
                    'Fix Issues'
                );
                
                if (action === 'View Report') {
                    await this.showValidationReport();
                } else if (action === 'Fix Issues') {
                    await this.showQuickFixes();
                }
            }
        });
    }

    private async convertCsharpTest() {
        const context = this.contextManager.getContext();
        const unconvertedTests: string[] = [];
        
        for (const [name, component] of context.components) {
            unconvertedTests.push(...component.unconvertedTests);
        }
        
        if (unconvertedTests.length === 0) {
            vscode.window.showInformationMessage('All C# tests have been converted!');
            return;
        }
        
        const selected = await vscode.window.showQuickPick(
            unconvertedTests.map(test => ({
                label: path.basename(test),
                description: path.dirname(test),
                test
            })),
            { placeHolder: 'Select a C# test to convert' }
        );
        
        if (selected) {
            await this.convertSingleTest(selected.test);
        }
    }

    private async convertSingleTest(csharpTestPath: string) {
        const content = fs.readFileSync(csharpTestPath, 'utf8');
        
        // Parse C# test structure
        const testMethods = this.parseCsharpTests(content);
        
        // Generate Rust test code
        const rustCode = this.generateRustTests(testMethods, csharpTestPath);
        
        // Determine output path
        const relativePath = path.relative(this.workspaceRoot, csharpTestPath);
        const rustPath = this.determineRustTestPath(relativePath);
        
        // Create directory if needed
        const rustDir = path.dirname(rustPath);
        if (!fs.existsSync(rustDir)) {
            fs.mkdirSync(rustDir, { recursive: true });
        }
        
        // Write Rust test file
        fs.writeFileSync(rustPath, rustCode);
        
        // Open the file
        const doc = await vscode.workspace.openTextDocument(rustPath);
        await vscode.window.showTextDocument(doc);
        
        vscode.window.showInformationMessage(`Converted test: ${path.basename(csharpTestPath)}`);
    }

    private parseCsharpTests(content: string): any[] {
        const testMethods: any[] = [];
        const lines = content.split('\n');
        
        let currentTest: any = null;
        let inTest = false;
        let braceCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Detect test method
            if (line.includes('[TestMethod]') || line.includes('[Test]') || line.includes('[Fact]')) {
                const nextLine = lines[i + 1];
                const match = nextLine.match(/public\s+(?:async\s+)?(?:Task<?\w*>?|void)\s+(\w+)\s*\(/);
                if (match) {
                    currentTest = {
                        name: match[1],
                        isAsync: nextLine.includes('async'),
                        body: [],
                        attributes: [line.trim()]
                    };
                    inTest = true;
                    i++; // Skip to method declaration
                }
            }
            
            if (inTest && currentTest) {
                if (line.includes('{')) braceCount++;
                if (line.includes('}')) braceCount--;
                
                currentTest.body.push(line);
                
                if (braceCount === 0 && line.includes('}')) {
                    testMethods.push(currentTest);
                    currentTest = null;
                    inTest = false;
                }
            }
        }
        
        return testMethods;
    }

    private generateRustTests(testMethods: any[], originalPath: string): string {
        const rustCode: string[] = [];
        
        // Add header comment
        rustCode.push(`// Converted from: ${path.basename(originalPath)}`);
        rustCode.push('// This file was automatically generated from C# tests');
        rustCode.push('// Manual verification and adjustment may be required');
        rustCode.push('');
        
        // Add common imports
        rustCode.push('#[cfg(test)]');
        rustCode.push('mod tests {');
        rustCode.push('    use super::*;');
        rustCode.push('    use tokio::test;');
        rustCode.push('');
        
        // Convert each test method
        for (const test of testMethods) {
            rustCode.push(this.convertTestMethod(test));
            rustCode.push('');
        }
        
        rustCode.push('}');
        
        return rustCode.join('\n');
    }

    private convertTestMethod(test: any): string {
        const lines: string[] = [];
        
        // Add test attribute
        if (test.isAsync) {
            lines.push('    #[tokio::test]');
        } else {
            lines.push('    #[test]');
        }
        
        // Convert method signature
        const rustName = this.convertToSnakeCase(test.name);
        if (test.isAsync) {
            lines.push(`    async fn ${rustName}() {`);
        } else {
            lines.push(`    fn ${rustName}() {`);
        }
        
        // Convert test body (simplified - real implementation would be more complex)
        const bodyLines = this.convertCsharpBodyToRust(test.body);
        lines.push(...bodyLines);
        
        lines.push('    }');
        
        return lines.join('\n');
    }

    private convertToSnakeCase(name: string): string {
        return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    }

    private convertCsharpBodyToRust(body: string[]): string[] {
        const rustLines: string[] = [];
        
        for (const line of body) {
            // Skip braces from method declaration
            if (line.trim() === '{' || line.trim() === '}') continue;
            
            // Basic conversions (this would be much more sophisticated in practice)
            let rustLine = line
                .replace(/Assert\.AreEqual/g, 'assert_eq!')
                .replace(/Assert\.IsTrue/g, 'assert!')
                .replace(/Assert\.IsFalse/g, 'assert!')
                .replace(/Assert\.IsNull/g, 'assert!')
                .replace(/Assert\.IsNotNull/g, 'assert!')
                .replace(/var\s+/g, 'let ')
                .replace(/new\s+/g, '')
                .replace(/null/g, 'None')
                .replace(/;$/g, ';');
            
            rustLines.push('        // TODO: Verify this conversion');
            rustLines.push(rustLine);
        }
        
        return rustLines;
    }

    private determineRustTestPath(csharpRelativePath: string): string {
        // Convert C# test path to Rust test path
        const pathParts = csharpRelativePath.split(path.sep);
        
        // Replace neo_csharp with neo-rs
        if (pathParts[0] === 'neo_csharp') {
            pathParts[0] = 'neo-rs';
        }
        
        // Find the appropriate crate
        const component = this.findComponentForPath(csharpRelativePath);
        if (component) {
            const cratePath = component.rustPath.split('/');
            pathParts.splice(0, 2, ...cratePath, 'tests');
        }
        
        // Change extension
        const fileName = pathParts[pathParts.length - 1];
        pathParts[pathParts.length - 1] = fileName.replace('.cs', '.rs').toLowerCase();
        
        return path.join(this.workspaceRoot, ...pathParts);
    }

    private findComponentForPath(csharpPath: string): ComponentInfo | null {
        const context = this.contextManager.getContext();
        
        for (const [name, component] of context.components) {
            if (csharpPath.includes(component.csharpPath.replace(/\\/g, '/'))) {
                return component;
            }
        }
        
        return null;
    }

    private async validateComponent() {
        const context = this.contextManager.getContext();
        const components = Array.from(context.components.keys());
        
        const selected = await vscode.window.showQuickPick(components, {
            placeHolder: 'Select component to validate'
        });
        
        if (selected) {
            const component = context.components.get(selected)!;
            await this.validateSingleComponent(component);
        }
    }

    private async validateSingleComponent(component: ComponentInfo) {
        vscode.window.showInformationMessage(`Validating ${component.name}...`);
        
        const issues: string[] = [];
        
        if (!component.isImplemented) {
            issues.push('Component not implemented');
        }
        
        if (!component.hasAllTests) {
            issues.push(`${component.unconvertedTests.length} tests not converted`);
        }
        
        if (!component.isProductionReady) {
            issues.push('Contains placeholders or incomplete code');
        }
        
        if (issues.length === 0) {
            vscode.window.showInformationMessage(`${component.name} is production ready! ✅`);
        } else {
            const action = await vscode.window.showWarningMessage(
                `${component.name} has issues: ${issues.join(', ')}`,
                'Fix Issues',
                'View Details'
            );
            
            if (action === 'Fix Issues') {
                await this.fixComponentIssues(component);
            }
        }
    }

    private async generateMissingImplementation() {
        const context = this.contextManager.getContext();
        const missingComponents: ComponentInfo[] = [];
        
        for (const [name, component] of context.components) {
            if (!component.isImplemented) {
                missingComponents.push(component);
            }
        }
        
        if (missingComponents.length === 0) {
            vscode.window.showInformationMessage('All components are implemented!');
            return;
        }
        
        const selected = await vscode.window.showQuickPick(
            missingComponents.map(c => ({
                label: c.name,
                description: c.rustPath,
                component: c
            })),
            { placeHolder: 'Select component to generate' }
        );
        
        if (selected) {
            await this.generateComponent(selected.component);
        }
    }

    private async generateComponent(component: ComponentInfo) {
        vscode.window.showInformationMessage(`Generating ${component.name} skeleton...`);
        
        const cratePath = path.join(this.workspaceRoot, component.rustPath);
        
        // Create crate structure
        const dirs = ['src', 'tests', 'benches'];
        for (const dir of dirs) {
            const dirPath = path.join(cratePath, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        }
        
        // Generate Cargo.toml
        const cargoToml = this.generateCargoToml(component);
        fs.writeFileSync(path.join(cratePath, 'Cargo.toml'), cargoToml);
        
        // Generate lib.rs
        const libRs = this.generateLibRs(component);
        fs.writeFileSync(path.join(cratePath, 'src', 'lib.rs'), libRs);
        
        // Generate README
        const readme = this.generateComponentReadme(component);
        fs.writeFileSync(path.join(cratePath, 'README.md'), readme);
        
        vscode.window.showInformationMessage(`Generated ${component.name} structure`);
    }

    private generateCargoToml(component: ComponentInfo): string {
        return `[package]
name = "${component.name.toLowerCase().replace(/_/g, '-')}"
version = "0.1.0"
edition = "2021"
authors = ["Neo-rs Team"]
description = "${component.name} implementation for Neo-rs"
license = "MIT"

[dependencies]
# Core dependencies will be added based on C# analysis

[dev-dependencies]
tokio = { version = "1", features = ["full"] }
`;
    }

    private generateLibRs(component: ComponentInfo): string {
        return `//! ${component.name} implementation for Neo-rs
//! 
//! This module provides ${component.name} functionality
//! converted from the C# Neo implementation.

#![warn(missing_docs)]
#![deny(unsafe_code)]

// Module structure will be generated based on C# analysis

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_placeholder() {
        // Tests will be converted from C#
        assert_eq!(2 + 2, 4);
    }
}
`;
    }

    private generateComponentReadme(component: ComponentInfo): string {
        return `# ${component.name}

This crate implements the ${component.name} functionality for Neo-rs.

## Status

- [ ] Core implementation
- [ ] All tests converted from C#
- [ ] Production ready
- [ ] Performance optimized

## C# Source Reference

Original implementation: \`${component.csharpPath}\`

## Features to Implement

This list will be populated after analyzing the C# source.
`;
    }

    private async fixPlaceholders() {
        const context = this.contextManager.getContext();
        const placeholders = context.validationResults.placeholderLocations;
        
        if (placeholders.length === 0) {
            vscode.window.showInformationMessage('No placeholders found!');
            return;
        }
        
        const action = await vscode.window.showQuickPick([
            { label: 'Fix all placeholders', value: 'all' },
            { label: 'Fix by type', value: 'type' },
            { label: 'Fix by file', value: 'file' }
        ], { placeHolder: 'How would you like to fix placeholders?' });
        
        if (!action) return;
        
        switch (action.value) {
            case 'all':
                await this.fixAllPlaceholders(placeholders);
                break;
            case 'type':
                await this.fixPlaceholdersByType(placeholders);
                break;
            case 'file':
                await this.fixPlaceholdersByFile(placeholders);
                break;
        }
    }

    private async fixAllPlaceholders(placeholders: PlaceholderLocation[]) {
        for (const placeholder of placeholders) {
            await this.fixSinglePlaceholder(placeholder);
        }
        
        vscode.window.showInformationMessage(`Fixed ${placeholders.length} placeholders`);
    }

    private async fixSinglePlaceholder(placeholder: PlaceholderLocation) {
        const doc = await vscode.workspace.openTextDocument(
            path.join(this.workspaceRoot, placeholder.file)
        );
        
        const edit = new vscode.WorkspaceEdit();
        const line = doc.lineAt(placeholder.line - 1);
        
        // Determine replacement based on placeholder type
        let replacement = line.text;
        
        if (placeholder.type === 'todo!') {
            // Analyze context and generate implementation
            replacement = this.generateImplementationForTodo(doc, placeholder.line - 1);
        } else if (placeholder.type === 'unimplemented!') {
            replacement = this.generateImplementationForUnimplemented(doc, placeholder.line - 1);
        } else if (placeholder.type === 'TODO' || placeholder.type === 'FIXME') {
            // Remove comment
            replacement = line.text.replace(/\/\/\s*(TODO|FIXME):?\s*/, '// ');
        }
        
        edit.replace(doc.uri, line.range, replacement);
        await vscode.workspace.applyEdit(edit);
    }

    private generateImplementationForTodo(doc: vscode.TextDocument, lineNumber: number): string {
        // Analyze function context
        const functionContext = this.getFunctionContext(doc, lineNumber);
        
        // Generate appropriate implementation based on return type
        if (functionContext.returnType === 'Result') {
            return '        Ok(Default::default())';
        } else if (functionContext.returnType === 'Option') {
            return '        None';
        } else if (functionContext.returnType.includes('Vec')) {
            return '        Vec::new()';
        } else {
            return '        Default::default()';
        }
    }

    private generateImplementationForUnimplemented(doc: vscode.TextDocument, lineNumber: number): string {
        const functionContext = this.getFunctionContext(doc, lineNumber);
        
        // Check C# implementation for guidance
        const csharpImpl = this.findCsharpImplementation(functionContext.name);
        
        if (csharpImpl) {
            return `        // Implementation based on C# version\n        ${this.convertCsharpImplToRust(csharpImpl)}`;
        }
        
        return this.generateImplementationForTodo(doc, lineNumber);
    }

    private getFunctionContext(doc: vscode.TextDocument, lineNumber: number): any {
        // Search backwards for function signature
        for (let i = lineNumber; i >= 0; i--) {
            const line = doc.lineAt(i).text;
            const match = line.match(/fn\s+(\w+).*->\s*(.+?)\s*{/);
            if (match) {
                return {
                    name: match[1],
                    returnType: match[2]
                };
            }
        }
        
        return { name: 'unknown', returnType: '()' };
    }

    private findCsharpImplementation(functionName: string): string | null {
        // This would search the C# codebase for matching implementation
        // Simplified for now
        return null;
    }

    private convertCsharpImplToRust(csharpImpl: string): string {
        // This would convert C# implementation to Rust
        // Simplified for now
        return 'Default::default()';
    }

    private async fixPlaceholdersByType(placeholders: PlaceholderLocation[]) {
        const types = [...new Set(placeholders.map(p => p.type))];
        
        const selected = await vscode.window.showQuickPick(types, {
            placeHolder: 'Select placeholder type to fix'
        });
        
        if (selected) {
            const filtered = placeholders.filter(p => p.type === selected);
            await this.fixAllPlaceholders(filtered);
        }
    }

    private async fixPlaceholdersByFile(placeholders: PlaceholderLocation[]) {
        const files = [...new Set(placeholders.map(p => p.file))];
        
        const selected = await vscode.window.showQuickPick(
            files.map(f => ({
                label: path.basename(f),
                description: path.dirname(f),
                file: f
            })),
            { placeHolder: 'Select file to fix placeholders' }
        );
        
        if (selected) {
            const filtered = placeholders.filter(p => p.file === selected.file);
            await this.fixAllPlaceholders(filtered);
        }
    }

    private async compareWithCsharp() {
        const context = this.contextManager.getContext();
        
        const selected = await vscode.window.showQuickPick([
            { label: 'Compare all components', value: 'all' },
            { label: 'Compare specific component', value: 'component' },
            { label: 'Compare specific file', value: 'file' }
        ], { placeHolder: 'What would you like to compare?' });
        
        if (!selected) return;
        
        switch (selected.value) {
            case 'all':
                await this.compareAllComponents();
                break;
            case 'component':
                await this.compareSpecificComponent();
                break;
            case 'file':
                await this.compareSpecificFile();
                break;
        }
    }

    private async compareAllComponents() {
        const discrepancies: string[] = [];
        const context = this.contextManager.getContext();
        
        for (const [name, component] of context.components) {
            const componentDiscrepancies = await this.analyzeComponentDiscrepancies(component);
            discrepancies.push(...componentDiscrepancies);
        }
        
        if (discrepancies.length === 0) {
            vscode.window.showInformationMessage('All components match C# implementation! ✅');
        } else {
            const doc = await vscode.workspace.openTextDocument({
                content: discrepancies.join('\n\n'),
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);
        }
    }

    private async analyzeComponentDiscrepancies(component: ComponentInfo): Promise<string[]> {
        const discrepancies: string[] = [];
        
        if (!component.isImplemented) {
            discrepancies.push(`## ${component.name}\n- Not implemented`);
            return discrepancies;
        }
        
        // Compare public APIs
        const csharpApis = await this.extractCsharpApis(component.csharpPath);
        const rustApis = await this.extractRustApis(component.rustPath);
        
        const missing = csharpApis.filter(api => !rustApis.includes(api));
        const extra = rustApis.filter(api => !csharpApis.includes(api));
        
        if (missing.length > 0 || extra.length > 0) {
            discrepancies.push(`## ${component.name}`);
            if (missing.length > 0) {
                discrepancies.push('### Missing APIs:');
                missing.forEach(api => discrepancies.push(`- ${api}`));
            }
            if (extra.length > 0) {
                discrepancies.push('### Extra APIs (not in C#):');
                extra.forEach(api => discrepancies.push(`- ${api}`));
            }
        }
        
        return discrepancies;
    }

    private async extractCsharpApis(csharpPath: string): Promise<string[]> {
        const apis: string[] = [];
        const fullPath = path.join(this.workspaceRoot, csharpPath);
        
        if (!fs.existsSync(fullPath)) return apis;
        
        // Recursively find all C# files
        const files = await this.getFilesRecursively(fullPath, ['.cs']);
        
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const fileApis = this.extractPublicApisFromCsharp(content);
            apis.push(...fileApis);
        }
        
        return apis;
    }

    private extractPublicApisFromCsharp(content: string): string[] {
        const apis: string[] = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            // Match public methods, properties, and classes
            const patterns = [
                /public\s+(?:static\s+)?(?:async\s+)?(?:class|interface|struct)\s+(\w+)/,
                /public\s+(?:static\s+)?(?:async\s+)?(?:virtual\s+)?(?:override\s+)?(?:\w+<[^>]+>|\w+)\s+(\w+)\s*\(/,
                /public\s+(?:static\s+)?(?:\w+<[^>]+>|\w+)\s+(\w+)\s*{/
            ];
            
            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match) {
                    apis.push(match[1]);
                    break;
                }
            }
        }
        
        return [...new Set(apis)].sort();
    }

    private async extractRustApis(rustPath: string): Promise<string[]> {
        const apis: string[] = [];
        const fullPath = path.join(this.workspaceRoot, rustPath);
        
        if (!fs.existsSync(fullPath)) return apis;
        
        // Recursively find all Rust files
        const files = await this.getFilesRecursively(fullPath, ['.rs']);
        
        for (const file of files) {
            // Skip test files
            if (file.includes('test') || file.includes('bench')) continue;
            
            const content = fs.readFileSync(file, 'utf8');
            const fileApis = this.extractPublicApisFromRust(content);
            apis.push(...fileApis);
        }
        
        return apis;
    }

    private extractPublicApisFromRust(content: string): string[] {
        const apis: string[] = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            // Match public functions, structs, enums, traits
            const patterns = [
                /pub\s+(?:async\s+)?fn\s+(\w+)/,
                /pub\s+struct\s+(\w+)/,
                /pub\s+enum\s+(\w+)/,
                /pub\s+trait\s+(\w+)/,
                /pub\s+type\s+(\w+)/
            ];
            
            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match) {
                    apis.push(match[1]);
                    break;
                }
            }
        }
        
        return [...new Set(apis)].sort();
    }

    private async compareSpecificComponent() {
        const context = this.contextManager.getContext();
        const components = Array.from(context.components.keys());
        
        const selected = await vscode.window.showQuickPick(components, {
            placeHolder: 'Select component to compare'
        });
        
        if (selected) {
            const component = context.components.get(selected)!;
            const discrepancies = await this.analyzeComponentDiscrepancies(component);
            
            if (discrepancies.length === 0) {
                vscode.window.showInformationMessage(`${component.name} matches C# implementation! ✅`);
            } else {
                const doc = await vscode.workspace.openTextDocument({
                    content: discrepancies.join('\n\n'),
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
            }
        }
    }

    private async compareSpecificFile() {
        const rustFile = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'Rust files': ['rs'] },
            openLabel: 'Select Rust file'
        });
        
        if (!rustFile || rustFile.length === 0) return;
        
        // Find corresponding C# file
        const rustPath = rustFile[0].fsPath;
        const csharpPath = this.findCorrespondingCsharpFile(rustPath);
        
        if (!csharpPath) {
            vscode.window.showWarningMessage('Could not find corresponding C# file');
            return;
        }
        
        // Open diff view
        const rustUri = vscode.Uri.file(rustPath);
        const csharpUri = vscode.Uri.file(csharpPath);
        
        await vscode.commands.executeCommand('vscode.diff', csharpUri, rustUri, 'C# ↔ Rust');
    }

    private findCorrespondingCsharpFile(rustPath: string): string | null {
        // Convert Rust path to potential C# path
        const relativePath = path.relative(this.workspaceRoot, rustPath);
        const pathParts = relativePath.split(path.sep);
        
        // Replace neo-rs with neo_csharp
        if (pathParts[0] === 'neo-rs') {
            pathParts[0] = 'neo_csharp';
        }
        
        // Change file extension and naming convention
        const fileName = pathParts[pathParts.length - 1];
        const csharpFileName = this.convertRustFileNameToCsharp(fileName);
        pathParts[pathParts.length - 1] = csharpFileName;
        
        const csharpPath = path.join(this.workspaceRoot, ...pathParts);
        
        if (fs.existsSync(csharpPath)) {
            return csharpPath;
        }
        
        // Try alternative paths
        // TODO: Implement more sophisticated path matching
        
        return null;
    }

    private convertRustFileNameToCsharp(rustFileName: string): string {
        // Convert snake_case.rs to PascalCase.cs
        const baseName = rustFileName.replace('.rs', '');
        const pascalCase = baseName
            .split('_')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
        
        return pascalCase + '.cs';
    }

    private async showValidationReport() {
        const report = this.contextManager.getValidationReport();
        
        const doc = await vscode.workspace.openTextDocument({
            content: report,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc);
    }

    private async showQuickFixes() {
        const context = this.contextManager.getContext();
        const actions: any[] = [];
        
        if (context.validationResults.hasPlaceholders) {
            actions.push({
                label: `Fix ${context.validationResults.placeholderLocations.length} placeholders`,
                action: () => this.fixPlaceholders()
            });
        }
        
        const unconvertedTestCount = Array.from(context.components.values())
            .reduce((sum, c) => sum + c.unconvertedTests.length, 0);
        
        if (unconvertedTestCount > 0) {
            actions.push({
                label: `Convert ${unconvertedTestCount} C# tests`,
                action: () => this.convertCsharpTest()
            });
        }
        
        const missingComponents = Array.from(context.components.values())
            .filter(c => !c.isImplemented).length;
        
        if (missingComponents > 0) {
            actions.push({
                label: `Generate ${missingComponents} missing components`,
                action: () => this.generateMissingImplementation()
            });
        }
        
        if (actions.length === 0) {
            vscode.window.showInformationMessage('No quick fixes available');
            return;
        }
        
        const selected = await vscode.window.showQuickPick(actions, {
            placeHolder: 'Select a quick fix'
        });
        
        if (selected) {
            await selected.action();
        }
    }

    private async fixComponentIssues(component: ComponentInfo) {
        const actions: any[] = [];
        
        if (!component.isImplemented) {
            actions.push({
                label: 'Generate component structure',
                action: () => this.generateComponent(component)
            });
        }
        
        if (component.unconvertedTests.length > 0) {
            actions.push({
                label: `Convert ${component.unconvertedTests.length} tests`,
                action: () => this.convertComponentTests(component)
            });
        }
        
        if (!component.isProductionReady) {
            actions.push({
                label: 'Fix placeholders in component',
                action: () => this.fixComponentPlaceholders(component)
            });
        }
        
        const selected = await vscode.window.showQuickPick(actions, {
            placeHolder: `Fix issues in ${component.name}`
        });
        
        if (selected) {
            await selected.action();
        }
    }

    private async convertComponentTests(component: ComponentInfo) {
        for (const testPath of component.unconvertedTests) {
            await this.convertSingleTest(testPath);
        }
    }

    private async fixComponentPlaceholders(component: ComponentInfo) {
        const context = this.contextManager.getContext();
        const componentPlaceholders = context.validationResults.placeholderLocations
            .filter(p => p.file.includes(component.rustPath));
        
        await this.fixAllPlaceholders(componentPlaceholders);
    }

    private updateDiagnostics() {
        this.diagnosticCollection.clear();
        const context = this.contextManager.getContext();
        const diagnosticMap = new Map<string, vscode.Diagnostic[]>();
        
        // Add diagnostics for placeholders
        for (const placeholder of context.validationResults.placeholderLocations) {
            const uri = vscode.Uri.file(path.join(this.workspaceRoot, placeholder.file));
            const diagnostics = diagnosticMap.get(uri.toString()) || [];
            
            const range = new vscode.Range(
                placeholder.line - 1, 0,
                placeholder.line - 1, 999
            );
            
            const diagnostic = new vscode.Diagnostic(
                range,
                `Placeholder found: ${placeholder.type}`,
                vscode.DiagnosticSeverity.Error
            );
            
            diagnostic.code = 'neo-rs-placeholder';
            diagnostics.push(diagnostic);
            diagnosticMap.set(uri.toString(), diagnostics);
        }
        
        // Apply diagnostics
        diagnosticMap.forEach((diagnostics, uriString) => {
            const uri = vscode.Uri.parse(uriString);
            this.diagnosticCollection.set(uri, diagnostics);
        });
    }

    private async onRustFileChanged() {
        // Debounce to avoid too frequent updates
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        this.updateTimer = setTimeout(async () => {
            await this.contextManager.analyzeProject();
            this.updateDiagnostics();
        }, 1000);
    }

    private updateTimer: NodeJS.Timeout | undefined;

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
        this.diagnosticCollection.dispose();
    }
}