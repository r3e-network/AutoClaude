const fs = require('fs');
const path = require('path');

// Read the compiled extension.js
const extensionPath = path.join(__dirname, 'out', 'extension.js');
let content = fs.readFileSync(extensionPath, 'utf8');

// Check if exports are already at the end
if (!content.includes('module.exports = { activate, deactivate }')) {
  // Add proper CommonJS exports at the end
  content += '\n\n// Ensure proper CommonJS exports for VS Code\n';
  content += 'if (typeof module !== "undefined" && module.exports) {\n';
  content += '  module.exports = { activate, deactivate };\n';
  content += '}\n';
  
  // Write back
  fs.writeFileSync(extensionPath, content, 'utf8');
  console.log('Added CommonJS exports to extension.js');
} else {
  console.log('CommonJS exports already present');
}