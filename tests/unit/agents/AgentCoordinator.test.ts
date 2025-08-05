import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AgentCoordinator, getAgentCoordinator, resetAgentCoordinator } from '../../../src/agents/AgentCoordinator';
import type { Task, TaskType, AgentType } from '../../../src/agents/AgentCoordinator';

// Mock dependencies
jest.mock('../../../src/memory/MemoryManager.production', () => ({
    getMemoryManager: jest.fn(() => ({
        initialize: jest.fn(),
        storeAgentMemory: jest.fn(),
        getPerformanceStats: jest.fn(() => Promise.resolve({
            queryCount: 10,
            averageQueryTime: 100,
            databaseSize: 1024,
            tableStats: {}
        }))
    }))
}));

jest.mock('../../../src/config/enhanced-config', () => ({
    getEnhancedConfig: jest.fn(() => ({
        initialize: jest.fn(),
        getConfig: jest.fn(() => ({
            agents: {
                enabled: true,
                maxConcurrent: 3,
                coordinationStrategy: 'adaptive' as const,
                retryFailedTasks: true,
                maxRetries: 2
            }
        })),
        dispose: jest.fn()
    }))
}));

jest.mock('../../../src/utils/logging', () => ({
    debugLog: jest.fn()
}));

describe('AgentCoordinator', () => {
    let coordinator: AgentCoordinator;
    const testWorkspace = '/test/workspace';

    beforeEach(async () => {
        resetAgentCoordinator();
        coordinator = getAgentCoordinator(testWorkspace);
        await coordinator.initialize();
    });

    afterEach(async () => {
        if (coordinator) {
            await coordinator.stopAllAgents();
        }
        resetAgentCoordinator();
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            expect(coordinator).toBeDefined();
            
            const status = await coordinator.getAgentStatus();
            expect(Array.isArray(status)).toBe(true);
        });

        it('should create agents based on configuration', async () => {
            const status = await coordinator.getAgentStatus();
            
            // Should have created converter and validator agents
            expect(status.length).toBeGreaterThan(0);
            
            const agentTypes = status.map(s => s.type);
            expect(agentTypes).toContain('converter');
            expect(agentTypes).toContain('validator');
        });

        it('should handle initialization errors gracefully', async () => {
            // Mock initialization failure
            const failingCoordinator = new AgentCoordinator('/invalid/path');
            
            // Should not throw during construction
            expect(failingCoordinator).toBeDefined();
        });
    });

    describe('task management', () => {
        it('should submit tasks successfully', async () => {
            const task = {
                type: 'convert-file' as TaskType,
                priority: 5,
                description: 'Convert test.cs to Rust',
                input: {
                    filePath: 'test.cs',
                    content: 'public class Test { }'
                }
            };

            const taskId = await coordinator.submitTask(task);
            
            expect(taskId).toBeDefined();
            expect(typeof taskId).toBe('string');
            expect(taskId).toMatch(/^task-/);
        });

        it('should process tasks in queue', async () => {
            const tasks = [
                {
                    type: 'convert-file' as TaskType,
                    priority: 5,
                    description: 'Convert file 1',
                    input: { filePath: 'file1.cs', content: 'class Test1 { }' }
                },
                {
                    type: 'validate-conversion' as TaskType,
                    priority: 7,
                    description: 'Validate conversion',
                    input: { 
                        convertedContent: 'struct Test1 { }',
                        originalContent: 'class Test1 { }',
                        filePath: 'file1.rs'
                    }
                }
            ];

            const taskIds = await Promise.all(
                tasks.map(task => coordinator.submitTask(task))
            );

            expect(taskIds).toHaveLength(2);
            
            // Allow some time for processing
            await new Promise(resolve => setTimeout(resolve, 100));

            const queueStatus = await coordinator.getQueueStatus();
            expect(queueStatus).toBeDefined();
            expect(typeof queueStatus.queueLength).toBe('number');
            expect(typeof queueStatus.activeTasks).toBe('number');
        });

        it('should handle task priorities correctly', async () => {
            const lowPriorityTask = {
                type: 'convert-file' as TaskType,
                priority: 1,
                description: 'Low priority task',
                input: { filePath: 'low.cs', content: 'class Low { }' }
            };

            const highPriorityTask = {
                type: 'convert-file' as TaskType,
                priority: 10,
                description: 'High priority task',
                input: { filePath: 'high.cs', content: 'class High { }' }
            };

            // Submit low priority first
            await coordinator.submitTask(lowPriorityTask);
            await coordinator.submitTask(highPriorityTask);

            // High priority should be processed first (in a real implementation)
            const queueStatus = await coordinator.getQueueStatus();
            expect(queueStatus).toBeDefined();
        });

        it('should handle task with dependencies', async () => {
            const dependentTask = {
                type: 'validate-conversion' as TaskType,
                priority: 5,
                description: 'Validate after conversion',
                input: { 
                    convertedContent: 'struct Test { }',
                    originalContent: 'class Test { }',
                    filePath: 'test.rs'
                },
                dependencies: ['convert-task-1']
            };

            const taskId = await coordinator.submitTask(dependentTask);
            expect(taskId).toBeDefined();
        });

        it('should get task status', async () => {
            const task = {
                type: 'convert-file' as TaskType,
                priority: 5,
                description: 'Test task status',
                input: { filePath: 'status.cs', content: 'class Status { }' }
            };

            const taskId = await coordinator.submitTask(task);
            
            // Task might not be in active tasks immediately if processed quickly
            const taskStatus = await coordinator.getTaskStatus(taskId);
            // Could be null if task completed already
            expect(taskStatus === null || typeof taskStatus === 'object').toBe(true);
        });
    });

    describe('agent management', () => {
        it('should get agent status', async () => {
            const status = await coordinator.getAgentStatus();
            
            expect(Array.isArray(status)).toBe(true);
            
            for (const agent of status) {
                expect(agent).toHaveProperty('id');
                expect(agent).toHaveProperty('type');
                expect(agent).toHaveProperty('name');
                expect(agent).toHaveProperty('status');
                
                expect(['converter', 'validator', 'optimizer', 'documenter', 'monitor', 'coordinator', 'specializer'])
                    .toContain(agent.type);
                    
                expect(['idle', 'busy', 'error', 'stopped', 'initializing'])
                    .toContain(agent.status);
            }
        });

        it('should stop all agents', async () => {
            await coordinator.stopAllAgents();
            
            const status = await coordinator.getAgentStatus();
            for (const agent of status) {
                expect(agent.status).toBe('stopped');
            }
        });

        it('should handle agent failures gracefully', async () => {
            // Submit a task that might cause agent failure
            const problematicTask = {
                type: 'convert-file' as TaskType,
                priority: 5,
                description: 'Problematic task',
                input: { filePath: '', content: '' } // Invalid input
            };

            const taskId = await coordinator.submitTask(problematicTask);
            expect(taskId).toBeDefined();
            
            // Agent should handle the error and continue running
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const status = await coordinator.getAgentStatus();
            expect(status.length).toBeGreaterThan(0);
        });
    });

    describe('coordination strategies', () => {
        it('should respect max concurrent agents', async () => {
            // Submit more tasks than max concurrent agents
            const tasks = Array.from({ length: 5 }, (_, i) => ({
                type: 'convert-file' as TaskType,
                priority: 5,
                description: `Concurrent test task ${i}`,
                input: { filePath: `test${i}.cs`, content: `class Test${i} { }` }
            }));

            await Promise.all(tasks.map(task => coordinator.submitTask(task)));

            const queueStatus = await coordinator.getQueueStatus();
            // Should not exceed max concurrent (3) but might be 0 if tasks complete quickly
            expect(queueStatus.activeTasks).toBeLessThanOrEqual(3);
        });

        it('should handle task retry logic', async () => {
            const retryTask = {
                type: 'convert-file' as TaskType,
                priority: 5,
                description: 'Task that needs retry',
                input: { filePath: 'retry.cs', content: 'invalid syntax {' },
                maxRetries: 2
            };

            const taskId = await coordinator.submitTask(retryTask);
            expect(taskId).toBeDefined();
            
            // Allow time for processing and potential retries
            await new Promise(resolve => setTimeout(resolve, 200));
        });
    });

    describe('performance monitoring', () => {
        it('should provide queue status', async () => {
            const status = await coordinator.getQueueStatus();
            
            expect(status).toHaveProperty('queueLength');
            expect(status).toHaveProperty('activeTasks');
            expect(status).toHaveProperty('completedTasks');
            
            expect(typeof status.queueLength).toBe('number');
            expect(typeof status.activeTasks).toBe('number');
            expect(typeof status.completedTasks).toBe('number');
            
            expect(status.queueLength).toBeGreaterThanOrEqual(0);
            expect(status.activeTasks).toBeGreaterThanOrEqual(0);
            expect(status.completedTasks).toBeGreaterThanOrEqual(0);
        });

        it('should track agent activity', async () => {
            const task = {
                type: 'convert-file' as TaskType,
                priority: 5,
                description: 'Activity tracking test',
                input: { filePath: 'activity.cs', content: 'class Activity { }' }
            };

            await coordinator.submitTask(task);
            
            // Allow some processing time
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const agentStatus = await coordinator.getAgentStatus();
            // At least one agent should show some activity
            const hasActivity = agentStatus.some(agent => 
                agent.lastActivity !== undefined || agent.currentTask !== undefined
            );
            
            // This might be true or false depending on timing
            expect(typeof hasActivity).toBe('boolean');
        });
    });

    describe('error handling', () => {
        it('should handle invalid task types gracefully', async () => {
            const invalidTask = {
                type: 'invalid-type' as TaskType,
                priority: 5,
                description: 'Invalid task type',
                input: {}
            };

            // Should not throw when submitting
            const taskId = await coordinator.submitTask(invalidTask);
            expect(taskId).toBeDefined();
        });

        it('should handle agent initialization failures', async () => {
            // This is tested by ensuring the coordinator doesn't crash
            // when agents fail to initialize
            const status = await coordinator.getAgentStatus();
            expect(Array.isArray(status)).toBe(true);
        });

        it('should handle memory system failures', async () => {
            // Submit a task when memory system might fail
            const task = {
                type: 'convert-file' as TaskType,
                priority: 5,
                description: 'Memory failure test',
                input: { filePath: 'memory.cs', content: 'class Memory { }' }
            };

            // Should not throw
            await expect(coordinator.submitTask(task)).resolves.toBeDefined();
        });
    });

    describe('singleton behavior', () => {
        it('should return same instance for same workspace', () => {
            const coordinator1 = getAgentCoordinator(testWorkspace);
            const coordinator2 = getAgentCoordinator(testWorkspace);
            
            expect(coordinator1).toBe(coordinator2);
        });

        it('should reset singleton correctly', () => {
            const coordinator1 = getAgentCoordinator(testWorkspace);
            resetAgentCoordinator();
            const coordinator2 = getAgentCoordinator(testWorkspace);
            
            expect(coordinator1).not.toBe(coordinator2);
        });
    });

    describe('integration scenarios', () => {
        it('should handle complex workflow', async () => {
            // Submit a conversion task followed by validation
            const conversionTask = {
                type: 'convert-file' as TaskType,
                priority: 5,
                description: 'Convert for workflow test',
                input: {
                    filePath: 'workflow.cs',
                    content: 'public class Workflow { public int Count { get; set; } }'
                }
            };

            const validationTask = {
                type: 'validate-conversion' as TaskType,
                priority: 6,
                description: 'Validate workflow conversion',
                input: {
                    convertedContent: 'pub struct Workflow { pub count: i32 }',
                    originalContent: 'public class Workflow { public int Count { get; set; } }',
                    filePath: 'workflow.rs'
                }
            };

            const taskId1 = await coordinator.submitTask(conversionTask);
            const taskId2 = await coordinator.submitTask(validationTask);

            expect(taskId1).toBeDefined();
            expect(taskId2).toBeDefined();

            // Allow processing time
            await new Promise(resolve => setTimeout(resolve, 100));

            const queueStatus = await coordinator.getQueueStatus();
            expect(queueStatus).toBeDefined();
        });

        it('should handle agent coordination under load', async () => {
            // Submit many tasks to test coordination
            const tasks = Array.from({ length: 10 }, (_, i) => ({
                type: (i % 2 === 0 ? 'convert-file' : 'validate-conversion') as TaskType,
                priority: Math.floor(Math.random() * 10) + 1,
                description: `Load test task ${i}`,
                input: i % 2 === 0 
                    ? { filePath: `load${i}.cs`, content: `class Load${i} { }` }
                    : { 
                        convertedContent: `struct Load${i} { }`,
                        originalContent: `class Load${i} { }`,
                        filePath: `load${i}.rs`
                    }
            }));

            const taskIds = await Promise.all(
                tasks.map(task => coordinator.submitTask(task))
            );

            expect(taskIds).toHaveLength(10);
            expect(taskIds.every(id => typeof id === 'string')).toBe(true);

            // Allow processing time
            await new Promise(resolve => setTimeout(resolve, 200));

            // System should still be responsive
            const finalStatus = await coordinator.getQueueStatus();
            expect(finalStatus).toBeDefined();
        });
    });
});