# TDD/DDD Enforcement System

## Overview

AutoClaude enforces **Test-Driven Development (TDD)** and **Document-Driven Development (DDD)** practices automatically. This system ensures that all code is production-ready by requiring comprehensive tests and documentation **BEFORE** any implementation begins.

## Core Principles

### Test-Driven Development (TDD)

- **RED**: Write failing tests first
- **GREEN**: Write minimal code to make tests pass
- **REFACTOR**: Improve code while keeping tests green
- **Coverage**: Maintain >90% test coverage
- **Quality**: Ensure meaningful assertions and edge cases

### Document-Driven Development (DDD)

- **Architecture First**: Document system design before coding
- **API Contracts**: Define interfaces and contracts upfront
- **Examples**: Include usage examples and error handling
- **Completeness**: Every function must have comprehensive documentation
- **Accuracy**: Keep documentation synchronized with implementation

## Enforcement Architecture

### 1. SubAgent Enforcers

#### TDD Enforcement SubAgent (`tdd-enforcement.yaml`)

```yaml
capabilities:
  - Test detection and validation
  - Test-first enforcement
  - Coverage analysis (>90% required)
  - Test quality assessment
  - Pre-implementation blocking
  - Red-Green-Refactor validation
```

**Key Functions:**

- Scans for missing test files
- Validates test coverage thresholds
- Ensures tests fail before implementation
- Generates comprehensive test templates
- Blocks implementation without tests
- Validates test quality and assertions

#### DDD Enforcement SubAgent (`ddd-enforcement.yaml`)

```yaml
capabilities:
  - Documentation detection and validation
  - Documentation-first enforcement
  - API documentation analysis
  - Documentation quality assessment
  - Pre-implementation documentation requirements
  - JSDoc/TSDoc validation
```

**Key Functions:**

- Scans for missing documentation
- Validates documentation coverage
- Ensures architecture documentation exists
- Generates comprehensive doc templates
- Blocks implementation without docs
- Validates documentation completeness

### 2. Pre-Task Validation

#### PreTaskValidator (`PreTaskValidator.ts`)

- Runs **BEFORE** any implementation task
- Blocks tasks that violate TDD/DDD principles
- Provides detailed violation reports
- Guides developers to proper workflow

**Validation Flow:**

```
Implementation Task Request
          ↓
   Pre-Task Validation
          ↓
Tests Exist? ──NO──→ BLOCK (TDD Violation)
     ↓ YES
Docs Exist? ──NO──→ BLOCK (DDD Violation)
     ↓ YES
  Allow Implementation
```

### 3. Production Readiness Integration

Enhanced `ProductionReadinessValidator` with TDD/DDD checks:

- **Critical Issues**: Missing tests or documentation
- **Error Conditions**: Incomplete coverage or docs
- **Blocking**: Task completion prevented until violations fixed

### 4. Intelligent Task Analysis Integration

The `IntelligentTaskAnalyzer` enforces proper order:

```
Task Analysis Order (ENFORCED):
1. 📝 Documentation (FIRST - DDD)
2. 🧪 Tests (SECOND - TDD)
3. 💻 Implementation (THIRD - Only after docs & tests)
4. ✅ Test Validation (Ensure tests pass)
5. 📖 Documentation Validation (Ensure accuracy)
6. 🔒 Production Readiness (Final check)
```

## Workflow Examples

### Example 1: New Feature Development

**Command:** "Create a user authentication system with JWT tokens"

**Automatic Task Breakdown:**

1. **Documentation Task** (DDD - CRITICAL)
   - Agent: `ddd-enforcement`
   - Requirements: Architecture, API contracts, examples, security docs
   - Blocks: Implementation cannot proceed without this

2. **Testing Task** (TDD - CRITICAL)
   - Agent: `tdd-enforcement`
   - Requirements: Failing tests, unit/integration/edge cases
   - Depends on: Documentation completion
   - Blocks: Implementation cannot proceed without this

3. **Implementation Task** (TDD/DDD Compliant)
   - Agent: `coder-agent`
   - Depends on: Documentation AND Testing completion
   - Requirements: Follow documented design, make tests pass
   - Blocked without: Tests and documentation

4. **Test Validation**
   - Ensure all tests pass
   - Validate >90% coverage
   - No flaky tests

5. **Documentation Validation**
   - Ensure docs match implementation
   - Verify examples work
   - Update any discrepancies

6. **Production Readiness**
   - Final validation
   - No TODOs, placeholders, or shortcuts

### Example 2: Bug Fix

**Command:** "Fix the memory leak in UserService"

**Automatic Task Breakdown:**

1. **Documentation Task**
   - Document the bug and proposed solution
   - Include root cause analysis

2. **Testing Task**
   - Write failing test that reproduces the bug
   - Add regression tests

3. **Implementation Task**
   - Fix the bug following documented approach
   - Make tests pass

4. **Validation Tasks**
   - Ensure fix works
   - No regressions introduced

## Violation Handling

### Critical Violations (Block Execution)

- ❌ Implementation task without corresponding tests
- ❌ Implementation task without documentation
- ❌ Tests that pass without implementation (not Red phase)
- ❌ Empty or placeholder documentation
- ❌ Test coverage below 90%
- ❌ Missing architecture documentation

**User Experience:**

```
🚫 Task blocked: TDD/DDD violations detected

   Details:
   - No tests found for UserService
   - Missing documentation for authentication flow

   Required Actions:
   1. Write comprehensive tests first
   2. Document architecture and API contracts
   3. Only then proceed with implementation
```

### Error Conditions (Must Fix)

- ⚠️ Incomplete documentation coverage
- ⚠️ Tests without proper assertions
- ⚠️ Missing error handling documentation
- ⚠️ API documentation without examples

### Warning Conditions (Best Practices)

- 💡 Tests that might pass prematurely
- 💡 Documentation templates not filled out
- 💡 Missing usage examples

## Template Generation

### Test Template Generation

When tests are missing, the system automatically generates:

```typescript
describe("UserService", () => {
  beforeEach(() => {
    // Setup before each test
  });

  describe("authentication", () => {
    test("should authenticate valid user credentials", () => {
      // Arrange
      const credentials = { username: "test", password: "valid" };
      const expected = { token: "jwt-token", user: { id: 1 } };

      // Act
      const result = userService.authenticate(credentials);

      // Assert
      expect(result).toEqual(expected);
    });

    test("should throw error for invalid credentials", () => {
      // Arrange
      const invalidCredentials = { username: "test", password: "invalid" };

      // Act & Assert
      expect(() => {
        userService.authenticate(invalidCredentials);
      }).toThrow("Invalid credentials");
    });
  });
});
```

### Documentation Template Generation

When documentation is missing:

````typescript
/**
 * User authentication service providing secure login functionality
 *
 * @description Handles user authentication using JWT tokens with secure
 * password hashing and session management. Implements rate limiting
 * and security best practices.
 *
 * @example
 * ```typescript
 * const authService = new UserService();
 * const result = await authService.authenticate({
 *   username: 'user@example.com',
 *   password: 'securePassword123'
 * });
 * console.log(result.token); // JWT token
 * ```
 *
 * @param {AuthCredentials} credentials - User login credentials
 * @returns {Promise<AuthResult>} Authentication result with JWT token
 * @throws {AuthError} When credentials are invalid or user is locked
 */
````

## Configuration

### VS Code Settings

```json
{
  "autoclaude.workflow.enforceProductionReadiness": true,
  "autoclaude.workflow.productionStandards": {
    "blockTodos": true,
    "blockPlaceholders": true,
    "requireTests": true,
    "requireDocumentation": true,
    "minimumTestCoverage": 90,
    "enforceTestFirst": true,
    "enforceDocumentationFirst": true
  }
}
```

### SubAgent Configuration

Both TDD and DDD SubAgents support customization:

```yaml
options:
  minCoverage: 90
  requireTestsFirst: true
  blockImplementationWithoutTests: true
  requireFailingTestsFirst: true
  enforceTestNaming: true
  requireTestDocumentation: true
```

## Benefits

### Code Quality

- 🎯 **Thoughtful Design**: Documentation forces design thinking before coding
- 🧪 **Test Coverage**: Comprehensive tests catch bugs early
- 📖 **Living Documentation**: Docs stay synchronized with code
- 🔒 **Production Ready**: No shortcuts or placeholder code

### Development Process

- 📝 **Clear Requirements**: Documentation clarifies what to build
- 🧪 **Clean Design**: Test-first drives better architecture
- 🔄 **Safe Refactoring**: Tests enable confident code improvements
- 🚫 **No Technical Debt**: Prevents shortcuts that create future problems

### Team Benefits

- 📚 **Consistent Standards**: Same documentation approach across team
- 🧪 **Reliable Tests**: All features have comprehensive test coverage
- 🎯 **Clear Contracts**: APIs are well-documented before implementation
- 🔒 **Quality Assurance**: No incomplete code reaches production

## Metrics and Reporting

### TDD Metrics

- Test coverage percentage
- Tests per function ratio
- Test execution time
- Red-Green-Refactor cycle compliance

### DDD Metrics

- Documentation coverage percentage
- Functions with JSDoc percentage
- Architecture documentation completeness
- Example code validity

### Violation Reports

- Daily TDD/DDD compliance reports
- Trend analysis over time
- Most common violation types
- Team compliance leaderboard

## Advanced Features

### Learning System

- Remembers successful TDD/DDD patterns
- Suggests optimal test structures based on past success
- Learns from documentation patterns that work well
- Adapts enforcement based on project complexity

### Integration Points

- **Git Hooks**: Pre-commit validation
- **CI/CD**: Build pipeline integration
- **IDE**: Real-time violation highlighting
- **Code Review**: Automated TDD/DDD checklist

### Custom Agents

Teams can create custom enforcement agents:

- Domain-specific testing requirements
- Industry-specific documentation standards
- Company coding standards integration
- Custom quality gates

## Troubleshooting

### Common Issues

**"Implementation blocked - no tests found"**

- Write failing tests first
- Use test template generation
- Ensure test files follow naming conventions

**"Implementation blocked - no documentation found"**

- Add JSDoc/TSDoc to functions
- Create architecture documentation
- Use documentation template generation

**"Tests are passing without implementation"**

- Ensure tests fail first (Red phase)
- Remove any existing implementation
- Write more specific test assertions

**"Documentation incomplete"**

- Fill out all template placeholders
- Add usage examples
- Include error handling documentation

## Future Enhancements

- **AI-Powered Test Generation**: Smarter test case suggestions
- **Documentation Quality Scoring**: Automated doc quality assessment
- **Visual TDD Dashboard**: Real-time Red-Green-Refactor status
- **Team Collaboration Features**: Shared TDD/DDD best practices
- **Performance Integration**: Test performance impact tracking
- **Security Integration**: Security-focused test requirements

## Summary

AutoClaude's TDD/DDD Enforcement System ensures professional, production-ready development by:

✅ **Enforcing** documentation-first development (DDD)  
✅ **Requiring** tests before implementation (TDD)
✅ **Blocking** implementation without proper foundations
✅ **Validating** test coverage and quality automatically
✅ **Ensuring** production readiness at every step
✅ **Generating** templates when docs/tests are missing
✅ **Providing** detailed violation reports and guidance
✅ **Guiding** developers through proper TDD/DDD workflow

The result is consistently high-quality, well-tested, well-documented code that meets professional standards and is ready for production deployment.
