// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: false,
    },
    allowedHosts: ['.ngrok.app', 'dev-ai.app'], // ✅ wildcard support
    cors: {
      origin: ['https://a59d8fd60bb0.ngrok.app', 'https://dev-ai.app'],
      credentials: true,
    },
    // proxy: {
    //   '/api': {
    //     target: 'http://localhost:4000',
    //     changeOrigin: true,
    //     secure: false,
    //   },
    // },
  },
});
