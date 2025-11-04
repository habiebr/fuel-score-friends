# PWA + Capacitor Health - Quick Action Checklist

## Understanding the Limitation ⚠️

**The Core Issue:**
PWAs run in a browser (Safari/Chrome), not as native apps. Browsers have security restrictions and cannot:
- ❌ Access Apple HealthKit
- ❌ Access Android Google Fit
- ❌ Read native device sensors directly

**This is by design** - browsers can't access your private health data for security/privacy reasons.

---

## What You CAN Do Right Now ✅

### ✅ 1. Use What Already Exists
Your codebase already has:
- `useHealthKit.ts` - Works on native iOS builds
- `useHealthSync.ts` - Orchestrates all sources
- `capacitor-health` plugin - Configured in capacitor.config.ts

**Action**: Nothing needed - it's already set up!

### ✅ 2. Enable File Uploads (PWA-Friendly)
Users can upload health data from web:
- Apple Health XML exports
- Garmin .fit files
- Custom JSON files

**Action**: Implement `HealthDataUpload.tsx` (see guide)

### ✅ 3. Google Fit (Works on Web!)
Google Fit can be accessed via OAuth on web browsers

**Status**: Check if already implemented in `useGoogleFitSync.ts`

### ✅ 4. Database as Central Hub
Single Supabase table stores all health data

**Action**: Ensure all sources write to `wearable_data` table

---

## Implementation Priority

### 🟢 EASY - Do First (1-2 hours)

**1. Fix useHealthSync.ts** - Add isNative check
```typescript
import { Capacitor } from '@capacitor/core';
const isNative = Capacitor.isNativePlatform();

// Only use Apple Health if native
if (!newData && isNative && healthKit.isAuthorized) {
  const appleData = await healthKit.fetchTodayData();
  // ...
}
```

**2. Add File Upload Component** - Users can manually upload
```typescript
// Copy HealthDataUpload.tsx from guide
// Add to AppIntegrations page
```

**3. Update Settings Page** - Show what's available where
```typescript
// Copy HealthIntegrationSettings.tsx from guide
// Show Apple Health: iOS only, Google Fit: all platforms, Upload: all platforms
```

### 🟡 MEDIUM - Do Second (2-4 hours)

**4. Enhance Health Data Parsing**
- Apple Health XML parser
- Garmin .fit parser (@garmin/fitsdk already installed)
- JSON import validation

**5. Add Data Mapping UI**
- Let users map fields
- Preview before import
- Handle duplicate dates

### 🔴 HARD - Do Last (4-8 hours)

**6. Background Sync**
- Service Worker for periodic sync
- Handle offline queue
- Retry failed uploads

**7. Advanced Features**
- Data reconciliation (if multiple sources have same day)
- Trend analysis
- Historical data import

---

## Quick Implementation: 30 Minutes

If you just want a basic setup working NOW:

### Step 1: Update useHealthSync.ts (5 min)

```typescript
// ADD at top
import { Capacitor } from '@capacitor/core';

// MODIFY syncHealthData function around line 115:
const isNative = Capacitor.isNativePlatform();

// In the data source priority section, change:
// FROM:
if (!newData && healthKit.isAuthorized) {

// TO:
if (!newData && isNative && healthKit.isAuthorized) {
```

### Step 2: Create Simple Upload Component (10 min)

```typescript
// src/components/SimpleHealthUpload.tsx

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function SimpleHealthUpload() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !user) return;
    
    const file = e.target.files[0];
    setIsLoading(true);
    
    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        
        for (const record of data) {
          await supabase.from('wearable_data').upsert({
            user_id: user.id,
            date: record.date,
            steps: record.steps || 0,
            calories_burned: record.calories || 0,
            distance: record.distance || 0,
            source: 'manual',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,date'
          });
        }
        alert('Health data imported!');
      }
    } catch (error) {
      alert('Error: ' + error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block">
        <input
          type="file"
          accept=".json"
          onChange={handleUpload}
          disabled={isLoading}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        Upload JSON: [{"{date, steps, calories, distance}"}]
      </p>
    </div>
  );
}
```

### Step 3: Add to App (5 min)

```typescript
// In src/pages/AppIntegrations.tsx or similar
import { SimpleHealthUpload } from '@/components/SimpleHealthUpload';

// Add to JSX:
<Card>
  <CardHeader>
    <CardTitle>Health Data</CardTitle>
  </CardHeader>
  <CardContent>
    <SimpleHealthUpload />
  </CardContent>
</Card>
```

---

## Testing Your Setup

### Test 1: Native App (iOS) - WILL WORK ✅
```
1. Build with `npm run build && npx cap copy ios`
2. Open in Xcode
3. Run on simulator/device
4. Grant Apple Health permissions
5. Check Supabase - data should appear in wearable_data
```

### Test 2: Web PWA - WILL WORK ✅ (With uploads)
```
1. Run `npm run dev`
2. Open http://localhost:8080
3. Try uploading a JSON file with health data
4. Check Supabase - data should appear
```

### Test 3: Google Fit (Both)
```
1. If configured, should work on both
2. Check useGoogleFitSync.ts implementation
```

---

## Common Questions

### Q: Can I access Apple Health from PWA?
**A:** No, it's a browser limitation. But you can:
- Display data from database (if native app synced it)
- Accept Apple Health XML exports
- Let users manually upload

### Q: Will it work on Android?
**A:** 
- Google Fit: Yes (both web and native)
- Manual uploads: Yes
- Native Google Fit plugin: Yes (native only)

### Q: What if user uploads the same data twice?
**A:** Supabase upsert with `onConflict: 'user_id,date'` ensures unique per day

### Q: How do I format JSON for upload?
**A:** 
```json
[
  {
    "date": "2025-11-04",
    "steps": 8500,
    "calories": 2200,
    "distance": 6.5
  },
  {
    "date": "2025-11-05",
    "steps": 9200,
    "calories": 2100,
    "distance": 6.8
  }
]
```

### Q: Can I write back to Apple Health?
**A:** Not from PWA. From native app: need to add Health plugin write permission

---

## Files to Modify/Create

```
MODIFY:
  └─ src/hooks/useHealthSync.ts
       Add isNative check on line ~145

CREATE:
  ├─ src/components/HealthDataUpload.tsx
  ├─ src/components/HealthIntegrationSettings.tsx
  └─ src/components/SimpleHealthUpload.tsx (quick version)

REFERENCE:
  ├─ docs/PWA_CAPACITOR_HEALTH_GUIDE.md
  ├─ docs/APPLE_HEALTH_INTEGRATION_GUIDE.md
  └─ docs/MOBILE_BUILD.md
```

---

## Summary

**The Reality:**
- ✅ Native iOS/Android can read from Apple Health & Google Fit
- ❌ Web PWA cannot read from native APIs
- ✅ Web PWA can accept file uploads
- ✅ Both can share database

**Your Solution:**
1. Native app reads Apple Health → saves to database
2. PWA displays data from database
3. PWA allows manual uploads as backup
4. Google Fit works on both (via OAuth)

**Next Step:**
Pick "Quick Implementation: 30 Minutes" above and start with Step 1!
