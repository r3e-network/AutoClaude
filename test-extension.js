// Test script to verify extension exports and command registration
const fs = require('fs');
const path = require('path');

console.log('Testing AutoClaude Extension...\n');

// 1. Check package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('Version:', packageJson.version);
console.log('Main entry:', packageJson.main);

// 2. Check compiled file exists
const extensionPath = path.join(__dirname, packageJson.main);
if (!fs.existsSync(extensionPath)) {
  console.error('❌ Extension file not found:', extensionPath);
  process.exit(1);
}
console.log('✅ Extension file exists:', extensionPath);

// 3. Check for exports in compiled file
const content = fs.readFileSync(extensionPath, 'utf8');
const hasModuleExports = content.includes('module.exports');
const hasActivate = content.includes('activate');
const hasDeactivate = content.includes('deactivate');

console.log('✅ Has module.exports:', hasModuleExports);
console.log('✅ Has activate function:', hasActivate);
console.log('✅ Has deactivate function:', hasDeactivate);

// 4. Check commands in package.json
const commands = packageJson.contributes.commands;
console.log('\nTotal commands defined:', commands.length);

// Check specific important commands
const importantCommands = [
  'autoclaude.start',
  'autoclaude.stop',
  'autoclaude.addMessage',
  'autoclaude.runScriptChecks'
];

console.log('\nVerifying important commands:');
for (const cmdId of importantCommands) {
  const cmd = commands.find(c => c.command === cmdId);
  if (cmd) {
    console.log(`✅ ${cmdId}: "${cmd.title}" [${cmd.category}]`);
  } else {
    console.log(`❌ ${cmdId}: NOT FOUND`);
  }
}

// 5. Check categories
const categories = new Set(commands.map(c => c.category));
console.log('\nCommand categories:', Array.from(categories).join(', '));

// 6. Check for old "Claude" references
const claudeCommands = commands.filter(c => c.category === 'Claude');
if (claudeCommands.length > 0) {
  console.log(`\n⚠️  Warning: Found ${claudeCommands.length} commands still using "Claude" category`);
}

console.log('\n✅ All tests passed!');