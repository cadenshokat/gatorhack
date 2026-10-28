#!/usr/bin/env node
// Finds a phrase on a replica (or the live page) for task.json: its depth in 844 px screens, a unique CSS selector
// for its element, and whether it is visible.
//   node scripts/capture/find.mjs <id> "<phrase>" [--live] [--tap "<css selector>"]...
// --tap runs before the search, in order (open the section the answer sits in). Depth is measured in that state.

import { launch, loadConfig, phoneContext, settle, hookHelpers } from './lib/context.mjs';
import { serveReplicas } from './lib/serve.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { replicaDir } from './lib/context.mjs';

const args = process.argv.slice(2);
const [id, phrase] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--tap');
if (!id || !phrase) {
  console.error('usage: node scripts/capture/find.mjs <id> "<phrase>" [--live] [--tap "<css>"]...');
  process.exit(2);
}
const taps = args.flatMap((a, i) => (a === '--tap' ? [args[i + 1]] : []));
const live = args.includes('--live');
const cfg = await loadConfig(id);
const manifest = JSON.parse(readFileSync(join(replicaDir(id), 'manifest.json'), 'utf8'));
const server = live ? null : await serveReplicas();
const url = live ? cfg.url : server.base + manifest.servePath;

const browser = await launch();
const ctx = await phoneContext(browser);
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await settle(page, live ? cfg : { ...cfg, networkIdleMs: 3000, settleMs: 500 });
const h = hookHelpers(page, console.log);
if (live && cfg.prepare) await cfg.prepare(page, h);
await h.scrollThrough(700, 40);
for (const t of taps) {
  await page.locator(t).first().tap();
  await page.waitForTimeout(700);
}
const found = await page.evaluate((phrase) => {
  const norm = (s) => s.replace(/\s+/g, ' ');
  const hits = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (!norm(el.textContent || '').includes(phrase)) continue;
    if ([...el.children].some((c) => norm(c.textContent || '').includes(phrase))) continue;
    hits.push(el);
  }
  const unique = (s) => {
    try {
      return document.querySelectorAll(s).length === 1;
    } catch {
      return false;
    }
  };
  const selectorOf = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.id && unique('#' + CSS.escape(e.id))) {
        parts.unshift('#' + CSS.escape(e.id));
        break;
      }
      const tag = e.tagName.toLowerCase();
      const same = e.parentElement ? [...e.parentElement.children].filter((c) => c.tagName === e.tagName) : [e];
      parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(e) + 1})` : tag);
      const s = parts.join(' > ');
      if (unique(s) && document.querySelector(s) === el) break;
    }
    // Shorten an id-anchored path to '#id tail' where that still matches only this element.
    if (parts[0].startsWith('#')) {
      for (let k = parts.length - 1; k >= 1; k--) {
        const s = `${parts[0]} ${parts.slice(k).join(' > ')}`;
        if (unique(s) && document.querySelector(s) === el) return s;
      }
    }
    return parts.join(' > ');
  };
  return hits.map((el) => {
    const r = el.getBoundingClientRect();
    const vis = typeof el.checkVisibility === 'function' ? el.checkVisibility({ visibilityProperty: true }) : r.height > 0;
    return {
      tag: el.tagName.toLowerCase(),
      rid: el.getAttribute('data-rid'),
      selector: selectorOf(el),
      visible: vis && r.height > 0,
      depthScreens: Math.round(((r.top + scrollY) / 844) * 100) / 100,
      topPx: Math.round(r.top + scrollY),
      text: norm(el.textContent || '').trim().slice(0, 160),
    };
  });
}, phrase);
console.log(JSON.stringify({ url, taps, found }, null, 2));
await browser.close();
if (server) await server.close();
