const fs = require('fs');
const path = require('path');

// Read the compiled extension.js
const extensionPath = path.join(__dirname, 'out', 'extension.js');
let content = fs.readFileSync(extensionPath, 'utf8');

// Remove the conditional export that esbuild adds (0 && ...)
content = content.replace(/\/\/ Annotate the CommonJS export names[\s\S]*?}\);/g, '');

// Remove any existing exports at the end
content = content.replace(/\n\/\/ Ensure proper CommonJS exports[\s\S]*$/, '');

// Remove any sourcemap comment at the end
content = content.replace(/\n\/\/# sourceMappingURL=.*$/, '');

// Add proper CommonJS exports at the end
// Since we're not minifying, the function names should be 'activate' and 'deactivate'
content += '\n\n// VS Code Extension Exports\n';
content += 'module.exports = {\n';
content += '  activate: activate,\n';
content += '  deactivate: deactivate\n';
content += '};\n';

// Write back
fs.writeFileSync(extensionPath, content, 'utf8');
console.log('Fixed CommonJS exports for VS Code');