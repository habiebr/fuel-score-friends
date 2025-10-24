import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { fetchOptimizedDashboardData, fetchCriticalDashboardData, OptimizedDashboardData } from '@/services/optimized-dashboard.service';

export function useOptimizedDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<OptimizedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const loadCriticalData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      // Load critical data first for immediate display
      const criticalData = await fetchCriticalDashboardData(user.id);
      
      // Update with critical data immediately
      setData(prev => ({
        ...prev,
        ...criticalData,
        // Set defaults for non-critical data
        weeklyScore: 0,
        proteinGrams: 0,
        carbsGrams: 0,
        fatGrams: 0,
        steps: 0,
        caloriesBurned: 0,
        activeMinutes: 0,
        plannedProtein: 0,
        plannedCarbs: 0,
        plannedFat: 0,
        breakfastScore: null,
        lunchScore: null,
        dinnerScore: null,
        currentStreak: 0,
        bestStreak: 0,
        tier: 'bronze',
        avg28d: 0,
        newActivity: null
      } as OptimizedDashboardData));
      
      setIsInitialLoad(false);
    } catch (err) {
      console.error('Error loading critical dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    }
  }, [user]);

  const loadFullData = useCallback(async () => {
    if (!user) return;

    try {
      // Load complete data in background
      const fullData = await fetchOptimizedDashboardData(user.id);
      setData(fullData);
      setLoading(false);
    } catch (err) {
      console.error('Error loading full dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      setLoading(false);
    }
  }, [user]);

  const refreshData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const fullData = await fetchOptimizedDashboardData(user.id);
      setData(fullData);
      setLoading(false);
    } catch (err) {
      console.error('Error refreshing dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh dashboard data');
      setLoading(false);
    }
  }, [user]);

  // Load critical data immediately
  useEffect(() => {
    loadCriticalData();
  }, [loadCriticalData]);

  // Load full data after critical data is loaded
  useEffect(() => {
    if (!isInitialLoad && user) {
      // Small delay to allow critical data to render first
      const timer = setTimeout(() => {
        loadFullData();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isInitialLoad, user, loadFullData]);

  return {
    data,
    loading,
    error,
    isInitialLoad,
    refreshData
  };
}



