# Expo Implementation Roadmap for Nutrisync

## Quick Start: Setting Up Expo Project

### Step 1: Initialize Expo Project

```bash
# Create new Expo project
npx create-expo-app@latest nutrisync-mobile --template

# Navigate to project
cd nutrisync-mobile

# Install TypeScript support
npm install --save-dev typescript @types/react

# Create TypeScript config
npx tsc --init
```

### Step 2: Install Core Dependencies

```bash
# Navigation & routing
npm install expo-router expo-linking

# State management (if needed)
npm install zustand @tanstack/react-query

# UI Components
npm install react-native-paper

# Icons
npm install @react-native-community/hooks react-native-vector-icons

# Database & Auth
npm install @supabase/supabase-js @supabase/react-native-http-client

# Health
npm install react-native-health

# Notifications
npm install expo-notifications

# Storage
npm install @react-native-async-storage/async-storage

# Forms
npm install react-hook-form zod @hookform/resolvers

# Dates
npm install date-fns
```

### Step 3: Configure app.json

```json
{
  "expo": {
    "name": "Nutrisync",
    "slug": "nutrisync",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1e40af"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTabletMode": true,
      "infoPlist": {
        "NSHealthShareUsageDescription": "We need access to read your health data to track your nutrition and activity",
        "NSHealthUpdateUsageDescription": "We need access to update your health data"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1e40af"
      },
      "permissions": [
        "android.permission.ACTIVITY_RECOGNITION",
        "android.permission.READ_HEALTH_DATA"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#1e40af"
        }
      ],
      [
        "react-native-health",
        {
          "permissions": [
            "HKQuantityTypeIdentifierStepCount",
            "HKQuantityTypeIdentifierActiveEnergyBurned",
            "HKQuantityTypeIdentifierHeartRate",
            "HKQuantityTypeIdentifierDistanceWalkingRunning",
            "HKCategoryTypeIdentifierAppleStandHour"
          ]
        }
      ]
    ]
  }
}
```

---

## Project Structure

```
nutrisync-mobile/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/
│   │   ├── dashboard.tsx
│   │   ├── meals.tsx
│   │   ├── training.tsx
│   │   └── profile.tsx
│   ├── _layout.tsx
│   └── index.tsx
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Input.tsx
│   ├── HealthWidget.tsx
│   ├── NotificationManager.tsx
│   └── TrainingCard.tsx
├── hooks/
│   ├── useHealthKit.ts
│   ├── useHealthSync.ts
│   ├── useNotifications.ts
│   └── useAuth.ts
├── services/
│   ├── supabase.ts
│   ├── health.service.ts
│   ├── notification.service.ts
│   └── score.service.ts
├── utils/
│   ├── constants.ts
│   ├── formatting.ts
│   └── validation.ts
├── types/
│   ├── health.ts
│   ├── training.ts
│   └── nutrition.ts
├── assets/
│   ├── icon.png
│   ├── splash.png
│   └── notification-icon.png
├── app.json
├── app.config.ts
├── eas.json
├── tsconfig.json
└── package.json
```

---

## Key Implementation Files

### 1. Supabase Client Setup

**File: services/supabase.ts**

```typescript
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Session manager for persistence
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    try {
      return SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Error getting item from SecureStore:', error);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Error setting item in SecureStore:', error);
    }
  },
  removeItem: (key: string) => {
    try {
      return SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error removing item from SecureStore:', error);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### 2. Apple Health Integration

**File: services/health.service.ts**

```typescript
import * as HealthKit from 'react-native-health';
import { supabase } from './supabase';

interface HealthData {
  steps: number;
  calories: number;
  activeMinutes: number;
  heartRate: number;
  distance: number;
  date: string;
  source: 'apple_health' | 'google_fit';
}

const HEALTH_PERMISSIONS = {
  permissions: {
    read: [
      HealthKit.HKQuantityTypeIdentifierStepCount,
      HealthKit.HKQuantityTypeIdentifierActiveEnergyBurned,
      HealthKit.HKQuantityTypeIdentifierHeartRate,
      HealthKit.HKQuantityTypeIdentifierDistanceWalkingRunning,
    ] as const,
  },
};

export class HealthService {
  static async requestAuthorization(): Promise<boolean> {
    try {
      await HealthKit.requestAuthorization(HEALTH_PERMISSIONS.permissions.read);
      return true;
    } catch (error) {
      console.error('Failed to request health authorization:', error);
      return false;
    }
  }

  static async getTodayData(): Promise<HealthData | null> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const [steps, calories, heartRate, distance] = await Promise.all([
        HealthKit.getStepCount({
          startDate: startOfDay,
          endDate: endOfDay,
          period_unit: 'day'
        }),
        HealthKit.getActiveEnergyBurned({
          startDate: startOfDay,
          endDate: endOfDay,
          period_unit: 'day'
        }),
        HealthKit.getHeartRateSamples({
          startDate: startOfDay,
          endDate: endOfDay,
          period_unit: 'day'
        }),
        HealthKit.getDistanceWalkingRunning({
          startDate: startOfDay,
          endDate: endOfDay,
          period_unit: 'day'
        }),
      ]);

      const heartRateAvg = heartRate.length > 0
        ? heartRate.reduce((sum, s) => sum + s.value, 0) / heartRate.length
        : 0;

      return {
        steps: Math.round(steps.value || 0),
        calories: Math.round(calories.value || 0),
        activeMinutes: Math.round((calories.value || 0) / 5), // Estimate
        heartRate: Math.round(heartRateAvg),
        distance: Math.round((distance.value || 0) * 100) / 100, // km
        date: today.toISOString().split('T')[0],
        source: 'apple_health'
      };
    } catch (error) {
      console.error('Failed to get today\'s health data:', error);
      return null;
    }
  }

  static async getHistoricalData(days: number = 7): Promise<HealthData[]> {
    const data: HealthData[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

      try {
        const [steps, calories, heartRate, distance] = await Promise.all([
          HealthKit.getStepCount({
            startDate: startOfDay,
            endDate: endOfDay,
            period_unit: 'day'
          }),
          HealthKit.getActiveEnergyBurned({
            startDate: startOfDay,
            endDate: endOfDay,
            period_unit: 'day'
          }),
          HealthKit.getHeartRateSamples({
            startDate: startOfDay,
            endDate: endOfDay,
            period_unit: 'day'
          }),
          HealthKit.getDistanceWalkingRunning({
            startDate: startOfDay,
            endDate: endOfDay,
            period_unit: 'day'
          }),
        ]);

        const heartRateAvg = heartRate.length > 0
          ? heartRate.reduce((sum, s) => sum + s.value, 0) / heartRate.length
          : 0;

        data.push({
          steps: Math.round(steps.value || 0),
          calories: Math.round(calories.value || 0),
          activeMinutes: Math.round((calories.value || 0) / 5),
          heartRate: Math.round(heartRateAvg),
          distance: Math.round((distance.value || 0) * 100) / 100,
          date: date.toISOString().split('T')[0],
          source: 'apple_health'
        });
      } catch (error) {
        console.error(`Failed to get health data for ${date.toDateString()}:`, error);
      }
    }

    return data;
  }

  static async saveToSupabase(userId: string, data: HealthData): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('wearable_data')
        .upsert({
          user_id: userId,
          date: data.date,
          steps: data.steps,
          calories_burned: data.calories,
          active_minutes: data.activeMinutes,
          heart_rate_avg: data.heartRate,
          distance: data.distance,
          source: data.source,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,date'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to save health data to Supabase:', error);
      return false;
    }
  }
}
```

### 3. Notifications Setup

**File: services/notification.service.ts**

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from './supabase';
import { addDays, getHours, getMinutes } from 'date-fns';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class NotificationService {
  static async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  static async getExpoPushToken(): Promise<string | null> {
    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });
      return token.data;
    } catch (error) {
      console.error('Failed to get Expo push token:', error);
      return null;
    }
  }

  static async schedulePreTrainingNotification(
    trainingDate: string,
    activity: {
      activity_type: string;
      duration_minutes: number;
      intensity: string;
    }
  ): Promise<void> {
    try {
      const notificationDate = addDays(new Date(trainingDate), -1); // 1 day before
      const hours = getHours(notificationDate);
      const minutes = getMinutes(notificationDate);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Pre-Training Nutrition for ${activity.activity_type}`,
          body: `Tomorrow you have ${activity.activity_type} scheduled. Here's your nutrition plan: high carbs, moderate protein. Eat 2-3 hours before workout.`,
          data: {
            trainingDate,
            activityType: activity.activity_type,
            type: 'pre_training'
          },
          badge: 1,
          sound: 'default',
        },
        trigger: {
          hour: hours,
          minute: minutes,
          repeats: false,
        },
      });
    } catch (error) {
      console.error('Failed to schedule pre-training notification:', error);
    }
  }

  static async schedulePostTrainingNotification(
    trainingDate: string,
    activity: { activity_type: string; duration_minutes: number }
  ): Promise<void> {
    try {
      // 2 hours after training ends (estimated)
      const notificationDate = addDays(new Date(trainingDate), 0);
      const hours = getHours(notificationDate) + Math.ceil(activity.duration_minutes / 60) + 2;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Post-Training Recovery for ${activity.activity_type}`,
          body: `Great workout! Now focus on recovery nutrition: carbs + protein within 30 mins. Your personalized recovery plan is ready.`,
          data: {
            trainingDate,
            type: 'post_training'
          },
          badge: 1,
        },
        trigger: {
          hour: hours,
          repeats: false,
        },
      });
    } catch (error) {
      console.error('Failed to schedule post-training notification:', error);
    }
  }

  static async scheduleMealReminder(
    mealTime: string,
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  ): Promise<void> {
    try {
      const [hours, minutes] = mealTime.split(':').map(Number);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time for ${mealType}`,
          body: `Your personalized ${mealType} plan is ready. Log your meal to track nutrition.`,
          data: { type: 'meal_reminder', mealType },
          badge: 1,
        },
        trigger: {
          hour: hours,
          minute: minutes,
          repeats: true,
        },
      });
    } catch (error) {
      console.error('Failed to schedule meal reminder:', error);
    }
  }

  static async setupNotificationListeners(userId: string): Promise<void> {
    // Handle notification when app is in foreground
    const foregroundNotificationSubscription =
      Notifications.addNotificationReceivedListener(async (notification) => {
        console.log('Notification received:', notification);
        
        // Could store this in Supabase for tracking
        const { data } = notification.request.content.data;
        if (data) {
          await supabase
            .from('training_notifications')
            .insert({
              user_id: userId,
              type: data.type,
              data: data,
              is_read: false,
            });
        }
      });

    // Handle notification when user taps it
    const notificationResponseSubscription =
      Notifications.addNotificationResponseReceivedListener(async (response) => {
        const { data } = response.notification.request.content.data;
        
        // Navigate to relevant screen based on notification type
        switch (data?.type) {
          case 'pre_training':
            // Navigate to training details
            break;
          case 'meal_reminder':
            // Navigate to meal logging
            break;
        }
      });

    return () => {
      foregroundNotificationSubscription.remove();
      notificationResponseSubscription.remove();
    };
  }
}
```

### 4. Custom Hook: useHealthSync

**File: hooks/useHealthSync.ts**

```typescript
import { useState, useEffect } from 'react';
import { HealthService } from '@/services/health.service';
import { supabase } from '@/services/supabase';

interface HealthData {
  steps: number;
  calories: number;
  activeMinutes: number;
  heartRate: number;
  distance: number;
  date: string;
  source: string;
}

interface SyncStatus {
  isLoading: boolean;
  lastSync: Date | null;
  error: string | null;
}

export function useHealthSync() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isLoading: false,
    lastSync: null,
    error: null,
  });

  // Request permissions on mount
  useEffect(() => {
    const setupHealth = async () => {
      const authorized = await HealthService.requestAuthorization();
      if (authorized) {
        await syncHealthData(false);
      }
    };
    setupHealth();
  }, []);

  const syncHealthData = async (force: boolean = false) => {
    setSyncStatus(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get today's data from HealthKit
      const todayData = await HealthService.getTodayData();
      if (!todayData) throw new Error('Failed to fetch health data');

      // Save to Supabase
      await HealthService.saveToSupabase(user.id, todayData);

      setHealthData(todayData);
      setSyncStatus(prev => ({
        ...prev,
        isLoading: false,
        lastSync: new Date(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setSyncStatus(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  };

  return {
    healthData,
    syncStatus,
    syncHealthData,
  };
}
```

### 5. Dashboard Screen Example

**File: app/(tabs)/dashboard.tsx**

```typescript
import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Button, Text, ProgressBar } from 'react-native-paper';
import { useHealthSync } from '@/hooks/useHealthSync';

export default function DashboardScreen() {
  const { healthData, syncStatus, syncHealthData } = useHealthSync();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium">Today's Overview</Text>
        <Button
          mode="contained"
          onPress={() => syncHealthData(true)}
          loading={syncStatus.isLoading}
        >
          Sync Health
        </Button>
      </View>

      {syncStatus.error && (
        <Card style={styles.errorCard}>
          <Card.Content>
            <Text style={{ color: 'red' }}>{syncStatus.error}</Text>
          </Card.Content>
        </Card>
      )}

      {healthData && (
        <>
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="labelLarge">Steps</Text>
              <Text variant="headlineLarge">{healthData.steps.toLocaleString()}</Text>
              <ProgressBar
                progress={Math.min(healthData.steps / 10000, 1)}
                style={styles.progressBar}
              />
              <Text variant="bodySmall">of 10,000 goal</Text>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="labelLarge">Calories Burned</Text>
              <Text variant="headlineLarge">{healthData.calories} cal</Text>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="labelLarge">Heart Rate (Avg)</Text>
              <Text variant="headlineLarge">{healthData.heartRate} bpm</Text>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text variant="labelLarge">Active Minutes</Text>
              <Text variant="headlineLarge">{healthData.activeMinutes} min</Text>
            </Card.Content>
          </Card>

          {syncStatus.lastSync && (
            <Text style={styles.lastSync}>
              Last synced: {syncStatus.lastSync.toLocaleTimeString()}
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    marginBottom: 16,
    gap: 8,
  },
  card: {
    marginBottom: 12,
  },
  progressBar: {
    height: 4,
    marginVertical: 8,
  },
  errorCard: {
    marginBottom: 16,
    backgroundColor: '#ffebee',
  },
  lastSync: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 16,
  },
});
```

---

## EAS Configuration

**File: eas.json**

```json
{
  "cli": {
    "version": ">= 7.1.0"
  },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": true
      }
    },
    "preview2": {
      "android": {
        "buildType": "apk"
      }
    },
    "preview3": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

---

## Environment Variables

**File: .env.local**

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
```

---

## Next Steps

1. **Set up Expo project** using the commands above
2. **Test health data sync** with a real iPhone
3. **Implement notifications** with local scheduling first
4. **Build with EAS** for TestFlight distribution
5. **Gradually migrate screens** from Capacitor app

---

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [Expo Health](https://docs.expo.dev/versions/latest/sdk/health/)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [EAS Documentation](https://docs.expo.dev/eas/)
