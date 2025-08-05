import { HiveMindAgent, AgentRole, HiveMindTask, HiveMindResult } from './types';
import { log } from '../../utils/productionLogger';
import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Architect Agent - Specializes in system design and architecture
 */
export default class ArchitectAgent implements HiveMindAgent {
    id = 'architect-agent';
    name = 'Architect Agent';
    role = AgentRole.ARCHITECT;
    capabilities = [
        'system-design',
        'architecture-planning',
        'api-design',
        'database-schema',
        'component-design',
        'dependency-analysis',
        'performance-planning'
    ];
    
    constructor(private workspaceRoot: string) {}
    
    async initialize(): Promise<void> {
        log.info('Architect Agent initialized');
    }
    
    async execute(task: HiveMindTask): Promise<HiveMindResult> {
        log.info('Architect Agent executing task', { taskId: task.id, type: task.type });
        
        try {
            switch (task.type) {
                case 'architecture-design':
                    return await this.designArchitecture(task);
                case 'api-design':
                    return await this.designAPI(task);
                case 'database-schema':
                    return await this.designDatabaseSchema(task);
                case 'component-design':
                    return await this.designComponent(task);
                default:
                    return await this.genericDesign(task);
            }
        } catch (error) {
            log.error('Architect Agent execution failed', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }
    
    private async designArchitecture(task: HiveMindTask): Promise<HiveMindResult> {
        const artifacts = [];
        
        // Analyze project structure
        const analysis = await this.analyzeProjectStructure();
        
        // Create architecture document
        const architectureDoc = this.generateArchitectureDocument(task, analysis);
        artifacts.push({
            type: 'documentation' as const,
            content: architectureDoc,
            path: path.join(this.workspaceRoot, 'docs', 'architecture.md')
        });
        
        // Create component diagram
        const componentDiagram = this.generateComponentDiagram(task, analysis);
        artifacts.push({
            type: 'documentation' as const,
            content: componentDiagram,
            path: path.join(this.workspaceRoot, 'docs', 'diagrams', 'components.md')
        });
        
        // Create folder structure
        const folderStructure = this.generateFolderStructure(task);
        artifacts.push({
            type: 'code' as const,
            content: folderStructure,
            metadata: { type: 'folder-structure' }
        });
        
        return {
            success: true,
            data: {
                architecture: analysis,
                recommendations: this.generateRecommendations(analysis)
            },
            artifacts,
            metrics: {
                duration: Date.now() - (task.startedAt || Date.now()),
                filesModified: artifacts.length
            }
        };
    }
    
    private async designAPI(task: HiveMindTask): Promise<HiveMindResult> {
        const artifacts = [];
        
        // Generate OpenAPI specification
        const openApiSpec = this.generateOpenAPISpec(task);
        artifacts.push({
            type: 'documentation' as const,
            content: JSON.stringify(openApiSpec, null, 2),
            path: path.join(this.workspaceRoot, 'api', 'openapi.json')
        });
        
        // Generate API documentation
        const apiDocs = this.generateAPIDocumentation(openApiSpec);
        artifacts.push({
            type: 'documentation' as const,
            content: apiDocs,
            path: path.join(this.workspaceRoot, 'docs', 'api.md')
        });
        
        // Generate API client interfaces
        const clientInterfaces = this.generateClientInterfaces(openApiSpec);
        artifacts.push({
            type: 'code' as const,
            content: clientInterfaces,
            path: path.join(this.workspaceRoot, 'src', 'api', 'interfaces.ts')
        });
        
        return {
            success: true,
            data: { openApiSpec },
            artifacts,
            metrics: {
                duration: Date.now() - (task.startedAt || Date.now()),
                filesModified: artifacts.length
            }
        };
    }
    
    private async designDatabaseSchema(task: HiveMindTask): Promise<HiveMindResult> {
        const artifacts = [];
        
        // Generate schema definition
        const schema = this.generateDatabaseSchema(task);
        artifacts.push({
            type: 'code' as const,
            content: schema.sql,
            path: path.join(this.workspaceRoot, 'database', 'schema.sql')
        });
        
        // Generate migration files
        const migrations = this.generateMigrations(schema);
        migrations.forEach((migration, index) => {
            artifacts.push({
                type: 'code' as const,
                content: migration,
                path: path.join(this.workspaceRoot, 'database', 'migrations', `${index + 1}_${migration.name}.sql`)
            });
        });
        
        // Generate ORM models
        const models = this.generateORMModels(schema);
        artifacts.push({
            type: 'code' as const,
            content: models,
            path: path.join(this.workspaceRoot, 'src', 'models', 'index.ts')
        });
        
        return {
            success: true,
            data: { schema },
            artifacts,
            metrics: {
                duration: Date.now() - (task.startedAt || Date.now()),
                filesModified: artifacts.length
            }
        };
    }
    
    private async designComponent(task: HiveMindTask): Promise<HiveMindResult> {
        const componentName = task.context?.componentName || 'Component';
        const artifacts = [];
        
        // Generate component structure
        const componentStructure = this.generateComponentStructure(componentName, task);
        
        // Create component files
        for (const [filename, content] of Object.entries(componentStructure)) {
            artifacts.push({
                type: 'code' as const,
                content: content as string,
                path: path.join(this.workspaceRoot, 'src', 'components', componentName, filename)
            });
        }
        
        // Generate component tests
        const tests = this.generateComponentTests(componentName);
        artifacts.push({
            type: 'test' as const,
            content: tests,
            path: path.join(this.workspaceRoot, 'src', 'components', componentName, `${componentName}.test.ts`)
        });
        
        return {
            success: true,
            data: { componentName, structure: componentStructure },
            artifacts,
            metrics: {
                duration: Date.now() - (task.startedAt || Date.now()),
                filesModified: artifacts.length
            }
        };
    }
    
    private async genericDesign(task: HiveMindTask): Promise<HiveMindResult> {
        // Handle generic design tasks
        const design = await this.createGenericDesign(task);
        
        return {
            success: true,
            data: { design },
            artifacts: [{
                type: 'documentation' as const,
                content: JSON.stringify(design, null, 2),
                metadata: { designType: task.type }
            }],
            metrics: {
                duration: Date.now() - (task.startedAt || Date.now())
            }
        };
    }
    
    private async analyzeProjectStructure(): Promise<any> {
        const structure: any = {
            type: 'unknown',
            hasTests: false,
            hasDocs: false,
            hasCI: false,
            dependencies: [],
            architecture: 'monolithic'
        };
        
        // Check for common project files
        const files = await vscode.workspace.findFiles('**/{package.json,pom.xml,build.gradle,Cargo.toml,go.mod}', '**/node_modules/**', 5);
        
        if (files.length > 0) {
            const file = files[0];
            if (file.path.endsWith('package.json')) {
                structure.type = 'node';
                const content = await vscode.workspace.fs.readFile(file);
                const pkg = JSON.parse(content.toString());
                structure.dependencies = Object.keys(pkg.dependencies || {});
            } else if (file.path.endsWith('pom.xml')) {
                structure.type = 'java-maven';
            } else if (file.path.endsWith('build.gradle')) {
                structure.type = 'java-gradle';
            } else if (file.path.endsWith('Cargo.toml')) {
                structure.type = 'rust';
            } else if (file.path.endsWith('go.mod')) {
                structure.type = 'go';
            }
        }
        
        // Check for tests
        const testFiles = await vscode.workspace.findFiles('**/*{test,spec}.{js,ts,java,go,rs}', '**/node_modules/**', 1);
        structure.hasTests = testFiles.length > 0;
        
        // Check for documentation
        const docFiles = await vscode.workspace.findFiles('**/README.md', null, 1);
        structure.hasDocs = docFiles.length > 0;
        
        // Check for CI
        const ciFiles = await vscode.workspace.findFiles('**/.{github,gitlab,circleci}/**/*', null, 1);
        structure.hasCI = ciFiles.length > 0;
        
        return structure;
    }
    
    private generateArchitectureDocument(task: HiveMindTask, analysis: any): string {
        return `# System Architecture

## Overview
${task.description || 'System architecture design document'}

## Project Type
- **Type**: ${analysis.type}
- **Architecture Style**: ${analysis.architecture}
- **Has Tests**: ${analysis.hasTests ? 'Yes' : 'No'}
- **Has Documentation**: ${analysis.hasDocs ? 'Yes' : 'No'}
- **Has CI/CD**: ${analysis.hasCI ? 'Yes' : 'No'}

## High-Level Architecture

### Components
1. **Presentation Layer**
   - User Interface components
   - API Gateway
   - Load Balancer

2. **Business Logic Layer**
   - Core Services
   - Domain Models
   - Business Rules Engine

3. **Data Layer**
   - Database
   - Cache Layer
   - Message Queue

### Design Principles
- **Separation of Concerns**: Clear boundaries between layers
- **Dependency Inversion**: Depend on abstractions, not concretions
- **Single Responsibility**: Each component has one reason to change
- **Open/Closed**: Open for extension, closed for modification

## Technology Stack
${this.generateTechStack(analysis)}

## Security Considerations
- Authentication & Authorization
- Data Encryption
- API Rate Limiting
- Input Validation

## Performance Considerations
- Caching Strategy
- Database Indexing
- Async Processing
- Load Balancing

## Scalability Plan
- Horizontal Scaling
- Database Sharding
- Microservices Migration Path
`;
    }
    
    private generateComponentDiagram(task: HiveMindTask, analysis: any): string {
        return `# Component Diagram

\`\`\`mermaid
graph TB
    subgraph "Client Layer"
        UI[Web UI]
        Mobile[Mobile App]
        API[API Client]
    end
    
    subgraph "Application Layer"
        Gateway[API Gateway]
        Auth[Auth Service]
        Core[Core Service]
        Worker[Background Worker]
    end
    
    subgraph "Data Layer"
        DB[(Database)]
        Cache[(Cache)]
        Queue[Message Queue]
    end
    
    UI --> Gateway
    Mobile --> Gateway
    API --> Gateway
    
    Gateway --> Auth
    Gateway --> Core
    Core --> DB
    Core --> Cache
    Core --> Queue
    Queue --> Worker
    Worker --> DB
\`\`\`

## Component Descriptions

### API Gateway
- Route requests to appropriate services
- Handle authentication/authorization
- Rate limiting and throttling

### Core Service
- Business logic implementation
- Data validation and processing
- Integration with external services

### Background Worker
- Async task processing
- Scheduled jobs
- Event processing
`;
    }
    
    private generateFolderStructure(task: HiveMindTask): string {
        return `
src/
├── api/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   └── validators/
├── core/
│   ├── domain/
│   ├── services/
│   └── repositories/
├── infrastructure/
│   ├── database/
│   ├── cache/
│   └── queue/
├── utils/
│   ├── logger/
│   ├── errors/
│   └── helpers/
├── config/
│   ├── default.ts
│   ├── development.ts
│   └── production.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── index.ts
`;
    }
    
    private generateRecommendations(analysis: any): string[] {
        const recommendations = [];
        
        if (!analysis.hasTests) {
            recommendations.push('Add comprehensive test coverage (unit, integration, e2e)');
        }
        
        if (!analysis.hasDocs) {
            recommendations.push('Create comprehensive documentation (README, API docs, architecture docs)');
        }
        
        if (!analysis.hasCI) {
            recommendations.push('Set up CI/CD pipeline for automated testing and deployment');
        }
        
        if (analysis.dependencies.length > 50) {
            recommendations.push('Review and optimize dependencies - consider reducing dependency count');
        }
        
        recommendations.push('Implement proper error handling and logging');
        recommendations.push('Add monitoring and alerting');
        recommendations.push('Create development environment setup guide');
        
        return recommendations;
    }
    
    private generateTechStack(analysis: any): string {
        const stacks: Record<string, string> = {
            'node': `
- **Runtime**: Node.js
- **Framework**: Express/Fastify/NestJS
- **Database**: PostgreSQL/MongoDB
- **Cache**: Redis
- **Queue**: RabbitMQ/Bull
- **Testing**: Jest/Mocha`,
            'java-maven': `
- **Language**: Java
- **Framework**: Spring Boot
- **Database**: PostgreSQL/MySQL
- **Cache**: Redis/Hazelcast
- **Queue**: RabbitMQ/Kafka
- **Testing**: JUnit/Mockito`,
            'rust': `
- **Language**: Rust
- **Framework**: Actix/Rocket
- **Database**: PostgreSQL/SQLite
- **Cache**: Redis
- **Queue**: RabbitMQ
- **Testing**: Built-in testing framework`,
            'go': `
- **Language**: Go
- **Framework**: Gin/Echo/Fiber
- **Database**: PostgreSQL/MongoDB
- **Cache**: Redis
- **Queue**: RabbitMQ/NATS
- **Testing**: Built-in testing + Testify`
        };
        
        return stacks[analysis.type] || `
- **Language**: [To be determined]
- **Framework**: [To be determined]
- **Database**: [To be determined]
- **Cache**: [To be determined]
- **Queue**: [To be determined]
- **Testing**: [To be determined]`;
    }
    
    private generateOpenAPISpec(task: HiveMindTask): any {
        return {
            openapi: '3.0.0',
            info: {
                title: task.context?.apiName || 'API',
                version: '1.0.0',
                description: task.description || 'API specification'
            },
            servers: [
                {
                    url: 'http://localhost:3000',
                    description: 'Development server'
                },
                {
                    url: 'https://api.example.com',
                    description: 'Production server'
                }
            ],
            paths: {
                '/health': {
                    get: {
                        summary: 'Health check',
                        responses: {
                            '200': {
                                description: 'Service is healthy',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                status: { type: 'string' },
                                                timestamp: { type: 'string' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            components: {
                schemas: {},
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT'
                    }
                }
            }
        };
    }
    
    private generateAPIDocumentation(spec: any): string {
        return `# API Documentation

## Overview
${spec.info.description}

## Base URLs
${spec.servers.map((s: any) => `- ${s.description}: ${s.url}`).join('\n')}

## Authentication
This API uses Bearer token authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <token>
\`\`\`

## Endpoints

${Object.entries(spec.paths).map(([path, methods]: [string, any]) => `
### ${path}
${Object.entries(methods).map(([method, details]: [string, any]) => `
**${method.toUpperCase()}** - ${details.summary}

Responses:
${Object.entries(details.responses).map(([code, response]: [string, any]) => 
`- ${code}: ${response.description}`).join('\n')}
`).join('\n')}
`).join('\n')}
`;
    }
    
    private generateClientInterfaces(spec: any): string {
        return `// Auto-generated API client interfaces

export interface APIClient {
    ${Object.entries(spec.paths).map(([path, methods]: [string, any]) => 
        Object.entries(methods).map(([method, details]: [string, any]) => {
            const operationId = details.operationId || `${method}${path.replace(/\//g, '_')}`;
            return `${operationId}: () => Promise<any>;`;
        }).join('\n    ')
    ).join('\n    ')}
}

export interface APIConfig {
    baseURL: string;
    headers?: Record<string, string>;
    timeout?: number;
}

export interface APIResponse<T = any> {
    data: T;
    status: number;
    headers: Record<string, string>;
}
`;
    }
    
    private generateDatabaseSchema(task: HiveMindTask): any {
        const tables = task.context?.tables || ['users', 'posts'];
        
        return {
            sql: tables.map((table: string) => `
CREATE TABLE ${table} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ${this.generateTableColumns(table)}
);

CREATE INDEX idx_${table}_created_at ON ${table}(created_at);
`).join('\n'),
            tables
        };
    }
    
    private generateTableColumns(tableName: string): string {
        const columns: Record<string, string> = {
            users: `
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP`,
            posts: `
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    published_at TIMESTAMP`
        };
        
        return columns[tableName] || 'data JSONB';
    }
    
    private generateMigrations(schema: any): any[] {
        return schema.tables.map((table: string, index: number) => ({
            name: `create_${table}_table`,
            content: `-- Migration: Create ${table} table

BEGIN;

${schema.sql.split('\n').filter((line: string) => 
    line.includes(`CREATE TABLE ${table}`) || 
    line.includes(`CREATE INDEX idx_${table}`)
).join('\n')}

COMMIT;
`
        }));
    }
    
    private generateORMModels(schema: any): string {
        return `// Auto-generated ORM models

${schema.tables.map((table: string) => `
export interface ${this.capitalize(this.singularize(table))} {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    ${this.generateModelProperties(table)}
}

export class ${this.capitalize(this.singularize(table))}Model {
    static tableName = '${table}';
    
    static async findById(id: string): Promise<${this.capitalize(this.singularize(table))} | null> {
        // Implementation here
        return null;
    }
    
    static async create(data: Partial<${this.capitalize(this.singularize(table))}>): Promise<${this.capitalize(this.singularize(table))}> {
        // Implementation here
        throw new Error('Not implemented');
    }
    
    static async update(id: string, data: Partial<${this.capitalize(this.singularize(table))}>): Promise<${this.capitalize(this.singularize(table))}> {
        // Implementation here
        throw new Error('Not implemented');
    }
    
    static async delete(id: string): Promise<boolean> {
        // Implementation here
        return false;
    }
}
`).join('\n')}
`;
    }
    
    private generateModelProperties(tableName: string): string {
        const properties: Record<string, string> = {
            users: `email: string;
    username: string;
    passwordHash: string;
    isActive: boolean;
    lastLogin?: Date;`,
            posts: `userId: string;
    title: string;
    content?: string;
    status: 'draft' | 'published' | 'archived';
    publishedAt?: Date;`
        };
        
        return properties[tableName] || 'data: any;';
    }
    
    private generateComponentStructure(componentName: string, task: HiveMindTask): Record<string, string> {
        const isReact = task.context?.framework === 'react';
        const isVue = task.context?.framework === 'vue';
        
        if (isReact) {
            return {
                'index.tsx': this.generateReactComponent(componentName),
                'styles.module.css': this.generateComponentStyles(componentName),
                'types.ts': this.generateComponentTypes(componentName)
            };
        } else if (isVue) {
            return {
                'index.vue': this.generateVueComponent(componentName),
                'types.ts': this.generateComponentTypes(componentName)
            };
        } else {
            return {
                'index.ts': this.generateGenericComponent(componentName),
                'styles.css': this.generateComponentStyles(componentName),
                'types.ts': this.generateComponentTypes(componentName)
            };
        }
    }
    
    private generateReactComponent(name: string): string {
        return `import React from 'react';
import styles from './styles.module.css';
import { ${name}Props } from './types';

export const ${name}: React.FC<${name}Props> = ({ children, ...props }) => {
    return (
        <div className={styles.container} {...props}>
            {children}
        </div>
    );
};

export default ${name};
`;
    }
    
    private generateVueComponent(name: string): string {
        return `<template>
    <div :class="$style.container">
        <slot></slot>
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { ${name}Props } from './types';

export default defineComponent({
    name: '${name}',
    props: {
        // Define props here
    },
    setup(props: ${name}Props) {
        return {};
    }
});
</script>

<style module>
.container {
    /* Component styles */
}
</style>
`;
    }
    
    private generateGenericComponent(name: string): string {
        return `import { ${name}Props } from './types';

export class ${name} {
    private props: ${name}Props;
    
    constructor(props: ${name}Props) {
        this.props = props;
    }
    
    render(): HTMLElement {
        const element = document.createElement('div');
        element.className = '${name.toLowerCase()}';
        return element;
    }
}

export default ${name};
`;
    }
    
    private generateComponentStyles(name: string): string {
        return `.container {
    /* ${name} component styles */
    display: flex;
    flex-direction: column;
    padding: 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
}

.${name.toLowerCase()}-header {
    font-size: 1.2rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
}

.${name.toLowerCase()}-content {
    flex: 1;
}
`;
    }
    
    private generateComponentTypes(name: string): string {
        return `export interface ${name}Props {
    children?: React.ReactNode;
    className?: string;
    id?: string;
    // Add more props as needed
}

export interface ${name}State {
    // Define component state
}

export type ${name}Ref = HTMLDivElement;
`;
    }
    
    private generateComponentTests(name: string): string {
        return `import { render, screen } from '@testing-library/react';
import { ${name} } from './${name}';

describe('${name}', () => {
    it('should render successfully', () => {
        render(<${name}>Test Content</${name}>);
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
    
    it('should accept className prop', () => {
        const { container } = render(<${name} className="custom-class" />);
        expect(container.firstChild).toHaveClass('custom-class');
    });
    
    // Add more tests as needed
});
`;
    }
    
    private async createGenericDesign(task: HiveMindTask): Promise<any> {
        return {
            type: task.type,
            description: task.description,
            components: ['component1', 'component2'],
            dependencies: [],
            estimatedEffort: '1-2 weeks',
            risks: ['Technical complexity', 'Integration challenges'],
            recommendations: ['Start with MVP', 'Iterate based on feedback']
        };
    }
    
    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    private singularize(str: string): string {
        // Simple singularization
        if (str.endsWith('ies')) {
            return str.slice(0, -3) + 'y';
        } else if (str.endsWith('s')) {
            return str.slice(0, -1);
        }
        return str;
    }
}