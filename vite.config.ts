import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // All /api calls go to the Laravel dev server ->
      // no CORS configuration needed between frontend and backend.
      '/api': {
        target: 'https://backend.test',
        changeOrigin: true,
      },
    },
  },
});