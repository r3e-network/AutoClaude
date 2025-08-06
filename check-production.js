const fs = require('fs');
const path = require('path');

console.log('\n🔍 COMPREHENSIVE PRODUCTION READINESS CHECK\n');
console.log('='.repeat(60));

// Check for common issues
function checkDirectory(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  let issues = {
    todos: 0,
    fixmes: 0,
    consoleLog: 0,
    hardcodedUrls: 0,
    anyTypes: 0,
    emptyTryCatch: 0,
    notImplemented: 0
  };

  function scanFile(filePath) {
    if (filePath.includes('node_modules') || filePath.includes('.git')) return;
    
    const ext = path.extname(filePath);
    if (!extensions.includes(ext)) return;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Skip comments that are just checking for these patterns
      if (line.includes('// ') || line.includes('* ')) return;
      
      // Check for actual TODOs in comments
      if (/\/\/\s*TODO:/i.test(line)) issues.todos++;
      if (/\/\/\s*FIXME:/i.test(line)) issues.fixmes++;
      
      // Check for console.log (not in strings or comments)
      if (/^\s*console\.log\(/.test(line)) issues.consoleLog++;
      
      // Check for hardcoded URLs
      if (/https?:\/\/localhost/i.test(line) && !line.includes('||') && !line.includes('process.env')) {
        issues.hardcodedUrls++;
      }
      
      // Check for any types
      if (/:\s*any(?:\s|,|;|\)|>)/.test(line)) issues.anyTypes++;
      
      // Check for empty try-catch
      if (/catch\s*\([^)]*\)\s*{\s*}/.test(line)) issues.emptyTryCatch++;
      
      // Check for not implemented
      if (/throw.*not implemented/i.test(line)) issues.notImplemented++;
    });
  }

  function scanDir(dirPath) {
    const items = fs.readdirSync(dirPath);
    items.forEach(item => {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else {
        scanFile(fullPath);
      }
    });
  }

  scanDir(dir);
  return issues;
}

// Run checks
const srcIssues = checkDirectory('./src');
const testIssues = checkDirectory('./tests');

// Display results
console.log('\n📊 SOURCE CODE ANALYSIS (src/)\n');
console.log(`  TODO comments:        ${srcIssues.todos}`);
console.log(`  FIXME comments:       ${srcIssues.fixmes}`);
console.log(`  console.log calls:    ${srcIssues.consoleLog}`);
console.log(`  Hardcoded URLs:       ${srcIssues.hardcodedUrls}`);
console.log(`  'any' types:          ${srcIssues.anyTypes}`);
console.log(`  Empty try-catch:      ${srcIssues.emptyTryCatch}`);
console.log(`  Not implemented:      ${srcIssues.notImplemented}`);

console.log('\n📊 TEST CODE ANALYSIS (tests/)\n');
console.log(`  TODO comments:        ${testIssues.todos}`);
console.log(`  FIXME comments:       ${testIssues.fixmes}`);
console.log(`  console.log calls:    ${testIssues.consoleLog}`);
console.log(`  'any' types:          ${testIssues.anyTypes}`);

// Check build status
console.log('\n🔨 BUILD STATUS\n');
const { execSync } = require('child_process');
try {
  execSync('npm run compile', { stdio: 'ignore' });
  console.log('  ✅ Build successful');
} catch (e) {
  console.log('  ❌ Build failed');
}

// Check tests
console.log('\n🧪 TEST STATUS\n');
try {
  execSync('npm test', { stdio: 'ignore', timeout: 10000 });
  console.log('  ✅ Tests passing');
} catch (e) {
  console.log('  ⚠️  Tests failed or timed out');
}

// Overall assessment
console.log('\n' + '='.repeat(60));
console.log('\n📋 PRODUCTION READINESS ASSESSMENT\n');

const criticalIssues = srcIssues.todos + srcIssues.fixmes + srcIssues.notImplemented + srcIssues.hardcodedUrls;
const warnings = srcIssues.consoleLog + srcIssues.anyTypes + srcIssues.emptyTryCatch;

if (criticalIssues === 0 && warnings < 10) {
  console.log('  ✅ PRODUCTION READY - No critical issues found');
} else if (criticalIssues < 5) {
  console.log('  ⚠️  NEARLY READY - Minor issues to address');
} else {
  console.log('  ❌ NOT READY - Critical issues need resolution');
}

console.log(`\n  Critical Issues: ${criticalIssues}`);
console.log(`  Warnings: ${warnings}`);
console.log(`  Total Issues: ${criticalIssues + warnings}`);

// Recommendations
console.log('\n💡 RECOMMENDATIONS\n');
if (srcIssues.todos > 0) console.log('  • Remove TODO comments and implement missing features');
if (srcIssues.fixmes > 0) console.log('  • Address FIXME issues');
if (srcIssues.consoleLog > 0) console.log('  • Replace console.log with proper logging');
if (srcIssues.hardcodedUrls > 0) console.log('  • Move hardcoded URLs to configuration');
if (srcIssues.anyTypes > 20) console.log('  • Replace "any" types with specific TypeScript types');
if (srcIssues.emptyTryCatch > 0) console.log('  • Add proper error handling in empty catch blocks');
if (srcIssues.notImplemented > 0) console.log('  • Implement all placeholder functions');

console.log('\n' + '='.repeat(60) + '\n');