#!/usr/bin/env node
// Walks the whole participant flow (protocol 4.3.0) on emulated phones and checks what gets saved. Run with the dev
// server up:
//
//   node scripts/e2e.mjs [--base http://127.0.0.1:5190] [--browsers webkit,chromium] [--seq 0,1,2,3]
//                        [--ai https://webable-gatorhack-ai.vercel.app] [--out <dir for screenshots>] [--human]
//
// --human: take about as long as a person on the screens around the websites (reading a card 5 s, the practice website
// 20 s, an ease question 3 s, a round's statements 6 s, the break and a round's start 8 s), so the adapted websites get
// the head start they would get with a participant (they load behind those screens). Without it the run is quick.
//
// WebKit (Safari's engine, as an iPhone 15) and Chromium (as a Pixel 7), real touch taps throughout. For each sequence
// (?seq=0..3) and browser: first someone the study is not for (stopped right after the age and trouble questions, nothing
// kept), then one whole run as someone it is for: welcome, agreement, who the study is for, about you, Set up WebAble
// (what gets in the way, text size, light or dark, and, only when live AI is configured, how they like information and
// words), the practice website, round 1 (3 websites, then 2 statements), the break, round 2, the 3 last questions.
//
// Every website is a 'find' task. Each one ends a different way on purpose: the practice and most websites with the right
// answer, one after detours (a Pause, "Go back to the website", "No, keep looking"), one with "I cannot find it" and
// "Yes, stop looking". The task's answer must be in the layer the person sees (the page, or WebAble's simplified page).
//
// Live AI: with VITE_STUDY_AI_ORIGIN set, adapted websites call the hosted server (up to ~25 s behind the card). A call
// that fails (the server has no keys) falls back to recorded answers; that is reported, never a failure. The 2-minute cap
// on a website is not exercised (it would add 2 minutes per run).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices, webkit } from 'playwright';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PROTOCOL = 'mobile-replica-4.3.0';
const base = arg('base', 'http://127.0.0.1:5190');
const browsers = arg('browsers', 'webkit,chromium').split(',');
const seqs = arg('seq', '1').split(',').map(Number);
const aiOrigin = arg('ai', 'https://webable-gatorhack-ai.vercel.app');
const out = arg('out', join(process.env.TMPDIR ?? '/tmp', 'webable-study-e2e'));
const HUMAN = process.argv.includes('--human')
  ? { card: 5000, practice: 20000, ease: 3000, statements: 6000, intro: 8000 }
  : { card: 0, practice: 0, ease: 0, statements: 0, intro: 0 };
mkdirSync(out, { recursive: true });

/** Live AI can take ~25 s behind a website's card; wait this long for "Open the website". */
const CARD_MS = 45000;
/** Per round: how many websites there are (protocol 4.2.0: news, health and entertainment). */
const PER_ROUND = 3;
/** The ease and statements answers the run gives, as the buttons say them and as saved (1 = Very easy). */
const EASE = { name: 'Somewhat easy', value: 3 };
/** The 4 UMUX statements after each round (2 and 4 are negative): score is UMUX-Lite (1 and 3), umux the full one. */
const UMUX = {
  1: { words: ['Agree', 'Disagree', 'Somewhat agree', 'Strongly disagree'], items: [6, 2, 5, 1], score: 75, umux: 83.3 },
  2: { words: ['Strongly agree', 'Strongly disagree', 'Agree', 'Disagree'], items: [7, 1, 6, 2], score: 91.7, umux: 91.7 },
};
const UMUX_ITEMS = [
  'These websites let me do what I needed to do.',
  'Using these websites was frustrating.',
  'These websites were easy to use.',
  'I had to spend too much time fixing mistakes on these websites.',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const notes = [];
/** Where the run is (a website's name, or the questions), to say where a request to another site came from. */
let where = 'questions';
const fail = (m) => failures.push(m);
const note = (m) => notes.push(m);

async function tapText(page, text, { exact = true, timeout = 20000 } = {}) {
  const loc = page.getByRole('button', { name: text, exact });
  await loc.first().waitFor({ state: 'visible', timeout });
  await loc.first().tap();
}

/** Waits for a heading (the screen has opened). */
const heading = (page, name, timeout = 20000) => page.getByRole('heading', { name }).first().waitFor({ state: 'visible', timeout });

/** Chooses an answer (a radio) and taps Continue: nothing moves on until Continue. */
async function choose(page, name, { cont = 'Continue' } = {}) {
  const r = page.getByRole('radio', typeof name === 'string' ? { name, exact: true } : { name });
  await r.first().waitFor({ state: 'visible', timeout: 20000 });
  await r.first().tap();
  await sleep(150);
  await tapText(page, cont);
  await sleep(350);
}

/** Ticks a box (role checkbox) by its words. */
async function tick(page, name) {
  const c = page.getByRole('checkbox', { name, exact: true });
  await c.first().waitFor({ state: 'visible', timeout: 20000 });
  await c.first().tap();
  await sleep(150);
}

/** Continue with nothing chosen must say so, plainly, in an alert, and stay on the screen. */
async function nudgeCheck(page, where, words) {
  await tapText(page, 'Continue');
  const alert = page.getByRole('alert').filter({ hasText: words });
  await alert.first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => fail(`${where}: Continue with nothing chosen did not say so ("${words}")`));
}

const saved = (page) =>
  page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('webable.study.session.'));
    return k ? JSON.parse(localStorage.getItem(k)) : null;
  });

/** Someone the study is not for: nothing kept, and Back leads to the questions again. */
async function notEligible(browser, device, seq, which, shots) {
  const ctx = await browser.newContext({ ...device });
  const page = await ctx.newPage();
  await page.goto(`${base}/?seq=${seq}`);
  await tapText(page, 'Start now');
  await heading(page, 'Before you agree to take part', 10000);
  await tapText(page, 'I agree to take part');
  await heading(page, 'How old are you?', 10000);
  await nudgeCheck(page, `${which}: age`, 'Choose your age group');
  // From 4.3.0 only under 50 with no trouble stops someone.
  await choose(page, 'Under 50');
  await heading(page, 'Which of these often happen to you when you use websites?', 10000);
  await tick(page, 'None of these');
  await tapText(page, 'Continue');
  await heading(page, 'You cannot take part in this study', 10000);
  await page.screenshot({ path: join(shots, 'not-eligible.png') });
  let rec = await saved(page);
  if (rec?.eligible || rec?.about?.ageBand || rec?.about?.troubles?.length) fail(`${which}: kept answers from someone the study is not for (under 50, no trouble)`);
  // Back, in case of a slip: the questions again. Under 50 with a trouble goes on.
  await tapText(page, 'Back');
  await heading(page, 'How old are you?', 10000);
  await choose(page, 'Under 50');
  await tick(page, 'I find it hard to get around a website');
  await tapText(page, 'Continue');
  await heading(page, 'What is your first name?', 10000);
  rec = await saved(page);
  if (!rec?.eligible || rec?.about?.ageBand !== 'under_50' || rec?.about?.troubles?.join() !== 'getting_around')
    fail(`${which}: under 50 with a trouble did not go on (${JSON.stringify(rec?.about)})`);
  await ctx.close();
}

/**
 * Is the task's answer in the layer the person sees: the simplified page when it is open, else the page? A different
 * route is allowed: the simplified page shows 10 rows of a long table, then "Show all … rows", which this taps.
 */
async function answerShown(page) {
  // The website on screen: the next adapted one may be loading behind it in a second, hidden frame.
  const el = await page.$('.st-task:not(.is-warm) iframe');
  const frame = el ? await el.contentFrame() : null;
  if (!frame) return null;
  const look = (expand) =>
    frame.evaluate((expand) => {
      const norm = (x) => x.replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ').toLowerCase();
      const task = (window.parent.__studyHosts?.[window.name] ?? window.parent.__studyHost).trial().task;
      const d = window.__studyFrame?.delivery?.() ?? null;
      const open = d?.simplified?.open === true;
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
      return {
        layer: open ? 'simplified page' : 'page',
        found: textOf(layer).includes(want),
        more: more.length,
        aiOk: !!d?.ai?.calls?.some((c) => c.ok),
      };
    }, expand);
  const first = await look(false);
  if (first.found || !first.more) return { ...first, route: 'shown' };
  await look(true);
  await sleep(700);
  return { ...(await look(false)), route: 'after Show all' };
}

/** The task as the shell holds it (the host is set while a website's screen is open). */
const hostTask = (page) =>
  page.evaluate(() => {
    const t = window.__studyHost?.trial().task;
    return t ? { id: t.id, kind: t.kind, question: t.question ?? t.prompt, choices: t.choices ?? [], correct: t.correct } : null;
  });

/**
 * One website, from its card to the ease question. `mode`:
 *   'answer'  the right answer, straight away;
 *   'detours' a Pause, an empty Continue, "Go back to the website" and "No, keep looking" first, then the right answer;
 *   'cannot'  "I cannot find it", then "Yes, stop looking".
 * Returns what the run meant to do, to compare with what was saved.
 */
async function runTask(page, name, shots, mode) {
  where = name;
  const open = page.getByRole('button', { name: 'Open the website', exact: true });
  const retry = page.getByRole('button', { name: 'Try again', exact: true });
  const t0 = Date.now();
  await open.or(retry).first().waitFor({ state: 'visible', timeout: CARD_MS });
  if (await retry.isVisible()) {
    note(`${name}: the website took over 35 s to open ("Try again" showed); tapped it`);
    await retry.tap();
    await open.waitFor({ state: 'visible', timeout: CARD_MS });
  }
  const cardMs = Date.now() - t0;
  // Reading the card takes a person a few seconds whether or not the website is ready.
  if (cardMs < HUMAN.card) await sleep(HUMAN.card - cardMs);
  const task = await hostTask(page);
  if (!task) throw new Error(`${name}: no task on screen`);
  if (task.kind !== 'find') fail(`${name}: ${task.id} is a '${task.kind}' task, not 'find'`);
  await page.screenshot({ path: join(shots, `${name}-card.png`) });
  await open.tap();
  await sleep(name === 'practice' ? Math.max(1200, HUMAN.practice) : 1200);
  await page.screenshot({ path: join(shots, `${name}-page.png`) });

  const shown = await answerShown(page);
  if (!shown?.found) {
    const m = `${name}: the answer is not in the ${shown?.layer ?? 'website'} the person sees`;
    // A live AI that answered may have worded the page its own way: a note, not a failure.
    if (shown?.aiOk) note(`${m} (a live AI call succeeded, so the wording may differ from the recorded one)`);
    else fail(m);
  } else if (shown.route !== 'shown') note(`${name}: the answer is in the ${shown.layer} ${shown.route}`);

  // Scroll the page inside the frame by a few screens, the way a thumb would.
  const box = await page.locator('.st-task:not(.is-warm) .st-frame-box').boundingBox();
  if (box) {
    for (let i = 0; i < 3; i++) {
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.6).catch(() => {});
      await page.mouse.wheel(0, box.height * 0.8).catch(() => {});
      await sleep(250);
    }
  }
  await page.screenshot({ path: join(shots, `${name}-scrolled.png`) });

  const found = page.getByRole('button', { name: 'I found it', exact: true });
  const cannot = page.getByRole('button', { name: 'I cannot find it', exact: true });
  const sheet = page.getByRole('heading', { name: task.question, exact: true });

  if (mode === 'cannot') {
    await cannot.tap();
    await heading(page, 'Do you want to stop looking?', 10000);
    await page.screenshot({ path: join(shots, `${name}-stop.png`) });
    await tapText(page, 'Yes, stop looking');
  } else {
    if (mode === 'detours') {
      // Pause, then back to the website.
      await tapText(page, 'Pause');
      await heading(page, 'You have paused this website', 10000);
      await tapText(page, 'Go back to the website');
      await found.waitFor({ state: 'visible', timeout: 10000 });
      // "I cannot find it", then "No, keep looking": back on the website.
      await cannot.tap();
      await heading(page, 'Do you want to stop looking?', 10000);
      await tapText(page, 'No, keep looking');
      await found.waitFor({ state: 'visible', timeout: 10000 });
      // "I found it", Continue with nothing chosen, then "Go back to the website".
      await found.tap();
      await sheet.waitFor({ state: 'visible', timeout: 10000 });
      await nudgeCheck(page, name, 'Choose an answer, or choose I could not find it');
      await tapText(page, 'Go back to the website');
      await found.waitFor({ state: 'visible', timeout: 10000 });
    }
    await found.tap();
    await sheet.waitFor({ state: 'visible', timeout: 10000 });
    await page.screenshot({ path: join(shots, `${name}-answer.png`) });
    const right = task.choices[task.correct];
    const r = page.getByRole('radio', { name: right, exact: true });
    await r.first().waitFor({ state: 'visible', timeout: 10000 });
    await r.first().tap();
    await sleep(150);
    await tapText(page, 'Continue');
  }
  await heading(page, 'How easy or hard was it to find the answer?', 10000);
  await page.screenshot({ path: join(shots, `${name}-ease.png`) });
  await sleep(HUMAN.ease);
  await choose(page, EASE.name);
  where = 'questions';
  return { taskId: task.id, mode, cardMs, question: task.question };
}

/** The 4 statements after a round: an empty Continue says so; then each answer. */
async function umux(page, r) {
  const u = UMUX[r];
  for (const [i, statement] of UMUX_ITEMS.entries()) {
    await heading(page, statement, i ? 10000 : 30000);
    if (!i) await nudgeCheck(page, `round ${r} statement 1`, 'Choose an answer');
    await choose(page, u.words[i]);
  }
}

/** The whole way through, as someone the study is for. Returns what was saved, and whether live AI was configured. */
async function fullRun(page, seq, which, shots) {
  const intended = [];
  const dark = seq % 2 === 1;
  await page.goto(`${base}/?seq=${seq}`);

  // Welcome, agreement.
  await tapText(page, 'Start now');
  await heading(page, 'Before you agree to take part', 10000);
  await tapText(page, 'I agree to take part');

  // Who the study is for: age, then which of three troubles often happen.
  await heading(page, 'How old are you?', 10000);
  await choose(page, '65 to 74');
  await heading(page, 'Which of these often happen to you when you use websites?', 10000);
  await tick(page, 'I find it hard to find the information I need');
  await page.screenshot({ path: join(shots, 'eligibility.png') });
  await tapText(page, 'Continue');

  // About you: first name, gender, race (ticks), comfort with technology.
  await heading(page, 'What is your first name?', 10000);
  await nudgeCheck(page, `${which}: first name`, 'Type your first name');
  await page.getByRole('textbox', { name: 'What is your first name?' }).fill('Rosa');
  await tapText(page, 'Continue');
  await heading(page, 'What is your gender?', 10000);
  await choose(page, 'Woman');
  await heading(page, 'What is your race or ethnicity?', 10000);
  await tick(page, 'Hispanic or Latino');
  await tapText(page, 'Continue');
  await heading(page, 'How comfortable are you using phones, computers and websites?', 10000);
  await choose(page, 'Comfortable');

  // Set up WebAble: what gets in the way, text size, light or dark, [how they like information, how it is written].
  await heading(page, 'What gets in your way on websites?', 10000);
  await nudgeCheck(page, `${which}: set-up needs`, 'Tap at least one answer');
  await tick(page, 'Text that is too small');
  await tick(page, 'Tapping the wrong thing');
  await page.screenshot({ path: join(shots, 'setup-needs.png') });
  await tapText(page, 'Continue');
  const bigger = page.getByRole('button', { name: 'Make text bigger', exact: true });
  const smaller = page.getByRole('button', { name: 'Make text smaller', exact: true });
  await bigger.waitFor({ state: 'visible', timeout: 15000 });
  if (await bigger.isEnabled()) await bigger.tap();
  await sleep(200);
  if (await smaller.isEnabled()) await smaller.tap();
  await sleep(200);
  await page.screenshot({ path: join(shots, 'setup-size.png') });
  await tapText(page, 'This size is comfortable');
  await heading(page, 'Which is easier for you to read?', 10000);
  await nudgeCheck(page, `${which}: light or dark`, 'Tap the one that is easier to read');
  await page.locator(`button.st-theme.is-${dark ? 'dark' : 'light'}`).tap();
  await sleep(150);
  await page.screenshot({ path: join(shots, 'setup-theme.png') });
  await tapText(page, 'Continue');
  // Live AI adds two questions; without it the summary follows at once. That is how this run knows which build it has.
  const shape = page.getByRole('heading', { name: 'How do you like information?' });
  const summary = page.getByRole('heading', { name: 'WebAble is set up for you' });
  await shape.or(summary).first().waitFor({ state: 'visible', timeout: 10000 });
  const live = await shape.isVisible();
  if (live) {
    await choose(page, 'As short points');
    await heading(page, 'How should websites be written for you?', 10000);
    await choose(page, 'Plain and short');
  }
  await heading(page, 'WebAble is set up for you', 10000);
  await page.screenshot({ path: join(shots, 'setup-summary.png') });
  await tapText(page, 'Go to the practice website');

  // Practice, then round 1 (3 websites, 2 statements), the break, round 2, the last questions.
  intended.push({ ...(await runTask(page, 'practice', shots, 'answer')), round: 0 });
  await heading(page, 'Round 1', 15000);
  const modes = { 1: ['detours', 'answer', 'answer'], 2: ['cannot', 'answer', 'answer'] };
  for (const r of [1, 2]) {
    const text = await page.locator('main').innerText();
    const n = Number(/(?:There are|Round 2 has) (\d+)/.exec(text)?.[1] ?? 0);
    if (n !== PER_ROUND) fail(`${which}: round ${r} says it has ${n} websites, not ${PER_ROUND}`);
    await sleep(HUMAN.intro);
    await tapText(page, `Start round ${r}`);
    for (let i = 1; i <= PER_ROUND; i++) intended.push({ ...(await runTask(page, `r${r}-${i}`, shots, modes[r][i - 1])), round: r });
    await sleep(HUMAN.statements);
    await umux(page, r);
    if (r === 1) await heading(page, 'Round 1 is finished', 10000);
  }
  // Last questions (4.1.0 on): blind first (Yes adds a text screen), then how much they liked each round, in words.
  await heading(page, 'Did the 2 rounds feel different?', 10000);
  const pics = await page.locator('.st-shot img').evaluateAll((xs) => xs.map((x) => ({ src: x.getAttribute('src'), ok: x.complete && x.naturalWidth > 0 })));
  if (pics.length !== 2 || pics.some((p) => !p.ok)) fail(`${which}: round pictures not shown (${JSON.stringify(pics)})`);
  // One round without WebAble and one with it, each picture from that round's first website.
  const kinds = pics.map((p) => /shots\/[a-z-]+-(original|adapted)\.jpg$/.exec(p.src ?? '')?.[1]).sort().join();
  if (kinds !== 'adapted,original') fail(`${which}: round pictures are ${pics.map((p) => p.src).join(' and ')}`);
  await page.screenshot({ path: join(shots, 'final-pictures.png'), fullPage: true });
  await choose(page, 'Yes');
  await heading(page, 'What was different? (optional)', 10000);
  await page.locator('textarea').fill('The text was bigger.');
  await tapText(page, 'Continue');
  await heading(page, /^How much did you like using the websites in round 1\?/, 10000);
  await page.screenshot({ path: join(shots, 'like1.png'), fullPage: true });
  await choose(page, 'Liked it a little');
  await heading(page, /^How much did you like using the websites in round 2\?/, 10000);
  await choose(page, 'Liked it a lot', { cont: 'Send my answers' });
  await heading(page, 'You have finished the study', 15000);
  await page.screenshot({ path: join(shots, 'done.png'), fullPage: true });
  const doneText = await page.locator('main').innerText();
  return { live, dark, intended, doneText, rec: await saved(page) };
}

/** Everything saved, against everything the run did. */
function check(which, run, seq) {
  const { rec, live, dark, intended, doneText } = run;
  if (!rec) return fail(`${which}: nothing saved`);
  if (rec.protocol !== PROTOCOL) fail(`${which}: protocol ${rec.protocol}, not ${PROTOCOL}`);
  if (rec.consent?.version !== '4.3.0' || rec.eligible !== true) fail(`${which}: consent not saved as 4.3.0 with eligibility (${JSON.stringify(rec.consent)})`);
  if (rec.sequence !== seq) fail(`${which}: sequence ${rec.sequence}, not ${seq}`);
  if (rec.stage !== 'done' || !rec.finishedAt) fail(`${which}: study not saved as finished (stage ${rec.stage})`);

  const a = rec.about ?? {};
  if (a.ageBand !== '65-74' || a.troubles?.join() !== 'finding') fail(`${which}: who-the-study-is-for answers not kept (${JSON.stringify(a)})`);
  if (a.firstName !== 'Rosa' || a.gender !== 'woman' || a.race?.join() !== 'hispanic' || a.techComfort !== 5)
    fail(`${which}: about-you answers not kept (${JSON.stringify(a)})`);

  const s = rec.setup;
  if (!s) fail(`${which}: no set-up answers saved`);
  else {
    if ([...s.needs].sort().join() !== 'small_text,tap_wrong') fail(`${which}: set-up needs not kept (${JSON.stringify(s.needs)})`);
    if (s.polarity !== (dark ? 'dark' : 'light')) fail(`${which}: light or dark not kept (${s.polarity})`);
    if (live) {
      if (s.shape !== 'points' || s.words !== 'plain') fail(`${which}: live AI questions not kept (${s.shape}, ${s.words})`);
      if (!s.reader) fail(`${which}: live AI is on but no reader was saved`);
    } else if (s.reader) fail(`${which}: a reader was saved without live AI`);
  }
  const fit = rec.calibration?.fit;
  if (!fit) fail(`${which}: no fit saved`);
  else {
    if (fit.polarity?.value !== (dark ? 'dark' : 'light')) fail(`${which}: fit's polarity is ${fit.polarity?.value}`);
    if ((fit.targets?.minPx ?? 0) < 56) fail(`${which}: "Tapping the wrong thing" did not make buttons bigger (targets ${JSON.stringify(fit.targets)})`);
  }

  const b = rec.baseline;
  if (!b) fail(`${which}: no tap baseline saved`);
  else {
    if (!(b.taps > 0)) fail(`${which}: baseline.taps is ${b.taps}, expected > 0`);
    if (!(b.screens > 0)) fail(`${which}: baseline.screens is ${b.screens}`);
  }

  for (const r of [1, 2]) {
    const u = rec.umux?.[r];
    if (!u || u.score === null) fail(`${which}: no UMUX score for round ${r} (${JSON.stringify(u)})`);
    else if (u.items.join() !== UMUX[r].items.join() || u.score !== UMUX[r].score || u.umux !== UMUX[r].umux)
      fail(`${which}: round ${r} UMUX saved as ${u.items.join('/')} = ${u.score}/${u.umux}, expected ${UMUX[r].items.join('/')} = ${UMUX[r].score}/${UMUX[r].umux}`);
  }
  if (rec.sus?.[1] || rec.sus?.[2]) fail(`${which}: SUS answers saved in a UMUX protocol`);

  const f = rec.final;
  if (f?.different !== 'yes' || f?.noticed !== 'The text was bigger.' || f?.liking?.[1] !== 5 || f?.liking?.[2] !== 7)
    fail(`${which}: last answers not saved (${JSON.stringify(f)})`);

  // Trials: the practice and 2 websites in each round, every one a 'find' task that ended the way the run meant.
  if (rec.trials.length !== 1 + 2 * PER_ROUND) fail(`${which}: ${rec.trials.length} trials saved, expected ${1 + 2 * PER_ROUND}`);
  const adaptedRound = rec.trials.find((t) => t.condition === 'adapted')?.round;
  for (const m of intended) {
    const t = rec.trials.find((x) => x.taskId === m.taskId && x.round === m.round);
    if (!t) {
      fail(`${which}: no trial saved for ${m.taskId} (round ${m.round})`);
      continue;
    }
    const cannot = m.mode === 'cannot';
    if (t.kind !== 'find') fail(`${which}: ${t.taskId} saved with kind '${t.kind}', not 'find'`);
    if (cannot ? t.endAction !== 'cant_find' || t.answer !== -1 || t.correct : t.endAction !== 'answered' || !t.correct)
      fail(`${which}: ${t.taskId} (${m.mode}) saved as ${t.endAction}, answer ${t.answer}, correct ${t.correct}`);
    if (t.timedOut) fail(`${which}: ${t.taskId} timed out`);
    if (t.seq !== EASE.value || t.seqScale !== 'easy-1') fail(`${which}: ${t.taskId} ease saved as ${t.seq}/${t.seqScale}`);
    if (!t.metrics) fail(`${which}: no metrics for ${t.taskId}`);
    else if (!(t.metrics.taps > 0)) fail(`${which}: ${t.taskId} has no taps on the website`);
    if (!(t.activeMs > 0)) fail(`${which}: ${t.taskId} has no active time`);
    if (t.condition === 'adapted') {
      const d = t.delivery;
      if (!d) fail(`${which}: no delivery record for ${t.taskId}`);
      else {
        if (d.replayMisses?.length) fail(`${which}: ${t.taskId} had ${d.replayMisses.length} replay misses (${d.replayMisses.map((x) => x.what).join(', ')})`);
        if (d.pageZoom > 1.001) fail(`${which}: ${t.taskId} narrowed the page (zoom ${d.pageZoom})`);
        // A change the engine logged without its ledger line has no source; the export counts these apart.
        const n = d.ops.filter((o) => o.status === 'applied' && !o.source).length;
        if (n) note(`${which}: ${t.taskId} has ${n} change(s) with no logged source`);
        if (live) {
          // Live AI: the website loads behind the screens before it, so its card should barely wait.
          note(`${which}: ${t.taskId} card up ${(m.cardMs / 1000).toFixed(1)} s before Open showed; loaded ${((t.preloadMs ?? 0) / 1000).toFixed(1)} s ahead, ready ${(t.readyMs / 1000).toFixed(1)} s after it started`);
          if (t.preloadMs == null) fail(`${which}: ${t.taskId} did not load ahead of its card`);
          if (!d.ai || d.ai.live !== true) fail(`${which}: ${t.taskId} has no delivery.ai with live AI on (${JSON.stringify(d.ai)})`);
          else if (!Array.isArray(d.ai.calls) || !Array.isArray(d.ai.accepted)) fail(`${which}: ${t.taskId} delivery.ai is missing calls or accepted`);
        } else if (d.ai?.live) fail(`${which}: ${t.taskId} says live AI answered, but it is not configured`);
      }
    } else if (t.delivery?.ai) fail(`${which}: ${t.taskId} (${t.condition}) has delivery.ai`);
  }
  const expectAdapted = seq === 1 || seq === 3 ? 1 : 2;
  if (adaptedRound !== expectAdapted) fail(`${which}: sequence ${seq} adapted round ${adaptedRound}, expected ${expectAdapted}`);
  if (!doneText.includes(`Round ${expectAdapted} used WebAble`)) fail(`${which}: the thank-you page does not name round ${expectAdapted} as the adapted one`);

  // Notes the app kept: only the ones this run does not cause are a problem.
  const kinds = [...new Set((rec.notes ?? []).map((n) => n.kind))];
  for (const bad of ['time_cap', 'frame_end_failed', 'reload', 'no_touch', 'resumed']) if (kinds.includes(bad)) fail(`${which}: the app noted '${bad}'`);
  const other = (rec.notes ?? []).filter((n) => !['time_cap', 'frame_end_failed', 'reload', 'no_touch', 'resumed'].includes(n.kind));
  if (other.length) note(`${which}: app notes: ${[...new Set(other.map((n) => `${n.kind}${n.detail ? ` (${n.detail})` : ''}`))].join('; ')}`);

  // The thank-you page on a live-AI build: what it says WebAble's AI did must still be true.
  if (live && /looked at each website once, before the study/.test(doneText))
    note(`${which}: APP: the thank-you page says the AI "looked at each website once, before the study" and was "the same for everyone", but live AI answered`);
  if (/From your warm-up/.test(doneText)) note(`${which}: APP: the thank-you page still says "From your warm-up" (the step is now "Set up WebAble")`);
}

for (const seq of seqs) {
  for (const which of browsers) {
    const label = `seq ${seq} ${which}`;
    const type = which === 'webkit' ? webkit : chromium;
    const device = which === 'webkit' ? devices['iPhone 15'] : devices['Pixel 7'];
    let browser;
    try {
      browser = await type.launch();
    } catch (err) {
      console.log(`${label}: not installed (${String(err).split('\n')[0]}); skipped`);
      continue;
    }
    const shots = join(out, `seq${seq}`, which);
    mkdirSync(shots, { recursive: true });
    const ctx = await browser.newContext({ ...device });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
    const outside = [];
    const outsideImages = [];
    const ai = { requests: 0, failed: 0 };
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.origin === new URL(base).origin || u.protocol.startsWith('data') || u.protocol.startsWith('blob')) return;
      if (u.origin === aiOrigin) ai.requests++;
      else if (r.resourceType() === 'image') outsideImages.push(`${where}: ${u.host}`);
      else outside.push(`${where}: ${r.url().slice(0, 140)}`);
    });
    page.on('requestfailed', (r) => new URL(r.url()).origin === aiOrigin && ai.failed++);
    page.on('response', (r) => new URL(r.url()).origin === aiOrigin && r.status() >= 400 && ai.failed++);
    const t0 = Date.now();
    try {
      await notEligible(browser, device, seq, label, shots);
      const run = await fullRun(page, seq, label, shots);
      const rec = run.rec;
      writeFileSync(join(shots, 'session.json'), JSON.stringify(rec, null, 2));
      const secs = Math.round((Date.now() - t0) / 1000);
      console.log(`\n${label} (${device.viewport.width}x${device.viewport.height}) finished in ${secs} s; live AI ${run.live ? 'on' : 'off'}; ${run.dark ? 'dark' : 'light'} page chosen`);
      console.table(
        rec.trials.map((t) => ({
          task: t.taskId,
          cond: t.condition,
          end: `${t.endAction}${t.correct ? ' (right)' : ''}`,
          s: Math.round(t.activeMs / 100) / 10,
          ready: t.readyMs,
          ahead: t.preloadMs ?? '',
          taps: t.metrics?.taps,
          misses: t.metrics?.misses,
          scroll: t.metrics?.scrollScreens,
          seen: t.metrics?.answerSeen,
          depth: t.metrics?.answerDepth ?? '',
          ease: t.seq,
          simplified: t.delivery?.simplified?.open ?? '',
          text: t.delivery?.textScale ?? '',
          ops: t.delivery ? t.delivery.ops.filter((o) => o.status === 'applied').length : '',
          fit_ops: t.delivery ? t.delivery.ops.filter((o) => o.status === 'applied' && o.source === 'fit').length : '',
          ai_ops: t.delivery ? t.delivery.ops.filter((o) => o.status === 'applied' && o.source === 'jev').length : '',
          ai_layout: t.delivery?.ai?.layout ?? '',
          ai_calls: t.delivery?.ai ? `${t.delivery.ai.calls.filter((c) => c.ok).length}/${t.delivery.ai.calls.length} ok` : '',
          accepted: t.delivery?.ai?.accepted?.join(' ') ?? '',
          replay_miss: t.delivery?.replayMisses?.length ?? '',
        })),
      );
      console.log('baseline:', JSON.stringify(rec.baseline));
      console.log('umux:', JSON.stringify(rec.umux));
      console.log('setup:', JSON.stringify({ ...rec.setup, reader: rec.setup?.reader ? 'saved' : null }));
      const calls = rec.trials.flatMap((t) => t.delivery?.ai?.calls ?? []);
      if (run.live) {
        const bad = calls.filter((c) => !c.ok);
        note(`${label}: live AI: ${calls.length} calls in the record, ${bad.length} failed${bad.length ? ` (${[...new Set(bad.map((c) => c.what))].join(', ')})` : ''}; ${ai.requests} requests to the AI server, ${ai.failed} failed or answered with an error`);
      }
      check(label, run, seq);
    } catch (err) {
      fail(`${label}: ${String(err).split('\n')[0]}`);
      await page.screenshot({ path: join(shots, 'failure.png') }).catch(() => {});
    }
    if (errors.length) console.log(`${label} errors (info):\n  ${[...new Set(errors)].slice(0, 12).join('\n  ')}`);
    // Pictures drawn from another site (the simplified page's lead picture) are reported, not failed: see the notes.
    if (outsideImages.length) note(`${label}: ${outsideImages.length} image request(s) to other sites: ${[...new Set(outsideImages)].join('; ')}`);
    if (outside.length) fail(`${label}: ${outside.length} requests to other sites, e.g. ${outside[0]}`);
    await browser.close();
  }
}

if (notes.length) console.log(`\nNotes\n- ${notes.join('\n- ')}`);
console.log(failures.length ? `\nFAILED\n- ${failures.join('\n- ')}` : '\nOK');
process.exit(failures.length ? 1 : 0);
