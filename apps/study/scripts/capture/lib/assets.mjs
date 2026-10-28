// The copy's file store: every resource is written once under its content hash (site/assets/<sha1>.<ext>) and
// referenced by an absolute path (/_r/<id>/assets/<sha1>.<ext>). CSS is rewritten before it is hashed, so its own
// url() and @import references point at stored files too.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CTYPE_EXT = {
  'text/css': '.css',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
  'font/woff2': '.woff2',
  'font/woff': '.woff',
  'font/ttf': '.ttf',
  'font/otf': '.otf',
  'application/font-woff2': '.woff2',
  'application/font-woff': '.woff',
  'application/x-font-woff': '.woff',
  'application/x-font-ttf': '.ttf',
  'application/vnd.ms-fontobject': '.eot',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};
const KNOWN = new Set(Object.values(CTYPE_EXT).concat(['.jpeg', '.json']));

/** File type from the bytes first, then the content type, then the URL. */
export function extensionOf(body, ctype, url, kind) {
  const b = body;
  const asc = (i, n) => b.subarray(i, i + n).toString('latin1');
  if (b.length >= 12) {
    if (b[0] === 0x89 && asc(1, 3) === 'PNG') return '.png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return '.jpg';
    if (asc(0, 4) === 'GIF8') return '.gif';
    if (asc(0, 4) === 'RIFF' && asc(8, 4) === 'WEBP') return '.webp';
    if (asc(4, 4) === 'ftyp') return /avi[fs]/.test(asc(8, 4)) ? '.avif' : '.mp4';
    if (asc(0, 4) === 'wOF2') return '.woff2';
    if (asc(0, 4) === 'wOFF') return '.woff';
    if (asc(0, 4) === 'OTTO') return '.otf';
    if (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0) return '.ttf';
    if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return '.ico';
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return '.webm';
  }
  const ct = (ctype || '').split(';')[0].trim().toLowerCase();
  if (kind === 'css' || ct === 'text/css') return '.css';
  const head = b.subarray(0, 512).toString('utf8').trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return '.svg';
  if (CTYPE_EXT[ct]) return CTYPE_EXT[ct];
  try {
    const m = new URL(url).pathname.toLowerCase().match(/\.[a-z0-9]{2,5}$/);
    if (m && KNOWN.has(m[0])) return m[0] === '.jpeg' ? '.jpg' : m[0];
  } catch {
    /* not a URL */
  }
  return '.bin';
}

/** Rewrites url(...), @import "..." and image-set("...") references in CSS. `resolve(abs)` returns a local path. */
export async function rewriteCss(css, baseUrl, resolve) {
  const found = [];
  const absOf = (ref) => {
    const r = ref.trim();
    if (!r || r.startsWith('data:') || r.startsWith('#') || r.startsWith('blob:')) return null;
    try {
      const u = new URL(r, baseUrl);
      return /^https?:$/.test(u.protocol) ? u.href : null;
    } catch {
      return null;
    }
  };
  // url( 'a' | "a" | a )
  const urlRe = /url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)'"\s]*))\s*\)/gi;
  const importRe = /@import\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/gi;
  const setRe = /image-set\(([^;{}]*?)\)\s*[;}]/gi;
  for (const m of css.matchAll(urlRe)) found.push({ text: m[0], ref: m[1] ?? m[2] ?? m[3] ?? '', kind: 'url' });
  for (const m of css.matchAll(importRe)) found.push({ text: m[0], ref: m[1] ?? m[2] ?? '', kind: 'import' });
  for (const m of css.matchAll(setRe)) {
    for (const s of m[1].matchAll(/(?<!url\(\s*)"((?:[^"\\]|\\.)*)"|(?<!url\(\s*)'((?:[^'\\]|\\.)*)'/g)) {
      found.push({ text: s[0], ref: s[1] ?? s[2] ?? '', kind: 'set' });
    }
  }
  const out = new Map();
  let missing = 0;
  await Promise.all(
    found.map(async (f) => {
      const a = absOf(f.ref);
      if (!a) return;
      const isCss = f.kind === 'import' || /\.css(\?|$)/i.test(a);
      const [bare, hash] = a.split('#');
      const l = await resolve(bare, isCss ? 'css' : 'asset');
      const target = l ? l + (hash !== undefined ? '#' + hash : '') : null;
      if (!target) missing++;
      const rep =
        f.kind === 'url'
          ? `url("${target ?? 'data:,'}")`
          : f.kind === 'import'
            ? `@import url("${target ?? 'data:,'}")`
            : `"${target ?? 'data:,'}"`;
      out.set(f.text, rep);
    }),
  );
  let text = css;
  for (const [from, to] of out) text = text.split(from).join(to);
  return { css: text, refs: found.length, missing };
}

/** Runs async jobs with at most `n` at a time. */
function limiter(n) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= n || !queue.length) return;
    active++;
    const { fn, res, rej } = queue.shift();
    fn()
      .then(res, rej)
      .finally(() => {
        active--;
        next();
      });
  };
  return (fn) =>
    new Promise((res, rej) => {
      queue.push({ fn, res, rej });
      next();
    });
}

export class AssetStore {
  /**
   * @param {string} siteDir replicas/<id>/site
   * @param {string} id replica id
   * @param {import('playwright').APIRequestContext} request for anything the page didn't load itself
   * @param {string} referer the page URL (some CDNs want it for fonts)
   */
  constructor(siteDir, id, request, referer) {
    this.dir = join(siteDir, 'assets');
    this.prefix = `/_r/${id}/assets/`;
    this.request = request;
    this.referer = referer;
    /** url (no hash) -> { body, ctype } from the live page's own responses */
    this.captured = new Map();
    /** url (no hash) -> Promise<local path | null> */
    this.local = new Map();
    this.written = new Map(); // file name -> bytes
    this.fetched = 0;
    this.failed = [];
    this.cssRefs = 0;
    this.cssMissing = 0;
    this.limit = limiter(8);
    mkdirSync(this.dir, { recursive: true });
  }

  /** Keeps a response body the live page loaded. */
  keep(url, body, ctype) {
    const u = url.split('#')[0];
    if (!this.captured.has(u)) this.captured.set(u, { body, ctype });
  }

  /** Writes bytes under their content hash; returns the absolute path to reference. */
  put(body, ctype, url, kind) {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const name = createHash('sha1').update(buf).digest('hex') + extensionOf(buf, ctype, url, kind);
    if (!this.written.has(name)) {
      writeFileSync(join(this.dir, name), buf);
      this.written.set(name, buf.length);
    }
    return this.prefix + name;
  }

  /** The local path for a URL, storing it (and, for CSS, everything it references) if needed. */
  ensure(url, kind = 'asset') {
    const u = url.split('#')[0];
    if (this.local.has(u)) return this.local.get(u);
    const job = (async () => {
      let got = this.captured.get(u);
      if (!got) {
        got = await this.limit(async () => {
          try {
            const r = await this.request.get(u, { headers: { referer: this.referer }, timeout: 20000, failOnStatusCode: false });
            if (!r.ok()) {
              this.failed.push(`${r.status()} ${u}`);
              return null;
            }
            this.fetched++;
            return { body: await r.body(), ctype: r.headers()['content-type'] || '' };
          } catch (e) {
            this.failed.push(`${String(e.message || e).split('\n')[0]} ${u}`);
            return null;
          }
        });
      }
      if (!got || !got.body || !got.body.length) return null;
      const isCss = kind === 'css' || (got.ctype || '').toLowerCase().startsWith('text/css');
      if (isCss) {
        const r = await rewriteCss(got.body.toString('utf8'), u, (a, k) => this.ensure(a, k));
        this.cssRefs += r.refs;
        this.cssMissing += r.missing;
        return this.put(Buffer.from(r.css, 'utf8'), 'text/css', u, 'css');
      }
      return this.put(got.body, got.ctype, u, kind);
    })();
    this.local.set(u, job);
    return job;
  }

  /** Stores a data: URL (canvas pixels) and returns its path. */
  putDataUrl(dataUrl) {
    const m = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!m) return null;
    const body = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
    return this.put(body, m[1] || '', '', 'asset');
  }

  stats() {
    let bytes = 0;
    for (const n of this.written.values()) bytes += n;
    return { files: this.written.size, kb: Math.round(bytes / 1024), fetchedExtra: this.fetched, failed: this.failed.length, cssRefs: this.cssRefs, cssMissing: this.cssMissing };
  }
}

/** Writes a file and its parent folders. */
export function writeOut(path, data) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, data);
}
