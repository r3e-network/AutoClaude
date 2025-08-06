import { debugLog } from "../utils/logging";
import * as vscode from "vscode";
import { ConfigValue, LoggerArgs } from '../types/recovery';

/**
 * Configuration adapter for the recovery manager
 */
export class RecoveryConfig {
  get(key: string, defaultValue?: ConfigValue): ConfigValue {
    const config = vscode.workspace.getConfiguration("autoclaude");

    // Map terminal config keys to VS Code settings
    switch (key) {
      case "session":
        return {
          skipPermissions: config.get("session.skipPermissions", true),
          autoStart: config.get("session.autoStart", false),
        };
      case "paths":
        return {
          dataDir: "",
          logsDir: "",
        };
      default:
        return defaultValue;
    }
  }

  set(key: string, value: ConfigValue): void {
    // Not implemented for VS Code extension
  }
}

/**
 * Logger adapter for the recovery manager
 */
export class RecoveryLogger {
  info(message: string, ...args: LoggerArgs): void {
    debugLog(`[Recovery] ${message}`, ...args);
  }

  warn(message: string, ...args: LoggerArgs): void {
    console.warn(`[Recovery] ${message}`, ...args);
  }

  error(message: string, ...args: LoggerArgs): void {
    console.error(`[Recovery] ${message}`, ...args);
  }

  debug(message: string, ...args: LoggerArgs): void {
    debugLog(`[Recovery Debug] ${message}`, ...args);
  }
}
