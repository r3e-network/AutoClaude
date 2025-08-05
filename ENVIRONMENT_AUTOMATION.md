# Environment-Aware Automation System

## Overview

The AutoClaude AutomationManager now includes intelligent environment detection and context-aware automation that adapts to your development environment, providing specialized instructions and optimizations for Neo-rs development.

## Features

### 🔍 **Automatic Environment Detection**

The system automatically detects:
- **Neo-rs Projects**: Analyzes project structure for Neo-related files and patterns
- **Git Branch Context**: Identifies Neo-rs specific branches (neo-rs, neo_rs, blockchain, etc.)
- **Configuration State**: Monitors enhanced feature availability (memory, agents, hooks)

### 🎯 **Environment-Specific Instructions**

#### **Standard Environment**
- Production-ready code requirements
- Comprehensive error handling
- Documentation standards
- Testing requirements
- Performance optimization
- Security considerations

#### **Neo-rs Environment** (Enhanced)
All standard instructions plus:
- **100% C# Neo N3 compatibility** requirements
- **Neo-rs type mapping** guidance (UInt160 → U160, UInt256 → U256, etc.)
- **Smart contract compatibility** validation
- **VM integration** requirements
- **Neo protocol compliance** checks
- **Blockchain performance** optimization
- **Consensus mechanism** validation
- **Cryptographic operation** handling

#### **C# to Rust Conversion Tasks** (Neo-rs + Conversion Keywords)
Additional specialized instructions:
- **Pattern learning** utilization from previous conversions
- **Type mapping** application from learned patterns  
- **Functionality validation** ensuring identical behavior
- **Comprehensive testing** comparing C# and Rust implementations
- **Memory safety** and performance optimizations
- **Rust ownership patterns** for Neo types

## Usage

### Automatic Operation
The system works automatically once initialized:

```typescript
const automationManager = new AutomationManager(workspacePath);
await automationManager.initialize();

// Environment is automatically detected and configured
const message = "Convert this Neo smart contract from C# to Rust";
const enhancedMessage = await automationManager.processMessage(message);
```

### Environment Information
Check current environment status:

```typescript
// Check if Neo-rs environment
const isNeoRs = automationManager.isNeoRsEnvironment();

// Get detailed environment info
const envInfo = automationManager.getEnvironmentInfo();
console.log(envInfo);
// Output:
// {
//   isNeoRs: true,
//   branch: "neo-rs-development", 
//   isNeoRsBranch: true,
//   detectedAt: "2025-08-04T13:00:00.000Z"
// }

// Get comprehensive statistics
const stats = automationManager.getStatistics();
console.log(stats.environmentInfo);
console.log(stats.enhancedFeaturesEnabled);
```

### Manual Environment Refresh
Refresh environment detection (useful after branch changes):

```typescript
await automationManager.refreshEnvironment();
```

## Configuration Integration

The system integrates with the enhanced configuration system:

### Memory System Integration
- Utilizes pattern learning for improved conversions
- References previous successful conversion patterns
- Applies learned type mappings automatically

### Agent System Integration  
- Enables multi-agent coordination for complex tasks
- Utilizes specialized converter and validator agents
- Provides intelligent task distribution

### Hook System Integration
- Activates automated validation and formatting
- Applies Neo-rs compatibility checking
- Ensures syntax validation for both C# and Rust

## Environment Detection Logic

### Neo-rs Project Detection
The system checks for:
- **Cargo.toml** with neo/blockchain dependencies
- **neo-rs** directory structure
- **src/lib.rs** with Neo-related imports
- **Git repository** with neo-project or neo-rs remotes

### Branch Detection
Identifies Neo-rs branches by patterns:
- `neo-rs*`
- `neo_rs*` 
- `*neo*`
- `*blockchain*`
- `*rust-port*`

### Configuration Detection
Monitors enhanced feature availability:
- Memory system enabled/disabled
- Agent system configuration
- Hook system status
- Neo-rs specific settings

## Benefits

### For Neo-rs Development
- **Specialized Instructions**: Tailored guidance for Neo blockchain requirements
- **Type Safety**: Automatic Neo-rs type mapping suggestions
- **Compatibility Assurance**: Built-in C# Neo N3 compatibility validation
- **Performance Optimization**: Neo-specific performance considerations

### For General Development
- **Context Awareness**: Instructions adapt to project context
- **Branch Intelligence**: Different guidance for different branches
- **Feature Integration**: Leverages all available enhanced features
- **Error Prevention**: Environment-specific error handling guidance

### For Team Development
- **Consistency**: Same specialized instructions across team members
- **Onboarding**: Automatic environment setup guidance
- **Best Practices**: Enforced Neo-rs development standards
- **Quality Assurance**: Built-in validation and testing requirements

## Example Output

### Neo-rs Environment Message Processing
```
Original: "Convert the consensus module from C# to Rust"

Enhanced Output:
=== Environment-Aware Automation Instructions ===
1. Ensure all code is production-ready with no TODOs or placeholders
2. Include comprehensive error handling
[... standard instructions ...]

=== Neo-rs Specific Instructions ===
9. PRIORITY: Ensure 100% compatibility with C# Neo N3 implementation
10. Use appropriate Neo-rs type mappings (UInt160 → U160, UInt256 → U256, etc.)
11. Validate all Neo-specific patterns and conventions
12. Ensure smart contract compatibility and proper VM integration
[... Neo-rs specific instructions ...]

=== C# to Rust Conversion Instructions ===
18. Use pattern learning from previous successful conversions
19. Apply learned type mappings and idiom conversions
20. Validate converted code maintains identical functionality
[... conversion specific instructions ...]

=== Branch Context ===
Current branch: neo-rs-development
Environment detected at: 2025-08-04T13:00:00.000Z

- Pattern learning is available for improved conversions
- Multi-agent coordination is available for complex tasks
- Automated validation and formatting hooks are active

=== End Automation Instructions ===
```

## Integration Points

### Extension Integration
The AutomationManager integrates with:
- **VS Code Extension**: Automatic initialization and environment detection
- **Enhanced Configuration**: Dynamic feature detection and configuration
- **Memory System**: Pattern learning and type mapping storage
- **Agent System**: Specialized Neo-rs conversion agents
- **Hook System**: Automated Neo-rs validation and formatting

### Future Enhancements
- **Machine Learning**: AI-powered environment detection improvements
- **Team Sharing**: Shared environment configurations and patterns
- **Custom Environments**: User-defined environment detection rules
- **Performance Analytics**: Environment-specific performance tracking

---

*Environment-Aware Automation - Intelligent development assistance that adapts to your project context*