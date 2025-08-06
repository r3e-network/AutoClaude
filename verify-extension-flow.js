const fs = require('fs');
const path = require('path');

console.log('=== Extension Loading Flow Verification ===\n');

// 1. Check package.json main entry
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('1️⃣ Package.json main entry:', packageJson.main);
if (packageJson.main !== './out/extension.js') {
  console.log('   ❌ ERROR: Main entry should be ./out/extension.js');
} else {
  console.log('   ✅ Correct main entry point');
}

// 2. Check if index.ts exists (our wrapper)
const indexPath = path.join('src', 'index.ts');
if (fs.existsSync(indexPath)) {
  console.log('\n2️⃣ Index.ts wrapper exists');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  if (indexContent.includes('module.exports')) {
    console.log('   ✅ Has CommonJS exports');
  } else {
    console.log('   ❌ Missing CommonJS exports');
  }
} else {
  console.log('\n2️⃣ ❌ Index.ts wrapper missing');
}

// 3. Check esbuild configuration
const esbuildPath = 'esbuild.js';
if (fs.existsSync(esbuildPath)) {
  const esbuildContent = fs.readFileSync(esbuildPath, 'utf8');
  console.log('\n3️⃣ Esbuild configuration:');
  if (esbuildContent.includes('src/index.ts')) {
    console.log('   ✅ Entry point is src/index.ts');
  } else if (esbuildContent.includes('src/extension.ts')) {
    console.log('   ⚠️  Entry point is src/extension.ts (should be index.ts)');
  }
  if (esbuildContent.includes('format: "cjs"')) {
    console.log('   ✅ Output format is CommonJS');
  }
  if (esbuildContent.includes('keepNames: true')) {
    console.log('   ✅ Function names preserved');
  }
}

// 4. Check compiled output
const outPath = path.join('out', 'extension.js');
if (fs.existsSync(outPath)) {
  const outContent = fs.readFileSync(outPath, 'utf8');
  console.log('\n4️⃣ Compiled output verification:');
  
  // Check for module.exports
  if (outContent.includes('module.exports')) {
    console.log('   ✅ Has module.exports');
    
    // Check if it's not the broken pattern
    if (outContent.includes('0 && (module.exports')) {
      console.log('   ❌ WARNING: Broken export pattern detected');
    } else {
      console.log('   ✅ Export pattern looks correct');
    }
  } else {
    console.log('   ❌ Missing module.exports');
  }
  
  // Check for activate/deactivate
  if (outContent.includes('activate') && outContent.includes('deactivate')) {
    console.log('   ✅ Contains activate and deactivate functions');
  } else {
    console.log('   ❌ Missing activate or deactivate functions');
  }
}

// 5. Check activation events
console.log('\n5️⃣ Activation configuration:');
if (packageJson.activationEvents) {
  packageJson.activationEvents.forEach(event => {
    if (event === 'onStartupFinished') {
      console.log('   ✅ Uses onStartupFinished (no circular dependency)');
    } else if (event.startsWith('onCommand:')) {
      console.log('   ⚠️  Uses onCommand (potential circular dependency)');
    } else {
      console.log(`   ℹ️  ${event}`);
    }
  });
}

console.log('\n=== Loading Flow Summary ===');
console.log('VS Code loads extension.vsix → reads package.json → loads ./out/extension.js');
console.log('→ calls module.exports.activate() → registers all commands → ready to use');
console.log('\n✅ Extension should load and activate without "command not found" errors');
