/**
 * Entry point for the VS Code extension
 * This ensures proper CommonJS exports for VS Code
 */

import { activate as activateExtension, deactivate as deactivateExtension } from './extension';

// Export for VS Code
export const activate = activateExtension;
export const deactivate = deactivateExtension;

// Also export as CommonJS for compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    activate: activateExtension,
    deactivate: deactivateExtension
  };
}