# AutoClaude Release Workflow Documentation

## 📋 Overview

AutoClaude uses multiple release mechanisms to ensure reliable and automated releases:

1. **Manual Release Script** (`create-release.sh`)
2. **GitHub Actions Workflows** (automated CI/CD)
3. **VS Code Marketplace Publishing** (vsce)

## 🔄 Release Methods

### Method 1: Manual Release (Recommended for Major Releases)

#### Prerequisites
- GitHub CLI (`gh`) installed
- Node.js 18+ installed
- Write access to the repository
- VS Code marketplace publisher account (optional)

#### Steps

1. **Update Version**
   ```bash
   # Edit package.json version
   npm version 3.20.0 --no-git-tag-version
   ```

2. **Update Documentation**
   - Update `CHANGELOG.md` with new version section
   - Create `RELEASE_NOTES.md` with user-friendly notes
   - Update `README.md` if needed

3. **Build and Test**
   ```bash
   npm run compile:production
   npm run test:production
   ./validate-production-final.sh
   ```

4. **Run Release Script**
   ```bash
   ./create-release.sh
   ```
   This script will:
   - Build the extension package
   - Create release artifacts
   - Commit changes
   - Create git tag
   - Push to GitHub
   - Create GitHub release with assets

### Method 2: Automated Release via Branch Push

#### Trigger Conditions
- Push to branch matching `release/v*` or `release-v*`
- Example: `release/v3.20.0`

#### Workflow Process (`auto-release.yml`)

1. **Version Detection**
   - Extracts version from branch name
   - Example: `release/v3.20.0` → version `3.20.0`

2. **Build Process**
   - Updates package.json version automatically
   - Installs dependencies with `npm ci`
   - Runs production build: `npm run compile:production`
   - Creates VSIX package: `vsce package --no-dependencies`

3. **Release Creation**
   - Creates git tag `v{version}`
   - Uploads VSIX file to GitHub release
   - Generates release notes (or uses existing file)

#### Release Notes File Detection
The workflow looks for release notes in these locations:
- `GITHUB_RELEASE_v{VERSION}.md`
- `RELEASE_v{VERSION}.md`
- `RELEASE-v{VERSION}.md`
- `release-notes-v{VERSION}.md`
- `release-notes/{VERSION}.md`
- `releases/v{VERSION}.md`

### Method 3: Tag-Based Release

#### Trigger
- Push a tag matching `v*` pattern
- Example: `git tag v3.20.0 && git push origin v3.20.0`

#### Workflow Process (`release.yml`)
1. Validates package.json version matches tag
2. Builds extension
3. Creates GitHub release with VSIX file

## 🏗️ Build System

### esbuild Configuration
- **Entry Point**: `src/extension.ts`
- **Output**: `out/extension.js`
- **Bundle Format**: CommonJS (required by VS Code)
- **External Modules**: `vscode`, `sqlite`, `sqlite3`
- **Production Mode**: Removes sourcemaps, keeps function names

### Post-Build Processing
The `post-build.js` script:
- Fixes CommonJS exports for VS Code compatibility
- Ensures `activate` and `deactivate` functions are properly exported
- Removes unnecessary esbuild annotations

### File Copying
During build, these files are copied:
- Python wrapper: `src/claude_pty_wrapper.py` → `out/claude/session/`
- Webview files: `src/webview/` → `out/webview/`

## 📦 Packaging

### VSIX Package Creation
```bash
npx @vscode/vsce package --no-dependencies
```

### Package Contents
Controlled by `.vscodeignore`:
- **Included**: Compiled JS, webview files, README, LICENSE, package.json
- **Excluded**: Source files, tests, node_modules, git files, development configs

### Package Size
- Target: < 1MB (currently ~853KB)
- Achieved through:
  - esbuild bundling
  - Excluding unnecessary files
  - No dependencies bundled

## 🚀 Publishing

### VS Code Marketplace
```bash
# Publish to marketplace (requires authentication)
npx @vscode/vsce publish

# Pre-release version
npx @vscode/vsce publish --pre-release
```

### GitHub Release
Assets uploaded:
- `autoclaude-{version}.vsix` - Main extension package
- `INSTALLATION.md` - Installation instructions
- Release notes in description

## 📋 Version Management

### Version Sources
1. **package.json** - Source of truth
2. **Git tags** - Release markers (`v{version}`)
3. **Branch names** - Auto-release triggers (`release/v{version}`)

### Version Validation
- GitHub Actions validate version consistency
- Package.json version must match tag/branch version
- Build fails if versions don't match

## 🔧 Configuration Files

### Key Files
- **package.json** - Extension metadata and scripts
- **esbuild.js** - Bundler configuration
- **post-build.js** - CommonJS export fixes
- **.vscodeignore** - Package exclusion rules
- **.github/workflows/** - CI/CD automation

### NPM Scripts
```json
{
  "compile": "node esbuild.js && node post-build.js",
  "compile:production": "node esbuild.js --production && node post-build.js",
  "package": "npx @vscode/vsce package --no-dependencies",
  "publish": "npx @vscode/vsce publish",
  "release": "npm run compile && npm run package"
}
```

## ✅ Release Checklist

### Pre-Release
- [ ] Update version in package.json
- [ ] Update CHANGELOG.md
- [ ] Create RELEASE_NOTES.md
- [ ] Run tests: `npm test`
- [ ] Run validation: `./validate-production-final.sh`
- [ ] Build package: `npm run package`
- [ ] Test VSIX locally

### Release
- [ ] Commit changes
- [ ] Create git tag
- [ ] Push to GitHub
- [ ] Verify GitHub Actions success
- [ ] Check GitHub release created
- [ ] Download and test VSIX from release

### Post-Release
- [ ] Publish to VS Code Marketplace (if applicable)
- [ ] Update documentation
- [ ] Announce release
- [ ] Monitor for issues

## 🚨 Troubleshooting

### Common Issues

1. **Version Mismatch**
   - Ensure package.json version matches tag
   - Use `npm version` to update consistently

2. **Build Failures**
   - Check Node.js version (requires 18+)
   - Run `npm ci` to ensure clean dependencies
   - Check for TypeScript errors

3. **GitHub Actions Failures**
   - Check workflow logs in Actions tab
   - Ensure branch/tag naming is correct
   - Verify permissions for GITHUB_TOKEN

4. **Package Too Large**
   - Review .vscodeignore
   - Check for accidentally included files
   - Run `vsce ls` to see package contents

## 📊 Release Metrics

### Current Status (v3.20.0)
- **Package Size**: 853KB
- **Build Time**: ~10 seconds
- **Dependencies**: 2 (sqlite, sqlite3)
- **Commands**: 74
- **Configuration Options**: 134

### Performance Targets
- Package size: < 1MB ✅
- Build time: < 30s ✅
- Installation time: < 5s ✅
- Activation time: < 1s ✅

## 🔗 Resources

- [VS Code Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce Documentation](https://github.com/microsoft/vscode-vsce)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)