// Enhanced Service Worker for Health Data Sync
const CACHE_NAME = 'nutrisync-health-v2';
const HEALTH_SYNC_TAG = 'health-sync';
const NUTRITION_SYNC_TAG = 'nutrition-sync';
const TOKEN_REFRESH_TAG = 'token-refresh';

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache health data for offline access
  healthData: {
    cacheName: 'health-data-cache',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    maxEntries: 30 // 30 days of data
  },
  // Cache API responses
  api: {
    cacheName: 'api-cache',
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxEntries: 100
  }
};

// Install event
self.addEventListener('install', (event) => {
  console.log('Health sync service worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Health sync service worker activating...');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      cleanupOldCaches()
    ])
  );
});

// Background sync for health data
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === HEALTH_SYNC_TAG) {
    console.log('Background sync triggered for health data');
    event.waitUntil(performHealthSync());
  } else if (event.tag === NUTRITION_SYNC_TAG) {
    console.log('Background sync triggered for nutrition data');
    event.waitUntil(performNutritionSync());
  } else if (event.tag === TOKEN_REFRESH_TAG) {
    console.log('Background sync triggered for token refresh');
    event.waitUntil(performTokenRefresh());
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'health-periodic-sync') {
    console.log('Periodic sync triggered for health data');
    event.waitUntil(performHealthSync());
  }
});

// Allow clients to actively trigger a sync
self.addEventListener('message', (event) => {
  try {
    if (event && event.data && event.data.type === 'TRIGGER_HEALTH_SYNC') {
      event.waitUntil(performHealthSync());
    }
  } catch {}
});

// Push notifications handler (generic)
self.addEventListener('push', (event) => {
  try {
    const payload = event.data ? event.data.json() : {};
    const title = payload.title || 'NutriSync';
    const body = payload.body || payload.message || 'You have a new notification';
    const tag = payload.tag || 'nutrisync';
    const data = payload.data || {};
    const actions = payload.actions || [
      { action: 'view', title: 'Open' }
    ];

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag,
        data,
        actions,
        requireInteraction: !!payload.requireInteraction
      })
    );
  } catch (e) {
    // no-op
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Main health sync function
async function performHealthSync() {
  try {
    console.log('Starting health data sync...');
    
    // Get all clients to send sync status
    const clients = await self.clients.matchAll();
    
    // Check if we have stored sync data
    const syncData = await getStoredSyncData();
    if (!syncData) {
      console.log('No sync data available');
      return;
    }

    // Attempt to sync with Google Fit
    if (syncData.googleFitToken) {
      await syncGoogleFitData(syncData.googleFitToken);
    }

    // Attempt to sync with Apple Health (if available)
    if (syncData.appleHealthData) {
      await syncAppleHealthData(syncData.appleHealthData);
    }

    // Update sync status
    await updateSyncStatus('success', new Date().toISOString());
    
    // Notify clients
    clients.forEach(client => {
      client.postMessage({
        type: 'HEALTH_SYNC_SUCCESS',
        timestamp: new Date().toISOString()
      });
    });

    console.log('Health data sync completed successfully');
  } catch (error) {
    console.error('Health data sync failed:', error);
    
    // Update sync status
    await updateSyncStatus('error', new Date().toISOString(), error.message);
    
    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'HEALTH_SYNC_ERROR',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  }
}

// Sync Google Fit data
async function syncGoogleFitData(token) {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Fetch steps
    const stepsResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        aggregateBy: [{
          dataTypeName: 'com.google.step_count.delta',
          // Do not force a restricted dataSource; allow Google to choose
        }],
        bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
        startTimeMillis: startOfDay.getTime(),
        endTimeMillis: endOfDay.getTime()
      })
    });

    if (!stepsResponse.ok) {
      throw new Error(`Google Fit API error: ${stepsResponse.status}`);
    }

    const stepsData = await stepsResponse.json();
    const steps = stepsData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;

    // Store the data for later processing
    await storeHealthData({
      source: 'google_fit',
      steps,
      date: today.toISOString().split('T')[0],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Google Fit sync failed:', error);
    throw error;
  }
}

// Sync Apple Health data
async function syncAppleHealthData(healthData) {
  try {
    // Process Apple Health data (similar to your existing logic)
    const processedData = {
      source: 'apple_health',
      steps: healthData.steps || 0,
      calories: healthData.calories || 0,
      activeMinutes: healthData.activeMinutes || 0,
      heartRate: healthData.heartRate || 0,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString()
    };

    await storeHealthData(processedData);
  } catch (error) {
    console.error('Apple Health sync failed:', error);
    throw error;
  }
}

// Store health data in IndexedDB
async function storeHealthData(data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HealthDataDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['healthData'], 'readwrite');
      const store = transaction.objectStore('healthData');
      
      const addRequest = store.add(data);
      addRequest.onsuccess = () => resolve();
      addRequest.onerror = () => reject(addRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('healthData')) {
        db.createObjectStore('healthData', { keyPath: 'timestamp' });
      }
    };
  });
}

// Get stored sync data
async function getStoredSyncData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SyncDataDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncData'], 'readonly');
      const store = transaction.objectStore('syncData');
      
      const getRequest = store.get('syncData');
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('syncData')) {
        db.createObjectStore('syncData', { keyPath: 'id' });
      }
    };
  });
}

// Update sync status
async function updateSyncStatus(status, timestamp, error = null) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SyncDataDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncData'], 'readwrite');
      const store = transaction.objectStore('syncData');
      
      const data = {
        id: 'syncStatus',
        status,
        timestamp,
        error
      };
      
      const putRequest = store.put(data);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
  });
}

// Intercept fetches to Supabase REST to inject required headers
let __cachedAnonKey = undefined;

// Do not intercept Supabase REST; let supabase-js attach headers itself

// Helper to get the latest session token from clients
async function getCurrentAuthHeader() {
  try {
    const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    if (allClients.length === 0) return undefined;

    // Ask the first client for its auth header
    const client = allClients[0];
    const channel = new MessageChannel();
    const response = await new Promise((resolve) => {
      channel.port1.onmessage = (e) => resolve(e.data);
      client.postMessage({ type: 'REQUEST_AUTH_HEADER' }, [channel.port2]);
      setTimeout(() => resolve(undefined), 500);
    });

    if (response && response.accessToken) {
      return `Bearer ${response.accessToken}`;
    }
  } catch (_) {}
  return undefined;
}

// Helper to get the Supabase anon key from the first available client
async function getCurrentAnonKey() {
  try {
    const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    if (allClients.length === 0) return undefined;

    const client = allClients[0];
    const channel = new MessageChannel();
    const response = await new Promise((resolve) => {
      channel.port1.onmessage = (e) => resolve(e.data);
      client.postMessage({ type: 'REQUEST_SUPABASE_ANON' }, [channel.port2]);
      setTimeout(() => resolve(undefined), 2000);
    });

    if (response && response.anonKey) {
      __cachedAnonKey = response.anonKey;
      return __cachedAnonKey;
    }
  } catch (_) {}
  return undefined;
}

// Cleanup old caches
async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const validCaches = [CACHE_NAME, ...Object.values(CACHE_STRATEGIES).map(s => s.cacheName)];
  
  return Promise.all(
    cacheNames.map(cacheName => {
      if (!validCaches.includes(cacheName)) {
        console.log('Deleting old cache:', cacheName);
        return caches.delete(cacheName);
      }
    })
  );
}

// Stale-while-revalidate for Edge Function dashboard3-data
self.addEventListener('fetch', (event) => {
  try {
    const url = new URL(event.request.url);
    if (url.pathname.includes('/functions/v1/dashboard3-data')) {
      event.respondWith(staleWhileRevalidate(event.request, CACHE_STRATEGIES.api.cacheName, 5 * 60 * 1000));
    } else if (url.pathname.includes('/rest/v1/food_logs') && event.request.method === 'GET') {
      event.respondWith(staleWhileRevalidate(event.request, CACHE_STRATEGIES.api.cacheName, 2 * 60 * 1000));
    }
  } catch (_) {}
});

async function staleWhileRevalidate(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        try { await cache.put(request, networkResponse.clone()); } catch (_) {}
      }
      return networkResponse;
    })
    .catch(() => cached);

  if (cached) {
    // Optionally validate age via custom header Date; here we just return it immediately
    return cached;
  }
  return fetchPromise;
}

// Health milestone detection
function checkHealthMilestones(healthData) {
  const milestones = [];
  
  // Steps milestones
  if (healthData.steps >= 10000 && healthData.steps < 10050) {
    milestones.push({
      type: 'steps',
      message: '🎉 10,000 steps reached! Great job!',
      value: healthData.steps
    });
  }
  
  // Calories milestones
  if (healthData.calories >= 500 && healthData.calories < 550) {
    milestones.push({
      type: 'calories',
      message: '🔥 500 calories burned! Keep it up!',
      value: healthData.calories
    });
  }
  
  return milestones;
}

// Send milestone notifications
async function sendMilestoneNotifications(milestones) {
  for (const milestone of milestones) {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'HEALTH_MILESTONE',
        milestone
      });
    });
  }
}

// Nutrition data sync function
async function performNutritionSync() {
  try {
    console.log('Starting nutrition data sync...');
    
    const clients = await self.clients.matchAll();
    if (clients.length === 0) {
      console.log('No clients available for nutrition sync');
      return;
    }

    // Get stored nutrition data
    const nutritionData = await getStoredNutritionData();
    if (!nutritionData) {
      console.log('No nutrition data available for sync');
      return;
    }

    // Sync with Supabase
    await syncNutritionToSupabase(nutritionData);

    // Update sync status
    await updateSyncStatus('nutrition_success', new Date().toISOString());
    
    // Notify clients
    clients.forEach(client => {
      client.postMessage({
        type: 'NUTRITION_SYNC_SUCCESS',
        timestamp: new Date().toISOString()
      });
    });

    console.log('Nutrition data sync completed successfully');
  } catch (error) {
    console.error('Nutrition data sync failed:', error);
    
    await updateSyncStatus('nutrition_error', new Date().toISOString(), error.message);
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'NUTRITION_SYNC_ERROR',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  }
}

// Token refresh function
async function performTokenRefresh() {
  try {
    console.log('Starting token refresh...');
    
    const clients = await self.clients.matchAll();
    if (clients.length === 0) {
      console.log('No clients available for token refresh');
      return;
    }

    // Get stored token data
    const tokenData = await getStoredTokenData();
    if (!tokenData) {
      console.log('No token data available for refresh');
      return;
    }

    // Refresh Google Fit token
    if (tokenData.googleFitToken) {
      await refreshGoogleFitToken(tokenData.googleFitToken);
    }

    // Update refresh status
    await updateSyncStatus('token_refresh_success', new Date().toISOString());
    
    // Notify clients
    clients.forEach(client => {
      client.postMessage({
        type: 'TOKEN_REFRESH_SUCCESS',
        timestamp: new Date().toISOString()
      });
    });

    console.log('Token refresh completed successfully');
  } catch (error) {
    console.error('Token refresh failed:', error);
    
    await updateSyncStatus('token_refresh_error', new Date().toISOString(), error.message);
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'TOKEN_REFRESH_ERROR',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  }
}

// Get stored nutrition data
async function getStoredNutritionData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NutritionDataDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['nutritionData'], 'readonly');
      const store = transaction.objectStore('nutritionData');
      
      const getRequest = store.get('nutritionData');
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('nutritionData')) {
        db.createObjectStore('nutritionData', { keyPath: 'id' });
      }
    };
  });
}

// Get stored token data
async function getStoredTokenData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TokenDataDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['tokenData'], 'readonly');
      const store = transaction.objectStore('tokenData');
      
      const getRequest = store.get('tokenData');
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('tokenData')) {
        db.createObjectStore('tokenData', { keyPath: 'id' });
      }
    };
  });
}

// Sync nutrition data to Supabase
async function syncNutritionToSupabase(nutritionData) {
  try {
    const authHeader = await getCurrentAuthHeader();
    if (!authHeader) {
      throw new Error('No authentication available');
    }

    const response = await fetch('https://eecdbddpzwedficnpenm.supabase.co/rest/v1/food_logs', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY0NzQ0NzEsImV4cCI6MjA1MjA1MDQ3MX0.8QZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ'
      },
      body: JSON.stringify(nutritionData)
    });

    if (!response.ok) {
      throw new Error(`Supabase sync failed: ${response.status}`);
    }

    console.log('Nutrition data synced to Supabase successfully');
  } catch (error) {
    console.error('Failed to sync nutrition data to Supabase:', error);
    throw error;
  }
}

// Refresh Google Fit token
async function refreshGoogleFitToken(refreshToken) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: 'YOUR_GOOGLE_CLIENT_ID',
        client_secret: 'YOUR_GOOGLE_CLIENT_SECRET',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Google token refresh failed: ${response.status}`);
    }

    const tokenData = await response.json();
    
    // Store new token data
    await storeTokenData({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refreshToken,
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      timestamp: new Date().toISOString()
    });

    console.log('Google Fit token refreshed successfully');
  } catch (error) {
    console.error('Failed to refresh Google Fit token:', error);
    throw error;
  }
}

// Store token data
async function storeTokenData(tokenData) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TokenDataDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['tokenData'], 'readwrite');
      const store = transaction.objectStore('tokenData');
      
      const data = {
        id: 'tokenData',
        ...tokenData
      };
      
      const putRequest = store.put(data);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('tokenData')) {
        db.createObjectStore('tokenData', { keyPath: 'id' });
      }
    };
  });
}

// Enhanced message handling for PWA features
self.addEventListener('message', (event) => {
  try {
    if (event && event.data) {
      switch (event.data.type) {
        case 'TRIGGER_HEALTH_SYNC':
          event.waitUntil(performHealthSync());
          break;
        case 'TRIGGER_NUTRITION_SYNC':
          event.waitUntil(performNutritionSync());
          break;
        case 'TRIGGER_TOKEN_REFRESH':
          event.waitUntil(performTokenRefresh());
          break;
        case 'REQUEST_AUTH_HEADER':
          // Handle auth header request
          event.ports[0].postMessage({
            accessToken: 'stored_access_token' // This would be retrieved from storage
          });
          break;
        case 'REQUEST_SUPABASE_ANON':
          // Handle Supabase anon key request
          event.ports[0].postMessage({
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY0NzQ0NzEsImV4cCI6MjA1MjA1MDQ3MX0.8QZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ'
          });
          break;
        case 'CACHE_NUTRITION_DATA':
          // Cache nutrition data for offline use
          event.waitUntil(cacheNutritionData(event.data.data));
          break;
        case 'CACHE_HEALTH_DATA':
          // Cache health data for offline use
          event.waitUntil(cacheHealthData(event.data.data));
          break;
      }
    }
  } catch (error) {
    console.error('Service worker message handling error:', error);
  }
});

// Cache nutrition data
async function cacheNutritionData(data) {
  try {
    const cache = await caches.open('nutrition-cache');
    await cache.put('/api/nutrition', new Response(JSON.stringify(data)));
    console.log('Nutrition data cached successfully');
  } catch (error) {
    console.error('Failed to cache nutrition data:', error);
  }
}

// Cache health data
async function cacheHealthData(data) {
  try {
    const cache = await caches.open('health-cache');
    await cache.put('/api/health', new Response(JSON.stringify(data)));
    console.log('Health data cached successfully');
  } catch (error) {
    console.error('Failed to cache health data:', error);
  }
}
