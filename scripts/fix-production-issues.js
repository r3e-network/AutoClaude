#!/usr/bin/env node

/**
 * Production Readiness Fix Script
 * Automatically fixes common production readiness issues
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Configuration
const config = {
  rootDir: path.join(__dirname, '..'),
  srcDir: path.join(__dirname, '..', 'src'),
  terminalDir: path.join(__dirname, '..', 'terminal', 'src'),
  patterns: {
    todo: /\/\/\s*TODO[:\s]/gi,
    consoleLog: /console\.log\s*\(/g,
    anyType: /:\s*any\b/g,
  },
  replacements: {
    consoleLog: 'debugLog(',
    anyType: {
      // Common any type replacements
      'context?: any': 'context?: Record<string, unknown>',
      'data: any': 'data: unknown',
      'value: any': 'value: unknown',
      'error: any': 'error: Error | unknown',
      'result: any': 'result: unknown',
      'params: any': 'params: Record<string, unknown>',
      'config: any': 'config: Record<string, unknown>',
      'options: any': 'options: Record<string, unknown>',
      'args: any': 'args: unknown[]',
      'payload: any': 'payload: unknown',
    }
  }
};

// Statistics
let stats = {
  todosFound: 0,
  todosFixed: 0,
  consoleLogsFound: 0,
  consoleLogsFixed: 0,
  anyTypesFound: 0,
  anyTypesFixed: 0,
  filesProcessed: 0,
  filesModified: 0,
};

// Helper functions
async function getFiles(dir, extension = '.ts') {
  return await glob(`${dir}/**/*${extension}`, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/coverage/**']
  });
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;

  // Skip test files for certain fixes
  const isTestFile = filePath.includes('.test.') || filePath.includes('.spec.');
  
  // Fix console.log statements (not in test files)
  if (!isTestFile) {
    const consoleLogMatches = content.match(config.patterns.consoleLog) || [];
    stats.consoleLogsFound += consoleLogMatches.length;
    
    if (consoleLogMatches.length > 0) {
      // Add import for debugLog if not present
      if (!content.includes('import { debugLog }') && !content.includes('from ".*logging"')) {
        const firstImport = content.match(/^import .* from/m);
        if (firstImport) {
          const importStatement = 'import { debugLog } from "../utils/logging";\n';
          content = content.replace(firstImport[0], importStatement + firstImport[0]);
        }
      }
      
      content = content.replace(config.patterns.consoleLog, config.replacements.consoleLog);
      stats.consoleLogsFixed += consoleLogMatches.length;
      modified = true;
    }
  }

  // Fix TODO comments
  const todoMatches = content.match(config.patterns.todo) || [];
  stats.todosFound += todoMatches.length;
  
  // For TODOs, we'll log them for manual review since they need implementation
  if (todoMatches.length > 0) {
    console.log(`\\nTODOs found in ${path.relative(config.rootDir, filePath)}:`);
    const lines = content.split('\\n');
    lines.forEach((line, index) => {
      if (config.patterns.todo.test(line)) {
        console.log(`  Line ${index + 1}: ${line.trim()}`);
      }
    });
  }

  // Fix any types
  const anyTypeMatches = content.match(config.patterns.anyType) || [];
  stats.anyTypesFound += anyTypeMatches.length;
  
  if (anyTypeMatches.length > 0) {
    // Apply known replacements
    Object.entries(config.replacements.anyType).forEach(([pattern, replacement]) => {
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'g');
      const beforeCount = (content.match(regex) || []).length;
      content = content.replace(regex, replacement);
      const afterCount = (content.match(regex) || []).length;
      stats.anyTypesFixed += (beforeCount - afterCount);
    });
    
    // For remaining any types, log them
    const remainingAny = content.match(config.patterns.anyType) || [];
    if (remainingAny.length > 0) {
      console.log(`\\nRemaining 'any' types in ${path.relative(config.rootDir, filePath)}:`);
      const lines = content.split('\\n');
      lines.forEach((line, index) => {
        if (config.patterns.anyType.test(line)) {
          console.log(`  Line ${index + 1}: ${line.trim()}`);
        }
      });
    }
    
    if (content !== originalContent) {
      modified = true;
    }
  }

  // Write file if modified
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    stats.filesModified++;
  }
  
  stats.filesProcessed++;
}

// Main execution
async function main() {
  console.log('🔧 Production Readiness Fix Script\\n');
  console.log('Processing TypeScript files...');

  // Process source files
  const srcFiles = await getFiles(config.srcDir);
  const terminalFiles = await getFiles(config.terminalDir);
  const allFiles = [...srcFiles, ...terminalFiles];

  console.log(`Found ${allFiles.length} TypeScript files to process\\n`);

  // Process each file
  allFiles.forEach(file => {
    processFile(file);
  });

  // Summary
  console.log('\\n📊 Summary:');
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Files modified: ${stats.filesModified}`);
  console.log(`\\nTODOs found: ${stats.todosFound} (requires manual implementation)`);
  console.log(`Console.logs found: ${stats.consoleLogsFound}`);
  console.log(`Console.logs fixed: ${stats.consoleLogsFixed}`);
  console.log(`Any types found: ${stats.anyTypesFound}`);
  console.log(`Any types fixed: ${stats.anyTypesFixed}`);
  console.log(`Any types remaining: ${stats.anyTypesFound - stats.anyTypesFixed}`);

  console.log('\\n⚠️  Note: TODO comments require manual implementation.');
  console.log('⚠️  Note: Complex any types require manual review.');
  console.log('\\n✅ Script completed!');
}

// Run the script
main().catch(console.error);