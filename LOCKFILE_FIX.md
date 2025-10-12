# Fixing the package-lock.json Sync Error

## The Problem

Your GitHub Actions CI is failing with:
```
Invalid: lock file's @betthink/shared@0.1.0 does not satisfy @betthink/shared@0.2.0
```

This happens because:
- `package.json` specifies: `@betthink/shared@^0.2.0` (from GitHub Packages)
- `package-lock.json` has: `@betthink/shared@0.1.0` (from old local file path)

## The Solution

You need to update `package-lock.json` by running `npm install` with GitHub Packages authentication.

### Quick Fix (Choose One Method)

#### Method 1: Using the Helper Script (Recommended)

1. **Get a GitHub Personal Access Token:**
   - Go to: https://github.com/settings/tokens/new
   - Token name: `npm-packages-read`
   - Expiration: Choose your preference (e.g., 90 days)
   - Scopes: Check **`read:packages`** only
   - Click "Generate token"
   - **Copy the token immediately** (you won't see it again!)

2. **Run the update script:**
   ```bash
   NODE_AUTH_TOKEN=your_token_here ./update-lockfile.sh
   ```

3. **Commit and push:**
   ```bash
   git add package-lock.json
   git commit -m "chore: update package-lock.json to @betthink/shared@0.2.0"
   git push
   ```

#### Method 2: Manual Steps

1. Get a GitHub token (same as Method 1, step 1)

2. Set the token and run install:
   ```bash
   export NODE_AUTH_TOKEN=your_token_here
   npm install
   ```

3. Commit and push (same as Method 1, step 3)

## Verifying the Fix

After updating, you can verify the lock file is correct:

```bash
# Should show @jp-rockpile/shared version 0.2.0
grep -A 5 '"@betthink/shared"' package-lock.json
```

## Why This Works

- Your CI workflow (`.github/workflows/ci.yml`) already has authentication configured
- It uses the `GH_PACKAGES_TOKEN` secret from your repository
- Once the lock file is updated locally and pushed, CI will use that lock file
- CI will successfully authenticate and install from GitHub Packages

## Troubleshooting

### "401 Unauthorized" Error
- Your token doesn't have `read:packages` permission
- Token may have expired
- Make sure you're using a Personal Access Token (classic), not a fine-grained token

### Package Not Found
- Verify `@jp-rockpile/shared@0.2.0` is published to GitHub Packages
- Check: https://github.com/orgs/jp-rockpile/packages

### Still Getting Sync Error After Update
- Make sure you committed the updated `package-lock.json`
- Verify the lock file was actually updated: `git diff package-lock.json`
- Delete `node_modules` and try again: `rm -rf node_modules && npm install`

## Security Note

🔒 **Never commit tokens to your repository!** The token is only needed locally to run `npm install`. GitHub Actions uses repository secrets for authentication.

