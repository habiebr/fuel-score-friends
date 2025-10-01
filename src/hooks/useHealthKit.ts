import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Health } from 'capacitor-health';

interface HealthData {
  steps: number;
  calories: number;
  activeMinutes: number;
  heartRate: number;
  distance: number;
  date: string;
  source: 'apple_health' | 'google_fit' | 'manual';
}

interface HealthPermissions {
  steps: boolean;
  calories: boolean;
  heartRate: boolean;
  distance: boolean;
  activeMinutes: boolean;
}

export function useHealthKit() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [permissions, setPermissions] = useState<HealthPermissions>({
    steps: false,
    calories: false,
    heartRate: false,
    distance: false,
    activeMinutes: false
  });

  useEffect(() => {
    // Check if running on native platform
    const isNative = Capacitor.isNativePlatform();
    setIsAvailable(isNative);
    
    if (isNative) {
      checkAuthorizationStatus();
    }
  }, []);

  const checkAuthorizationStatus = async () => {
    if (!isAvailable) return;

    try {
      const result = await Health.checkAuthStatus({
        read: ['steps', 'calories', 'heartRate', 'distance', 'activeMinutes']
      });
      
      setPermissions({
        steps: result.steps === 'granted',
        calories: result.calories === 'granted',
        heartRate: result.heartRate === 'granted',
        distance: result.distance === 'granted',
        activeMinutes: result.activeMinutes === 'granted'
      });

      setIsAuthorized(Object.values(result).some(status => status === 'granted'));
    } catch (error) {
      console.error('Failed to check authorization status:', error);
    }
  };

  const requestAuthorization = async () => {
    if (!isAvailable) {
      throw new Error('HealthKit is only available on native iOS devices');
    }

    try {
      const result = await Health.requestAuthStatus({
        read: ['steps', 'calories', 'heartRate', 'distance', 'activeMinutes']
      });

      setPermissions({
        steps: result.steps === 'granted',
        calories: result.calories === 'granted',
        heartRate: result.heartRate === 'granted',
        distance: result.distance === 'granted',
        activeMinutes: result.activeMinutes === 'granted'
      });

      setIsAuthorized(Object.values(result).some(status => status === 'granted'));
      return result;
    } catch (error) {
      console.error('Failed to authorize HealthKit:', error);
      throw error;
    }
  };

  const fetchTodayData = async (): Promise<HealthData | null> => {
    if (!isAvailable || !isAuthorized) {
      return null;
    }

    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const [stepsResult, caloriesResult, heartRateResult, distanceResult, activeMinutesResult] = await Promise.allSettled([
        permissions.steps ? Health.queryHKitSampleType({
          sampleName: 'steps',
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString()
        }) : Promise.resolve({ result: [] }),
        permissions.calories ? Health.queryHKitSampleType({
          sampleName: 'calories',
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString()
        }) : Promise.resolve({ result: [] }),
        permissions.heartRate ? Health.queryHKitSampleType({
          sampleName: 'heartRate',
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString()
        }) : Promise.resolve({ result: [] }),
        permissions.distance ? Health.queryHKitSampleType({
          sampleName: 'distance',
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString()
        }) : Promise.resolve({ result: [] }),
        permissions.activeMinutes ? Health.queryHKitSampleType({
          sampleName: 'activeMinutes',
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString()
        }) : Promise.resolve({ result: [] })
      ]);

      // Process results
      const steps = stepsResult.status === 'fulfilled' 
        ? stepsResult.value.result.reduce((sum: number, sample: any) => sum + (sample.quantity || 0), 0)
        : 0;

      const calories = caloriesResult.status === 'fulfilled'
        ? caloriesResult.value.result.reduce((sum: number, sample: any) => sum + (sample.quantity || 0), 0)
        : 0;

      const heartRateSamples = heartRateResult.status === 'fulfilled' ? heartRateResult.value.result : [];
      const heartRate = heartRateSamples.length > 0
        ? heartRateSamples.reduce((sum: number, sample: any) => sum + (sample.quantity || 0), 0) / heartRateSamples.length
        : 0;

      const distance = distanceResult.status === 'fulfilled'
        ? distanceResult.value.result.reduce((sum: number, sample: any) => sum + (sample.quantity || 0), 0)
        : 0;

      const activeMinutes = activeMinutesResult.status === 'fulfilled'
        ? activeMinutesResult.value.result.reduce((sum: number, sample: any) => sum + (sample.quantity || 0), 0)
        : 0;

      return {
        steps: Math.round(steps),
        calories: Math.round(calories),
        activeMinutes: Math.round(activeMinutes),
        heartRate: Math.round(heartRate),
        distance: Math.round(distance * 100) / 100, // Convert to km if needed
        date: today.toISOString().split('T')[0],
        source: 'apple_health'
      };
    } catch (error) {
      console.error('Failed to fetch health data:', error);
      return null;
    }
  };

  const fetchHistoricalData = async (days: number = 7): Promise<HealthData[]> => {
    if (!isAvailable || !isAuthorized) {
      return [];
    }

    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

      const [stepsResult, caloriesResult] = await Promise.allSettled([
        permissions.steps ? Health.queryHKitSampleType({
          sampleName: 'steps',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }) : Promise.resolve({ result: [] }),
        permissions.calories ? Health.queryHKitSampleType({
          sampleName: 'calories',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }) : Promise.resolve({ result: [] })
      ]);

      // Group data by date
      const dataByDate: { [key: string]: HealthData } = {};

      // Process steps
      if (stepsResult.status === 'fulfilled') {
        stepsResult.value.result.forEach((sample: any) => {
          const date = new Date(sample.startDate).toISOString().split('T')[0];
          if (!dataByDate[date]) {
            dataByDate[date] = {
              steps: 0,
              calories: 0,
              activeMinutes: 0,
              heartRate: 0,
              distance: 0,
              date,
              source: 'apple_health'
            };
          }
          dataByDate[date].steps += sample.quantity || 0;
        });
      }

      // Process calories
      if (caloriesResult.status === 'fulfilled') {
        caloriesResult.value.result.forEach((sample: any) => {
          const date = new Date(sample.startDate).toISOString().split('T')[0];
          if (!dataByDate[date]) {
            dataByDate[date] = {
              steps: 0,
              calories: 0,
              activeMinutes: 0,
              heartRate: 0,
              distance: 0,
              date,
              source: 'apple_health'
            };
          }
          dataByDate[date].calories += sample.quantity || 0;
        });
      }

      return Object.values(dataByDate).map(data => ({
        ...data,
        steps: Math.round(data.steps),
        calories: Math.round(data.calories)
      }));
    } catch (error) {
      console.error('Failed to fetch historical health data:', error);
      return [];
    }
  };

  return {
    isAvailable,
    isAuthorized,
    permissions,
    requestAuthorization,
    fetchTodayData,
    fetchHistoricalData,
    checkAuthorizationStatus
  };
}
