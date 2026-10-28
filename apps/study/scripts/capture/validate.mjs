#!/usr/bin/env node
// Live vs copy checks (rule 8), against the live reference saved at capture time:
//   node scripts/capture/validate.mjs <id> [--base http://127.0.0.1:5193] [--no-widths]
// Serves the copy (own check server by default, or the dev server given by --base), blocks and counts every request
// to another origin, then compares pixels (first screen at DPR 3, full page at CSS scale), layout counts, text size,
// fixed layers, the study's layout widths and the config's behaviour checks. Writes manifest.validation,
// reference/validation.json and the copy's screenshots and diff images in reference/. Exits 1 on a hard failure
// (outside requests, missing files, frame tag not first in <head>).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DPR, VIEWPORT, WIDTHS, launch, loadConfig, phoneContext, replicaDir, settle } from './lib/context.mjs';
import { metricsInPage, overflowInPage } from './lib/metrics.mjs';
import { diffPng } from './lib/pixels.mjs';
import { serveReplicas } from './lib/serve.mjs';
import { compareValues, contentHash, runChecks } from './lib/util.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--') && !/^https?:/.test(a));
if (!id) {
  console.error('usage: node scripts/capture/validate.mjs <replica-id> [--base http://127.0.0.1:5193] [--no-widths]');
  process.exit(2);
}
const baseArg = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;
const log = (...a) => console.log(`[validate ${id}]`, ...a);

const cfg = await loadConfig(id);
const dir = replicaDir(id);
const ref = join(dir, 'reference');
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const readRef = (n, d) => (existsSync(join(ref, n)) ? JSON.parse(readFileSync(join(ref, n), 'utf8')) : d);
const liveMetrics = readRef('live-metrics.json', null);
const liveChecks = readRef('live-checks.json', []);
const liveWidths = readRef('live-widths.json', []);
const rt = readRef('roundtrip.json', null);
if (!liveMetrics) throw new Error(`No live reference in ${ref}; capture first.`);

const server = baseArg ? null : await serveReplicas();
const base = (baseArg ?? server.base).replace(/\/$/, '');
const origin = new URL(base).origin;
const url = base + manifest.servePath.split('/').map(encodeURIComponent).join('/').replace(/%2C/gi, ',');

const outside = {};
let outsideCount = 0;
const missing = [];
const route = (r) => {
  const u = r.request().url();
  if (u.startsWith(origin) || /^(data|blob|about):/.test(u)) return r.continue();
  outsideCount++;
  const host = new URL(u).host;
  outside[host] = (outside[host] || 0) + 1;
  return r.abort();
};

const browser = await launch();
const ctx = await phoneContext(browser);
await ctx.route('**/*', route);
const page = await ctx.newPage();
page.on('response', (r) => {
  if (r.url().startsWith(origin) && r.status() >= 400) missing.push(`${r.status()} ${r.url().slice(origin.length)}`);
});
const raw = await (await fetch(url)).text();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await settle(page, { ...cfg, networkIdleMs: 5000, settleMs: Math.min(cfg.settleMs ?? 1500, 1000) });
await page.evaluate(() =>
  Promise.race([
    Promise.all([...document.images].filter((i) => !i.complete && i.loading !== 'lazy').map((i) => new Promise((r) => i.addEventListener('load', r) || i.addEventListener('error', r)))),
    new Promise((r) => setTimeout(r, 5000)),
  ]),
);

// The frame runtime tag must be the first child of <head>, in the file and in the DOM.
const headOpen = raw.match(/<head\b[^>]*>/i);
const frameInFile = !!headOpen && raw.slice(headOpen.index + headOpen[0].length).startsWith('<script type="module" src="/_study/frame.js"></script>');
const frameInDom = await page.evaluate(() => {
  const f = document.head.firstChild;
  return !!f && f.nodeName === 'SCRIPT' && f.getAttribute('src') === '/_study/frame.js' && f.getAttribute('type') === 'module';
});

const copyMetrics = await page.evaluate(metricsInPage);
await page.screenshot({ path: join(ref, 'copy-top.png') });
await page.screenshot({ path: join(ref, 'copy-full.png'), fullPage: true, scale: 'css' });
const top = await diffPng(browser, join(ref, 'live-top.png'), join(ref, 'copy-top.png'), join(ref, 'diff-top.png'));
const full = await diffPng(browser, join(ref, 'live-full.png'), join(ref, 'copy-full.png'), join(ref, 'diff-full.png'));

// Widths: tab zoom imitated by a narrower layout.
const widths = [];
if (!args.includes('--no-widths')) {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: Math.round((VIEWPORT.height * w) / VIEWPORT.width) });
    await page.waitForTimeout(400);
    const copy = await page.evaluate(overflowInPage);
    await page.screenshot({ path: join(ref, `copy-w${w}.png`) });
    const live = liveWidths.find((x) => x.w === w) ?? null;
    widths.push({
      w,
      live: live && { scrollWidth: live.scrollWidth, scrollHeight: live.scrollHeight, overflowing: live.overflowing },
      copy: { scrollWidth: copy.scrollWidth, scrollHeight: copy.scrollHeight, overflowing: copy.overflowing, sample: copy.sample },
      pass: copy.scrollWidth <= w + 1 || (live ? copy.scrollWidth <= live.scrollWidth + 1 : false),
    });
  }
  await page.setViewportSize(VIEWPORT);
}
await ctx.close();

// Behaviour checklist.
const copyChecks = await runChecks(browser, cfg, url, { live: false, route });
const behaviours = (cfg.checks ?? []).map((c) => {
  const l = liveChecks.find((x) => x.name === c.name);
  const k = copyChecks.find((x) => x.name === c.name);
  const diffs = l?.error || k?.error ? [l?.error ?? k?.error] : compareValues(l?.values, k?.values, c.tolerancePx ?? 2, c.tolerancePct ?? 0);
  return { name: c.name, live: l?.values ?? l?.error ?? null, copy: k?.values ?? k?.error ?? null, pass: diffs.length === 0, diffs };
});
await browser.close();
if (server) await server.close();

// Layout counts.
const near = (a, b, pct = 1) => Math.abs(a - b) <= Math.max(1, (Math.abs(a) * pct) / 100);
const cmp = [
  ['scrollHeight', liveMetrics.scrollHeight, copyMetrics.scrollHeight, near(liveMetrics.scrollHeight, copyMetrics.scrollHeight, 1)],
  ['scrollWidth', liveMetrics.scrollWidth, copyMetrics.scrollWidth, liveMetrics.scrollWidth === copyMetrics.scrollWidth],
  ['links', liveMetrics.links, copyMetrics.links, near(liveMetrics.links, copyMetrics.links, 1)],
  ['visibleLinks', liveMetrics.visibleLinks, copyMetrics.visibleLinks, near(liveMetrics.visibleLinks, copyMetrics.visibleLinks, 1)],
  ['headings', liveMetrics.headings, copyMetrics.headings, liveMetrics.headings === copyMetrics.headings],
  ['headingOrder', liveMetrics.headingList.length, copyMetrics.headingList.length, JSON.stringify(liveMetrics.headingList) === JSON.stringify(copyMetrics.headingList)],
  ['tapTargets', liveMetrics.tapTargets, copyMetrics.tapTargets, liveMetrics.tapTargets === copyMetrics.tapTargets],
  ['tapUnder44', liveMetrics.tapUnder44, copyMetrics.tapUnder44, liveMetrics.tapUnder44 === copyMetrics.tapUnder44],
  ['tapUnder24', liveMetrics.tapUnder24, copyMetrics.tapUnder24, liveMetrics.tapUnder24 === copyMetrics.tapUnder24],
  ['bodyFontPx', liveMetrics.bodyFontPx, copyMetrics.bodyFontPx, liveMetrics.bodyFontPx === copyMetrics.bodyFontPx],
  ['paraFontPx', liveMetrics.paraFontPx, copyMetrics.paraFontPx, liveMetrics.paraFontPx === copyMetrics.paraFontPx],
  ['textUnder16Pct', liveMetrics.textUnder16Pct, copyMetrics.textUnder16Pct, Math.abs(liveMetrics.textUnder16Pct - copyMetrics.textUnder16Pct) <= 1],
  ['fixedCoverTopPct', liveMetrics.fixedCoverTopPct, copyMetrics.fixedCoverTopPct, Math.abs(liveMetrics.fixedCoverTopPct - copyMetrics.fixedCoverTopPct) <= 1],
  ['fixedCoverMidPct', liveMetrics.fixedCoverMidPct, copyMetrics.fixedCoverMidPct, Math.abs(liveMetrics.fixedCoverMidPct - copyMetrics.fixedCoverMidPct) <= 1],
  ['visibleElements', liveMetrics.visibleElements, copyMetrics.visibleElements, near(liveMetrics.visibleElements, copyMetrics.visibleElements, 1)],
  ['imagesVisible', liveMetrics.imagesVisible, copyMetrics.imagesVisible, liveMetrics.imagesVisible === copyMetrics.imagesVisible],
  ['firstScreenText', liveMetrics.firstScreenText, copyMetrics.firstScreenText, liveMetrics.firstScreenText === copyMetrics.firstScreenText],
  ['loadedFontFamilies', liveMetrics.loadedFontFamilies.join(', '), copyMetrics.loadedFontFamilies.join(', '), liveMetrics.loadedFontFamilies.join() === copyMetrics.loadedFontFamilies.join()],
];

const hard = outsideCount === 0 && missing.length === 0 && frameInFile && frameInDom;
const pixelsPass = top.pct <= 0.5 && full.pct <= 2;
const validation = {
  at: new Date().toISOString(),
  by: 'scripts/capture/validate.mjs',
  served: baseArg ? base : 'scripts/capture/lib/serve.mjs (frame.js stubbed)',
  viewport: { w: VIEWPORT.width, h: VIEWPORT.height, dpr: DPR },
  liveCapturedAt: manifest.capturedAt,
  requests: { outside: outsideCount, outsideHosts: outside, missing },
  frameTagFirst: frameInFile && frameInDom,
  pixels: {
    firstScreen: { pct: top.pct, target: 0.5, pass: top.pct <= 0.5, size: top.size, bandsCssPx: top.bands.map(([a, b, n]) => [Math.round(a / DPR), Math.round(b / DPR), n]) },
    fullPage: { pct: full.pct, target: 2, pass: full.pct <= 2, liveSize: full.aSize, copySize: full.bSize, bandsCssPx: full.bands },
  },
  layout: Object.fromEntries(cmp.map(([k, l, c, p]) => [k, { live: l, copy: c, pass: p }])),
  widths,
  behaviours,
  roundTrip: rt ? { mismatches: rt.mismatches, rootCauses: rt.rootCauses.length, parserAdded: rt.extra } : null,
  pass: { hard, pixels: pixelsPass, layout: cmp.every((x) => x[3]), widths: widths.every((w) => w.pass), behaviours: behaviours.every((b) => b.pass) },
  notes: cfg.validationNotes ?? [],
};
manifest.validation = validation;
manifest.contentHash = contentHash(join(dir, 'site'));
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(ref, 'validation.json'), JSON.stringify({ ...validation, liveMetrics, copyMetrics }, null, 2));

log(`outside requests ${outsideCount}${outsideCount ? ' ' + JSON.stringify(outside) : ''}; missing files ${missing.length}; frame tag first ${validation.frameTagFirst}`);
log(`pixels: first screen ${top.pct}% (<= 0.5), full page ${full.pct}% (<= 2); heights live ${full.aSize[1]} / copy ${full.bSize[1]}`);
for (const [k, l, c, p] of cmp) if (!p) log(`  layout ${k}: live ${l} vs copy ${c}`);
for (const w of widths) if (!w.pass) log(`  width ${w.w}: copy scrollWidth ${w.copy.scrollWidth} (live ${w.live?.scrollWidth}) ${w.copy.sample.join('; ')}`);
for (const b of behaviours) log(`  behaviour ${b.name}: ${b.pass ? 'pass' : 'FAIL ' + b.diffs.join('; ')}`);
log(`summary: ${JSON.stringify(validation.pass)}`);
process.exit(hard ? 0 : 1);
