#!/usr/bin/env node
// WebAble eval harness. Loads the built extension (apps/extension/.output/chrome-mv3) into Playwright's
// Chrome for Testing, sets a demo fit, and for each site captures: before (WebAble paused), after (fitted),
// Jev Lens, Calm view. Saves PNGs + the TabReport per site and an index.html contact sheet.
//
//   pnpm eval                          demo pages, rosa fit
//   pnpm eval --sites all --fit reader demo pages + real sites
//   pnpm eval --only alderra-refill --headed
//   pnpm eval --check                  page checks only, no extension
//
// It starts the WebAble server for the run if it is not already running, and stops it afterwards.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { runDemoChecks } from './check-demo.mjs';
import {
  DESKTOP_UA, EXT_DIR, ROOT, SERVER_ORIGIN, browserTarget, loadCore, loadPlaywright, parseViewport, sleep, slug, stamp,
} from './lib/common.mjs';
import { ensureServer, health } from './lib/server.mjs';
import { renderSheet, siteMetrics } from './lib/sheet.mjs';

const HELP = `WebAble eval harness

  pnpm eval [options]

  --sites demo|real|all   which sites from scripts/eval/sites.json (default: demo)
  --only <names>          comma-separated site names, e.g. alderra-refill,drugs-metformin
  --fit rosa|typical|reader   demo fit to set (default: rosa)
  --viewport WxH          window size (default: 1280x720)
  --headed                show the browser
  --quick                 do not wait for the AI layout in Calm view
  --ext <dir>             unpacked extension (default: apps/extension/.output/chrome-mv3)
  --out <dir>             output folder (default: eval-output/<run>)
  --no-server             never start the WebAble server (use one that is already running)
  --check                 run the demo-page checks without the extension, then exit
`;

const PHASE_RANK = { idle: 0, reading: 1, tailored: 2, understood: 3, calm: 4 };
const rank = (p) => (p && p in PHASE_RANK ? PHASE_RANK[p] : -1);

let opt;
try {
  opt = parseArgs({
    allowNegative: true,
    options: {
      sites: { type: 'string', default: 'demo' },
      only: { type: 'string' },
      fit: { type: 'string', default: 'rosa' },
      viewport: { type: 'string', default: '1280x720' },
      headed: { type: 'boolean', default: false },
      quick: { type: 'boolean', default: false },
      ext: { type: 'string' },
      out: { type: 'string' },
      server: { type: 'boolean', default: true },
      check: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  }).values;
} catch (e) {
  console.error(`${e instanceof Error ? e.message : e}\n\n${HELP}`);
  process.exit(2);
}

const log = (...a) => console.log(...a);
const errText = (e) => (e instanceof Error ? e.message : String(e)).split('\n')[0].slice(0, 300);

/* ------------------------------------------------------------------ site list */
function pickSites() {
  const all = JSON.parse(readFileSync(path.join(ROOT, 'scripts/eval/sites.json'), 'utf8'));
  const tag = (list, group) => (list ?? []).map((s) => ({ ...s, group }));
  const demo = tag(all.demo, 'demo');
  const real = tag(all.real, 'real');
  const everything = [...demo, ...real];
  if (opt.only) {
    const names = opt.only.split(',').map((s) => s.trim()).filter(Boolean);
    const picked = everything.filter((s) => names.includes(s.name));
    const missing = names.filter((n) => !picked.some((s) => s.name === n));
    if (missing.length) throw new Error(`Unknown site(s): ${missing.join(', ')}. Known: ${everything.map((s) => s.name).join(', ')}`);
    return picked;
  }
  if (opt.sites === 'demo') return demo;
  if (opt.sites === 'real') return real;
  if (opt.sites === 'all') return everything;
  throw new Error(`--sites must be demo, real or all (got "${opt.sites}").`);
}

/* ------------------------------------------------------------------ extension control through the service worker */
function makeExtension(context, extensionId) {
  const prefix = `chrome-extension://${extensionId}/`;
  async function worker() {
    const live = context.serviceWorkers().find((w) => w.url().startsWith(prefix));
    if (live) return live;
    // A stopped worker restarts on the next extension event; opening the popup page is one.
    const p = await context.newPage();
    p.__webableEvalKeep = true;
    await p.goto(`${prefix}popup.html`).catch(() => {});
    const w = context.serviceWorkers().find((x) => x.url().startsWith(prefix)) ?? (await context.waitForEvent('serviceworker', { timeout: 8000 }));
    await p.close().catch(() => {});
    return w;
  }
  async function evaluate(fn, arg) {
    let last;
    for (let i = 0; i < 3; i++) {
      try {
        const w = await worker();
        return await w.evaluate(fn, arg);
      } catch (e) {
        last = e;
        await sleep(400);
      }
    }
    throw last;
  }
  return {
    evaluate,
    /** Prefer the background's __webable hooks; fall back to the storage keys they wrap. */
    setFit: (fit) =>
      evaluate(async (f) => {
        const g = globalThis.__webable;
        if (g && typeof g.setFit === 'function') { await g.setFit(f); return 'hook'; }
        await chrome.storage.local.set({ fit: f });
        return 'storage';
      }, fit),
    setSettings: (patch, defaults) =>
      evaluate(async ({ patch: p, defaults: d }) => {
        const cur = (await chrome.storage.local.get('settings')).settings ?? {};
        const next = { ...d, ...cur, ...p };
        const g = globalThis.__webable;
        if (g && typeof g.setSettings === 'function') await g.setSettings(next);
        else await chrome.storage.local.set({ settings: next });
        return next;
      }, { patch, defaults }),
    /** The TabReport for the tab showing `url` (or `tabId` if known). */
    report: (url, tabId) =>
      evaluate(async ({ url: u, tabId: known }) => {
        let id = known ?? null;
        if (id == null) {
          const tabs = await chrome.tabs.query({});
          const norm = (x) => String(x ?? '').split('#')[0];
          const origin = (() => { try { return new URL(u).origin; } catch { return ''; } })();
          const hit = tabs.find((t) => norm(t.url) === norm(u)) ?? tabs.find((t) => origin && String(t.url ?? '').startsWith(origin));
          id = hit?.id ?? null;
        }
        if (id == null) return { tabId: null, report: null };
        let rep = null;
        const g = globalThis.__webable;
        if (g && typeof g.getReport === 'function') {
          try { rep = (await g.getReport(id)) ?? null; } catch { rep = null; }
        }
        if (!rep) {
          const key = `report:${id}`;
          rep = (await chrome.storage.session.get(key))[key] ?? null;
        }
        return { tabId: id, report: rep };
      }, { url, tabId: tabId ?? null }),
  };
}

/* ------------------------------------------------------------------ one site */
async function evalSite(ctx, site) {
  const { context, ext, runDir, core } = ctx;
  const id = slug(site.name);
  const dir = path.join(runDir, id);
  mkdirSync(dir, { recursive: true });
  const res = {
    name: site.name, slug: id, group: site.group, url: site.url, finalUrl: null, note: site.note ?? '',
    shots: {}, shotNotes: {}, shotErrors: {}, errors: [], phases: {}, msToUnderstood: null, calmAuto: false,
    report: null, pageErrors: 0,
  };
  const settleMs = Number(site.settleMs) || (site.group === 'real' ? 6000 : 4000);
  const local = site.url.startsWith(SERVER_ORIGIN);
  const page = await context.newPage();
  page.__webableEvalKeep = true;
  let tabId = null;

  page.on('pageerror', (e) => {
    res.pageErrors += 1;
    if (local) res.errors.push(`page: ${errText(e)}`);
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const where = m.location()?.url ?? '';
    if (where.startsWith('chrome-extension://') || /webable/i.test(m.text())) res.errors.push(`extension: ${m.text().slice(0, 300)}`);
    else if (local && !/favicon/i.test(m.text())) res.errors.push(`console: ${m.text().slice(0, 300)}`);
  });

  const goto = async () => {
    try {
      const resp = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
      res.status = resp?.status() ?? null;
    } catch (e) {
      res.errors.push(`load: ${errText(e)}`);
    }
    res.finalUrl = page.url();
  };
  const getReport = async () => {
    try {
      const r = await ext.report(page.url(), tabId);
      if (r.tabId != null) tabId = r.tabId;
      return r.report;
    } catch (e) {
      res.errors.push(`report: ${errText(e)}`);
      return null;
    }
  };
  const waitFor = async (pred, timeoutMs) => {
    const t0 = Date.now();
    let rep = null;
    while (Date.now() - t0 < timeoutMs) {
      rep = await getReport();
      if (rep && pred(rep)) return { ok: true, ms: Date.now() - t0, report: rep };
      await sleep(300);
    }
    return { ok: false, ms: Date.now() - t0, report: rep };
  };
  const shot = async (key, note) => {
    const file = `${id}/${key}.png`;
    try {
      await page.mouse.move(-20, -20).catch(() => {});
      await page.screenshot({ path: path.join(runDir, file), timeout: 20_000 });
      res.shots[key] = file;
      if (note) res.shotNotes[key] = note;
    } catch (e) {
      res.shotErrors[key] = `Screenshot failed: ${errText(e)}`;
    }
  };
  /** Trusted key press from Playwright; first move focus off any text field (the shortcuts ignore those). */
  const press = async (combo) => {
    await page.bringToFront().catch(() => {});
    await page
      .evaluate(() => {
        const a = document.activeElement;
        if (a instanceof HTMLElement && a !== document.body && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) a.blur();
      })
      .catch(() => {});
    await page.keyboard.press(combo);
  };
  /** What the Calm view is showing, from the report's redesign summary. */
  const calmNote = (r, prefix = '') => {
    const d = r?.redesign;
    const what = !d
      ? 'heuristic layout'
      : d.autoApply
        ? `AI layout "${d.chosen}" applied`
        : d.chosen === 'heuristic'
          ? 'heuristic layout (Jev kept it)'
          : `heuristic layout · AI "${d.chosen}" offered`;
    return prefix ? `${prefix} · ${what}` : what;
  };
  /** In Calm view the AI layout swaps in after 6 s without input; wait for it unless --quick. */
  const waitForCalmLayout = async (openedAt) => {
    if (opt.quick) { await sleep(1200); return; }
    const w = await waitFor((r) => r.redesign != null || r.phase === 'error', 16_000);
    const sinceOpen = Date.now() - openedAt;
    if (w.ok && sinceOpen < 7000) await sleep(7000 - sinceOpen);
    await sleep(900);
  };

  try {
    // 1) Before: WebAble paused on this origin.
    const origins = new Set([new URL(site.url).origin]);
    await ext.setSettings({ enabled: true, lens: false, pausedOrigins: [...origins] }, core.DEFAULT_SETTINGS);
    await goto();
    const landed = (() => { try { return new URL(page.url()).origin; } catch { return null; } })();
    if (landed && landed.startsWith('http') && !origins.has(landed)) {
      origins.add(landed);
      await ext.setSettings({ pausedOrigins: [...origins] }, core.DEFAULT_SETTINGS);
      await goto();
    }
    await sleep(settleMs);
    res.phases.before = (await getReport())?.phase ?? null;
    await shot('before', res.phases.before && res.phases.before !== 'idle' ? `phase ${res.phases.before} (expected idle)` : '');

    // 2) After: enabled, fitted. Wait for Jev's decisions (phase >= understood) or 15 s.
    await ext.setSettings({ pausedOrigins: [] }, core.DEFAULT_SETTINGS);
    const navAt = Date.now();
    await goto();
    const w = await waitFor((r) => rank(r.phase) >= PHASE_RANK.understood || r.phase === 'error', 15_000);
    res.msToUnderstood = w.ok && rank(w.report?.phase) >= PHASE_RANK.understood ? Date.now() - navAt : null;
    const calmSeenAt = w.report?.phase === 'calm' ? Date.now() : null;
    const left = settleMs - (Date.now() - navAt);
    if (left > 0) await sleep(left);
    await sleep(1200);
    let rep = await getReport();
    res.phases.after = rep?.phase ?? null;
    if (!w.ok) res.errors.push(`timing: no "understood" phase within 15 s (last phase: ${w.report?.phase ?? 'no report'})`);

    // Calm view may open by itself (structureLevel 2 on a busy page). Capture it, then close it for "after".
    if (rep?.phase === 'calm') {
      res.calmAuto = true;
      await waitForCalmLayout(calmSeenAt ?? navAt);
      rep = await getReport();
      await shot('calm', calmNote(rep, 'opened by itself'));
      await press('Alt+Shift+KeyC');
      await sleep(900);
      rep = await getReport();
    }
    await shot('after', rep ? `phase ${rep.phase}${res.calmAuto ? ' · Calm view closed for this shot' : ''}` : 'no report');

    // 3) Jev Lens (Alt+J), then off again.
    await press('Alt+KeyJ');
    await sleep(1500);
    await shot('lens');
    await press('Alt+KeyJ');
    await sleep(500);

    // 4) Calm view (Alt+Shift+C) if it did not open by itself.
    if (!res.calmAuto) {
      await press('Alt+Shift+KeyC');
      const openedAt = Date.now();
      const c = await waitFor((r) => r.phase === 'calm' || r.phase === 'error', 8000);
      if (!c.ok || c.report?.phase !== 'calm') res.errors.push(`calm: Calm view did not report phase "calm" within 8 s (last: ${c.report?.phase ?? 'no report'})`);
      await waitForCalmLayout(openedAt);
      rep = await getReport();
      await shot('calm', c.ok ? calmNote(rep) : 'Calm view did not open');
      await press('Alt+Shift+KeyC');
      await sleep(400);
    }
    res.report = await getReport();
  } catch (e) {
    res.errors.push(`harness: ${errText(e)}`);
    res.report = res.report ?? (await getReport());
  } finally {
    res.errors = [...new Set(res.errors)];
    writeFileSync(path.join(dir, 'report.json'), `${JSON.stringify(res.report, null, 2)}\n`);
    await page.close().catch(() => {});
  }
  return res;
}

/* ------------------------------------------------------------------ main */
async function main() {
  if (opt.help) { log(HELP); return 0; }
  if (opt.check) {
    const r = await runDemoChecks({ headed: opt.headed, outDir: opt.out ? path.resolve(opt.out) : undefined });
    return r.ok ? 0 : 1;
  }

  const startedAt = Date.now();
  const core = await loadCore();
  const fit = core.DEMO_FITS?.[opt.fit];
  if (!fit) throw new Error(`Unknown fit "${opt.fit}". Use rosa, typical or reader.`);
  const sites = pickSites();
  if (!sites.length) throw new Error('No sites selected.');
  const viewport = parseViewport(opt.viewport);
  const extDir = path.resolve(opt.ext ?? EXT_DIR);
  if (!existsSync(path.join(extDir, 'manifest.json'))) {
    throw new Error(`No built extension at ${extDir}. Build it first: pnpm --filter @webable/extension build`);
  }
  const run = `${stamp()}-${opt.fit}`;
  const runDir = path.resolve(opt.out ?? path.join(ROOT, 'eval-output', run));
  mkdirSync(runDir, { recursive: true });
  log(`WebAble eval · ${sites.length} site(s) · fit ${opt.fit} · ${viewport.width}×${viewport.height}`);
  log(`Output: ${runDir}`);

  let server = { started: false, stop: async () => {}, health: null };
  try {
    server = await ensureServer({ logFile: path.join(runDir, 'server.log'), start: opt.server, log });
  } catch (e) {
    if (opt.server) throw e;
    log(`Warning: ${errText(e)} Continuing; demo pages and Jev calls will fail.`);
  }
  const h = server.health ?? (await health());
  const serverLine = h
    ? `${server.started ? 'started for this run' : 'already running'}${h.jev ? ` · Jev ${h.jev.model ?? ''}${h.jev.warm ? ' warm' : ' cold'}` : ''}${typeof h.openai === 'boolean' ? ` · OpenAI ${h.openai ? 'on' : 'off'}` : ''}`
    : 'not running';
  log(`Server: ${serverLine}`);

  const { chromium } = loadPlaywright();
  const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'webable-eval-'));
  let context = null;
  let interrupted = false;
  const cleanup = async () => {
    await context?.close().catch(() => {});
    context = null;
    await server.stop().catch(() => {});
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
  };
  const onSignal = () => {
    if (interrupted) return;
    interrupted = true;
    log('\nInterrupted; closing the browser and server…');
    void cleanup().then(() => process.exit(130));
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  const results = [];
  let extensionId = null;
  let browserVersion = null;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      ...browserTarget(),
      headless: !opt.headed,
      viewport,
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      locale: 'en-US',
      userAgent: DESKTOP_UA,
      args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
    });
    // The extension opens its fitting page on install; close extension tabs we did not open.
    context.on('page', (p) => {
      setTimeout(() => {
        if (!p.__webableEvalKeep && p.url().startsWith('chrome-extension://')) p.close().catch(() => {});
      }, 1500);
    });
    let sw = context.serviceWorkers()[0];
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15_000 }).catch(() => null);
    if (!sw) throw new Error('The extension did not start (no service worker). Is the build complete?');
    extensionId = new URL(sw.url()).host;
    browserVersion = await sw.evaluate(() => (/(?:Headless)?Chrome\/[\d.]+/.exec(navigator.userAgent) ?? [navigator.userAgent])[0]).catch(() => null);
    log(`Extension ${extensionId} · ${browserVersion ?? 'browser'}`);
    const ext = makeExtension(context, extensionId);
    const how = await ext.setFit(fit);
    await ext.setSettings({ enabled: true, lens: false, pausedOrigins: [] }, core.DEFAULT_SETTINGS);
    log(`Fit "${opt.fit}" set (${how}).`);
    await sleep(1600);
    for (const p of context.pages()) if (!p.__webableEvalKeep) await p.close().catch(() => {});

    for (const site of sites) {
      if (interrupted) break;
      log(`\n→ ${site.name}  ${site.url}`);
      const t0 = Date.now();
      const r = await evalSite({ context, ext, runDir, core }, site);
      const m = siteMetrics(r);
      log(`  phase ${m.phase ?? 'none'} · ${m.decisions ?? 0} Jev decisions · ${m.jevMs != null ? `${Math.round(m.jevMs)} ms` : '—'} · ${m.opsApplied} ops applied, ${m.opsReversed} reversed · ${m.checksFailed.length} checks failed · ${m.errors.length} errors · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      for (const e of m.errors.slice(0, 4)) log(`    ! ${e}`);
      results.push(r);
    }
  } finally {
    const meta = {
      run, fit: opt.fit, viewport, extensionId, browser: browserVersion, server: serverLine, durationMs: Date.now() - startedAt,
      sites: opt.only ?? opt.sites,
    };
    if (results.length) {
      writeFileSync(path.join(runDir, 'index.html'), renderSheet(meta, results));
      const summary = {
        ...meta,
        results: results.map((r) => ({
          name: r.name, url: r.url, finalUrl: r.finalUrl, status: r.status ?? null, phases: r.phases, msToUnderstood: r.msToUnderstood,
          calmAuto: r.calmAuto, shots: r.shots, shotErrors: r.shotErrors, pageErrors: r.pageErrors, ...siteMetrics(r),
        })),
      };
      writeFileSync(path.join(runDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    }
    await cleanup();
  }
  log(`\nContact sheet: ${path.join(runDir, 'index.html')}`);
  const problems = results.filter((r) => siteMetrics(r).errors.length > 0 || !r.shots.after).length;
  return problems ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`eval: ${errText(e)}`);
    process.exit(1);
  });
