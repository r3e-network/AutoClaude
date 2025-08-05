import * as vscode from 'vscode';
import { LogLevel, LogEntry } from './logging';

/**
 * Production-ready logger that replaces console.log statements
 * Provides structured logging with proper levels and output channels
 */
export class ProductionLogger {
    private static instance: ProductionLogger;
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel = LogLevel.INFO;
    
    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('AutoClaude');
    }
    
    static getInstance(): ProductionLogger {
        if (!ProductionLogger.instance) {
            ProductionLogger.instance = new ProductionLogger();
        }
        return ProductionLogger.instance;
    }
    
    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }
    
    private shouldLog(level: LogLevel): boolean {
        return level <= this.logLevel;
    }
    
    private formatMessage(level: LogLevel, message: string, context?: any): string {
        const timestamp = new Date().toISOString();
        const levelStr = LogLevel[level];
        const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
        return `[${timestamp}] [${levelStr}] ${message}${contextStr}`;
    }
    
    error(message: string, error?: Error, context?: any): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            const errorDetails = error ? ` | ${error.message} | ${error.stack}` : '';
            const formattedMessage = this.formatMessage(LogLevel.ERROR, message + errorDetails, context);
            this.outputChannel.appendLine(formattedMessage);
            
            // In production, also report to telemetry if available
            if (error) {
                vscode.window.showErrorMessage(`AutoClaude Error: ${message}`);
            }
        }
    }
    
    warn(message: string, context?: any): void {
        if (this.shouldLog(LogLevel.WARN)) {
            const formattedMessage = this.formatMessage(LogLevel.WARN, message, context);
            this.outputChannel.appendLine(formattedMessage);
        }
    }
    
    info(message: string, context?: any): void {
        if (this.shouldLog(LogLevel.INFO)) {
            const formattedMessage = this.formatMessage(LogLevel.INFO, message, context);
            this.outputChannel.appendLine(formattedMessage);
        }
    }
    
    debug(message: string, context?: any): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            const formattedMessage = this.formatMessage(LogLevel.DEBUG, message, context);
            this.outputChannel.appendLine(formattedMessage);
        }
    }
    
    trace(message: string, context?: any): void {
        if (this.shouldLog(LogLevel.TRACE)) {
            const formattedMessage = this.formatMessage(LogLevel.TRACE, message, context);
            this.outputChannel.appendLine(formattedMessage);
        }
    }
    
    show(): void {
        this.outputChannel.show();
    }
    
    dispose(): void {
        this.outputChannel.dispose();
    }
}

// Export convenience functions
const logger = ProductionLogger.getInstance();

export const log = {
    error: (message: string, error?: Error, context?: any) => logger.error(message, error, context),
    warn: (message: string, context?: any) => logger.warn(message, context),
    info: (message: string, context?: any) => logger.info(message, context),
    debug: (message: string, context?: any) => logger.debug(message, context),
    trace: (message: string, context?: any) => logger.trace(message, context),
    setLevel: (level: LogLevel) => logger.setLogLevel(level),
    show: () => logger.show()
};

// Replace console methods in production
if (process.env.NODE_ENV === 'production') {
    console.log = (message: any, ...args: any[]) => logger.info(String(message), args);
    console.error = (message: any, ...args: any[]) => logger.error(String(message), undefined, args);
    console.warn = (message: any, ...args: any[]) => logger.warn(String(message), args);
    console.debug = (message: any, ...args: any[]) => logger.debug(String(message), args);
}