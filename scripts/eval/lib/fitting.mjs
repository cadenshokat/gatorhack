// The fitting flow, driven like a person at the eval viewport: every screen is screenshotted on arrival and checked
// for what a person would miss (heading scrolled away, answers under Pause/Skip, sideways scrolling).
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, shoot, sleep, slug } from './common.mjs';

/** The true/false sentences, read from the fitting's own content so the run answers like a careful reader. */
function sentenceTruths() {
  const m = new Map();
  try {
    const src = readFileSync(path.join(ROOT, 'apps/extension/entrypoints/fitting/content/sentences.ts'), 'utf8');
    for (const x of src.matchAll(/text:\s*(['"])(.+?)\1,\s*truth:\s*(true|false)/g)) m.set(x[2].replace(/\\'/g, "'"), x[3] === 'true');
  } catch {
    /* answer "Can't read it" instead */
  }
  return m;
}

/** What is on the screen right now, measured before anything is pressed. */
const SCREEN_SRC = () => {
  const vw = innerWidth;
  const vh = innerHeight;
  const norm = (s) =>
    String(s || '')
      .replace(/\s+/g, ' ')
      .trim();
  const top = document.querySelector('.fx-top');
  const topBottom = top ? top.getBoundingClientRect().bottom : 0;
  const h1 = document.querySelector('.fx-main h1') ?? document.querySelector('h1');
  const hr = h1?.getBoundingClientRect() ?? null;
  const bar = document.querySelector('.fx-actionbar');
  const barPos = bar ? getComputedStyle(bar).position : null;
  // Answer controls: buttons in the main column that are not part of a stimulus (stage, mock page, thumbnails).
  const btns = [...document.querySelectorAll('.fx-main button')].filter((b) => {
    if (b.closest('.fx-stage, .fx-thumb, .mk, .pv')) return false;
    const r = b.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  });
  const name = (b) => norm(b.innerText || b.textContent || b.getAttribute('aria-label')).slice(0, 40);
  const covered = [];
  const below = [];
  for (const b of btns) {
    const r = b.getBoundingClientRect();
    if (r.top >= vh || r.bottom > vh + 1) {
      below.push(name(b));
      continue;
    }
    if (r.bottom <= 0) continue;
    const x = r.left + r.width / 2;
    const y = Math.min(vh - 1, r.top + r.height / 2);
    const hit = document.elementFromPoint(x, y);
    if (hit && !b.contains(hit)) {
      const by = hit.closest('.fx-actionbar')
        ? 'Pause/Skip bar'
        : hit.closest('.fx-top')
          ? 'top bar'
          : hit.closest('.fx-slip')
            ? 'fit slip'
            : norm(hit.className).slice(0, 30) || hit.tagName.toLowerCase();
      covered.push(`${name(b)} (under ${by})`);
    }
  }
  const mono = [...document.querySelectorAll('.fx-mark, .fx-mark *, .pv-notes li, .fx-slip-value')].some((el) =>
    /mono|menlo|consolas|courier/i.test(getComputedStyle(el).fontFamily),
  );
  return {
    h1: h1 ? norm(h1.textContent) : '',
    scrollY: Math.round(scrollY),
    h1Top: hr ? Math.round(hr.top) : null,
    h1Visible: !!hr && hr.top >= topBottom - 1 && hr.bottom <= vh,
    covered,
    below,
    hScroll: document.documentElement.scrollWidth > vw + 2,
    actionBar: barPos,
    chromeScale: getComputedStyle(document.documentElement).getPropertyValue('--chrome-scale').trim() || '1',
    monoNumbers: mono,
    docHeight: document.documentElement.scrollHeight,
    vh,
  };
};

function verdict(m, opts = {}) {
  const problems = [];
  if (!opts.scrolled && m.scrollY > 2) problems.push(`opened scrolled ${m.scrollY} px down`);
  if (!opts.scrolled && !m.h1Visible) problems.push('heading not in view');
  if (!opts.overlay && m.covered.length) problems.push(`covered: ${m.covered.join(', ')}`);
  if (m.hScroll) problems.push('scrolls sideways');
  if (m.monoNumbers) problems.push('numbers set in a monospace face');
  const notes = [];
  if (m.below.length) notes.push(`below the fold: ${m.below.slice(0, 3).join(', ')}${m.below.length > 3 ? ` +${m.below.length - 3}` : ''}`);
  return { ok: problems.length === 0, problems, notes };
}

/**
 * Run the whole fitting at the context's viewport. Saves screenshots to <runDir>/fitting/ and returns
 * { screens: [{ key, title, file, checks, ok, problems, notes }], seconds, fit, errors }.
 */
export async function runFitting({ context, extensionId, runDir, larger = 1, log = console.log }) {
  const dir = path.join(runDir, 'fitting');
  mkdirSync(dir, { recursive: true });
  const truths = sentenceTruths();
  const out = { screens: [], seconds: null, fit: null, errors: [] };
  const page = await context.newPage();
  page.__webableEvalKeep = true;
  page.on('pageerror', (e) => out.errors.push(`page: ${String(e.message).split('\n')[0].slice(0, 200)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') out.errors.push(`console: ${m.text().slice(0, 200)}`);
  });
  const t0 = Date.now();
  let n = 0;
  const shot = async (title, extra = {}) => {
    const m = await page.evaluate(SCREEN_SRC).catch(() => null);
    const file = `fitting/${String(++n).padStart(2, '0')}-${slug(title).slice(0, 40)}.png`;
    await page.mouse.move(2, 2).catch(() => {});
    await shoot(page, path.join(runDir, file)).catch((e) => out.errors.push(`screenshot: ${e.message.split('\n')[0]}`));
    const v = m ? verdict(m, extra) : { ok: false, problems: ['could not measure'], notes: [] };
    const s = { title, file, checks: m, ...v };
    s.ok = s.problems.length === 0;
    out.screens.push(s);
    log(`  ${s.ok ? '✓' : '✗'} ${title}${s.problems.length ? ` · ${s.problems.join('; ')}` : ''}`);
    return s;
  };
  const btn = (name) => page.getByRole('button', { name, exact: false }).first();

  try {
    await page.goto(`chrome-extension://${extensionId}/fitting.html`, { waitUntil: 'load' });
    await page.bringToFront();
    await sleep(900);
    const seen = new Map();
    for (let i = 0; i < 320; i++) {
      const h = (
        (await page
          .locator('.fx-main h1')
          .first()
          .textContent({ timeout: 4000 })
          .catch(() => '')) ?? ''
      )
        .replace(/\s+/g, ' ')
        .trim();
      const k = h.slice(0, 60);
      const count = (seen.get(k) ?? 0) + 1;
      seen.set(k, count);
      const firstTime = count === 1;
      // A later trial on the same screen may be scrolled where the person left it; only new screens must start at the top.
      if (firstTime || (count === 3 && /true|word|dot/i.test(k))) await shot(count > 1 ? `${k} (${count})` : k || 'untitled', { scrolled: count > 1 });

      if (/fit the web/i.test(h)) {
        if (firstTime) {
          await btn('Use a demo fit').click();
          await sleep(400);
          await shot('Welcome · demo fits');
          await btn('Use a demo fit').click();
          await sleep(200);
        }
        await btn('Start').click();
      } else if (/usually point/i.test(h)) {
        await page.getByRole('button', { name: /Mouse/ }).first().click();
      } else if (/comfortable to read/i.test(h)) {
        for (let j = 0; j < larger; j++) {
          await btn('Larger').click();
          await sleep(250);
        }
        if (larger > 0) await shot(`Comfortable to read · ${larger}× Larger`);
        await btn('This is comfortable').click();
      } else if (/Is it true/i.test(h)) {
        if (firstTime) {
          await page.keyboard.press('Escape');
          await sleep(400);
          await shot('Paused', { overlay: true });
          await page.keyboard.press('Escape');
          await sleep(400);
        }
        const stim = page.locator('.fx-stim').first();
        const text = ((await stim.textContent().catch(() => '')) ?? '').trim();
        const px = await stim.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)).catch(() => 20);
        await sleep(Math.min(1800, 500 + text.length * 18));
        const truth = truths.get(text);
        if (px < 11 || truth === undefined) await btn('Can’t read it').click();
        else
          await page
            .getByRole('button', { name: truth ? /^True/ : /^False/ })
            .first()
            .click();
      } else if (/shorter version/i.test(h)) {
        await btn('Keep going').click();
      } else if (/Which word is it/i.test(h)) {
        const w = page.locator('.fx-word').first();
        const word = ((await w.textContent().catch(() => '')) ?? '').trim();
        const g = await w.evaluate((e) => getComputedStyle(e).color).catch(() => 'rgb(0,0,0)');
        const v = Number((g.match(/\d+/) ?? ['0'])[0]);
        await sleep(500);
        if (v > 232) await page.locator('.fx-responses button').last().click();
        else
          await page
            .locator('.fx-responses button', { hasText: word })
            .first()
            .click()
            .catch(() => page.locator('.fx-responses button').last().click());
      } else if (/felt easier to read/i.test(h)) {
        await page.locator('.fx-pol-tile').first().click();
      } else if (/each dot/i.test(h)) {
        const d = page.locator('.fx-dot.is-active').first();
        const b = await d.boundingBox().catch(() => null);
        if (b) {
          await sleep(250);
          await page.mouse.click(b.x + b.width / 2 + 2, b.y + b.height / 2 - 1);
        } else await sleep(250);
      } else if (/^Find:/i.test(h)) {
        const target = h.replace(/^Find:\s*/i, '').trim();
        await sleep(700);
        const link = page.locator('.fx-stage-mock').getByText(target, { exact: true }).first();
        const b = await link.boundingBox().catch(() => null);
        if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
        else {
          out.errors.push(`F1 target "${target}" not found on the mock page`);
          await page.locator('.fx-actionbar button').last().click();
        }
        await sleep(300);
      } else if ((await page.locator('.fx-scale-btn').count()) > 0) {
        await page.locator('.fx-scale-btn').first().click();
      } else if (/get in your way/i.test(h)) {
        await page.locator('.fx-chip', { hasText: 'Moving things' }).click();
        await page.locator('.fx-chip', { hasText: 'Too much on the page' }).click();
        await sleep(250);
        await shot('Got in your way · two picked');
        await page.locator('.fx-responses button').first().click();
      } else if (/^Your fit/i.test(h)) {
        out.seconds = Math.round((Date.now() - t0) / 1000);
        // Arrival shot above covers the top: the preview must be on the first screen.
        const pv = await page.evaluate(() => {
          const el = document.querySelector('.fx-preview');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: Math.round(r.top), vh: innerHeight };
        });
        const last = out.screens[out.screens.length - 1];
        if (last && pv && pv.top > pv.vh - 120) {
          last.problems.push(`preview starts ${pv.top} px down (below the first screen)`);
          last.ok = false;
        }
        const seg = page.locator('.fx-seg-btn');
        if ((await seg.count()) >= 2) {
          await seg.first().click();
          await sleep(350);
          await shot('Your fit · Original');
          await seg.last().click();
          await sleep(250);
        }
        await page
          .locator('.fx-fitrows')
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => {});
        await page.evaluate(() => document.querySelector('.fx-fitrows')?.scrollIntoView({ block: 'start' }));
        await sleep(350);
        await shot('Your fit · what changes', { scrolled: true });
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await sleep(350);
        await shot('Your fit · bottom', { scrolled: true });
        // Save from the top bar when it is there, as a presenter would; else the button under the rows.
        const topSave = page.locator('.fx-top .fx-btn-primary');
        if ((await topSave.count()) > 0) await topSave.first().click();
        else await page.locator('.fx-row-actions button').first().click();
        await sleep(1000);
        await shot('Done');
        // The way a presenter shows it: the Rosa sample fit straight from the welcome screen (nothing saved).
        await page.goto(`chrome-extension://${extensionId}/fitting.html?demo=rosa`, { waitUntil: 'load' });
        await sleep(900);
        await shot('Your fit · Rosa sample fit');
        break;
      } else {
        await shot(`Unknown screen ${i}`);
        out.errors.push(`unknown screen "${h}"`);
        await page
          .locator('.fx-actionbar button')
          .last()
          .click()
          .catch(() => {});
      }
      await sleep(380);
    }
  } catch (e) {
    out.errors.push(`fitting: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
    await shot('Where it stopped').catch(() => {});
  } finally {
    await page.close().catch(() => {});
  }
  return out;
}
