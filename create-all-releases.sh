#!/bin/bash

# Script to create GitHub releases for AutoClaude v3.17.0, v3.18.0, and v3.18.1
# Run this script to push all releases to GitHub

echo "Creating GitHub releases for AutoClaude v3.17.0, v3.18.0, and v3.18.1..."

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

# First, let's commit all changes
echo "Preparing to commit all changes..."
git add -A

# Create a comprehensive commit message
git commit -m "feat: intelligent production issue fixing system (v3.17.0-v3.18.1)

Major updates to automatic issue fixing:

v3.17.0: Initial automatic issue fixing with regex patterns
- Created IssueFixerAgent with pattern-based fixes
- Handles TODOs, hardcoded secrets, console.logs, placeholders
- Context-aware replacements for different languages

v3.18.0: Claude-powered intelligent issue resolution
- Refactored to use Claude via message queue
- Created ProductionIssueQueueManager
- Priority-based queueing system
- Batch processing for efficiency
- Full context sent to Claude for intelligent fixes

v3.18.1: Critical error fixes
- Fixed QueenAgent getAgentLoads method errors
- Added existence checks for optional methods
- Improved error resilience

All versions create production-ready code automatically.

Co-authored-by: Claude <claude@anthropic.com>" || echo "Changes already committed or no changes to commit"

# Push the commit
echo "Pushing to GitHub..."
git push origin main || echo "Already up to date or push failed"

# Function to create a release if it doesn't exist
create_release_if_not_exists() {
    local version=$1
    local title=$2
    local vsix_file=$3
    local notes_file=$4
    
    # Check if tag exists locally
    if git tag -l | grep -q "^${version}$"; then
        echo "Tag ${version} already exists locally"
    else
        echo "Creating tag ${version}..."
        git tag -a "${version}" -m "Release ${version} - ${title}"
    fi
    
    # Try to push the tag
    echo "Pushing tag ${version}..."
    git push origin "${version}" 2>/dev/null || echo "Tag ${version} already exists on remote or push failed"
    
    # Check if release exists
    if gh release view "${version}" &>/dev/null; then
        echo "Release ${version} already exists on GitHub"
    else
        echo "Creating GitHub release ${version}..."
        if [ -f "${vsix_file}" ] && [ -f "${notes_file}" ]; then
            gh release create "${version}" \
                --title "${title}" \
                --notes-file "${notes_file}" \
                "${vsix_file}"
            echo "✅ Release ${version} created successfully!"
        else
            echo "❌ Missing files for ${version}: ${vsix_file} or ${notes_file}"
        fi
    fi
    echo ""
}

# Create releases for each version
create_release_if_not_exists \
    "v3.17.0" \
    "AutoClaude v3.17.0 - Automatic Production Readiness Issue Fixing" \
    "autoclaude-3.17.0.vsix" \
    "GITHUB_RELEASE_v3.17.0.md"

create_release_if_not_exists \
    "v3.18.0" \
    "AutoClaude v3.18.0 - Claude-Powered Intelligent Issue Resolution" \
    "autoclaude-3.18.0.vsix" \
    "GITHUB_RELEASE_v3.18.0.md"

create_release_if_not_exists \
    "v3.18.1" \
    "AutoClaude v3.18.1 - Critical Error Fixes" \
    "autoclaude-3.18.1.vsix" \
    "GITHUB_RELEASE_v3.18.1.md"

echo "✅ All releases processed!"
echo ""
echo "View releases at: https://github.com/r3e-network/AutoClaude/releases"
echo ""
echo "Latest release: v3.18.1"