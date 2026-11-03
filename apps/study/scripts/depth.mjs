#!/usr/bin/env node
// Where a task's answer sits, in screens of the study's website frame, on the original page and on the adapted one
// (WebAble's simplified page when it opens, else the adapted page itself), as a participant first sees each. Used to
// match the answer's depth across conditions (protocol 4.2.0: within 0.5 screens at the typical fit). Run with the dev
// server up:
//
//   node scripts/depth.mjs <replicaId> [<replicaId>…] [--phrase "<text>"] [--fits typical,large] [--h 664]
//        [--mode replay|live] [--engine chromium|webkit] [--port 5190] [--scan]
//
// --scan: no task needed. Lists every block of text (paragraphs, list items, headings, table cells) found in both
// versions at the first fit, with its depth in each, marking those within 0.5 screens: where to look for a question.
//
// The phrase defaults to the replica's task.json (answerText on the original, answerTextSimplified or answerText on
// the adapted page). Depth = the top of the first element holding the phrase, from the top of what scrolls, divided
// by the frame's height: 0 is the top of the first screen, 1.0 the top of the second. Replay mode uses the recorded
// AI answers (the same for everyone); live mode asks the hosted server, whose AI layout can move things per person.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices, webkit } from 'playwright';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const ids = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const phraseArg = opt('phrase', null);
const fits = opt('fits', 'typical,large').split(',');
const H = Number(opt('h', '664'));
const mode = opt('mode', 'replay');
const engine = opt('engine', 'chromium');
const base = `http://127.0.0.1:${opt('port', '5190')}`;
if (!ids.length) {
  console.error('usage: node scripts/depth.mjs <replicaId>… [--phrase "<text>"] [--fits typical,large] [--h 664] [--mode replay|live]');
  process.exit(2);
}

/**
 * In the frame: the answer's element (by `selector` on the page when given, else the smallest visible element holding
 * the phrase), its depth in frame heights, and which layer it was found in.
 */
function locate({ phrase, selector }) {
  const norm = (x) => x.replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
  const want = norm(phrase);
  const visible = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement ?? e.getRootNode()?.host) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  /**
   * The smallest visible element holding the phrase's FIRST appearance (as the study's frame measures it), searching
   * open shadow roots too: the first child, in page order, whose text holds the phrase, all the way down.
   */
  const textOf = (n) => (n.textContent ?? '') + (n.shadowRoot ? textOf(n.shadowRoot) : '');
  const find = (n) => {
    const kids = [...(n.shadowRoot ? [n.shadowRoot] : []), ...(n.children ?? [])];
    for (const c of kids) {
      if (c.nodeType === 1 && /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(c.tagName)) continue;
      if (!norm(textOf(c)).includes(want)) continue;
      const inner = find(c);
      if (inner) return inner;
      if (c.nodeType === 1 && visible(c)) return c;
    }
    return null;
  };
  /** What scrolls the element: the nearest ancestor that scrolls, else the document. */
  const scroller = (el) => {
    for (let e = el.parentElement ?? el.getRootNode()?.host; e; e = e.parentElement ?? e.getRootNode()?.host) {
      const cs = getComputedStyle(e);
      if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1) return e;
    }
    return null;
  };
  const ui = document.querySelector('webable-ui');
  const calmHost = ui?.shadowRoot?.querySelector('.wa-calm-host');
  const calm = calmHost?.shadowRoot ?? null;
  const calmOpen = !!calm && !!calmHost && calmHost.getBoundingClientRect().height > 0 && getComputedStyle(calmHost).display !== 'none';
  const layer = calmOpen ? 'simplified' : 'page';
  const bySelector = !calmOpen && selector ? document.querySelector(selector) : null;
  const el = bySelector ?? (calmOpen ? find(calm) : find(document.body));
  if (!el) return { layer, found: false };
  const s = scroller(el);
  const r = el.getBoundingClientRect();
  const top = s ? r.top - s.getBoundingClientRect().top + s.scrollTop : r.top + scrollY;
  const view = s ? s.clientHeight : innerHeight;
  return { layer, found: true, depth: Math.round((top / view) * 100) / 100, tag: el.tagName.toLowerCase() };
}

/** In the frame: every visible block of text in the layer a participant sees, with its depth in frame heights. */
function blocks() {
  const ui = document.querySelector('webable-ui');
  const calmHost = ui?.shadowRoot?.querySelector('.wa-calm-host');
  const calm = calmHost?.shadowRoot ?? null;
  const calmOpen = !!calm && !!calmHost && calmHost.getBoundingClientRect().height > 0 && getComputedStyle(calmHost).display !== 'none';
  const root = calmOpen ? calm : document;
  const out = [];
  for (const el of root.querySelectorAll('p, li, h1, h2, h3, h4, td, dd, blockquote')) {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < 20 || text.length > 600) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) continue;
    let s = null;
    for (let e = el.parentElement ?? el.getRootNode()?.host; e; e = e.parentElement ?? e.getRootNode()?.host) {
      const cs = getComputedStyle(e);
      if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1) { s = e; break; }
    }
    const top = s ? r.top - s.getBoundingClientRect().top + s.scrollTop : r.top + scrollY;
    out.push({ text, depth: Math.round((top / (s ? s.clientHeight : innerHeight)) * 100) / 100 });
  }
  return { layer: calmOpen ? 'simplified' : 'page', blocks: out };
}

async function open(id, c, fit) {
  const ctx = await browser.newContext({ ...(engine === 'webkit' ? devices['iPhone 15'] : devices['Pixel 7']) });
  const page = await ctx.newPage();
  await page.goto(`${base}/dev.html?r=${id}&c=${c}&fit=${fit}&h=${H}&mode=${c === 'adapted' ? mode : 'replay'}`);
  for (let i = 0; i < 600; i++) {
    if (await page.evaluate(() => !!window.__devHost?.ready).catch(() => false)) break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(800);
  return { ctx, frame: page.frames().find((f) => f !== page.mainFrame()) ?? null };
}

const browser = await (engine === 'webkit' ? webkit : chromium).launch();
if (args.includes('--scan')) {
  const norm = (x) => x.replace(/[‐-―−]/g, '-').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
  for (const id of ids) {
    const got = {};
    for (const c of ['original', 'adapted']) {
      const { ctx, frame } = await open(id, c, fits[0]);
      got[c] = frame ? await frame.evaluate(blocks) : { layer: '?', blocks: [] };
      await ctx.close();
    }
    console.log(`\n${id} (${fits[0]}, frame ${H} px; adapted shows the ${got.adapted.layer} layer)`);
    const seen = new Set();
    for (const b of got.original.blocks) {
      const key = norm(b.text).slice(0, 40);
      if (key.length < 15 || seen.has(key)) continue;
      // The opening words can differ (a dateline or a link the simplified page drops): try a later stretch too.
      const later = norm(b.text).slice(30, 70);
      const a = got.adapted.blocks.find((x) => norm(x.text).includes(key))
        ?? (later.length >= 25 ? got.adapted.blocks.find((x) => norm(x.text).includes(later)) : undefined);
      if (!a) continue;
      seen.add(key);
      const diff = Math.round((a.depth - b.depth) * 100) / 100;
      console.log(`${Math.abs(diff) <= 0.5 ? '✓' : ' '} original ${b.depth.toFixed(2).padStart(5)}  adapted ${a.depth.toFixed(2).padStart(5)}  diff ${diff.toFixed(2).padStart(5)}  ${b.text.slice(0, 110)}`);
    }
  }
  await browser.close();
  process.exit(0);
}
const rows = [];
for (const id of ids) {
  const taskFile = join('replicas', id, 'task.json');
  if (!phraseArg && !existsSync(taskFile)) {
    console.error(`${id}: no task.json; pass --phrase "<text>" (or --scan)`);
    continue;
  }
  const task = existsSync(taskFile) ? JSON.parse(readFileSync(taskFile, 'utf8')) : {};
  const phrases = {
    original: phraseArg ?? task.answerText,
    adapted: phraseArg ?? task.answerTextSimplified ?? task.answerText,
  };
  for (const fit of fits) {
    const row = { id, fit };
    for (const c of ['original', 'adapted']) {
      if (c === 'original' && fit !== fits[0]) {
        row.original = rows.find((r) => r.id === id)?.original;
        continue;
      }
      const { ctx, frame } = await open(id, c, fit);
      // The original page: the task's own selector (the phrase can also sit in a closed panel or a hidden duplicate).
      const selector = phraseArg ? null : task.answerSelector ?? null;
      row[c] = frame ? await frame.evaluate(locate, { phrase: phrases[c], selector }) : { found: false, error: 'no frame' };
      await ctx.close();
    }
    const o = row.original;
    const a = row.adapted;
    row.diff = o?.found && a?.found ? Math.round((a.depth - o.depth) * 100) / 100 : null;
    rows.push(row);
    const show = (x) => (x?.found ? `${x.depth.toFixed(2)} (${x.layer})` : `not found (${x?.layer ?? '?'})`);
    console.log(`${id.padEnd(18)} ${fit.padEnd(8)} original ${show(o).padEnd(22)} adapted ${show(a).padEnd(24)} diff ${row.diff ?? '-'}`);
  }
}
await browser.close();
