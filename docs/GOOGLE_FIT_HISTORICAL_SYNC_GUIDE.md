# Google Fit Historical Data Sync Guide

## 🎯 Overview

The Google Fit sync feature includes **automatic historical data synchronization** that fetches past activity data when you first connect your account, and provides manual sync options for backfilling data.

## ✅ Current Implementation Status

### What's Already Built:

1. ✅ **Automatic First-Time Sync** - Syncs 30 days automatically on first connection
2. ✅ **Manual Historical Sync** - Button to sync 30 days on demand
3. ✅ **Progress Tracking** - Shows "Synced X/Y days..." during sync
4. ✅ **Edge Function** - `sync-historical-google-fit-data` endpoint
5. ✅ **UI Integration** - Historical sync button in App Integrations page

---

## 🚀 How to Use Historical Sync

### Method 1: Automatic Sync (First-Time Connection)

When you connect Google Fit for the first time, the system **automatically**:

1. Detects it's a first-time connection (no existing data)
2. Triggers historical sync for **last 30 days**
3. Shows toast notification: "Syncing historical data"
4. Displays progress: "Synced X/30 days..."
5. Shows completion toast: "Historical sync complete! Successfully synced X days"

**Location**: Happens automatically in `useGoogleFitSync` hook

```typescript
// Auto-triggered on first connection
checkAndTriggerHistoricalSync() → syncHistoricalData(30)
```

---

### Method 2: Manual Sync (UI Button)

If you need to re-sync or backfill data:

1. **Navigate to**: Settings → App Integrations (or Import page)
2. **Look for**: "Sync historical data" section under Google Fit card
3. **Click**: "Sync 30 days" button
4. **Wait**: Progress will show "Synced X/30 days..."
5. **Done**: Toast shows "Historical sync complete!"

**UI Location**: `src/pages/AppIntegrations.tsx` lines 123-147

```tsx
<Button
  onClick={() => syncHistoricalData(30)}
  disabled={isHistoricalSyncing}
>
  {isHistoricalSyncing ? 'Syncing…' : 'Sync 30 days'}
</Button>
```

---

### Method 3: Programmatic Sync (Custom Days)

You can trigger sync with custom day range programmatically:

```typescript
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';

const { syncHistoricalData, isHistoricalSyncing, historicalSyncProgress } = useGoogleFitSync();

// Sync last 7 days
await syncHistoricalData(7);

// Sync last 90 days
await syncHistoricalData(90);

// Monitor progress
if (isHistoricalSyncing && historicalSyncProgress) {
  console.log(`Progress: ${historicalSyncProgress.syncedDays}/${historicalSyncProgress.totalDays}`);
}
```

---

## 🔧 How It Works

### Architecture Flow:

```
User Action (Connect/Button Click)
  ↓
syncHistoricalData(daysBack)
  ↓
Edge Function: sync-historical-google-fit-data
  ↓
Google Fit API (fetch daily aggregates)
  ↓
Supabase: google_fit_data table
  ↓
UI: Progress updates + completion toast
```

### Data Synced Per Day:

For each day in the range, the system fetches:

- ✅ **Steps** (daily total)
- ✅ **Active minutes** (moderate + vigorous)
- ✅ **Calories burned**
- ✅ **Distance** (in meters)
- ✅ **Heart rate** (average)
- ✅ **Activity sessions** (runs, workouts, etc.)

---

## 📝 Customization Options

### Change Default Sync Range

**File**: `src/hooks/useGoogleFitSync.ts` line 389

```typescript
// Current: 30 days
await syncHistoricalData(30);

// Change to 60 days:
await syncHistoricalData(60);

// Change to 90 days:
await syncHistoricalData(90);
```

### Add Multiple Sync Buttons

**File**: `src/pages/AppIntegrations.tsx`

```tsx
{/* Add more sync options */}
<div className="flex gap-2">
  <Button onClick={() => syncHistoricalData(7)}>
    Last 7 days
  </Button>
  <Button onClick={() => syncHistoricalData(30)}>
    Last 30 days
  </Button>
  <Button onClick={() => syncHistoricalData(90)}>
    Last 90 days
  </Button>
</div>
```

### Trigger on Settings Page

You can add the historical sync button to any page:

```tsx
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';

export function SettingsPage() {
  const { syncHistoricalData, isHistoricalSyncing } = useGoogleFitSync();
  
  return (
    <Button 
      onClick={() => syncHistoricalData(30)}
      disabled={isHistoricalSyncing}
    >
      Backfill Google Fit Data
    </Button>
  );
}
```

---

## 🎨 UI States

### Loading State:
```tsx
{isHistoricalSyncing && (
  <div>
    <Spinner />
    <p>Syncing historical data...</p>
  </div>
)}
```

### Progress State:
```tsx
{historicalSyncProgress && (
  <Progress 
    value={historicalSyncProgress.syncedDays} 
    max={historicalSyncProgress.totalDays} 
  />
)}
```

### Complete State:
```tsx
{historicalSyncProgress?.isComplete && (
  <p className="text-green-600">
    ✓ Synced {historicalSyncProgress.syncedDays} days
  </p>
)}
```

---

## 🐛 Troubleshooting

### Issue: "Historical sync failed"

**Possible Causes:**
1. Google Fit token expired → Reconnect Google Fit
2. Edge function not deployed → Deploy: `npm run deploy`
3. No internet connection → Check network
4. Google Fit API quota exceeded → Wait 24 hours

**Solution:**
```bash
# 1. Check Edge function is deployed
cd supabase/functions
supabase functions list

# 2. Deploy if missing
supabase functions deploy sync-historical-google-fit-data

# 3. Test with curl
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/sync-historical-google-fit-data \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"YOUR_GOOGLE_TOKEN","daysBack":7}'
```

---

### Issue: Progress shows "0/30 days"

**Cause**: Google Fit has no data for those dates

**Check**:
1. Open Google Fit app
2. Verify data exists for the date range
3. Check if you were using a fitness tracker during that period

---

### Issue: Some days are missing

**Cause**: Normal - Google Fit only has data for active days

**Behavior**:
- Days with no activity → No data in Google Fit
- Inactive days → Won't appear in `google_fit_data` table
- This is **expected behavior**

---

## 🔍 Verification

### Check if data was synced:

**Method 1: Database Query**
```sql
SELECT 
  date, 
  steps, 
  active_minutes, 
  calories_burned,
  distance_meters
FROM google_fit_data
WHERE user_id = 'YOUR_USER_ID'
ORDER BY date DESC
LIMIT 30;
```

**Method 2: Console Logs**
```typescript
const { getTodayData } = useGoogleFitSync();

useEffect(() => {
  getTodayData().then(data => {
    console.log('Google Fit data:', data);
  });
}, []);
```

**Method 3: Dashboard**
- Navigate to Dashboard
- Check if "Steps" and "Active Minutes" widgets show historical data
- Scroll through dates to verify

---

## ⚙️ Configuration

### Edge Function Settings

**File**: `supabase/functions/sync-historical-google-fit-data/index.ts`

```typescript
// Max days to sync (safety limit)
const MAX_DAYS_BACK = 90;

// Validate request
if (daysBack > MAX_DAYS_BACK) {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: `Cannot sync more than ${MAX_DAYS_BACK} days` 
    })
  );
}
```

### Google Fit API Scopes

Ensure these scopes are requested during OAuth:

```typescript
const GOOGLE_FIT_SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.location.read',
  'https://www.googleapis.com/auth/fitness.body.read',
];
```

---

## 📊 Performance

### Sync Speed:
- **~2-3 seconds per day** (Google Fit API rate limits)
- **30 days ≈ 60-90 seconds**
- **90 days ≈ 3-5 minutes**

### Optimization Tips:

1. **Batch requests** (already implemented in Edge function)
2. **Cache results** to avoid re-syncing same days
3. **Run during off-peak hours** for large backfills
4. **Limit to 90 days max** to stay within quotas

---

## 🎯 Best Practices

### When to Use Historical Sync:

✅ **Good Use Cases:**
- First-time Google Fit connection
- Switching devices/accounts
- After a period of not syncing
- Recovering from sync errors
- Backfilling after manual data entry

❌ **Avoid:**
- Syncing same days multiple times
- Requesting >90 days (quota limits)
- Syncing every hour (unnecessary)
- Using it instead of regular sync

### Recommended Workflow:

1. **First connection**: Auto 30-day sync happens
2. **Regular use**: Daily auto-sync every 15 minutes
3. **If data missing**: Manual "Sync 30 days" button
4. **Migration**: One-time 90-day sync if switching from another app

---

## 🚀 Advanced: Custom Sync UI

Create a custom historical sync dialog:

```tsx
import { useState } from 'react';
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export function HistoricalSyncDialog({ open, onOpenChange }) {
  const [daysToSync, setDaysToSync] = useState(30);
  const { syncHistoricalData, isHistoricalSyncing, historicalSyncProgress } = useGoogleFitSync();
  
  const handleSync = async () => {
    await syncHistoricalData(daysToSync);
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <h2>Sync Historical Data</h2>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label>Days to sync: {daysToSync}</label>
            <Slider 
              value={[daysToSync]} 
              onValueChange={([val]) => setDaysToSync(val)}
              min={7}
              max={90}
              step={7}
            />
          </div>
          
          {isHistoricalSyncing && historicalSyncProgress && (
            <div>
              <progress 
                value={historicalSyncProgress.syncedDays} 
                max={historicalSyncProgress.totalDays}
              />
              <p>{historicalSyncProgress.syncedDays}/{historicalSyncProgress.totalDays} days</p>
            </div>
          )}
          
          <Button 
            onClick={handleSync}
            disabled={isHistoricalSyncing}
          >
            {isHistoricalSyncing ? 'Syncing...' : `Sync ${daysToSync} days`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 📚 Related Documentation

- [Google Fit Integration Guide](./GOOGLE_FIT_INTEGRATION.md)
- [Google Fit Setup](./GOOGLE_FIT_SETUP.md)
- [Google Fit Sync Fixes](./GOOGLE_FIT_SYNC_FIXES.md)
- [PWA Health Integration](./PWA_HEALTH_INTEGRATION_GUIDE.md)

---

## 🎉 Summary

The historical sync feature is **already fully implemented** and ready to use!

### Quick Actions:

1. **Test it now**: 
   - Go to App Integrations page
   - Connect Google Fit (if not connected)
   - Click "Sync 30 days" button

2. **Verify it worked**:
   - Check Dashboard for historical activity data
   - Query `google_fit_data` table in database
   - Look for toast: "Historical sync complete!"

3. **Customize if needed**:
   - Change default days from 30 → 60/90
   - Add multiple sync buttons (7/30/90 days)
   - Create custom sync UI with progress bar

**The feature is production-ready!** 🚀
