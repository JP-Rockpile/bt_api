#!/bin/bash

# Script to update package-lock.json with GitHub Packages authentication
# This fixes the CI error where lock file version doesn't match package.json

echo "==========================================="
echo "GitHub Packages Lock File Update Script"
echo "==========================================="
echo ""

# Check if NODE_AUTH_TOKEN is set
if [ -z "$NODE_AUTH_TOKEN" ]; then
    echo "❌ ERROR: NODE_AUTH_TOKEN environment variable is not set"
    echo ""
    echo "To fix this, you need a GitHub Personal Access Token with 'read:packages' permission."
    echo ""
    echo "Steps:"
    echo "1. Go to: https://github.com/settings/tokens/new"
    echo "2. Create a token with 'read:packages' scope"
    echo "3. Run this script with the token:"
    echo ""
    echo "   export NODE_AUTH_TOKEN=your_token_here"
    echo "   ./update-lockfile.sh"
    echo ""
    echo "Or run it in one line:"
    echo ""
    echo "   NODE_AUTH_TOKEN=your_token_here ./update-lockfile.sh"
    echo ""
    exit 1
fi

echo "✓ NODE_AUTH_TOKEN is set"
echo ""
echo "Updating package-lock.json..."
echo ""

# Run npm install to update the lock file
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "==========================================="
    echo "✅ SUCCESS!"
    echo "==========================================="
    echo ""
    echo "Your package-lock.json has been updated."
    echo ""
    echo "Next steps:"
    echo "1. Review the changes: git diff package-lock.json"
    echo "2. Commit the changes: git add package-lock.json && git commit -m 'chore: update package-lock.json to @betthink/shared@0.2.0'"
    echo "3. Push to GitHub: git push"
    echo ""
    echo "Your CI pipeline should now work! 🎉"
else
    echo ""
    echo "==========================================="
    echo "❌ FAILED"
    echo "==========================================="
    echo ""
    echo "npm install failed. Check the error above."
    echo ""
    echo "Common issues:"
    echo "- Token doesn't have 'read:packages' permission"
    echo "- Token has expired"
    echo "- Package @jp-rockpile/shared@0.2.0 is not published to GitHub Packages"
    echo ""
    exit 1
fi

