# Strava OAuth Redirect Fix ✅

## Problem

The Strava OAuth callback was going to the Supabase edge function URL, but **not redirecting back to nutrisync.id** after authentication.

## Solution

Updated the OAuth flow to properly redirect users back to your domain after Strava authentication.

---

## How It Works Now

### Complete OAuth Flow:

```
1. User on nutrisync.id
   Clicks "Connect with Strava"
   ↓
2. App redirects to Strava
   https://www.strava.com/oauth/authorize?
     client_id=179720&
     redirect_uri=https://eecdbddpzwedficnpenm.supabase.co/functions/v1/strava-auth&
     state=<user_access_token>&
     scope=read,activity:read_all
   ↓
3. User authorizes on Strava
   ↓
4. Strava redirects to Supabase Edge Function
   https://eecdbddpzwedficnpenm.supabase.co/functions/v1/strava-auth?
     code=XXX&
     scope=YYY&
     state=<user_access_token>
   ↓
5. Edge function processes:
   - Extracts user token from state parameter
   - Exchanges code for Strava access/refresh tokens
   - Stores tokens in strava_tokens table
   ↓
6. Edge function redirects BACK to nutrisync.id ⭐ NEW!
   https://nutrisync.id/profile/integrations?strava_connected=true
   ↓
7. App shows success toast
   "Strava Connected! Your Strava account has been successfully connected!"
```

---

## Changes Made

### 1. Edge Function (strava-auth/index.ts) ✅

**Before:** Returned JSON response
```typescript
return new Response(JSON.stringify({ success: true, ... }), { ... });
```

**After:** Redirects to nutrisync.id
```typescript
return new Response(null, {
  status: 302,
  headers: {
    Location: `${APP_URL}/profile/integrations?strava_connected=true`
  }
});
```

**All responses now redirect:**
- ✅ Success: `?strava_connected=true`
- ❌ Error: `?strava_error=token_exchange_failed`
- ❌ Error: `?strava_error=missing_code`
- ❌ Error: `?strava_error=invalid_user`
- ❌ Error: `?strava_error=database_error`
- ❌ Error: `?strava_error=internal_error`

### 2. Frontend Hook (useStravaAuth.ts) ✅

**Updated OAuth initiation:**
```typescript
// Use Supabase edge function as redirect URI
const redirectUri = `${supabaseUrl}/functions/v1/strava-auth`;

// Pass user's access token in state for authentication
const { data: { session } } = await supabase.auth.getSession();
const state = session.access_token;

// Redirect to Strava OAuth
window.location.href = authUrl;
```

### 3. App Integrations Page ✅

**Added callback handler:**
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  
  // Success
  if (params.get('strava_connected') === 'true') {
    toast({ title: 'Strava Connected', ... });
    checkConnectionStatus();
    window.history.replaceState({}, '', window.location.pathname);
  }
  
  // Error
  if (params.get('strava_error')) {
    toast({ 
      title: 'Connection Failed', 
      description: stravaError,
      variant: 'destructive' 
    });
    window.history.replaceState({}, '', window.location.pathname);
  }
}, []);
```

### 4. Environment Variables ✅

**Added to .env:**
```bash
APP_URL="https://nutrisync.id"
```

This is used by the edge function to know where to redirect users.

---

## Strava App Configuration

Update your Strava app settings at: https://www.strava.com/settings/api

**Authorization Callback Domain:**
```
https://eecdbddpzwedficnpenm.supabase.co/functions/v1/strava-auth
```

⚠️ **Important:** 
- The callback domain must be the **Supabase edge function URL** (NOT nutrisync.id)
- The edge function will handle authentication, then redirect to nutrisync.id
- This is standard OAuth flow for serverless architectures

---

## Why This Architecture?

### Option 1: Direct to nutrisync.id ❌
```
Strava → nutrisync.id → Client-side code exchanges token
```
**Problems:**
- Client secret exposed in browser
- Security risk
- Not recommended by Strava

### Option 2: Via Supabase Edge Function ✅
```
Strava → Supabase Edge Function → nutrisync.id
            ↑ (Secure server-side token exchange)
```
**Benefits:**
- ✅ Client secret stays secure
- ✅ Server-side token validation
- ✅ Can store tokens directly in database
- ✅ User gets redirected to your domain after
- ✅ Standard OAuth 2.0 best practice

---

## Testing

### Test the complete flow:

1. **Go to nutrisync.id**
   Navigate to: Profile → App Integrations

2. **Click "Connect with Strava"**
   Orange button with Strava logo

3. **Authorize on Strava**
   Login if needed, click "Authorize"

4. **You'll be redirected through:**
   ```
   nutrisync.id
     ↓
   strava.com (authorize)
     ↓
   eecdbddpzwedficnpenm.supabase.co (edge function)
     ↓
   nutrisync.id/profile/integrations?strava_connected=true ⭐
   ```

5. **See success toast:**
   "Strava Connected! Your Strava account has been successfully connected!"

6. **Verify connection:**
   - Strava section should show "Connected"
   - "Sync Now" and "Disconnect" buttons appear

---

## Error Handling

All errors redirect back to nutrisync.id with descriptive error codes:

| Error Code | When It Happens | User Sees |
|-----------|-----------------|-----------|
| `missing_code` | OAuth callback missing code | "Connection Failed: missing code" |
| `invalid_user` | User token invalid/expired | "Connection Failed: invalid user" |
| `token_exchange_failed` | Strava rejects code exchange | "Connection Failed: token exchange failed" |
| `database_error` | Can't store tokens | "Connection Failed: database error" |
| `internal_error` | Unexpected server error | "Connection Failed: internal error" |

Users can simply try connecting again.

---

## Files Changed

### Edge Function:
- ✅ `supabase/functions/strava-auth/index.ts` - Now redirects to nutrisync.id

### Frontend:
- ✅ `src/hooks/useStravaAuth.ts` - Uses Supabase URL as redirect_uri
- ✅ `src/pages/AppIntegrations.tsx` - Handles callback parameters

### Configuration:
- ✅ `.env` - Added `APP_URL="https://nutrisync.id"`

### Deployment:
- ✅ Deployed: `supabase functions deploy strava-auth`

---

## Summary

✅ **OAuth callback** → Supabase edge function URL
✅ **Edge function** → Processes authentication securely
✅ **Redirect** → Back to nutrisync.id with success/error status
✅ **User experience** → Seamless connection flow
✅ **Security** → Client secret never exposed to browser

**The Strava integration now properly returns users to nutrisync.id after authentication!** 🎉

---

## Next Steps

1. **Update Strava app settings** (if not done yet)
2. **Test the flow** end-to-end
3. **Monitor** for any OAuth errors in Supabase logs
4. **(Optional)** Add analytics to track connection success rate

The OAuth flow is now complete and production-ready! 🚀
