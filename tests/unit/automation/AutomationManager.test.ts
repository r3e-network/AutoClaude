/**
 * AutomationManager Unit Tests
 *
 * Tests for the enhanced automation manager with environment detection
 */

import { jest } from "@jest/globals";
import { AutomationManager } from "../../../src/automation/automationManager";

// Mock dependencies
jest.mock("../../../src/config/enhanced-config");
jest.mock("../../../src/config/index");
jest.mock("../../../src/utils/logging");
jest.mock("vscode");

describe("AutomationManager", () => {
  let automationManager: AutomationManager;
  const mockWorkspacePath = "/test/workspace";

  // Mock the enhanced config
  const mockConfig = {
    initialize: jest.fn(),
    getConfig: jest.fn().mockReturnValue({
      memory: { enabled: true },
      agents: { enabled: true },
      hooks: { enabled: true },
      neoRs: { enabled: false },
    }),
  };

  // Mock environment detection functions
  const mockDetectNeoRsEnvironment = jest.fn();
  const mockDetectGitBranch = jest.fn();
  const mockIsNeoRsBranch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    require("../../../src/config/enhanced-config").getEnhancedConfig = jest
      .fn()
      .mockReturnValue(mockConfig);
    require("../../../src/config/index").detectNeoRsEnvironment =
      mockDetectNeoRsEnvironment;
    require("../../../src/config/index").detectGitBranch = mockDetectGitBranch;
    require("../../../src/config/index").isNeoRsBranch = mockIsNeoRsBranch;

    automationManager = new AutomationManager(mockWorkspacePath);
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      mockDetectNeoRsEnvironment.mockReturnValue(false);
      mockDetectGitBranch.mockReturnValue("main");
      mockIsNeoRsBranch.mockReturnValue(false);

      await automationManager.initialize();

      expect(mockConfig.initialize).toHaveBeenCalled();
      expect(mockDetectNeoRsEnvironment).toHaveBeenCalledWith(
        mockWorkspacePath,
      );
      expect(mockDetectGitBranch).toHaveBeenCalledWith(mockWorkspacePath);
    });

    it("should detect Neo-rs environment", async () => {
      mockDetectNeoRsEnvironment.mockReturnValue(true);
      mockDetectGitBranch.mockReturnValue("neo-rs");
      mockIsNeoRsBranch.mockReturnValue(true);

      await automationManager.initialize();

      const envInfo = automationManager.getEnvironmentInfo();
      expect(envInfo).toBeTruthy();
      expect(envInfo?.isNeoRs).toBe(true);
      expect(envInfo?.branch).toBe("neo-rs");
      expect(envInfo?.isNeoRsBranch).toBe(true);
    });

    it("should handle initialization errors gracefully", async () => {
      mockConfig.initialize.mockRejectedValue(new Error("Config init failed"));

      await automationManager.initialize();

      // Should not throw and should continue with disabled state
      expect(automationManager["isEnabled"]).toBe(false);
    });
  });

  describe("environment detection", () => {
    it("should detect non-Neo environment", async () => {
      mockDetectNeoRsEnvironment.mockReturnValue(false);
      mockDetectGitBranch.mockReturnValue("main");
      mockIsNeoRsBranch.mockReturnValue(false);

      await automationManager.initialize();

      expect(automationManager.isNeoRsEnvironment()).toBe(false);
    });

    it("should detect Neo-rs environment by directory structure", async () => {
      mockDetectNeoRsEnvironment.mockReturnValue(true);
      mockDetectGitBranch.mockReturnValue("main");
      mockIsNeoRsBranch.mockReturnValue(false);

      await automationManager.initialize();

      expect(automationManager.isNeoRsEnvironment()).toBe(true);
    });

    it("should detect Neo-rs environment by branch name", async () => {
      mockDetectNeoRsEnvironment.mockReturnValue(false);
      mockDetectGitBranch.mockReturnValue("neo-rs-development");
      mockIsNeoRsBranch.mockReturnValue(true);

      await automationManager.initialize();

      expect(automationManager.isNeoRsEnvironment()).toBe(true);
    });

    it("should allow environment refresh", async () => {
      mockDetectNeoRsEnvironment.mockReturnValue(false);
      mockDetectGitBranch.mockReturnValue("main");
      mockIsNeoRsBranch.mockReturnValue(false);

      await automationManager.initialize();
      expect(automationManager.isNeoRsEnvironment()).toBe(false);

      // Simulate branch change
      mockDetectGitBranch.mockReturnValue("neo-rs");
      mockIsNeoRsBranch.mockReturnValue(true);

      await automationManager.refreshEnvironment();
      expect(automationManager.isNeoRsEnvironment()).toBe(true);
    });
  });

  describe("message processing", () => {
    beforeEach(async () => {
      mockDetectNeoRsEnvironment.mockReturnValue(false);
      mockDetectGitBranch.mockReturnValue("main");
      mockIsNeoRsBranch.mockReturnValue(false);

      await automationManager.initialize();
    });

    it("should process regular messages", async () => {
      const message = "Update the user interface";
      const result = await automationManager.processMessage(message);

      expect(result).toContain("Environment-Aware Automation Instructions");
      expect(result).toContain(message);
    });

    it("should add Neo-rs instructions for Neo environment", async () => {
      mockDetectNeoRsEnvironment.mockReturnValue(true);
      mockDetectGitBranch.mockReturnValue("neo-rs");
      mockIsNeoRsBranch.mockReturnValue(true);

      await automationManager.refreshEnvironment();

      const message = "Convert C# class to Rust";
      const result = await automationManager.processMessage(message);

      expect(result).toContain("Neo-rs Specific Instructions");
      expect(result).toContain(
        "100% compatibility with C# Neo N3 implementation",
      );
      expect(result).toContain("C# to Rust Conversion Instructions");
      expect(result).toContain("UInt160 → U160, UInt256 → U256");
    });

    it("should include conversion instructions for conversion tasks", async () => {
      mockDetectNeoRsEnvironment.mockReturnValue(true);
      await automationManager.refreshEnvironment();

      const message = "Convert this C# code to Rust";
      const result = await automationManager.processMessage(message);

      expect(result).toContain("C# to Rust Conversion Instructions");
      expect(result).toContain("pattern learning");
      expect(result).toContain("type mappings");
    });

    it("should include branch context information", async () => {
      mockDetectGitBranch.mockReturnValue("feature/new-consensus");
      await automationManager.refreshEnvironment();

      const message = "Update consensus mechanism";
      const result = await automationManager.processMessage(message);

      expect(result).toContain("Branch Context");
      expect(result).toContain("feature/new-consensus");
    });

    it("should include configuration-aware instructions", async () => {
      const message = "Refactor the code";
      const result = await automationManager.processMessage(message);

      expect(result).toContain("Pattern learning is available");
      expect(result).toContain("Multi-agent coordination is available");
      expect(result).toContain(
        "Automated validation and formatting hooks are active",
      );
    });

    it("should return original message if automation is disabled", async () => {
      automationManager["isEnabled"] = false;

      const message = "Test message";
      const result = await automationManager.processMessage(message);

      expect(result).toBe(message);
    });

    it("should handle processing errors gracefully", async () => {
      // Mock context manager to throw error
      automationManager["contextManager"].getRelevantFiles = jest
        .fn()
        .mockRejectedValue(new Error("Context error"));

      const message = "Test message";
      const result = await automationManager.processMessage(message);

      expect(result).toBe(message); // Should fallback to original message
    });
  });

  describe("statistics and environment info", () => {
    beforeEach(async () => {
      mockDetectNeoRsEnvironment.mockReturnValue(true);
      mockDetectGitBranch.mockReturnValue("neo-rs");
      mockIsNeoRsBranch.mockReturnValue(true);

      await automationManager.initialize();
    });

    it("should provide comprehensive statistics", () => {
      const stats = automationManager.getStatistics();

      expect(stats).toHaveProperty("errorRecoveryStats");
      expect(stats).toHaveProperty("contextFilesTracked");
      expect(stats).toHaveProperty("scriptsAvailable");
      expect(stats).toHaveProperty("activeWorkflows");
      expect(stats).toHaveProperty("environmentInfo");
      expect(stats).toHaveProperty("enhancedFeaturesEnabled");

      expect(stats.environmentInfo).toBeTruthy();
      expect(stats.environmentInfo?.isNeoRs).toBe(true);
      expect(stats.enhancedFeaturesEnabled.memory).toBe(true);
      expect(stats.enhancedFeaturesEnabled.agents).toBe(true);
      expect(stats.enhancedFeaturesEnabled.hooks).toBe(true);
    });

    it("should provide environment info", () => {
      const envInfo = automationManager.getEnvironmentInfo();

      expect(envInfo).toBeTruthy();
      expect(envInfo?.isNeoRs).toBe(true);
      expect(envInfo?.branch).toBe("neo-rs");
      expect(envInfo?.isNeoRsBranch).toBe(true);
      expect(envInfo?.detectedAt).toBeInstanceOf(Date);
    });

    it("should correctly identify Neo-rs environment", () => {
      expect(automationManager.isNeoRsEnvironment()).toBe(true);
    });
  });
});
