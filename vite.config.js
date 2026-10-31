import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative asset paths so the build also works when hosted under a sub-path.
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 800,
    // The homepage at /, the app at /app/, and the public pages beside them.
    rollupOptions: { input: { home: 'index.html', app: 'app/index.html', rent: 'rent/index.html', listing: 'listing/index.html', homes: 'homes/index.html', terms: 'terms/index.html', privacy: 'privacy/index.html', about: 'about/index.html', contact: 'contact/index.html', methods: 'methods/index.html' } },
  },
  test: {
    environment: 'node',
  },
});
