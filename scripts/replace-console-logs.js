#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

async function main() {
  console.log('🔧 Replacing console.log statements with debugLog...\n');

  // Find all TypeScript and JavaScript files
  const files = await glob('src/**/*.{ts,js}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/*.test.ts', '**/*.spec.ts']
  });

  let totalFixed = 0;
  let filesModified = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const originalContent = content;

    // Skip webview files which legitimately use console.log
    if (file.includes('webview')) {
      continue;
    }

    // Count console.log occurrences
    const matches = content.match(/console\.log\s*\(/g) || [];
    if (matches.length === 0) continue;

    // Check if debugLog is already imported
    const hasDebugLogImport = content.includes('import { debugLog') || content.includes('debugLog }');
    
    // Replace console.log with debugLog
    content = content.replace(/console\.log\s*\(/g, 'debugLog(');

    // Add import if needed
    if (!hasDebugLogImport && matches.length > 0) {
      // Find the right import path based on file location
      const fileDepth = file.split('/').length - 2; // -1 for src, -1 for filename
      const importPath = '../'.repeat(fileDepth) + 'utils/logging';
      
      // Add import at the top after other imports
      const importMatch = content.match(/^(import .* from .*;\\n)+/m);
      if (importMatch) {
        const lastImportEnd = importMatch.index + importMatch[0].length;
        content = content.slice(0, lastImportEnd) + 
          `import { debugLog } from "${importPath}";\\n` + 
          content.slice(lastImportEnd);
      } else {
        // No imports found, add at the very top
        content = `import { debugLog } from "${importPath}";\\n\\n` + content;
      }
    }

    // Write back if modified
    if (content !== originalContent) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`✅ Fixed ${matches.length} console.log in ${file}`);
      totalFixed += matches.length;
      filesModified++;
    }
  }

  console.log(`\\n📊 Summary:`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Total console.log statements replaced: ${totalFixed}`);
}

main().catch(console.error);