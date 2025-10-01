// Enhanced Service Worker for Health Data Sync
const CACHE_NAME = 'nutrisync-health-v1';
const HEALTH_SYNC_TAG = 'health-sync';

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
  if (event.tag === HEALTH_SYNC_TAG) {
    console.log('Background sync triggered for health data');
    event.waitUntil(performHealthSync());
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'health-periodic-sync') {
    console.log('Periodic sync triggered for health data');
    event.waitUntil(performHealthSync());
  }
});

// Push notifications for health milestones
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    if (data.type === 'health_milestone') {
      event.waitUntil(
        self.registration.showNotification(data.title, {
          body: data.message,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'health-milestone',
          requireInteraction: true,
          actions: [
            {
              action: 'view',
              title: 'View Progress'
            },
            {
              action: 'dismiss',
              title: 'Dismiss'
            }
          ]
        })
      );
    }
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
          dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
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
