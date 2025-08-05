/**
 * Type definitions for the Hive-Mind AI coordination system
 */

export enum AgentRole {
    QUEEN = 'queen',
    ARCHITECT = 'architect',
    CODER = 'coder',
    TESTER = 'tester',
    RESEARCHER = 'researcher',
    SECURITY = 'security',
    DOCUMENTATION = 'documentation',
    OPTIMIZATION = 'optimization',
    REVIEWER = 'reviewer'
}

export enum TaskPriority {
    CRITICAL = 0,
    HIGH = 1,
    MEDIUM = 2,
    LOW = 3,
    BACKGROUND = 4
}

export enum TaskStatus {
    PENDING = 'pending',
    ASSIGNED = 'assigned',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

export interface HiveMindAgent {
    id: string;
    name: string;
    role: AgentRole;
    capabilities: string[];
    initialize(): Promise<void>;
    execute(task: HiveMindTask): Promise<HiveMindResult>;
    shutdown?(): Promise<void>;
}

export interface HiveMindTask {
    id: string;
    type: string;
    priority: TaskPriority;
    status: TaskStatus;
    description: string;
    context?: any;
    requiredCapabilities?: string[];
    dependencies?: string[];
    estimatedTime?: number;
    assignedAgent?: string;
    result?: HiveMindResult;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    duration?: number;
}

export interface HiveMindResult {
    success: boolean;
    data?: any;
    error?: string;
    logs?: string[];
    artifacts?: Artifact[];
    metrics?: TaskMetrics;
}

export interface Artifact {
    type: 'file' | 'code' | 'documentation' | 'test' | 'report';
    path?: string;
    content?: string;
    metadata?: Record<string, any>;
}

export interface TaskMetrics {
    duration: number;
    cpuUsage?: number;
    memoryUsage?: number;
    filesModified?: number;
    linesOfCode?: number;
    testsRun?: number;
    testsPassed?: number;
}

export interface AgentHealth {
    agentId: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
    lastHeartbeat: number;
    currentLoad: number;
    tasksCompleted: number;
    tasksFailed: number;
    averageTaskDuration: number;
    errors: string[];
}

export interface SwarmConfiguration {
    mode: 'swarm' | 'hive-mind';
    maxAgents: number;
    autoScale: boolean;
    loadBalancing: boolean;
    faultTolerance: boolean;
    memoryPersistence: boolean;
    learningEnabled: boolean;
}

export interface Pattern {
    id: string;
    type: string;
    frequency: number;
    successRate: number;
    averageDuration: number;
    lastUsed: number;
    metadata: Record<string, any>;
}

export interface HookConfiguration {
    preOperation: Hook[];
    postOperation: Hook[];
    sessionStart: Hook[];
    sessionEnd: Hook[];
}

export interface Hook {
    id: string;
    name: string;
    type: 'pre' | 'post' | 'session';
    enabled: boolean;
    execute(context: HookContext): Promise<void>;
}

export interface HookContext {
    task?: HiveMindTask;
    result?: HiveMindResult;
    agent?: HiveMindAgent;
    session?: SessionContext;
}

export interface SessionContext {
    id: string;
    startedAt: number;
    mode: 'swarm' | 'hive-mind';
    tasksCompleted: number;
    agents: string[];
    memory: Record<string, any>;
}