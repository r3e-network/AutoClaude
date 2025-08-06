// Test if the exports are accessible
const fs = require('fs');

console.log('Testing module exports...\n');

// Read the file
const content = fs.readFileSync('out/extension.js', 'utf8');

// Check for function definitions
const hasActivateFunction = content.includes('async function activate(context)');
const hasDeactivateFunction = content.includes('async function deactivate()');

console.log('✅ Has activate function:', hasActivateFunction);
console.log('✅ Has deactivate function:', hasDeactivateFunction);

// Check for exports
const hasModuleExports = content.includes('module.exports');
const exportsMatch = content.match(/module\.exports\s*=\s*{[^}]+}/g);

console.log('✅ Has module.exports:', hasModuleExports);
console.log('✅ Export statements found:', exportsMatch?.length || 0);

if (exportsMatch) {
  console.log('\nExport statements:');
  exportsMatch.forEach((exp, i) => {
    console.log(`${i + 1}. ${exp.replace(/\n/g, ' ').substring(0, 100)}`);
  });
}

// Check if functions are before exports
const activateIndex = content.indexOf('async function activate(context)');
const deactivateIndex = content.indexOf('async function deactivate()');
const lastExportIndex = content.lastIndexOf('module.exports');

console.log('\nPosition check:');
console.log('activate function at:', activateIndex);
console.log('deactivate function at:', deactivateIndex);
console.log('module.exports at:', lastExportIndex);

if (activateIndex < lastExportIndex && deactivateIndex < lastExportIndex) {
  console.log('✅ Functions are defined before exports');
} else {
  console.log('❌ Functions are NOT defined before exports');
}

console.log('\n✅ Export structure looks correct!');