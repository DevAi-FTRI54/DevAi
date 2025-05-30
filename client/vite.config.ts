import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // so Vite listens on the LAN interface too
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000', // Express
        changeOrigin: true,
        secure: false,
      },
    },
    allowedHosts: ['999b-185-185-128-204.ngrok-free.app'],
    },
});
