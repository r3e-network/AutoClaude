# NPM Publishing Setup

## Overview

The AutoClaude release workflow automatically publishes to npm when creating a release. This requires setting up an NPM authentication token as a GitHub secret.

## Setup Instructions

### 1. Create NPM Access Token

1. Log in to [npmjs.com](https://www.npmjs.com/)
2. Click on your profile picture → **Access Tokens**
3. Click **Generate New Token** → **Classic Token**
4. Select type: **Automation** (recommended for CI/CD)
5. Copy the token (starts with `npm_`)

### 2. Add Token to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click **Add secret**

## Package Configuration

Ensure your `package.json` has the correct configuration:

```json
{
  "name": "autoclaude",
  "version": "3.15.0",
  "description": "Automated Claude Code assistant with smart task completion",
  "main": "out/extension.js",
  "repository": {
    "type": "git",
    "url": "https://github.com/r3e-network/AutoClaude.git"
  },
  "keywords": [
    "vscode",
    "claude",
    "ai",
    "automation",
    "assistant"
  ],
  "author": "R3E Network",
  "license": "MIT",
  "publishConfig": {
    "access": "public"
  }
}
```

## Workflow Integration

The automated release workflow (`auto-release.yml`) includes:

1. **Build Extension** - Creates the VS Code .vsix file
2. **Publish to NPM** - Publishes the package to npm registry
3. **Create GitHub Release** - Creates release with .vsix attachment

## Manual Publishing

If you need to publish manually:

```bash
# Login to npm
npm login

# Update version
npm version 3.15.0

# Build the package
npm run compile:production

# Publish to npm
npm publish --access public
```

## Troubleshooting

### Token Issues
- Ensure the token has not expired
- Verify the token has publish permissions
- Check the secret name is exactly `NPM_TOKEN`

### Package Name Conflicts
- The package name must be unique on npm
- If taken, consider scoped packages: `@r3e-network/autoclaude`

### Build Failures
- Ensure all dependencies are listed in `package.json`
- Check that `main` field points to the correct entry file
- Verify the build script creates all necessary files

## Verification

After publishing, verify the package:

```bash
# View package info
npm view autoclaude

# Install and test
npm install -g autoclaude
autoclaude --version
```

## Security Notes

- **Never commit tokens** to the repository
- Use **Automation tokens** for CI/CD (they can't perform user actions)
- Rotate tokens regularly
- Review npm package access logs periodically

## Support

For issues with npm publishing:
1. Check the GitHub Actions logs
2. Verify npm registry status: https://status.npmjs.org/
3. Review npm documentation: https://docs.npmjs.com/