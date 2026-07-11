import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/ascii-threejs-renderer/',
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        os: resolve(__dirname, 'os.html'),
      },
    },
  },
});