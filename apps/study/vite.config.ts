// The study site: the participant shell (index.html), the frame runtime every replica loads (/_study/frame.js), and
// the replicas themselves, each served at its original site's own path (see ReplicaManifest in src/contracts.ts).
//
// Build with --mode e2e: the in-page UI then uses open shadow roots (apps/extension/src/ui/mount.ts), which the frame
// runtime needs to measure taps and scrolling inside the simplified page.

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig, type Connect, type Plugin } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const replicasDir = join(here, 'replicas');

/** The engine code every session runs is pinned to this commit, stored with each session and delivery record. */
function engineCommit(): string {
  try {
    const head = execSync('git rev-parse --short=12 HEAD', { cwd: repo }).toString().trim();
    const dirty = execSync('git status --porcelain -- apps/extension/src packages/core/src', { cwd: repo }).toString().trim();
    return dirty ? `${head}+dirty` : head;
  } catch {
    return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'unknown';
  }
}

interface Served {
  id: string;
  servePath: string;
  file: string;
}

function readReplicas(): Served[] {
  if (!existsSync(replicasDir)) return [];
  const out: Served[] = [];
  for (const id of readdirSync(replicasDir)) {
    const m = join(replicasDir, id, 'manifest.json');
    if (!existsSync(m)) continue;
    try {
      const j = JSON.parse(readFileSync(m, 'utf8')) as Served;
      out.push({ id: j.id ?? id, servePath: j.servePath, file: j.file ?? 'index.html' });
    } catch {
      /* a half-written manifest: skip it */
    }
  }
  return out;
}

const TYPES: Record<string, string> = {
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

function send(res: Parameters<Connect.NextHandleFunction>[1], path: string): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.end(readFileSync(path));
}

/** Resolves a request path to a replica file on disk, or null. */
function replicaFile(urlPath: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(urlPath.split('?')[0]!.split('#')[0]!);
  } catch {
    return null;
  }
  if (path.startsWith('/_r/')) {
    const rest = path.slice('/_r/'.length);
    const slash = rest.indexOf('/');
    if (slash < 0) return null;
    const id = rest.slice(0, slash);
    const inner = rest.slice(slash + 1);
    if (inner.includes('..')) return null;
    // /_r/_shared/* is the shared behaviour modules; /_r/<id>/fixtures.json sits beside site/.
    const base = id === '_shared' ? join(replicasDir, '_shared') : join(replicasDir, id, inner === 'fixtures.json' ? '' : 'site');
    const f = join(base, inner);
    return existsSync(f) && statSync(f).isFile() ? f : null;
  }
  const trimmed = path.length > 1 ? path.replace(/\/$/, '') : path;
  for (const r of readReplicas()) {
    if (r.servePath === trimmed || r.servePath === path) {
      const f = join(replicasDir, r.id, 'site', r.file);
      return existsSync(f) ? f : null;
    }
  }
  return null;
}

function studyReplicas(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ?? '/';
    // Dev only: the frame runtime's fixed address loads the TypeScript entry through Vite.
    if (url.split('?')[0] === '/_study/frame.js' && !built) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(`import '/src/frame/main.ts';\n`);
      return;
    }
    const f = replicaFile(url);
    if (f) return send(res, f);
    next();
  };
  let built = false;
  let outDir = '';
  return {
    name: 'study-replicas',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      built = true;
      server.middlewares.use(middleware);
    },
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      // Copy every replica into the build: its files under /_r/<id>/, its page at its own path. Paths without an
      // extension are written as <path>.html and served by Vercel's cleanUrls.
      if (!outDir || !existsSync(outDir)) return;
      for (const r of readReplicas()) {
        const site = join(replicasDir, r.id, 'site');
        if (!existsSync(site)) continue;
        cpSync(site, join(outDir, '_r', r.id), { recursive: true });
        const fx = join(replicasDir, r.id, 'fixtures.json');
        if (existsSync(fx)) cpSync(fx, join(outDir, '_r', r.id, 'fixtures.json'));
        const target = extname(r.servePath) ? r.servePath : `${r.servePath}.html`;
        const dest = join(outDir, target);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, readFileSync(join(site, r.file)));
      }
      const shared = join(replicasDir, '_shared');
      if (existsSync(shared)) cpSync(shared, join(outDir, '_r', '_shared'), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [preact(), studyReplicas()],
  resolve: { dedupe: ['preact'] },
  define: { 'import.meta.env.VITE_ENGINE_COMMIT': JSON.stringify(engineCommit()) },
  server: { fs: { allow: [repo] } },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: { index: join(here, 'index.html'), frame: join(here, 'src/frame/main.ts') },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'frame' ? '_study/frame.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
