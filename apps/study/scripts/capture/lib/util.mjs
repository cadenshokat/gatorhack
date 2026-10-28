// Small shared helpers for the capture scripts.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { hookHelpers, phoneContext, settle } from './context.mjs';

/** sha256 over every served file of a replica (sorted relative path + bytes). */
export function contentHash(siteDir) {
  const files = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(siteDir);
  files.sort();
  const h = createHash('sha256');
  for (const f of files) {
    h.update(relative(siteDir, f).split('\\').join('/'));
    h.update('\0');
    h.update(readFileSync(f));
    h.update('\0');
  }
  return `sha256:${h.digest('hex')}`;
}

/** Source of a config function as an expression (arrow, function, or method shorthand). */
export function fnSource(fn) {
  const s = fn.toString().trim();
  if (/^(async\s+)?function\b/.test(s) || /^(async\s*)?(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(s)) return s;
  return s.startsWith('async ') ? `async function ${s.slice(6)}` : `function ${s}`;
}

/**
 * Runs the config's behaviour checks, each on a fresh load of `url`. On the live page (`live: true`) the config's
 * prepare hook runs first so both sides start in the same state. Unless the check sets `scrollFirst: false`, the page
 * is scrolled to the end and back before the check runs. Returns [{ name, values } | { name, error }].
 */
export async function runChecks(browser, cfg, url, { live = true, capture = false, route } = {}, log = () => {}) {
  const out = [];
  for (const check of cfg.checks ?? []) {
    const ctx = await phoneContext(browser, { capture });
    if (route) await ctx.route('**/*', route);
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await settle(page, live ? cfg : { ...cfg, networkIdleMs: 4000, settleMs: Math.min(cfg.settleMs ?? 1500, 800) });
      const h = hookHelpers(page, log);
      if (live && cfg.prepare) await cfg.prepare(page, h);
      // One quick pass down the page and back, so lazy images and content-visibility:auto sizes settle the same way
      // on both sides before anything is measured.
      if (check.scrollFirst !== false) await h.scrollThrough(700, 40, cfg.maxScrollScreens);
      const values = await check.run(page, h);
      out.push({ name: check.name, values });
    } catch (e) {
      out.push({ name: check.name, error: String(e.message || e).split('\n')[0] });
    }
    await ctx.close();
  }
  return out;
}

/** Compares one check's values: numbers within `tol` px (or `tolPct` %), everything else exactly. */
export function compareValues(live, copy, tol = 2, tolPct = 0) {
  const diffs = [];
  const keys = new Set([...Object.keys(live ?? {}), ...Object.keys(copy ?? {})]);
  for (const k of keys) {
    const a = live?.[k];
    const b = copy?.[k];
    if (typeof a === 'number' && typeof b === 'number') {
      const lim = Math.max(tol, (Math.abs(a) * tolPct) / 100);
      if (Math.abs(a - b) > lim) diffs.push(`${k}: ${a} vs ${b}`);
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      diffs.push(`${k}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
    }
  }
  return diffs;
}
