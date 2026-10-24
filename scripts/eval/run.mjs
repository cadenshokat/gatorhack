#!/usr/bin/env node
// WebAble eval harness. Loads the built extension (apps/extension/.output/chrome-mv3) into Playwright's
// Chrome for Testing, sets a demo fit, and for each site captures: before (WebAble paused), after (fitted),
// Jev Lens, Calm view. Saves PNGs + the TabReport per site and an index.html contact sheet.
//
//   pnpm eval                          demo pages, rosa fit
//   pnpm eval --sites all --fit reader demo pages + real sites
//   pnpm eval --only alderra-refill --headed
//   pnpm eval --fitting                the fitting flow, every screen, with layout checks
//   pnpm eval --interact               panel, Lens, Explain, offer, Calm steps, Confirm, Original on Alderra
//   pnpm eval --sites all --interact --fitting   everything into one contact sheet
//   pnpm eval --check                  page checks only, no extension
//
// It starts the WebAble server for the run if it is not already running, and stops it afterwards.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { runDemoChecks } from './check-demo.mjs';
import {
  DESKTOP_UA, EXT_DIR, ROOT, SERVER_ORIGIN, browserTarget, loadCore, loadPlaywright, parseViewport, shoot, sleep, slug, stamp,
} from './lib/common.mjs';
import { mainLabelFrom, measureView } from './lib/firstscreen.mjs';
import { runFitting } from './lib/fitting.mjs';
import { runInteract } from './lib/interact.mjs';
import { ensureServer, health } from './lib/server.mjs';
import { renderSheet, siteMetrics } from './lib/sheet.mjs';
import { uiProbe } from './lib/ui.mjs';

const HELP = `WebAble eval harness

  pnpm eval [options]

  --sites demo|real|all|none  which sites from scripts/eval/sites.json (default: demo, or none when
                          --fitting / --interact is given without --sites or --only)
  --only <names>          comma-separated site names, e.g. alderra-refill,drugs-metformin
  --fitting               also run the fitting flow and screenshot every screen (R1 pressed Larger once)
  --larger <n>            how many times to press Larger on the first fitting screen (default: 1)
  --interact              also drive one demo page: panel, Lens, Explain, offer, Calm steps, Confirm, Original
  --interact-site <name>  the page for --interact (default: alderra-refill)
  --struggle <seconds>    how long --interact tries near-misses before giving up on an offer (default: 75)
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

// `pnpm eval -- --sites all` passes a lone "--" first; drop it so the flags after it still count.
const argv = process.argv.slice(2);
while (argv[0] === '--') argv.shift();

let opt;
let explicitSites = false;
try {
  const parsed = parseArgs({
    args: argv,
    allowNegative: true,
    tokens: true,
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
      fitting: { type: 'boolean', default: false },
      larger: { type: 'string', default: '1' },
      interact: { type: 'boolean', default: false },
      'interact-site': { type: 'string', default: 'alderra-refill' },
      struggle: { type: 'string', default: '75' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  opt = parsed.values;
  explicitSites = parsed.tokens.some((t) => t.kind === 'option' && (t.name === 'sites' || t.name === 'only'));
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
  if ((opt.fitting || opt.interact) && !explicitSites) return [];
  if (opt.sites === 'none') return [];
  if (opt.sites === 'demo') return demo;
  if (opt.sites === 'real') return real;
  if (opt.sites === 'all') return everything;
  throw new Error(`--sites must be demo, real, all or none (got "${opt.sites}").`);
}

function allSites() {
  const all = JSON.parse(readFileSync(path.join(ROOT, 'scripts/eval/sites.json'), 'utf8'));
  return [...(all.demo ?? []).map((s) => ({ ...s, group: 'demo' })), ...(all.real ?? []).map((s) => ({ ...s, group: 'real' }))];
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
    report: null, pageErrors: 0, firstScreen: {},
  };
  /** First-screen facts for one view; never lets a measuring problem stop the run. */
  const measure = async (kind, mainLabel) => {
    try {
      res.firstScreen[kind] = await measureView(page, kind, { mainLabel });
    } catch (e) {
      res.firstScreen[kind] = { kind, error: errText(e) };
    }
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
      await shoot(page, path.join(runDir, file));
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
    await measure('before', null);

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
    let mainLabel = mainLabelFrom(rep);
    if (rep?.phase === 'calm') {
      res.calmAuto = true;
      await waitForCalmLayout(calmSeenAt ?? navAt);
      rep = await getReport();
      mainLabel = mainLabelFrom(rep) ?? mainLabel;
      await shot('calm', calmNote(rep, 'opened by itself'));
      await measure('calm', mainLabel);
      await press('Alt+Shift+KeyC');
      // The pill and the overlay bar settle about 2 s after Calm view closes (the pill moves only when it is sure).
      await sleep(2200);
      rep = await getReport();
    }
    await shot('after', rep ? `phase ${rep.phase}${res.calmAuto ? ' · Calm view closed for this shot' : ''}` : 'no report');
    mainLabel = mainLabelFrom(rep) ?? mainLabel;
    res.mainLabel = mainLabel;
    await measure('after', mainLabel);

    // 3) Jev Lens (Alt+Shift+L; Alt+J on round-1 builds), then off again.
    const lensOn = async () => (await uiProbe(page)).lens;
    let lensKey = 'Alt+Shift+KeyL';
    await press(lensKey);
    await sleep(1500);
    if (!(await lensOn())) {
      lensKey = 'Alt+KeyJ';
      await press(lensKey);
      await sleep(1500);
    }
    await shot('lens');
    await measure('lens', mainLabel);
    await press(lensKey);
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
      if (c.ok) await measure('calm', mainLabel);
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
  if (!sites.length && !opt.fitting && !opt.interact) throw new Error('No sites selected.');
  const interactSite = opt.interact ? allSites().find((s) => s.name === opt['interact-site']) : null;
  if (opt.interact && !interactSite) throw new Error(`Unknown --interact-site "${opt['interact-site']}".`);
  const viewport = parseViewport(opt.viewport);
  const extDir = path.resolve(opt.ext ?? EXT_DIR);
  if (!existsSync(path.join(extDir, 'manifest.json'))) {
    throw new Error(`No built extension at ${extDir}. Build it first: pnpm --filter @webable/extension build`);
  }
  const run = `${stamp()}-${opt.fit}`;
  const runDir = path.resolve(opt.out ?? path.join(ROOT, 'eval-output', run));
  mkdirSync(runDir, { recursive: true });
  const extras = [opt.fitting ? 'fitting flow' : null, opt.interact ? `interactions on ${opt['interact-site']}` : null].filter(Boolean);
  log(`WebAble eval · ${sites.length} site(s)${extras.length ? ` + ${extras.join(' + ')}` : ''} · fit ${opt.fit} · ${viewport.width}×${viewport.height}`);
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
    ? `${server.started ? 'started for this run' : 'already running'}${h.jev ? ` · Jev ${h.jev.model ?? ''}${h.jev.warm ? ' warm' : ' cold'}` : ''}${typeof h.ai === 'string' ? ` · AI layouts ${h.ai === 'no_credits' ? 'off (no credits)' : h.ai}` : typeof h.openai === 'boolean' ? ` · OpenAI ${h.openai ? 'on' : 'off'}` : ''}`
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
  let fitting = null;
  let interact = null;
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

    if (opt.fitting && !interrupted) {
      log('\n→ fitting flow');
      const t0 = Date.now();
      fitting = await runFitting({ context, extensionId, runDir, larger: Math.max(0, Number(opt.larger) || 0), log });
      fitting.fit = await ext.evaluate(async () => (await chrome.storage.local.get('fit')).fit ?? null).catch(() => null);
      const bad = fitting.screens.filter((x) => !x.ok).length;
      log(`  ${fitting.screens.length} screens · ${bad} with problems · ${fitting.seconds ?? '—'} s to "Your fit" · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      // The fitting saved a measured fit: put the demo fit back for the pages.
      await ext.setFit(fit);
      await sleep(600);
    }

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

    if (opt.interact && interactSite && !interrupted) {
      log(`\n→ interactions on ${interactSite.name}`);
      const t0 = Date.now();
      await ext.setSettings({ enabled: true, lens: false, pausedOrigins: [] }, core.DEFAULT_SETTINGS);
      interact = await runInteract({ context, runDir, site: interactSite, ext, health: h, struggleSeconds: Math.max(10, Number(opt.struggle) || 75), log });
      const bad = interact.steps.filter((x) => !x.ok).length;
      log(`  ${interact.steps.length} steps · ${bad} with a failed check · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      for (const e of interact.errors.slice(0, 4)) log(`    ! ${e}`);
    }
  } finally {
    const meta = {
      run, fit: opt.fit, viewport, extensionId, browser: browserVersion, server: serverLine, durationMs: Date.now() - startedAt,
      sites: opt.only ?? opt.sites,
    };
    if (results.length || fitting || interact) {
      writeFileSync(path.join(runDir, 'index.html'), renderSheet(meta, results, { fitting, interact }));
      const summary = {
        ...meta,
        results: results.map((r) => ({
          name: r.name, url: r.url, finalUrl: r.finalUrl, status: r.status ?? null, phases: r.phases, msToUnderstood: r.msToUnderstood,
          calmAuto: r.calmAuto, shots: r.shots, shotErrors: r.shotErrors, pageErrors: r.pageErrors, mainLabel: r.mainLabel ?? null,
          firstScreen: r.firstScreen, ...siteMetrics(r),
        })),
        fitting,
        interact,
      };
      writeFileSync(path.join(runDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    }
    await cleanup();
  }
  log(`\nContact sheet: ${path.join(runDir, 'index.html')}`);
  const problems =
    results.filter((r) => siteMetrics(r).errors.length > 0 || !r.shots.after).length +
    (fitting ? fitting.screens.filter((x) => !x.ok).length + fitting.errors.length : 0) +
    (interact ? interact.steps.filter((x) => !x.ok).length + interact.errors.length : 0);
  return problems ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`eval: ${errText(e)}`);
    process.exit(1);
  });
