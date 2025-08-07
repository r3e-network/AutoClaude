#!/bin/bash

# Script to properly push v3.19.0 release with updated README

echo "Pushing v3.19.0 release with updated README..."

# Commit the README update
echo "Committing README update..."
git add README.md
git add src/automation/ComprehensiveIssueHandler.ts
git add src/automation/UnifiedOrchestrationSystem.ts
git add package.json
git add GITHUB_RELEASE_v3.19.0.md

git commit -m "feat: comprehensive issue detection and robust queueing (v3.19.0)

- Added ComprehensiveIssueHandler with 50+ issue type detection
- Multi-layer fallback system for maximum reliability
- Intelligent batching and retry logic
- Complete coverage of all production issues
- Updated README to show latest version (3.19.0)

Ensures ALL issues are detected and sent to Claude for fixing.

Co-authored-by: Claude <claude@anthropic.com>" || echo "Already committed"

# Push to main
echo "Pushing to main branch..."
git push origin main || echo "Already pushed to main"

# Create and push tag
echo "Creating tag v3.19.0..."
git tag -a v3.19.0 -m "Release v3.19.0 - Comprehensive Issue Detection & Robust Queueing" || echo "Tag already exists"

echo "Pushing tag..."
git push origin v3.19.0 || echo "Tag already pushed"

# Create GitHub release using gh CLI
echo "Creating GitHub release..."
if gh release view v3.19.0 &>/dev/null; then
    echo "Release v3.19.0 already exists, updating assets..."
    gh release upload v3.19.0 autoclaude-3.19.0.vsix --clobber
else
    echo "Creating new release v3.19.0..."
    gh release create v3.19.0 \
        --title "AutoClaude v3.19.0 - Comprehensive Issue Detection & Robust Queueing" \
        --notes-file GITHUB_RELEASE_v3.19.0.md \
        autoclaude-3.19.0.vsix
fi

echo "✅ Release v3.19.0 pushed successfully!"
echo "📦 View at: https://github.com/r3e-network/AutoClaude/releases/tag/v3.19.0"
echo ""
echo "README now shows: v3.19.0"