import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This config is ESM (`.mts`), where `__dirname` does not exist.
const root = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(root, 'src');

// Standalone web/PWA build. Deliberately separate from vite.config.mts (which wires
// vite-plugin-electron for the desktop app): the service worker + manifest here must
// never end up in the Electron-packaged renderer, since Chromium won't register a SW
// under file:// and a stale-cache update flow makes no sense for a locally installed app.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'DeckForge',
        short_name: 'DeckForge',
        description: 'Magic: The Gathering card search, deck builder, and playtest simulator.',
        theme_color: '#2563eb',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Card artwork never changes for a given print, so cache it aggressively
            // and let it fall back to the cache offline instead of re-hitting Scryfall.
            urlPattern: /^https:\/\/cards\.scryfall\.io\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'scryfall-card-images',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Search results should stay fresh while online but still answer instantly
            // (and work offline) from the last response — respects Scryfall's rate
            // limit by avoiding a duplicate network round-trip for a repeated query.
            urlPattern: /^https:\/\/api\.scryfall\.com\/cards\/search/,
            method: 'GET',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'scryfall-search-results',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 10
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  root: srcRoot,
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true
  },
  base: '/',
  // Serves the generated manifest icons (src/assets/icons/pwa-*.png) at the site
  // root, e.g. /pwa-192.png, which is where the manifest above expects to find them.
  publicDir: join(srcRoot, 'assets/icons'),
  server: {
    port: 3000,
    host: '0.0.0.0'
  }
});
