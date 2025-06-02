import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // so Vite listens on the LAN interface too
    port: 5173,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000', // Express
        changeOrigin: true,
        timeout: 30000,
      },
    },
    allowedHosts: ['a59d8fd60bb0.ngrok.app'],
  },
});
