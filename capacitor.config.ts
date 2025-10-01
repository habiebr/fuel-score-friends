import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.95aad8de18da43a3b9f630c9f277f405',
  appName: 'Nutrisync',
  webDir: 'dist',
  server: {
    url: 'https://95aad8de-18da-43a3-b9f6-30c9f277f405.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
