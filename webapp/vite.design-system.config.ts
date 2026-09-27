import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

// Config separat pentru pagina design-system (npm run build:design-system): build static,
// fără proxy /api (nu există backend aici) și cu ieșirea în dist-design-system/, nu în dist/ —
// ăla e servit de serverul desktop (vezi src/core/server/http/static-assets.mjs) și nu trebuie
// să conțină nimic din unealta asta de dezvoltare. Deployabil ca site static (ex. Vercel).
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
      '#shared': resolvePath('../src/shared'),
      '#core': resolvePath('../src/core'),
      '#app': resolvePath('../src/app'),
      '#config': resolvePath('../src/config'),
      '#features': resolvePath('../src/features'),
    },
  },
  build: {
    outDir: 'dist-design-system',
    emptyOutDir: true,
    rollupOptions: {
      input: resolvePath('./design-system.html'),
    },
  },
});
