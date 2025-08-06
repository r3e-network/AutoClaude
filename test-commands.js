#!/usr/bin/env node

/**
 * Test script to verify all AutoClaude commands are properly registered
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing AutoClaude Command Registration\n');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Read extension.ts
const extensionCode = fs.readFileSync('src/extension.ts', 'utf8');

// Extract all commands from package.json
const packageCommands = new Set();
if (packageJson.contributes && packageJson.contributes.commands) {
  packageJson.contributes.commands.forEach(cmd => {
    packageCommands.add(cmd.command);
  });
}

// Extract all registered commands from extension.ts
const registeredCommands = new Set();
const registerPattern = /vscode\.commands\.registerCommand\s*\(\s*["']([^"']+)["']/g;
let match;
while ((match = registerPattern.exec(extensionCode)) !== null) {
  registeredCommands.add(match[1]);
}

console.log(`📦 Commands in package.json: ${packageCommands.size}`);
console.log(`📝 Commands registered in extension.ts: ${registeredCommands.size}\n`);

// Check for commands in package.json but not registered
const missingInCode = [];
packageCommands.forEach(cmd => {
  if (!registeredCommands.has(cmd)) {
    missingInCode.push(cmd);
  }
});

// Check for registered commands not in package.json
const missingInPackage = [];
registeredCommands.forEach(cmd => {
  if (!packageCommands.has(cmd)) {
    missingInPackage.push(cmd);
  }
});

// Report results
let hasErrors = false;

if (missingInCode.length > 0) {
  console.log('❌ Commands defined in package.json but NOT registered in extension.ts:');
  missingInCode.forEach(cmd => console.log(`   - ${cmd}`));
  console.log();
  hasErrors = true;
}

if (missingInPackage.length > 0) {
  console.log('⚠️  Commands registered in extension.ts but NOT in package.json:');
  missingInPackage.forEach(cmd => console.log(`   - ${cmd}`));
  console.log();
}

// Check categories
const categories = new Set();
packageJson.contributes.commands.forEach(cmd => {
  if (cmd.category) {
    categories.add(cmd.category);
  }
});

console.log('📂 Command Categories:');
categories.forEach(cat => {
  const count = packageJson.contributes.commands.filter(cmd => cmd.category === cat).length;
  console.log(`   - ${cat}: ${count} commands`);
});

// Check for consistent naming
console.log('\n🏷️  Category Consistency Check:');
const wrongCategories = packageJson.contributes.commands.filter(cmd => {
  return cmd.category && !cmd.category.includes('AutoClaude');
});

if (wrongCategories.length > 0) {
  console.log('❌ Commands with non-AutoClaude categories:');
  wrongCategories.forEach(cmd => {
    console.log(`   - ${cmd.command}: "${cmd.category}"`);
  });
  hasErrors = true;
} else {
  console.log('✅ All categories use "AutoClaude" prefix');
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ FAILED: Some commands have issues that need fixing');
  process.exit(1);
} else {
  console.log('✅ SUCCESS: All commands are properly configured!');
  console.log('\n🎉 The AutoClaude extension is ready for use!');
}