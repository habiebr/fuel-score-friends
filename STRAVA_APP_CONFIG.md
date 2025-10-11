# Strava App Configuration Guide

## Important: Configure Your Strava App

Before testing the Strava integration, you need to configure the OAuth redirect URI in your Strava app settings.

## Steps:

### 1. Go to Strava API Settings
Visit: https://www.strava.com/settings/api

### 2. Find Your App
Look for the app with Client ID: **179720**

### 3. Update Authorization Callback Domain
Add this redirect URI to your app:

```
https://eecdbddpzwedficnpenm.supabase.co/functions/v1/strava-auth
```

**Important**: 
- ✅ Must be **exact match** (no trailing slash)
- ✅ Use HTTPS (required by Strava)
- ✅ Must be the Supabase edge function URL

### 4. Verify Settings

Your Strava app should have:

| Field | Value |
|-------|-------|
| Client ID | 179720 |
| Client Secret | 092878685fb9e263b1665c22ee534ec1e198c09b |
| Authorization Callback Domain | `eecdbddpzwedficnpenm.supabase.co` |

### 5. OAuth Flow

When user clicks "Connect with Strava":

```
User clicks button
    ↓
Redirects to Strava OAuth
    ↓
https://www.strava.com/oauth/authorize?
  client_id=179720&
  redirect_uri=https://eecdbddpzwedficnpenm.supabase.co/functions/v1/strava-auth&
  response_type=code&
  scope=read,activity:read_all
    ↓
User authorizes
    ↓
Strava redirects back to:
https://eecdbddpzwedficnpenm.supabase.co/functions/v1/strava-auth?code=...&scope=...
    ↓
Edge function exchanges code for tokens
    ↓
Stores in database
    ↓
Redirects user back to app
```

## Testing

After configuration:

1. Open app: Navigate to Profile → App Integrations
2. Scroll to Strava section
3. Click "Connect with Strava" button
4. Should redirect to Strava login
5. Authorize the app
6. Should redirect back and show "Connected"

## Troubleshooting

### Error: "Redirect URI mismatch"
- ✅ Check the URI is exactly: `https://eecdbddpzwedficnpenm.supabase.co/functions/v1/strava-auth`
- ✅ No trailing slash
- ✅ HTTPS (not HTTP)

### Error: "Invalid client"
- ✅ Verify Client ID is 179720
- ✅ Check Client Secret matches

### Error: "Invalid scope"
- ✅ Default scopes: `read,activity:read_all`
- ✅ Can add more if needed: `activity:write`, `profile:read_all`

## Required Scopes

Current configuration requests:
- ✅ `read` - Basic profile info
- ✅ `activity:read_all` - Read all activities (public + private)

Optional scopes you can add:
- `activity:write` - Create/update activities
- `profile:read_all` - Read detailed profile
- `profile:write` - Update profile

## Environment Variables

Already configured in `.env`:
```bash
VITE_STRAVA_CLIENT_ID=179720
STRAVA_CLIENT_SECRET=092878685fb9e263b1665c22ee534ec1e198c09b
VITE_STRAVA_REDIRECT_URI=https://eecdbddpzwedficnpenm.supabase.co/functions/v1/strava-auth
```

## Edge Functions Deployed

✅ `strava-auth` - Handles OAuth callback
✅ `sync-strava-activities` - Syncs activities
✅ `strava-webhook` - Real-time updates
✅ `refresh-strava-token` - Auto token refresh

---

Once you've updated your Strava app settings with the redirect URI, the integration is ready to test! 🚀
