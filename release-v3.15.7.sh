#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting release process for v3.15.7..."

# Compile and package
echo "📦 Building extension..."
npm run compile:production

echo "📦 Creating VSIX package..."
npm run package

# Create git tag
echo "🏷️ Creating git tag..."
git tag -a v3.15.7 -m "Release v3.15.7: Complete Memory System Graceful Degradation"

# Push to remote
echo "📤 Pushing tag to remote..."
git push r3e v3.15.7

echo "✅ Release v3.15.7 completed successfully!"
echo "🎉 The GitHub Actions workflow will now create the release automatically."