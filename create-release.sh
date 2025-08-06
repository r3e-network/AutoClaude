#\!/bin/bash

# GitHub API endpoint
API_URL="https://api.github.com/repos/r3e-network/AutoClaude/releases"

# Read the release notes
BODY=$(cat RELEASE_NOTES_v3.11.0.md | sed 's/"/\\"/g' | sed ':a;N;$\!ba;s/\n/\\n/g')

# Create the JSON payload
cat > release.json << EOJSON
{
  "tag_name": "v3.11.0",
  "target_commitish": "main",
  "name": "v3.11.0 - Production Readiness Release",
  "body": "$BODY",
  "draft": false,
  "prerelease": false
}
EOJSON

echo "Release JSON created. To publish:"
echo "1. Go to https://github.com/r3e-network/AutoClaude/releases/new"
echo "2. Select tag: v3.11.0"
echo "3. Use the content from RELEASE_NOTES_v3.11.0.md"
echo "4. Attach autoclaude-3.11.0.vsix file"
