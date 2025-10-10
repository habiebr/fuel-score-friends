import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWA() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Register service worker with auto-update
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle PWA install prompt and platform detection
  useEffect(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window as any).navigator?.standalone === true;
    setIsStandalone(!!standalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installPWA = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
    setCanInstall(false);
  };

  const updatePWA = () => {
    updateServiceWorker(true);
  };

  const enablePushNotifications = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;

      // For iOS 26+, we need to check for devicemotion permission first
      if (isIOS && typeof DeviceMotionEvent !== 'undefined' && (DeviceMotionEvent as any).requestPermission) {
        try {
          const motionPermission = await (DeviceMotionEvent as any).requestPermission();
          if (motionPermission !== 'granted') return false;
        } catch (e) {
          console.warn('DeviceMotion permission request failed:', e);
        }
      }

      // Ensure SW is registered (vite-plugin-pwa registers automatically in prod)
      const reg = await navigator.serviceWorker.ready;
      
      // Trigger OS permission prompt if needed
      let permission: NotificationPermission = Notification.permission;
      if (permission === 'default') {
        // For iOS, show a pre-prompt explaining why we need notifications
        if (isIOS) {
          // You might want to show a custom UI here explaining notifications
          const userWantsNotifications = window.confirm(
            'Enable notifications to get updates about your training and nutrition goals?'
          );
          if (!userWantsNotifications) return false;
        }
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') return false;
      // Fetch VAPID public key from Edge Function
      const apiKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
      const res = await fetch('/functions/v1/push-config', {
        headers: {
          ...(apiKey ? { apikey: apiKey } : {}),
        },
      });
      const { vapidPublicKey } = await res.json();
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      // Send subscription to backend
      await fetch('/functions/v1/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { apikey: apiKey } : {}),
        },
        body: JSON.stringify(sub),
      });

      setNotificationsEnabled(true);
      // Optional: show a confirmation notification to surface native banner in some browsers
      try {
        reg.showNotification('Notifications enabled', {
          body: 'You will receive training and nutrition alerts.',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
        });
      } catch {}
      return true;
    } catch (e) {
      console.error('Enable push failed', e);
      setNotificationsEnabled(false);
      return false;
    }
  };

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  return {
    isOnline,
    isInstalled,
    canInstall,
    needRefresh,
    installPWA,
    updatePWA,
    setNeedRefresh,
    notificationsEnabled,
    enablePushNotifications,
    isIOS,
    isStandalone,
    isPushSupported: (typeof window !== 'undefined') && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  };
}
