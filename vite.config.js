import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api/': {
        target: 'http://127.0.0.1:8788',
        configure(proxy) {
          proxy.on('error', (_error, _request, response) => {
            if ('writeHead' in response && !response.headersSent) {
              response.writeHead(503, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ error: 'api_unavailable' }));
            }
          });
        },
      },
    },
  },
});
