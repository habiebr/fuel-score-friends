# Google Fit Integration Guide

## Overview

NutriSync now uses **Google Fit exclusively** for all exercise and activity tracking. All previous wearable integrations (Apple Health, generic wearable stats) have been removed in favor of a streamlined Google Fit-only approach.

## Architecture

### Data Flow
```
Google Fit API → useGoogleFitSync Hook → google_fit_data Table → Dashboard
                                      ↓
                               Supabase Database (cached)
```

### Components

1. **Database Table**: `google_fit_data`
   - Stores daily exercise data per user
   - One record per user per day (unique constraint)
   - Auto-updates on sync

2. **Hook**: `useGoogleFitSync`
   - Manages Google Fit API integration
   - Handles sync and caching logic
   - Provides real-time sync status

3. **Dashboard Integration**
   - Displays Google Fit metrics
   - "Sync Fit" button for manual refresh
   - Auto-syncs on page load

## Database Schema

### `google_fit_data` Table

```sql
CREATE TABLE public.google_fit_data (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Exercise Metrics
  steps INTEGER DEFAULT 0,
  calories_burned DECIMAL(10, 2) DEFAULT 0,
  active_minutes INTEGER DEFAULT 0,
  distance_meters DECIMAL(10, 2) DEFAULT 0,
  heart_rate_avg DECIMAL(5, 2),
  
  -- Activity Sessions (JSON array)
  sessions JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_source TEXT DEFAULT 'google_fit',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, date)
);
```

### Indexes
- `idx_google_fit_data_user_date` - Fast lookups by user and date
- `idx_google_fit_data_last_synced` - Track sync freshness

### RLS Policies
- Users can only view/edit their own data
- Full CRUD permissions for authenticated users

## Usage

### Hook API

```typescript
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';

function MyComponent() {
  const { syncGoogleFit, getTodayData, isSyncing, lastSync } = useGoogleFitSync();
  
  // Manual sync
  const handleSync = async () => {
    const data = await syncGoogleFit();
    console.log(data); // { steps, caloriesBurned, activeMinutes, ... }
  };
  
  // Get cached data (auto-syncs if missing)
  const handleLoad = async () => {
    const data = await getTodayData();
    // Uses cache if available, otherwise syncs
  };
  
  return (
    <button onClick={handleSync} disabled={isSyncing}>
      {isSyncing ? 'Syncing...' : 'Sync Google Fit'}
    </button>
  );
}
```

### Data Structure

```typescript
interface GoogleFitData {
  steps: number;                 // Daily step count
  caloriesBurned: number;       // Calories burned
  activeMinutes: number;        // Active time in minutes
  distanceMeters: number;       // Distance in meters
  heartRateAvg?: number;        // Average heart rate (optional)
  sessions?: any[];             // Activity sessions array
}
```

## Google Fit API Setup

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Fit API**

### 2. OAuth 2.0 Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Authorized JavaScript origins:
   - `http://localhost:8080` (development)
   - `https://cursor.nutrisync.pages.dev` (production)
5. Authorized redirect URIs:
   - Same as above + `/auth/callback`

### 3. Environment Variables

Add to your `.env.local`:

```env
# Google OAuth (via Supabase)
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_API_KEY=your_google_api_key
```

### 4. Scopes Required

The app requests these Google Fit scopes:
- `https://www.googleapis.com/auth/fitness.activity.read`
- `https://www.googleapis.com/auth/fitness.body.read`
- `https://www.googleapis.com/auth/fitness.location.read`

## API Endpoints Used

### Aggregate Data
```
POST https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate
```

Fetches aggregated metrics for:
- Step count delta
- Calories expended
- Active minutes
- Distance delta
- Heart rate BPM

### Activity Sessions
```
GET https://www.googleapis.com/fitness/v1/users/me/sessions
```

Retrieves structured activity sessions (runs, bike rides, etc.)

## Sync Behavior

### Automatic Sync
- Triggered on Dashboard load if no data for today
- `getTodayData()` checks cache first, then syncs

### Manual Sync
- "Sync Fit" button in Dashboard header
- User can force refresh at any time
- Shows sync status with toast notification

### Caching Strategy
- Data is cached in Supabase `google_fit_data` table
- One record per day per user (upsert on conflict)
- `last_synced_at` tracks freshness
- Reduces API calls and improves performance

## Error Handling

### Common Errors

1. **No Access Token**
   - User needs to connect Google Fit account
   - Redirect to Google OAuth flow

2. **API Rate Limits**
   - Google Fit has rate limits
   - Cache helps reduce API calls

3. **Missing Permissions**
   - User may have denied specific scopes
   - Re-authorize with correct permissions

### Error Messages

```typescript
// No token
"No Google access token available. Please connect Google Fit."

// API error
"Google Fit API error: 429 - Rate limit exceeded"

// Sync failed
"Could not sync Google Fit data"
```

## Migration from Wearables

### Removed Tables/Columns
- ❌ `wearable_stats` table (deprecated)
- ❌ `wearable_data` queries
- ❌ Apple Health integration
- ❌ Generic wearable sync

### New Approach
- ✅ Single source: Google Fit
- ✅ Dedicated table: `google_fit_data`
- ✅ Simpler data model
- ✅ Better performance

### Data Migration

If you have existing wearable data, you can migrate it:

```sql
-- Optional: Copy old wearable data to google_fit_data
INSERT INTO google_fit_data (user_id, date, steps, calories_burned, active_minutes)
SELECT user_id, date, steps, calories_burned, active_minutes
FROM wearable_data
WHERE sync_source = 'google_fit'
ON CONFLICT (user_id, date) DO NOTHING;
```

## Dashboard Integration

### Display Metrics

```typescript
// Dashboard.tsx
const { getTodayData } = useGoogleFitSync();

useEffect(() => {
  const loadData = async () => {
    const googleFitData = await getTodayData();
    
    setMetrics({
      steps: googleFitData?.steps || 0,
      caloriesBurned: googleFitData?.caloriesBurned || 0,
      activeMinutes: googleFitData?.activeMinutes || 0
    });
  };
  
  loadData();
}, []);
```

### Sync Button

```typescript
<Button 
  variant="outline" 
  size="sm"
  onClick={() => syncGoogleFit()}
  disabled={isSyncing}
>
  <Activity className="w-4 h-4" />
  {isSyncing ? 'Syncing...' : 'Sync Fit'}
</Button>
```

## Testing

### Local Development

1. Set up Google OAuth credentials
2. Add environment variables
3. Run migration: `supabase migration up`
4. Test sync in Dashboard

### Production

1. Update Cloudflare Pages environment variables
2. Deploy latest code
3. Verify Google OAuth callback URLs
4. Test with real Google Fit data

## Troubleshooting

### Sync Not Working

1. Check Google OAuth connection
2. Verify scopes in Google Cloud Console
3. Check network tab for API errors
4. Ensure `.env` variables are set

### Missing Data

1. User may not have Google Fit installed
2. Google Fit may not have permissions for health data
3. User may not have any activity for today

### Performance Issues

1. Check `last_synced_at` to avoid over-syncing
2. Use cached data when possible
3. Implement debouncing for manual syncs

## Future Enhancements

- [ ] Background sync via service worker
- [ ] Historical data import (past 7/30 days)
- [ ] Activity type filtering (runs only)
- [ ] GPS route visualization
- [ ] Heart rate zones analysis
- [ ] Sleep tracking integration

## Support

For issues or questions:
- Check Google Fit API documentation
- Review Supabase RLS policies
- Check browser console for errors
- Verify network requests in DevTools

## Token Management & Refresh

- Google access and refresh tokens are persisted in the `google_tokens` table with `is_active`, `expires_at`, and `refresh_count` metadata so the backend can manage rotation centrally.
- A Supabase edge function (`refresh-expiring-google-tokens`) refreshes batches of tokens server-side; it requires the shared secret `GOOGLE_TOKEN_REFRESH_SECRET` (set via `supabase secrets set GOOGLE_TOKEN_REFRESH_SECRET=...`) for manual invocation.
- A `pg_cron` job now calls the refresh function every 10 minutes with `batch_size: 25` and `threshold_minutes: 20`, keeping tokens warm before the one-hour Google expiry window closes.
- In Postgres, expose the same secret to cron with `ALTER DATABASE postgres SET app.settings.refresh_google_token_secret = 'your-secret';` so the scheduled job can pass the authorization header safely.
- The function deactivates tokens when Google returns `invalid_grant`/`invalid_token`, which aligns with Google’s OAuth guidance on detecting revoked refresh tokens and prompting the user to re-consent.
- Per [Google OAuth 2.0 best practices](https://developers.google.com/identity/protocols/oauth2/web-server#offline), always request offline access, store refresh tokens securely server-side, rotate access tokens ahead of expiry, and implement exponential backoff plus revocation handling.

## Security

- ✅ RLS policies protect user data
- ✅ OAuth tokens stored securely
- ✅ HTTPS only for API calls
- ✅ No sensitive data in logs
- ✅ Token refresh handled by Supabase
