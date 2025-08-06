#!/usr/bin/env node

/**
 * Command Validation Script
 * Ensures all VS Code extension commands are properly configured
 */

const fs = require('fs');
const path = require('path');

class CommandValidator {
  constructor() {
    this.packageJsonPath = path.join(__dirname, '../package.json');
    this.extensionPath = path.join(__dirname, '../src/extension.ts');
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  run() {
    console.log('🔍 AutoClaude Command Validator v1.0');
    console.log('=' . repeat(60));
    console.log();

    this.loadFiles();
    this.validateCommands();
    this.validateHandlers();
    this.validateSubscriptions();
    this.validateMenus();
    this.validateKeyBindings();
    this.generateReport();

    return this.errors.length === 0 ? 0 : 1;
  }

  loadFiles() {
    try {
      this.packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      this.extensionContent = fs.readFileSync(this.extensionPath, 'utf8');
      this.info.push('✅ Files loaded successfully');
    } catch (error) {
      this.errors.push(`Failed to load files: ${error.message}`);
      throw error;
    }
  }

  validateCommands() {
    const packageCommands = this.packageJson.contributes.commands.map(cmd => cmd.command);
    const registeredCommands = this.extractRegisteredCommands();
    
    // Check for missing registrations
    const missingInExtension = packageCommands.filter(cmd => !registeredCommands.includes(cmd));
    const missingInPackage = registeredCommands.filter(cmd => !packageCommands.includes(cmd));

    if (missingInExtension.length > 0) {
      this.errors.push(`Commands in package.json but not registered: ${missingInExtension.join(', ')}`);
    }

    if (missingInPackage.length > 0) {
      this.warnings.push(`Commands registered but not in package.json: ${missingInPackage.join(', ')}`);
    }

    // Validate command properties
    this.packageJson.contributes.commands.forEach(cmd => {
      if (!cmd.command) {
        this.errors.push('Command missing ID');
      }
      if (!cmd.title) {
        this.errors.push(`Command ${cmd.command} missing title`);
      }
      if (!cmd.command.startsWith('autoclaude.')) {
        this.errors.push(`Command ${cmd.command} doesn't follow naming convention`);
      }
    });

    this.info.push(`📦 Package commands: ${packageCommands.length}`);
    this.info.push(`📝 Registered commands: ${registeredCommands.length}`);
  }

  extractRegisteredCommands() {
    const pattern = /vscode\.commands\.registerCommand\(\s*["']([^"']+)["']/g;
    const commands = [];
    let match;

    while ((match = pattern.exec(this.extensionContent)) !== null) {
      commands.push(match[1]);
    }

    return commands;
  }

  validateHandlers() {
    const packageCommands = this.packageJson.contributes.commands.map(cmd => cmd.command);
    const handlersFound = [];

    packageCommands.forEach(cmd => {
      // Check if command has a handler function
      const handlerPattern = new RegExp(`["']${cmd}["'][\\s\\S]*?=>\\s*\\{|["']${cmd}["'][\\s\\S]*?async\\s*\\(`, 'g');
      if (handlerPattern.test(this.extensionContent)) {
        handlersFound.push(cmd);
      }
    });

    const missingHandlers = packageCommands.filter(cmd => !handlersFound.includes(cmd));
    if (missingHandlers.length > 0) {
      this.warnings.push(`Commands possibly missing handlers: ${missingHandlers.join(', ')}`);
    }

    this.info.push(`🔧 Commands with handlers: ${handlersFound.length}/${packageCommands.length}`);
  }

  validateSubscriptions() {
    // Check if commands are added to context.subscriptions
    const subscriptionPattern = /context\.subscriptions\.push\(([\s\S]*?)\);/g;
    const match = subscriptionPattern.exec(this.extensionContent);
    
    if (!match) {
      this.errors.push('No subscription push found in extension');
      return;
    }

    const subscriptionContent = match[1];
    const commandVars = subscriptionContent.match(/\w+Command/g) || [];
    
    this.info.push(`✅ Commands in subscriptions: ${commandVars.length}`);

    // Verify each registered command has a variable
    const registeredCommands = this.extractRegisteredCommands();
    registeredCommands.forEach(cmd => {
      const varName = this.getCommandVariableName(cmd);
      if (varName && !commandVars.includes(varName)) {
        this.warnings.push(`Command ${cmd} may not be added to subscriptions`);
      }
    });
  }

  getCommandVariableName(commandId) {
    // Extract variable name for a command
    const pattern = new RegExp(`const\\s+(\\w+)\\s*=\\s*vscode\\.commands\\.registerCommand\\(\\s*["']${commandId}["']`, 'g');
    const match = pattern.exec(this.extensionContent);
    return match ? match[1] : null;
  }

  validateMenus() {
    if (!this.packageJson.contributes.menus) {
      this.warnings.push('No menus defined in package.json');
      return;
    }

    const commandPalette = this.packageJson.contributes.menus.commandPalette || [];
    const packageCommands = this.packageJson.contributes.commands.map(cmd => cmd.command);
    
    // Check which commands are in the command palette
    const paletteCommands = commandPalette.map(item => item.command);
    const missingFromPalette = packageCommands.filter(cmd => !paletteCommands.includes(cmd));
    
    if (missingFromPalette.length > 0) {
      this.info.push(`📋 Commands not in palette: ${missingFromPalette.length}`);
    }
  }

  validateKeyBindings() {
    const keybindings = this.packageJson.contributes.keybindings || [];
    const boundCommands = keybindings.map(kb => kb.command);
    
    this.info.push(`⌨️  Commands with keybindings: ${boundCommands.length}`);
    
    // Check for duplicate keybindings
    const keys = keybindings.map(kb => kb.key);
    const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
    
    if (duplicateKeys.length > 0) {
      this.errors.push(`Duplicate keybindings found: ${duplicateKeys.join(', ')}`);
    }
  }

  generateReport() {
    console.log('📊 VALIDATION REPORT');
    console.log('-'.repeat(40));
    console.log();

    // Show info
    if (this.info.length > 0) {
      console.log('ℹ️  Information:');
      this.info.forEach(msg => console.log(`   ${msg}`));
      console.log();
    }

    // Show warnings
    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      this.warnings.forEach(msg => console.log(`   ${msg}`));
      console.log();
    }

    // Show errors
    if (this.errors.length > 0) {
      console.log('❌ Errors:');
      this.errors.forEach(msg => console.log(`   ${msg}`));
      console.log();
    }

    // Summary
    console.log('=' . repeat(60));
    if (this.errors.length === 0) {
      if (this.warnings.length === 0) {
        console.log('✅ VALIDATION PASSED - All commands properly configured');
      } else {
        console.log(`⚠️  VALIDATION PASSED WITH ${this.warnings.length} WARNING(S)`);
      }
    } else {
      console.log(`❌ VALIDATION FAILED - ${this.errors.length} ERROR(S) FOUND`);
    }

    // Generate detailed report file
    this.generateDetailedReport();
  }

  generateDetailedReport() {
    const reportPath = path.join(__dirname, '../COMMAND_VALIDATION_REPORT.md');
    let content = '# Command Validation Report\n\n';
    content += `**Generated:** ${new Date().toISOString()}\n\n`;
    
    // Command summary
    const packageCommands = this.packageJson.contributes.commands;
    content += '## Command Summary\n\n';
    content += `- Total Commands: ${packageCommands.length}\n`;
    content += `- Registered: ${this.extractRegisteredCommands().length}\n`;
    content += `- Errors: ${this.errors.length}\n`;
    content += `- Warnings: ${this.warnings.length}\n\n`;

    // Command details
    content += '## Command Details\n\n';
    content += '| Command | Title | Category | Status |\n';
    content += '|---------|-------|----------|--------|\n';
    
    const registeredCommands = this.extractRegisteredCommands();
    packageCommands.forEach(cmd => {
      const status = registeredCommands.includes(cmd.command) ? '✅' : '❌';
      content += `| \`${cmd.command}\` | ${cmd.title} | ${cmd.category || 'General'} | ${status} |\n`;
    });

    // Issues
    if (this.errors.length > 0 || this.warnings.length > 0) {
      content += '\n## Issues Found\n\n';
      
      if (this.errors.length > 0) {
        content += '### Errors\n\n';
        this.errors.forEach(err => {
          content += `- ❌ ${err}\n`;
        });
        content += '\n';
      }

      if (this.warnings.length > 0) {
        content += '### Warnings\n\n';
        this.warnings.forEach(warn => {
          content += `- ⚠️  ${warn}\n`;
        });
      }
    }

    // Recommendations
    content += '\n## Recommendations\n\n';
    content += '1. Ensure all commands in package.json are registered in extension.ts\n';
    content += '2. Add all registered commands to context.subscriptions\n';
    content += '3. Provide meaningful titles and categories for all commands\n';
    content += '4. Consider adding keybindings for frequently used commands\n';
    content += '5. Test each command handler in isolation\n';

    fs.writeFileSync(reportPath, content);
    console.log(`\n📄 Detailed report saved to: COMMAND_VALIDATION_REPORT.md`);
  }
}

// Run validator
const validator = new CommandValidator();
const exitCode = validator.run();
process.exit(exitCode);