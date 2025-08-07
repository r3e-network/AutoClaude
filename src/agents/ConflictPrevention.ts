/**
 * Conflict Prevention and Collaboration System for AutoClaude Agents
 * Ensures multiple agents work together without conflicts
 */

import { debugLog } from "../utils/logging";

export interface ResourceLock {
  resourceId: string;
  agentId: string;
  lockType: "exclusive" | "shared";
  acquiredAt: Date;
  expiresAt: Date;
  taskId: string;
}

export interface TaskDependency {
  taskId: string;
  dependsOn: string[];
  blockedBy: string[];
  canRunInParallel: boolean;
}

export interface CollaborationRule {
  agentTypes: string[];
  collaborationType: "sequential" | "parallel" | "pipeline";
  sharedResources: string[];
  communicationChannel?: string;
}

export class ConflictPreventionManager {
  private resourceLocks: Map<string, ResourceLock[]> = new Map();
  private taskDependencies: Map<string, TaskDependency> = new Map();
  private collaborationRules: CollaborationRule[] = [];
  private deadlockDetector: DeadlockDetector;
  
  constructor() {
    this.deadlockDetector = new DeadlockDetector();
    this.initializeDefaultRules();
  }

  /**
   * Initialize default collaboration rules
   */
  private initializeDefaultRules(): void {
    // File modification rules
    this.collaborationRules.push({
      agentTypes: ["converter", "validator"],
      collaborationType: "sequential",
      sharedResources: ["source-files"],
      communicationChannel: "conversion-pipeline"
    });

    // Testing and optimization can run in parallel
    this.collaborationRules.push({
      agentTypes: ["validator", "optimizer"],
      collaborationType: "parallel",
      sharedResources: ["read-only-files"],
      communicationChannel: "quality-assurance"
    });

    // Documentation should run after code changes
    this.collaborationRules.push({
      agentTypes: ["converter", "documenter"],
      collaborationType: "pipeline",
      sharedResources: ["documentation-files"],
      communicationChannel: "doc-generation"
    });
  }

  /**
   * Acquire a lock on a resource
   */
  async acquireResourceLock(
    resourceId: string,
    agentId: string,
    taskId: string,
    lockType: "exclusive" | "shared" = "exclusive",
    timeoutMs: number = 30000
  ): Promise<boolean> {
    const existingLocks = this.resourceLocks.get(resourceId) || [];
    
    // Check for conflicts
    if (lockType === "exclusive") {
      if (existingLocks.length > 0) {
        // Check if any locks are still valid
        const activeLocks = this.cleanExpiredLocks(existingLocks);
        if (activeLocks.length > 0) {
          debugLog(`Resource ${resourceId} is locked by ${activeLocks[0].agentId}`);
          return false;
        }
      }
    } else {
      // Shared lock - check for exclusive locks
      const exclusiveLocks = existingLocks.filter(l => l.lockType === "exclusive");
      const activeExclusive = this.cleanExpiredLocks(exclusiveLocks);
      if (activeExclusive.length > 0) {
        debugLog(`Resource ${resourceId} has exclusive lock by ${activeExclusive[0].agentId}`);
        return false;
      }
    }

    // Create new lock
    const lock: ResourceLock = {
      resourceId,
      agentId,
      lockType,
      taskId,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + timeoutMs)
    };

    existingLocks.push(lock);
    this.resourceLocks.set(resourceId, existingLocks);
    
    debugLog(`Lock acquired: ${agentId} -> ${resourceId} (${lockType})`);
    return true;
  }

  /**
   * Release a lock on a resource
   */
  releaseResourceLock(resourceId: string, agentId: string): void {
    const locks = this.resourceLocks.get(resourceId) || [];
    const filteredLocks = locks.filter(l => l.agentId !== agentId);
    
    if (filteredLocks.length > 0) {
      this.resourceLocks.set(resourceId, filteredLocks);
    } else {
      this.resourceLocks.delete(resourceId);
    }
    
    debugLog(`Lock released: ${agentId} -> ${resourceId}`);
  }

  /**
   * Clean up expired locks
   */
  private cleanExpiredLocks(locks: ResourceLock[]): ResourceLock[] {
    const now = new Date();
    return locks.filter(lock => lock.expiresAt > now);
  }

  /**
   * Check if tasks can run in parallel
   */
  canRunInParallel(taskId1: string, taskId2: string): boolean {
    const dep1 = this.taskDependencies.get(taskId1);
    const dep2 = this.taskDependencies.get(taskId2);

    if (!dep1 || !dep2) return true;

    // Check if either task depends on the other
    if (dep1.dependsOn.includes(taskId2) || dep2.dependsOn.includes(taskId1)) {
      return false;
    }

    // Check if they're blocked by each other
    if (dep1.blockedBy.includes(taskId2) || dep2.blockedBy.includes(taskId1)) {
      return false;
    }

    return dep1.canRunInParallel && dep2.canRunInParallel;
  }

  /**
   * Register task dependencies
   */
  registerTaskDependency(
    taskId: string,
    dependsOn: string[] = [],
    canRunInParallel: boolean = true
  ): void {
    const dependency: TaskDependency = {
      taskId,
      dependsOn,
      blockedBy: [],
      canRunInParallel
    };

    // Update blocked tasks
    for (const depId of dependsOn) {
      const dep = this.taskDependencies.get(depId);
      if (dep) {
        dep.blockedBy.push(taskId);
      }
    }

    this.taskDependencies.set(taskId, dependency);
  }

  /**
   * Get collaboration strategy for agent types
   */
  getCollaborationStrategy(agentTypes: string[]): CollaborationRule | null {
    for (const rule of this.collaborationRules) {
      const matchingTypes = rule.agentTypes.filter(t => agentTypes.includes(t));
      if (matchingTypes.length >= 2) {
        return rule;
      }
    }
    return null;
  }

  /**
   * Check for potential deadlocks
   */
  detectDeadlocks(): boolean {
    return this.deadlockDetector.hasDeadlock(this.resourceLocks, this.taskDependencies);
  }

  /**
   * Resolve detected deadlocks
   */
  resolveDeadlock(agentIds: string[]): void {
    debugLog(`Resolving deadlock for agents: ${agentIds.join(", ")}`);
    
    // Release locks for the lowest priority agent
    const lowestPriorityAgent = agentIds[0]; // In real implementation, determine by priority
    
    for (const [resourceId, locks] of this.resourceLocks.entries()) {
      const agentLocks = locks.filter(l => l.agentId === lowestPriorityAgent);
      if (agentLocks.length > 0) {
        this.releaseResourceLock(resourceId, lowestPriorityAgent);
      }
    }
  }

  /**
   * Get resource availability status
   */
  getResourceStatus(resourceId: string): {
    available: boolean;
    lockedBy: string[];
    lockTypes: string[];
  } {
    const locks = this.cleanExpiredLocks(this.resourceLocks.get(resourceId) || []);
    
    return {
      available: locks.length === 0,
      lockedBy: locks.map(l => l.agentId),
      lockTypes: locks.map(l => l.lockType)
    };
  }

  /**
   * Clear all locks for an agent (used when agent fails or stops)
   */
  clearAgentLocks(agentId: string): void {
    for (const [resourceId, locks] of this.resourceLocks.entries()) {
      const filteredLocks = locks.filter(l => l.agentId !== agentId);
      if (filteredLocks.length > 0) {
        this.resourceLocks.set(resourceId, filteredLocks);
      } else {
        this.resourceLocks.delete(resourceId);
      }
    }
    debugLog(`Cleared all locks for agent ${agentId}`);
  }
}

/**
 * Deadlock detection helper
 */
class DeadlockDetector {
  hasDeadlock(
    resourceLocks: Map<string, ResourceLock[]>,
    taskDependencies: Map<string, TaskDependency>
  ): boolean {
    // Build wait-for graph
    const waitForGraph = new Map<string, Set<string>>();
    
    // Add edges based on resource locks
    for (const [resourceId, locks] of resourceLocks.entries()) {
      const activeLocks = locks.filter(l => l.expiresAt > new Date());
      
      for (let i = 0; i < activeLocks.length; i++) {
        for (let j = i + 1; j < activeLocks.length; j++) {
          const agent1 = activeLocks[i].agentId;
          const agent2 = activeLocks[j].agentId;
          
          if (!waitForGraph.has(agent1)) {
            waitForGraph.set(agent1, new Set());
          }
          waitForGraph.get(agent1)!.add(agent2);
        }
      }
    }
    
    // Add edges based on task dependencies
    for (const [taskId, dep] of taskDependencies.entries()) {
      for (const dependsOnId of dep.dependsOn) {
        // Find agents assigned to these tasks
        // This would need task-to-agent mapping in real implementation
      }
    }
    
    // Detect cycles using DFS
    return this.hasCycle(waitForGraph);
  }
  
  private hasCycle(graph: Map<string, Set<string>>): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    for (const node of graph.keys()) {
      if (this.hasCycleDFS(node, graph, visited, recursionStack)) {
        return true;
      }
    }
    
    return false;
  }
  
  private hasCycleDFS(
    node: string,
    graph: Map<string, Set<string>>,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    visited.add(node);
    recursionStack.add(node);
    
    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (this.hasCycleDFS(neighbor, graph, visited, recursionStack)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }
    
    recursionStack.delete(node);
    return false;
  }
}

/**
 * Agent Communication Channel for collaboration
 */
export class AgentCommunicationChannel {
  private messages: Map<string, any[]> = new Map();
  private subscribers: Map<string, Set<string>> = new Map();
  
  /**
   * Subscribe agent to a channel
   */
  subscribe(channelId: string, agentId: string): void {
    if (!this.subscribers.has(channelId)) {
      this.subscribers.set(channelId, new Set());
    }
    this.subscribers.get(channelId)!.add(agentId);
  }
  
  /**
   * Publish message to channel
   */
  publish(channelId: string, agentId: string, message: any): void {
    if (!this.messages.has(channelId)) {
      this.messages.set(channelId, []);
    }
    
    const msgWithMetadata = {
      from: agentId,
      timestamp: new Date(),
      content: message
    };
    
    this.messages.get(channelId)!.push(msgWithMetadata);
    debugLog(`Message published to ${channelId} by ${agentId}`);
  }
  
  /**
   * Get messages for an agent from a channel
   */
  getMessages(channelId: string, agentId: string, since?: Date): any[] {
    const channelMessages = this.messages.get(channelId) || [];
    
    if (!this.subscribers.get(channelId)?.has(agentId)) {
      return [];
    }
    
    if (since) {
      return channelMessages.filter(m => m.timestamp > since);
    }
    
    return channelMessages;
  }
  
  /**
   * Clear old messages
   */
  clearOldMessages(olderThan: Date): void {
    for (const [channelId, msgs] of this.messages.entries()) {
      const filtered = msgs.filter(m => m.timestamp > olderThan);
      this.messages.set(channelId, filtered);
    }
  }
}

// Export singleton instance
export const conflictManager = new ConflictPreventionManager();
export const communicationChannel = new AgentCommunicationChannel();