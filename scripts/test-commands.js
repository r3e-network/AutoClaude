#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating VS Code Extension Commands\n');
console.log('=' . repeat(60));

// Read package.json
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
);

// Read extension.ts
const extensionPath = path.join(__dirname, '../src/extension.ts');
const extensionContent = fs.readFileSync(extensionPath, 'utf8');

// Extract commands from package.json
const packageCommands = packageJson.contributes.commands.map(cmd => cmd.command).sort();

console.log(`\n📦 Commands defined in package.json: ${packageCommands.length}`);

// Extract registered commands from extension.ts
const registerPattern = /vscode\.commands\.registerCommand\(\s*["']([^"']+)["']/g;
const registeredCommands = [];
let match;

while ((match = registerPattern.exec(extensionContent)) !== null) {
  registeredCommands.push(match[1]);
}

registeredCommands.sort();

console.log(`📝 Commands registered in extension.ts: ${registeredCommands.length}`);

// Find missing registrations
const missingInExtension = packageCommands.filter(cmd => !registeredCommands.includes(cmd));
const missingInPackage = registeredCommands.filter(cmd => !packageCommands.includes(cmd));

// Check if commands are added to subscriptions
const subscriptionPattern = /context\.subscriptions\.push\(([\s\S]*?)\);/g;
const subscriptionMatch = subscriptionPattern.exec(extensionContent);
let subscribedCommands = [];

if (subscriptionMatch) {
  const subscriptionContent = subscriptionMatch[1];
  // Extract variable names
  const varPattern = /(\w+Command)/g;
  let varMatch;
  while ((varMatch = varPattern.exec(subscriptionContent)) !== null) {
    subscribedCommands.push(varMatch[1]);
  }
}

console.log(`✅ Commands added to subscriptions: ${subscribedCommands.length}`);

// Report results
console.log('\n📊 VALIDATION RESULTS:');
console.log('-'.repeat(40));

let hasErrors = false;

if (missingInExtension.length > 0) {
  hasErrors = true;
  console.log('\n❌ Commands in package.json but NOT registered in extension:');
  missingInExtension.forEach(cmd => {
    console.log(`   - ${cmd}`);
  });
}

if (missingInPackage.length > 0) {
  console.log('\n⚠️  Commands registered but NOT in package.json:');
  missingInPackage.forEach(cmd => {
    console.log(`   - ${cmd}`);
  });
}

// Check for commands without handlers
const commandsWithoutHandlers = [];
packageCommands.forEach(cmd => {
  const handlerPattern = new RegExp(`"${cmd}"[\\s\\S]*?\\{[\\s\\S]*?\\}`, 'g');
  if (!handlerPattern.test(extensionContent)) {
    commandsWithoutHandlers.push(cmd);
  }
});

if (commandsWithoutHandlers.length > 0) {
  console.log('\n⚠️  Commands that might have incomplete handlers:');
  commandsWithoutHandlers.forEach(cmd => {
    console.log(`   - ${cmd}`);
  });
}

// Check command consistency
console.log('\n📋 Command Categories:');
const categories = {};
packageJson.contributes.commands.forEach(cmd => {
  const category = cmd.category || 'Uncategorized';
  if (!categories[category]) {
    categories[category] = [];
  }
  categories[category].push(cmd.command);
});

Object.keys(categories).forEach(category => {
  console.log(`   ${category}: ${categories[category].length} commands`);
});

// Check for duplicate commands
const duplicates = packageCommands.filter((cmd, index) => packageCommands.indexOf(cmd) !== index);
if (duplicates.length > 0) {
  hasErrors = true;
  console.log('\n❌ Duplicate commands found:');
  duplicates.forEach(cmd => {
    console.log(`   - ${cmd}`);
  });
}

// Validate command naming convention
const invalidNames = packageCommands.filter(cmd => !cmd.startsWith('autoclaude.'));
if (invalidNames.length > 0) {
  hasErrors = true;
  console.log('\n❌ Commands with invalid naming convention:');
  invalidNames.forEach(cmd => {
    console.log(`   - ${cmd} (should start with "autoclaude.")`);
  });
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.log('❌ VALIDATION FAILED - Issues found that need to be fixed');
  process.exit(1);
} else if (missingInPackage.length > 0 || commandsWithoutHandlers.length > 0) {
  console.log('⚠️  VALIDATION PASSED WITH WARNINGS');
  console.log('   Some non-critical issues were found');
} else {
  console.log('✅ VALIDATION PASSED - All commands properly configured');
}

// Generate command documentation
console.log('\n📚 Generating command documentation...');

const commandDocs = packageJson.contributes.commands.map(cmd => {
  const isRegistered = registeredCommands.includes(cmd.command);
  return {
    command: cmd.command,
    title: cmd.title,
    category: cmd.category || 'General',
    icon: cmd.icon || 'none',
    registered: isRegistered ? '✅' : '❌'
  };
});

// Write documentation
const docPath = path.join(__dirname, '../COMMANDS.md');
let docContent = '# AutoClaude VS Code Extension Commands\n\n';
docContent += 'This document lists all available commands in the AutoClaude extension.\n\n';
docContent += `**Total Commands:** ${packageCommands.length}\n\n`;
docContent += `**Last Updated:** ${new Date().toISOString()}\n\n`;

// Group by category
const byCategory = {};
commandDocs.forEach(cmd => {
  if (!byCategory[cmd.category]) {
    byCategory[cmd.category] = [];
  }
  byCategory[cmd.category].push(cmd);
});

Object.keys(byCategory).sort().forEach(category => {
  docContent += `## ${category}\n\n`;
  docContent += '| Command | Title | Icon | Status |\n';
  docContent += '|---------|-------|------|--------|\n';
  
  byCategory[category].forEach(cmd => {
    docContent += `| \`${cmd.command}\` | ${cmd.title} | ${cmd.icon} | ${cmd.registered} |\n`;
  });
  
  docContent += '\n';
});

docContent += '## Legend\n\n';
docContent += '- ✅ Command is properly registered\n';
docContent += '- ❌ Command registration missing\n';

fs.writeFileSync(docPath, docContent);
console.log(`   Documentation written to: COMMANDS.md`);

console.log('\n✨ Command validation complete!');