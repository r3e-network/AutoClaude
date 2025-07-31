import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export interface DependencyCheckResult {
    available: boolean;
    version?: string;
    path?: string;
    error?: string;
    installInstructions?: string;
}

export async function checkClaudeInstallation(): Promise<DependencyCheckResult> {
    return new Promise((resolve) => {
        const process = spawn('claude', ['--version'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
        });

        let stdout = '';
        let stderr = '';

        process.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        const timeout = setTimeout(() => {
            process.kill();
            resolve({
                available: false,
                error: 'Command timeout - Claude CLI may not be installed',
                installInstructions: getClaudeInstallInstructions()
            });
        }, 5000);

        process.on('close', (code) => {
            clearTimeout(timeout);
            
            if (code === 0 && stdout.trim()) {
                resolve({
                    available: true,
                    version: stdout.trim(),
                    path: 'claude' // Could be enhanced to find actual path
                });
            } else {
                resolve({
                    available: false,
                    error: stderr.trim() || 'Claude CLI not found in PATH',
                    installInstructions: getClaudeInstallInstructions()
                });
            }
        });

        process.on('error', (error) => {
            clearTimeout(timeout);
            resolve({
                available: false,
                error: `Failed to check Claude installation: ${error.message}`,
                installInstructions: getClaudeInstallInstructions()
            });
        });
    });
}

export async function checkPythonInstallation(): Promise<DependencyCheckResult> {
    const platform = os.platform();
    
    // Platform-specific Python command preferences
    let pythonCommands: string[];
    
    switch (platform) {
        case 'win32': // Windows
            pythonCommands = ['python', 'python3', 'py'];
            break;
        case 'darwin': // macOS
            pythonCommands = ['python3', 'python'];
            break;
        case 'linux': // Linux
            pythonCommands = ['python3', 'python'];
            break;
        default:
            pythonCommands = ['python3', 'python', 'py'];
    }
    
    for (const cmd of pythonCommands) {
        const result = await checkCommand(cmd, ['--version']);
        if (result.available) {
            // Verify Python version is 3.8+
            const versionResult = await verifyPythonVersion(cmd);
            if (versionResult.valid) {
                return {
                    ...result,
                    version: versionResult.version
                };
            } else {
                return {
                    available: false,
                    error: `Python version too old: ${versionResult.version}. Need Python 3.8+`,
                    installInstructions: getPythonInstallInstructions()
                };
            }
        }
    }
    
    return {
        available: false,
        error: 'Python not found in PATH',
        installInstructions: getPythonInstallInstructions()
    };
}

async function verifyPythonVersion(pythonCommand: string): Promise<{valid: boolean; version: string}> {
    try {
        const result = await checkCommand(pythonCommand, ['-c', '\'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")\'']);
        
        if (result.available && result.version) {
            const version = result.version.trim();
            const [major, minor] = version.split('.').map(Number);
            
            // Require Python 3.8+
            const valid = major === 3 && minor >= 8;
            
            return { valid, version };
        }
        
        return { valid: false, version: 'unknown' };
    } catch (error) {
        return { valid: false, version: 'unknown' };
    }
}

export async function checkPtyWrapperFile(): Promise<DependencyCheckResult> {
    try {
        // Check multiple possible locations for the wrapper file
        const possiblePaths = [
            path.join(__dirname, '..', 'claude', 'session', 'claude_pty_wrapper.py'), // Bundled location
            path.join(__dirname, '..', '..', 'claude', 'session', 'claude_pty_wrapper.py'), // Development location
            path.join(__dirname, 'claude', 'session', 'claude_pty_wrapper.py'), // Alternative bundled location
        ];
        
        console.log('Checking PTY wrapper paths from __dirname:', __dirname);
        
        for (const wrapperPath of possiblePaths) {
            console.log('Checking PTY wrapper path:', wrapperPath);
            try {
                if (fs.existsSync(wrapperPath)) {
                    console.log('Found PTY wrapper at:', wrapperPath);
                    const stats = fs.statSync(wrapperPath);
                    if (stats.isFile()) {
                        // Test if file is readable
                        fs.accessSync(wrapperPath, fs.constants.R_OK);
                        console.log('PTY wrapper is readable:', wrapperPath);
                        return {
                            available: true,
                            path: wrapperPath
                        };
                    }
                } else {
                    console.log('PTY wrapper not found at:', wrapperPath);
                }
            } catch (error) {
                console.log('Error checking PTY wrapper path:', wrapperPath, error);
                // Try next path
                continue;
            }
        }
        
        return {
            available: false,
            error: 'Claude PTY wrapper file not found in any expected location',
            installInstructions: 'The extension may not be properly installed. Try reinstalling the extension.'
        };
    } catch (error) {
        return {
            available: false,
            error: `Failed to check PTY wrapper: ${error}`,
            installInstructions: 'Please check file permissions and try reinstalling the extension.'
        };
    }
}

async function checkCommand(command: string, args: string[]): Promise<DependencyCheckResult> {
    return new Promise((resolve) => {
        const process = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
        });

        let stdout = '';
        let stderr = '';

        process.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        const timeout = setTimeout(() => {
            process.kill();
            resolve({
                available: false,
                error: `Command timeout: ${command}`
            });
        }, 3000);

        process.on('close', (code) => {
            clearTimeout(timeout);
            
            if (code === 0) {
                resolve({
                    available: true,
                    version: stdout.trim() || stderr.trim(),
                    path: command
                });
            } else {
                resolve({
                    available: false,
                    error: `Command failed: ${command}`
                });
            }
        });

        process.on('error', () => {
            clearTimeout(timeout);
            resolve({
                available: false,
                error: `Command not found: ${command}`
            });
        });
    });
}

function getClaudeInstallInstructions(): string {
    const platform = os.platform();
    
    switch (platform) {
        case 'darwin': // macOS
            return `To install Claude Code on macOS:
1. Visit https://www.anthropic.com/claude-code
2. Follow the installation instructions for macOS
3. Restart VS Code after installation`;
        
        case 'win32': // Windows
            return `To install Claude Code on Windows:
1. Visit https://www.anthropic.com/claude-code
2. Download the Windows installer
3. Run the installer as administrator
4. Restart VS Code after installation
5. Make sure Claude Code is in your PATH`;
        
        case 'linux': // Linux
            return `To install Claude Code on Linux:
1. Visit https://www.anthropic.com/claude-code
2. Follow the installation instructions for Linux
3. You may need to download and install manually
4. Make sure Claude Code is in your PATH
5. Restart VS Code after installation`;
        
        default:
            return `To install Claude Code:
1. Visit https://www.anthropic.com/claude-code
2. Follow the installation instructions for your platform
3. Make sure Claude Code is in your PATH
4. Restart VS Code after installation`;
    }
}

function getPythonInstallInstructions(): string {
    const platform = os.platform();
    
    switch (platform) {
        case 'darwin': // macOS
            return `To install Python on macOS:
1. Visit https://python.org/downloads
2. Download Python 3.8 or later
3. Or use brew: 'brew install python3'
4. Restart VS Code after installation`;
        
        case 'win32': // Windows
            return `To install Python on Windows:
1. Visit https://python.org/downloads
2. Download Python 3.8 or later
3. Make sure to check "Add Python to PATH" during installation
4. Restart VS Code after installation`;
        
        case 'linux': // Linux
            return `To install Python on Linux:
1. Use your package manager: 'sudo apt install python3' (Ubuntu/Debian)
2. Or 'sudo yum install python3' (RedHat/CentOS)
3. Or 'sudo pacman -S python' (Arch)
4. Restart VS Code after installation`;
        
        default:
            return `To install Python:
1. Visit https://python.org/downloads
2. Download Python 3.8 or later for your platform
3. Make sure Python is in your PATH
4. Restart VS Code after installation`;
    }
}

export async function runDependencyCheck(): Promise<{
    claude: DependencyCheckResult;
    python: DependencyCheckResult;
    wrapper: DependencyCheckResult;
    allReady: boolean;
}> {
    const [claude, python, wrapper] = await Promise.all([
        checkClaudeInstallation(),
        checkPythonInstallation(),
        checkPtyWrapperFile()
    ]);

    const allReady = claude.available && python.available && wrapper.available;

    return { claude, python, wrapper, allReady };
}

export function showDependencyStatus(results: Awaited<ReturnType<typeof runDependencyCheck>>): void {
    const { claude, python, wrapper, allReady } = results;
    
    if (allReady) {
        vscode.window.showInformationMessage(
            `✅ All dependencies ready! Claude: ${claude.version}, Python: ${python.version}`
        );
        return;
    }

    // Show issues
    const issues: string[] = [];
    
    if (!claude.available) {
        issues.push(`❌ Claude Code: ${claude.error}`);
    }
    
    if (!python.available) {
        issues.push(`❌ Python: ${python.error}`);
    }
    
    if (!wrapper.available) {
        issues.push(`❌ PTY Wrapper: ${wrapper.error}`);
    }

    const message = `Dependencies missing:\n${issues.join('\n')}`;
    
    vscode.window.showErrorMessage(
        'AutoClaude: Missing Dependencies',
        'Show Instructions',
        'Retry Check'
    ).then(selection => {
        if (selection === 'Show Instructions') {
            showInstallationInstructions(results);
        } else if (selection === 'Retry Check') {
            // Re-run check
            runDependencyCheck().then(showDependencyStatus, error => {
                vscode.window.showErrorMessage(`Dependency check failed: ${error instanceof Error ? error.message : String(error)}`);
            });
        }
    });
}

function showInstallationInstructions(results: Awaited<ReturnType<typeof runDependencyCheck>>): void {
    const { claude, python, wrapper } = results;
    
    let instructions = 'AutoClaude Installation Requirements:\n\n';
    
    if (!claude.available) {
        instructions += `🔴 Claude Code Missing:\n${claude.installInstructions}\n\n`;
    } else {
        instructions += `✅ Claude Code: ${claude.version}\n\n`;
    }
    
    if (!python.available) {
        instructions += `🔴 Python Missing:\n${python.installInstructions}\n\n`;
    } else {
        instructions += `✅ Python: ${python.version}\n\n`;
    }
    
    if (!wrapper.available) {
        instructions += `🔴 PTY Wrapper Missing:\n${wrapper.installInstructions}\n\n`;
    } else {
        instructions += `✅ PTY Wrapper: Ready\n\n`;
    }
    
    instructions += 'After installing dependencies, restart VS Code and try again.';
    
    // Create and show a new document with instructions
    vscode.workspace.openTextDocument({
        content: instructions,
        language: 'markdown'
    }).then(doc => {
        vscode.window.showTextDocument(doc);
    }, error => {
        vscode.window.showErrorMessage(`Failed to show installation instructions: ${error instanceof Error ? error.message : String(error)}`);
        // Fallback to information message
        vscode.window.showInformationMessage(instructions);
    });
}