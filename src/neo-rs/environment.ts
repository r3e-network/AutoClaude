import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

export interface NeoRsEnvironment {
    // Rust toolchain
    rustVersion: string;
    cargoVersion: string;
    rustupVersion: string;
    rustToolchain: string; // stable, nightly, etc.
    rustTarget: string; // x86_64-unknown-linux-gnu, etc.
    hasClippy: boolean;
    hasRustfmt: boolean;
    hasTarpaulin: boolean; // for code coverage
    
    // C# environment
    dotnetVersion: string;
    dotnetSdkVersion: string;
    dotnetRuntimeVersion: string;
    msbuildVersion: string;
    hasDotnetFormat: boolean;
    
    // Neo-specific
    neoCliVersion: string;
    neoCsharpPath: string;
    neoCsharpVersion: string;
    neoRsPath: string;
    neoRsVersion: string;
    neoRsCrates: NeoRsCrate[];
    
    // Development tools
    hasGit: boolean;
    gitVersion: string;
    hasDocker: boolean;
    dockerVersion: string;
    
    // Environment status
    isValid: boolean;
    issues: EnvironmentIssue[];
}

export interface NeoRsCrate {
    name: string;
    path: string;
    version: string;
    dependencies: string[];
    hasTests: boolean;
    testCount: number;
    isPublished: boolean;
}

export interface EnvironmentIssue {
    severity: 'error' | 'warning' | 'info';
    component: string;
    message: string;
    suggestion: string;
}

export class NeoRsEnvironmentDetector {
    private workspaceRoot: string;
    private environment: NeoRsEnvironment;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.environment = this.createEmptyEnvironment();
    }

    private createEmptyEnvironment(): NeoRsEnvironment {
        return {
            rustVersion: '',
            cargoVersion: '',
            rustupVersion: '',
            rustToolchain: '',
            rustTarget: '',
            hasClippy: false,
            hasRustfmt: false,
            hasTarpaulin: false,
            dotnetVersion: '',
            dotnetSdkVersion: '',
            dotnetRuntimeVersion: '',
            msbuildVersion: '',
            hasDotnetFormat: false,
            neoCliVersion: '',
            neoCsharpPath: '',
            neoCsharpVersion: '',
            neoRsPath: '',
            neoRsVersion: '',
            neoRsCrates: [],
            hasGit: false,
            gitVersion: '',
            hasDocker: false,
            dockerVersion: '',
            isValid: false,
            issues: []
        };
    }

    async detectEnvironment(): Promise<NeoRsEnvironment> {
        vscode.window.showInformationMessage('🔍 Detecting Neo-rs development environment...');
        
        // Detect Rust toolchain
        await this.detectRustToolchain();
        
        // Detect C# environment
        await this.detectDotNetEnvironment();
        
        // Detect Neo-specific paths and versions
        await this.detectNeoEnvironment();
        
        // Detect development tools
        await this.detectDevelopmentTools();
        
        // Validate environment
        this.validateEnvironment();
        
        // Auto-configure if needed
        if (!this.environment.isValid) {
            await this.autoConfigureEnvironment();
        }
        
        return this.environment;
    }

    private async detectRustToolchain() {
        try {
            // Rust version
            const rustVersion = execSync('rustc --version', { encoding: 'utf8' }).trim();
            this.environment.rustVersion = rustVersion;
            
            // Cargo version
            const cargoVersion = execSync('cargo --version', { encoding: 'utf8' }).trim();
            this.environment.cargoVersion = cargoVersion;
            
            // Rustup version
            try {
                const rustupVersion = execSync('rustup --version', { encoding: 'utf8' }).trim();
                this.environment.rustupVersion = rustupVersion;
                
                // Get active toolchain
                const toolchainInfo = execSync('rustup show active-toolchain', { encoding: 'utf8' }).trim();
                this.environment.rustToolchain = toolchainInfo.split(' ')[0];
                
                // Get default target
                const targetInfo = execSync('rustc -vV', { encoding: 'utf8' });
                const targetMatch = targetInfo.match(/host:\s*(.+)/);
                if (targetMatch) {
                    this.environment.rustTarget = targetMatch[1].trim();
                }
            } catch {
                this.environment.issues.push({
                    severity: 'warning',
                    component: 'rustup',
                    message: 'Rustup not found',
                    suggestion: 'Install rustup from https://rustup.rs'
                });
            }
            
            // Check for Clippy
            try {
                execSync('cargo clippy --version', { encoding: 'utf8' });
                this.environment.hasClippy = true;
            } catch {
                this.environment.issues.push({
                    severity: 'warning',
                    component: 'clippy',
                    message: 'Clippy not installed',
                    suggestion: 'Run: rustup component add clippy'
                });
            }
            
            // Check for rustfmt
            try {
                execSync('cargo fmt --version', { encoding: 'utf8' });
                this.environment.hasRustfmt = true;
            } catch {
                this.environment.issues.push({
                    severity: 'warning',
                    component: 'rustfmt',
                    message: 'Rustfmt not installed',
                    suggestion: 'Run: rustup component add rustfmt'
                });
            }
            
            // Check for tarpaulin (coverage tool)
            try {
                execSync('cargo tarpaulin --version', { encoding: 'utf8' });
                this.environment.hasTarpaulin = true;
            } catch {
                // Optional tool, just note it's missing
                this.environment.issues.push({
                    severity: 'info',
                    component: 'tarpaulin',
                    message: 'Tarpaulin not installed (optional)',
                    suggestion: 'For coverage: cargo install cargo-tarpaulin'
                });
            }
            
        } catch (error) {
            this.environment.issues.push({
                severity: 'error',
                component: 'rust',
                message: 'Rust toolchain not found',
                suggestion: 'Install Rust from https://rustup.rs'
            });
        }
    }

    private async detectDotNetEnvironment() {
        try {
            // .NET version
            const dotnetInfo = execSync('dotnet --info', { encoding: 'utf8' });
            
            // Parse .NET SDK version
            const sdkMatch = dotnetInfo.match(/Version:\s*(\d+\.\d+\.\d+)/);
            if (sdkMatch) {
                this.environment.dotnetSdkVersion = sdkMatch[1];
                this.environment.dotnetVersion = sdkMatch[1];
            }
            
            // Parse runtime version
            const runtimeMatch = dotnetInfo.match(/Microsoft\.NETCore\.App\s+(\d+\.\d+\.\d+)/);
            if (runtimeMatch) {
                this.environment.dotnetRuntimeVersion = runtimeMatch[1];
            }
            
            // MSBuild version
            try {
                const msbuildVersion = execSync('msbuild -version -nologo', { encoding: 'utf8' }).trim();
                this.environment.msbuildVersion = msbuildVersion.split('\n')[0];
            } catch {
                // MSBuild might be in dotnet
                try {
                    const dotnetMsbuild = execSync('dotnet msbuild -version', { encoding: 'utf8' }).trim();
                    this.environment.msbuildVersion = dotnetMsbuild;
                } catch {
                    this.environment.issues.push({
                        severity: 'warning',
                        component: 'msbuild',
                        message: 'MSBuild not found',
                        suggestion: 'MSBuild is included with .NET SDK'
                    });
                }
            }
            
            // Check for dotnet-format
            try {
                execSync('dotnet format --version', { encoding: 'utf8' });
                this.environment.hasDotnetFormat = true;
            } catch {
                this.environment.issues.push({
                    severity: 'info',
                    component: 'dotnet-format',
                    message: 'dotnet-format not installed (optional)',
                    suggestion: 'Run: dotnet tool install -g dotnet-format'
                });
            }
            
        } catch (error) {
            this.environment.issues.push({
                severity: 'error',
                component: 'dotnet',
                message: '.NET SDK not found',
                suggestion: 'Install .NET SDK from https://dotnet.microsoft.com'
            });
        }
    }

    private async detectNeoEnvironment() {
        // Auto-detect Neo C# path
        const possibleCsharpPaths = [
            path.join(this.workspaceRoot, 'neo'),
            path.join(this.workspaceRoot, 'neo-csharp'),
            path.join(this.workspaceRoot, 'neo_csharp'),
            path.join(this.workspaceRoot, '../neo'),
            path.join(this.workspaceRoot, '../neo-csharp'),
        ];
        
        for (const csharpPath of possibleCsharpPaths) {
            if (fs.existsSync(path.join(csharpPath, 'neo.sln'))) {
                this.environment.neoCsharpPath = csharpPath;
                break;
            }
        }
        
        // Auto-detect Neo-rs path
        const possibleRustPaths = [
            path.join(this.workspaceRoot, 'neo-rs'),
            path.join(this.workspaceRoot, '../neo-rs'),
            this.workspaceRoot // Current directory might be neo-rs
        ];
        
        for (const rustPath of possibleRustPaths) {
            if (fs.existsSync(path.join(rustPath, 'Cargo.toml'))) {
                const cargoContent = fs.readFileSync(path.join(rustPath, 'Cargo.toml'), 'utf8');
                if (cargoContent.includes('neo') || cargoContent.includes('workspace')) {
                    this.environment.neoRsPath = rustPath;
                    break;
                }
            }
        }
        
        // Detect Neo C# version
        if (this.environment.neoCsharpPath) {
            try {
                const versionFile = path.join(this.environment.neoCsharpPath, 'src/Neo/Neo.csproj');
                if (fs.existsSync(versionFile)) {
                    const content = fs.readFileSync(versionFile, 'utf8');
                    const versionMatch = content.match(/<Version>(.+)<\/Version>/);
                    if (versionMatch) {
                        this.environment.neoCsharpVersion = versionMatch[1];
                    }
                }
                
                // Try to detect neo-cli version
                const neoCliPath = path.join(this.environment.neoCsharpPath, 'neo-cli');
                if (fs.existsSync(neoCliPath)) {
                    this.environment.neoCliVersion = 'Detected';
                }
            } catch {
                // Ignore errors in version detection
            }
        }
        
        // Detect Neo-rs crates and version
        if (this.environment.neoRsPath) {
            try {
                // Main Cargo.toml
                const mainCargoPath = path.join(this.environment.neoRsPath, 'Cargo.toml');
                if (fs.existsSync(mainCargoPath)) {
                    const content = fs.readFileSync(mainCargoPath, 'utf8');
                    const versionMatch = content.match(/version\s*=\s*"(.+)"/);
                    if (versionMatch) {
                        this.environment.neoRsVersion = versionMatch[1];
                    }
                    
                    // Detect workspace members
                    const membersMatch = content.match(/members\s*=\s*\[([\s\S]*?)\]/);
                    if (membersMatch) {
                        const members = membersMatch[1]
                            .split(',')
                            .map(m => m.trim().replace(/["\s]/g, ''))
                            .filter(m => m.length > 0);
                        
                        for (const member of members) {
                            const cratePath = path.join(this.environment.neoRsPath, member);
                            if (fs.existsSync(path.join(cratePath, 'Cargo.toml'))) {
                                const crate = await this.analyzeCrate(cratePath);
                                this.environment.neoRsCrates.push(crate);
                            }
                        }
                    }
                }
            } catch (error) {
                this.environment.issues.push({
                    severity: 'warning',
                    component: 'neo-rs',
                    message: 'Failed to analyze Neo-rs structure',
                    suggestion: 'Check Cargo.toml format'
                });
            }
        }
        
        // Validate paths
        if (!this.environment.neoCsharpPath) {
            this.environment.issues.push({
                severity: 'error',
                component: 'neo-csharp',
                message: 'Neo C# source not found',
                suggestion: 'Clone neo repository and configure path in neo-rs-config.json'
            });
        }
        
        if (!this.environment.neoRsPath) {
            this.environment.issues.push({
                severity: 'error',
                component: 'neo-rs',
                message: 'Neo-rs project not found',
                suggestion: 'Ensure you are in the neo-rs workspace'
            });
        }
    }

    private async analyzeCrate(cratePath: string): Promise<NeoRsCrate> {
        const crate: NeoRsCrate = {
            name: path.basename(cratePath),
            path: cratePath,
            version: '0.0.0',
            dependencies: [],
            hasTests: false,
            testCount: 0,
            isPublished: false
        };
        
        try {
            const cargoToml = fs.readFileSync(path.join(cratePath, 'Cargo.toml'), 'utf8');
            
            // Extract crate name
            const nameMatch = cargoToml.match(/name\s*=\s*"(.+)"/);
            if (nameMatch) {
                crate.name = nameMatch[1];
            }
            
            // Extract version
            const versionMatch = cargoToml.match(/version\s*=\s*"(.+)"/);
            if (versionMatch) {
                crate.version = versionMatch[1];
            }
            
            // Extract dependencies
            const depsMatch = cargoToml.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/);
            if (depsMatch) {
                const deps = depsMatch[1]
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'))
                    .map(line => line.split('=')[0].trim())
                    .filter(dep => dep.length > 0);
                crate.dependencies = deps;
            }
            
            // Check for tests
            const testsPath = path.join(cratePath, 'tests');
            const srcTestsPath = path.join(cratePath, 'src');
            
            if (fs.existsSync(testsPath)) {
                crate.hasTests = true;
                const testFiles = fs.readdirSync(testsPath).filter(f => f.endsWith('.rs'));
                crate.testCount += testFiles.length;
            }
            
            // Check for inline tests in src
            if (fs.existsSync(srcTestsPath)) {
                const srcFiles = this.findRustFiles(srcTestsPath);
                for (const file of srcFiles) {
                    const content = fs.readFileSync(file, 'utf8');
                    if (content.includes('#[test]') || content.includes('#[cfg(test)]')) {
                        crate.hasTests = true;
                        const testCount = (content.match(/#\[test\]/g) || []).length;
                        crate.testCount += testCount;
                    }
                }
            }
            
            // Check if published
            crate.isPublished = crate.version !== '0.0.0' && !crate.version.includes('-dev');
            
        } catch (error) {
            // Ignore errors for individual crates
        }
        
        return crate;
    }

    private findRustFiles(dir: string): string[] {
        const files: string[] = [];
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && item !== 'target') {
                files.push(...this.findRustFiles(fullPath));
            } else if (item.endsWith('.rs')) {
                files.push(fullPath);
            }
        }
        
        return files;
    }

    private async detectDevelopmentTools() {
        // Git
        try {
            const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
            this.environment.hasGit = true;
            this.environment.gitVersion = gitVersion;
        } catch {
            this.environment.issues.push({
                severity: 'error',
                component: 'git',
                message: 'Git not found',
                suggestion: 'Install Git from https://git-scm.com'
            });
        }
        
        // Docker (optional)
        try {
            const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
            this.environment.hasDocker = true;
            this.environment.dockerVersion = dockerVersion;
        } catch {
            // Docker is optional
        }
    }

    private validateEnvironment() {
        // Check critical components
        const hasRust = this.environment.rustVersion !== '';
        const hasDotNet = this.environment.dotnetVersion !== '';
        const hasNeoCsharp = this.environment.neoCsharpPath !== '';
        const hasNeoRs = this.environment.neoRsPath !== '';
        
        this.environment.isValid = hasRust && hasDotNet && hasNeoCsharp && hasNeoRs;
        
        // Add summary issue if not valid
        if (!this.environment.isValid) {
            const missing = [];
            if (!hasRust) missing.push('Rust');
            if (!hasDotNet) missing.push('.NET');
            if (!hasNeoCsharp) missing.push('Neo C# source');
            if (!hasNeoRs) missing.push('Neo-rs project');
            
            this.environment.issues.unshift({
                severity: 'error',
                component: 'environment',
                message: `Missing critical components: ${missing.join(', ')}`,
                suggestion: 'Install missing components or configure paths'
            });
        }
    }

    private async autoConfigureEnvironment() {
        const actions = [];
        
        // Offer to install missing Rust components
        if (this.environment.rustVersion && !this.environment.hasClippy) {
            actions.push({
                title: 'Install Clippy',
                command: 'rustup component add clippy'
            });
        }
        
        if (this.environment.rustVersion && !this.environment.hasRustfmt) {
            actions.push({
                title: 'Install Rustfmt',
                command: 'rustup component add rustfmt'
            });
        }
        
        // Offer to configure paths
        if (!this.environment.neoCsharpPath || !this.environment.neoRsPath) {
            actions.push({
                title: 'Configure Paths',
                command: 'configure'
            });
        }
        
        if (actions.length > 0) {
            const selection = await vscode.window.showQuickPick(
                actions.map(a => a.title),
                {
                    placeHolder: 'Select actions to auto-configure environment',
                    canPickMany: true
                }
            );
            
            if (selection) {
                for (const title of selection) {
                    const action = actions.find(a => a.title === title);
                    if (action) {
                        if (action.command === 'configure') {
                            await this.configurePaths();
                        } else {
                            try {
                                execSync(action.command, { stdio: 'inherit' });
                                vscode.window.showInformationMessage(`✅ ${title} completed`);
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to ${title}`);
                            }
                        }
                    }
                }
            }
        }
    }

    private async configurePaths() {
        const config: any = {};
        
        if (!this.environment.neoCsharpPath) {
            const csharpPath = await vscode.window.showInputBox({
                prompt: 'Enter path to Neo C# source code',
                placeHolder: '/path/to/neo',
                value: '../neo'
            });
            
            if (csharpPath) {
                config.csharpSourcePath = csharpPath;
            }
        }
        
        if (!this.environment.neoRsPath) {
            const rustPath = await vscode.window.showInputBox({
                prompt: 'Enter path to Neo-rs project',
                placeHolder: '/path/to/neo-rs',
                value: '.'
            });
            
            if (rustPath) {
                config.rustProjectPath = rustPath;
            }
        }
        
        // Update neo-rs-config.json
        const configPath = path.join(this.workspaceRoot, 'neo-rs-config.json');
        if (fs.existsSync(configPath)) {
            const existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            Object.assign(existing, config);
            fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
        } else {
            // Create from example
            const examplePath = path.join(this.workspaceRoot, 'neo-rs-config.example.json');
            if (fs.existsSync(examplePath)) {
                const example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
                Object.assign(example, config);
                fs.writeFileSync(configPath, JSON.stringify(example, null, 2));
            }
        }
        
        vscode.window.showInformationMessage('✅ Paths configured in neo-rs-config.json');
    }

    getEnvironmentReport(): string {
        const report: string[] = ['# Neo-rs Development Environment Report', ''];
        
        // Status
        report.push(`## Status: ${this.environment.isValid ? '✅ Valid' : '❌ Invalid'}`);
        report.push('');
        
        // Rust Environment
        report.push('## Rust Toolchain');
        report.push(`- Version: ${this.environment.rustVersion || 'Not found'}`);
        report.push(`- Cargo: ${this.environment.cargoVersion || 'Not found'}`);
        report.push(`- Toolchain: ${this.environment.rustToolchain || 'Unknown'}`);
        report.push(`- Target: ${this.environment.rustTarget || 'Unknown'}`);
        report.push(`- Clippy: ${this.environment.hasClippy ? '✅' : '❌'}`);
        report.push(`- Rustfmt: ${this.environment.hasRustfmt ? '✅' : '❌'}`);
        report.push(`- Tarpaulin: ${this.environment.hasTarpaulin ? '✅' : '❌'}`);
        report.push('');
        
        // .NET Environment
        report.push('## .NET Environment');
        report.push(`- SDK: ${this.environment.dotnetSdkVersion || 'Not found'}`);
        report.push(`- Runtime: ${this.environment.dotnetRuntimeVersion || 'Not found'}`);
        report.push(`- MSBuild: ${this.environment.msbuildVersion || 'Not found'}`);
        report.push(`- dotnet-format: ${this.environment.hasDotnetFormat ? '✅' : '❌'}`);
        report.push('');
        
        // Neo Environment
        report.push('## Neo Configuration');
        report.push(`- C# Path: ${this.environment.neoCsharpPath || 'Not found'}`);
        report.push(`- C# Version: ${this.environment.neoCsharpVersion || 'Unknown'}`);
        report.push(`- Neo-rs Path: ${this.environment.neoRsPath || 'Not found'}`);
        report.push(`- Neo-rs Version: ${this.environment.neoRsVersion || 'Unknown'}`);
        report.push('');
        
        // Neo-rs Crates
        if (this.environment.neoRsCrates.length > 0) {
            report.push('## Neo-rs Crates');
            for (const crate of this.environment.neoRsCrates) {
                report.push(`- **${crate.name}** v${crate.version}`);
                report.push(`  - Path: ${crate.path}`);
                report.push(`  - Tests: ${crate.hasTests ? `✅ (${crate.testCount})` : '❌'}`);
                report.push(`  - Dependencies: ${crate.dependencies.length}`);
            }
            report.push('');
        }
        
        // Development Tools
        report.push('## Development Tools');
        report.push(`- Git: ${this.environment.hasGit ? this.environment.gitVersion : 'Not found'}`);
        report.push(`- Docker: ${this.environment.hasDocker ? this.environment.dockerVersion : 'Not found'}`);
        report.push('');
        
        // Issues
        if (this.environment.issues.length > 0) {
            report.push('## Issues & Suggestions');
            for (const issue of this.environment.issues) {
                const icon = issue.severity === 'error' ? '❌' : 
                           issue.severity === 'warning' ? '⚠️' : 'ℹ️';
                report.push(`${icon} **${issue.component}**: ${issue.message}`);
                report.push(`   💡 ${issue.suggestion}`);
                report.push('');
            }
        }
        
        return report.join('\n');
    }

    async showEnvironmentDashboard() {
        const report = this.getEnvironmentReport();
        
        const doc = await vscode.workspace.openTextDocument({
            content: report,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc);
    }
}