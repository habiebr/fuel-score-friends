// Cache keys
const DASHBOARD_CACHE_PREFIX = 'dashboard:v1';
const DASHBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache structure
interface DashboardCache {
  userId: string;
  timestamp: number;
  data: {
    daily: any;
    weekly: any;
  };
}

// Read from cache
export function readDashboardCache(userId: string): DashboardCache | null {
  try {
    const key = `${DASHBOARD_CACHE_PREFIX}:${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const cache = JSON.parse(raw) as DashboardCache;
    if (!cache || cache.userId !== userId) return null;
    if (Date.now() - cache.timestamp > DASHBOARD_CACHE_TTL) return null;

    return cache;
  } catch {
    return null;
  }
}

// Write to cache
export function writeDashboardCache(userId: string, data: { daily: any; weekly: any }) {
  try {
    const key = `${DASHBOARD_CACHE_PREFIX}:${userId}`;
    const cache: DashboardCache = {
      userId,
      timestamp: Date.now(),
      data
    };
    localStorage.setItem(key, JSON.stringify(cache));
  } catch {}
}

// Clear cache for user
export function clearDashboardCache(userId: string) {
  try {
    const key = `${DASHBOARD_CACHE_PREFIX}:${userId}`;
    localStorage.removeItem(key);
  } catch {}
}

// Clear all dashboard caches
export function clearAllDashboardCaches() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DASHBOARD_CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
  } catch {}
}

// Check if cache is stale
export function isDashboardCacheStale(userId: string): boolean {
  const cache = readDashboardCache(userId);
  if (!cache) return true;
  return Date.now() - cache.timestamp > DASHBOARD_CACHE_TTL;
}
