#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Count any types in TypeScript files
function countAnyTypes() {
  const srcPattern = path.join(__dirname, '..', 'src', '**', '*.ts');
  const files = glob.sync(srcPattern, { 
    ignore: [
      '**/node_modules/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/test/**'
    ]
  });

  let totalCount = 0;
  const fileDetails = [];

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const anyMatches = content.match(/: any/g);
    
    if (anyMatches && anyMatches.length > 0) {
      totalCount += anyMatches.length;
      fileDetails.push({
        file: path.relative(process.cwd(), file),
        count: anyMatches.length
      });
    }
  });

  // Sort by count descending
  fileDetails.sort((a, b) => b.count - a.count);

  console.log('=== Any Type Count Report ===\n');
  console.log(`Total 'any' types found: ${totalCount}\n`);
  console.log('Files with any types:');
  console.log('--------------------');
  
  fileDetails.forEach(({ file, count }) => {
    console.log(`${count.toString().padStart(4)} | ${file}`);
  });

  console.log('\nTop 5 files to fix:');
  console.log('------------------');
  fileDetails.slice(0, 5).forEach(({ file, count }) => {
    console.log(`- ${file} (${count} occurrences)`);
  });

  return totalCount;
}

// Run the count
const count = countAnyTypes();
process.exit(count > 0 ? 1 : 0);