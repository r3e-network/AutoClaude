#!/usr/bin/env node

/**
 * Comprehensive test to ensure all VS Code extension commands are properly registered
 * and will not encounter "command not found" errors
 */

const fs = require('fs');
const path = require('path');

console.log('=== AutoClaude Command Registration Test ===\n');

// Read package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Get all commands from package.json
const packageCommands = new Set();
if (packageJson.contributes && packageJson.contributes.commands) {
  packageJson.contributes.commands.forEach(cmd => {
    packageCommands.add(cmd.command);
  });
}

// Read extension.ts
const extensionPath = path.join(__dirname, 'src', 'extension.ts');
const extensionContent = fs.readFileSync(extensionPath, 'utf8');

// Find all command registrations
const registeredCommands = new Set();
const lines = extensionContent.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('vscode.commands.registerCommand')) {
    // Look for command name in the next few lines
    for (let j = i; j < Math.min(i + 3, lines.length); j++) {
      const match = lines[j].match(/"autoclaude\.[^"]+"/);
      if (match) {
        const cmdName = match[0].replace(/"/g, '');
        registeredCommands.add(cmdName);
        break;
      }
    }
  }
}

// Find commands that are added to subscriptions
const subscriptionCommands = new Set();
const subscriptionSection = extensionContent.match(/context\.subscriptions\.push\(([\s\S]*?)\);/);
if (subscriptionSection) {
  const subscriptionVars = subscriptionSection[1].match(/\w+Command/g);
  if (subscriptionVars) {
    console.log(`Found ${subscriptionVars.length} commands in subscriptions\n`);
  }
}

// Analysis
console.log('📊 Statistics:');
console.log(`  • Commands in package.json: ${packageCommands.size}`);
console.log(`  • Commands registered in extension.ts: ${registeredCommands.size}`);
console.log();

// Find missing registrations
const notRegistered = [];
packageCommands.forEach(cmd => {
  if (!registeredCommands.has(cmd)) {
    notRegistered.push(cmd);
  }
});

// Find registered but not in package
const notInPackage = [];
registeredCommands.forEach(cmd => {
  if (!packageCommands.has(cmd)) {
    notInPackage.push(cmd);
  }
});

// Report results
let hasErrors = false;

if (notRegistered.length > 0) {
  hasErrors = true;
  console.log('❌ CRITICAL: Commands in package.json but NOT registered:');
  notRegistered.forEach(cmd => {
    console.log(`   • ${cmd}`);
  });
  console.log();
}

if (notInPackage.length > 0) {
  console.log('⚠️  WARNING: Commands registered but NOT in package.json:');
  notInPackage.forEach(cmd => {
    console.log(`   • ${cmd}`);
  });
  console.log();
}

// Check compiled output
const compiledPath = path.join(__dirname, 'out', 'extension.js');
if (fs.existsSync(compiledPath)) {
  const compiledContent = fs.readFileSync(compiledPath, 'utf8');
  
  // Check for proper exports
  if (compiledContent.includes('module.exports') && 
      compiledContent.includes('activate') && 
      compiledContent.includes('deactivate')) {
    console.log('✅ Compiled output has proper exports\n');
  } else {
    hasErrors = true;
    console.log('❌ CRITICAL: Compiled output missing proper exports!\n');
  }
} else {
  console.log('⚠️  WARNING: Compiled output not found (run npm run compile first)\n');
}

// Check activation events
if (packageJson.activationEvents) {
  console.log('📦 Activation Events:');
  packageJson.activationEvents.forEach(event => {
    console.log(`   • ${event}`);
  });
  
  // Check for potential circular dependency
  const hasCommandActivation = packageJson.activationEvents.some(e => e.startsWith('onCommand:'));
  if (hasCommandActivation) {
    console.log('   ⚠️  Warning: Using onCommand activation may cause circular dependency');
  }
  console.log();
}

// Summary
console.log('=== Summary ===');
if (hasErrors) {
  console.log('❌ FAILED: Critical issues found that will cause "command not found" errors');
  console.log('\nTo fix:');
  console.log('1. Ensure all commands in package.json are registered in extension.ts');
  console.log('2. Ensure all registered commands are added to context.subscriptions.push()');
  console.log('3. Rebuild the extension with: npm run compile:production');
  console.log('4. Test with: code --install-extension autoclaude-*.vsix');
  process.exit(1);
} else {
  console.log('✅ PASSED: All commands are properly registered');
  console.log('\n🎉 Extension should work without "command not found" errors!');
  process.exit(0);
}