/**
 * Entry point for the VS Code extension
 * This ensures proper CommonJS exports for VS Code
 */

const extension = require('./extension');

// Export for VS Code using CommonJS
module.exports = {
  activate: extension.activate,
  deactivate: extension.deactivate
};