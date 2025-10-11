# Strava Integration - Quick Deploy Guide

## 🎯 30-Minute Strava Integration

Follow these steps to deploy Strava integration quickly.

## Step 1: Create Strava App (5 min)

1. Go to: https://www.strava.com/settings/api
2. Click "Create & Manage Your App"
3. Fill in:
   ```
   Application Name: Fuel Score Friends
   Category: Training
   Website: https://your-app-url.com
   Authorization Callback Domain: your-domain.com
   ```
4. Copy your credentials

## Step 2: Add Environment Variables (2 min)

Add to `.env`:
```bash
VITE_STRAVA_CLIENT_ID=your-client-id
STRAVA_CLIENT_SECRET=your-client-secret
```

Add to Supabase Edge Function secrets:
```bash
supabase secrets set STRAVA_CLIENT_SECRET=your-client-secret
```

## Step 3: Deploy Database Schema (5 min)

```bash
# I'll create the migration file
cd supabase/migrations

# Apply migration
supabase db push
```

## Step 4: Deploy Edge Functions (10 min)

```bash
# Deploy all Strava functions
supabase functions deploy strava-auth
supabase functions deploy sync-strava-activities  
supabase functions deploy strava-webhook
supabase functions deploy refresh-strava-token
```

## Step 5: Test Connection (5 min)

1. Open your app
2. Go to Settings
3. Click "Connect Strava"
4. Authorize
5. See activities sync!

## Step 6: Register Webhook (3 min)

```bash
# Run the webhook registration script
node scripts/register-strava-webhook.js
```

---

## 📦 Files I'll Create

When you say "go", I'll create:

### Database
- `supabase/migrations/[timestamp]_add_strava_integration.sql`

### Edge Functions
- `supabase/functions/strava-auth/index.ts`
- `supabase/functions/sync-strava-activities/index.ts`
- `supabase/functions/strava-webhook/index.ts`
- `supabase/functions/refresh-strava-token/index.ts`
- `supabase/functions/process-strava-event/index.ts`

### Frontend
- `src/hooks/useStravaAuth.ts`
- `src/hooks/useStravaSync.ts`
- `src/components/StravaConnect.tsx`
- `src/lib/strava.ts`

### Scripts
- `scripts/register-strava-webhook.js`
- `scripts/test-strava-sync.js`

### Docs
- `STRAVA_DEPLOYMENT.md` (detailed guide)
- `STRAVA_API_REFERENCE.md` (quick reference)

---

## 🚀 Quick Commands

```bash
# After I create the files:

# 1. Deploy database
supabase db push

# 2. Deploy functions
cd supabase/functions
supabase functions deploy strava-auth
supabase functions deploy sync-strava-activities
supabase functions deploy strava-webhook
supabase functions deploy refresh-strava-token

# 3. Register webhook
cd ../..
node scripts/register-strava-webhook.js

# 4. Test
node scripts/test-strava-sync.js
```

---

## ✅ Checklist

### Pre-requisites
- [ ] Strava app created
- [ ] Client ID and Secret obtained
- [ ] Environment variables added

### Deployment
- [ ] Database migration deployed
- [ ] Edge functions deployed
- [ ] Webhook registered
- [ ] Frontend updated

### Testing
- [ ] OAuth flow works
- [ ] Activities sync
- [ ] Webhook receives events
- [ ] Token refresh works

---

## 🎨 What Users Will See

### Before
```
Settings > Fitness Trackers
[ Google Fit ] ✓ Connected
```

### After
```
Settings > Fitness Trackers
[ Google Fit ] ✓ Connected
[ Strava ]     Connect →
```

### After Connecting
```
Settings > Fitness Trackers
[ Google Fit ] ✓ Connected (32 activities)
[ Strava ]     ✓ Connected (156 activities)
               Last sync: 2 mins ago
```

---

## 📊 Benefits

Once deployed, users will get:

### From Strava
- 🎯 **Accurate GPS tracking**
- 📈 **Detailed performance metrics**
- 🏃 **30+ activity types** (vs 8 in Google Fit)
- ⚡ **Real-time sync** via webhooks
- 🏆 **Segments & achievements**
- 💪 **Power data** (cycling)
- ❤️ **HR zones**
- 📸 **Activity photos**

### Combined Data
- Best of both platforms
- More complete activity picture
- Deduplicate similar activities
- Fill gaps when one service is down

---

## 🔒 Privacy & Security

- ✅ Only fetch user's own activities
- ✅ Respect Strava privacy settings
- ✅ Encrypted token storage
- ✅ User can disconnect anytime
- ✅ No sharing without permission

---

## 💰 Cost Considerations

### Strava API
- **Free tier:** 1,000 requests/day
- **Rate limit:** 100 requests per 15 min
- **Webhook:** Unlimited events

### Your Infrastructure
- **Edge function calls:** ~10 per activity sync
- **Database:** Minimal storage increase
- **Webhook:** 1 call per activity update

**Estimated cost for 100 users:** ~$2-5/month

---

## 🆘 Support

If issues arise:

1. **OAuth fails:** Check callback URL matches Strava app settings
2. **No activities:** Check token has `activity:read_all` scope
3. **Webhook not working:** Verify subscription with Strava
4. **Rate limit:** Implement backoff, use webhooks more

---

**Ready to deploy?** Just say "create Strava integration files" and I'll generate everything! 🚀
