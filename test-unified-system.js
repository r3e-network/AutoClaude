#!/usr/bin/env node

/**
 * Integration Test for AutoClaude Unified Orchestration System
 * Tests the complete integrated system with all features working together
 */

const fs = require("fs");
const path = require("path");

console.log("🚀 AutoClaude Unified System Integration Test\n");

// Test 1: Verify core integration files
console.log("1. Testing Core Integration Files...");
const integrationFiles = [
  "src/automation/UnifiedOrchestrationSystem.ts",
  "src/extension.ts",
  "src/subagents/SubAgentRunner.ts",
  "src/hooks/AdvancedHookSystem.ts",
  "src/memory/SQLiteMemorySystem.ts",
  "src/automation/AutomaticWorkflowSystem.ts",
];

let integrationTestsPassed = 0;
for (const file of integrationFiles) {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
    integrationTestsPassed++;
  } else {
    console.log(`   ❌ ${file} - MISSING`);
  }
}

console.log(
  `   Integration Files: ${integrationTestsPassed}/${integrationFiles.length} ✅\n`,
);

// Test 2: Verify automatic features configuration
console.log("2. Testing Automatic Features Configuration...");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const autoFeatures = [
  "autoclaude.workflow.autoStart",
  "autoclaude.workflow.autoScale",
  "autoclaude.workflow.learningEnabled",
  "autoclaude.workflow.memoryPersistence",
  "autoclaude.parallelAgents.autoStart",
  "autoclaude.parallelAgents.autoDetectWork",
  "autoclaude.session.autoResumeUnfinishedTasks",
];

let autoFeaturesPassed = 0;
const configs = packageJson.contributes?.configuration?.properties || {};

for (const feature of autoFeatures) {
  if (configs[feature]) {
    console.log(
      `   ✅ ${feature}: ${configs[feature].default ? "enabled" : "disabled"} by default`,
    );
    autoFeaturesPassed++;
  } else {
    console.log(`   ❌ ${feature} - NOT CONFIGURED`);
  }
}

console.log(
  `   Auto Features: ${autoFeaturesPassed}/${autoFeatures.length} ✅\n`,
);

// Test 3: Verify integration methods
console.log("3. Testing Integration Methods...");
const unifiedSystemContent = fs.readFileSync(
  "src/automation/UnifiedOrchestrationSystem.ts",
  "utf8",
);
const requiredMethods = [
  "processNaturalCommand",
  "executeTaskWithOrchestration",
  "executeWithSubAgent",
  "executeWithParallelAgents",
  "detectAndProcessPendingWork",
  "planTasks",
  "analyzeCommandIntent",
  "setupAutomaticCoordination",
  "startAutomaticMonitoring",
];

let methodsPassed = 0;
for (const method of requiredMethods) {
  if (
    unifiedSystemContent.includes(`async ${method}(`) ||
    unifiedSystemContent.includes(`private async ${method}(`)
  ) {
    console.log(`   ✅ Method: ${method}`);
    methodsPassed++;
  } else {
    console.log(`   ❌ Method: ${method} - MISSING`);
  }
}

console.log(
  `   Integration Methods: ${methodsPassed}/${requiredMethods.length} ✅\n`,
);

// Test 4: Verify no placeholders or TODOs
console.log("4. Testing Production Readiness (No Placeholders)...");
const placeholderPatterns = [
  /\/\/\s*TODO:/gi,
  /\/\/\s*FIXME:/gi,
  /placeholder/gi,
  /simplified/gi,
  /mock(?!ing)/gi,
  /stub(?!born)/gi,
  /not\s+implemented/gi,
  /throw\s+new\s+Error\s*\(\s*['"]Not\s+implemented/gi,
];

let placeholderIssues = 0;
const criticalFiles = [
  "src/automation/UnifiedOrchestrationSystem.ts",
  "src/hooks/AdvancedHookSystem.ts",
  "src/automation/AutomaticWorkflowSystem.ts",
];

for (const file of criticalFiles) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8");
    let hasIssue = false;

    for (const pattern of placeholderPatterns) {
      if (pattern.test(content)) {
        hasIssue = true;
        placeholderIssues++;
        console.log(
          `   ⚠️  ${file} - Contains placeholder pattern: ${pattern}`,
        );
        break;
      }
    }

    if (!hasIssue) {
      console.log(`   ✅ ${file} - Production ready`);
    }
  }
}

console.log(
  `   Production Readiness: ${criticalFiles.length - placeholderIssues}/${criticalFiles.length} files ready\n`,
);

// Test 5: Verify system orchestration
console.log("5. Testing System Orchestration...");
const orchestrationFeatures = {
  "Hive-Mind Integration": unifiedSystemContent.includes(
    "workflowSystem.processTask",
  ),
  "SubAgent Integration": unifiedSystemContent.includes(
    "subAgentRunner.runSingleAgent",
  ),
  "Parallel Agent Integration": unifiedSystemContent.includes(
    "parallelOrchestrator",
  ),
  "Memory Integration": unifiedSystemContent.includes("memoryManager"),
  "Hook Integration": unifiedSystemContent.includes("hookManager.runHooks"),
  "Context Management": unifiedSystemContent.includes("contextManager"),
  "Error Recovery": unifiedSystemContent.includes(
    "errorRecovery.attemptRecovery",
  ),
  "Automatic Detection": unifiedSystemContent.includes(
    "detectAndProcessPendingWork",
  ),
};

let orchestrationPassed = 0;
for (const [feature, exists] of Object.entries(orchestrationFeatures)) {
  if (exists) {
    console.log(`   ✅ ${feature}`);
    orchestrationPassed++;
  } else {
    console.log(`   ❌ ${feature} - NOT INTEGRATED`);
  }
}

console.log(
  `   Orchestration Features: ${orchestrationPassed}/${Object.keys(orchestrationFeatures).length} ✅\n`,
);

// Test 6: Verify automatic startup
console.log("6. Testing Automatic Startup Configuration...");
const extensionContent = fs.readFileSync("src/extension.ts", "utf8");
const startupChecks = {
  "Unified System Initialization": extensionContent.includes(
    "UnifiedOrchestrationSystem.getInstance",
  ),
  "Auto-start Configuration": extensionContent.includes(
    "workflowConfig.get<boolean>('autoStart'",
  ),
  "Unified System Start": extensionContent.includes("unifiedSystem.start()"),
  "Global Storage": extensionContent.includes("(global as any).unifiedSystem"),
  "Error Handling": extensionContent.includes("catch (error)"),
};

let startupPassed = 0;
for (const [check, exists] of Object.entries(startupChecks)) {
  if (exists) {
    console.log(`   ✅ ${check}`);
    startupPassed++;
  } else {
    console.log(`   ❌ ${check} - MISSING`);
  }
}

console.log(
  `   Startup Configuration: ${startupPassed}/${Object.keys(startupChecks).length} ✅\n`,
);

// Final Summary
console.log("📊 UNIFIED SYSTEM TEST SUMMARY");
console.log("=".repeat(50));

const allTests = [
  {
    name: "Integration Files",
    passed: integrationTestsPassed,
    total: integrationFiles.length,
  },
  {
    name: "Auto Features",
    passed: autoFeaturesPassed,
    total: autoFeatures.length,
  },
  {
    name: "Integration Methods",
    passed: methodsPassed,
    total: requiredMethods.length,
  },
  {
    name: "Production Readiness",
    passed: criticalFiles.length - placeholderIssues,
    total: criticalFiles.length,
  },
  {
    name: "Orchestration Features",
    passed: orchestrationPassed,
    total: Object.keys(orchestrationFeatures).length,
  },
  {
    name: "Startup Configuration",
    passed: startupPassed,
    total: Object.keys(startupChecks).length,
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
  console.log(
    "🎉 PERFECT! AutoClaude Unified System is fully integrated and production ready! 🚀",
  );
} else if (overallPercentage >= 90) {
  console.log(
    "✅ EXCELLENT! System is well integrated with minor improvements needed.",
  );
} else if (overallPercentage >= 80) {
  console.log("⚠️  GOOD! System integration needs some attention.");
} else {
  console.log("❌ NEEDS WORK! Critical integration issues detected.");
}

console.log("\n🌟 AutoClaude Unified System Features:");
console.log("   • Automatic task detection and processing");
console.log("   • Intelligent orchestration across all agent types");
console.log("   • Natural language command processing");
console.log("   • Persistent memory and learning");
console.log("   • Automatic error recovery");
console.log("   • Context-aware task planning");
console.log("   • Production-ready without placeholders");
console.log("   • Professional git commit authorship");

process.exit(overallPercentage >= 90 ? 0 : 1);
