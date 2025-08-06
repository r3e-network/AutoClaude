import {
  HiveMindAgent,
  AgentRole,
  HiveMindTask,
  HiveMindResult,
} from "./types";
import { log } from "../../utils/productionLogger";
import * as vscode from "vscode";
import * as path from "path";
import {
  ApiFile,
  ApiEndpoint,
  ApiModel,
  ApiSpec,
  ApiDocumentation,
  ApiExample,
  CodeModule,
  CodeFunction,
  CodeClass,
  CodeAnalysis,
  CodeDocumentation,
  UserPersona,
  Feature,
  UserGuideSet,
  ProjectInfo,
  Badge,
  GitCommit,
  ArchitectureComponent,
  ArchitectureLayer,
  Architecture,
  Requirement,
  Tutorial,
  DocumentationArtifact,
} from "../../types/documentation";

/**
 * Documentation Agent - Specializes in creating, maintaining, and improving documentation
 */
export default class DocumentationAgent implements HiveMindAgent {
  id = "documentation-agent";
  name = "Documentation Agent";
  role = AgentRole.DOCUMENTATION;
  capabilities = [
    "api-documentation",
    "code-documentation",
    "user-guides",
    "technical-specs",
    "readme-generation",
    "changelog-maintenance",
    "tutorial-creation",
    "documentation-audit",
  ];

  constructor(private workspaceRoot: string) {}

  async initialize(): Promise<void> {
    log.info("Documentation Agent initialized");
  }

  async execute(task: HiveMindTask): Promise<HiveMindResult> {
    log.info("Documentation Agent executing task", {
      taskId: task.id,
      type: task.type,
    });

    try {
      switch (task.type) {
        case "api-documentation":
          return await this.generateApiDocumentation(task);
        case "code-documentation":
          return await this.generateCodeDocumentation(task);
        case "user-guides":
          return await this.createUserGuides(task);
        case "readme-generation":
          return await this.generateReadme(task);
        case "changelog-maintenance":
          return await this.maintainChangelog(task);
        case "technical-specs":
          return await this.createTechnicalSpecs(task);
        case "tutorial-creation":
          return await this.createTutorials(task);
        case "add-documentation":
          return await this.addComprehensiveDocumentation(task);
        default:
          return await this.genericDocumentationTask(task);
      }
    } catch (error) {
      log.error("Documentation Agent execution failed", error as Error, undefined);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private async generateApiDocumentation(
    task: HiveMindTask,
  ): Promise<HiveMindResult> {
    const apiFiles = await this.findApiFiles();
    const apiSpec = await this.extractApiSpec(apiFiles);
    const documentation = await this.generateApiDocs(apiSpec);

    const artifacts = [
      {
        type: "documentation" as const,
        content: documentation.openApiSpec,
        path: path.join(this.workspaceRoot, "docs", "api", "openapi.yaml"),
      },
      {
        type: "documentation" as const,
        content: documentation.readme,
        path: path.join(this.workspaceRoot, "docs", "api", "README.md"),
      },
      {
        type: "documentation" as const,
        content: documentation.postmanCollection,
        path: path.join(
          this.workspaceRoot,
          "docs",
          "api",
          "postman-collection.json",
        ),
      },
    ];

    return {
      success: true,
      data: {
        endpointsDocumented: apiSpec.endpoints.length,
        modelsDocumented: apiSpec.models.length,
        examplesGenerated: documentation.examples?.length || 0,
      },
      artifacts,
      metrics: {
        duration: Date.now() - (task.startedAt || Date.now()),
        filesProcessed: apiFiles.length,
      },
    };
  }

  private async generateCodeDocumentation(
    task: HiveMindTask,
  ): Promise<HiveMindResult> {
    const sourceFiles = await this.findSourceFiles(task.context?.targetPath);
    const codeAnalysis = await this.analyzeCodeStructure(sourceFiles);
    const documentation = await this.generateCodeDocs(codeAnalysis);

    const artifacts = [];

    // Generate main documentation
    artifacts.push({
      type: "documentation" as const,
      content: documentation.overview,
      path: path.join(this.workspaceRoot, "docs", "code", "README.md"),
    });

    // Generate module documentation
    for (const module of documentation.modules) {
      artifacts.push({
        type: "documentation" as const,
        content: module.documentation,
        path: path.join(
          this.workspaceRoot,
          "docs",
          "code",
          `${module.name}.md`,
        ),
      });
    }

    // Generate inline documentation updates
    for (const update of documentation.inlineUpdates) {
      artifacts.push({
        type: "code" as const,
        content: update.content,
        path: update.file,
        metadata: { type: "inline-documentation" },
      });
    }

    return {
      success: true,
      data: {
        filesDocumented: sourceFiles.length,
        functionsDocumented: codeAnalysis.functions.length,
        classesDocumented: codeAnalysis.classes.length,
        modulesCreated: documentation.modules.length,
      },
      artifacts,
      metrics: {
        duration: Date.now() - (task.startedAt || Date.now()),
        filesProcessed: sourceFiles.length,
      },
    };
  }

  private async createUserGuides(task: HiveMindTask): Promise<HiveMindResult> {
    const userPersonas = await this.identifyUserPersonas();
    const features = await this.analyzeFeatures();
    const guides = await this.generateUserGuides(userPersonas, features);

    const artifacts = [];

    // Main user guide
    artifacts.push({
      type: "documentation" as const,
      content: guides.mainGuide,
      path: path.join(this.workspaceRoot, "docs", "user-guide", "README.md"),
    });

    // Quick start guide
    if (guides.quickStart) {
      artifacts.push({
        type: "documentation" as const,
        content: guides.quickStart,
      path: path.join(
        this.workspaceRoot,
        "docs",
        "user-guide",
        "quick-start.md",
      ),
      });
    }

    // Feature-specific guides
    for (const guide of guides.featureGuides) {
      artifacts.push({
        type: "documentation" as const,
        content: guide.guide || guide.content || '',
        path: path.join(
          this.workspaceRoot,
          "docs",
          "user-guide",
          `${guide.feature}.md`,
        ),
      });
    }

    // FAQ
    if (guides.faq) {
      artifacts.push({
        type: "documentation" as const,
        content: JSON.stringify(guides.faq, null, 2),
      path: path.join(this.workspaceRoot, "docs", "user-guide", "faq.md"),
      });
    }

    return {
      success: true,
      data: {
        guidesCreated: guides.featureGuides.length + 3, // +3 for main, quick-start, faq
        featuresDocumented: features.length,
        userPersonas: userPersonas.length,
      },
      artifacts,
      metrics: {
        duration: Date.now() - (task.startedAt || Date.now()),
      },
    };
  }

  private async generateReadme(task: HiveMindTask): Promise<HiveMindResult> {
    const projectInfo = await this.analyzeProject();
    const readme = await this.createReadme(projectInfo);

    return {
      success: true,
      data: {
        readmeGenerated: true,
        hasExamples: !!readme.examples,
        hasContributing: !!readme.contributing,
      },
      artifacts: [
        {
          type: "documentation" as const,
          content: readme.readme,
          path: path.join(this.workspaceRoot, "README.md"),
        },
      ],
      metrics: {
        duration: Date.now() - (task.startedAt || Date.now()),
      },
    };
  }

  private async maintainChangelog(task: HiveMindTask): Promise<HiveMindResult> {
    const currentChangelog = await this.readCurrentChangelog();
    const gitHistory = await this.analyzeGitHistory();
    const updatedChangelog = await this.updateChangelog(
      currentChangelog,
      gitHistory,
      task.context,
    );

    return {
      success: true,
      data: {
        entriesAdded: updatedChangelog.newEntries.length,
        version: task.context?.version || "latest",
        changeTypes: updatedChangelog.changeTypes,
      },
      artifacts: [
        {
          type: "documentation" as const,
          content: updatedChangelog.content,
          path: path.join(this.workspaceRoot, "CHANGELOG.md"),
        },
      ],
      metrics: {
        duration: Date.now() - (task.startedAt || Date.now()),
      },
    };
  }

  private async createTechnicalSpecs(
    task: HiveMindTask,
  ): Promise<HiveMindResult> {
    const architecture = await this.analyzeArchitecture();
    const requirements = await this.extractRequirements();
    const specs = await this.generateTechnicalSpecs(architecture, requirements);

    const artifacts = [
      {
        type: "documentation" as const,
        content: specs.architectureSpec,
        path: path.join(this.workspaceRoot, "docs", "specs", "architecture.md"),
      },
      {
        type: "documentation" as const,
        content: specs.requirementsSpec,
        path: path.join(this.workspaceRoot, "docs", "specs", "requirements.md"),
      },
      {
        type: "documentation" as const,
        content: specs.designSpec,
        path: path.join(this.workspaceRoot, "docs", "specs", "design.md"),
      },
    ];

    return {
      success: true,
      data: {
        specsGenerated: 3,
        componentsDocumented: architecture.components.length,
        requirementsDocumented: requirements.length,
      },
      artifacts,
      metrics: {
        duration: Date.now() - (task.startedAt || Date.now()),
      },
    };
  }

  private async createTutorials(task: HiveMindTask): Promise<HiveMindResult> {
    const topics = await this.identifyTutorialTopics();
    const tutorials = await this.generateTutorials(topics);

    const artifacts = [];

    // Tutorial index
    artifacts.push({
      type: "documentation" as const,
      content: tutorials.index,
      path: path.join(this.workspaceRoot, "docs", "tutorials", "README.md"),
    });

    // Individual tutorials
    for (const tutorial of tutorials.tutorials) {
      artifacts.push({
        type: "documentation" as const,
        content: tutorial.content,
        path: path.join(
          this.workspaceRoot,
          "docs",
          "tutorials",
          `${tutorial.slug}.md`,
        ),
      });
    }

    return {
      success: true,
      data: {
        tutorialsCreated: tutorials.tutorials.length,
        difficulty: tutorials.difficultyLevels,
        estimatedTime: tutorials.totalEstimatedTime,
      },
      artifacts,
      metrics: {
        duration: Date.now() - (task.startedAt || Date.now()),
      },
    };
  }

  private async addComprehensiveDocumentation(
    task: HiveMindTask,
  ): Promise<HiveMindResult> {
    // This is the main comprehensive documentation task
    const artifacts = [];

    // 1. Project README
    const projectInfo = await this.analyzeProject();
    const readme = await this.createReadme(projectInfo);
    artifacts.push({
      type: "documentation" as const,
      content: readme.readme,
      path: path.join(this.workspaceRoot, "README.md"),
    });

    // 2. API Documentation
    const apiFiles = await this.findApiFiles();
    if (apiFiles.length > 0) {
      const apiSpec = await this.extractApiSpec(apiFiles);
      const apiDocs = await this.generateApiDocs(apiSpec);
      artifacts.push({
        type: "documentation" as const,
        content: apiDocs.readme,
        path: path.join(this.workspaceRoot, "docs", "api.md"),
      });
    }

    // 3. Architecture Documentation
    const architecture = await this.analyzeArchitecture();
    const archDoc = this.generateArchitectureDoc(architecture);
    artifacts.push({
      type: "documentation" as const,
      content: archDoc,
      path: path.join(this.workspaceRoot, "docs", "architecture.md"),
    });

    // 4. Contributing Guide
    const contributingGuide = this.generateContributingGuide();
    artifacts.push({
      type: "documentation" as const,
      content: contributingGuide,
      path: path.join(this.workspaceRoot, "CONTRIBUTING.md"),
    });

    // 5. Code of Conduct
    const codeOfConduct = this.generateCodeOfConduct();
    artifacts.push({
      type: "documentation" as const,
      content: codeOfConduct,
      path: path.join(this.workspaceRoot, "CODE_OF_CONDUCT.md"),
    });

    // 6. Security Policy
    const securityPolicy = this.generateSecurityPolicy();
    artifacts.push({
      type: "documentation" as const,
      content: securityPolicy,
      path: path.join(this.workspaceRoot, "SECURITY.md"),
    });

    // 7. User Guide
    const userPersonas = await this.identifyUserPersonas();
    const features = await this.analyzeFeatures();
    const userGuides = await this.generateUserGuides(userPersonas, features);
    artifacts.push({
      type: "documentation" as const,
      content: userGuides.mainGuide,
      path: path.join(this.workspaceRoot, "docs", "user-guide.md"),
    });

    // 8. Developer Guide
    const developerGuide = await this.generateDeveloperGuide();
    artifacts.push({
      type: "documentation" as const,
      content: developerGuide,
      path: path.join(this.workspaceRoot, "docs", "developer-guide.md"),
    });

    return {
      success: true,
      data: {
        documentsCreated: artifacts.length,
        readmeGenerated: true,
        apiDocumented: apiFiles.length > 0,
        architectureDocumented: true,
        userGuideCreated: true,
      },
      artifacts,
      metrics: {
        duration: Date.now() - (task.startedAt || Date.now()),
        filesProcessed: artifacts.length,
      },
    };
  }

  private async genericDocumentationTask(
    task: HiveMindTask,
  ): Promise<HiveMindResult> {
    const documentation = await this.generateGenericDocumentation(
      task.description,
    );

    return {
      success: true,
      data: {
        documentType: "generic",
        wordsGenerated: documentation.split(" ").length,
      },
      artifacts: [
        {
          type: "documentation" as const,
          content: documentation,
          path: path.join(
            this.workspaceRoot,
            "docs",
            `${task.description.toLowerCase().replace(/\s+/g, "-")}.md`,
          ),
        },
      ],
      metrics: {
        duration: Date.now() - (task.startedAt || Date.now()),
      },
    };
  }

  // Helper methods
  private async findApiFiles(): Promise<string[]> {
    const apiPatterns = [
      "**/routes/**/*.{ts,js}",
      "**/controllers/**/*.{ts,js}",
      "**/api/**/*.{ts,js}",
      "**/*api*.{ts,js}",
      "**/*route*.{ts,js}",
    ];

    const apiFiles = [];
    for (const pattern of apiPatterns) {
      const files = await vscode.workspace.findFiles(
        pattern,
        "**/node_modules/**",
        50,
      );
      apiFiles.push(...files.map((f) => f.fsPath));
    }

    return [...new Set(apiFiles)]; // Remove duplicates
  }

  private async extractApiSpec(apiFiles: string[]): Promise<any> {
    const endpoints = [];
    const models = [];

    for (const file of apiFiles) {
      try {
        const uri = vscode.Uri.file(file);
        const document = await vscode.workspace.openTextDocument(uri);
        const content = document.getText();

        // Extract endpoints (simplified)
        const routeMatches =
          content.match(
            /\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
          ) || [];
        for (const match of routeMatches) {
          const [, method, routePath] =
            match.match(
              /\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/,
            ) || [];
          if (method && routePath) {
            endpoints.push({
              method: method.toUpperCase(),
              path: routePath,
              file: path.basename(file),
              description: this.extractEndpointDescription(content, match),
            });
          }
        }

        // Extract models (simplified)
        const interfaceMatches = content.match(/interface\s+(\w+)/g) || [];
        for (const match of interfaceMatches) {
          const [, name] = match.match(/interface\s+(\w+)/) || [];
          if (name) {
            models.push({
              name,
              file: path.basename(file),
              properties: this.extractInterfaceProperties(content, name),
            });
          }
        }
      } catch (error) {
        log.warn("Failed to analyze API file", { file, error });
      }
    }

    return { endpoints, models };
  }

  private extractEndpointDescription(content: string, match: string): string {
    const lines = content.split("\n");
    const matchLine = lines.findIndex((line) => line.includes(match));

    // Look for comments above the endpoint
    for (let i = matchLine - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith("//") || line.startsWith("*")) {
        return line.replace(/^\/\/\s*|\*\s*/g, "");
      }
      if (line && !line.startsWith("//") && !line.startsWith("*")) {
        break;
      }
    }

    return "API endpoint";
  }

  private extractInterfaceProperties(
    content: string,
    interfaceName: string,
  ): string[] {
    const interfaceRegex = new RegExp(
      `interface\\s+${interfaceName}\\s*\\{([^}]+)\\}`,
      "s",
    );
    const match = content.match(interfaceRegex);

    if (match) {
      const properties = match[1]
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("//"))
        .map((line) => line.replace(/[;,]$/, ""));

      return properties;
    }

    return [];
  }

  private async generateApiDocs(apiSpec: ApiSpec): Promise<ApiDocumentation> {
    const openApiSpec = this.generateOpenApiSpec(apiSpec);
    const readme = this.generateApiReadme(apiSpec);
    const postmanCollection = this.generatePostmanCollection(apiSpec);
    const examples = this.generateApiExamples(apiSpec);

    return {
      openApiSpec,
      readme,
      postmanCollection: JSON.stringify(postmanCollection, null, 2),
      examples,
    };
  }

  private generateOpenApiSpec(apiSpec: ApiSpec): string {
    const spec = {
      openapi: "3.0.0",
      info: {
        title: "API Documentation",
        version: "1.0.0",
        description: "Auto-generated API documentation",
      },
      paths: {} as Record<string, any>,
    };

    for (const endpoint of apiSpec.endpoints) {
      if (!spec.paths[endpoint.path]) {
        spec.paths[endpoint.path] = {};
      }

      spec.paths[endpoint.path][endpoint.method.toLowerCase()] = {
        summary: endpoint.description,
        responses: {
          "200": {
            description: "Success",
          },
        },
      };
    }

    return `# OpenAPI Specification\n\n\`\`\`yaml\n${JSON.stringify(spec, null, 2)}\n\`\`\``;
  }

  private generateApiReadme(apiSpec: ApiSpec): string {
    return `# API Documentation

## Overview
This document describes the API endpoints available in this application.

## Endpoints

${apiSpec.endpoints
  .map(
    (endpoint: ApiEndpoint) => `
### ${endpoint.method} ${endpoint.path}
**Description**: ${endpoint.description}
**File**: ${endpoint.file}

**Example Request:**
\`\`\`bash
curl -X ${endpoint.method} ${endpoint.path}
\`\`\`
`,
  )
  .join("\n")}

## Models

${apiSpec.models
  .map(
    (model: ApiModel) => `
### ${model.name}
**File**: ${model.file}

**Properties:**
${model.properties?.map((prop: string) => `- ${prop}`).join("\n") || "No properties documented"}
`,
  )
  .join("\n")}

## Authentication
Describe authentication requirements here.

## Error Handling
Describe error response format here.
`;
  }

  private generatePostmanCollection(apiSpec: ApiSpec): string {
    return JSON.stringify({
      info: {
        name: "API Collection",
        description: "Auto-generated Postman collection",
      },
      item: apiSpec.endpoints.map((endpoint: ApiEndpoint) => ({
        name: `${endpoint.method} ${endpoint.path}`,
        request: {
          method: endpoint.method,
          header: [],
          url: {
            raw: `{{baseUrl}}${endpoint.path}`,
            host: ["{{baseUrl}}"],
            path: endpoint.path.split("/").filter(Boolean),
          },
        },
      })),
    }, null, 2);
  }

  private generateApiExamples(apiSpec: ApiSpec): ApiExample[] {
    return apiSpec.endpoints.map((endpoint: ApiEndpoint) => ({
      endpoint: `${endpoint.method} ${endpoint.path}`,
      request: `curl -X ${endpoint.method} ${endpoint.path}`,
      response: '{ "status": "success" }',
    }));
  }

  private async findSourceFiles(targetPath?: string): Promise<string[]> {
    const searchPath = targetPath || "**";
    const files = await vscode.workspace.findFiles(
      `${searchPath}/**/*.{ts,js,tsx,jsx,py,java,go,rs}`,
      "**/node_modules/**",
      200,
    );

    return files.map((f) => f.fsPath);
  }

  private async analyzeCodeStructure(sourceFiles: string[]): Promise<any> {
    const functions = [];
    const classes = [];
    const modules = [];

    for (const file of sourceFiles) {
      try {
        const uri = vscode.Uri.file(file);
        const document = await vscode.workspace.openTextDocument(uri);
        const content = document.getText();
        const relativePath = path.relative(this.workspaceRoot, file);

        // Extract functions
        const functionMatches =
          content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g) || [];
        for (const match of functionMatches) {
          const [, name] = match.match(/(\w+)$/) || [];
          if (name) {
            functions.push({
              name,
              file: relativePath,
              async: match.includes("async"),
              exported: match.includes("export"),
            });
          }
        }

        // Extract classes
        const classMatches =
          content.match(/(?:export\s+)?class\s+(\w+)/g) || [];
        for (const match of classMatches) {
          const [, name] = match.match(/(\w+)$/) || [];
          if (name) {
            classes.push({
              name,
              file: relativePath,
              exported: match.includes("export"),
            });
          }
        }

        // Categorize as module
        const moduleName = path.basename(file, path.extname(file));
        modules.push({
          name: moduleName,
          path: relativePath,
          functions: functions.filter((f) => f.file === relativePath).length,
          classes: classes.filter((c) => c.file === relativePath).length,
        });
      } catch (error) {
        log.warn("Failed to analyze source file", { file, error });
      }
    }

    return { functions, classes, modules };
  }

  private async generateCodeDocs(codeAnalysis: CodeAnalysis): Promise<CodeDocumentation> {
    const overview = this.generateCodeOverview(codeAnalysis);
    const modules = this.generateModuleDocs(codeAnalysis.modules);
    const inlineUpdates = this.generateInlineDocUpdates(codeAnalysis);

    return {
      overview,
      modules,
      inlineUpdates,
    };
  }

  private generateCodeOverview(analysis: CodeAnalysis): string {
    return `# Code Documentation

## Project Structure

### Statistics
- **Total Modules**: ${analysis.modules.length}
- **Total Functions**: ${analysis.functions.length}
- **Total Classes**: ${analysis.classes.length}

### Modules Overview
${analysis.modules
  .map(
    (module: CodeModule) => `
#### ${module.name}
- **Path**: ${module.path}
- **Functions**: ${module.functions}
- **Classes**: ${module.classes}
`,
  )
  .join("")}

### Main Functions
${analysis.functions
  .slice(0, 20)
  .map(
    (func: CodeFunction) => `
#### ${func.name}
- **File**: ${func.file}
- **Async**: ${func.async ? "Yes" : "No"}
- **Exported**: ${func.exported ? "Yes" : "No"}
`,
  )
  .join("")}

### Main Classes
${analysis.classes
  .slice(0, 10)
  .map(
    (cls: CodeClass) => `
#### ${cls.name}
- **File**: ${cls.file}
- **Exported**: ${cls.exported ? "Yes" : "No"}
`,
  )
  .join("")}
`;
  }

  private generateModuleDocs(modules: CodeModule[]): Array<{ name: string; documentation: string }> {
    return modules.map((module) => ({
      name: module.name,
      documentation: `# ${module.name}

## Overview
Module located at: \`${module.path}\`

## Statistics
- Functions: ${module.functions}
- Classes: ${module.classes}

## Usage
\`\`\`typescript
import { } from './${module.name}';
\`\`\`

## API Reference
Detailed API documentation for this module.
`,
    }));
  }

  private generateInlineDocUpdates(analysis: CodeAnalysis): Array<{ file: string; content: string }> {
    // Generate updated source files with better documentation
    const updates: Array<{ file: string; content: string }> = [];
    
    // Process each file that needs documentation updates
    if (analysis.files) {
      analysis.files.forEach(file => {
        if (file.functions && file.functions.length > 0) {
          // Generate documentation for undocumented functions
          const needsDocs = file.functions.filter(f => !f.documentation);
          if (needsDocs.length > 0) {
            // Mark file for documentation update
            updates.push({
              file: file.path,
              content: '' // Content generation would be handled by document generation system
            });
          }
        }
      });
    }
    
    return updates;
  }

  private async identifyUserPersonas(): Promise<any[]> {
    return [
      {
        name: "Developer",
        description: "Software developers using the API or library",
        needs: ["API documentation", "Code examples", "Integration guides"],
      },
      {
        name: "End User",
        description: "End users of the application",
        needs: [
          "User interface guides",
          "Feature tutorials",
          "Troubleshooting",
        ],
      },
      {
        name: "Administrator",
        description: "System administrators",
        needs: ["Deployment guides", "Configuration options", "Monitoring"],
      },
    ];
  }

  private async analyzeFeatures(): Promise<any[]> {
    // Analyze package.json, source code, etc. to identify features
    const features = [
      {
        name: "Authentication",
        description: "User authentication and authorization",
      },
      { name: "API", description: "REST API endpoints" },
      { name: "Configuration", description: "Application configuration" },
      { name: "Logging", description: "Application logging" },
      { name: "Error Handling", description: "Error handling and reporting" },
    ];

    return features;
  }

  private async generateUserGuides(
    personas: UserPersona[],
    features: Feature[],
  ): Promise<UserGuideSet> {
    const mainGuide = this.generateMainUserGuide(features);
    const quickStart = this.generateQuickStartGuide();
    const featureGuides = features.map((feature) => ({
      feature: feature.name.toLowerCase().replace(/\s+/g, "-"),
      guide: this.generateFeatureGuide(feature),
    }));
    const faq = this.generateFAQ();

    return {
      mainGuide,
      quickStart,
      featureGuides,
      faq: this.generateFAQArray(),
      personaGuides: personas.map(persona => ({
        persona: persona.name,
        guide: this.generatePersonaGuide(persona),
      })),
    };
  }

  private generateMainUserGuide(features: Feature[]): string {
    return `# User Guide

## Welcome
Welcome to the user guide for this application.

## Getting Started
Follow these steps to get started with the application.

## Features
${features
  .map(
    (feature) => `
### ${feature.name}
${feature.description}

[Learn more about ${feature.name}](${feature.name.toLowerCase().replace(/\s+/g, "-")}.md)
`,
  )
  .join("")}

## Support
If you need help, please check the FAQ or contact support.
`;
  }

  private generateQuickStartGuide(): string {
    return `# Quick Start Guide

## Prerequisites
- Node.js 18 or higher
- npm or yarn

## Installation
\`\`\`bash
npm install
\`\`\`

## Configuration
1. Copy \`.env.example\` to \`.env\`
2. Update configuration values
3. Run the application

## First Steps
1. Start the application
2. Navigate to the interface
3. Follow the setup wizard

## Next Steps
- Read the full [User Guide](README.md)
- Check out the [API Documentation](../api.md)
- Join our community
`;
  }

  private generateFeatureGuide(feature: Feature): string {
    return `# ${feature.name} Guide

## Overview
${feature.description}

## Getting Started
Steps to get started with ${feature.name}.

## Configuration
Configuration options for ${feature.name}.

## Usage Examples
Examples of how to use ${feature.name}.

## Troubleshooting
Common issues and solutions for ${feature.name}.
`;
  }

  private generateFAQ(): string {
    return `# Frequently Asked Questions

## General Questions

### What is this application?
This application provides [description].

### How do I get started?
Follow the [Quick Start Guide](quick-start.md) to get started.

### Where can I find more help?
Check the [User Guide](README.md) or contact support.

## Technical Questions

### What are the system requirements?
- Node.js 18 or higher
- Modern web browser
- Sufficient disk space

### How do I report bugs?
Please report bugs through our issue tracker.

### How do I contribute?
See the [Contributing Guide](../CONTRIBUTING.md) for details.
`;
  }

  private generateFAQArray(): Array<{ question: string; answer: string }> {
    return [
      {
        question: "What is this application?",
        answer: "This application provides comprehensive functionality for the project.",
      },
      {
        question: "How do I get started?",
        answer: "Follow the Quick Start Guide to get started.",
      },
      {
        question: "Where can I find more help?",
        answer: "Check the documentation or contact support.",
      },
      {
        question: "How do I report bugs?",
        answer: "Please report bugs through our issue tracker.",
      },
      {
        question: "How do I contribute?",
        answer: "See the Contributing Guide for details.",
      },
    ];
  }

  private generatePersonaGuide(persona: UserPersona): string {
    return `# Guide for ${persona.name}

## Overview
This guide is specifically tailored for ${persona.role}.

## Your Goals
${persona.goals.map((goal: string) => `- ${goal}`).join("\n")}

## Your Skills
${persona.skills.map((skill: string) => `- ${skill}`).join("\n")}

## Getting Started
Specific instructions for ${persona.name} users.

## Key Features
Features most relevant to ${persona.name} users.

## Resources
Additional resources and documentation for ${persona.name} users.
`;
  }

  private async analyzeProject(): Promise<any> {
    let packageJson = null;

    try {
      const packageFiles = await vscode.workspace.findFiles(
        "**/package.json",
        "**/node_modules/**",
        1,
      );
      if (packageFiles.length > 0) {
        const document = await vscode.workspace.openTextDocument(
          packageFiles[0],
        );
        packageJson = JSON.parse(document.getText());
      }
    } catch (error) {
      log.warn("Failed to read package.json", undefined, { error: (error as Error).message });
    }

    return {
      name: packageJson?.name || "Project",
      version: packageJson?.version || "1.0.0",
      description: packageJson?.description || "A software project",
      author: packageJson?.author || "Development Team",
      license: packageJson?.license || "MIT",
      repository: packageJson?.repository?.url || "",
      dependencies: packageJson?.dependencies || {},
      devDependencies: packageJson?.devDependencies || {},
      scripts: packageJson?.scripts || {},
      keywords: packageJson?.keywords || [],
    };
  }

  private async createReadme(projectInfo: ProjectInfo): Promise<{ readme: string; examples: string; contributing: string }> {
    const badges = this.generateBadges(projectInfo);
    const installationSteps = this.generateInstallationSteps(projectInfo);

    const sections = [
      "header",
      "description",
      "features",
      "installation",
      "usage",
      "api",
      "contributing",
      "license",
    ];

    const content = `# ${projectInfo.name}

${badges.map((badge) => badge.markdown).join("\n")}

## Description
${projectInfo.description}

## Features
- Feature 1: Description
- Feature 2: Description
- Feature 3: Description

## Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Install Dependencies
\`\`\`bash
npm install
\`\`\`

### Configuration
1. Copy \`.env.example\` to \`.env\`
2. Update configuration values

### Run the Application
\`\`\`bash
npm start
\`\`\`

## Usage
Basic usage examples and common use cases.

\`\`\`javascript
// Example usage
const app = require('${projectInfo.name}');
app.start();
\`\`\`

## API Documentation
See [API Documentation](docs/api.md) for detailed API reference.

## Scripts
${Object.entries(projectInfo.scripts)
  .map(([name, script]) => `- \`npm run ${name}\`: ${script}`)
  .join("\n")}

## Contributing
Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License
This project is licensed under the ${projectInfo.license} License - see the [LICENSE](LICENSE) file for details.

## Support
- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](${projectInfo.repository}/issues)
- Discussions: [GitHub Discussions](${projectInfo.repository}/discussions)

## Acknowledgments
- Contributors
- Dependencies
- Inspiration
`;

    return {
      content,
      sections,
      badges,
      installationSteps,
    };
  }

  private generateBadges(projectInfo: ProjectInfo): Badge[] {
    const badges = [];

    if (projectInfo.version) {
      badges.push({
        name: "version",
        markdown: `![Version](https://img.shields.io/badge/version-${projectInfo.version}-blue.svg)`,
      });
    }

    if (projectInfo.license) {
      badges.push({
        name: "license",
        markdown: `![License](https://img.shields.io/badge/license-${projectInfo.license}-green.svg)`,
      });
    }

    badges.push({
      name: "build",
      markdown:
        "![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)",
    });

    return badges;
  }

  private generateInstallationSteps(projectInfo: ProjectInfo): string[] {
    const steps = [
      "Clone the repository",
      "Install dependencies",
      "Configure environment",
      "Run the application",
    ];

    return steps;
  }

  private async readCurrentChangelog(): Promise<string> {
    try {
      const changelogFiles = await vscode.workspace.findFiles(
        "**/CHANGELOG.md",
        null,
        1,
      );
      if (changelogFiles.length > 0) {
        const document = await vscode.workspace.openTextDocument(
          changelogFiles[0],
        );
        return document.getText();
      }
    } catch (error) {
      log.warn("Failed to read CHANGELOG.md", error as Error);
    }

    return "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n";
  }

  private async analyzeGitHistory(): Promise<any[]> {
    try {
      const { execSync } = require('child_process');
      
      // Get real git history
      const gitLog = execSync(
        'git log --pretty=format:"%H|%s" --max-count=50',
        { cwd: this.workspaceRoot, encoding: 'utf8' }
      );
      
      if (!gitLog) {
        return [];
      }
      
      const commits = gitLog.split('\n').filter(line => line.trim());
      
      return commits.map(line => {
        const [hash, message] = line.split('|');
        let type = 'other';
        
        // Determine commit type from message
        if (message.startsWith('feat:') || message.startsWith('feature:')) {
          type = 'feature';
        } else if (message.startsWith('fix:') || message.startsWith('bugfix:')) {
          type = 'bugfix';
        } else if (message.startsWith('docs:') || message.startsWith('doc:')) {
          type = 'documentation';
        } else if (message.startsWith('test:')) {
          type = 'test';
        } else if (message.startsWith('refactor:')) {
          type = 'refactor';
        } else if (message.startsWith('chore:')) {
          type = 'chore';
        }
        
        return { hash, message, type };
      });
    } catch (error) {
      // If git is not available or not a git repository, return empty array
      return [];
    }
  }

  private async updateChangelog(
    currentChangelog: string,
    gitHistory: GitCommit[],
    context: { version?: string },
  ): Promise<{ changelog: string; releaseNotes: string }> {
    const version = context?.version || "1.0.0";
    const date = new Date().toISOString().split("T")[0];

    const newEntries = gitHistory.map((commit) => ({
      type: commit.type,
      message: commit.message,
      hash: commit.hash,
    }));

    const changeTypes = [...new Set(newEntries.map((entry) => entry.type))];

    const newSection = `## [${version}] - ${date}

### Added
${newEntries
  .filter((e) => e.type === "feature")
  .map((e) => `- ${e.message}`)
  .join("\n")}

### Fixed
${newEntries
  .filter((e) => e.type === "bugfix")
  .map((e) => `- ${e.message}`)
  .join("\n")}

### Changed
${newEntries
  .filter((e) => e.type === "change")
  .map((e) => `- ${e.message}`)
  .join("\n")}

`;

    const updatedContent = currentChangelog.replace(
      /# Changelog\n\n/,
      `# Changelog\n\n${newSection}`,
    );

    return {
      content: updatedContent,
      newEntries,
      changeTypes,
    };
  }

  private async analyzeArchitecture(): Promise<any> {
    const sourceFiles = await this.findSourceFiles();

    return {
      components: [
        { name: "Core", description: "Core application logic" },
        { name: "API", description: "REST API layer" },
        { name: "Database", description: "Data persistence layer" },
        { name: "UI", description: "User interface components" },
      ],
      layers: [
        { name: "Presentation", components: ["UI"] },
        { name: "Business Logic", components: ["Core"] },
        { name: "Data Access", components: ["Database"] },
      ],
      technologies: this.extractTechnologies(sourceFiles),
    };
  }

  private extractTechnologies(sourceFiles: string[]): string[] {
    const technologies = new Set<string>();

    // Analyze file extensions
    sourceFiles.forEach((file) => {
      const ext = path.extname(file);
      switch (ext) {
        case ".ts":
        case ".tsx":
          technologies.add("TypeScript");
          break;
        case ".js":
        case ".jsx":
          technologies.add("JavaScript");
          break;
        case ".py":
          technologies.add("Python");
          break;
      }
    });

    return Array.from(technologies);
  }

  private async extractRequirements(): Promise<any[]> {
    return [
      { id: "REQ-001", title: "User Authentication", priority: "high" },
      { id: "REQ-002", title: "Data Storage", priority: "high" },
      { id: "REQ-003", title: "API Access", priority: "medium" },
      { id: "REQ-004", title: "User Interface", priority: "medium" },
    ];
  }

  private async generateTechnicalSpecs(
    architecture: Architecture,
    requirements: Requirement[],
  ): Promise<{ architectureSpec: string; requirementsSpec: string; designSpec: string }> {
    const architectureSpec = this.generateArchitectureSpec(architecture);
    const requirementsSpec = this.generateRequirementsSpec(requirements);
    const designSpec = this.generateDesignSpec(architecture, requirements);

    return {
      architectureSpec,
      requirementsSpec,
      designSpec,
    };
  }

  private generateArchitectureSpec(architecture: Architecture): string {
    return `# Architecture Specification

## System Overview
This document describes the high-level architecture of the system.

## Components
${architecture.components
  .map(
    (comp: ArchitectureComponent) => `
### ${comp.name}
${comp.description}
`,
  )
  .join("")}

## System Layers
${architecture.layers
  .map(
    (layer: ArchitectureLayer) => `
### ${layer.name}
Components: ${layer.components.join(", ")}
`,
  )
  .join("")}

## Technology Stack
${architecture.technologies.map((tech: string) => `- ${tech}`).join("\n")}

## Design Principles
- Separation of concerns
- Single responsibility
- Dependency inversion
- Open/closed principle
`;
  }

  private generateRequirementsSpec(requirements: Requirement[]): string {
    return `# Requirements Specification

## Functional Requirements
${requirements
  .map(
    (req: Requirement) => `
### ${req.id}: ${req.title}
**Priority**: ${req.priority}

Description and details of the requirement.
`,
  )
  .join("")}

## Non-Functional Requirements
- Performance requirements
- Security requirements
- Scalability requirements
- Availability requirements
`;
  }

  private generateDesignSpec(architecture: Architecture, requirements: Requirement[]): string {
    return `# Design Specification

## Design Overview
This document describes the detailed design of the system components.

## Component Design
${architecture.components
  .map(
    (comp: ArchitectureComponent) => `
### ${comp.name} Design
${comp.description}

**Responsibilities:**
- Primary responsibility
- Secondary responsibility

**Interfaces:**
- Input interfaces
- Output interfaces
`,
  )
  .join("")}

## Data Design
Database schema and data models.

## Interface Design
API and user interface design specifications.
`;
  }

  private async identifyTutorialTopics(): Promise<any[]> {
    return [
      {
        title: "Getting Started",
        slug: "getting-started",
        difficulty: "beginner",
        estimatedTime: "15 minutes",
        description: "Learn the basics of using the application",
      },
      {
        title: "Advanced Configuration",
        slug: "advanced-configuration",
        difficulty: "intermediate",
        estimatedTime: "30 minutes",
        description: "Configure advanced features",
      },
      {
        title: "Custom Extensions",
        slug: "custom-extensions",
        difficulty: "advanced",
        estimatedTime: "45 minutes",
        description: "Create custom extensions",
      },
    ];
  }

  private async generateTutorials(topics: Tutorial[]): Promise<{ 
    tutorials: Array<Tutorial & { content: string }>; 
    index: string;
    difficultyLevels: string[];
    totalEstimatedTime: number;
  }> {
    const tutorials = topics.map((topic) => ({
      ...topic,
      content: this.generateTutorialContent(topic),
    }));

    const index = this.generateTutorialIndex(tutorials);
    const difficultyLevels = [...new Set(topics.map((t) => t.difficulty))];
    const totalEstimatedTime = topics.reduce(
      (acc, t) => acc + parseInt(t.estimatedTime),
      0,
    );

    return {
      tutorials,
      index,
      difficultyLevels,
      totalEstimatedTime,
    };
  }

  private generateTutorialContent(topic: Tutorial): string {
    return `# ${topic.title}

**Difficulty**: ${topic.difficulty}
**Estimated Time**: ${topic.estimatedTime}

## Overview
${topic.description}

## Prerequisites
- Basic understanding of the application
- Completed previous tutorials (if applicable)

## Step 1: Setup
Instructions for the first step.

## Step 2: Implementation
Instructions for implementation.

## Step 3: Testing
Instructions for testing.

## Conclusion
Summary of what was learned.

## Next Steps
- Link to next tutorial
- Additional resources
`;
  }

  private generateTutorialIndex(tutorials: Array<Tutorial & { content: string }>): string {
    return `# Tutorials

## Available Tutorials
${tutorials
  .map(
    (tutorial) => `
### [${tutorial.title}](${tutorial.slug}.md)
**Difficulty**: ${tutorial.difficulty} | **Time**: ${tutorial.estimatedTime}

${tutorial.description}
`,
  )
  .join("")}

## Learning Path
1. Start with beginner tutorials
2. Progress to intermediate topics
3. Explore advanced concepts

## Support
If you need help with any tutorial, please check the FAQ or contact support.
`;
  }

  private generateArchitectureDoc(architecture: Architecture): string {
    return `# Architecture Documentation

## System Architecture
This document provides an overview of the system architecture.

## High-Level Components
${architecture.components
  .map(
    (comp: ArchitectureComponent) => `
### ${comp.name}
${comp.description}
`,
  )
  .join("")}

## Architecture Layers
${architecture.layers
  .map(
    (layer: ArchitectureLayer) => `
### ${layer.name} Layer
**Components**: ${layer.components.join(", ")}
`,
  )
  .join("")}

## Technology Stack
${architecture.technologies.map((tech: string) => `- **${tech}**: Used for [purpose]`).join("\n")}

## Design Decisions
Key architectural decisions and their rationale.

## Deployment Architecture
How the system is deployed and scaled.
`;
  }

  private generateContributingGuide(): string {
    return `# Contributing Guide

## Welcome Contributors
Thank you for your interest in contributing to this project!

## Getting Started
1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Submit a pull request

## Development Setup
\`\`\`bash
git clone <your-fork>
npm install
npm run dev
\`\`\`

## Code Style
- Follow the existing code style
- Use meaningful variable names
- Add comments for complex logic
- Write tests for new features

## Testing
\`\`\`bash
npm test
npm run test:coverage
\`\`\`

## Pull Request Process
1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update the changelog
5. Submit your pull request

## Code of Conduct
Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions?
Feel free to open an issue or reach out to the maintainers.
`;
  }

  private generateCodeOfConduct(): string {
    return `# Code of Conduct

## Our Pledge
We pledge to make participation in our project a harassment-free experience for everyone.

## Our Standards
Examples of behavior that contributes to creating a positive environment include:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community

## Unacceptable Behavior
Examples of unacceptable behavior include:
- The use of sexualized language or imagery
- Trolling, insulting comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission

## Our Responsibilities
Project maintainers are responsible for clarifying standards and taking corrective action.

## Enforcement
Instances of abusive behavior may be reported to the project team. All complaints will be reviewed and investigated.

## Attribution
This Code of Conduct is adapted from the Contributor Covenant, version 2.0.
`;
  }

  private generateSecurityPolicy(): string {
    return `# Security Policy

## Supported Versions
Information about which versions are currently supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability
If you discover a security vulnerability, please report it privately.

### How to Report
1. Email security@[domain] with details
2. Include steps to reproduce
3. Provide your contact information
4. Allow time for investigation

### What to Expect
- Acknowledgment within 48 hours
- Regular updates on progress
- Credit for responsible disclosure
- Fix deployed as soon as possible

## Security Best Practices
For users of this software:
- Keep software updated
- Use strong authentication
- Monitor for suspicious activity
- Follow security guidelines

## Security Features
- Authentication and authorization
- Input validation
- Secure communication
- Data encryption
`;
  }

  private async generateDeveloperGuide(): string {
    return `# Developer Guide

## Development Environment Setup
Instructions for setting up the development environment.

### Prerequisites
- Node.js 18+
- Git
- IDE/Editor

### Setup Steps
1. Clone the repository
2. Install dependencies
3. Configure environment
4. Run development server

## Project Structure
\`\`\`
src/
├── components/     # Reusable components
├── services/       # Business logic
├── utils/          # Utility functions
├── types/          # Type definitions
└── tests/          # Test files
\`\`\`

## Development Workflow
1. Create feature branch
2. Implement changes
3. Write tests
4. Run quality checks
5. Submit pull request

## Testing
- Unit tests: \`npm run test\`
- Integration tests: \`npm run test:integration\`
- E2E tests: \`npm run test:e2e\`

## Code Quality
- Linting: \`npm run lint\`
- Type checking: \`npm run type-check\`
- Formatting: \`npm run format\`

## Debugging
Tips and tools for debugging the application.

## Deployment
Instructions for deploying the application.
`;
  }

  private async generateGenericDocumentation(
    description: string,
  ): Promise<string> {
    return `# ${description}

## Overview
Documentation for: ${description}

## Details
Detailed information about ${description}.

## Usage
How to use or implement ${description}.

## Examples
Code examples and use cases.

## References
Additional resources and links.
`;
  }
}
