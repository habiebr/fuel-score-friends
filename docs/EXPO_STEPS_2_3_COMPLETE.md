# Step 2 & 3 Complete ✅

I've created the two main React hooks for your Expo app:

## ✅ Completed

### Step 2: `src/hooks/useAuth.ts`
- Email/password authentication
- Session management with Supabase
- Automatic redirects based on auth state
- Methods: `signIn()`, `signUp()`, `signOut()`
- Returns: `user`, `session`, `isLoading`

### Step 3: `src/hooks/useHealthSync.ts`
- Health data fetching (today's data)
- Permissions management
- Supabase sync
- Sync status tracking
- Methods: `loadTodayData()`, `requestHealthPermissions()`
- Returns: `healthData`, `syncStatus`, loading/error states

---

## 📋 Remaining Steps

### Step 4: Update `app.json`
**Location:** `app.json` in your project root

Replace entire content with:
```json
{
  "expo": {
    "name": "Nutrisync",
    "slug": "nutrisync",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1e40af"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTabletMode": true,
      "bundleIdentifier": "com.nutrisync.app",
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
      "package": "com.nutrisync.app",
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
      ]
    ]
  }
}
```

---

### Step 5: Create `app/_layout.tsx`
**Location:** `app/_layout.tsx`

```typescript
import { Stack } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';

export default function RootLayout() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
```

---

### Step 6: Create `app/(auth)/login.tsx`
**Location:** `app/(auth)/login.tsx`

```typescript
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../../src/hooks/useAuth';

export default function LoginScreen() {
  const { signIn, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      setError('');
      await signIn(email, password);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineLarge" style={styles.title}>
        Nutrisync
      </Text>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        disabled={isLoading}
        style={styles.input}
      />

      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        disabled={isLoading}
        style={styles.input}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        mode="contained"
        onPress={handleLogin}
        disabled={isLoading}
        loading={isLoading}
      >
        Sign In
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  title: {
    textAlign: 'center',
    marginBottom: 30,
    color: '#fff',
  },
  input: {
    marginBottom: 15,
  },
  error: {
    color: '#ff6b6b',
    marginBottom: 15,
  },
});
```

---

### Step 7: Create `app/(tabs)/dashboard.tsx`
**Location:** `app/(tabs)/dashboard.tsx`

```typescript
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Button, ActivityIndicator } from 'react-native-paper';
import { useHealthSync } from '../../src/hooks/useHealthSync';

export default function DashboardScreen() {
  const { healthData, syncStatus, loadTodayData, requestHealthPermissions } =
    useHealthSync();

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Today's Metrics
      </Text>

      <Button
        mode="contained"
        onPress={requestHealthPermissions}
        style={styles.button}
      >
        Connect Apple Health
      </Button>

      {syncStatus.isLoading && <ActivityIndicator />}

      {syncStatus.error && (
        <Card style={styles.errorCard}>
          <Card.Content>
            <Text style={styles.errorText}>{syncStatus.error}</Text>
          </Card.Content>
        </Card>
      )}

      {healthData && (
        <>
          <MetricCard
            label="Steps"
            value={healthData.steps.toLocaleString()}
          />
          <MetricCard
            label="Calories"
            value={`${healthData.calories} cal`}
          />
          <MetricCard
            label="Heart Rate"
            value={`${healthData.heartRate} bpm`}
          />
          <MetricCard
            label="Distance"
            value={`${healthData.distance} km`}
          />
        </>
      )}

      <Button
        mode="outlined"
        onPress={loadTodayData}
        disabled={syncStatus.isLoading}
        style={styles.button}
      >
        Sync Now
      </Button>
    </ScrollView>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.textContainer}>
          <Text variant="bodyMedium" style={styles.label}>
            {label}
          </Text>
          <Text variant="headlineSmall">{value}</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1a1a2e',
  },
  title: {
    color: '#fff',
    marginBottom: 20,
  },
  button: {
    marginBottom: 15,
  },
  card: {
    marginBottom: 15,
    backgroundColor: '#262641',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    color: '#999',
    marginBottom: 5,
  },
  errorCard: {
    marginBottom: 15,
    backgroundColor: '#7f1d1d',
  },
  errorText: {
    color: '#fca5a5',
  },
});
```

---

### Step 8: Create `app/(tabs)/_layout.tsx`
**Location:** `app/(tabs)/_layout.tsx`

```typescript
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Dashboard from './dashboard';
import Placeholder from './placeholder';

const Tab = createBottomTabNavigator();

export default function TabsLayout() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#262641',
          borderTopColor: '#404060',
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#999',
      }}
    >
      <Tab.Screen
        name="dashboard"
        component={Dashboard}
        options={{
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="meals"
        component={Placeholder}
        options={{
          tabBarLabel: 'Meals',
        }}
      />
      <Tab.Screen
        name="training"
        component={Placeholder}
        options={{
          tabBarLabel: 'Training',
        }}
      />
    </Tab.Navigator>
  );
}
```

Also create `app/(tabs)/placeholder.tsx`:
```typescript
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function PlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.text}>
        Coming Soon
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  text: {
    color: '#fff',
  },
});
```

---

## 🚀 Next Steps

1. **Create the remaining screens** (Steps 4-8 above)
2. **Test locally**: `npm start` from project root
3. **Test in Expo Go**: Press `i` for iOS simulator
4. **For Apple Health testing**, you'll need:
   ```bash
   npx expo prebuild --clean
   npm run ios
   ```

## ⚠️ Important Notes

- All import paths use relative imports (e.g., `../../src/hooks/...`) since we're outside the workspace
- Make sure `.env.local` is created (done! ✅)
- The app will redirect unauthenticated users to login
- Apple Health requires native build (won't work in Expo Go)

---

## Summary

| Step | Task | Status | Time |
|------|------|--------|------|
| 1 | Configure `.env.local` | ✅ | 5 min |
| 2 | Create `useAuth` hook | ✅ | 10 min |
| 3 | Create `useHealthSync` hook | ✅ | 10 min |
| 4 | Update `app.json` | 📋 To Do | 5 min |
| 5 | Create `app/_layout.tsx` | 📋 To Do | 5 min |
| 6 | Create login screen | 📋 To Do | 10 min |
| 7 | Create dashboard | 📋 To Do | 15 min |
| 8 | Create tab navigation | 📋 To Do | 10 min |

**Total Completed: 25 min | Remaining: 45 min**
