# AutoClaude Release Process

## Overview

AutoClaude uses an automated release process triggered by creating release branches. When a branch matching the pattern `release/v*` or `release-v*` is created, GitHub Actions automatically builds and publishes the release.

## Release Workflow

### 1. Automatic Release (Recommended)

#### Step 1: Prepare the Release
```bash
# Run the release preparation script
./scripts/prepare-release.sh <version>

# Example:
./scripts/prepare-release.sh 3.15.0
```

This script will:
- Update package.json version
- Create a release notes template
- Create and push a release branch
- Trigger the automated workflow

#### Step 2: Edit Release Notes
Edit the generated release notes file (e.g., `GITHUB_RELEASE_v3.15.0.md`) with actual release information:
```bash
# Edit the release notes
code GITHUB_RELEASE_v3.15.0.md

# Commit changes
git add GITHUB_RELEASE_v3.15.0.md
git commit -m "docs: update release notes for v3.15.0"
git push
```

#### Step 3: Monitor the Workflow
The GitHub Actions workflow will automatically:
1. Build the VS Code extension (.vsix)
2. Build terminal binaries for all platforms:
   - Windows (x64)
   - macOS (x64, ARM64)
   - Linux (x64)
3. Create a GitHub release with all assets
4. Use your release notes if provided

Monitor progress at: https://github.com/r3e-network/AutoClaude/actions

#### Step 4: Post-Release
After successful release:
```bash
# Merge release branch to main
git checkout main
git pull origin main
git merge release/v3.15.0
git push origin main

# Delete release branch
git push origin --delete release/v3.15.0
git branch -d release/v3.15.0
```

### 2. Manual Release

If you need to create a release manually:

#### Using GitHub CLI
```bash
# Create tag
git tag -a v3.15.0 -m "Release v3.15.0"
git push origin v3.15.0

# Build extension locally
npm ci
npm run compile
vsce package --no-dependencies

# Create release with assets
gh release create v3.15.0 \
  --title "AutoClaude v3.15.0" \
  --notes-file GITHUB_RELEASE_v3.15.0.md \
  autoclaude-3.15.0.vsix
```

#### Using GitHub Web UI
1. Go to https://github.com/r3e-network/AutoClaude/releases
2. Click "Draft a new release"
3. Create a new tag (e.g., v3.15.0)
4. Upload the .vsix file and binaries
5. Paste release notes
6. Publish release

## Release Notes Format

Release notes should follow this structure:

```markdown
# AutoClaude v<VERSION>

## 🎉 Release Highlights
Brief summary of major changes

## ✨ New Features
- Feature 1
- Feature 2

## 🐛 Bug Fixes
- Fixed issue with...

## 💫 Improvements
- Improved performance of...

## 📦 Installation
[Installation instructions]

## 📝 What's Changed
Full changelog link
```

## Version Numbering

AutoClaude follows Semantic Versioning (SemVer):
- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes, backward compatible

Examples:
- `3.14.0` → `3.15.0` (new features)
- `3.14.0` → `3.14.1` (bug fixes)
- `3.14.0` → `4.0.0` (breaking changes)

## Supported Release Notes Locations

The workflow looks for release notes in these locations:
- `RELEASE_v<VERSION>.md`
- `RELEASE-v<VERSION>.md`
- `GITHUB_RELEASE_v<VERSION>.md`
- `release-notes-v<VERSION>.md`
- `release-notes/<VERSION>.md`
- `releases/v<VERSION>.md`

## Platform Binaries

The workflow builds binaries for:
- **Windows**: `autoclaude-win32-x64.zip`
- **macOS Intel**: `autoclaude-darwin-x64.tar.gz`
- **macOS Apple Silicon**: `autoclaude-darwin-arm64.tar.gz`
- **Linux**: `autoclaude-linux-x64.tar.gz`

## Troubleshooting

### Workflow Not Triggering
- Ensure branch name matches pattern: `release/v*` or `release-v*`
- Check GitHub Actions is enabled for the repository
- Verify you have push permissions

### Build Failures
- Check package.json version matches release version
- Ensure all dependencies are properly declared
- Review workflow logs for specific errors

### Asset Upload Issues
- Verify GitHub token has appropriate permissions
- Check file sizes (GitHub has limits)
- Ensure unique filenames for assets

## Best Practices

1. **Always test locally first**
   ```bash
   npm ci
   npm run compile
   npm test
   vsce package --no-dependencies
   ```

2. **Update CHANGELOG.md**
   Keep a running changelog of all changes

3. **Create detailed release notes**
   Users rely on release notes to understand changes

4. **Test the released assets**
   Download and test the .vsix file after release

5. **Announce major releases**
   Consider announcing major releases on relevant channels

## GitHub Actions Workflow

The automated workflow (`auto-release.yml`) handles:
1. Version extraction from branch name
2. Package.json version update
3. VS Code extension build
4. Terminal binary builds (multi-platform)
5. GitHub release creation
6. Asset uploads
7. Release notes integration

## Security Notes

- Never commit sensitive information in release notes
- Ensure binaries are built from clean sources
- Use GitHub's built-in security scanning
- Sign releases when possible

## Support

For issues with the release process:
1. Check workflow logs
2. Review this documentation
3. Open an issue at: https://github.com/r3e-network/AutoClaude/issues
