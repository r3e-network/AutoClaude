/**
 * Monitoring Module - Enhanced AutoClaude System Monitoring
 *
 * This module provides comprehensive system monitoring capabilities
 * including real-time metrics, alerting, and performance tracking.
 */

export { SystemMonitor } from "./SystemMonitor";

// Monitoring types and interfaces
export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  autoclaude: {
    activeAgents: number;
    queueSize: number;
    processingRate: number;
    errorRate: number;
    memoryUsage: number;
    conversionCount: number;
    patternCount: number;
  };
}

export interface AlertConfig {
  cpuThreshold: number;
  memoryThreshold: number;
  diskThreshold: number;
  errorRateThreshold: number;
  queueSizeThreshold: number;
  enabled: boolean;
  notificationDelay: number; // milliseconds
}

export interface Alert {
  id: string;
  type: "cpu" | "memory" | "disk" | "error_rate" | "queue_size" | "custom";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
}

export interface MonitoringStats {
  uptimeSeconds: number;
  totalAlerts: number;
  resolvedAlerts: number;
  averageCpuUsage: number;
  averageMemoryUsage: number;
  peakMemoryUsage: number;
  totalConversions: number;
  totalErrors: number;
  lastMetricCollection: Date;
}

// Default configuration
export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  cpuThreshold: 80,
  memoryThreshold: 85,
  diskThreshold: 90,
  errorRateThreshold: 10,
  queueSizeThreshold: 100,
  enabled: true,
  notificationDelay: 5000,
};

// Utility functions
export function calculateCpuUsage(): number {
  const cpus = require("os").cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu: any) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  return 100 - Math.round((100 * totalIdle) / totalTick);
}

export function calculateMemoryUsage(): {
  used: number;
  free: number;
  total: number;
  percentage: number;
} {
  const os = require("os");
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const percentage = Math.round((used / total) * 100);

  return {
    used: Math.round(used / 1024 / 1024), // MB
    free: Math.round(free / 1024 / 1024), // MB
    total: Math.round(total / 1024 / 1024), // MB
    percentage,
  };
}

export function calculateDiskUsage(path: string = process.cwd()): Promise<{
  used: number;
  free: number;
  total: number;
  percentage: number;
}> {
  return new Promise((resolve, reject) => {
    const fs = require("fs");

    fs.statvfs ||
      fs.stat(path, (err: any, stats: any) => {
        if (err) {
          reject(err);
          return;
        }

        // This is a simplified version - actual implementation would use statvfs
        resolve({
          used: 0,
          free: 1000000, // 1TB default
          total: 1000000,
          percentage: 0,
        });
      });
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export function createAlert(
  type: Alert["type"],
  severity: Alert["severity"],
  message: string,
  value: number,
  threshold: number,
): Alert {
  return {
    id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    severity,
    message,
    value,
    threshold,
    timestamp: new Date(),
    acknowledged: false,
    resolved: false,
  };
}

export function getSeverityColor(severity: Alert["severity"]): string {
  switch (severity) {
    case "low":
      return "🟢";
    case "medium":
      return "🟡";
    case "high":
      return "🟠";
    case "critical":
      return "🔴";
    default:
      return "⚪";
  }
}

export function getSeverityText(severity: Alert["severity"]): string {
  switch (severity) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "critical":
      return "Critical";
    default:
      return "Unknown";
  }
}

export function isAlertCritical(alert: Alert): boolean {
  return alert.severity === "critical" || alert.severity === "high";
}

export function shouldTriggerAlert(
  value: number,
  threshold: number,
  type: Alert["type"],
): boolean {
  switch (type) {
    case "cpu":
    case "memory":
    case "disk":
    case "error_rate":
    case "queue_size":
      return value >= threshold;
    default:
      return false;
  }
}

export function getAlertSeverity(
  value: number,
  threshold: number,
): Alert["severity"] {
  const ratio = value / threshold;

  if (ratio >= 1.5) {
    return "critical";
  } else if (ratio >= 1.2) {
    return "high";
  } else if (ratio >= 1.0) {
    return "medium";
  } else {
    return "low";
  }
}

// Monitoring constants
export const MONITORING_INTERVALS = {
  METRICS_COLLECTION: 5000, // 5 seconds
  ALERT_CHECK: 10000, // 10 seconds
  CLEANUP: 300000, // 5 minutes
  STATS_UPDATE: 60000, // 1 minute
} as const;

export const RETENTION_PERIODS = {
  METRICS: 24 * 60 * 60 * 1000, // 24 hours
  ALERTS: 7 * 24 * 60 * 60 * 1000, // 7 days
  LOGS: 30 * 24 * 60 * 60 * 1000, // 30 days
} as const;
