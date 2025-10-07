# Google Fit API Setup Guide

This guide will help you set up Google Fit API integration for your PWA.

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

3. **Create OAuth Client ID**
   - Application type: "Web application"
   - Name: "Fuel Score Friends Web Client"
   - Authorized JavaScript origins:
     - `http://localhost:8080` (for development)
     - `https://your-domain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:8080` (for development)
     - `https://your-domain.com` (for production)
   - Click "Create"

4. **Copy Credentials**
   - Copy the "Client ID" (you'll need this for `VITE_GOOGLE_CLIENT_ID`)

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

## Step 5: Configure Environment Variables

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
   ```

3. **Update for production**
   - Add the same variables to your Cloudflare Pages environment
   - Or update your deployment configuration

## Step 6: Test the Integration

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

## Step 7: Production Deployment

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

## API Scopes Used

The integration uses these Google Fit API scopes:
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
