# Backend Auth0 Configuration Diagnostic

## Current Configuration

### ✅ What's Working

1. **Auth0 Audience**: `https://api.betthink.com` ✅
   - This matches your frontend configuration
   - Location: Container env var `AUTH0_AUDIENCE`

2. **CORS Headers**: Working ✅
   - `Access-Control-Allow-Credentials: true` is being sent
   - Authorization header is allowed (configured in main.ts line 31)
   - CORS origins are configurable via `CORS_ORIGINS` env var

3. **JWT Strategy**: Properly configured ✅
   - Using `passport-jwt` with JWKS validation
   - Extracting token from `Authorization: Bearer` header
   - Using RS256 algorithm
   - Fetching public keys from Auth0's JWKS endpoint

4. **Route Registration**: Working ✅
   - `POST /api/v1/chat/conversations` is registered
   - JWT guard is applied to the ChatController

---

## ❌ CRITICAL ISSUE FOUND

### Auth0 Issuer Format

**Current Value**: `dev-us8cq3deo7cm4b5h.us.auth0.com`

**Expected Value**: `https://dev-us8cq3deo7cm4b5h.us.auth0.com/`

**Problem**: The issuer MUST be a full URL with:
- `https://` protocol prefix
- Trailing `/` (required by Auth0)

This is causing the JWT validation to fail because:
1. The `iss` claim in your frontend tokens is: `https://dev-us8cq3deo7cm4b5h.us.auth0.com/`
2. The backend is checking for: `dev-us8cq3deo7cm4b5h.us.auth0.com`
3. They don't match → 401 Unauthorized

---

## 🔧 How to Fix

### Option 1: Update Environment Variable (Recommended)

Update your `.env` file or docker-compose environment:

```bash
# WRONG ❌
AUTH0_ISSUER=dev-us8cq3deo7cm4b5h.us.auth0.com

# CORRECT ✅
AUTH0_ISSUER=https://dev-us8cq3deo7cm4b5h.us.auth0.com/
```

Then rebuild the container:
```bash
docker-compose up -d --build api
```

---

## 📋 Configuration Checklist

### Backend Auth0 Setup
- [x] Auth0 domain configured: `dev-us8cq3deo7cm4b5h.us.auth0.com`
- [x] Auth0 audience configured: `https://api.betthink.com`
- [ ] **Auth0 issuer configured correctly** (needs fix)
- [x] JWT validation middleware properly set up
- [x] Middleware applied to protected routes

### Token Validation
- [x] Reading `Authorization: Bearer <token>` header
- [x] Validating JWT signature against Auth0's public keys
- [ ] **Checking audience claim matches** (will work after issuer fix)
- [x] Checking token expiration

### CORS Headers
- [x] `Access-Control-Allow-Headers` includes `Authorization, Content-Type`
- [x] `Access-Control-Allow-Credentials: true` enabled
- [x] CORS origins configurable

---

## 🧪 Testing After Fix

1. Get a valid token from your frontend
2. Test with curl:
```bash
curl -X POST http://localhost:3000/api/v1/chat/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACTUAL_TOKEN" \
  -d '{"title": "Test Conversation"}'
```

3. Expected responses:
   - **Before fix**: 401 Unauthorized
   - **After fix**: 201 Created (or appropriate response)

---

## 📝 Additional Notes

### Frontend Token Configuration
Your frontend is correctly configured with:
- audience: `https://api.betthink.com`
- This will work once the backend issuer is fixed

### Debug Mode
The backend is running with `LOG_LEVEL: debug`, so you'll see detailed logs about JWT validation failures in:
```bash
docker logs bt_api
```

Look for logs from `Auth0Strategy` with validation errors.

