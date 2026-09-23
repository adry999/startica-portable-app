/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': resolvePath('./src/app'),
      '@shared': resolvePath('./src/shared'),
      '@features': resolvePath('./src/features'),
      '@domain': resolvePath('../src/shared/domain'),
      '@contracts': resolvePath('../src/shared/contracts'),
      '@core': resolvePath('../src/core'),
      // Backend files (e.g. app-session-store.mjs) import each other via the
      // '#xxx/*' subpath imports from the root package.json. Vite doesn't read
      // that map, so it needs the same targets under the literal '#' prefix too.
      '#shared': resolvePath('../src/shared'),
      '#core': resolvePath('../src/core'),
      '#app': resolvePath('../src/app'),
      '#config': resolvePath('../src/config'),
      '#features': resolvePath('../src/features'),
    },
  },
  server: {
    fs: {
      // @domain/@contracts/@core/#... resolve outside webapp/, into the backend's src/.
      allow: ['..'],
    },
    proxy: {
      // Dev-only: the real backend (`npm start` from the repo root, default port
      // 8765) enforces an exact Host header (127.0.0.1:<port>, see
      // src/core/server/http/request-guards.mjs) — Vite's proxy rewrites Host to
      // match the target by default, so this works without extra config.
      '/api': 'http://127.0.0.1:8765',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
