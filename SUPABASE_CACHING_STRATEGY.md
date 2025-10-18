# Supabase Caching Strategy

This document describes the advanced caching strategy implemented in the Service Worker for optimal offline performance and reduced API calls.

## Overview

The Service Worker (`public/sw.js`) implements a multi-layered caching approach specifically optimized for Supabase REST API and Edge Functions, providing:

- **Smart Request Deduplication**: Prevents duplicate concurrent requests to Supabase
- **Time-based Cache Invalidation**: Auto-expires data based on content type
- **Dual Caching Strategies**: Network-first for real-time data, Cache-first for immutable data
- **Background Sync**: Queues operations for offline functionality
- **Cache Management**: Monitor and control cache size from the frontend

## Cache Strategy by Data Type

### 1. **Profiles (Cache-First, 1 hour TTL)**
```
/profiles
```
- **Strategy**: Cache-first with network fallback
- **TTL**: 1 hour (3600000ms)
- **Max Entries**: 10
- **Rationale**: User profiles rarely change; serve from cache for instant load

**Usage Pattern**:
```typescript
// First check: cached response if valid
// Second check: network if cache expired
// Fallback: stale cache if network fails
```

### 2. **Nutrition Scores (Cache-First, 10 minute TTL)**
```
/nutrition_scores
/functions/v1/calculate-nutrition-score
```
- **Strategy**: Cache-first with network fallback
- **TTL**: 10 minutes (600000ms)
- **Max Entries**: 50
- **Rationale**: Scores recalculate periodically; cache provides instant feedback

**Usage Pattern**:
```typescript
// Show cached score immediately
// Background refresh after 10 minutes
// UI reflects latest within TTL window
```

### 3. **Meals & Training (Network-First, 5 minute TTL)**
```
/daily_meal_plans
/food_logs
/training_activities
```
- **Strategy**: Network-first with cache fallback
- **TTL**: 5 minutes (300000ms)
- **Max Entries**: 200 (meals), 100 (training)
- **Rationale**: User frequently updates this data; always try network first

**Usage Pattern**:
```typescript
// 1. Try network for latest data
// 2. If network succeeds, cache it (even if stale)
// 3. If network fails, serve cached data
// 4. If no cache, return offline error
```

### 4. **Google Fit Data (Network-First, 5 minute TTL)**
```
/google_fit_data
/google_fit_sessions
```
- **Strategy**: Network-first with cache fallback
- **TTL**: 5 minutes (300000ms)
- **Max Entries**: 50
- **Rationale**: Synced data; needs frequent updates but should have offline fallback

### 5. **Edge Functions (Variable, based on function)**
```
/functions/v1/*
```
- **Strategy**: Network-first for most, Cache-first for expensive operations
- **TTL**: Varies (1 min default for expensive functions)
- **Rationale**: Some functions are expensive; cache reduces execution costs

## Request Deduplication

The Service Worker prevents duplicate concurrent requests:

```javascript
// Example: Two rapid requests to GET /profiles
Request 1: GET /profiles → [SW] Fetches from network → Caches response
Request 2: GET /profiles → [SW] Returns Request 1's promise (deduplicated!)

Result: Only 1 network call instead of 2
```

### Implementation Details

```typescript
const inflightRequests = new Map();

function deduplicateRequest(url) {
  if (inflightRequests.has(url)) {
    return inflightRequests.get(url); // Return existing promise
  }
  return null; // No duplicate, proceed with new request
}

function setInflightRequest(url, promise) {
  inflightRequests.set(url, promise);
  promise
    .then(() => inflightRequests.delete(url)) // Clean up on success
    .catch(() => inflightRequests.delete(url)); // Clean up on error
}
```

## Cache Metadata & Validation

Each cached response includes a timestamp for intelligent expiration:

```javascript
// When caching
headers.set('X-Cache-Timestamp', new Date().toISOString());

// When validating
function isCacheValid(response, maxAge) {
  const timestamp = response.headers.get('X-Cache-Timestamp');
  const age = Date.now() - new Date(timestamp).getTime();
  return age < maxAge; // True if still valid
}
```

## Cache Storage Structure

```
Service Worker Caches:
├── supabase-profiles-v1/
│   └── Cached profile objects (max 10 entries)
├── supabase-meals-v1/
│   └── Cached meal plans & food logs (max 200 entries)
├── supabase-training-v1/
│   └── Cached training activities (max 100 entries)
├── supabase-scores-v1/
│   └── Cached nutrition scores (max 50 entries)
├── supabase-googlefit-v1/
│   └── Cached Google Fit data (max 50 entries)
└── edge-functions-v1/
    └── Cached Edge Function responses
```

## Frontend Cache Management

Use the `useServiceWorkerCache` hook to manage caches from your app:

```typescript
import { useServiceWorkerCache } from '@/hooks/useServiceWorkerCache';

function SettingsPage() {
  const { 
    cacheSize, 
    isClearing, 
    clearCache, 
    invalidateCacheByUrl 
  } = useServiceWorkerCache();

  return (
    <div>
      <p>Cache Size: {cacheSize?.total || 0} entries</p>
      
      <button onClick={clearCache} disabled={isClearing}>
        {isClearing ? 'Clearing...' : 'Clear All Cache'}
      </button>

      <button onClick={() => invalidateCacheByUrl('/meals')}>
        Refresh Meals Cache
      </button>
    </div>
  );
}
```

### Available Methods

#### `getCacheSize()`
Get current cache statistics

```typescript
const size = await getCacheSize();
// Returns: { 
//   total: 245,
//   caches: [
//     { name: 'profiles', count: 5 },
//     { name: 'meals', count: 120 },
//     ...
//   ]
// }
```

#### `clearCache()`
Clear all Supabase-related caches

```typescript
const success = await clearCache();
```

#### `clearCacheByPattern(pattern: string)`
Clear specific cache by name pattern

```typescript
await clearCacheByPattern('meals'); // Clears supabase-meals-v1
await clearCacheByPattern('profiles'); // Clears supabase-profiles-v1
```

#### `invalidateCacheByUrl(urlPattern: string)`
Invalidate specific entries by URL pattern

```typescript
// Clear all meal log entries
await invalidateCacheByUrl('/food_logs');

// Clear specific training activity
await invalidateCacheByUrl('/training_activities/id-123');
```

## Offline Behavior

### Network Available
```
Request → Network ✓ → Cache (if cacheable) + Return Response
```

### Network Unavailable
```
Request → Cache Hit ✓ → Return Cached Response
Request → Cache Miss ✗ → Return Offline Error (503)
```

### Stale Cache Scenarios

```typescript
// Profiles: Will serve stale cache indefinitely if network fails
// Meals: Serves cache up to 5 min old, then stale if network fails
// Scores: Serves cache up to 10 min old, then stale if network fails
```

## Performance Impact

### Network Calls Reduction
- **Without Cache**: Every request hits Supabase
- **With Cache**: 
  - Profiles: 1 call per hour per user
  - Meals/Training: 1 call per 5 minutes per user
  - Scores: 1 call per 10 minutes per user

### Example: Daily Usage
```
User Session: 8 hours
Without cache:
  - Profile reads: 50+ calls → ~150KB
  - Meal reads: 100+ calls → ~400KB
  - Training reads: 100+ calls → ~300KB
  Total: 250+ calls, ~850KB

With cache (this strategy):
  - Profile reads: 1 call → 30KB (then cached for 1 hour)
  - Meal reads: 96 calls → ~300KB (fresh every 5 min)
  - Training reads: 96 calls → ~250KB (fresh every 5 min)
  Total: 193 calls (-23%), ~580KB (-32% bandwidth)
```

## Browser Compatibility

- **Chrome/Edge**: ✅ Full support
- **Safari**: ✅ Full support (iOS 13.4+)
- **Firefox**: ✅ Full support
- **Mobile**: ✅ All major browsers

## Cache Versioning

When making breaking changes to the cache structure:

```javascript
// public/sw.js
const CACHE_VERSION = 'v2'; // Increment version

const CACHE_NAMES = {
  SUPABASE_MEALS: `supabase-meals-${CACHE_VERSION}`, // Now v2
  // ...
};
```

Old caches (v1) will be automatically deleted on activation.

## Monitoring & Debugging

### Check Service Worker Status
```javascript
// In browser console
navigator.serviceWorker.controller // Active SW instance
navigator.serviceWorker.ready // Promise when ready
```

### Check Cached Data
```javascript
// In browser console
const cacheNames = await caches.keys();
// Output: ['supabase-profiles-v1', 'supabase-meals-v1', ...]

const cache = await caches.open('supabase-meals-v1');
const keys = await cache.keys();
console.log(keys); // All cached URLs
```

### View Cache Size in DevTools
```
DevTools → Application → Storage → Cache Storage
```

## Best Practices

1. **Don't bypass cache for testing**: Use DevTools → Network → "Disable cache" when needed
2. **Monitor cache size**: Implement alerts if cache exceeds 5MB
3. **Invalidate strategically**: Don't clear all cache on every user action
4. **Use cache patterns**: Related data often has similar cache keys
5. **Test offline**: Use DevTools → Network → "Offline" to test fallbacks

## Future Enhancements

- [ ] Implement IndexedDB for larger datasets
- [ ] Add cache priority levels (critical vs. optional)
- [ ] Implement smart cache eviction (LRU algorithm)
- [ ] Add background sync for offline operations
- [ ] Implement cache warming on app startup
