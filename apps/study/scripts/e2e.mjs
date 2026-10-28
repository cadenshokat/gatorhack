#!/usr/bin/env node
// Walks the whole participant flow on emulated phones and checks what gets saved. Run with the dev server up:
//
//   node scripts/e2e.mjs [--base http://127.0.0.1:5190] [--browsers webkit,chromium] [--seq 0..3] [--fit rosa]
//                        [--out <dir for screenshots>]
//
// WebKit (Safari's engine, as an iPhone 15) and Chromium (as a Pixel 7). First the way in, twice: someone the study
// is for (up to the warm-up) and someone it is not for (stopped before the agreement, nothing kept). Then the rest,
// with the warm-up skipped by a demo fit (?fit=…, which previews allow). On every website the task's answer must be in
// the layer the person sees (the page, or WebAble's simplified page). Taps are real touch taps.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices, webkit } from 'playwright';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const base = arg('base', 'http://127.0.0.1:5190');
const browsers = arg('browsers', 'webkit,chromium').split(',');
const seq = Number(arg('seq', '1'));
const fit = arg('fit', 'rosa');
const out = arg('out', join(process.env.TMPDIR ?? '/tmp', 'webable-study-e2e'));
mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];

async function tapText(page, text, { exact = true, timeout = 20000 } = {}) {
  const loc = page.getByRole('button', { name: text, exact });
  await loc.first().waitFor({ state: 'visible', timeout });
  await loc.first().tap();
}

/** Chooses an answer (a radio) and taps Continue: nothing moves on until Continue. */
async function choose(page, name, { cont = 'Continue' } = {}) {
  const r = page.getByRole('radio', typeof name === 'string' ? { name, exact: true } : { name });
  await r.first().waitFor({ state: 'visible', timeout: 20000 });
  await r.first().tap();
  await sleep(150);
  await tapText(page, cont);
  await sleep(350);
}

/** Waits for the next screen after a website: another task's card, or the 10 statements' intro. */
async function nextIs(page) {
  const open = page.getByRole('button', { name: 'Open the website', exact: true });
  const intro = page.getByRole('heading', { name: /^10 statements about round/ });
  await open.or(intro).first().waitFor({ state: 'visible', timeout: 30000 });
  return (await intro.isVisible()) ? 'sus' : 'task';
}

/** Ticks a box (role checkbox) by its words. */
async function tick(page, name) {
  const c = page.getByRole('checkbox', { name, exact: true });
  await c.first().waitFor({ state: 'visible', timeout: 20000 });
  await c.first().tap();
  await sleep(150);
}

const saved = (page) =>
  page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('webable.study.session.'));
    return k ? JSON.parse(localStorage.getItem(k)) : null;
  });

/** The way in: the 2 questions on who the study is for, then the agreement, or the stop page. */
async function wayIn(browser, device, which, shots) {
  const ctx = await browser.newContext({ ...device });
  const page = await ctx.newPage();
  await page.goto(`${base}/?seq=${seq}`);
  await tapText(page, 'Start now');
  await choose(page, '65 to 74');
  await tick(page, 'I find it hard to find the information I need');
  await page.screenshot({ path: join(shots, 'eligibility.png') });
  await tapText(page, 'Continue');
  await page.getByRole('heading', { name: 'Before you agree to take part' }).waitFor({ timeout: 10000 });
  await tapText(page, 'I agree to take part');
  await choose(page, 'Sometimes');
  await choose(page, 'Never');
  await choose(page, 'In both hands');
  await page.getByRole('heading', { name: 'Get ready' }).waitFor({ timeout: 10000 });
  await tapText(page, 'Continue');
  await page.getByRole('heading', { name: 'Warm-up' }).waitFor({ timeout: 10000 });
  const yes = await saved(page);
  if (yes?.consent?.version !== '2.0.0') failures.push(`${which}: consent not saved as 2.0.0`);
  if (yes?.about?.ageBand !== '65-74' || yes?.about?.troubles?.join() !== 'finding')
    failures.push(`${which}: who-the-study-is-for answers not kept (${JSON.stringify(yes?.about)})`);
  await ctx.close();

  const ctx2 = await browser.newContext({ ...device });
  const no = await ctx2.newPage();
  await no.goto(`${base}/?seq=${seq}`);
  await tapText(no, 'Start now');
  await choose(no, 'Under 50');
  await tick(no, 'I find it hard to get around a website');
  await tapText(no, 'Continue');
  await no.getByRole('heading', { name: 'You cannot take part in this study' }).waitFor({ timeout: 10000 });
  await no.screenshot({ path: join(shots, 'not-eligible.png') });
  const rec = await saved(no);
  if (rec?.consent || rec?.about?.ageBand || rec?.about?.troubles?.length) failures.push(`${which}: kept answers from someone the study is not for`);
  // Back, in case of a slip: the questions again.
  await tapText(no, 'Back');
  await no.getByRole('heading', { name: 'How old are you?' }).waitFor({ timeout: 10000 });
  await ctx2.close();
}

/**
 * Is the task's answer in the layer the person sees: the simplified page when it is open, else the page? A different
 * route is allowed: the simplified page shows 10 rows of a long table, then "Show all … rows", which this taps.
 */
async function answerShown(page) {
  const frame = page.frames().find((f) => f !== page.mainFrame());
  if (!frame) return null;
  const look = (expand) =>
    frame.evaluate((expand) => {
      const norm = (x) => x.replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, ' ').toLowerCase();
      const task = window.parent.__studyHost.trial().task;
      const open = window.__studyFrame?.delivery?.()?.simplified?.open === true;
      const want = norm(open ? (task.answerTextSimplified ?? task.answerText) : task.answerText);
      const textOf = (root) => {
        let t = '';
        const walk = (n) => {
          if (n.nodeType === 3) t += n.data;
          if (n.nodeType !== 1 && n.nodeType !== 11) return;
          if (n.nodeType === 1 && /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(n.tagName)) return;
          if (n.shadowRoot) walk(n.shadowRoot);
          for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
          t += ' ';
        };
        walk(root);
        return norm(t);
      };
      const calm = document.querySelector('webable-ui')?.shadowRoot?.querySelector('.wa-calm-host')?.shadowRoot;
      const layer = open && calm ? calm : document.body;
      const more = open && calm ? [...calm.querySelectorAll('button')].filter((b) => /^Show all/.test(b.textContent.trim())) : [];
      if (expand) for (const b of more) b.click();
      return { layer: open ? 'simplified page' : 'page', found: textOf(layer).includes(want), more: more.length };
    }, expand);
  const first = await look(false);
  if (first.found || !first.more) return { ...first, route: 'shown' };
  await look(true);
  await sleep(700);
  return { ...(await look(false)), route: 'after Show all' };
}

async function runTask(page, name, shots) {
  const start = page.getByRole('button', { name: 'Open the website', exact: true });
  await start.waitFor({ state: 'visible', timeout: 30000 });
  await page.screenshot({ path: join(shots, `${name}-card.png`) });
  await start.tap();
  await sleep(1200);
  await page.screenshot({ path: join(shots, `${name}-page.png`) });
  const shown = await answerShown(page);
  if (!shown?.found) failures.push(`${name}: the answer is not in the ${shown?.layer ?? 'website'} the person sees`);
  else if (shown.route !== 'shown') console.log(`${name}: the answer is in the ${shown.layer} ${shown.route}`);
  // Scroll the page inside the frame by a few screens, the way a thumb would.
  const box = await page.locator('.st-frame-box').boundingBox();
  if (box) {
    for (let i = 0; i < 3; i++) {
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.6).catch(() => {});
      await page.mouse.wheel(0, box.height * 0.8).catch(() => {});
      await sleep(250);
    }
  }
  await page.screenshot({ path: join(shots, `${name}-scrolled.png`) });
  await tapText(page, 'Answer');
  await sleep(300);
  const choices = page.locator('.st-sheet .st-choice');
  await choices.first().waitFor({ state: 'visible' });
  await choices.first().tap();
  await tapText(page, 'Continue');
  await page.getByText('How easy or hard was it to find the answer?').waitFor({ timeout: 10000 });
  await choose(page, '3');
}

for (const which of browsers) {
  const type = which === 'webkit' ? webkit : chromium;
  const device = which === 'webkit' ? devices['iPhone 15'] : devices['Pixel 7'];
  let browser;
  try {
    browser = await type.launch();
  } catch (err) {
    console.log(`${which}: not installed (${String(err).split('\n')[0]}); skipped`);
    continue;
  }
  const ctx = await browser.newContext({ ...device });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  const outside = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.origin !== new URL(base).origin && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) outside.push(r.url());
  });
  const shots = join(out, which);
  mkdirSync(shots, { recursive: true });
  const t0 = Date.now();
  try {
    await wayIn(browser, device, which, shots);
    await page.goto(`${base}/?seq=${seq}&fit=${fit}`);
    await runTask(page, 'practice', shots);
    for (const r of [1, 2]) {
      await tapText(page, `Start round ${r}`);
      // However many websites this build's round has: tasks until the statements' intro shows.
      for (let i = 1; i <= 6; i++) {
        if ((await nextIs(page)) === 'sus') break;
        await runTask(page, `r${r}-${i}`, shots);
      }
      await tapText(page, 'Continue');
      for (let k = 0; k < 10; k++) await choose(page, k % 2 === 0 ? '6' : '2');
      // What it was like (optional): a few words in round 1, nothing in round 2.
      await page.getByRole('heading', { name: /^What was it like to use these/ }).waitFor({ timeout: 10000 });
      if (r === 1) await page.locator('textarea').fill('The text was small.');
      await tapText(page, 'Continue');
      // The break's "Start round 2" goes straight into round 2.
      if (r === 1) {
        await page.getByRole('heading', { name: 'Round 1 is finished' }).waitFor({ timeout: 10000 });
        continue;
      }
    }
    await choose(page, /^Round 2/);
    await choose(page, 'Yes');
    await tapText(page, 'Continue'); // what was different (optional)
    await tick(page, 'None of these');
    await tapText(page, 'Continue');
    await choose(page, '5');
    await choose(page, 'Yes, I took part carefully', { cont: 'Send my answers' });
    await page.getByText('You have finished the study').waitFor({ timeout: 10000 });
    await page.screenshot({ path: join(shots, 'done.png'), fullPage: true });

    const rec = await saved(page);
    writeFileSync(join(shots, 'session.json'), JSON.stringify(rec, null, 2));
    const rows = rec.trials.map((t) => ({
      task: t.taskId,
      cond: t.condition,
      s: Math.round(t.activeMs / 100) / 10,
      ready: t.readyMs,
      taps: t.metrics?.taps,
      misses: t.metrics?.misses,
      scroll: t.metrics?.scrollScreens,
      seen: t.metrics?.answerSeen,
      simplified: t.delivery?.simplified?.open ?? '',
      zoom: t.delivery?.pageZoom ?? '',
      text: t.delivery?.textScale ?? '',
      seq: t.seq,
      ops: t.delivery ? t.delivery.ops.filter((o) => o.status === 'applied').length : '',
      warmup: t.delivery ? t.delivery.ops.filter((o) => o.status === 'applied' && o.source === 'fit').map((o) => o.kind).join(' ') : '',
      ai: t.delivery ? t.delivery.ops.filter((o) => o.status === 'applied' && o.source === 'jev').map((o) => o.kind).join(' ') : '',
      delivered: t.delivery?.delivered ?? '',
      misses_replay: t.delivery?.replayMisses?.length ?? '',
    }));
    console.log(`\n${which} (${device.viewport.width}x${device.viewport.height}) finished in ${Math.round((Date.now() - t0) / 1000)} s`);
    console.table(rows);
    console.log('SUS:', rec.sus[1]?.score, rec.sus[2]?.score, 'comments:', JSON.stringify(rec.comments), 'final:', rec.final?.preferred, rec.final?.useMyData);
    if (rec.comments?.[1] !== 'The text was small.' || rec.comments?.[2] !== null) failures.push(`${which}: round comments not saved`);
    // A change the engine logged without its ledger line has no source; the export counts these apart.
    for (const t of rec.trials) {
      const n = t.delivery?.ops.filter((o) => o.status === 'applied' && !o.source).length ?? 0;
      if (n) console.log(`${which}: ${t.taskId} has ${n} change(s) with no logged source`);
    }
    const expected = 1 + rec.trials.filter((t) => t.round > 0).length;
    if (rec.trials.length !== expected || rec.trials.length < 3) failures.push(`${which}: ${rec.trials.length} trials saved`);
    for (const r of [1, 2]) if (!rec.sus[r] || rec.sus[r].score === null) failures.push(`${which}: no SUS score for round ${r}`);
    for (const t of rec.trials) {
      if (!t.metrics) failures.push(`${which}: no metrics for ${t.taskId}`);
      if (t.condition === 'adapted' && !t.delivery) failures.push(`${which}: no delivery record for ${t.taskId}`);
      if (t.seq != null && t.seqScale !== 'easy-1') failures.push(`${which}: ${t.taskId} ease answer saved without its direction`);
      if (t.delivery && t.delivery.pageZoom > 1.001) failures.push(`${which}: ${t.taskId} narrowed the page (zoom ${t.delivery.pageZoom})`);
    }
  } catch (err) {
    failures.push(`${which}: ${String(err).split('\n')[0]}`);
    await page.screenshot({ path: join(shots, 'failure.png') }).catch(() => {});
  }
  if (errors.length) console.log(`${which} errors:\n  ${[...new Set(errors)].slice(0, 15).join('\n  ')}`);
  if (outside.length) failures.push(`${which}: ${outside.length} requests to other sites, e.g. ${outside[0]}`);
  await browser.close();
}

console.log(failures.length ? `\nFAILED\n- ${failures.join('\n- ')}` : '\nOK');
process.exit(failures.length ? 1 : 0);
