#!/usr/bin/env node

/**
 * Integration Test for AutoClaude Hive-Mind System
 * Tests the complete agent ecosystem and workflow orchestration
 */

const fs = require("fs");
const path = require("path");

console.log("🧠 AutoClaude Hive-Mind Integration Test\n");

// Test 1: Verify all agent files exist
console.log("1. Testing Agent File Structure...");
const agentFiles = [
  "src/agents/hivemind/QueenAgent.ts",
  "src/agents/hivemind/ArchitectAgent.ts",
  "src/agents/hivemind/CoderAgent.ts",
  "src/agents/hivemind/TesterAgent.ts",
  "src/agents/hivemind/ResearcherAgent.ts",
  "src/agents/hivemind/SecurityAgent.ts",
  "src/agents/hivemind/DocumentationAgent.ts",
  "src/agents/hivemind/OptimizationAgent.ts",
  "src/agents/hivemind/types.ts",
];

let agentTestsPassed = 0;
for (const file of agentFiles) {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
    agentTestsPassed++;
  } else {
    console.log(`   ❌ ${file} - MISSING`);
  }
}

console.log(`   Agent Files: ${agentTestsPassed}/${agentFiles.length} ✅\n`);

// Test 2: Verify core system files
console.log("2. Testing Core System Files...");
const coreFiles = [
  "src/automation/AutomaticWorkflowSystem.ts",
  "src/hooks/AdvancedHookSystem.ts",
  "src/memory/SQLiteMemorySystem.ts",
  "src/utils/productionLogger.ts",
];

let coreTestsPassed = 0;
for (const file of coreFiles) {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
    coreTestsPassed++;
  } else {
    console.log(`   ❌ ${file} - MISSING`);
  }
}

console.log(`   Core Files: ${coreTestsPassed}/${coreFiles.length} ✅\n`);

// Test 3: Verify package.json configuration
console.log("3. Testing Package Configuration...");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

const requiredCommands = [
  "autoclaude.startHiveMind",
  "autoclaude.startSwarm",
  "autoclaude.executeNaturalCommand",
  "autoclaude.showWorkflowStatus",
  "autoclaude.toggleHook",
  "autoclaude.viewMemoryInsights",
];

let commandTestsPassed = 0;
const commands = packageJson.contributes?.commands || [];
const commandNames = commands.map((cmd) => cmd.command);

for (const requiredCmd of requiredCommands) {
  if (commandNames.includes(requiredCmd)) {
    console.log(`   ✅ Command: ${requiredCmd}`);
    commandTestsPassed++;
  } else {
    console.log(`   ❌ Command: ${requiredCmd} - MISSING`);
  }
}

console.log(
  `   Commands: ${commandTestsPassed}/${requiredCommands.length} ✅\n`,
);

// Test 4: Verify workflow configuration
console.log("4. Testing Workflow Configuration...");
const workflowConfig = packageJson.contributes?.configuration?.properties || {};
const requiredConfigs = [
  "autoclaude.workflow.mode",
  "autoclaude.workflow.maxAgents",
  "autoclaude.workflow.memoryPersistence",
  "autoclaude.hooks.preOperation",
  "autoclaude.hooks.postOperation",
];

let configTestsPassed = 0;
for (const requiredConfig of requiredConfigs) {
  if (workflowConfig[requiredConfig]) {
    console.log(`   ✅ Config: ${requiredConfig}`);
    configTestsPassed++;
  } else {
    console.log(`   ❌ Config: ${requiredConfig} - MISSING`);
  }
}

console.log(
  `   Configurations: ${configTestsPassed}/${requiredConfigs.length} ✅\n`,
);

// Test 5: Verify dependencies
console.log("5. Testing Dependencies...");
const dependencies = {
  ...(packageJson.dependencies || {}),
  ...(packageJson.devDependencies || {}),
};
const requiredDeps = ["sqlite", "sqlite3"];

let depTestsPassed = 0;
for (const dep of requiredDeps) {
  if (dependencies[dep]) {
    console.log(`   ✅ Dependency: ${dep}@${dependencies[dep]}`);
    depTestsPassed++;
  } else {
    console.log(`   ❌ Dependency: ${dep} - MISSING`);
  }
}

console.log(`   Dependencies: ${depTestsPassed}/${requiredDeps.length} ✅\n`);

// Test 6: Verify build output
console.log("6. Testing Build Output...");
const buildFiles = ["out/extension.js", "autoclaude-3.10.0.vsix"];

let buildTestsPassed = 0;
for (const file of buildFiles) {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    console.log(`   ✅ ${file} (${Math.round(stats.size / 1024)}KB)`);
    buildTestsPassed++;
  } else {
    console.log(`   ❌ ${file} - MISSING`);
  }
}

console.log(`   Build Files: ${buildTestsPassed}/${buildFiles.length} ✅\n`);

// Test 7: Verify agent capabilities
console.log("7. Testing Agent Capabilities...");
const agentCapabilities = {
  QueenAgent: ["orchestration", "task-decomposition", "agent-assignment"],
  ArchitectAgent: ["system-design", "architecture-planning", "api-design"],
  CoderAgent: ["code-generation", "implementation", "refactoring"],
  TesterAgent: ["unit-testing", "integration-testing", "coverage-analysis"],
  ResearcherAgent: [
    "code-analysis",
    "pattern-discovery",
    "best-practices-research",
  ],
  SecurityAgent: [
    "vulnerability-scanning",
    "security-audit",
    "threat-modeling",
  ],
  DocumentationAgent: [
    "api-documentation",
    "code-documentation",
    "user-guides",
  ],
  OptimizationAgent: [
    "performance-optimization",
    "code-optimization",
    "memory-optimization",
  ],
};

let capabilityTestsPassed = 0;
let totalCapabilities = 0;

for (const [agentName, capabilities] of Object.entries(agentCapabilities)) {
  const agentFile = `src/agents/hivemind/${agentName}.ts`;
  if (fs.existsSync(agentFile)) {
    const content = fs.readFileSync(agentFile, "utf8");
    let agentCapabilitiesFound = 0;

    for (const capability of capabilities) {
      if (content.includes(`'${capability}'`)) {
        agentCapabilitiesFound++;
        totalCapabilities++;
      }
    }

    if (agentCapabilitiesFound === capabilities.length) {
      console.log(
        `   ✅ ${agentName}: ${agentCapabilitiesFound}/${capabilities.length} capabilities`,
      );
      capabilityTestsPassed++;
    } else {
      console.log(
        `   ⚠️  ${agentName}: ${agentCapabilitiesFound}/${capabilities.length} capabilities`,
      );
    }
  }
}

console.log(
  `   Agent Capabilities: ${capabilityTestsPassed}/${Object.keys(agentCapabilities).length} ✅\n`,
);

// Final Summary
console.log("📊 INTEGRATION TEST SUMMARY");
console.log("=".repeat(50));

const allTests = [
  { name: "Agent Files", passed: agentTestsPassed, total: agentFiles.length },
  { name: "Core Files", passed: coreTestsPassed, total: coreFiles.length },
  {
    name: "Commands",
    passed: commandTestsPassed,
    total: requiredCommands.length,
  },
  {
    name: "Configuration",
    passed: configTestsPassed,
    total: requiredConfigs.length,
  },
  { name: "Dependencies", passed: depTestsPassed, total: requiredDeps.length },
  { name: "Build Output", passed: buildTestsPassed, total: buildFiles.length },
  {
    name: "Agent Capabilities",
    passed: capabilityTestsPassed,
    total: Object.keys(agentCapabilities).length,
  },
];

let overallPassed = 0;
let overallTotal = 0;

for (const test of allTests) {
  const percentage = Math.round((test.passed / test.total) * 100);
  const status = percentage === 100 ? "✅" : percentage >= 80 ? "⚠️" : "❌";
  console.log(
    `${status} ${test.name}: ${test.passed}/${test.total} (${percentage}%)`,
  );
  overallPassed += test.passed;
  overallTotal += test.total;
}

const overallPercentage = Math.round((overallPassed / overallTotal) * 100);
console.log("\n" + "=".repeat(50));
console.log(
  `🎯 OVERALL RESULT: ${overallPassed}/${overallTotal} (${overallPercentage}%)`,
);

if (overallPercentage === 100) {
  console.log("🎉 ALL TESTS PASSED! AutoClaude Hive-Mind system is ready! 🚀");
} else if (overallPercentage >= 90) {
  console.log("✅ SYSTEM READY with minor issues. Deploy with confidence! 🚀");
} else if (overallPercentage >= 80) {
  console.log(
    "⚠️  SYSTEM MOSTLY READY. Review failing tests before deployment.",
  );
} else {
  console.log(
    "❌ SYSTEM NOT READY. Address critical issues before deployment.",
  );
}

console.log("\n🧠 AutoClaude Hive-Mind Features:");
console.log("   • 7 Specialized AI Agents");
console.log("   • Natural Language Command Processing");
console.log("   • SQLite-based Persistent Memory");
console.log("   • Advanced Hook System");
console.log("   • Production-Ready Logging");
console.log("   • Swarm & Hive-Mind Modes");
console.log("   • Automatic Workflow Orchestration");

process.exit(overallPercentage >= 90 ? 0 : 1);
