#!/usr/bin/env node

const path = require('path');

// Check if the extension can be loaded
try {
  console.log('Testing extension loading...');
  
  // Check if main file exists
  const mainFile = path.join(__dirname, 'out', 'extension.js');
  const fs = require('fs');
  
  if (!fs.existsSync(mainFile)) {
    console.error('❌ Main extension file not found:', mainFile);
    process.exit(1);
  }
  
  console.log('✅ Main extension file exists');
  
  // Try to load the extension module
  const extension = require(mainFile);
  
  console.log('✅ Extension module loaded');
  console.log('Available exports:', Object.keys(extension));
  
  if (typeof extension.activate === 'function') {
    console.log('✅ activate function found');
  } else {
    console.error('❌ activate function not found');
  }
  
  if (typeof extension.deactivate === 'function') {
    console.log('✅ deactivate function found');
  } else {
    console.error('❌ deactivate function not found');
  }
  
} catch (error) {
  console.error('❌ Error loading extension:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}