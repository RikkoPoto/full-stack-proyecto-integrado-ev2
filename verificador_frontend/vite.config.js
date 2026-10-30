import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // En desarrollo las llamadas a /api se reenvían al backend.
      proxy: {
        '/api': { target: env.VITE_API_PROXY || 'http://localhost:8000', changeOrigin: true },
      },
    },
    test: { environment: 'node', include: ['src/**/*.test.js'] },
  };
});
