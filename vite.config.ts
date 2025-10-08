import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      minify: false,
      workbox: {
        mode: 'development',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],
        additionalManifestEntries: [
          { url: '/sw-health-sync.js', revision: '1' }
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/www\.googleapis\.com\/fitness\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'google-fit-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /^https:\/\/oauth2\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'google-oauth-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /^https:\/\/api\.groq\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'groq-ai-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/.*\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'google-apis-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              networkTimeoutSeconds: 5,
            },
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: '/offline',
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
        offlineGoogleAnalytics: false,
        importScripts: ['/sw-health-sync.js'],
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Nutrisync - AI-Powered Nutrition Tracking',
        short_name: 'Nutrisync',
        description: 'AI-powered nutrition tracking and meal planning for athletes',
        theme_color: '#07101f',
        background_color: '#04070c',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        id: '/',
        lang: 'en',
        dir: 'ltr',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        categories: ['health', 'fitness', 'lifestyle', 'productivity'],
        screenshots: [
          {
            src: 'screenshot-wide.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide'
          },
          {
            src: 'screenshot-narrow.png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow'
          }
        ],
        shortcuts: [
          {
            name: 'Log Meal',
            short_name: 'Log Meal',
            description: 'Quickly log a meal',
            url: '/meals',
            icons: [
              {
                src: 'pwa-192x192.png',
                sizes: '192x192'
              }
            ]
          },
          {
            name: 'Training Calendar',
            short_name: 'Training',
            description: 'View training calendar',
            url: '/training-calendar',
            icons: [
              {
                src: 'pwa-192x192.png',
                sizes: '192x192'
              }
            ]
          },
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'View your progress',
            url: '/',
            icons: [
              {
                src: 'pwa-192x192.png',
                sizes: '192x192'
              }
            ]
          }
        ],
        related_applications: [],
        prefer_related_applications: false,
        edge_side_panel: {
          preferred_width: 400
        },
        launch_handler: {
          client_mode: 'navigate-existing'
        }
      },
      devOptions: {
        enabled: true
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: mode === "development",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          supabase: ['@supabase/supabase-js'],
          charts: ['recharts'],
          utils: ['date-fns', 'clsx', 'tailwind-merge']
        }
      }
    }
  },
  define: {
    // Ensure environment variables are available at build time
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },
}));
