/**
 * Improved Dependency Check
 * Better detection of installed tools across different environments
 */

import { spawn, execSync } from "child_process";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { debugLog } from "../../utils/logging";

export interface DependencyCheckResult {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
  installInstructions?: string;
}

/**
 * Check for Claude installation with multiple strategies
 */
export async function checkClaudeInstallation(): Promise<DependencyCheckResult> {
  debugLog("[DependencyCheck] Checking for Claude CLI installation...");
  
  // Strategy 1: Try common installation paths first
  const commonPaths = getCommonClaudePaths();
  for (const claudePath of commonPaths) {
    debugLog(`[DependencyCheck] Checking path: ${claudePath}`);
    if (fs.existsSync(claudePath)) {
      try {
        const version = execSync(`"${claudePath}" --version`, { 
          encoding: 'utf8',
          timeout: 3000 
        }).trim();
        
        debugLog(`[DependencyCheck] Found Claude at ${claudePath}: ${version}`);
        return {
          available: true,
          version,
          path: claudePath
        };
      } catch (error) {
        debugLog(`[DependencyCheck] Failed to get version from ${claudePath}: ${error}`);
      }
    }
  }
  
  // Strategy 2: Try using 'which' or 'where' command
  try {
    const whichCmd = os.platform() === 'win32' ? 'where' : 'which';
    const claudePath = execSync(`${whichCmd} claude`, { 
      encoding: 'utf8',
      timeout: 3000 
    }).trim().split('\n')[0];
    
    if (claudePath) {
      debugLog(`[DependencyCheck] Found Claude using ${whichCmd}: ${claudePath}`);
      const version = execSync(`"${claudePath}" --version`, { 
        encoding: 'utf8',
        timeout: 3000 
      }).trim();
      
      return {
        available: true,
        version,
        path: claudePath
      };
    }
  } catch (error) {
    debugLog(`[DependencyCheck] 'which/where' command failed: ${error}`);
  }
  
  // Strategy 3: Try direct command with full PATH
  return new Promise((resolve) => {
    // Set up environment with common paths
    const env = { ...process.env };
    const pathSeparator = os.platform() === 'win32' ? ';' : ':';
    const additionalPaths = [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      path.join(os.homedir(), '.local', 'bin'),
      path.join(os.homedir(), 'bin')
    ];
    
    env.PATH = additionalPaths.join(pathSeparator) + pathSeparator + (env.PATH || '');
    
    debugLog(`[DependencyCheck] Trying claude with enhanced PATH: ${env.PATH}`);
    
    const process = spawn('claude', ['--version'], {
      env,
      timeout: 5000,
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
      debugLog("[DependencyCheck] Claude check timed out");
      resolve({
        available: false,
        error: "Claude CLI not found. It may not be installed or not in PATH.",
        installInstructions: getClaudeInstallInstructions()
      });
    }, 5000);
    
    process.on('close', (code) => {
      clearTimeout(timeout);
      
      if (code === 0 && stdout.trim()) {
        debugLog(`[DependencyCheck] Claude found via spawn: ${stdout.trim()}`);
        resolve({
          available: true,
          version: stdout.trim(),
          path: 'claude'
        });
      } else {
        debugLog(`[DependencyCheck] Claude not found. Code: ${code}, stderr: ${stderr}`);
        resolve({
          available: false,
          error: "Claude CLI not found. Please ensure it's installed and in your PATH.",
          installInstructions: getClaudeInstallInstructions()
        });
      }
    });
    
    process.on('error', (error) => {
      clearTimeout(timeout);
      debugLog(`[DependencyCheck] Spawn error: ${error}`);
      resolve({
        available: false,
        error: `Failed to check Claude installation: ${error.message}`,
        installInstructions: getClaudeInstallInstructions()
      });
    });
  });
}

/**
 * Check for Python installation with multiple strategies
 */
export async function checkPythonInstallation(): Promise<DependencyCheckResult> {
  debugLog("[DependencyCheck] Checking for Python installation...");
  
  // Strategy 1: Try common installation paths first
  const commonPaths = getCommonPythonPaths();
  for (const pythonPath of commonPaths) {
    debugLog(`[DependencyCheck] Checking Python path: ${pythonPath}`);
    if (fs.existsSync(pythonPath)) {
      try {
        const version = execSync(`"${pythonPath}" --version`, { 
          encoding: 'utf8',
          timeout: 3000 
        }).trim();
        
        // Check if version is 3.8+
        const versionMatch = version.match(/Python (\d+)\.(\d+)\.(\d+)/);
        if (versionMatch) {
          const major = parseInt(versionMatch[1]);
          const minor = parseInt(versionMatch[2]);
          
          if (major === 3 && minor >= 8) {
            debugLog(`[DependencyCheck] Found Python at ${pythonPath}: ${version}`);
            return {
              available: true,
              version,
              path: pythonPath
            };
          } else {
            debugLog(`[DependencyCheck] Python version too old: ${version}`);
          }
        }
      } catch (error) {
        debugLog(`[DependencyCheck] Failed to get Python version from ${pythonPath}: ${error}`);
      }
    }
  }
  
  // Strategy 2: Try using which/where
  const pythonCommands = os.platform() === 'win32' 
    ? ['python', 'python3', 'py']
    : ['python3', 'python'];
    
  for (const cmd of pythonCommands) {
    try {
      const whichCmd = os.platform() === 'win32' ? 'where' : 'which';
      const pythonPath = execSync(`${whichCmd} ${cmd}`, { 
        encoding: 'utf8',
        timeout: 3000 
      }).trim().split('\n')[0];
      
      if (pythonPath) {
        const version = execSync(`"${pythonPath}" --version`, { 
          encoding: 'utf8',
          timeout: 3000 
        }).trim();
        
        const versionMatch = version.match(/Python (\d+)\.(\d+)\.(\d+)/);
        if (versionMatch) {
          const major = parseInt(versionMatch[1]);
          const minor = parseInt(versionMatch[2]);
          
          if (major === 3 && minor >= 8) {
            debugLog(`[DependencyCheck] Found Python using ${whichCmd}: ${pythonPath}`);
            return {
              available: true,
              version,
              path: pythonPath
            };
          }
        }
      }
    } catch (error) {
      // Try next command
    }
  }
  
  debugLog("[DependencyCheck] Python 3.8+ not found");
  return {
    available: false,
    error: "Python 3.8+ not found",
    installInstructions: getPythonInstallInstructions()
  };
}

/**
 * Get common Claude installation paths
 */
function getCommonClaudePaths(): string[] {
  const paths: string[] = [];
  const platform = os.platform();
  
  if (platform === 'darwin') {
    // macOS paths
    paths.push(
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
      path.join(os.homedir(), '.local', 'bin', 'claude'),
      path.join(os.homedir(), 'bin', 'claude'),
      '/Applications/Claude.app/Contents/MacOS/claude'
    );
  } else if (platform === 'win32') {
    // Windows paths
    paths.push(
      'C:\\Program Files\\Claude\\claude.exe',
      'C:\\Program Files (x86)\\Claude\\claude.exe',
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Claude', 'claude.exe'),
      path.join(os.homedir(), '.local', 'bin', 'claude.exe')
    );
  } else {
    // Linux paths
    paths.push(
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      '/opt/claude/bin/claude',
      path.join(os.homedir(), '.local', 'bin', 'claude'),
      path.join(os.homedir(), 'bin', 'claude')
    );
  }
  
  return paths;
}

/**
 * Get common Python installation paths
 */
function getCommonPythonPaths(): string[] {
  const paths: string[] = [];
  const platform = os.platform();
  
  if (platform === 'darwin') {
    // macOS paths
    paths.push(
      '/opt/homebrew/bin/python3',
      '/usr/local/bin/python3',
      '/usr/bin/python3',
      path.join(os.homedir(), '.pyenv', 'shims', 'python3'),
      '/Library/Frameworks/Python.framework/Versions/Current/bin/python3'
    );
  } else if (platform === 'win32') {
    // Windows paths
    paths.push(
      'C:\\Python39\\python.exe',
      'C:\\Python310\\python.exe',
      'C:\\Python311\\python.exe',
      'C:\\Python312\\python.exe',
      'C:\\Python313\\python.exe',
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python39', 'python.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python310', 'python.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python311', 'python.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python313', 'python.exe')
    );
  } else {
    // Linux paths
    paths.push(
      '/usr/bin/python3',
      '/usr/local/bin/python3',
      path.join(os.homedir(), '.pyenv', 'shims', 'python3'),
      path.join(os.homedir(), '.local', 'bin', 'python3')
    );
  }
  
  return paths;
}

function getClaudeInstallInstructions(): string {
  return `To install Claude Code on ${os.platform()}:
1. Visit https://www.anthropic.com/claude-code
2. Follow the installation instructions for your platform
3. Or use: brew install claude (macOS) or pip install claude-cli
4. Restart VS Code after installation`;
}

function getPythonInstallInstructions(): string {
  return `To install Python on ${os.platform()}:
1. Visit https://python.org/downloads
2. Download Python 3.8 or later
3. Or use: brew install python3 (macOS)
4. Restart VS Code after installation`;
}