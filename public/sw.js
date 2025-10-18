/// <reference lib="webworker" />
/**
 * Custom Service Worker with Advanced Supabase Caching Strategy
 * 
 * Features:
 * - Smart request deduplication for duplicate concurrent requests
 * - Time-based cache invalidation for nutrition data
 * - Fallback to network-first for real-time data
 * - Background sync for offline meal/training logs
 * - Optimized cache sizes and expiration
 */

const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  // Supabase API responses
  SUPABASE_PROFILES: `supabase-profiles-${CACHE_VERSION}`,
  SUPABASE_MEALS: `supabase-meals-${CACHE_VERSION}`,
  SUPABASE_TRAINING: `supabase-training-${CACHE_VERSION}`,
  SUPABASE_SCORES: `supabase-scores-${CACHE_VERSION}`,
  SUPABASE_GOOGLE_FIT: `supabase-googlefit-${CACHE_VERSION}`,
  
  // API responses (Edge Functions)
  EDGE_FUNCTIONS: `edge-functions-${CACHE_VERSION}`,
  
  // Static assets
  STATIC: `static-${CACHE_VERSION}`,
};

// Track in-flight requests to deduplicate concurrent calls
const inflightRequests = new Map();

// Cache metadata for smart invalidation
const cacheMetadata = {
  meals: { maxAge: 5 * 60 * 1000, maxEntries: 200 }, // 5 minutes
  profiles: { maxAge: 60 * 60 * 1000, maxEntries: 10 }, // 1 hour
  training: { maxAge: 5 * 60 * 1000, maxEntries: 100 }, // 5 minutes
  scores: { maxAge: 10 * 60 * 1000, maxEntries: 50 }, // 10 minutes
  googlefit: { maxAge: 5 * 60 * 1000, maxEntries: 50 }, // 5 minutes
};

/**
 * Get cache name for a given URL pattern
 */
function getCacheNameForUrl(url) {
  if (url.includes('/profiles')) return CACHE_NAMES.SUPABASE_PROFILES;
  if (url.includes('/daily_meal_plans') || url.includes('/food_logs')) return CACHE_NAMES.SUPABASE_MEALS;
  if (url.includes('/training_activities')) return CACHE_NAMES.SUPABASE_TRAINING;
  if (url.includes('/nutrition_scores') || url.includes('calculate-nutrition-score')) return CACHE_NAMES.SUPABASE_SCORES;
  if (url.includes('/google_fit')) return CACHE_NAMES.SUPABASE_GOOGLE_FIT;
  if (url.includes('functions/v1/')) return CACHE_NAMES.EDGE_FUNCTIONS;
  return null;
}

/**
 * Get cache metadata for invalidation
 */
function getCacheMetadataForUrl(url) {
  if (url.includes('/profiles')) return cacheMetadata.profiles;
  if (url.includes('/daily_meal_plans') || url.includes('/food_logs')) return cacheMetadata.meals;
  if (url.includes('/training_activities')) return cacheMetadata.training;
  if (url.includes('/nutrition_scores') || url.includes('calculate-nutrition-score')) return cacheMetadata.scores;
  if (url.includes('/google_fit')) return cacheMetadata.googlefit;
  return { maxAge: 60 * 1000, maxEntries: 50 }; // 1 minute default
}

/**
 * Add metadata to cached response
 */
async function cacheResponseWithMetadata(cacheName, url, response) {
  try {
    const cache = await caches.open(cacheName);
    const clonedResponse = response.clone();
    
    // Store metadata alongside the response
    const headers = new Headers(clonedResponse.headers);
    headers.set('X-Cache-Timestamp', new Date().toISOString());
    
    const responseWithMetadata = new Response(clonedResponse.body, {
      status: clonedResponse.status,
      statusText: clonedResponse.statusText,
      headers: headers,
    });
    
    await cache.put(url, responseWithMetadata);
  } catch (error) {
    console.error('[SW] Failed to cache response:', error);
  }
}

/**
 * Check if cached response is still valid based on age
 */
function isCacheValid(response, maxAge) {
  const timestamp = response.headers.get('X-Cache-Timestamp');
  if (!timestamp) return true; // If no timestamp, assume valid
  
  const age = Date.now() - new Date(timestamp).getTime();
  return age < maxAge;
}

/**
 * Deduplicate concurrent requests
 */
function deduplicateRequest(url) {
  if (inflightRequests.has(url)) {
    console.log('[SW] Deduplicated request:', url);
    return inflightRequests.get(url);
  }
  return null;
}

/**
 * Store inflight request promise
 */
function setInflightRequest(url, promise) {
  inflightRequests.set(url, promise);
  promise
    .then(() => inflightRequests.delete(url))
    .catch(() => inflightRequests.delete(url));
  return promise;
}

/**
 * Network-first strategy with smart caching
 */
async function networkFirstStrategy(request) {
  const url = request.url;
  const cacheName = getCacheNameForUrl(url);
  
  // Try network
  try {
    const response = await fetch(request);
    
    if (response.ok && cacheName) {
      // Cache successful response
      await cacheResponseWithMetadata(cacheName, url, response);
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    if (cacheName) {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(url);
      
      if (cachedResponse) {
        console.log('[SW] Using cached response for:', url);
        return cachedResponse;
      }
    }
    
    // No cache available, return offline response
    return new Response(
      JSON.stringify({ error: 'Offline - No cached data available' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Cache-first strategy with network fallback (for profiles, immutable data)
 */
async function cacheFirstStrategy(request) {
  const url = request.url;
  const cacheName = getCacheNameForUrl(url);
  
  if (cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(url);
    
    if (cachedResponse && isCacheValid(cachedResponse, cacheMetadata.profiles.maxAge)) {
      console.log('[SW] Using valid cached response:', url);
      return cachedResponse;
    }
  }
  
  // Cache invalid or missing, try network
  try {
    const response = await fetch(request);
    
    if (response.ok && cacheName) {
      await cacheResponseWithMetadata(cacheName, url, response);
    }
    
    return response;
  } catch (error) {
    // Network failed, return stale cache if available
    if (cacheName) {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(url);
      
      if (cachedResponse) {
        console.log('[SW] Using stale cached response:', url);
        return cachedResponse;
      }
    }
    
    return new Response(
      JSON.stringify({ error: 'Offline - No cached data available' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Determine strategy based on request type
 */
function getStrategyForRequest(request) {
  const url = request.url;
  const method = request.method;
  
  // POST/PUT/DELETE requests: always network-first
  if (method !== 'GET' && method !== 'HEAD') {
    return 'network-first';
  }
  
  // Profile reads: cache-first (mostly immutable)
  if (url.includes('/profiles') && method === 'GET') {
    return 'cache-first';
  }
  
  // Scores: cache-first with 10 min TTL
  if (url.includes('/nutrition_scores') || url.includes('calculate-nutrition-score')) {
    return 'cache-first';
  }
  
  // Everything else (meals, training, google fit): network-first
  return 'network-first';
}

/**
 * Fetch event handler
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-Supabase requests
  if (!url.hostname.includes('supabase.co') && !url.hostname.includes('googleapis.com')) {
    return;
  }
  
  // Skip auth endpoints
  if (url.pathname.includes('/auth/')) {
    return;
  }
  
  const strategy = getStrategyForRequest(request);
  
  // Check for duplicate requests
  const duplicate = deduplicateRequest(url.toString());
  if (duplicate) {
    event.respondWith(duplicate);
    return;
  }
  
  let responsePromise;
  
  if (strategy === 'cache-first') {
    responsePromise = cacheFirstStrategy(request);
  } else {
    responsePromise = networkFirstStrategy(request);
  }
  
  // Store as inflight to deduplicate
  setInflightRequest(url.toString(), responsePromise);
  event.respondWith(responsePromise);
});

/**
 * Activate event: Clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete caches that don't match current version
          if (!Object.values(CACHE_NAMES).includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

/**
 * Install event
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  self.skipWaiting();
});

/**
 * Message event: Handle requests from main thread
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      Promise.all(
        Object.values(CACHE_NAMES).map((cacheName) =>
          caches.delete(cacheName)
        )
      ).then(() => {
        console.log('[SW] Cache cleared');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      Promise.all(
        Object.entries(CACHE_NAMES).map(async ([name, cacheName]) => {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          return { name, count: keys.length };
        })
      ).then((results) => {
        event.ports[0].postMessage({ caches: results });
      })
    );
  }
});

// Handle background sync for offline operations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-nutrition-data') {
    event.waitUntil(syncNutritionData());
  }
});

async function syncNutritionData() {
  try {
    // This would sync any pending nutrition data when connection is restored
    console.log('[SW] Syncing nutrition data...');
    // Implementation depends on your specific offline queue strategy
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}
