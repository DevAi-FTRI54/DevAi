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
    allowedHosts: ['e91785f32c64.ngrok.app'],
  },
});
