#!/bin/bash

# AutoClaude v3.14.1 Release Script
# Critical fix for "command not found" errors

echo "=== AutoClaude v3.14.1 Release ==="
echo ""

# Check if package exists
if [ ! -f "autoclaude-3.14.1.vsix" ]; then
    echo "❌ Error: autoclaude-3.14.1.vsix not found"
    echo "Run: npm run compile:production && npx @vscode/vsce package --no-dependencies"
    exit 1
fi

echo "✅ Package found: autoclaude-3.14.1.vsix"
echo ""

# Display release notes
echo "📋 Release Notes:"
echo "=================="
echo "• CRITICAL FIX: Resolved 'command not found' errors"
echo "• Fixed module export issues preventing activation"
echo "• All 43 commands now properly registered"
echo "• Added comprehensive command verification tests"
echo ""

# Installation instructions
echo "📦 Installation Instructions:"
echo "============================="
echo ""
echo "Option 1: Manual Installation"
echo "-----------------------------"
echo "1. Download autoclaude-3.14.1.vsix"
echo "2. In VS Code, press Ctrl/Cmd+Shift+P"
echo "3. Run: Extensions: Install from VSIX..."
echo "4. Select the downloaded file"
echo "5. Restart VS Code"
echo ""
echo "Option 2: Command Line Installation"
echo "-----------------------------------"
echo "code --install-extension autoclaude-3.14.1.vsix"
echo ""

# Verification steps
echo "✅ Verification Steps:"
echo "======================"
echo "1. After installation, restart VS Code"
echo "2. Press Ctrl/Cmd+Shift+P"
echo "3. Type 'Claude' - you should see all 43 commands"
echo "4. Try 'Claude: 🚀 Start Claude Assistant'"
echo "5. Extension should activate without errors"
echo ""

# File info
echo "📊 Package Information:"
echo "======================="
ls -lh autoclaude-3.14.1.vsix
echo ""
echo "SHA256: $(shasum -a 256 autoclaude-3.14.1.vsix | cut -d' ' -f1)"
echo ""

# GitHub release command (manual)
echo "🚀 To create GitHub release manually:"
echo "======================================"
echo "1. Go to: https://github.com/r3e-network/AutoClaude/releases/new"
echo "2. Tag: v3.14.1"
echo "3. Title: v3.14.1 - Critical Fix: Command Not Found"
echo "4. Upload: autoclaude-3.14.1.vsix"
echo "5. Mark as latest release"
echo ""

# VS Code Marketplace
echo "📢 To publish to VS Code Marketplace:"
echo "======================================"
echo "npx @vscode/vsce publish"
echo "(Requires authentication token)"
echo ""

echo "✨ Release preparation complete!"