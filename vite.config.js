import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub repo name: pta3.5-dex
  base: process.env.NODE_ENV === 'production' ? '/pta3.5-dex/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React runtime → its own long-lived vendor chunk
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          // Shared app layer (contexts, data, utils, hooks) — needed by every tab
          if (id.includes('/src/contexts/') ||
              id.includes('/src/data/') ||
              id.includes('/src/utils/') ||
              id.includes('/src/hooks/')) {
            return 'app-core';
          }
          // Modal components — loaded on first modal open
          if (id.includes('/src/components/modals/')) {
            return 'modals';
          }
          // Per-tab chunks — loaded on first tab visit
          if (id.includes('/src/components/battle/'))    return 'tab-battle';
          if (id.includes('/src/components/pokemon/'))   return 'tab-pokemon';
          if (id.includes('/src/components/trainer/'))   return 'tab-trainer';
          if (id.includes('/src/components/inventory/')) return 'tab-inventory';
          if (id.includes('/src/components/reference/')) return 'tab-reference';
          if (id.includes('/src/components/notes/'))     return 'tab-notes';
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    exclude: ['**/node_modules/**', '**/e2e/**']
  }
});
