import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  const rootDir = path.dirname(fileURLToPath(import.meta.url));
  const env = loadEnv(mode, rootDir, '');
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:3000';

  return {
    plugins: [
      react(),
      basicSsl()
    ],

    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src')
      }
    },

    server: {
      port: 5173,

      // listen semua interface (LAN + vEthernet + localhost)
      host: '0.0.0.0',

      // allow akses via IP
      allowedHosts: true,

      // HTTPS wajib untuk MediaRecorder
      https: true,

      // HMR jangan dikunci ke host tertentu
      // biarkan mengikuti host yang diakses (192 / 172 / localhost)
      hmr: {
        protocol: 'wss',
        clientPort: 5173
      },

      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (p) => p.replace(/^\/api/, '')
        }
      }
    }
  };
});
