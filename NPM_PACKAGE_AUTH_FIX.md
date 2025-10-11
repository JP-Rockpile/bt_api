# NPM Package Authentication Fix

## Problem
The `@jp-rockpile/shared` package installation was failing in CI because:
1. The GitHub token was hardcoded in `.npmrc` (security risk)
2. CI environments don't have access to the local `.npmrc` file

## What Was Fixed
- ✅ Updated `.npmrc` to use environment variable `${NODE_AUTH_TOKEN}`
- ✅ Created `.npmrc.example` as a template for developers
- ✅ Verified the token was never committed to git (no security breach)

## How to Fix CI/CD

### GitHub Actions (Personal Account Setup)

**Since you're using a personal account (not an organization), you MUST use a Personal Access Token:**

1. **Create a Personal Access Token:**
   - The account owner who published `@jp-rockpile/shared` needs to create the PAT
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Name it (e.g., "Package Registry Read Access")
   - Select scopes:
     - ✅ `read:packages` (required)
     - ✅ `repo` (only if the shared package repo is private)
   - Generate and copy the token

2. **Add Token as Repository Secret:**
   - In your bt_api repository: Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `GH_PACKAGES_TOKEN`
   - Value: Paste the PAT from step 1
   - Save

3. **The CI workflow has been updated** with this configuration:
   ```yaml
   - name: Configure npm for GitHub Packages
     run: |
       echo "@jp-rockpile:registry=https://npm.pkg.github.com" > .npmrc
       echo "//npm.pkg.github.com/:_authToken=${{ secrets.GH_PACKAGES_TOKEN }}" >> .npmrc
   
   - name: Install dependencies
     run: npm ci
   ```

**Note:** The automatic `GITHUB_TOKEN` does NOT work for personal account packages!

### Other CI Platforms (Render, CircleCI, etc.)
Set an environment variable:
- **Name**: `NODE_AUTH_TOKEN`
- **Value**: Your GitHub Personal Access Token with `read:packages` scope

## Local Development Setup

1. Copy the example file:
   ```bash
   cp .npmrc.example .npmrc
   ```

2. Edit `.npmrc` and replace `${NODE_AUTH_TOKEN}` with your actual GitHub token

3. Or set the environment variable:
   ```bash
   export NODE_AUTH_TOKEN=ghp_your_token_here
   npm ci
   ```

## Creating a GitHub Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes:
   - ✅ `read:packages`
   - ✅ `repo` (if the package is in a private repo)
4. Generate and copy the token
5. **Never commit this token to git!**

## Security Notes
- ✅ `.npmrc` is in `.gitignore` - safe to use locally
- ✅ Never commit tokens to git
- ✅ Use environment variables or CI secrets for automation
- ✅ Rotate tokens if accidentally exposed

