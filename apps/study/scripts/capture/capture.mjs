#!/usr/bin/env node
// Captures a live mobile page into replicas/<id>/ (see README.md):
//   node scripts/capture/capture.mjs <id> [--headed] [--no-har] [--no-checks | --checks-only]
// Reads replicas/<id>/capture.config.mjs. Writes site/<file>, site/assets/, site/behaviours.js, manifest.json and
// reference/ (live screenshots, metrics, HAR, tree signature, behaviour results). Then runs the round-trip check.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AssetStore, rewriteCss } from './lib/assets.mjs';
import { DPR, PHONE, SHARED, STUDY, VIEWPORT, WIDTHS, hookHelpers, launch, loadConfig, phoneContext, replicaDir, settle } from './lib/context.mjs';
import { contentHash, fnSource, runChecks } from './lib/util.mjs';
import { metricsInPage, overflowInPage } from './lib/metrics.mjs';
import { rewriteInPage, snapshotInPage } from './lib/inpage.mjs';
import { roundtrip } from './roundtrip.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
if (!id) {
  console.error('usage: node scripts/capture/capture.mjs <replica-id> [--headed] [--no-har] [--no-checks | --checks-only]');
  process.exit(2);
}
const flag = (f) => args.includes(f);
const log = (...a) => console.log(`[capture ${id}]`, ...a);
const t0 = Date.now();

const cfg = await loadConfig(id);
const dir = replicaDir(id);
const site = join(dir, 'site');
const ref = join(dir, 'reference');
mkdirSync(ref, { recursive: true });
const browser = await launch({ headed: flag('--headed') });
if (flag('--checks-only')) {
  // Re-run only the live behaviour checks and widths (after editing `checks` in the config).
  await liveChecksAndWidths();
  await browser.close();
  process.exit(0);
}
// Capture owns site/<file>, site/behaviours.js and site/assets/; hand-written site/page.js and site/local/ stay.
rmSync(join(site, 'assets'), { recursive: true, force: true });
rmSync(join(site, cfg.file), { force: true });
rmSync(join(site, 'behaviours.js'), { force: true });
mkdirSync(site, { recursive: true });

const har = cfg.har && !flag('--no-har');
const ctx = await phoneContext(browser, {
  capture: true,
  ...(har ? { recordHar: { path: join(ref, 'live.har.zip'), content: 'attach', mode: 'minimal' } } : {}),
});
if (cfg.blockHosts?.length) {
  await ctx.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    return cfg.blockHosts.some((re) => new RegExp(re).test(host)) ? route.abort() : route.continue();
  });
}
const page = await ctx.newPage();
const store = new AssetStore(site, id, ctx.request, cfg.url);

// Keep every stylesheet, image, font and media body the page itself loads (the files actually used).
const pending = [];
const KEEP_TYPES = new Set(['stylesheet', 'image', 'font', 'media']);
page.on('response', (r) => {
  const rt = r.request().resourceType();
  const ct = (r.headers()['content-type'] || '').toLowerCase();
  const asset = KEEP_TYPES.has(rt) || (rt === 'other' && /^(image|font|text\/css)/.test(ct));
  if (!asset || r.status() < 200 || r.status() >= 300 || r.status() === 206) return;
  pending.push(
    r
      .body()
      .then((b) => store.keep(r.url(), b, r.headers()['content-type'] || ''))
      .catch(() => {}),
  );
});

log('loading', cfg.url);
await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await settle(page, cfg);
const h = hookHelpers(page, log);
if (cfg.prepare) await cfg.prepare(page, h);
// Pages that add content while you scroll (news modules, ads) keep it in the copy; take the reference after one
// scroll pass too, so the two compare like for like.
if (cfg.referenceAfterScroll) {
  await h.scrollThrough(500, 120, cfg.maxScrollScreens);
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
}
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(400);

// Live reference, in the start state.
const liveMetrics = await page.evaluate(metricsInPage);
await page.screenshot({ path: join(ref, 'live-top.png') });
await page.screenshot({ path: join(ref, 'live-full.png'), fullPage: true, scale: 'css' });
const ogSiteName = await page.evaluate(() => document.querySelector('meta[property="og:site_name" i]')?.getAttribute('content') || null);
log(`live: ${liveMetrics.scrollHeight}px tall, ${liveMetrics.links} links, ${liveMetrics.tapTargets} targets`);

// Open collapsed regions and scroll everything so lazy content loads; snapshot iframes and videos; restore.
if (cfg.expand) await cfg.expand(page, h);
await h.scrollThrough(500, 120, cfg.maxScrollScreens);
await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
const shotIds = await page.evaluate(() => {
  const out = [];
  let n = 0;
  for (const el of document.querySelectorAll('iframe, video')) {
    const r = el.getBoundingClientRect();
    const vis = typeof el.checkVisibility === 'function' ? el.checkVisibility({ visibilityProperty: true }) : true;
    if (r.width >= 2 && r.height >= 2 && vis) {
      const k = `s${++n}`;
      el.setAttribute('data-cap-shot', k);
      out.push(k);
    }
  }
  // Fixed and sticky layers would sit on top of element screenshots: hide them (no layout change) while shooting.
  for (const el of document.querySelectorAll('body *')) {
    const pos = getComputedStyle(el).position;
    if ((pos === 'fixed' || pos === 'sticky') && !el.querySelector('[data-cap-shot]')) el.setAttribute('data-cap-hidefixed', '');
  }
  const st = document.createElement('style');
  st.id = '__cap-hide';
  st.textContent = '[data-cap-hidefixed]{visibility:hidden!important}';
  document.head.append(st);
  return out;
});
const shots = {};
for (const k of shotIds) {
  const buf = await page
    .locator(`[data-cap-shot="${k}"]`)
    .screenshot({ timeout: 8000 })
    .catch(() => null);
  if (buf) shots[k] = store.put(buf, 'image/png', '', 'asset');
}
await page.evaluate(() => {
  document.getElementById('__cap-hide')?.remove();
  for (const el of document.querySelectorAll('[data-cap-hidefixed]')) el.removeAttribute('data-cap-hidefixed');
});
if (cfg.restore) await cfg.restore(page, h);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(600);
await Promise.all(pending);

// Freeze the DOM.
const snap = await page.evaluate(snapshotInPage, { have: [...store.captured.keys()], sameSite: cfg.sameSite });
if (cfg.fixDom) {
  await page.evaluate(
    ([src]) => {
      const fn = (0, eval)(`(${src})`);
      fn(window.__cap.root, document);
    },
    [fnSource(cfg.fixDom)],
  );
}

// Store everything the copy references.
const map = {};
await Promise.all(
  snap.refs.map(async (u) => {
    const l = await store.ensure(u);
    if (l) map[u] = l;
  }),
);
const css = {};
let inlineMissing = 0;
for (const { key, css: text } of snap.inlineCss) {
  const r = await rewriteCss(text, snap.baseURI, (a, k) => store.ensure(a, k));
  css[key] = r.css;
  inlineMissing += r.missing;
}
const canvases = {};
for (const c of snap.canvases) {
  const l = store.putDataUrl(c.data);
  if (l) canvases[c.rid] = l;
}

// The behaviours module: shared modules from the config, plus the replica's own site/page.js if present.
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const hasPage = existsSync(join(site, 'page.js'));
let behavioursSrc = null;
if (cfg.behaviours.length || hasPage || snap.renest.length) {
  const names = [...new Set(cfg.behaviours.map((b) => b.use))];
  for (const n of names) {
    if (!existsSync(join(SHARED, 'behaviours', `${n}.js`))) throw new Error(`Unknown behaviour '${n}'`);
  }
  const lines = [
    `// Generated by scripts/capture/capture.mjs from replicas/${id}/capture.config.mjs. Edit the config, not this file.`,
    ...names.map((n) => `import { init as ${camel(n)} } from '/_r/_shared/behaviours/${n}.js';`),
    ...(hasPage ? [`import { init as page } from '/_r/${id}/page.js';`] : []),
    '',
    ...(snap.renest.length
      ? [
          "// Links inside links, which the HTML parser can't build: put them back where the live page had them.",
          `for (const [o, c, n] of ${JSON.stringify(snap.renest)}.reverse()) {`,
          '  const q = (r) => (r ? document.querySelector(`[data-rid="${r}"]`) : null);',
          '  const outer = q(o);',
          '  const child = q(c);',
          '  if (outer && child) outer.insertBefore(child, q(n));',
          '}',
          '',
        ]
      : []),
    ...cfg.behaviours.map((b) => `${camel(b.use)}(document, ${JSON.stringify(b.options ?? {})});`),
    ...(hasPage ? ['page(document);'] : []),
    '',
  ];
  writeFileSync(join(site, 'behaviours.js'), lines.join('\n'));
  behavioursSrc = `/_r/${id}/behaviours.js`;
}

const out = await page.evaluate(rewriteInPage, { map, css, shots, canvases, doctype: snap.doctype, behavioursSrc });
writeFileSync(join(site, cfg.file), out.html);
writeFileSync(join(ref, 'live-tree.json'), JSON.stringify(out.signature));
writeFileSync(join(ref, 'live-metrics.json'), JSON.stringify(liveMetrics, null, 2));
await ctx.close(); // flushes the HAR

// Live behaviour checks and layouts at the study's widths, on fresh loads.
if (!flag('--no-checks')) await liveChecksAndWidths();

// Manifest.
const pwVersion = JSON.parse(readFileSync(join(STUDY, 'node_modules/playwright/package.json'), 'utf8')).version;
const st = store.stats();
const r = snap.removed;
const hosts = Object.keys(snap.thirdPartyScriptHosts);
const removed = [
  `site scripts (${r.scripts})`,
  ...(hosts.length ? [`third-party scripts and trackers from ${hosts.length} hosts: ${hosts.sort().join(', ')}`] : []),
  ...(r.noscript ? [`noscript (${r.noscript})`] : []),
  ...(r.hints ? [`preload/prefetch/preconnect hints (${r.hints})`] : []),
  ...(r.httpEquiv ? [`http-equiv meta (${r.httpEquiv})`] : []),
  ...(r.handlers ? [`inline event handlers (${r.handlers})`] : []),
  ...(r.base ? ['<base>'] : []),
  ...(r.headStrays ? [`elements scripts had put inside <head> (${r.headStrays}; never drawn)`] : []),
  ...(r.iframeChildren ? [`elements inside <iframe> tags (${r.iframeChildren}; never drawn)`] : []),
  ...(r.otherLinks ? [`<link> tags that fetch on their own (manifest, search…) (${r.otherLinks})`] : []),
  ...(snap.frames.length ? [`iframe contents (${snap.frames.length}; src kept, local srcdoc: ${Object.keys(shots).length} snapshots)`] : []),
  ...(out.missing.length ? [`references that could not be stored (${out.missing.length})`] : []),
  ...cfg.removed,
];
const prev = existsSync(join(dir, 'manifest.json')) ? JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) : {};
const manifest = {
  v: 'replica.1',
  id,
  servePath: cfg.servePath,
  file: cfg.file,
  sourceUrl: cfg.url,
  originalHost: new URL(cfg.url).hostname,
  siteName: cfg.siteName ?? ogSiteName ?? new URL(cfg.url).hostname,
  capturedAt: new Date().toISOString(),
  capture: {
    tool: `scripts/capture/capture.mjs (playwright ${pwVersion})`,
    browser: `chromium ${browser.version()}`,
    viewport: { w: VIEWPORT.width, h: VIEWPORT.height, dpr: DPR },
    userAgent: PHONE.userAgent,
    stateNotes: cfg.stateNotes,
  },
  licence: cfg.licence ?? prev.licence ?? '',
  attribution: cfg.attribution ?? prev.attribution ?? '',
  behaviours: [
    ...new Set([
      ...(snap.renest.length ? ['renest-links'] : []),
      ...cfg.behaviours.map((b) => b.use),
      ...(hasPage ? ['page'] : []),
      ...(cfg.behaviourNotes ?? []),
    ]),
  ],
  removed,
  contentHash: contentHash(site),
};
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
if (!existsSync(join(dir, 'ATTRIBUTION.md'))) {
  writeFileSync(
    join(dir, 'ATTRIBUTION.md'),
    `# ${manifest.siteName}: ${liveMetrics.title}\n\nSource: ${cfg.url} (captured ${manifest.capturedAt.slice(0, 10)}).\n\n${manifest.attribution}\n\nLicence: ${manifest.licence}\n\nChanges: site scripts removed; behaviours re-created as local scripts; files stored locally; in the study's adapted condition WebAble changes the page.\n`,
  );
}

const summary = {
  seconds: Math.round((Date.now() - t0) / 1000),
  rids: snap.rids,
  assets: st,
  missingInHtml: out.missing,
  inlineCssMissing: inlineMissing,
  failedFetches: store.failed.slice(0, 30),
  imagesSized: `${snap.imagesSized}/${snap.imagesChecked}`,
  stylesFrozen: snap.stylesFrozen,
  shadowRoots: snap.shadowRoots,
  frames: snap.frames,
  shots: Object.keys(shots).length,
  removed: snap.removed,
};
writeFileSync(join(ref, 'capture.json'), JSON.stringify(summary, null, 2));
const rt = await roundtrip(browser, id);
await browser.close();

log(`done in ${summary.seconds}s: ${st.files} files, ${st.kb} KB; html ${Math.round(out.html.length / 1024)} KB; ${snap.rids} elements`);
if (out.missing.length || inlineMissing || store.failed.length) {
  log(`not stored: ${out.missing.length} html refs, ${inlineMissing} inline css refs, ${store.failed.length} failed fetches (see reference/capture.json)`);
}
log(`round trip: ${rt.mismatches} moved elements (${rt.rootCauses.length} root causes), ${rt.extra} parser-added`);
for (const c of rt.rootCauses.slice(0, 5)) log(`  rid ${c.rid} <${c.tag}> ${c.cause}: ${c.path}`);
log('next: node scripts/capture/validate.mjs ' + id);

/** Live behaviour checks and the layouts at the study's widths, each on a fresh load; saved in reference/. */
async function liveChecksAndWidths() {
  const liveWidths = [];
  const ctx2 = await phoneContext(browser, { capture: true });
  const p2 = await ctx2.newPage();
  await p2.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await settle(p2, cfg);
  const h2 = hookHelpers(p2, log);
  if (cfg.prepare) await cfg.prepare(p2, h2);
  await h2.scrollThrough(700, 40, cfg.maxScrollScreens); // as validation's copy has been scrolled by then
  for (const w of WIDTHS) {
    await p2.setViewportSize({ width: w, height: Math.round((VIEWPORT.height * w) / VIEWPORT.width) });
    await p2.waitForTimeout(500);
    liveWidths.push({ w, ...(await p2.evaluate(overflowInPage)) });
    await p2.screenshot({ path: join(ref, `live-w${w}.png`) });
  }
  await ctx2.close();
  const liveChecks = await runChecks(browser, cfg, cfg.url, { capture: true }, log);
  writeFileSync(join(ref, 'live-widths.json'), JSON.stringify(liveWidths, null, 2));
  writeFileSync(join(ref, 'live-checks.json'), JSON.stringify(liveChecks, null, 2));
  for (const c of liveChecks) log(`live check ${c.name}: ${JSON.stringify(c.values ?? c.error)}`);
}
