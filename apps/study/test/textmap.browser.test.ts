// Round 11: the engine's phone text map (apps/extension/src/engine/textmap.ts) in a real Chromium and WebKit: the
// cascade itself. happy-dom (textmap.test.ts) does not resolve em, %, rem, a disabled sheet or transitions like a
// browser, so what only a browser can show is shown here: every ratio held, nested em/% never scaled twice, px
// line-heights scaled, a k change never compounding (also under `transition: all`, which WebKit reports mid-way),
// later and changed content, an exact restore, WebAble's own UI left alone.
// The module is served as it is by a Vite dev server (no build), and driven from the page.

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const MODULE = resolve(repo, 'apps/extension/src/engine/textmap.ts');

let server: ViteDevServer;
let origin = '';

beforeAll(async () => {
  const root = mkdtempSync(join(tmpdir(), 'wa-textmap-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><meta charset="utf-8"><title>t</title><body></body>');
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false, fs: { allow: [repo, root] }, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  await server.listen();
  const addr = server.httpServer?.address();
  origin = typeof addr === 'object' && addr ? `http://127.0.0.1:${addr.port}` : '';
}, 60000);

afterAll(async () => {
  await server?.close();
});

/** Runs in the page: puts a fixture in the body, the map on at k, and reports computed sizes. */
type Probe = Record<string, unknown>;

async function open(browser: Browser): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 1 });
  await page.goto(`${origin}/index.html`);
  // A module script, as text: vitest would rewrite an import() written inside an evaluate callback.
  await page.addScriptTag({
    type: 'module',
    content: `
      import * as m from '/@fs${MODULE}';
      const sheets = {
        make: (css) => { const s = new CSSStyleSheet(); s.replaceSync(css); return s; },
        attach: (s) => { document.adoptedStyleSheets = [...document.adoptedStyleSheets, s]; },
        detach: (s) => { document.adoptedStyleSheets = document.adoptedStyleSheets.filter((x) => x !== s); },
      };
      window.TM = m;
      window.tm = new m.TextMap({ isOurUi: (el) => !!el.closest('webable-ui'), sheets });
    `,
  });
  await page.waitForFunction(() => !!(window as unknown as { tm?: unknown }).tm);
  return page;
}

const FIXTURE = `
<style>
  :root { font-size: 16px; }
  body { font: 16px/1.5 sans-serif; margin: 8px; }
  .wrap { font-size: 20px; line-height: 26px; }
  h1 { font-size: 2em; line-height: 1.2; }
  .lead { font-size: 1.25em; letter-spacing: 0.05em; }
  .lead span { font-size: 80%; }
  .rem { font-size: 0.875rem; }
  .fixed { font-size: 14px; line-height: 18px; }
  .tr { transition: all 1s linear; }
  .big { font-size: 30px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
<div class="wrap">
  <h1 id="h1" class="tr">Heading</h1>
  <p id="lead" class="lead tr">Lead <span id="inner">inner <em id="em">em</em></span></p>
  <p id="rem" class="rem">Rem text</p>
  <p id="fixed" class="fixed">Fixed line height text</p>
  <p id="pin" style="font-size: 13px !important; color: rgb(10, 20, 30)">Pinned</p>
  <p id="plain" style="margin:0;  color : red">Plain inline</p>
  <span id="sr" class="sr">Hidden label</span>
  <ul id="list"><li>One</li></ul>
</div>
<webable-ui><span id="ours">WebAble</span></webable-ui>`;

function measure(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const fs = (id: string) => parseFloat(getComputedStyle(document.getElementById(id) as Element).fontSize);
    const lh = (id: string) => getComputedStyle(document.getElementById(id) as Element).lineHeight;
    const ls = (id: string) => getComputedStyle(document.getElementById(id) as Element).letterSpacing;
    return {
      h1: fs('h1'), lead: fs('lead'), inner: fs('inner'), em: fs('em'), rem: fs('rem'), fixed: fs('fixed'), pin: fs('pin'), plain: fs('plain'), ours: fs('ours'), sr: fs('sr'),
      fixedLh: lh('fixed'), h1Lh: lh('h1'), leadLs: ls('lead'),
      styles: [document.getElementById('pin')?.getAttribute('style'), document.getElementById('plain')?.getAttribute('style')],
      tokens: document.querySelectorAll('[data-wa-tm]').length,
      sheets: document.adoptedStyleSheets.length,
    };
  });
}

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]] as const) {
  describe(`text map in ${name}`, () => {
    let browser: Browser;
    beforeAll(async () => {
      browser = await engine.launch();
    }, 60000);
    afterAll(async () => {
      await browser?.close();
    });

    it('holds every ratio, never scales nested em/% twice, scales px line-height, and restores exactly', async () => {
      const page = await open(browser);
      await page.evaluate((html) => {
        document.body.innerHTML = html;
      }, FIXTURE);
      const before = await measure(page);
      expect(before).toMatchObject({ h1: 40, lead: 25, inner: 20, em: 20, rem: 14, fixed: 14, pin: 13, fixedLh: '18px' });

      await page.evaluate(() => (window as unknown as { tm: { set(k: number): void } }).tm.set(1.5));
      const on = await measure(page);
      // Every size × 1.5 exactly once: em and % children of scaled parents are not scaled again.
      for (const k of ['h1', 'lead', 'inner', 'em', 'rem', 'fixed', 'pin', 'plain', 'sr'] as const) {
        expect(on[k], k).toBeCloseTo((before[k] as number) * 1.5, 1);
      }
      // Ratios between sizes are the site's.
      expect((on.h1 as number) / (on.rem as number)).toBeCloseTo((before.h1 as number) / (before.rem as number), 3);
      expect((on.inner as number) / (on.lead as number)).toBeCloseTo((before.inner as number) / (before.lead as number), 3);
      // A fixed px line-height grows with its font (14/18 -> 21/27), a relative one follows by itself.
      expect(on.fixedLh).toBe('27px');
      expect(parseFloat(on.h1Lh as string)).toBeCloseTo(60 * 1.2, 0);
      expect(parseFloat(on.leadLs as string)).toBeCloseTo(parseFloat(before.leadLs as string) * 1.5, 1);
      // WebAble's own UI is never scaled; the site's plain inline style is untouched.
      expect(on.ours).toBe(before.ours);
      expect((on.styles as string[])[1]).toBe((before.styles as string[])[1]);

      // A new k: the page's own sizes × 1.25, not × 1.5 × 1.25 (under transition: all on h1 and .lead too).
      await page.evaluate(() => (window as unknown as { tm: { set(k: number): void } }).tm.set(1.25));
      const again = await measure(page);
      for (const k of ['h1', 'lead', 'inner', 'em', 'rem', 'fixed', 'pin'] as const) {
        expect(again[k], `${k} after a new k`).toBeCloseTo((before[k] as number) * 1.25, 1);
      }

      // Off: every computed size and both inline styles exactly as before, no token, no sheet.
      await page.evaluate(() => (window as unknown as { tm: { clear(): void } }).tm.clear());
      const off = await measure(page);
      expect(off).toEqual(before);
      await page.close();
    }, 60000);

    it('content added or changed later gets the same k; the engine’s reads see the site’s own sizes', async () => {
      const page = await open(browser);
      await page.evaluate((html) => {
        document.body.innerHTML = html;
      }, FIXTURE);
      const r = await page.evaluate(async () => {
        const w = window as unknown as { tm: { set(k: number): void; suspend<T>(fn: () => T): T; clear(): void } };
        const fs = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
        w.tm.set(1.5);
        const list = document.getElementById('list') as Element;
        const li = document.createElement('li');
        li.innerHTML = 'Later <small>small</small>';
        li.style.fontSize = '0.9em';
        list.append(li);
        await new Promise((res) => setTimeout(res, 0));
        const late = { li: fs(li), small: fs(li.querySelector('small') as Element) };
        // A class change that sets a new size on the site's side.
        const fixed = document.getElementById('fixed') as Element;
        fixed.classList.add('big');
        fixed.classList.remove('fixed');
        await new Promise((res) => setTimeout(res, 0));
        const changed = fs(fixed);
        // What the engine's reader sees inside suspend: the site's own sizes.
        const read = w.tm.suspend(() => ({ li: fs(li), h1: fs(document.getElementById('h1') as Element) }));
        const after = fs(document.getElementById('h1') as Element);
        w.tm.clear();
        return { late, changed, read, after, offLi: fs(li) };
      });
      // li: 0.9em of the 20px wrap = 18, × 1.5 = 27; its <small> (smaller of 18 = 15) × 1.5 = 22.5 (not scaled twice).
      expect(r.late.li).toBeCloseTo(27, 1);
      expect(r.offLi).toBeCloseTo(18, 1);
      expect(r.late.small / r.late.li).toBeCloseTo(15 / 18, 2);
      expect(r.changed).toBeCloseTo(45, 1); // .big 30px × 1.5
      expect(r.read).toEqual({ li: 18, h1: 40 });
      expect(r.after).toBeCloseTo(60, 1);
      await page.close();
    }, 60000);

    it('a tiny box that does not clip its text is left alone (scaling could show it); a clipped one stays hidden', async () => {
      const page = await open(browser);
      const r = await page.evaluate(() => {
        document.body.innerHTML = `<p style="font-size:16px">Body</p>
          <span id="clipped" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">label</span>
          <span id="open" style="position:absolute;display:inline-block;width:1px;height:1px">spill</span>`;
        const w = window as unknown as { tm: { set(k: number): void; skipOf(el: Element): string | null } };
        w.tm.set(1.5);
        return { clipped: w.tm.skipOf(document.getElementById('clipped') as Element), open: w.tm.skipOf(document.getElementById('open') as Element), clippedTm: document.getElementById('clipped')?.hasAttribute('data-wa-tm') };
      });
      expect(r.clipped).toBeNull();
      expect(r.clippedTm).toBe(true);
      expect(r.open).toBe('hidden');
      await page.close();
    }, 60000);
  });
}
