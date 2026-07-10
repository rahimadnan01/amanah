# Admin Backend System - Setup & Troubleshooting Guide

## 🔐 Environment Variables

### Required Variables (Add to `.env.local`)

```env
# JWT Configuration - MUST be set in production
JWT_SECRET=your-very-secure-secret-key-min-32-chars

# Optional: Node Environment
NODE_ENV=development  # or production
```

### Critical Issues to Fix

#### 1. ✅ Cookie Secure Flag Issue (Development)

In **development**, the `secure` flag is set to `false` but needs adjustment. The cookie settings in `src/lib/auth.ts` are:

```typescript
secure: isProduction,  // This is false in development - correct!
```

However, ensure your `.env.local` has:

```env
NODE_ENV=development
JWT_SECRET=dev-secret-key-change-in-production-32chars
```

#### 2. 🔍 Debugging Flow After Login

After successful login, the login page does:

```typescript
router.push("/dashboard"); // This redirects to dashboard
```

**The middleware should allow this** because:

- A valid `admin_session` cookie is set with the JWT token
- The middleware checks the cookie and validates the token
- If valid, it allows access to `/dashboard`

#### 3. ⚠️ Potential Problems & Solutions

**Problem: Login successful but page doesn't navigate to dashboard**

**Solution A: Check Browser Console**

- Open DevTools (F12) → Console tab
- Look for errors like:
  - "Failed to fetch user" → API issue
  - CORS errors → Not applicable (same origin)
  - Network errors → Check `/api/auth/me`

**Solution B: Verify Session Creation**
The login flow:

1. ✅ POST `/api/auth/login` → Creates session in DB, sets cookie
2. ✅ Cookie `admin_session` is set with JWT token
3. ✅ Frontend calls `router.push('/dashboard')`
4. ✅ Middleware validates token from cookie
5. ✅ Dashboard page loads and calls `GET /api/auth/me`
6. ✅ User data displays

**Solution C: Check Network Tab**

- Look for the `/api/auth/login` response
- Check if `Set-Cookie` header is present with `admin_session`
- Verify the cookie is stored in Application → Cookies

**Solution D: Database Issue**

- Check if `db.json` file exists in project root
- Verify sessions are being saved properly
- The DB is file-based (JSON file), not a remote database

#### 4. 📋 Recommended `.env.local` for Development

```env
# JWT Secret - Use a strong random string in production
JWT_SECRET=super-secret-jwt-key-minimum-32-characters-long

# Node environment
NODE_ENV=development
```

#### 5. 📋 Recommended `.env.production` (for deployment)

```env
# MUST use strong, unique secret in production
JWT_SECRET=your-production-secret-key-generate-new-random-string

# Security settings
NODE_ENV=production

# Optional: Database path (if you want to customize)
# DATABASE_PATH=/var/lib/admin-panel/db.json
```

## 🚀 What's Happening Behind the Scenes

### Login Process

1. User enters email/password on `/login`
2. Frontend sends POST to `/api/auth/login`
3. Backend validates credentials
4. If MFA enabled → returns `{ requiresMFA: true }` without creating session
5. User enters MFA code
6. Frontend sends POST again with `mfaCode`
7. Backend verifies MFA, creates session, returns `{ success: true }`
8. **Cookie `admin_session` is set** with signed JWT
9. Frontend does `router.push('/dashboard')`

### Middleware Validation

1. Browser makes request to `/dashboard`
2. Middleware extracts `admin_session` cookie
3. Middleware verifies JWT signature using `JWT_SECRET`
4. If invalid → redirects to `/login`
5. If valid → continues to dashboard page

### Dashboard Page

1. Dashboard component mounts
2. Calls `GET /api/auth/me`
3. This endpoint uses `requireAuth()` middleware
4. `requireAuth()` validates the session token
5. Returns user data (email, name, role, permissions, etc.)
6. Dashboard renders with user info

## ✅ Testing Checklist

- [ ] `.env.local` has `JWT_SECRET` set
- [ ] Can login with valid credentials
- [ ] After login, cookie `admin_session` appears in DevTools → Application → Cookies
- [ ] Cookie value is a long JWT string (three parts separated by dots)
- [ ] Dashboard page loads (shows "Loading..." initially)
- [ ] User information displays on dashboard
- [ ] MFA code redirects to `/dashboard` after successful verification
- [ ] Logout clears the `admin_session` cookie
- [ ] Cannot access `/dashboard` without valid session

## 🔧 If Navigation Still Fails

**Check 1: Is the cookie being set?**

```bash
# In browser console
console.log(document.cookie)
# Should show: admin_session=eyJ...
```

**Check 2: Does the session exist in database?**
The app stores sessions in `db.json` in the project root. The file should contain:

```json
{
  "adminSessions": [
    {
      "id": "ses_...",
      "token": "eyJ...",
      "adminUserId": "user_...",
      "createdAt": "2024-...",
      ...
    }
  ]
}
```

**Check 3: Clear cache and restart**

```bash
# Clear Next.js cache
rm -rf .next

# Restart dev server
npm run dev
```

## 📝 Production Deployment Notes

1. **Change `JWT_SECRET`**: Generate a strong random string (min 32 chars)
2. **Set `NODE_ENV=production`**: Enables secure cookies over HTTPS
3. **Database**: Consider migrating from JSON file to PostgreSQL/MongoDB
4. **HTTPS**: Required for secure cookies in production
5. **CSP Headers**: Configure Content Security Policy in `next.config.js`
6. **Rate Limiting**: Add rate limiting to `/api/auth/login`
7. **CORS**: Already properly configured (same-origin requests only)
