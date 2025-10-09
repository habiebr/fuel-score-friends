import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';

interface WidgetCacheItem<T> {
  data: T;
  timestamp: number;
  version: string;
}

interface WidgetCacheConfig {
  ttl?: number; // Time to live in milliseconds
  version?: string; // Cache version for invalidation
  enabled?: boolean; // Enable/disable caching
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_VERSION = 'v1.0.0';

// In-memory cache store
const widgetCache = new Map<string, WidgetCacheItem<any>>();

export function useWidgetCache<T>(
  cacheKey: string,
  fetchFunction: () => Promise<T>,
  config: WidgetCacheConfig = {}
) {
  const { user } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const {
    ttl = DEFAULT_TTL,
    version = CACHE_VERSION,
    enabled = true
  } = config;

  const fullCacheKey = useMemo(() => {
    return user?.id ? `${user.id}:${cacheKey}` : cacheKey;
  }, [user?.id, cacheKey]);

  const isCacheValid = useCallback((cacheItem: WidgetCacheItem<T>): boolean => {
    if (!enabled) return false;
    if (cacheItem.version !== version) return false;
    if (Date.now() - cacheItem.timestamp > ttl) return false;
    return true;
  }, [enabled, version, ttl]);

  const getCachedData = useCallback((): T | null => {
    if (!enabled) return null;
    
    const cached = widgetCache.get(fullCacheKey);
    if (!cached) return null;
    
    if (isCacheValid(cached)) {
      console.log(`WidgetCache: Cache hit for ${cacheKey}`);
      return cached.data;
    } else {
      console.log(`WidgetCache: Cache expired for ${cacheKey}`);
      widgetCache.delete(fullCacheKey);
      return null;
    }
  }, [fullCacheKey, isCacheValid, enabled, cacheKey]);

  const setCachedData = useCallback((newData: T) => {
    if (!enabled) return;
    
    const cacheItem: WidgetCacheItem<T> = {
      data: newData,
      timestamp: Date.now(),
      version
    };
    
    widgetCache.set(fullCacheKey, cacheItem);
    console.log(`WidgetCache: Data cached for ${cacheKey}`);
  }, [fullCacheKey, version, enabled, cacheKey]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cachedData = getCachedData();
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        setError(null);
        return cachedData;
      }
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`WidgetCache: Fetching fresh data for ${cacheKey}`);
      const freshData = await fetchFunction();
      
      setData(freshData);
      setCachedData(freshData);
      setLastUpdated(new Date());
      setLoading(false);
      
      return freshData;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setLoading(false);
      throw error;
    }
  }, [fetchFunction, getCachedData, setCachedData, cacheKey]);

  const invalidateCache = useCallback(() => {
    widgetCache.delete(fullCacheKey);
    console.log(`WidgetCache: Cache invalidated for ${cacheKey}`);
  }, [fullCacheKey, cacheKey]);

  const refreshData = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  // Initial data load
  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id, fetchData]);

  // Cleanup expired cache entries periodically
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      for (const [key, item] of widgetCache.entries()) {
        if (now - item.timestamp > ttl) {
          widgetCache.delete(key);
        }
      }
    };

    const interval = setInterval(cleanup, 60000); // Cleanup every minute
    return () => clearInterval(interval);
  }, [ttl]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refreshData,
    invalidateCache,
    isCached: getCachedData() !== null
  };
}

// Utility function to clear all caches for a user
export function clearUserCache(userId: string) {
  for (const key of widgetCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      widgetCache.delete(key);
    }
  }
  console.log(`WidgetCache: Cleared all caches for user ${userId}`);
}

// Utility function to get cache statistics
export function getCacheStats() {
  const stats = {
    totalEntries: widgetCache.size,
    entries: Array.from(widgetCache.entries()).map(([key, item]) => ({
      key,
      age: Date.now() - item.timestamp,
      version: item.version
    }))
  };
  return stats;
}
