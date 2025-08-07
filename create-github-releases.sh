#!/bin/bash

# Script to create GitHub releases for AutoClaude
# This creates releases for v3.18.0 and v3.18.1

echo "Creating GitHub releases for AutoClaude..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is not installed. Please install it first:"
    echo "brew install gh"
    exit 1
fi

# Check if we're in the right repository
if ! git remote -v | grep -q "AutoClaude"; then
    echo "Error: Not in AutoClaude repository"
    exit 1
fi

# First, let's commit the changes
echo "Committing changes..."
git add -A
git commit -m "feat: add intelligent Claude-powered issue fixing via message queue (v3.18.0-v3.18.1)

- v3.18.0: Refactored automatic issue fixing to use Claude via message queue
  - Created ProductionIssueQueueManager for intelligent issue processing
  - Messages sent to Claude with full context for each issue type
  - Priority-based queueing (critical=10, error=7, warning=5)
  - Batch processing to prevent queue overflow
  
- v3.18.1: Fixed critical errors
  - Fixed QueenAgent getAgentLoads method not found error
  - Added proper existence checks for optional AgentCoordinator methods
  - Improved error resilience and graceful degradation

Co-authored-by: Claude <claude@anthropic.com>"

# Push the commit
echo "Pushing to GitHub..."
git push origin main

# Create git tags
echo "Creating git tags..."
git tag -a v3.18.0 -m "Release v3.18.0 - Claude-Powered Intelligent Issue Resolution"
git tag -a v3.18.1 -m "Release v3.18.1 - Critical Error Fixes"

# Push tags
echo "Pushing tags..."
git push origin v3.18.0
git push origin v3.18.1

# Create GitHub release for v3.18.0
echo "Creating GitHub release v3.18.0..."
gh release create v3.18.0 \
    --title "AutoClaude v3.18.0 - Claude-Powered Intelligent Issue Resolution" \
    --notes-file GITHUB_RELEASE_v3.18.0.md \
    autoclaude-3.18.0.vsix

# Create GitHub release for v3.18.1
echo "Creating GitHub release v3.18.1..."
gh release create v3.18.1 \
    --title "AutoClaude v3.18.1 - Critical Error Fixes" \
    --notes-file GITHUB_RELEASE_v3.18.1.md \
    autoclaude-3.18.1.vsix

echo "✅ GitHub releases created successfully!"
echo ""
echo "View releases at: https://github.com/r3e-network/AutoClaude/releases"
echo ""
echo "Release URLs:"
echo "- v3.18.0: https://github.com/r3e-network/AutoClaude/releases/tag/v3.18.0"
echo "- v3.18.1: https://github.com/r3e-network/AutoClaude/releases/tag/v3.18.1"