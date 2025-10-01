import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

interface GoogleFitData {
  steps: number;
  calories: number;
  activeMinutes: number;
  heartRate: number;
  distance: number;
  date: string;
}

interface GoogleFitConfig {
  clientId: string;
  apiKey: string;
  discoveryDocs: string[];
  scopes: string[];
}

export function useGoogleFit() {
  const { user } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google Fit configuration
  const config: GoogleFitConfig = {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/fitness/v1/rest'],
    scopes: [
      'https://www.googleapis.com/auth/fitness.activity.read',
      'https://www.googleapis.com/auth/fitness.body.read',
      'https://www.googleapis.com/auth/fitness.location.read'
    ]
  };

  // Load Google APIs
  useEffect(() => {
    const loadGoogleAPIs = async () => {
      if (window.gapi) {
        setIsLoaded(true);
        return;
      }

      try {
        // Load Google API script
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://apis.google.com/js/api.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });

        // Load GAPI
        await new Promise((resolve, reject) => {
          window.gapi.load('client:auth2', { callback: resolve, onerror: reject });
        });

        // Initialize client
        await window.gapi.client.init({
          apiKey: config.apiKey,
          clientId: config.clientId,
          discoveryDocs: config.discoveryDocs,
          scope: config.scopes.join(' ')
        });

        setIsLoaded(true);
      } catch (err) {
        console.error('Failed to load Google APIs:', err);
        setError('Failed to load Google Fit API. Please check your API credentials.');
      }
    };

    // Only load if we have the required credentials
    if (config.clientId) {
      if (config.apiKey) {
        loadGoogleAPIs();
      } else {
        setError('Google Fit API key not configured. Please add VITE_GOOGLE_API_KEY to your environment variables.');
      }
    } else {
      setError('Google Fit Client ID not configured. Please add VITE_GOOGLE_CLIENT_ID to your environment variables.');
    }
  }, [config.clientId, config.apiKey]);

  // Check authorization status
  const checkAuthStatus = useCallback(() => {
    if (!isLoaded || !window.gapi) return;

    const authInstance = window.gapi.auth2.getAuthInstance();
    if (authInstance) {
      setIsAuthorized(authInstance.isSignedIn.get());
    }
  }, [isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      checkAuthStatus();
    }
  }, [isLoaded, checkAuthStatus]);

  // Authorize Google Fit
  const authorize = async (): Promise<boolean> => {
    if (!isLoaded || !window.gapi) {
      setError('Google APIs not loaded');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      const user = await authInstance.signIn();
      
      if (user.isSignedIn()) {
        setIsAuthorized(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Authorization failed:', err);
      setError('Failed to authorize Google Fit');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    if (!isLoaded || !window.gapi) return;

    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signOut();
      setIsAuthorized(false);
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  // Fetch today's data
  const fetchTodayData = async (): Promise<GoogleFitData | null> => {
    if (!isLoaded || !isAuthorized || !window.gapi) {
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      // Fetch steps
      const stepsResponse = await window.gapi.client.fitness.users.dataset.aggregate({
        userId: 'me',
        requestBody: {
          aggregateBy: [{
            dataTypeName: 'com.google.step_count.delta',
            dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
          }],
          bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
          startTimeMillis: startOfDay.getTime(),
          endTimeMillis: endOfDay.getTime()
        }
      });

      // Fetch calories
      const caloriesResponse = await window.gapi.client.fitness.users.dataset.aggregate({
        userId: 'me',
        requestBody: {
          aggregateBy: [{
            dataTypeName: 'com.google.calories.expended',
            dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended'
          }],
          bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
          startTimeMillis: startOfDay.getTime(),
          endTimeMillis: endOfDay.getTime()
        }
      });

      // Fetch active minutes
      const activeMinutesResponse = await window.gapi.client.fitness.users.dataset.aggregate({
        userId: 'me',
        requestBody: {
          aggregateBy: [{
            dataTypeName: 'com.google.active_minutes',
            dataSourceId: 'derived:com.google.active_minutes:com.google.android.gms:merge_active_minutes'
          }],
          bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
          startTimeMillis: startOfDay.getTime(),
          endTimeMillis: endOfDay.getTime()
        }
      });

      // Process responses
      const steps = stepsResponse.result.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
      const calories = Math.round(caloriesResponse.result.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0);
      const activeMinutes = Math.round(activeMinutesResponse.result.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0);

      return {
        steps,
        calories,
        activeMinutes,
        heartRate: 0, // Would need separate query
        distance: 0, // Would need separate query
        date: today.toISOString().split('T')[0]
      };
    } catch (err) {
      console.error('Failed to fetch Google Fit data:', err);
      setError('Failed to fetch health data');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch historical data
  const fetchHistoricalData = async (days: number = 7): Promise<GoogleFitData[]> => {
    if (!isLoaded || !isAuthorized || !window.gapi) {
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
      
      // Similar to fetchTodayData but with date range
      // Implementation would be similar but with different time ranges
      
      return []; // Placeholder - implement based on your needs
    } catch (err) {
      console.error('Failed to fetch historical data:', err);
      setError('Failed to fetch historical data');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoaded,
    isAuthorized,
    isLoading,
    error,
    authorize,
    signOut,
    fetchTodayData,
    fetchHistoricalData,
    checkAuthStatus
  };
}

// Extend Window interface for Google APIs
declare global {
  interface Window {
    gapi: any;
  }
}
