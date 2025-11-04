# Using Capacitor-Health in PWA - Implementation Guide

## Current Situation

You have:
- ✅ `useHealthKit.ts` hook (only works on native platforms)
- ✅ `useHealthSync.ts` hook (orchestrates multiple data sources)
- ✅ Capacitor configured with Health plugin
- ❌ **Problem**: PWA can't access Apple Health data (PWA isn't native)

## The Challenge: PWA Limitations

PWAs running in browser cannot:
- ❌ Access Apple HealthKit directly
- ❌ Access Android Google Fit directly
- ❌ Use native APIs that require system permissions

**Why?** PWAs are web apps running in Safari/Chrome, not native apps. HealthKit and Google Fit require native app context.

---

## Solutions for PWA + Health Data

### Option A: Data Flow Architecture (Current & Recommended)
```
User on Web (PWA)
├─ Manual Data Entry → Database ✅
├─ Google Fit OAuth → Web API ✅
├─ Garmin .fit Upload → File Upload ✅
└─ Apple Health Export → XML Upload ✅

User on iOS (Native)
├─ Apple HealthKit → Native Plugin → Database ✅
├─ Manual Entry → Database ✅
└─ Google Fit → Native Plugin → Database ✅
```

### Option B: Use Apple Health Sharing (Best for PWA)
```
User Setup (One-time):
  1. User opens Apple Health app
  2. Opens Nutrisync
  3. Shares health data with Nutrisync
  4. From then on, app can read shared data
  5. User logs into PWA
  6. PWA displays data from native app's database

Result:
  ✅ PWA shows health data (from database)
  ✅ Native app reads from Apple Health
  ✅ Single source of truth (database)
```

### Option C: Web API Approach (Limited)
```
Browser APIs Available:
  ├─ Activity API (limited support)
  ├─ Generic Sensor API (some devices)
  ├─ WebXR (fitness tracking features)
  └─ File API (upload .fit files) ✅

Limitations:
  ⚠️ Very limited data access
  ⚠️ Browser-dependent
  ⚠️ Not recommended for HealthKit
```

---

## Recommended Implementation: Option A+B (Hybrid)

### Architecture Overview

```typescript
// PWA Data Sources (priority order)
1. User Uploads (.fit files) → wearable_data table
2. Google Fit OAuth → wearable_data table (if connected)
3. Manual data entry → wearable_data table
4. Database (shared with native app) → Display

// Native App Data Sources
1. Apple HealthKit → useHealthKit hook → Save to database
2. Google Fit → useGoogleFit hook → Save to database
3. Manual entry → Save to database

// Both platforms read from single database
// Data flows upstream to Apple Health/Google Fit
```

---

## Implementation Steps for PWA

### Step 1: Enhance useHealthSync for PWA-Specific Sources

**File: src/hooks/useHealthSync.ts**

You need to modify this to handle PWA scenarios:

```typescript
// ADD THIS at the top
import { Capacitor } from '@capacitor/core';

export function useHealthSync() {
  const { user } = useAuth();
  const { toast } = useToast();
  const googleFit = useGoogleFitSync();
  const healthKit = useHealthKit();
  const isNative = Capacitor.isNativePlatform(); // ADD THIS
  
  // ... existing code ...

  // MODIFY: syncHealthData to handle PWA case
  const syncHealthData = async (force: boolean = false) => {
    if (!user || isLoading) return;

    setIsLoading(true);
    setSyncStatus(prev => ({ ...prev, error: null }));

    try {
      let newData: HealthData | null = null;
      let source: HealthData['source'] = 'manual';

      // 1) Prefer existing wearable .fit data for today if present
      {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('wearable_data')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .in('source', ['fit', 'garmin'])
          .single();
        if (!error && data) {
          newData = {
            steps: data.steps || 0,
            calories: data.calories_burned || 0,
            activeMinutes: data.active_minutes || 0,
            heartRate: data.heart_rate_avg || 0,
            distance: data.distance || 0,
            date: data.date,
            source: 'wearable_fit'
          };
          source = 'wearable_fit';
        }
      }

      // 2) If no wearable .fit, try Google Fit (works on PWA + Native)
      if (!newData && googleFit.isConnected) {
        const googleData = await googleFit.getTodayData();
        if (googleData) {
          newData = {
            steps: googleData.steps,
            calories: googleData.caloriesBurned,
            activeMinutes: googleData.activeMinutes,
            heartRate: googleData.heartRateAvg || 0,
            distance: googleData.distanceMeters,
            date: new Date().toISOString().split('T')[0],
            source: 'google_fit'
          };
          source = 'google_fit';
        }
      }

      // 3) If still no data AND on native platform, try Apple Health
      if (!newData && isNative && healthKit.isAuthorized) { // ADD: isNative check
        const appleData = await healthKit.fetchTodayData();
        if (appleData) {
          newData = {
            ...appleData,
            source: 'apple_health'
          };
          source = 'apple_health';
        }
      }

      // 4) If we have new data, save it
      if (newData) {
        await saveHealthData(newData);
        setHealthData(newData);
        setSyncStatus(prev => ({
          ...prev,
          isLoading: false,
          lastSync: new Date(),
        }));
      } else {
        // No new data found
        setIsLoading(false);
        setSyncStatus(prev => ({
          ...prev,
          error: 'No health data available. Try connecting Google Fit or uploading a .fit file.',
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      setSyncStatus(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  };

  // ... rest of code ...
}
```

### Step 2: Create PWA-Specific Health Upload Component

**File: src/components/HealthDataUpload.tsx**

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface HealthFileData {
  date: string;
  steps: number;
  calories: number;
  distance: number;
}

export function HealthDataUpload() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsLoading(true);
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'fit') {
        // Handle .fit file
        await handleFitFile(file, user.id);
      } else if (fileExtension === 'xml') {
        // Handle Apple Health XML export
        await handleAppleHealthXML(file, user.id);
      } else if (fileExtension === 'json') {
        // Handle JSON import
        await handleJSONImport(file, user.id);
      } else {
        throw new Error('Unsupported file format. Please upload .fit, .xml, or .json');
      }

      toast({
        title: 'Success',
        description: 'Health data imported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to import health data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFitFile = async (file: File, userId: string) => {
    // Parse .fit file (would need FIT SDK)
    const arrayBuffer = await file.arrayBuffer();
    
    // TODO: Use @garmin/fitsdk to parse
    // For now, upload and process server-side
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);

    const response = await fetch('/api/import-fit', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to import .fit file');
    }
  };

  const handleAppleHealthXML = async (file: File, userId: string) => {
    const text = await file.text();
    
    // Parse XML (you can use an XML parser library)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');
    
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML file');
    }

    // Extract health records
    const records = xmlDoc.getElementsByTagName('Record');
    const healthData: HealthFileData[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const type = record.getAttribute('type');
      const value = record.getAttribute('value');
      const endDate = record.getAttribute('endDate');

      // Map Apple Health types to our format
      if (type === 'HKQuantityTypeIdentifierStepCount') {
        const date = new Date(endDate).toISOString().split('T')[0];
        const existing = healthData.find(d => d.date === date);
        
        if (existing) {
          existing.steps += parseInt(value);
        } else {
          healthData.push({
            date,
            steps: parseInt(value),
            calories: 0,
            distance: 0,
          });
        }
      }

      if (type === 'HKQuantityTypeIdentifierActiveEnergyBurned') {
        const date = new Date(endDate).toISOString().split('T')[0];
        const existing = healthData.find(d => d.date === date);
        
        if (existing) {
          existing.calories += parseInt(value);
        } else {
          healthData.push({
            date,
            steps: 0,
            calories: parseInt(value),
            distance: 0,
          });
        }
      }

      if (type === 'HKQuantityTypeIdentifierDistanceWalkingRunning') {
        const date = new Date(endDate).toISOString().split('T')[0];
        const existing = healthData.find(d => d.date === date);
        
        if (existing) {
          existing.distance += parseFloat(value);
        } else {
          healthData.push({
            date,
            steps: 0,
            calories: 0,
            distance: parseFloat(value),
          });
        }
      }
    }

    // Save to Supabase
    for (const data of healthData) {
      await supabase
        .from('wearable_data')
        .upsert({
          user_id: userId,
          date: data.date,
          steps: data.steps,
          calories_burned: data.calories,
          distance: data.distance,
          source: 'apple_health_export',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,date'
        });
    }
  };

  const handleJSONImport = async (file: File, userId: string) => {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data)) {
      throw new Error('JSON must be an array of health records');
    }

    for (const record of data) {
      const { date, steps, calories, distance } = record;

      if (!date) {
        throw new Error('Each record must have a "date" field');
      }

      await supabase
        .from('wearable_data')
        .upsert({
          user_id: userId,
          date,
          steps: steps || 0,
          calories_burned: calories || 0,
          distance: distance || 0,
          source: 'manual',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,date'
        });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="health-upload" className="block text-sm font-medium mb-2">
          Import Health Data
        </label>
        <div className="flex items-center gap-4">
          <input
            id="health-upload"
            type="file"
            accept=".fit,.xml,.json"
            onChange={handleFileUpload}
            disabled={isLoading}
            className="block flex-1"
          />
          <Button disabled={isLoading} variant="outline">
            {isLoading ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        <p className="font-semibold mb-2">Supported formats:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>.fit files</strong> - Garmin fitness data</li>
          <li><strong>.xml files</strong> - Apple Health exports</li>
          <li><strong>.json files</strong> - Custom health data</li>
        </ul>
      </div>

      <div className="text-xs text-muted-foreground">
        <p className="font-semibold mb-2">JSON Format Example:</p>
        <code className="block bg-muted p-2 rounded text-xs overflow-auto">
          {`[
  {
    "date": "2025-11-04",
    "steps": 8500,
    "calories": 2200,
    "distance": 6.5
  }
]`}
        </code>
      </div>
    </div>
  );
}
```

### Step 3: Create Settings Component for Health Integrations

**File: src/components/HealthIntegrationSettings.tsx**

```typescript
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Capacitor } from '@capacitor/core';
import { useHealthKit } from '@/hooks/useHealthKit';
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';
import { HealthDataUpload } from './HealthDataUpload';

export function HealthIntegrationSettings() {
  const isNative = Capacitor.isNativePlatform();
  const healthKit = useHealthKit();
  const googleFit = useGoogleFitSync();
  const [isAuthorizingHealthKit, setIsAuthorizingHealthKit] = useState(false);

  const handleRequestHealthKitAccess = async () => {
    if (!isNative) {
      alert('Apple HealthKit is only available on native iOS devices');
      return;
    }

    setIsAuthorizingHealthKit(true);
    try {
      await healthKit.requestAuthorization();
      alert('Apple HealthKit access granted!');
    } catch (error) {
      alert('Failed to request Apple HealthKit access');
      console.error(error);
    } finally {
      setIsAuthorizingHealthKit(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Health Integrations</CardTitle>
          <CardDescription>
            Connect your health data sources to track fitness and nutrition
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Apple Health - Native Only */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold">Apple Health</h3>
                <p className="text-sm text-muted-foreground">
                  iOS native app only - Read your health metrics
                </p>
              </div>
              <Badge variant={isNative ? 'default' : 'secondary'}>
                {isNative ? 'Available' : 'Web Only'}
              </Badge>
            </div>
            
            {isNative ? (
              <Button
                onClick={handleRequestHealthKitAccess}
                disabled={isAuthorizingHealthKit || healthKit.isAuthorized}
                variant={healthKit.isAuthorized ? 'outline' : 'default'}
              >
                {isAuthorizingHealthKit && 'Requesting access...'}
                {!isAuthorizingHealthKit && healthKit.isAuthorized && '✓ Connected'}
                {!isAuthorizingHealthKit && !healthKit.isAuthorized && 'Connect to Apple Health'}
              </Button>
            ) : (
              <p className="text-sm text-amber-600">
                💡 Download the iOS app to sync Apple Health data automatically
              </p>
            )}
          </div>

          {/* Google Fit - Works on Web + Native */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold">Google Fit</h3>
                <p className="text-sm text-muted-foreground">
                  Web & Android - Connect your Google account
                </p>
              </div>
              <Badge variant={googleFit.isConnected ? 'default' : 'secondary'}>
                {googleFit.isConnected ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
            
            <Button
              onClick={googleFit.isConnected ? googleFit.disconnect : googleFit.connect}
              variant={googleFit.isConnected ? 'destructive' : 'default'}
            >
              {googleFit.isConnected ? 'Disconnect Google Fit' : 'Connect to Google Fit'}
            </Button>
          </div>

          {/* Manual Upload */}
          <div>
            <h3 className="font-semibold mb-3">Manual Data Import</h3>
            <HealthDataUpload />
          </div>

          {/* Data Sources Priority */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Data Priority</h4>
            <ol className="text-sm space-y-1 text-muted-foreground">
              <li>1. Garmin .fit files (most accurate)</li>
              <li>2. Google Fit (if connected)</li>
              <li>3. Apple Health (iOS native app)</li>
              <li>4. Manual entry (lowest priority)</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 4: Update AppIntegrations Page

**File: src/pages/AppIntegrations.tsx**

Add the new health integration settings:

```typescript
import { HealthIntegrationSettings } from '@/components/HealthIntegrationSettings';

export default function AppIntegrations() {
  return (
    <div>
      {/* ... existing code ... */}
      
      {/* Add this section */}
      <HealthIntegrationSettings />
    </div>
  );
}
```

---

## Data Flow for PWA Users

### Scenario: User on Web PWA

```
PWA User → No Apple Health (Browser limitation)
           ↓
           ├─ Google Fit (OAuth) ✅
           ├─ Upload .fit file ✅
           ├─ Upload Apple Health XML ✅
           └─ Manual entry ✅
           ↓
           Supabase wearable_data table
           ↓
           Dashboard displays health metrics
```

### Scenario: User on iOS Native App

```
iOS User → Apple HealthKit (Native)
         ↓
         useHealthKit hook
         ↓
         Fetch today's data
         ↓
         Save to Supabase wearable_data
         ↓
         Native app displays
         ↓
         When user logs into PWA on same account
         PWA shows same data (from database)
```

### Scenario: Same User on Both

```
Day 1 (iOS Native):
  - Open native app
  - Apple Health → useHealthKit → Saves to database
  
Same Day (Web PWA):
  - User logs in to PWA on Safari
  - Load today's data from database
  - See the same health metrics from Apple Health
  - Can also manually upload additional data

Day 2 (Web PWA):
  - User uploads .fit file from device
  - Data saved to database

Day 2 (iOS Native):
  - Native app syncs with Apple Health
  - Pulls latest wearable_data from database
  - All data combined
```

---

## Summary: What Works Where

| Feature | PWA | Native |
|---------|-----|--------|
| Apple Health Read | ❌ No (browser) | ✅ Yes (Health plugin) |
| Apple Health Write | ❌ No | ✅ Yes (future) |
| Google Fit | ✅ Yes (OAuth) | ✅ Yes (plugin) |
| .fit Upload | ✅ Yes | ✅ Yes |
| Manual Entry | ✅ Yes | ✅ Yes |
| Local Notifications | ⚠️ Limited | ✅ Yes |
| Background Sync | ⚠️ Service Worker | ✅ Yes |

---

## Key Takeaway

**You CAN'T directly access Apple Health from PWA**, but you CAN:
1. ✅ Read from database (which native app populates)
2. ✅ Accept manual uploads (Apple Health XML)
3. ✅ Use Google Fit (works on web)
4. ✅ Sync when user is on native app

This is the recommended approach - it leverages both platforms' strengths without trying to force capabilities where they don't exist.
