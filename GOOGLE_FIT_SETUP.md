# Google Fit API Setup Guide

This guide will help you set up Google Fit API integration for your PWA and mirror Supabase’s [Google OAuth best practices](https://supabase.com/docs/guides/auth/social-login/auth-google?platform=web).

## Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Sign in with your Google account

2. **Create a New Project**
   - Click "Select a project" dropdown
   - Click "New Project"
   - Enter project name: "Fuel Score Friends" (or your preferred name)
   - Click "Create"

3. **Select Your Project**
   - Make sure your new project is selected in the dropdown

## Step 2: Enable Google Fit API

1. **Navigate to APIs & Services**
   - Go to "APIs & Services" → "Library"
   - Search for "Google Fit API"
   - Click on "Google Fit API"
   - Click "Enable"

2. **Verify API is Enabled**
   - Go to "APIs & Services" → "Enabled APIs & Services"
   - Confirm "Google Fit API" is listed

## Step 3: Create OAuth 2.0 Credentials

1. **Go to Credentials**
   - Navigate to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"

2. **Configure OAuth Consent Screen**
   - If prompted, click "Configure Consent Screen"
   - Choose "External" user type
   - Fill in required fields:
     - App name: "Fuel Score Friends"
     - User support email: your email
     - Developer contact: your email
   - Click "Save and Continue"
   - Skip "Scopes" for now
   - Add test users (your email) in "Test users"
   - Click "Save and Continue"

3. **Create OAuth Client ID (Services ID)**
   - Application type: "Web application"
   - Name: "Fuel Score Friends Web Client"
   - Authorized JavaScript origins:
     - `http://localhost:5173` (Vite dev server)
     - `https://app.nutrisync.id`
     - `https://cursor.nutrisync.pages.dev`
   - Authorized redirect URIs:
     - `http://localhost:54321/auth/v1/callback` (Supabase local dev)
     - `https://qiwndzsrmtxmgngnupml.supabase.co/auth/v1/callback` (Supabase Hosted)
     - `https://app.nutrisync.id/auth/callback`
     - `https://cursor.nutrisync.pages.dev/auth/callback`
   - Click "Create"
   - Copy the generated **Services ID / Client ID** and **Client Secret** for Supabase

4. **Copy Credentials**
   - Copy the "Client ID" (you'll need this for `VITE_GOOGLE_CLIENT_ID`)

5. **Set Required Scopes**
   - In the OAuth consent screen ➝ Scopes, add:
     - `https://www.googleapis.com/auth/fitness.activity.read`
     - `https://www.googleapis.com/auth/fitness.body.read`
     - `https://www.googleapis.com/auth/fitness.location.read`
   - Keep `email` and `profile` selected so Supabase can map user identities

## Step 4: Create API Key

1. **Create API Key**
   - In "Credentials" page, click "Create Credentials" → "API Key"
   - Copy the API key (you'll need this for `VITE_GOOGLE_API_KEY`)

2. **Restrict API Key (Recommended)**
   - Click on the API key to edit
   - Under "API restrictions", select "Restrict key"
   - Choose "Google Fit API"
   - Under "Application restrictions", select "HTTP referrers"
   - Add your domains:
     - `http://localhost:8080/*`
     - `https://your-domain.com/*`
   - Click "Save"

## Step 5: Configure Supabase Google Provider

1. **Open Supabase Dashboard** → **Authentication** → **Providers** → **Google**
2. Paste the Client ID and Secret you copied from Google Cloud
3. Set **Additional OAuth Scopes** to the same three Google Fit scopes above (space separated)
4. Under **Settings**:
   - Prompt = `consent`
   - Access type = `offline` (required for refresh tokens)
   - Include granted scopes = `true`
5. Save the provider configuration

## Step 6: Configure Supabase Auth URLs

1. Go to **Authentication** → **URL Configuration**
2. Add Site URL entries:
   - `http://localhost:5173`
   - `https://app.nutrisync.id`
   - `https://cursor.nutrisync.pages.dev`
3. Add Additional Redirect URLs for the hosted callback pages listed in Step 3
4. Save changes

## Step 7: Configure Environment Variables

1. **Create .env.local file**
   ```bash
   # Copy from cloudflare.env.example
   cp cloudflare.env.example .env.local
   ```

2. **Add Google Fit credentials**
   ```env
   # Google Fit API Configuration
   VITE_GOOGLE_CLIENT_ID=your-client-id-here
   VITE_GOOGLE_API_KEY=your-api-key-here
   # Optional: Needed for token refresh Edge Function
   GOOGLE_FIT_CLIENT_ID=your-client-id-here
   GOOGLE_FIT_CLIENT_SECRET=your-client-secret-if-required
   GOOGLE_TOKEN_REFRESH_SECRET=your-shared-cron-secret
   ```

3. **Update for production**
   - Add the same variables to your Cloudflare Pages environment
   - Or update your deployment configuration

## Step 8: Test the Integration

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Navigate to Import Page**
   - Go to `/import` in your app
   - Look for "Google Fit Integration" card

3. **Test Connection**
   - Click "Connect Google Fit"
   - Complete OAuth flow
   - Verify data loads correctly

## Step 9: Production Deployment

1. **Update OAuth Settings**
   - Go back to Google Cloud Console
   - Edit your OAuth 2.0 Client ID
   - Add your production domain to authorized origins
   - Add your production domain to redirect URIs

2. **Update API Key Restrictions**
   - Edit your API key
   - Add production domain to HTTP referrers

3. **Deploy with Environment Variables**
   - Add environment variables to your deployment platform
   - Redeploy your application

## Step 10: Schedule Token Refresh & Daily Sync (Supabase)

1. **Deploy edge functions**
   ```bash
   supabase functions deploy store-google-token refresh-google-fit-token-v2 refresh-expiring-google-tokens force-sync-all-users sync-all-google-fit-data
   ```
   - Requires `SUPABASE_ACCESS_TOKEN` and the CLI logged into the `qiwndzsrmtxmgngnupml` project.

2. **Set Supabase secrets for background jobs**
   ```bash
   supabase secrets set \
     GOOGLE_TOKEN_REFRESH_SECRET=choose-a-long-random-string \
     ADMIN_FORCE_SYNC_KEY=force_sync_2025 \
     GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
     GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
   ```
   - `GOOGLE_TOKEN_REFRESH_SECRET` authorizes the token refresh cron worker.
   - `ADMIN_FORCE_SYNC_KEY` gates the daily force-sync job (`force-sync-all-users`).
   - Client ID/secret allow refreshes without user interaction.

3. **Expose the shared secrets to Postgres cron jobs**
   ```bash
   supabase db remote connect
   -- Inside psql:
   ALTER DATABASE postgres SET app.settings.refresh_google_token_secret = 'choose-a-long-random-string';
   ALTER DATABASE postgres SET app.settings.admin_force_sync_key = 'force_sync_2025';
   \q
   ```
   - These GUCs let scheduled jobs inject the same secrets without hard-coding them in SQL.

4. **Apply the latest migrations to install scheduler jobs**
   ```bash
   supabase db push
   ```
   - This installs a single consolidated `refresh-google-fit-tokens` job (every 15 minutes, batch size 50, 25-min threshold) and `sync-google-fit-daily` at 01:15 UTC.

5. **Trigger an initial background run (optional sanity check)**
   ```bash
   curl -X POST \
     -H "Authorization: Bearer $GOOGLE_TOKEN_REFRESH_SECRET" \
     -H "Content-Type: application/json" \
     https://qiwndzsrmtxmgngnupml.supabase.co/functions/v1/refresh-expiring-google-tokens

   curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"admin_key":"force_sync_2025","days":30}' \
     https://qiwndzsrmtxmgngnupml.supabase.co/functions/v1/force-sync-all-users
   ```
   - Verify the Supabase logs show successful refresh and sync activity.

## Troubleshooting

### Common Issues

1. **"Failed to load Google Fit API"**
   - Check if API credentials are correctly set
   - Verify API key restrictions allow your domain
   - Ensure Google Fit API is enabled

2. **"Authorization failed"**
   - Check OAuth client ID is correct
   - Verify authorized origins include your domain
   - Check if OAuth consent screen is configured

3. **"No health data available"**
   - Ensure user has Google Fit data
   - Check if user granted necessary permissions
   - Verify API scopes are correct

### Debug Steps

1. **Check Browser Console**
   - Look for error messages
   - Check network requests to Google APIs

2. **Verify API Response**
   - Check if Google Fit API returns data
   - Verify data structure matches expected format

3. **Test OAuth Flow**
   - Clear browser cache and cookies
   - Try authorization flow again
   - Check if consent screen appears

## Security Best Practices

1. **API Key Security**
   - Always restrict API keys to specific APIs
   - Use HTTP referrer restrictions
   - Rotate keys regularly

2. **OAuth Security**
   - Use HTTPS in production
   - Validate redirect URIs
   - Implement proper state parameter

3. **Data Privacy**
   - Only request necessary scopes
   - Implement data retention policies
   - Provide clear privacy notices

## API Scopes Used (Align with Supabase Provider)

The integration uses these Google Fit API scopes (paste the same value into Supabase → Providers → Google → Additional scopes):
- `https://www.googleapis.com/auth/fitness.activity.read` - Read activity data
- `https://www.googleapis.com/auth/fitness.body.read` - Read body metrics
- `https://www.googleapis.com/auth/fitness.location.read` - Read location data

## Support

If you encounter issues:
1. Check Google Cloud Console for API quotas and errors
2. Review browser console for JavaScript errors
3. Verify all environment variables are set correctly
4. Test with a fresh browser session

## Next Steps

Once Google Fit is working:
1. Test data sync functionality
2. Implement background sync
3. Add error handling and retry logic
4. Consider adding more health metrics
5. Implement data visualization features
