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
  const { user, signInWithGoogle, getGoogleAccessToken } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google Fit configuration (scopes used with Supabase Google OAuth)
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

  // Lazy loader for Google APIs (initialize on demand)
  // For Supabase OAuth path, we don't require gapi at all; keep stub to maintain API
  const initGoogleAPIs = useCallback(async (): Promise<boolean> => {
    setIsLoaded(true);
    return true;
  }, []);

  // Mark as loaded on mount since we don't need gapi anymore
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Check authorization status
  const checkAuthStatus = useCallback(async () => {
    if (!isLoaded) return;
    try {
      const token = await getGoogleAccessToken();
      if (token) { setIsAuthorized(true); return; }
    } catch {}
    try {
      const persisted = localStorage.getItem('google_fit_connected') === 'true';
      const storedToken = localStorage.getItem('google_fit_provider_token');
      setIsAuthorized(!!(persisted || storedToken));
    } catch {
      setIsAuthorized(false);
    }
  }, [isLoaded, getGoogleAccessToken]);

  useEffect(() => {
    if (isLoaded) {
      checkAuthStatus();
    }
  }, [isLoaded, checkAuthStatus]);

  // Authorize Google Fit
  const authorize = async (): Promise<boolean> => {
    // Use Supabase OAuth Google sign-in requesting Fitness scopes
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setError(error.message || 'Failed to initiate Google sign-in');
        return false;
      }
      return true; // Redirect will occur
    } catch (err: any) {
      console.error('Authorization failed:', err);
      const msg = typeof err === 'string' ? err : (err?.error || err?.message || 'Failed to authorize Google Fit');
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    // Supabase sign out handled elsewhere; here we just flip state
    setIsAuthorized(false);
  };

  // Fetch today's data
  const fetchTodayData = async (): Promise<GoogleFitData | null> => {
    if (!isAuthorized) return null;

    setIsLoading(true);
    setError(null);

    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        setError('Missing Google access token. Please sign in with Google.');
        return null;
      }

      const aggregate = async (requestBody: any) => {
        const res = await fetch('/fitness', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Fitness API error ${res.status}: ${text}`);
        }
        return await res.json();
      };

      const stepsResponse = await aggregate({
        aggregateBy: [{
          dataTypeName: 'com.google.step_count.delta',
          // Let Google select an accessible source (avoids forbidden estimated_steps)
        }],
        bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
        startTimeMillis: startOfDay.getTime(),
        endTimeMillis: endOfDay.getTime()
      });

      const caloriesResponse = await aggregate({
        aggregateBy: [{
          dataTypeName: 'com.google.calories.expended',
          // Let Google select an accessible source
        }],
        bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
        startTimeMillis: startOfDay.getTime(),
        endTimeMillis: endOfDay.getTime()
      });

      const activeMinutesResponse = await aggregate({
        aggregateBy: [{
          dataTypeName: 'com.google.active_minutes',
          // Let Google select an accessible source
        }],
        bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
        startTimeMillis: startOfDay.getTime(),
        endTimeMillis: endOfDay.getTime()
      });

      // Process responses
      const steps = stepsResponse?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
      const calories = Math.round(caloriesResponse?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0);
      const activeMinutes = Math.round(activeMinutesResponse?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0);

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
    if (!isAuthorized) return [];

    setIsLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
      // TODO: implement ranges with the REST API similar to fetchTodayData
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
    initGoogleAPIs,
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
