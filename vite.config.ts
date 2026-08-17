import tailwindcss from '@tailwindcss/vite';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    preact(),
    VitePWA({
      // manifest próprio em public/manifest.webmanifest: ele precisa do
      // campo share_target, que o gerador de manifest do plugin não cobre.
      manifest: false,
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        // Faz o SPA responder em qualquer rota (inclusive /share-target,
        // usado pelo Web Share Target) servindo o app shell do cache.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/manifest\.webmanifest$/],
      },
    }),
  ],
});
