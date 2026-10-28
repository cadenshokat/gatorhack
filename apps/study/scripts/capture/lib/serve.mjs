// A small static server with the same routes as vite.config.ts, for checks that shouldn't need the dev server:
// a replica's page at its servePath, its files at /_r/<id>/*, the shared modules at /_r/_shared/*, and
// /_study/frame.js as an empty stub (the copy is checked on its own; the real frame runtime is the frame builder's).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { REPLICAS, SHARED } from './context.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
};

function manifests() {
  const out = [];
  if (!existsSync(REPLICAS)) return out;
  for (const id of readdirSync(REPLICAS)) {
    const m = join(REPLICAS, id, 'manifest.json');
    if (!existsSync(m)) continue;
    try {
      const j = JSON.parse(readFileSync(m, 'utf8'));
      out.push({ id: j.id ?? id, servePath: j.servePath, file: j.file ?? 'index.html' });
    } catch {
      /* half-written */
    }
  }
  return out;
}

export function fileFor(urlPath) {
  let path;
  try {
    path = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  if (path.startsWith('/_r/')) {
    const rest = path.slice(4);
    const slash = rest.indexOf('/');
    if (slash < 0) return null;
    const id = rest.slice(0, slash);
    const inner = rest.slice(slash + 1);
    if (inner.includes('..')) return null;
    const base = id === '_shared' ? SHARED : join(REPLICAS, id, inner === 'fixtures.json' ? '' : 'site');
    const f = join(base, inner);
    return existsSync(f) && statSync(f).isFile() ? f : null;
  }
  const trimmed = path.length > 1 ? path.replace(/\/$/, '') : path;
  for (const r of manifests()) {
    if (r.servePath === trimmed || r.servePath === path) {
      const f = join(REPLICAS, r.id, 'site', r.file);
      return existsSync(f) ? f : null;
    }
  }
  return null;
}

/** Starts the server on 127.0.0.1 (random port by default). Returns { base, close, log }. */
export async function serveReplicas(port = 0) {
  const log = [];
  const server = createServer((req, res) => {
    const url = req.url || '/';
    if (url.split('?')[0] === '/_study/frame.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end('// check stub: the real frame runtime is not loaded here\n');
      return;
    }
    const f = fileFor(url);
    if (!f) {
      log.push(`404 ${url}`);
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(f).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow, noarchive',
    });
    res.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', () => r(null)));
  const addr = server.address();
  return { base: `http://127.0.0.1:${addr.port}`, close: () => new Promise((r) => server.close(() => r(null))), log };
}
