const fs = require('fs');
const path = require('path');

// Read the compiled extension.js
const extensionPath = path.join(__dirname, 'out', 'extension.js');
let content = fs.readFileSync(extensionPath, 'utf8');

// Remove any existing exports at the end
content = content.replace(/\n\/\/ Ensure proper CommonJS exports[\s\S]*$/, '');

// Add proper CommonJS exports at the end
// Since we're not minifying, the function names should be 'activate' and 'deactivate'
content += '\n\n// Ensure proper CommonJS exports for VS Code\n';
content += 'module.exports = { activate, deactivate };\n';

// Write back
fs.writeFileSync(extensionPath, content, 'utf8');
console.log('Added CommonJS exports to extension.js');