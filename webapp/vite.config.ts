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
    },
  },
  server: {
    fs: {
      // @domain resolves outside webapp/, into the backend's src/shared/domain.
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
