import { useEffect, useState, useCallback } from 'react';

interface CacheStats {
  name: string;
  count: number;
}

interface CacheSize {
  total: number;
  caches: CacheStats[];
}

/**
 * Hook for managing Service Worker cache
 * Provides utilities to clear cache and monitor cache size
 */
export function useServiceWorkerCache() {
  const [cacheSize, setCacheSize] = useState<CacheSize | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  /**
   * Get current cache size and statistics
   */
  const getCacheSize = useCallback(async () => {
    if (!navigator.serviceWorker?.controller) {
      console.log('Service Worker not active');
      return null;
    }

    return new Promise<CacheSize | null>((resolve) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        if (event.data.caches) {
          const stats: CacheStats[] = event.data.caches;
          setCacheSize({
            total: stats.reduce((sum, c) => sum + c.count, 0),
            caches: stats,
          });
          resolve({
            total: stats.reduce((sum, c) => sum + c.count, 0),
            caches: stats,
          });
        }
      };

      navigator.serviceWorker.controller?.postMessage(
        { type: 'GET_CACHE_SIZE' },
        [channel.port2]
      );

      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  }, []);

  /**
   * Clear all Supabase caches
   */
  const clearCache = useCallback(async () => {
    if (!navigator.serviceWorker?.controller) {
      console.log('Service Worker not active');
      return false;
    }

    setIsClearing(true);
    
    return new Promise<boolean>((resolve) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        if (event.data.success) {
          console.log('Cache cleared successfully');
          setCacheSize(null);
          resolve(true);
        }
      };

      navigator.serviceWorker.controller?.postMessage(
        { type: 'CLEAR_CACHE' },
        [channel.port2]
      );

      // Timeout after 5 seconds
      setTimeout(() => {
        setIsClearing(false);
        resolve(false);
      }, 5000);
    }).finally(() => setIsClearing(false));
  }, []);

  /**
   * Clear specific cache by pattern
   */
  const clearCacheByPattern = useCallback(async (pattern: string) => {
    try {
      const cacheNames = await caches.keys();
      const matchingCaches = cacheNames.filter(name => name.includes(pattern));
      
      await Promise.all(
        matchingCaches.map(name => caches.delete(name))
      );
      
      console.log(`Cleared ${matchingCaches.length} caches matching pattern: ${pattern}`);
      await getCacheSize();
      return true;
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
  }, [getCacheSize]);

  /**
   * Invalidate specific cache entries by URL pattern
   */
  const invalidateCacheByUrl = useCallback(async (urlPattern: string) => {
    try {
      const cacheNames = await caches.keys();
      
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        for (const request of keys) {
          if (request.url.includes(urlPattern)) {
            await cache.delete(request);
          }
        }
      }
      
      console.log(`Invalidated cache entries matching: ${urlPattern}`);
      await getCacheSize();
      return true;
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
      return false;
    }
  }, [getCacheSize]);

  /**
   * Monitor cache size periodically
   */
  useEffect(() => {
    // Get initial cache size
    getCacheSize();

    // Check cache size every 5 minutes
    const interval = setInterval(() => {
      getCacheSize();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [getCacheSize]);

  return {
    cacheSize,
    isClearing,
    getCacheSize,
    clearCache,
    clearCacheByPattern,
    invalidateCacheByUrl,
  };
}
