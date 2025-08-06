#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Detecting Mock/Sample Data in Production Code\n');
console.log('='.repeat(60));

// Patterns that indicate mock/sample data
const mockPatterns = [
  // Comments indicating temporary/sample data
  /\/\/.*(?:sample|mock|dummy|fake|placeholder|temporary|hardcoded|example)\s+data/gi,
  /\/\/.*(?:for now|temporarily|will be replaced|to be implemented)/gi,
  
  // Hardcoded test data
  /return\s+\[[\s\S]*?(?:abc123|def456|test|dummy|sample|mock)[\s\S]*?\]/gi,
  /=\s*\[[\s\S]*?(?:John Doe|Jane Doe|test@|example\.com)[\s\S]*?\]/gi,
  
  // Mock implementations
  /(?:mock|dummy|fake|sample)(?:Data|Service|Client|Response|Implementation)/gi,
  
  // Placeholder values
  /(?:foo|bar|baz)(?:\d+)?(?:\s*[,;\]}])/g,
  /lorem\s+ipsum/gi,
  
  // Hardcoded IDs and hashes
  /["'](?:abc123|def456|xyz789|123456|test-id|dummy-id)["']/g,
  
  // Sample URLs and emails
  /["'](?:https?:\/\/)?(?:example|test|sample|dummy)\.(?:com|org|net)["']/g,
  /["'](?:test|sample|dummy|user)@(?:example|test)\.com["']/g,
];

// Files to exclude (test files, mocks, etc.)
const excludePatterns = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\.mock\.[jt]sx?$/,
  /__tests__/,
  /__mocks__/,
  /test\//,
  /tests\//,
  /mock\//,
  /mocks\//,
];

const issues = [];

function shouldExcludeFile(filePath) {
  return excludePatterns.some(pattern => pattern.test(filePath));
}

function scanFile(filePath) {
  if (shouldExcludeFile(filePath)) return;
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  mockPatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const line = lines[lineNumber - 1];
      
      issues.push({
        file: filePath,
        line: lineNumber,
        pattern: pattern.source.substring(0, 50) + '...',
        content: line.trim().substring(0, 100),
        type: detectIssueType(pattern, match[0])
      });
    }
  });
}

function detectIssueType(pattern, match) {
  if (/sample|example/i.test(match)) return 'SAMPLE_DATA';
  if (/mock|dummy|fake/i.test(match)) return 'MOCK_DATA';
  if (/placeholder|temporary/i.test(match)) return 'PLACEHOLDER';
  if (/hardcoded/i.test(match)) return 'HARDCODED';
  if (/foo|bar|baz/i.test(match)) return 'TEST_VALUE';
  if (/lorem ipsum/i.test(match)) return 'LOREM_IPSUM';
  return 'SUSPICIOUS';
}

function scanDirectory(dir) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      scanDirectory(fullPath);
    } else if (stat.isFile() && /\.[jt]sx?$/.test(item)) {
      scanFile(fullPath);
    }
  });
}

// Scan the source directory
const srcDir = path.join(process.cwd(), 'src');
if (fs.existsSync(srcDir)) {
  scanDirectory(srcDir);
}

// Report findings
console.log('\n📊 SCAN RESULTS\n');

if (issues.length === 0) {
  console.log('✅ No mock/sample data found in production code!\n');
} else {
  console.log(`❌ Found ${issues.length} instances of mock/sample data:\n`);
  
  // Group by type
  const byType = {};
  issues.forEach(issue => {
    if (!byType[issue.type]) byType[issue.type] = [];
    byType[issue.type].push(issue);
  });
  
  // Display by type
  Object.entries(byType).forEach(([type, typeIssues]) => {
    console.log(`\n${type} (${typeIssues.length} instances):`);
    console.log('-'.repeat(40));
    
    typeIssues.slice(0, 5).forEach(issue => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.content}`);
    });
    
    if (typeIssues.length > 5) {
      console.log(`  ... and ${typeIssues.length - 5} more`);
    }
  });
}

// Generate detailed report
const reportPath = path.join(process.cwd(), 'mock-data-report.json');
fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));

console.log('\n📄 Detailed report saved to: mock-data-report.json');

// Return exit code based on findings
if (issues.length > 0) {
  console.log('\n⚠️  Action Required: Remove all mock/sample data from production code!');
  process.exit(1);
} else {
  console.log('\n✅ Production code is clean!');
  process.exit(0);
}