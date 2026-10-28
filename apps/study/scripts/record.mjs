#!/usr/bin/env node
// Records the model answers for replicas, once, on the dev machine (engine-seams §6.6). Each configuration of the
// matrix loads the replica in the dev host (dev.html) in the adapted condition with mode=record: the frame posts to
// the real server on 127.0.0.1:41741 exactly as the extension's background would, and collects every answer.
// The answers are merged into replicas/<id>/fixtures.json, which is replaced as a whole with the next version.
//
// Freezing rule (decided before recording): the canonical pass (typical fit, 664 px frame) runs first and its first
// successful answer wins; the other configurations only add answers the canonical pass never asked for. Failures are
// never frozen. Nothing is hand-picked.
//
//   node scripts/record.mjs <replicaId> [<replicaId>…] [--port 5192] [--fits typical,rosa,reader,large,calm]
//        [--heights 568,664,760] [--timeout 180]
// Needs: the server on 127.0.0.1:41741 (refuses to run otherwise) and the study dev server on --port
// (./node_modules/.bin/vite --mode e2e --host 127.0.0.1 --port 5192).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, devices, webkit } from 'playwright';

export const here = dirname(fileURLToPath(import.meta.url));
export const studyDir = resolve(here, '..');
export const repoDir = resolve(studyDir, '../..');
export const SERVER = 'http://127.0.0.1:41741';
export const FITS = ['typical', 'rosa', 'reader', 'large', 'calm'];
export const HEIGHTS = [568, 664, 760];
export const CANONICAL = { fit: 'typical', h: 664 };
const FIXTURES_V = 'study-fixtures.1';

export function parseArgs(argv) {
  const out = { ids: [], port: 5192, fits: FITS, heights: HEIGHTS, timeout: 180, engine: 'chromium' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--port') out.port = Number(next());
    else if (a === '--fits') out.fits = next().split(',').filter(Boolean);
    else if (a === '--heights') out.heights = next().split(',').map(Number).filter(Boolean);
    else if (a === '--timeout') out.timeout = Number(next());
    else if (a === '--engine') out.engine = next();
    else if (a.startsWith('--')) throw new Error(`Unknown option ${a}`);
    else out.ids.push(a);
  }
  if (!out.ids.length) throw new Error('Name at least one replica id');
  return out;
}

/** The matrix, canonical first. */
export function matrix(fits, heights) {
  const rest = [];
  for (const fit of fits) for (const h of heights) if (!(fit === CANONICAL.fit && h === CANONICAL.h)) rest.push({ fit, h, canonical: false });
  return [{ ...CANONICAL, canonical: true }, ...rest];
}

export function readManifest(id) {
  const p = join(studyDir, 'replicas', id, 'manifest.json');
  if (!existsSync(p)) throw new Error(`No replicas/${id}/manifest.json`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function readFixtures(id) {
  const p = join(studyDir, 'replicas', id, 'fixtures.json');
  if (!existsSync(p)) return null;
  try {
    const f = JSON.parse(readFileSync(p, 'utf8'));
    return f && f.v === FIXTURES_V ? f : null;
  } catch {
    return null;
  }
}

function git(args) {
  try {
    return execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** HEAD, marked when the given paths differ from it. */
export function commitOf(paths) {
  const head = git(['rev-parse', 'HEAD']) || 'unknown';
  const dirty = git(['status', '--porcelain', '--', ...paths]);
  return dirty ? `${head}+dirty` : head;
}

export async function serverHealth() {
  try {
    const res = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(4000) });
    const j = await res.json();
    return res.ok && j && j.ok === true ? j : null;
  } catch {
    return null;
  }
}

export async function devHostUp(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/dev.html`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** An iPhone-shaped page: Safari's user agent, 390 CSS px wide, DPR 3, touch. */
export async function phoneContext(browser, h) {
  return browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: h }, screen: { width: 390, height: 844 }, deviceScaleFactor: 3 });
}

export function launch(engine) {
  return (engine === 'webkit' ? webkit : chromium).launch();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Open one configuration in the dev host and wait for the frame's runtime. */
export async function openTrial(browser, { port, id, condition, fit, h, mode, fresh }) {
  const ctx = await phoneContext(browser, h);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const q = new URLSearchParams({ r: id, c: condition, fit, h: String(h), mode, ...(fresh ? { fresh: '1' } : {}) });
  await page.goto(`http://127.0.0.1:${port}/dev.html?${q}`);
  const frameReady = async () => {
    for (let i = 0; i < 200; i++) {
      const f = page.frames().find((x) => x !== page.mainFrame());
      if (f) {
        const ok = await f.evaluate(() => !!window.__studyFrame).catch(() => false);
        if (ok) return f;
      }
      await sleep(100);
    }
    throw new Error('The frame runtime never started');
  };
  const frame = await frameReady();
  return { ctx, page, frame, errors };
}

/** Wait until the page is ready, nothing is in flight and the engine is quiet for `quietMs`. */
export async function waitDone(frame, { timeoutMs, quietMs = 3000, needReady = true }) {
  const t0 = Date.now();
  let quietSince = 0;
  let last = null;
  while (Date.now() - t0 < timeoutMs) {
    const s = await frame.evaluate(() => window.__studyFrame.status()).catch(() => null);
    last = s;
    const busy = !s || (needReady && !s.ready) || (s.inFlight ?? 0) > 0 || s.composeStatus === 'working' || (s.pendingWork ?? 0) > 0;
    if (busy) quietSince = 0;
    else if (!quietSince) quietSince = Date.now();
    else if (Date.now() - quietSince >= quietMs) return { status: s, ms: Date.now() - t0, timedOut: false };
    await sleep(250);
  }
  return { status: last, ms: Date.now() - t0, timedOut: true };
}

/**
 * Runs one configuration again when the dev host page reloaded under it (the dev server reloads open pages when files
 * it serves change or it restarts). Answers from the lost run are dropped; nothing from it was merged.
 */
export async function withRetry(label, fn, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const reloaded = /detached|Execution context was destroyed|Target (page, context or browser )?closed|navigat|never started/i.test(msg);
      if (!reloaded || i >= tries) throw err;
      console.log(`    ${label}: the page reloaded (${msg.split('\n')[0]}); running it again`);
    }
  }
}

function emptyFixtures(id, manifest) {
  return {
    v: FIXTURES_V, replicaId: id, version: '0', servePath: manifest.servePath, originalHost: manifest.originalHost,
    engineCommit: '', serverCommit: '', models: { jev: '', compose: '' }, recordedAt: '',
    matrix: { fits: [], heights: [], engines: [], canonical: CANONICAL },
    understand: { page: null, elements: [] }, meaning: {}, overlayClose: {}, compose: {}, composeMeta: null, runs: [],
  };
}

/** Merge one page view's answers: first answer wins (the canonical pass runs first). */
export function mergeRecorded(fx, rec, run) {
  const added = { elements: 0, page: false, meaning: 0, overlayClose: 0, compose: 0 };
  if (!fx.understand.page && rec.understand.page) {
    fx.understand.page = rec.understand.page;
    added.page = true;
  }
  const have = new Set(fx.understand.elements.map((e) => `${e.id}\n${e.fp}`));
  for (const e of rec.understand.elements) {
    const k = `${e.id}\n${e.fp}`;
    if (have.has(k)) continue;
    have.add(k);
    fx.understand.elements.push({ ...e, from: run.canonical ? 'canonical' : 'union' });
    added.elements++;
  }
  for (const key of ['meaning', 'overlayClose', 'compose']) {
    for (const [k, v] of Object.entries(rec[key] ?? {})) {
      if (k in fx[key]) continue;
      fx[key][k] = v;
      added[key]++;
    }
  }
  if (!fx.composeMeta && rec.composeMeta) fx.composeMeta = rec.composeMeta;
  return added;
}

function composeModel() {
  try {
    const src = readFileSync(join(repoDir, 'packages/core/src/types.ts'), 'utf8');
    return /export const COMPOSE_MODEL = '([^']+)'/.exec(src)?.[1] ?? '';
  } catch {
    return '';
  }
}

async function recordReplica(browser, opts, id, health) {
  const manifest = readManifest(id);
  const prev = readFixtures(id);
  const fx = emptyFixtures(id, manifest);
  const runs = matrix(opts.fits, opts.heights);
  console.log(`\n${id}: ${runs.length} configurations, canonical ${CANONICAL.fit} @ ${CANONICAL.h}`);
  for (const run of runs) {
    const { t, done, rec, delivery, notes } = await withRetry(`${id} ${run.fit}@${run.h}`, async () => {
      const t = await openTrial(browser, { port: opts.port, id, condition: 'adapted', fit: run.fit, h: run.h, mode: 'record', fresh: run.canonical });
      try {
        const done = await waitDone(t.frame, { timeoutMs: opts.timeout * 1000 });
        const rec = await t.frame.evaluate(() => window.__studyFrame.recorded());
        const delivery = await t.frame.evaluate(() => window.__studyFrame.delivery());
        const notes = await t.page.evaluate(() => window.__devHost.notes);
        return { t, done, rec, delivery, notes };
      } finally {
        await t.ctx.close();
      }
    });
    if (!rec) throw new Error(`${id} ${run.fit}@${run.h}: the frame recorded nothing (is the dev server on --mode e2e?)`);
    const added = mergeRecorded(fx, rec, run);
    fx.runs.push({ fit: run.fit, h: run.h, canonical: run.canonical, at: new Date().toISOString(), added, errors: rec.errors, delivery });
    const d = delivery ?? {};
    console.log(
      `  ${run.canonical ? '*' : ' '} ${run.fit.padEnd(7)} ${String(run.h).padEnd(4)} ${done.timedOut ? 'TIMEOUT' : `${(done.ms / 1000).toFixed(1)} s`}` +
      ` · posted ${JSON.stringify(rec.posted)} · +${added.elements} el${added.page ? ' +page' : ''} +${added.meaning} meaning +${added.overlayClose} overlay +${added.compose} compose` +
      ` · calm ${d.simplified?.open ? 'open' : 'closed'} zoom ${d.pageZoom ?? '?'} groups ${d.compose?.laidOut ?? 0}/${d.compose?.groups ?? 0}` +
      `${rec.errors.length ? ` · errors ${rec.errors.map((e) => `${e.what}:${e.code}`).join(',')}` : ''}${t.errors.length ? ` · page errors ${t.errors.length}` : ''}`,
    );
    const odd = notes.filter((n) => n.kind !== 'link_blocked');
    if (odd.length) console.log(`      notes: ${odd.map((n) => `${n.kind}${n.detail ? `(${n.detail})` : ''}`).slice(0, 8).join(', ')}`);
  }
  fx.version = String((Number(prev?.version) || 0) + 1);
  fx.replicaHash = readManifest(id).contentHash ?? '';
  fx.engineCommit = commitOf(['apps/extension/src', 'packages/core/src']);
  fx.serverCommit = commitOf(['apps/server/src', 'packages/core/src']);
  fx.models = { jev: health.jev?.served || health.jev?.model || '', compose: fx.composeMeta?.model || composeModel() };
  fx.recordedAt = new Date().toISOString();
  fx.matrix = { fits: opts.fits, heights: opts.heights, engines: [opts.engine], canonical: CANONICAL };
  const out = join(studyDir, 'replicas', id, 'fixtures.json');
  writeFileSync(out, `${JSON.stringify(fx, null, 1)}\n`);
  console.log(`  wrote ${out}: version ${fx.version}, ${fx.understand.elements.length} elements, page ${fx.understand.page ? 'yes' : 'NO'}, ` +
    `${Object.keys(fx.meaning).length} meaning, ${Object.keys(fx.overlayClose).length} overlay, ${Object.keys(fx.compose).length} compose groups`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const health = await serverHealth();
  if (!health) {
    console.error(`Refusing to record: ${SERVER}/health is not ok. Start the server (pnpm dev:server) first.`);
    process.exit(2);
  }
  if (health.ai !== 'on') console.warn(`Warning: the server says AI is "${health.ai}": compose answers will be failures, and they would be frozen.`);
  if (!(await devHostUp(opts.port))) {
    console.error(`No dev host on http://127.0.0.1:${opts.port}/dev.html. Start: ./node_modules/.bin/vite --mode e2e --host 127.0.0.1 --port ${opts.port}`);
    process.exit(2);
  }
  for (const id of opts.ids) readManifest(id);
  const browser = await launch(opts.engine);
  try {
    for (const id of opts.ids) await recordReplica(browser, opts, id, health);
  } finally {
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
