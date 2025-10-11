# Quick Fix: Deploy sync-historical-google-fit-data Function

## Step-by-Step Deployment via Supabase Dashboard

### 1. Login to Supabase Dashboard
Go to: https://supabase.com/dashboard/project/yztivegnckmuzgtaqrfi

### 2. Navigate to Edge Functions
- Click on "Edge Functions" in the left sidebar
- Or go directly to: https://supabase.com/dashboard/project/yztivegnckmuzgtaqrfi/functions

### 3. Deploy the Function

#### Option A: Via Dashboard UI
1. Click "Deploy a new function" button
2. Choose "From local file"
3. Upload these files:
   - **Main file:** `supabase/functions/sync-historical-google-fit-data/index.ts`
   - **Shared file:** `supabase/functions/_shared/cors.ts`
4. Function name: `sync-historical-google-fit-data`
5. Click "Deploy"

#### Option B: Via CLI (if you have access)
```bash
# Login
supabase login

# Link project
supabase link --project-ref yztivegnckmuzgtaqrfi

# Deploy
supabase functions deploy sync-historical-google-fit-data
```

### 4. Verify Deployment

Test with curl:
```bash
curl -X POST https://yztivegnckmuzgtaqrfi.supabase.co/functions/v1/sync-historical-google-fit-data \
  -H "Content-Type: application/json" \
  -d '{"test":true}'
```

Expected response (without auth):
```json
{
  "success": false,
  "error": "Missing authorization header"
}
```

This confirms the function is deployed and responding!

### 5. Test in App

1. Open app: https://25158d8e.nutrisync-beta.pages.dev
2. Go to Profile → App Integrations
3. Click "Sync 7 days" button
4. Should show progress and complete successfully

---

## If You Can't Deploy

**Temporary Workaround:** The function might already be deployed on a different project or the production environment. Check:

1. **Production project:** https://supabase.com/dashboard
2. **Check all projects** for edge functions
3. **Verify project ref** in the app matches deployed function

**Alternative:** Use the existing `fetch-google-fit-data` function in a loop (less efficient but works):

The hook can be modified to call the regular fetch function multiple times for historical dates. Let me know if you need this workaround implemented.

---

## Done!

Once deployed, the Google Fit historical sync will work perfectly with the 7/30/90 day buttons.
