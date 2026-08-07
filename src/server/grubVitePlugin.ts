import type { Plugin } from 'vite';
import { handleApiRequest } from './grubBackend';

export function grubApiPlugin(): Plugin {
  return {
    name: 'grub-editor-live-system-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const handled = await handleApiRequest(req, res);
          if (!handled) {
            next();
          }
        } catch (err: any) {
          console.error("Vite API Middleware error:", err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
        }
      });
    }
  };
}
