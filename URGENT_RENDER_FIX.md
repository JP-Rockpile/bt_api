# ⚠️ URGENT: Render Environment Variable Fix

## The Problem

Your API endpoints are showing as `/api/vv1/...` instead of `/api/v1/...` because of a configuration error.

**Root Cause**: The `API_VERSION` environment variable is set to `v1`, but NestJS automatically adds the `v` prefix, resulting in double `v` → `vv1`.

## The Fix (Takes 2 minutes)

### Step 1: Go to Render Dashboard
1. Open https://dashboard.render.com/
2. Find your `bt-api` service
3. Click on it

### Step 2: Update Environment Variable
1. Go to the **"Environment"** tab (left sidebar)
2. Find the variable: `API_VERSION`
3. Change its value from `v1` to `1` (remove the `v`)
4. Click **"Save Changes"**

### Step 3: Wait for Redeploy
- Render will automatically redeploy your service
- This takes ~3-5 minutes
- Watch the "Events" tab for progress

## Verification

After the redeploy completes, test these endpoints:

### ✅ Correct URLs (after fix):
```bash
# Health check
curl https://your-app.onrender.com/api/v1/health

# Chat conversations
GET /api/v1/chat/conversations

# Events
GET /api/v1/events/upcoming
```

### ❌ Old URLs (before fix):
```
/api/vv1/health       ← Wrong!
/api/vv1/chat/...     ← Wrong!
```

## Current Status

- ✅ **Local Development**: Fixed! Running on http://localhost:3000/api/v1
- ✅ **Database**: Initialized with proper schema
- ✅ **Code**: Pushed to GitHub  (commit 43c9690)
- ⏳ **Render Deployment**: In progress
- ⚠️  **Render Config**: Needs environment variable fix

## Testing Your Local Server

Your local server is now running correctly:

```bash
# Health check (working!)
curl http://localhost:3000/api/v1/health

# API docs
open http://localhost:3000/api/docs

# All endpoints now use /api/v1/...
```

## Important Notes

1. **This affects ALL your API endpoints** - they're all under `/api/vv1/` instead of `/api/v1/`
2. **Your mobile app** might be calling the wrong URLs
3. **After the fix**, your app should work correctly

## What Happens Next

1. Current Render deployment will complete (with wrong URLs still)
2. You update the environment variable in Render
3. Render automatically redeploys (takes 3-5 minutes)
4. All endpoints will be accessible at `/api/v1/...`
5. Your chat functionality will work! 🎉

## Mobile App Integration

If your mobile app has hardcoded URLs, make sure they use:
- ✅ `https://your-app.onrender.com/api/v1/...`
- ❌ Not `https://your-app.onrender.com/api/vv1/...`

## Summary

**Local Server**: ✅ Working perfectly  
**Production Fix**: ⏳ Waiting for you to update `API_VERSION` in Render dashboard

---

**Priority**: HIGH  
**Time to Fix**: 2 minutes  
**Impact**: Fixes all API endpoints

