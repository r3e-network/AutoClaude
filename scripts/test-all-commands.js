#!/usr/bin/env node

/**
 * Comprehensive Command Testing Script
 * Tests all AutoClaude extension commands for proper implementation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 AutoClaude Command Implementation Tester\n');
console.log('=' . repeat(60));

// Read package.json to get all commands
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
);

// Read extension source
const extensionPath = path.join(__dirname, '../src/extension.ts');
const extensionContent = fs.readFileSync(extensionPath, 'utf8');

// Get all commands from package.json
const commands = packageJson.contributes.commands;

console.log(`\n📋 Testing ${commands.length} commands...\n`);

const results = {
  passed: [],
  warnings: [],
  failed: []
};

// Test each command
commands.forEach(cmd => {
  const issues = [];
  
  // 1. Check if command is registered
  const registerPattern = new RegExp(`vscode\\.commands\\.registerCommand\\(\\s*["']${cmd.command}["']`, 'g');
  if (!registerPattern.test(extensionContent)) {
    issues.push('❌ Not registered in extension.ts');
  }
  
  // 2. Check if command has a handler
  const handlerPattern = new RegExp(`["']${cmd.command}["'][\\s\\S]*?\\{[\\s\\S]*?\\}`, 'g');
  const hasHandler = handlerPattern.test(extensionContent);
  if (!hasHandler) {
    issues.push('❌ No handler implementation found');
  }
  
  // 3. Check if command is in subscriptions
  const varNamePattern = new RegExp(`const\\s+(\\w+)\\s*=\\s*vscode\\.commands\\.registerCommand\\(\\s*["']${cmd.command}["']`, 'g');
  const varMatch = varNamePattern.exec(extensionContent);
  if (varMatch) {
    const varName = varMatch[1];
    const subscriptionPattern = new RegExp(`context\\.subscriptions\\.push\\([\\s\\S]*?${varName}[\\s\\S]*?\\)`, 'g');
    if (!subscriptionPattern.test(extensionContent)) {
      issues.push('⚠️ Not added to context.subscriptions');
    }
  }
  
  // 4. Check for error handling
  if (hasHandler) {
    const handlerMatch = extensionContent.match(new RegExp(`["']${cmd.command}["'][\\s\\S]*?\\{([\\s\\S]*?)\\}\\s*\\)`, 'g'));
    if (handlerMatch) {
      const handlerBody = handlerMatch[0];
      if (!handlerBody.includes('try') && !handlerBody.includes('catch')) {
        issues.push('⚠️ No error handling (try/catch)');
      }
      if (!handlerBody.includes('showErrorMessage') && !handlerBody.includes('showWarningMessage')) {
        issues.push('⚠️ No user error feedback');
      }
    }
  }
  
  // 5. Check command naming convention
  if (!cmd.command.startsWith('autoclaude.')) {
    issues.push('❌ Invalid naming convention');
  }
  
  // 6. Check for required properties
  if (!cmd.title) {
    issues.push('❌ Missing title');
  }
  
  // Report results
  if (issues.length === 0) {
    results.passed.push(cmd.command);
    console.log(`✅ ${cmd.command}`);
  } else if (issues.filter(i => i.startsWith('❌')).length > 0) {
    results.failed.push({ command: cmd.command, issues });
    console.log(`❌ ${cmd.command}`);
    issues.forEach(issue => console.log(`   ${issue}`));
  } else {
    results.warnings.push({ command: cmd.command, issues });
    console.log(`⚠️  ${cmd.command}`);
    issues.forEach(issue => console.log(`   ${issue}`));
  }
});

// Generate detailed analysis
console.log('\n' + '=' . repeat(60));
console.log('📊 COMMAND IMPLEMENTATION ANALYSIS\n');

// Check for common patterns
const commonIssues = {
  missingWorkspaceCheck: [],
  missingPanelCheck: [],
  missingErrorHandling: [],
  missingUserFeedback: []
};

// Analyze each command's implementation
commands.forEach(cmd => {
  const commandPattern = new RegExp(`["']${cmd.command}["'][\\s\\S]*?\\{([\\s\\S]*?)\\}\\s*\\)`, 'g');
  const match = commandPattern.exec(extensionContent);
  
  if (match) {
    const implementation = match[1];
    
    // Check for workspace validation
    if (cmd.command !== 'autoclaude.start' && cmd.command !== 'autoclaude.stop') {
      if (!implementation.includes('workspace.workspaceFolders')) {
        commonIssues.missingWorkspaceCheck.push(cmd.command);
      }
    }
    
    // Check for panel validation (for commands that need it)
    const needsPanelCommands = ['addMessage', 'clearQueue', 'startProcessing'];
    if (needsPanelCommands.some(nc => cmd.command.includes(nc))) {
      if (!implementation.includes('claudePanel') && !implementation.includes('panel')) {
        commonIssues.missingPanelCheck.push(cmd.command);
      }
    }
    
    // Check for error handling
    if (!implementation.includes('try') && !implementation.includes('catch')) {
      commonIssues.missingErrorHandling.push(cmd.command);
    }
    
    // Check for user feedback
    if (!implementation.includes('showErrorMessage') && 
        !implementation.includes('showWarningMessage') && 
        !implementation.includes('showInformationMessage')) {
      commonIssues.missingUserFeedback.push(cmd.command);
    }
  }
});

// Report common issues
console.log('🔍 Common Issues Found:\n');

if (commonIssues.missingWorkspaceCheck.length > 0) {
  console.log(`⚠️ Commands missing workspace validation: ${commonIssues.missingWorkspaceCheck.length}`);
  console.log(`   ${commonIssues.missingWorkspaceCheck.slice(0, 5).join(', ')}${commonIssues.missingWorkspaceCheck.length > 5 ? '...' : ''}\n`);
}

if (commonIssues.missingPanelCheck.length > 0) {
  console.log(`⚠️ Commands missing panel validation: ${commonIssues.missingPanelCheck.length}`);
  console.log(`   ${commonIssues.missingPanelCheck.join(', ')}\n`);
}

if (commonIssues.missingErrorHandling.length > 0) {
  console.log(`⚠️ Commands missing error handling: ${commonIssues.missingErrorHandling.length}`);
  console.log(`   ${commonIssues.missingErrorHandling.slice(0, 5).join(', ')}${commonIssues.missingErrorHandling.length > 5 ? '...' : ''}\n`);
}

if (commonIssues.missingUserFeedback.length > 0) {
  console.log(`⚠️ Commands missing user feedback: ${commonIssues.missingUserFeedback.length}`);
  console.log(`   ${commonIssues.missingUserFeedback.slice(0, 5).join(', ')}${commonIssues.missingUserFeedback.length > 5 ? '...' : ''}\n`);
}

// Summary
console.log('=' . repeat(60));
console.log('📈 SUMMARY\n');
console.log(`✅ Fully implemented: ${results.passed.length}/${commands.length}`);
console.log(`⚠️  With warnings: ${results.warnings.length}`);
console.log(`❌ Failed: ${results.failed.length}`);

// Generate fix recommendations
if (results.failed.length > 0 || results.warnings.length > 0) {
  console.log('\n🔧 RECOMMENDED FIXES:\n');
  
  // Priority 1: Failed commands
  if (results.failed.length > 0) {
    console.log('Priority 1 - Critical Issues:');
    results.failed.forEach(item => {
      console.log(`\n  ${item.command}:`);
      item.issues.forEach(issue => {
        if (issue.includes('Not registered')) {
          console.log(`    → Add: vscode.commands.registerCommand('${item.command}', () => { ... })`);
        }
        if (issue.includes('No handler')) {
          console.log(`    → Implement handler function for command`);
        }
      });
    });
  }
  
  // Priority 2: Warnings
  if (results.warnings.length > 0) {
    console.log('\nPriority 2 - Improvements:');
    results.warnings.forEach(item => {
      console.log(`\n  ${item.command}:`);
      item.issues.forEach(issue => {
        if (issue.includes('No error handling')) {
          console.log(`    → Wrap implementation in try/catch block`);
        }
        if (issue.includes('No user error feedback')) {
          console.log(`    → Add vscode.window.showErrorMessage() for errors`);
        }
        if (issue.includes('Not added to context.subscriptions')) {
          console.log(`    → Add command variable to context.subscriptions.push()`);
        }
      });
    });
  }
}

// Generate report file
const report = {
  timestamp: new Date().toISOString(),
  totalCommands: commands.length,
  passed: results.passed.length,
  warnings: results.warnings.length,
  failed: results.failed.length,
  details: {
    passed: results.passed,
    warnings: results.warnings,
    failed: results.failed
  },
  commonIssues
};

fs.writeFileSync(
  path.join(__dirname, '../COMMAND_TEST_REPORT.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n📄 Detailed report saved to: COMMAND_TEST_REPORT.json');

// Exit with error if there are failures
if (results.failed.length > 0) {
  console.log('\n❌ Command testing failed - critical issues found');
  process.exit(1);
} else if (results.warnings.length > 0) {
  console.log('\n⚠️  Command testing passed with warnings');
  process.exit(0);
} else {
  console.log('\n✅ All commands properly implemented!');
  process.exit(0);
}