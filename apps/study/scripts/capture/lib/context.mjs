// The phone every capture and check uses: iPhone 15 user agent, 390x844 CSS px, DPR 3, touch, en-US, New York time.
// Chromium stands in for the phone's engine (WebKit is optional, see README).

import { chromium, devices } from 'playwright';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const STUDY = resolve(here, '../../..');
/** Where replicas live. STUDY_REPLICAS points somewhere else for dry runs (the shared modules stay the repo's). */
export const REPLICAS = process.env.STUDY_REPLICAS ? resolve(process.env.STUDY_REPLICAS) : join(STUDY, 'replicas');
export const SHARED = join(STUDY, 'replicas', '_shared');

export const VIEWPORT = { width: 390, height: 844 };
export const DPR = 3;
/** Layout widths the study's text sizes produce (tab zoom imitated by narrowing the layout). */
export const WIDTHS = [390, 312, 260, 223, 195];

const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 15'];
export const PHONE = {
  ...iphone,
  viewport: { ...VIEWPORT },
  screen: { ...VIEWPORT },
  deviceScaleFactor: DPR,
  isMobile: true,
  hasTouch: true,
  locale: 'en-US',
  timezoneId: 'America/New_York',
  colorScheme: 'light',
  reducedMotion: 'no-preference',
};

export async function launch(opts = {}) {
  return chromium.launch({ headless: !opts.headed, args: ['--disable-blink-features=AutomationControlled'] });
}

/** A phone context. `capture` adds the hooks only the live capture needs (FontFace log, CSP bypass). */
export async function phoneContext(browser, { capture = false, ...extra } = {}) {
  const ctx = await browser.newContext({ ...PHONE, ...(capture ? { bypassCSP: true } : {}), ...extra });
  await ctx.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    } catch {
      /* already defined */
    }
  });
  if (capture) {
    // Fonts added from script (new FontFace(family, 'url(...)')) have no CSS rule to copy; log them so the capture
    // can write them back as @font-face rules.
    await ctx.addInitScript(() => {
      const Native = window.FontFace;
      if (!Native) return;
      const log = [];
      Object.defineProperty(window, '__capFontFaces', { value: log });
      window.FontFace = function (family, source, descriptors) {
        if (typeof source === 'string') log.push({ family, source, descriptors: descriptors || {}, base: document.baseURI });
        return new Native(family, source, descriptors);
      };
      window.FontFace.prototype = Native.prototype;
    });
  }
  return ctx;
}

/** Loads replicas/<id>/capture.config.mjs. */
export async function loadConfig(id) {
  const file = join(REPLICAS, id, 'capture.config.mjs');
  if (!existsSync(file)) throw new Error(`No capture config at ${file}`);
  const mod = await import(`${file}?t=${Date.now()}`);
  const cfg = mod.default;
  if (!cfg || cfg.id !== id) throw new Error(`${file}: default export must be a config with id '${id}'`);
  const u = new URL(cfg.url);
  return {
    file: 'index.html',
    servePath: decodeURIComponent(u.pathname),
    settleMs: 1500,
    networkIdleMs: 15000,
    behaviours: [],
    checks: [],
    removed: [],
    stateNotes: [],
    srcset: 'loaded',
    har: true,
    maxScrollScreens: 40,
    sameSite: [u.hostname, u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`],
    ...cfg,
  };
}

export function replicaDir(id) {
  return join(REPLICAS, id);
}

/** Waits for load, then for the network to go quiet (capped), then a fixed settle time. */
export async function settle(page, cfg) {
  await page.waitForLoadState('load', { timeout: 90000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: cfg.networkIdleMs ?? 15000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
  await page.waitForTimeout(cfg.settleMs ?? 1500);
}

/** Small helpers handed to config hooks. */
export function hookHelpers(page, log) {
  return {
    sleep: (ms) => page.waitForTimeout(ms),
    log,
    /** Scrolls the whole page in steps so lazy content loads, then returns to the top. */
    async scrollThrough(step = 500, delay = 120, maxScreens = 40) {
      await page.evaluate(
        async ([step, delay, maxScreens]) => {
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          const cap = innerHeight * maxScreens;
          for (let y = 0; y < Math.min(document.documentElement.scrollHeight, cap); y += step) {
            window.scrollTo({ top: y, behavior: 'instant' });
            await sleep(delay);
          }
          await sleep(600);
          window.scrollTo({ top: 0, behavior: 'instant' });
        },
        [step, delay, maxScreens],
      );
    },
    /** Clicks every element matching the selector (in the page, no pointer events); returns how many. */
    clickAll: (selector) =>
      page.evaluate((sel) => {
        const els = [...document.querySelectorAll(sel)];
        for (const e of els) e.click();
        return els.length;
      }, selector),
    /** Removes every element matching the selector; returns how many. */
    removeAll: (selector) =>
      page.evaluate((sel) => {
        const els = [...document.querySelectorAll(sel)];
        for (const e of els) e.remove();
        return els.length;
      }, selector),
  };
}
