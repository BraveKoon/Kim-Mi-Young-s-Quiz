import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_DEV_BACKEND ?? 'http://localhost:3000';
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@shared': path.resolve(import.meta.dirname, '../shared') } },
    server: {
      port: 5173,
      host: true,
      allowedHosts: true,
      proxy: {
        '/api': { target: backend, changeOrigin: true, headers: { origin: backend } },
        '/socket.io': { target: backend, ws: true, changeOrigin: true, headers: { origin: backend } },
      },
    },
    build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
  };
});
