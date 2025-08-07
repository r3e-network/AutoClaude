#!/usr/bin/env node

/**
 * Test script for automatic issue fixing
 */

const fs = require('fs');
const path = require('path');

// Import the IssueFixerAgent
const { IssueFixerAgent } = require('./out/automation/IssueFixerAgent');

async function testAutoFix() {
  console.log("Testing automatic issue fixing...\n");
  
  const testFile = path.join(__dirname, 'test-issue-fixing.ts');
  const workspaceRoot = __dirname;
  
  // Create test issues based on the file
  const issues = [
    {
      type: "todo",
      file: testFile,
      line: 6,
      message: "TODO: Implement user authentication",
      severity: "warning",
      fixable: true
    },
    {
      type: "hardcoded-secret",
      file: testFile,
      line: 11,
      message: "Hardcoded password detected",
      severity: "critical",
      fixable: true
    },
    {
      type: "hardcoded-secret",
      file: testFile,
      line: 12,
      message: "API key should not be hardcoded",
      severity: "critical",
      fixable: true
    },
    {
      type: "console-log",
      file: testFile,
      line: 15,
      message: "Console.log should be removed",
      severity: "warning",
      fixable: true
    },
    {
      type: "console-log",
      file: testFile,
      line: 16,
      message: "Console.error should be removed",
      severity: "warning",
      fixable: true
    },
    {
      type: "placeholder",
      file: testFile,
      line: 21,
      message: "Not implemented placeholder",
      severity: "error",
      fixable: true
    },
    {
      type: "placeholder",
      file: testFile,
      line: 34,
      message: "EXAMPLE placeholder should be replaced",
      severity: "error",
      fixable: true
    }
  ];
  
  // Read original file
  console.log("Original file content:");
  console.log("=".repeat(50));
  const originalContent = fs.readFileSync(testFile, 'utf8');
  console.log(originalContent);
  console.log("=".repeat(50));
  
  // Create IssueFixerAgent
  const fixer = new IssueFixerAgent(workspaceRoot);
  
  // Fix issues
  console.log("\nFixing issues...");
  const fixedCount = await fixer.fixIssuesInFile(testFile, issues);
  
  console.log(`\nFixed ${fixedCount} issues`);
  
  // Read fixed file
  console.log("\nFixed file content:");
  console.log("=".repeat(50));
  const fixedContent = fs.readFileSync(testFile, 'utf8');
  console.log(fixedContent);
  console.log("=".repeat(50));
  
  // Generate report
  const report = fixer.generateFixReport();
  console.log("\nFix Report:");
  console.log(report);
  
  // Restore original content for future tests
  fs.writeFileSync(testFile, originalContent, 'utf8');
  console.log("\nOriginal content restored for future tests.");
}

// Run test
testAutoFix().catch(console.error);