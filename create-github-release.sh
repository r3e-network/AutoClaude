#!/bin/bash

# AutoClaude GitHub Release Creator
# This script helps create a GitHub release for v3.14.1

echo "================================================"
echo "     AutoClaude v3.14.1 GitHub Release Tool     "
echo "================================================"
echo ""

# Check if files exist
if [ ! -f "autoclaude-3.14.1.vsix" ]; then
    echo "❌ Error: autoclaude-3.14.1.vsix not found!"
    exit 1
fi

if [ ! -f "GITHUB_RELEASE_v3.14.1.md" ]; then
    echo "❌ Error: GITHUB_RELEASE_v3.14.1.md not found!"
    exit 1
fi

echo "✅ Files found:"
echo "  • autoclaude-3.14.1.vsix ($(ls -lh autoclaude-3.14.1.vsix | awk '{print $5}'))"
echo "  • GITHUB_RELEASE_v3.14.1.md"
echo ""

# Try gh CLI first
if command -v gh &> /dev/null; then
    echo "📦 Attempting to create release with GitHub CLI..."
    echo ""
    
    # Check authentication
    if gh auth status &> /dev/null; then
        echo "Creating release..."
        gh release create v3.14.1 \
            --title "v3.14.1 - Critical Fix: Command Not Found" \
            --notes-file GITHUB_RELEASE_v3.14.1.md \
            --latest \
            autoclaude-3.14.1.vsix
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Release created successfully!"
            echo "View at: https://github.com/r3e-network/AutoClaude/releases/tag/v3.14.1"
            exit 0
        else
            echo "❌ Failed to create release with gh CLI"
        fi
    else
        echo "⚠️  GitHub CLI not authenticated"
        echo "Run: gh auth login"
        echo ""
    fi
fi

# Fallback to manual instructions
echo "📋 MANUAL RELEASE INSTRUCTIONS:"
echo "================================"
echo ""
echo "Since automated release creation failed, please follow these steps:"
echo ""
echo "1. Open your browser and go to:"
echo "   https://github.com/r3e-network/AutoClaude/releases/new"
echo ""
echo "2. Fill in the form:"
echo "   • Choose a tag: v3.14.1 (select existing tag)"
echo "   • Release title: v3.14.1 - Critical Fix: Command Not Found"
echo "   • Description: Copy contents from GITHUB_RELEASE_v3.14.1.md"
echo ""
echo "3. Attach the file:"
echo "   • Drag and drop: $(pwd)/autoclaude-3.14.1.vsix"
echo ""
echo "4. Options:"
echo "   • ✅ Set as the latest release"
echo ""
echo "5. Click: Publish release"
echo ""
echo "================================================"
echo ""

# Try to open browser
if command -v open &> /dev/null; then
    echo "Would you like to open the GitHub releases page now? (y/n)"
    read -r response
    if [[ "$response" == "y" || "$response" == "Y" ]]; then
        open "https://github.com/r3e-network/AutoClaude/releases/new?tag=v3.14.1"
        echo "✅ Opened GitHub releases page in your browser"
    fi
elif command -v xdg-open &> /dev/null; then
    echo "Would you like to open the GitHub releases page now? (y/n)"
    read -r response
    if [[ "$response" == "y" || "$response" == "Y" ]]; then
        xdg-open "https://github.com/r3e-network/AutoClaude/releases/new?tag=v3.14.1"
        echo "✅ Opened GitHub releases page in your browser"
    fi
fi

echo ""
echo "📦 Files ready for upload:"
echo "  • $(pwd)/autoclaude-3.14.1.vsix"
echo "  • $(pwd)/GITHUB_RELEASE_v3.14.1.md (copy contents)"
echo ""
echo "Good luck with the release! 🚀"