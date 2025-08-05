import * as vscode from 'vscode';
import * as path from 'path';
import { log } from '../utils/productionLogger';
import { QueenAgent } from '../agents/hivemind/QueenAgent';
import { AdvancedHookSystem } from '../hooks/AdvancedHookSystem';
import { SQLiteMemorySystem } from '../memory/SQLiteMemorySystem';
import { HiveMindTask, TaskPriority, SwarmConfiguration } from '../agents/hivemind/types';

/**
 * Automatic Workflow System - Orchestrates all AutoClaude components
 * Provides intelligent automation based on Claude Flow's approach
 */
export class AutomaticWorkflowSystem {
    private static instance: AutomaticWorkflowSystem;
    private queenAgent: QueenAgent;
    private hookSystem: AdvancedHookSystem;
    private memorySystem: SQLiteMemorySystem;
    private isActive = false;
    private currentSession: string | null = null;
    private config: SwarmConfiguration = {
        mode: 'swarm',
        maxAgents: 10,
        autoScale: true,
        loadBalancing: true,
        faultTolerance: true,
        memoryPersistence: true,
        learningEnabled: true
    };
    
    private constructor(private workspaceRoot: string) {
        this.queenAgent = new QueenAgent(workspaceRoot);
        this.hookSystem = AdvancedHookSystem.getInstance(workspaceRoot);
        this.memorySystem = new SQLiteMemorySystem(workspaceRoot);
    }
    
    static getInstance(workspaceRoot: string): AutomaticWorkflowSystem {
        if (!AutomaticWorkflowSystem.instance) {
            AutomaticWorkflowSystem.instance = new AutomaticWorkflowSystem(workspaceRoot);
        }
        return AutomaticWorkflowSystem.instance;
    }
    
    async initialize(): Promise<void> {
        log.info('Initializing Automatic Workflow System');
        
        try {
            // Initialize memory system
            await this.memorySystem.initialize();
            
            // Initialize Queen Agent
            await this.queenAgent.initialize();
            
            // Setup automatic behaviors
            await this.setupAutomaticBehaviors();
            
            // Load configuration
            await this.loadConfiguration();
            
            log.info('Automatic Workflow System initialized successfully');
        } catch (error) {
            log.error('Failed to initialize Automatic Workflow System', error as Error);
            throw error;
        }
    }
    
    async startSession(mode: 'swarm' | 'hive-mind' = 'swarm'): Promise<void> {
        if (this.isActive) {
            log.warn('Session already active');
            return;
        }
        
        this.config.mode = mode;
        this.isActive = true;
        
        // Create new session
        this.currentSession = await this.memorySystem.createSession(mode);
        
        // Execute session start hooks
        await this.hookSystem.executeSessionStartHooks({
            session: {
                id: this.currentSession,
                startedAt: Date.now(),
                mode,
                tasksCompleted: 0,
                agents: [],
                memory: {}
            }
        });
        
        // Start automatic monitoring
        this.startAutomaticMonitoring();
        
        log.info('Workflow session started', { sessionId: this.currentSession, mode });
        
        // Show welcome message
        vscode.window.showInformationMessage(
            `AutoClaude ${mode === 'hive-mind' ? 'Hive-Mind' : 'Swarm'} mode activated! 🚀`
        );
    }
    
    async processNaturalLanguageCommand(command: string): Promise<void> {
        log.info('Processing natural language command', { command });
        
        // Parse command into tasks
        const tasks = await this.parseCommand(command);
        
        // Queue tasks for processing
        for (const task of tasks) {
            await this.queueTask(task);
        }
        
        // Start processing if not already running
        if (!this.isProcessing) {
            this.startProcessing();
        }
    }
    
    private async parseCommand(command: string): Promise<HiveMindTask[]> {
        const tasks: HiveMindTask[] = [];
        const taskId = () => `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Intelligent command parsing
        const lowerCommand = command.toLowerCase();
        
        if (lowerCommand.includes('production ready')) {
            tasks.push(
                {
                    id: taskId(),
                    type: 'production-readiness',
                    priority: TaskPriority.HIGH,
                    status: 'pending',
                    description: 'Make project production ready',
                    createdAt: Date.now()
                }
            );
        }
        
        if (lowerCommand.includes('fix') && lowerCommand.includes('test')) {
            tasks.push({
                id: taskId(),
                type: 'fix-tests',
                priority: TaskPriority.HIGH,
                status: 'pending',
                description: 'Fix all failing tests',
                requiredCapabilities: ['testing', 'debugging'],
                createdAt: Date.now()
            });
        }
        
        if (lowerCommand.includes('create') && lowerCommand.includes('website')) {
            tasks.push({
                id: taskId(),
                type: 'create-website',
                priority: TaskPriority.MEDIUM,
                status: 'pending',
                description: 'Create a new website',
                requiredCapabilities: ['web-development', 'ui-design'],
                estimatedTime: 3600000, // 1 hour
                createdAt: Date.now()
            });
        }
        
        if (lowerCommand.includes('add') && lowerCommand.includes('documentation')) {
            tasks.push({
                id: taskId(),
                type: 'add-documentation',
                priority: TaskPriority.LOW,
                status: 'pending',
                description: 'Add comprehensive documentation',
                requiredCapabilities: ['documentation', 'technical-writing'],
                createdAt: Date.now()
            });
        }
        
        if (lowerCommand.includes('optimize') || lowerCommand.includes('performance')) {
            tasks.push({
                id: taskId(),
                type: 'optimize-performance',
                priority: TaskPriority.MEDIUM,
                status: 'pending',
                description: 'Optimize application performance',
                requiredCapabilities: ['performance-analysis', 'optimization'],
                createdAt: Date.now()
            });
        }
        
        if (lowerCommand.includes('security') || lowerCommand.includes('audit')) {
            tasks.push({
                id: taskId(),
                type: 'security-audit',
                priority: TaskPriority.HIGH,
                status: 'pending',
                description: 'Perform security audit',
                requiredCapabilities: ['security', 'vulnerability-analysis'],
                createdAt: Date.now()
            });
        }
        
        // If no specific tasks identified, create a generic task
        if (tasks.length === 0) {
            tasks.push({
                id: taskId(),
                type: 'generic',
                priority: TaskPriority.MEDIUM,
                status: 'pending',
                description: command,
                createdAt: Date.now()
            });
        }
        
        // Learn from command patterns
        await this.memorySystem.recordLearning('command-parsing', command, tasks, 0.8);
        
        return tasks;
    }
    
    private async queueTask(task: HiveMindTask): Promise<void> {
        // Execute pre-operation hooks
        await this.hookSystem.executePreOperationHooks({ task });
        
        // Check if we have a cached result
        const cachedResult = await this.memorySystem.searchCache(task.type, task.context);
        if (cachedResult && this.config.mode === 'swarm') {
            log.info('Using cached result for task', { taskId: task.id });
            task.result = cachedResult;
            task.status = 'completed';
            task.completedAt = Date.now();
            return;
        }
        
        // Record task
        await this.memorySystem.recordTask(task);
        
        // Add to processing queue
        this.taskQueue.push(task);
        
        log.info('Task queued', { taskId: task.id, type: task.type });
    }
    
    private taskQueue: HiveMindTask[] = [];
    private isProcessing = false;
    
    private async startProcessing(): Promise<void> {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        
        while (this.taskQueue.length > 0 && this.isActive) {
            const task = this.taskQueue.shift()!;
            
            try {
                // Update task status
                task.status = 'in_progress';
                task.startedAt = Date.now();
                
                // Execute task through Queen Agent
                const result = await this.queenAgent.execute(task);
                
                // Update task with result
                task.result = result;
                task.status = result.success ? 'completed' : 'failed';
                task.completedAt = Date.now();
                task.duration = task.completedAt - task.startedAt;
                
                // Record task completion
                await this.memorySystem.recordTask(task);
                
                // Cache successful results
                if (result.success) {
                    await this.memorySystem.cacheResult(
                        task.type,
                        task.context,
                        result,
                        3600000 // 1 hour TTL
                    );
                }
                
                // Execute post-operation hooks
                await this.hookSystem.executePostOperationHooks({ task, result });
                
                // Update session
                if (this.currentSession) {
                    const sessionData = {
                        tasksCompleted: result.success ? 1 : 0,
                        tasksFailed: result.success ? 0 : 1
                    };
                    await this.memorySystem.updateSession(this.currentSession, sessionData);
                }
                
                // Show notification
                if (result.success) {
                    vscode.window.showInformationMessage(`✅ Task completed: ${task.description}`);
                } else {
                    vscode.window.showWarningMessage(`❌ Task failed: ${task.description}`);
                }
                
            } catch (error) {
                log.error('Task processing failed', error as Error, { taskId: task.id });
                task.status = 'failed';
                task.result = {
                    success: false,
                    error: (error as Error).message
                };
            }
            
            // Record metrics
            await this.memorySystem.recordMetric('task_duration', task.duration || 0, {
                type: task.type,
                status: task.status
            });
        }
        
        this.isProcessing = false;
    }
    
    private async setupAutomaticBehaviors(): Promise<void> {
        // Watch for file changes
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        watcher.onDidCreate(async (uri) => {
            if (this.isActive && this.config.learningEnabled) {
                await this.handleFileCreated(uri);
            }
        });
        
        watcher.onDidChange(async (uri) => {
            if (this.isActive && this.config.learningEnabled) {
                await this.handleFileChanged(uri);
            }
        });
        
        // Watch for errors in problems panel
        vscode.languages.onDidChangeDiagnostics(async (event) => {
            if (this.isActive && this.config.mode === 'hive-mind') {
                await this.handleDiagnosticsChange(event);
            }
        });
        
        // Watch for terminal output
        vscode.window.onDidOpenTerminal(async (terminal) => {
            if (this.isActive) {
                await this.monitorTerminal(terminal);
            }
        });
    }
    
    private async handleFileCreated(uri: vscode.Uri): Promise<void> {
        // Learn from new file patterns
        const filePath = uri.fsPath;
        const fileType = path.extname(filePath);
        
        await this.memorySystem.recordLearning('file-creation', {
            path: filePath,
            type: fileType
        }, {
            timestamp: Date.now()
        }, 0.7);
        
        // Auto-format new files
        if (['.ts', '.js', '.tsx', '.jsx'].includes(fileType)) {
            await vscode.commands.executeCommand('editor.action.formatDocument', uri);
        }
    }
    
    private async handleFileChanged(uri: vscode.Uri): Promise<void> {
        // Track file change patterns
        await this.memorySystem.recordMetric('file_changes', 1, {
            file: uri.fsPath,
            timestamp: Date.now()
        });
    }
    
    private async handleDiagnosticsChange(event: vscode.DiagnosticChangeEvent): Promise<void> {
        for (const uri of event.uris) {
            const diagnostics = vscode.languages.getDiagnostics(uri);
            const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
            
            if (errors.length > 0) {
                // Automatically queue fix tasks for errors
                const task: HiveMindTask = {
                    id: `fix_${Date.now()}`,
                    type: 'fix-errors',
                    priority: TaskPriority.HIGH,
                    status: 'pending',
                    description: `Fix ${errors.length} errors in ${path.basename(uri.fsPath)}`,
                    context: {
                        file: uri.fsPath,
                        errors: errors.map(e => ({
                            message: e.message,
                            line: e.range.start.line,
                            column: e.range.start.character
                        }))
                    },
                    requiredCapabilities: ['debugging', 'error-fixing'],
                    createdAt: Date.now()
                };
                
                await this.queueTask(task);
            }
        }
    }
    
    private async monitorTerminal(terminal: vscode.Terminal): Promise<void> {
        // Monitor terminal for patterns like test failures
        // This is a simplified implementation
        log.info('Monitoring terminal', { name: terminal.name });
    }
    
    private startAutomaticMonitoring(): void {
        // Monitor system health
        setInterval(async () => {
            if (!this.isActive) return;
            
            // Record system metrics
            const memoryUsage = process.memoryUsage();
            await this.memorySystem.recordMetric('memory_usage', memoryUsage.heapUsed, {
                total: memoryUsage.heapTotal
            });
            
            // Check task queue health
            if (this.taskQueue.length > 50) {
                log.warn('Task queue is getting large', { queueSize: this.taskQueue.length });
                
                // Auto-scale if enabled
                if (this.config.autoScale) {
                    await this.scaleAgents();
                }
            }
        }, 30000); // Every 30 seconds
    }
    
    private async scaleAgents(): Promise<void> {
        // Intelligent agent scaling based on workload
        const currentLoad = this.taskQueue.length;
        const targetAgents = Math.min(
            Math.ceil(currentLoad / 10),
            this.config.maxAgents
        );
        
        log.info('Auto-scaling agents', { currentLoad, targetAgents });
        
        // Implementation would scale agents through QueenAgent
    }
    
    private async loadConfiguration(): Promise<void> {
        const config = vscode.workspace.getConfiguration('autoclaude.workflow');
        
        this.config = {
            mode: config.get('mode') || 'swarm',
            maxAgents: config.get('maxAgents') || 10,
            autoScale: config.get('autoScale') ?? true,
            loadBalancing: config.get('loadBalancing') ?? true,
            faultTolerance: config.get('faultTolerance') ?? true,
            memoryPersistence: config.get('memoryPersistence') ?? true,
            learningEnabled: config.get('learningEnabled') ?? true
        };
    }
    
    async stopSession(): Promise<void> {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // Execute session end hooks
        if (this.currentSession) {
            await this.hookSystem.executeSessionEndHooks({
                session: {
                    id: this.currentSession,
                    startedAt: 0, // Would be tracked properly
                    mode: this.config.mode,
                    tasksCompleted: 0, // Would be tracked
                    agents: [],
                    memory: {}
                }
            });
            
            // Update session as ended
            await this.memorySystem.updateSession(this.currentSession, { ended: true });
        }
        
        log.info('Workflow session stopped');
        vscode.window.showInformationMessage('AutoClaude session ended');
    }
    
    async getStatus(): Promise<any> {
        return {
            active: this.isActive,
            sessionId: this.currentSession,
            mode: this.config.mode,
            queueSize: this.taskQueue.length,
            isProcessing: this.isProcessing,
            config: this.config,
            hooks: this.hookSystem.getHookStatus()
        };
    }
    
    async shutdown(): Promise<void> {
        await this.stopSession();
        await this.queenAgent.shutdown();
        await this.memorySystem.close();
        
        log.info('Automatic Workflow System shut down');
    }
}