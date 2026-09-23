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
