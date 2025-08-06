import * as vscode from "vscode";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { debugLog, errorLog, infoLog } from "../utils/logging";
import { getMemoryManager, MemoryManager } from "../memory";
import {
  getEnhancedConfig,
  EnhancedConfigManager,
} from "../config/enhanced-config";
import { AutoClaudeError, ErrorCategory, ErrorSeverity } from "../core/errors";

// Monitoring interfaces
export interface SystemMetrics {
  timestamp: Date;
  memory: MemoryMetrics;
  cpu: CpuMetrics;
  disk: DiskMetrics;
  network?: NetworkMetrics;
  autoClaudeMetrics: AutoClaudeMetrics;
}

export interface MemoryMetrics {
  totalMemory: number;
  freeMemory: number;
  usedMemory: number;
  usagePercentage: number;
  processMemory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

export interface CpuMetrics {
  loadAverage: number[];
  usage: number;
  cores: number;
  model: string;
  speed: number;
}

export interface DiskMetrics {
  workspaceSize: number;
  availableSpace: number;
  totalSpace: number;
  usagePercentage: number;
}

export interface NetworkMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
}

export interface AutoClaudeMetrics {
  activeAgents: number;
  queueLength: number;
  completedTasks: number;
  memoryDBSize: number;
  hookExecutions: number;
  errorCount: number;
  uptime: number;
  sessionsActive: number;
}

export interface MonitoringAlert {
  id: string;
  type: "warning" | "error" | "info";
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  metrics?: Partial<SystemMetrics>;
  thresholds?: Record<string, number>;
}

export interface MonitoringConfig {
  enabled: boolean;
  interval: number;
  retentionDays: number;
  alerts: {
    memoryThreshold: number;
    cpuThreshold: number;
    diskThreshold: number;
    errorRateThreshold: number;
  };
  logFile: string;
  enableWebview: boolean;
}

// Main monitoring class
export class SystemMonitor {
  private config: MonitoringConfig;
  private memory: MemoryManager;
  private enhancedConfig: EnhancedConfigManager;
  private intervalId: NodeJS.Timeout | null = null;
  private metrics: SystemMetrics[] = [];
  private alerts: MonitoringAlert[] = [];
  private startTime: Date = new Date();
  private initialized = false;
  private isMonitoring = false;
  private metricsInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private workspacePath: string) {
    this.memory = getMemoryManager(workspacePath);
    this.enhancedConfig = getEnhancedConfig(workspacePath);
    this.config = this.getDefaultConfig();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.memory.initialize();
      await this.enhancedConfig.initialize();

      // Load configuration
      const config = this.enhancedConfig.getConfig();
      if (config.performance.enableMetrics) {
        this.config.enabled = true;
        this.config.interval = config.performance.metricsInterval || 60000;
      }

      this.initialized = true;
      debugLog("System monitor initialized");

      if (this.config.enabled) {
        this.startMonitoring();
      }
    } catch (error) {
      throw new AutoClaudeError(
        "MONITOR_INIT_FAILED",
        `Failed to initialize system monitor: ${error}`,
        ErrorCategory.INTERNAL,
        ErrorSeverity.HIGH,
        { error },
        true,
        "System monitoring initialization failed",
        ["Check memory system", "Verify configuration", "Restart VS Code"],
      );
    }
  }

  private getDefaultConfig(): MonitoringConfig {
    return {
      enabled: false,
      interval: 60000, // 1 minute
      retentionDays: 7,
      alerts: {
        memoryThreshold: 80, // 80%
        cpuThreshold: 90, // 90%
        diskThreshold: 85, // 85%
        errorRateThreshold: 10, // 10 errors per minute
      },
      logFile: path.join(this.workspacePath, ".autoclaude", "monitoring.log"),
      enableWebview: true,
    };
  }

  private async collectMetrics(): Promise<void> {
    const timestamp = new Date();

    try {
      // Collect system metrics
      const memoryMetrics = this.collectMemoryMetrics();
      const cpuMetrics = this.collectCpuMetrics();
      const diskMetrics = await this.collectDiskMetrics();
      const autoClaudeMetrics = await this.collectAutoClaudeMetrics();

      const metrics: SystemMetrics = {
        timestamp,
        memory: memoryMetrics,
        cpu: cpuMetrics,
        disk: diskMetrics,
        autoClaudeMetrics,
      };

      // Store metrics
      this.metrics.push(metrics);

      // Keep only metrics within retention period
      const cutoff = new Date(
        Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000,
      );
      this.metrics = this.metrics.filter((m) => m.timestamp > cutoff);

      // Check for alerts
      await this.checkAlerts(metrics);

      // Log metrics if verbose logging is enabled
      debugLog("Metrics collected", {
        memory: `${memoryMetrics.usagePercentage.toFixed(1)}%`,
        cpu: `${cpuMetrics.usage.toFixed(1)}%`,
        disk: `${diskMetrics.usagePercentage.toFixed(1)}%`,
        agents: autoClaudeMetrics.activeAgents,
        queue: autoClaudeMetrics.queueLength,
      });
    } catch (error) {
      errorLog("Failed to collect system metrics", { error });
    }
  }

  private collectMemoryMetrics(): MemoryMetrics {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usagePercentage = (usedMemory / totalMemory) * 100;
    const processMemory = process.memoryUsage();

    return {
      totalMemory,
      freeMemory,
      usedMemory,
      usagePercentage,
      processMemory,
    };
  }

  private collectCpuMetrics(): CpuMetrics {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();

    // Simple CPU usage estimation based on load average
    const usage = Math.min((loadAverage[0] / cpus.length) * 100, 100);

    return {
      loadAverage,
      usage,
      cores: cpus.length,
      model: cpus[0]?.model || "Unknown",
      speed: cpus[0]?.speed || 0,
    };
  }

  private async collectDiskMetrics(): Promise<DiskMetrics> {
    try {
      const stats = fs.statSync(this.workspacePath);
      const workspaceSize = await this.getDirectorySize(this.workspacePath);

      // Get disk space information (simplified)
      const totalSpace = 1000 * 1024 * 1024 * 1024; // 1TB default
      const availableSpace = 500 * 1024 * 1024 * 1024; // 500GB default
      const usagePercentage =
        ((totalSpace - availableSpace) / totalSpace) * 100;

      return {
        workspaceSize,
        availableSpace,
        totalSpace,
        usagePercentage,
      };
    } catch (error) {
      return {
        workspaceSize: 0,
        availableSpace: 0,
        totalSpace: 0,
        usagePercentage: 0,
      };
    }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      let totalSize = 0;
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          // Skip common directories that don't need to be measured
          if (
            ["node_modules", ".git", "target", "build", "dist"].includes(item)
          ) {
            continue;
          }
          totalSize += await this.getDirectorySize(itemPath);
        } else {
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  private async collectAutoClaudeMetrics(): Promise<AutoClaudeMetrics> {
    try {
      // Get metrics from various AutoClaude systems
      const agentCoordinator = (global as any).agentCoordinator;
      let activeAgents = 0;
      let queueLength = 0;
      let completedTasks = 0;

      if (agentCoordinator) {
        const agentStatus = await agentCoordinator.getAgentStatus();
        const queueStatus = await agentCoordinator.getQueueStatus();

        activeAgents = agentStatus.filter(
          (a: any) => a.status === "busy",
        ).length;
        queueLength = queueStatus.queueLength;
        completedTasks = queueStatus.completedTasks;
      }

      // Get memory database size
      let memoryDBSize = 0;
      try {
        const performanceStats = await this.memory.getPerformanceStats();
        memoryDBSize = performanceStats.databaseSize;
      } catch (error) {
        // Memory system might not be initialized
      }

      // Get hook execution count
      const hookManager = (global as any).hookManager;
      let hookExecutions = 0;
      if (hookManager) {
        const hookStats = await hookManager.getHookStats();
        hookExecutions = hookStats.recentExecutions;
      }

      const uptime = Date.now() - this.startTime.getTime();
      const sessionsActive = 1; // Simplified for now

      return {
        activeAgents,
        queueLength,
        completedTasks,
        memoryDBSize,
        hookExecutions,
        errorCount: this.getRecentErrorCount(),
        uptime,
        sessionsActive,
      };
    } catch (error) {
      debugLog("Failed to collect AutoClaude metrics", { error });
      return {
        activeAgents: 0,
        queueLength: 0,
        completedTasks: 0,
        memoryDBSize: 0,
        hookExecutions: 0,
        errorCount: 0,
        uptime: Date.now() - this.startTime.getTime(),
        sessionsActive: 0,
      };
    }
  }

  private getRecentErrorCount(): number {
    // Get error count from the last minute
    const oneMinuteAgo = new Date(Date.now() - 60000);
    return this.alerts.filter(
      (alert) => alert.type === "error" && alert.timestamp > oneMinuteAgo,
    ).length;
  }

  private async checkAlerts(metrics: SystemMetrics): Promise<void> {
    const alerts: MonitoringAlert[] = [];

    // Memory usage alert
    if (metrics.memory.usagePercentage > this.config.alerts.memoryThreshold) {
      alerts.push({
        id: `memory-${Date.now()}`,
        type: "warning",
        title: "High Memory Usage",
        message: `System memory usage is ${metrics.memory.usagePercentage.toFixed(1)}% (threshold: ${this.config.alerts.memoryThreshold}%)`,
        timestamp: metrics.timestamp,
        acknowledged: false,
        metrics,
        thresholds: this.config.alerts,
      });
    }

    // CPU usage alert
    if (metrics.cpu.usage > this.config.alerts.cpuThreshold) {
      alerts.push({
        id: `cpu-${Date.now()}`,
        type: "warning",
        title: "High CPU Usage",
        message: `CPU usage is ${metrics.cpu.usage.toFixed(1)}% (threshold: ${this.config.alerts.cpuThreshold}%)`,
        timestamp: metrics.timestamp,
        acknowledged: false,
        metrics,
        thresholds: this.config.alerts,
      });
    }

    // Disk usage alert
    if (metrics.disk.usagePercentage > this.config.alerts.diskThreshold) {
      alerts.push({
        id: `disk-${Date.now()}`,
        type: "warning",
        title: "High Disk Usage",
        message: `Disk usage is ${metrics.disk.usagePercentage.toFixed(1)}% (threshold: ${this.config.alerts.diskThreshold}%)`,
        timestamp: metrics.timestamp,
        acknowledged: false,
        metrics,
        thresholds: this.config.alerts,
      });
    }

    // Error rate alert
    if (
      metrics.autoClaudeMetrics.errorCount >
      this.config.alerts.errorRateThreshold
    ) {
      alerts.push({
        id: `errors-${Date.now()}`,
        type: "error",
        title: "High Error Rate",
        message: `Error rate is ${metrics.autoClaudeMetrics.errorCount} errors/minute (threshold: ${this.config.alerts.errorRateThreshold})`,
        timestamp: metrics.timestamp,
        acknowledged: false,
        metrics,
        thresholds: this.config.alerts,
      });
    }

    // Process new alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  private async processAlert(alert: MonitoringAlert): Promise<void> {
    this.alerts.push(alert);

    // Log alert
    const logLevel = alert.type === "error" ? "error" : "warn";
    const logMessage = `${alert.title}: ${alert.message}`;

    if (logLevel === "error") {
      errorLog(logMessage, { alert });
    } else {
      debugLog(logMessage, { alert });
    }

    // Show VS Code notification for critical alerts
    if (alert.type === "error") {
      vscode.window
        .showErrorMessage(
          `AutoClaude Alert: ${alert.title}`,
          "View Details",
          "Acknowledge",
        )
        .then((choice) => {
          if (choice === "View Details") {
            this.showMonitoringDashboard();
          } else if (choice === "Acknowledge") {
            this.acknowledgeAlert(alert.id);
          }
        });
    }

    // Log to file if enabled
    await this.logAlertToFile(alert);
  }

  private async logAlertToFile(alert: MonitoringAlert): Promise<void> {
    try {
      const logDir = path.dirname(this.config.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logLine =
        JSON.stringify({
          timestamp: alert.timestamp.toISOString(),
          type: alert.type,
          title: alert.title,
          message: alert.message,
          acknowledged: alert.acknowledged,
        }) + "\n";

      fs.appendFileSync(this.config.logFile, logLine);
    } catch (error) {
      debugLog("Failed to log alert to file", { error });
    }
  }

  // Public API methods
  getCurrentMetrics(): SystemMetrics | null {
    return this.metrics.length > 0
      ? this.metrics[this.metrics.length - 1]
      : null;
  }

  getMetricsHistory(hours: number = 24): SystemMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter((m) => m.timestamp > cutoff);
  }

  getActiveAlerts(): MonitoringAlert[] {
    return this.alerts.filter((a) => !a.acknowledged);
  }

  getAllAlerts(): MonitoringAlert[] {
    return [...this.alerts];
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      infoLog("Alert acknowledged", { alertId, title: alert.title });
    }
  }

  clearOldAlerts(days: number = 7): void {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter((a) => a.timestamp > cutoff);
  }

  async exportMetrics(filePath: string): Promise<void> {
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        config: this.config,
        metrics: this.metrics,
        alerts: this.alerts,
        summary: this.generateSummary(),
      };

      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
      infoLog("Metrics exported", { filePath });
    } catch (error) {
      throw new AutoClaudeError(
        "EXPORT_FAILED",
        `Failed to export metrics: ${error}`,
        ErrorCategory.INTERNAL,
        ErrorSeverity.MEDIUM,
        { filePath, error },
      );
    }
  }

  private generateSummary(): any {
    if (this.metrics.length === 0) {
      return { message: "No metrics available" };
    }

    const latest = this.metrics[this.metrics.length - 1];
    const activeAlerts = this.getActiveAlerts().length;
    const totalAlerts = this.alerts.length;

    return {
      period: {
        start: this.metrics[0].timestamp,
        end: latest.timestamp,
        dataPoints: this.metrics.length,
      },
      current: {
        memory: `${latest.memory.usagePercentage.toFixed(1)}%`,
        cpu: `${latest.cpu.usage.toFixed(1)}%`,
        disk: `${latest.disk.usagePercentage.toFixed(1)}%`,
        activeAgents: latest.autoClaudeMetrics.activeAgents,
        queueLength: latest.autoClaudeMetrics.queueLength,
      },
      alerts: {
        active: activeAlerts,
        total: totalAlerts,
        types: {
          error: this.alerts.filter((a) => a.type === "error").length,
          warning: this.alerts.filter((a) => a.type === "warning").length,
          info: this.alerts.filter((a) => a.type === "info").length,
        },
      },
      uptime: latest.autoClaudeMetrics.uptime,
    };
  }

  async showMonitoringDashboard(): Promise<void> {
    const summary = this.generateSummary();
    const activeAlerts = this.getActiveAlerts();
    const currentMetrics = this.getCurrentMetrics();

    const dashboardContent = [
      "# AutoClaude System Monitor Dashboard",
      "",
      "## Current Status",
      `- **Monitoring**: ${this.config.enabled ? "🟢 Active" : "🔴 Inactive"}`,
      `- **Uptime**: ${this.formatUptime(summary.uptime)}`,
      `- **Active Alerts**: ${activeAlerts.length}`,
      "",
      "## System Metrics",
    ];

    if (currentMetrics) {
      dashboardContent.push(
        `- **Memory Usage**: ${currentMetrics.memory.usagePercentage.toFixed(1)}% (${this.formatBytes(currentMetrics.memory.usedMemory)} / ${this.formatBytes(currentMetrics.memory.totalMemory)})`,
        `- **CPU Usage**: ${currentMetrics.cpu.usage.toFixed(1)}% (${currentMetrics.cpu.cores} cores)`,
        `- **Disk Usage**: ${currentMetrics.disk.usagePercentage.toFixed(1)}%`,
        `- **Process Memory**: ${this.formatBytes(currentMetrics.memory.processMemory.rss)}`,
      );
    }

    dashboardContent.push("", "## AutoClaude Metrics");

    if (currentMetrics) {
      dashboardContent.push(
        `- **Active Agents**: ${currentMetrics.autoClaudeMetrics.activeAgents}`,
        `- **Queue Length**: ${currentMetrics.autoClaudeMetrics.queueLength}`,
        `- **Completed Tasks**: ${currentMetrics.autoClaudeMetrics.completedTasks}`,
        `- **Memory DB Size**: ${this.formatBytes(currentMetrics.autoClaudeMetrics.memoryDBSize)}`,
        `- **Hook Executions**: ${currentMetrics.autoClaudeMetrics.hookExecutions}`,
        `- **Recent Errors**: ${currentMetrics.autoClaudeMetrics.errorCount}`,
      );
    }

    if (activeAlerts.length > 0) {
      dashboardContent.push("", "## Active Alerts");

      activeAlerts.forEach((alert) => {
        const icon =
          alert.type === "error"
            ? "🔴"
            : alert.type === "warning"
              ? "🟡"
              : "🔵";
        dashboardContent.push(
          `- ${icon} **${alert.title}**: ${alert.message} (${alert.timestamp.toLocaleString()})`,
        );
      });
    }

    const doc = await vscode.workspace.openTextDocument({
      content: dashboardContent.join("\n"),
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc);
  }

  private formatBytes(bytes: number): string {
    const sizes = ["B", "KB", "MB", "GB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      debugLog("System monitoring already started");
      return;
    }

    const config = this.enhancedConfig.getConfig();

    if (!config.performance?.enableMetrics) {
      debugLog("System monitoring disabled in configuration");
      return;
    }

    this.isMonitoring = true;
    this.startTime = new Date();

    const interval = config.performance.metricsInterval || 5000;

    // Start metrics collection
    this.metricsInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        if (this.metrics.length > 0) {
          await this.checkAlerts(this.metrics[this.metrics.length - 1]);
        }
      } catch (error) {
        debugLog(`Metrics collection error: ${error}`);
      }
    }, interval);

    // Start cleanup routine
    this.cleanupInterval = setInterval(
      () => {
        this.performCleanup();
      },
      5 * 60 * 1000,
    ); // Every 5 minutes

    debugLog(`System monitoring started with ${interval}ms interval`);
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    debugLog("System monitoring stopped");
  }

  private performCleanup(): void {
    // Clean up old metrics (keep last 1000 entries)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Clean up old alerts (keep last 24 hours)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter((alert) => alert.timestamp > cutoffTime);

    debugLog(
      `Cleanup completed: ${this.metrics.length} metrics, ${this.alerts.length} alerts retained`,
    );
  }

  dispose(): void {
    this.stopMonitoring();
    this.clearOldAlerts(0); // Clear all alerts
    this.metrics.length = 0;
    debugLog("System monitor disposed");
  }
}

// Singleton instance
let monitorInstance: SystemMonitor | null = null;

export function getSystemMonitor(workspacePath: string): SystemMonitor {
  if (!monitorInstance) {
    monitorInstance = new SystemMonitor(workspacePath);
  }
  return monitorInstance;
}

export function resetSystemMonitor(): void {
  if (monitorInstance) {
    monitorInstance.dispose();
    monitorInstance = null;
  }
}
