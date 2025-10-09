// Service Worker for Background Google Fit Sync
const CACHE_NAME = 'nutrisync-sync-v1';
const SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes

// Install event
self.addEventListener('install', (event) => {
  console.log('Sync Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Sync Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'google-fit-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic sync triggered:', event.tag);
  
  if (event.tag === 'google-fit-periodic') {
    event.waitUntil(performBackgroundSync());
  }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  if (event.data.type === 'START_SYNC') {
    performBackgroundSync();
  } else if (event.data.type === 'REGISTER_PERIODIC_SYNC') {
    registerPeriodicSync();
  }
});

async function performBackgroundSync() {
  try {
    console.log('Starting background Google Fit sync...');
    
    // Get the Supabase URL and anon key from environment
    const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzQzNzcsImV4cCI6MjA1MTMxMDM3N30.8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q';
    
    // Get all clients (tabs) to find active sessions
    const clients = await self.clients.matchAll();
    let activeSession = null;
    
    for (const client of clients) {
      try {
        const response = await client.postMessage({ type: 'GET_SESSION' });
        if (response && response.session) {
          activeSession = response.session;
          break;
        }
      } catch (error) {
        console.log('Could not get session from client:', error);
      }
    }
    
    if (!activeSession) {
      console.log('No active session found, skipping background sync');
      return;
    }
    
    // Check if we have a valid Google Fit token
    const tokenResponse = await fetch(`${supabaseUrl}/rest/v1/google_tokens?user_id=eq.${activeSession.user.id}&is_active=eq.true&order=created_at.desc&limit=1`, {
      headers: {
        'Authorization': `Bearer ${activeSession.access_token}`,
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!tokenResponse.ok) {
      console.log('No valid Google Fit token found');
      return;
    }
    
    const tokenData = await tokenResponse.json();
    if (!tokenData || tokenData.length === 0) {
      console.log('No Google Fit token data');
      return;
    }
    
    // Perform the sync
    const syncResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-google-fit-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeSession.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessToken: tokenData[0].access_token
      })
    });
    
    if (syncResponse.ok) {
      const result = await syncResponse.json();
      console.log('Background sync completed successfully:', result);
      
      // Notify all clients
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETED',
          data: result
        });
      });
    } else {
      console.error('Background sync failed:', syncResponse.status);
    }
    
  } catch (error) {
    console.error('Background sync error:', error);
  }
}

async function registerPeriodicSync() {
  try {
    if ('serviceWorker' in self && 'periodicSync' in self.registration) {
      await self.registration.periodicSync.register('google-fit-periodic', {
        minInterval: SYNC_INTERVAL
      });
      console.log('Periodic sync registered');
    }
  } catch (error) {
    console.error('Failed to register periodic sync:', error);
  }
}

// Handle push notifications for sync reminders
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    if (data.type === 'SYNC_REMINDER') {
      event.waitUntil(
        self.registration.showNotification('NutriSync', {
          body: 'Time to sync your Google Fit data!',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'sync-reminder',
          actions: [
            {
              action: 'sync',
              title: 'Sync Now'
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
  
  if (event.action === 'sync') {
    event.waitUntil(performBackgroundSync());
  }
});

console.log('Sync Service Worker loaded');
