import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const entry = (file: string) => fileURLToPath(new URL(file, import.meta.url));

/** В прод-сборке /admin отдаёт nginx; в dev-сервере тот же путь нужно смапить руками. */
const adminRoute = (): Plugin => ({
  name: 'admin-route',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/admin' || req.url === '/admin/') req.url = '/admin.html';
      next();
    });
  },
});

export default defineConfig({
  plugins: [adminRoute()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        dashboard: entry('index.html'),
        admin: entry('admin.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
