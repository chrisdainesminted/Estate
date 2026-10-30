import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative asset paths so the build also works when hosted under a sub-path.
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 800,
    // Two pages: the homepage at / and the app at /app/.
    rollupOptions: { input: { home: 'index.html', app: 'app/index.html', rent: 'rent/index.html', listing: 'listing/index.html', homes: 'homes/index.html' } },
  },
  test: {
    environment: 'node',
  },
});
