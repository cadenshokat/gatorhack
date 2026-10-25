// The 70-second warm-up (round 4), driven like a person at the eval viewport: a reader whose comfortable size is near
// 20 px, who sees faint words up to grey ~200, points with a spread of about 9 px, finds links and picks the calmer page.
// Every block, beat and the result screen is screenshotted on arrival and checked for what a person would miss
// (answers below the screen or covered, sideways scrolling). Hooks: `globalThis.__warmup` (phase, block, beat, saved)
// and the `data-answer` attributes on every answer.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { shoot, sleep, slug } from './common.mjs';

/** Layout checks for the current screen: answers on the first screen and not covered, no sideways scroll. */
const SCREEN_SRC = () => {
  const vw = innerWidth;
  const vh = innerHeight;
  const below = [];
  const covered = [];
  for (const b of document.querySelectorAll('[data-answer]')) {
    if (b.closest('.mk')) continue;
    const r = b.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const name = (b.getAttribute('data-answer') || '').slice(0, 30);
    if (r.bottom > vh + 1) {
      below.push(name);
      continue;
    }
    if (r.bottom <= 0) continue;
    const hit = document.elementFromPoint(r.left + r.width / 2, Math.min(vh - 1, r.top + r.height / 2));
    if (hit && !b.contains(hit)) covered.push(name);
  }
  return { vw, vh, docWidth: document.documentElement.scrollWidth, docHeight: document.documentElement.scrollHeight, below, covered };
};

const STATE_SRC = () => {
  const w = globalThis.__warmup;
  return w ? { phase: w.phase(), block: w.block(), beat: w.beat()?.mark ?? null } : null;
};

/**
 * Drive the warm-up once and return { screens, errors, seconds }. `larger` presses Bigger on the result screen that
 * many times (a person who wants text a step larger than measured).
 */
export async function runFitting({ context, extensionId, runDir, larger = 0, log = () => {} }) {
  const dir = path.join(runDir, 'fitting');
  mkdirSync(dir, { recursive: true });
  const out = { screens: [], errors: [], seconds: null };
  const page = await context.newPage();
  // run.mjs closes extension tabs it did not open; this one is ours.
  page.__webableEvalKeep = true;
  page.on('pageerror', (e) => out.errors.push(`page error: ${String(e?.message ?? e).split('\n')[0]}`));
  let n = 0;
  const shot = async (title, { scrolled = false } = {}) => {
    n += 1;
    const file = `${String(n).padStart(2, '0')}-${slug(title)}.png`;
    await shoot(page, path.join(dir, file));
    const m = await page.evaluate(SCREEN_SRC).catch(() => null);
    const problems = [];
    if (m) {
      if (m.docWidth > m.vw + 1) problems.push(`scrolls sideways (${m.docWidth - m.vw} px)`);
      if (!scrolled && m.below.length) problems.push(`below the first screen: ${m.below.join(', ')}`);
      if (m.covered.length) problems.push(`covered: ${m.covered.join(', ')}`);
    }
    out.screens.push({ title, file: `fitting/${file}`, ok: problems.length === 0, problems, notes: [], checks: m ? { docHeight: m.docHeight, vh: m.vh } : {} });
    log(`  ${problems.length ? '✗' : '✓'} ${title}${problems.length ? ` · ${problems.join('; ')}` : ''}`);
  };
  const click = (sel) => page.click(sel, { timeout: 4000 });
  try {
    await page.goto(`chrome-extension://${extensionId}/fitting.html`, { waitUntil: 'load' });
    await sleep(900);
    await shot('Start');
    const t0 = Date.now();
    await page.mouse.move(700, 500);
    await click('[data-answer="start"]');
    await sleep(500);
    const seen = new Set();
    for (let guard = 0; guard < 500; guard++) {
      const s = await page.evaluate(STATE_SRC);
      if (!s || s.phase !== 'stage') break;
      if (s.beat) {
        if (!seen.has(`beat-${s.beat}`)) {
          seen.add(`beat-${s.beat}`);
          await sleep(250);
          await shot(`Result line · ${s.beat}`);
        }
        await sleep(300);
        continue;
      }
      const b = s.block;
      if (!seen.has(b)) {
        seen.add(b);
        await sleep(350);
        await shot(`Block · ${b}`);
      }
      if (b === 'read') {
        const info = await page.evaluate(() => {
          const el = document.querySelector('.wu-sentence');
          return el ? { truth: el.getAttribute('data-truth'), px: Number(el.getAttribute('data-px')) } : null;
        });
        if (!info) { await sleep(200); continue; }
        let wait = 1900;
        let ans = info.truth;
        if (info.px < 12) ans = 'cant';
        else if (info.px < 20) wait = Math.min(9000, 1900 * 10 ** (2.5 * (Math.log10(20) - Math.log10(info.px))) + 300);
        await sleep(wait);
        await click(`.wu-tray [data-answer="${ans}"]`);
        await sleep(120);
      } else if (b === 'faint') {
        const word = await page.evaluate(() => {
          const el = document.querySelector('.wu-word');
          return el ? { w: el.getAttribute('data-word'), g: getComputedStyle(el).color } : null;
        });
        if (!word) { await sleep(200); continue; }
        const gray = Number(/(\d+)/.exec(word.g)?.[1] ?? 0);
        await sleep(900);
        await click(gray <= 200 ? `.wu-tray [data-answer="${word.w}"]` : '.wu-tray [data-answer="none"]');
        await sleep(120);
      } else if (b === 'point') {
        const dot = await page.evaluate(() => {
          const el = document.querySelector('.wu-dot.is-lit');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        if (!dot) { await sleep(200); continue; }
        await sleep(500);
        const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 12;
        await page.mouse.move(dot.x + g(), dot.y + g(), { steps: 4 });
        await page.mouse.down();
        await sleep(80);
        await page.mouse.up();
        await sleep(150);
      } else if (b === 'find') {
        const f = await page.evaluate(() => {
          const o = document.querySelector('.wu-overlay[data-block="find"]');
          return o ? { t: o.getAttribute('data-target'), trial: o.getAttribute('data-trial') } : null;
        });
        if (!f?.t) { await sleep(200); continue; }
        if (!seen.has(`find-${f.trial}`)) {
          seen.add(`find-${f.trial}`);
          await sleep(600);
          if (f.trial !== '0') await shot(`Find · trial ${f.trial}`);
        }
        await sleep(1500);
        const r = await page.evaluate((t) => {
          const a = [...document.querySelectorAll('.wu-overlay .mk-link')].find((x) => x.querySelector('.mk-label')?.textContent === t);
          if (!a) return null;
          const q = a.getBoundingClientRect();
          return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
        }, f.t);
        if (r) await page.mouse.click(r.x, r.y);
        else out.errors.push(`Find: "${f.t}" not on the page`);
        await sleep(300);
      } else if (b === 'pick') {
        await sleep(1200);
        const calm = await page.evaluate(() => document.querySelector('.wu-overlay[data-block="pick"]')?.getAttribute('data-calm'));
        await click(`[data-answer="${calm ?? 'same'}"]`);
        await sleep(200);
      } else {
        await sleep(200);
      }
    }
    await sleep(500);
    out.seconds = Math.round((Date.now() - t0) / 1000);
    await shot('Your fit');
    for (let i = 0; i < larger; i++) {
      await click('[data-answer="bigger"]').catch(() => out.errors.push('no Bigger button on the result screen'));
      await sleep(300);
    }
    if (larger) await shot(`Your fit · Bigger ×${larger}`);
    await click('[data-answer="change-targets"]').catch(() => {});
    await sleep(300);
    await shot('Your fit · a row open', { scrolled: true });
    await click('[data-answer="change-targets"]').catch(() => {});
    await click('[data-answer="before"]');
    await sleep(300);
    await shot('Your fit · Before');
    await click('[data-answer="after"]');
    await click('[data-answer="use"]');
    await sleep(900);
    await shot('Done');
    // The way a presenter shows it: the Rosa sample fit straight from the warm-up page (nothing saved).
    await page.goto(`chrome-extension://${extensionId}/fitting.html?demo=rosa`, { waitUntil: 'load' });
    await sleep(900);
    await shot('Your fit · Rosa sample fit');
  } catch (e) {
    out.errors.push(`warm-up: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
    await shot('Where it stopped').catch(() => {});
  } finally {
    await page.close().catch(() => {});
  }
  return out;
}
