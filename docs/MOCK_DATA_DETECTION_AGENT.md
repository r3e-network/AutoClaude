# MockDataDetectionAgent Documentation

## Overview

The **MockDataDetectionAgent** is a specialized SubAgent that automatically detects and reports mock, sample, and placeholder data in production code. It ensures that projects maintain production-ready standards by identifying and flagging any non-production data or implementations.

## Purpose

This agent helps maintain code quality by:
- Preventing mock data from reaching production
- Ensuring complete implementations (no placeholders)
- Validating production readiness
- Providing actionable suggestions for fixes
- Automating code quality checks

## Features

### Detection Capabilities

The agent detects 14 different types of mock/sample data:

1. **Sample Data** - Comments indicating sample or example data
2. **Hardcoded Test Data** - Arrays with test values like "abc123"
3. **Mock Implementations** - Classes/services with "Mock", "Dummy", or "Fake" in the name
4. **Test IDs** - Hardcoded test identifiers
5. **Placeholder Names** - "John Doe", "Jane Doe", "Test User"
6. **Test Emails** - test@example.com, sample@test.com
7. **Test URLs** - example.com, test.com, dummy.org
8. **Lorem Ipsum** - Placeholder text
9. **Temporary Code** - "for now", "temporarily" comments
10. **Placeholder Values** - foo, bar, baz variables
11. **Unimplemented Features** - TODO comments with implementation tasks
12. **Not Implemented Errors** - Throw statements for unimplemented methods
13. **Debug Statements** - console.log calls
14. **Hardcoded Hosts** - localhost:port references

### Exclusions

The agent intelligently excludes:
- Test files (*.test.ts, *.spec.ts)
- Mock directories (__mocks__, mocks/)
- Test directories (test/, tests/)
- Type definition files (*.d.ts)
- Build output (dist/, build/)
- Coverage reports

## Usage

### As a SubAgent

```typescript
// Run via SubAgent system
const runner = new SubAgentRunner(workspacePath);
const result = await runner.runAgent('mock-data-detection', {
  workspacePath: '/path/to/project'
});

if (!result.success) {
  console.error('Mock data found:', result.message);
}
```

### Direct Usage

```typescript
import { MockDataDetectionAgent } from './subagents/agents/MockDataDetectionAgent';

const agent = new MockDataDetectionAgent('/path/to/project');
const result = await agent.executeSimple();

console.log('Status:', result.success ? 'PASS' : 'FAIL');
console.log('Message:', result.message);
console.log('Issues:', result.data.totalIssues);
```

### Command Line

```bash
# Via AutoClaude extension
autoclaude run-subagent mock-data-detection

# Via npm script
npm run mock-check
```

## Configuration

### YAML Configuration

The agent is configured via `.autoclaude/subagents/mock-data-detection.yaml`:

```yaml
id: mock-data-detection
name: Mock Data Detection Agent
category: quality
enabled: true

configuration:
  patterns:
    sampleData:
      - "sample data"
      - "example data"
    testIds:
      - "abc123"
      - "def456"
    placeholderNames:
      - "John Doe"
      - "Jane Doe"
  
  excludePatterns:
    - "*.test.ts"
    - "*.spec.ts"
    - "__tests__/**"
  
  severity:
    sampleData: error
    temporaryCode: warning
```

### Severity Levels

- **error** - Critical issues that must be fixed
- **warning** - Issues that should be reviewed

## Output

### Success Response

```json
{
  "success": true,
  "message": "✅ No mock data found in production code. 0 warnings.",
  "data": {
    "totalIssues": 0,
    "criticalIssues": 0,
    "warnings": 0
  },
  "confidence": "high"
}
```

### Failure Response

```json
{
  "success": false,
  "message": "❌ Found 5 critical mock data issues and 2 warnings",
  "data": {
    "totalIssues": 7,
    "criticalIssues": 5,
    "warnings": 2,
    "issues": [
      {
        "file": "/src/userService.ts",
        "line": 5,
        "type": "TEST_ID",
        "content": "{ id: \"abc123\", name: \"John Doe\" }",
        "severity": "error",
        "suggestion": "Use generated IDs or fetch from database"
      }
    ],
    "summary": {
      "TEST_ID": 2,
      "PLACEHOLDER_NAME": 2,
      "TEMPORARY_CODE": 1
    }
  },
  "suggestions": [
    "🔴 Fix 5 critical mock data issues before production",
    "Replace all sample data with real data from databases or APIs",
    "Use environment variables for configuration"
  ]
}
```

## Integration

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
node scripts/detect-mock-data.js
if [ $? -ne 0 ]; then
  echo "Mock data detected! Fix before committing."
  exit 1
fi
```

### CI/CD Pipeline

#### GitHub Actions

```yaml
- name: Mock Data Check
  run: |
    npm run mock-check
    if [ $? -ne 0 ]; then
      echo "::error::Mock data found in production code"
      exit 1
    fi
```

#### Jenkins

```groovy
stage('Mock Data Check') {
  steps {
    sh 'npm run mock-check'
  }
}
```

### VS Code Integration

The agent integrates with the AutoClaude extension:

1. Open Command Palette (Cmd+Shift+P)
2. Run "AutoClaude: Run SubAgent"
3. Select "Mock Data Detection Agent"
4. View results in output panel

## Best Practices

### DO ✅
- Run before every commit
- Include in CI/CD pipeline
- Review warnings regularly
- Fix critical issues immediately
- Use real data sources

### DON'T ❌
- Ignore critical issues
- Commit with mock data
- Use placeholders in production
- Leave TODOs unimplemented
- Ship temporary code

## Examples

### Example 1: Detecting Hardcoded Data

**Input:**
```typescript
class UserService {
  private users = [
    { id: "abc123", name: "John Doe" },
    { id: "def456", name: "Jane Doe" }
  ];
}
```

**Output:**
```
❌ Mock data detected:
- Line 3: Hardcoded test ID "abc123"
- Line 3: Placeholder name "John Doe"
- Line 4: Hardcoded test ID "def456"
- Line 4: Placeholder name "Jane Doe"

Suggestion: Replace with real data from database
```

### Example 2: Clean Code

**Input:**
```typescript
class UserService {
  constructor(private db: Database) {}
  
  async getUsers() {
    return this.db.query('SELECT * FROM users');
  }
}
```

**Output:**
```
✅ No mock data detected - code is production ready!
```

## Troubleshooting

### False Positives

If legitimate code is flagged:
1. Check if file should be excluded
2. Review pattern configuration
3. Add to excludePatterns if needed

### Missing Detections

If mock data isn't detected:
1. Add pattern to configuration
2. Check severity level
3. Verify file is being scanned

### Performance Issues

For large projects:
1. Limit scan to specific directories
2. Increase timeout values
3. Run in background process

## API Reference

### Class: MockDataDetectionAgent

#### Constructor
```typescript
new MockDataDetectionAgent(workspacePath: string)
```

#### Methods

##### executeSimple
```typescript
executeSimple(spec?: string): Promise<{
  success: boolean;
  message: string;
  data?: any;
  confidence?: string;
  suggestions?: string[];
}>
```

##### scanDirectory
```typescript
private scanDirectory(dir: string, issues: MockDataIssue[]): void
```

##### scanFile
```typescript
private scanFile(filePath: string, issues: MockDataIssue[]): void
```

##### generateReport
```typescript
private generateReport(issues: MockDataIssue[]): string
```

## Support

For issues or feature requests:
- GitHub Issues: https://github.com/r3e-network/AutoClaude/issues
- Documentation: https://github.com/r3e-network/AutoClaude/docs

## License

Part of the AutoClaude extension - MIT License