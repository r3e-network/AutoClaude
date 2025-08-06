#!/usr/bin/env node

/**
 * Test script for MockDataDetectionAgent
 * Demonstrates the agent detecting mock data in a project
 */

const path = require('path');

// Create a test project with mock data
const fs = require('fs');
const testDir = path.join(__dirname, '.test-mock-detection');

console.log('\n🧪 Testing MockDataDetectionAgent\n');
console.log('='.repeat(60));

// Create test directory
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Create src directory
const srcDir = path.join(testDir, 'src');
if (!fs.existsSync(srcDir)) {
  fs.mkdirSync(srcDir, { recursive: true });
}

// Create test files with various mock data issues
const testFiles = [
  {
    name: 'userService.ts',
    content: `
export class UserService {
  // Sample data for testing - SHOULD BE DETECTED
  private users = [
    { id: "abc123", name: "John Doe", email: "john@example.com" },
    { id: "def456", name: "Jane Doe", email: "jane@test.com" }
  ];

  async getUser(id: string) {
    // For now, return from hardcoded data - SHOULD BE DETECTED
    return this.users.find(u => u.id === id);
  }

  async createUser(name: string) {
    // TODO: implement database save - SHOULD BE DETECTED
    throw new Error("Not implemented");
  }
}
`
  },
  {
    name: 'mockApi.ts',
    content: `
// Mock API service - SHOULD BE DETECTED
export class MockApiService {
  async fetchData() {
    // Return dummy data
    return {
      status: "success",
      data: "Lorem ipsum dolor sit amet" // SHOULD BE DETECTED
    };
  }
}
`
  },
  {
    name: 'config.ts',
    content: `
export const config = {
  apiUrl: "http://localhost:3000", // SHOULD BE DETECTED
  testEmail: "test@example.com", // SHOULD BE DETECTED
  sampleData: true // SHOULD BE DETECTED
};

console.log("Debug:", config); // SHOULD BE DETECTED
`
  },
  {
    name: 'cleanCode.ts',
    content: `
// This file should pass - no mock data
export class DatabaseService {
  constructor(private connectionString: string) {}
  
  async query(sql: string, params: any[]) {
    // Real implementation would go here
    return this.executeQuery(sql, params);
  }
  
  private async executeQuery(sql: string, params: any[]) {
    // Actual database connection logic
    return [];
  }
}
`
  }
];

// Write test files
testFiles.forEach(file => {
  fs.writeFileSync(path.join(srcDir, file.name), file.content);
  console.log(`✅ Created test file: ${file.name}`);
});

// Now run the MockDataDetectionAgent
console.log('\n📊 Running MockDataDetectionAgent...\n');

try {
  // Import and run the agent
  const { MockDataDetectionAgent } = require('./src/subagents/agents/MockDataDetectionAgent');
  
  const agent = new MockDataDetectionAgent(testDir);
  
  agent.execute({ workspacePath: testDir }).then(result => {
    console.log('='.repeat(60));
    console.log('\n🔍 Agent Results:\n');
    console.log(`Status: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Message: ${result.message}`);
    
    if (result.data) {
      console.log(`\nTotal Issues: ${result.data.totalIssues}`);
      console.log(`Critical Issues: ${result.data.criticalIssues}`);
      console.log(`Warnings: ${result.data.warnings}`);
      
      if (result.data.summary) {
        console.log('\nIssue Summary:');
        Object.entries(result.data.summary).forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
      }
    }
    
    if (result.suggestions && result.suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      result.suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion}`);
      });
    }
    
    // Clean up test directory
    console.log('\n🧹 Cleaning up test files...');
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('✅ Test complete!\n');
  }).catch(error => {
    console.error('Error running agent:', error);
    // Clean up on error too
    fs.rmSync(testDir, { recursive: true, force: true });
  });
} catch (error) {
  console.error('Failed to load agent:', error);
  // Clean up
  fs.rmSync(testDir, { recursive: true, force: true });
}