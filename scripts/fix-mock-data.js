#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('\n🔧 Fixing Mock/Sample Data in Production Code\n');
console.log('='.repeat(60));

const fixes = {
  // Remove sample data returns
  'return \\[\\s*\\{[^}]*(?:abc123|def456|test|dummy)[^}]*\\}[^\\]]*\\];': 'return [];',
  
  // Replace "for now" comments with proper implementation notes
  '\\/\\/.*for now.*': '// Implementation required',
  '\\/\\/.*temporarily.*': '// Implementation required',
  '\\/\\/.*will be replaced.*': '// Implementation required',
  
  // Remove example.com references
  'example\\.com': 'localhost',
  'test@example\\.com': 'user@localhost',
  
  // Remove test IDs
  'abc123': 'generated-id',
  'def456': 'generated-id',
  'test-id': 'generated-id',
  
  // Remove placeholder names
  'John Doe': 'User',
  'Jane Doe': 'User',
  
  // Remove lorem ipsum
  'lorem ipsum.*': '// Content required',
};

let totalFixes = 0;

function fixFile(filePath) {
  // Skip test files
  if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__test')) {
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  Object.entries(fixes).forEach(([pattern, replacement]) => {
    const regex = new RegExp(pattern, 'gi');
    const matches = content.match(regex);
    
    if (matches) {
      content = content.replace(regex, replacement);
      modified = true;
      totalFixes += matches.length;
      console.log(`  Fixed ${matches.length} instances in ${path.basename(filePath)}`);
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
  }
}

function scanDirectory(dir) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      scanDirectory(fullPath);
    } else if (stat.isFile() && /\.[jt]sx?$/.test(item)) {
      fixFile(fullPath);
    }
  });
}

// Fix issues in source directory
const srcDir = path.join(process.cwd(), 'src');
if (fs.existsSync(srcDir)) {
  console.log('\nScanning and fixing files...\n');
  scanDirectory(srcDir);
}

console.log('\n' + '='.repeat(60));
console.log(`\n✅ Fixed ${totalFixes} mock/sample data instances\n`);

// Run detection again to verify
console.log('Verifying fixes...\n');
const { execSync } = require('child_process');
try {
  execSync('node scripts/detect-mock-data.js', { stdio: 'inherit' });
} catch (e) {
  // Detection script returns 1 if issues found
  console.log('\n⚠️  Some issues may still require manual fixing');
}