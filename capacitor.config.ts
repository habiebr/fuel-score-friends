import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nutrisync.app',
  appName: 'Nutrisync',
  webDir: 'dist',
  // Production URL - Update before building for TestFlight
  server: {
    url: 'https://cursor.nutrisync.pages.dev',
    cleartext: true
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    backgroundColor: '#ffffff'
  },
  android: {
    backgroundColor: '#ffffff'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#1e40af',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small'
    },
    Health: {
      read: ['steps', 'calories', 'heartRate', 'distance', 'activeMinutes'],
      write: []
    },
    Keyboard: {
      resize: 'ionic',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#1e40af'
    }
  }
};

export default config;
