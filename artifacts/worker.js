// PhotoChord Static Worker - Built dist files served as Data modules
// Source: 672d423a5f7c91d41c122c2a876f1260342a09a7
// No external fetches, no secrets, no eval

import asset0 from './asset-0.bin';
import asset1 from './asset-1.bin';
import asset2 from './asset-2.bin';

const ASSET_MAP = {
  '/': { module: asset0, type: 'text/html; charset=utf-8', cache: 'no-cache' },
  '/index.html': { module: asset0, type: 'text/html; charset=utf-8', cache: 'no-cache' },
  '/assets/index-DCmNTNtN.js': { module: asset1, type: 'application/javascript; charset=utf-8', cache: 'immutable' },
  '/assets/index-DtvVsUGo.css': { module: asset2, type: 'text/css; charset=utf-8', cache: 'immutable' }
};

const HTML_FALLBACK = asset0;
const HTML_TYPE = 'text/html; charset=utf-8';

function isFileLike(path) {
  return /\.[a-z0-9]+$/i.test(path);
}

function shouldFallbackToHTML(pathname) {
  if (pathname.startsWith('/api/')) return false;
  if (pathname.startsWith('/assets/')) return false;
  if (isFileLike(pathname)) return false;
  return true;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    if (method !== 'GET' && method !== 'HEAD') {
      return new Response('Method Not Allowed', { 
        status: 405,
        headers: { 'Allow': 'GET, HEAD' }
      });
    }

    const pathname = url.pathname;
    const asset = ASSET_MAP[pathname];

    if (asset) {
      const headers = new Headers({
        'Content-Type': asset.type,
        'X-Content-Type-Options': 'nosniff'
      });

      if (asset.cache === 'immutable') {
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        headers.set('Cache-Control', 'no-cache');
      }

      if (method === 'HEAD') {
        headers.set('Content-Length', asset.module.byteLength.toString());
        return new Response(null, { status: 200, headers });
      }

      return new Response(asset.module, { status: 200, headers });
    }

    if (shouldFallbackToHTML(pathname)) {
      const headers = new Headers({
        'Content-Type': HTML_TYPE,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });

      if (method === 'HEAD') {
        headers.set('Content-Length', HTML_FALLBACK.byteLength.toString());
        return new Response(null, { status: 200, headers });
      }

      return new Response(HTML_FALLBACK, { status: 200, headers });
    }

    return new Response('Not Found', { status: 404 });
  }
};
