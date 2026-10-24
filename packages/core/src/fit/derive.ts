// Owner: A2.
// The fitting's raw trials → the person's fit. Every threshold is computed here, in code (research-fitting
// §3–§6); Jev never estimates psychometric quantities. Deterministic: the same raw input gives the same fit.
import type {
  ContrastBand, FitProfile, FitSummaryForModel, FittingRaw, InputClass, Polarity, StructureLevel,
} from '../types';
import { jeffreysAtLeast, mulberry32 } from './stats';

/* ------------------------------------------------------------------ */
/* Small numeric helpers                                               */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const r2 = (v: number): number => Math.round(v * 100) / 100;
const r1 = (v: number): number => Math.round(v * 10) / 10;
const half = (v: number): number => Math.round(v * 2) / 2;
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const logit = (p: number): number => Math.log(p / (1 - p));
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

function sd(xs: number[], centre = mean(xs)): number {
  if (xs.length < 2) return 0;
  return Math.sqrt(xs.reduce((a, x) => a + (x - centre) ** 2, 0) / (xs.length - 1));
}

/* ------------------------------------------------------------------ */
/* Defaults and demo fits                                              */
/* ------------------------------------------------------------------ */

const FIT_VERSION = 'fit-1';
const DEMO_DATE = '2026-10-23T09:00:00.000Z';

export function defaultFit(): FitProfile {
  return {
    v: 'fit.1',
    createdAt: new Date().toISOString(),
    inputClass: 'mouse',
    text: { bodyPx: 16, cpsPx: null, largePrint: false, conf: 0, source: 'default', override: null },
    contrast: { band: 'N', floor: 4.5 },
    polarity: { value: 'none', stated: null },
    weight: { floor: 400 },
    spacing: { lineHeight: 1.5, wordEm: 0, letterEm: 0 },
    measure: { targetCpl: 66, maxCpl: 75, minCpl: 13 },
    targets: { minPx: null, conf: 0 },
    clicks: { steady: { on: false, windowMs: 300, radiusPx: 10 }, debounce: false },
    attention: { motion: { p: 0.3, on: false }, clutter: { p: 0.25 }, structureLevel: 0 },
    // Population priors until the person's own baselines exist (live signals compare with these).
    baselines: { searchSecMedian: null, slipRate: 0.02, repeatRate: 0.01, missRate: 0.04 },
    calibration: { version: 'default', durationSec: 0, skipped: [] },
  };
}

function demoRosa(): FitProfile {
  const f = defaultFit();
  return {
    ...f,
    createdAt: DEMO_DATE,
    inputClass: 'mouse',
    text: { bodyPx: 22, cpsPx: 17.5, largePrint: false, conf: 0.74, source: 'measured', override: null },
    contrast: { band: 'M', floor: 7 },
    polarity: { value: 'none', stated: 'none' },
    weight: { floor: 500 },
    spacing: { lineHeight: 1.6, wordEm: 0, letterEm: 0 },
    measure: { targetCpl: 66, maxCpl: 75, minCpl: 13 },
    targets: { minPx: 56, conf: 0.62 },
    clicks: { steady: { on: true, windowMs: 320, radiusPx: 11 }, debounce: false },
    attention: { motion: { p: 0.78, on: true }, clutter: { p: 0.86 }, structureLevel: 2 },
    baselines: { searchSecMedian: 4.8, slipRate: 0.09, repeatRate: 0.04, missRate: 0.12 },
    calibration: { version: 'demo-rosa', durationSec: 124, skipped: [] },
  };
}

function demoTypical(): FitProfile {
  return { ...defaultFit(), createdAt: DEMO_DATE, calibration: { version: 'demo-typical', durationSec: 0, skipped: [] } };
}

function demoReader(): FitProfile {
  const f = defaultFit();
  return {
    ...f,
    createdAt: DEMO_DATE,
    inputClass: 'trackpad',
    text: { bodyPx: 24, cpsPx: 15.2, largePrint: false, conf: 0.7, source: 'measured', override: null },
    contrast: { band: 'S', floor: 15 },
    polarity: { value: 'none', stated: null },
    weight: { floor: 600 },
    spacing: { lineHeight: 1.8, wordEm: 0.16, letterEm: 0 },
    measure: { targetCpl: 66, maxCpl: 75, minCpl: 13 },
    targets: { minPx: 44, conf: 0.55 },
    clicks: { steady: { on: false, windowMs: 300, radiusPx: 9 }, debounce: false },
    attention: { motion: { p: 0.31, on: false }, clutter: { p: 0.64 }, structureLevel: 1 },
    baselines: { searchSecMedian: 3.1, slipRate: 0.02, repeatRate: 0.01, missRate: 0.04 },
    calibration: { version: 'demo-reader', durationSec: 118, skipped: [] },
  };
}

/**
 * Three ready-made fits for the demo and the eval harness.
 * rosa: 22 px text, 56 px click areas, Steady Clicks, contrast band M, Calm view on busy pages, motion paused.
 * typical: defaults (nothing changes). reader: 24 px text, contrast band S, polarity left to the site, 44 px, structure 1.
 */
export const DEMO_FITS: { rosa: FitProfile; typical: FitProfile; reader: FitProfile } = {
  rosa: demoRosa(),
  typical: demoTypical(),
  reader: demoReader(),
};

/* ------------------------------------------------------------------ */
/* Part R: reading                                                     */
/* ------------------------------------------------------------------ */

/** R2 sentences are 54–58 characters; speed uses standard 6-character words. */
const SENTENCE_CHARS = 56;
const T0_SEC = 0.6;

/** log10 wpm for one sentence, or null when the trial is not a valid speed sample. */
function sentenceSpeed(ms: number): number | null {
  const rt = ms / 1000;
  const reading = rt - T0_SEC;
  if (!Number.isFinite(reading) || reading < 0.8) return null;
  const wpm = (60 * (SENTENCE_CHARS / 6)) / reading;
  if (wpm > 900) return null;
  return Math.log10(wpm);
}

interface ReadingResult {
  bodyPx: number;
  cpsPx: number | null;
  conf: number;
  source: 'measured' | 'stated' | 'default';
  largePrint: boolean;
  residualSd: number; // plateau residual SD, for the polarity test
}

function readingSize(raw: NonNullable<FittingRaw['reading']>, marginLog: number): ReadingResult {
  const seed = raw.seedPx != null && raw.seedPx > 0 ? raw.seedPx : null;
  const xComf = seed ? Math.log10(seed) : null;
  const fallback = (): ReadingResult => (seed
    ? { bodyPx: half(clamp(seed, 16, 96)), cpsPx: null, conf: 0.35, source: 'stated', largePrint: seed >= 32, residualSd: 0.08 }
    : { bodyPx: 16, cpsPx: null, conf: 0, source: 'default', largePrint: false, residualSd: 0.08 });

  const trials = raw.ladder.filter((t) => t.px > 0 && Number.isFinite(t.px)).map((t) => ({
    x: Math.round(Math.log10(t.px) * 1000) / 1000,
    y: t.correct ? sentenceSpeed(t.ms) : null,
    correct: t.correct,
  }));
  if (!trials.length) return fallback();
  const accuracy = trials.filter((t) => t.correct).length / trials.length;
  const validYs = trials.map((t) => t.y).filter((y): y is number => y != null);
  if (accuracy < 0.65 || !validYs.length) return fallback();

  // Plateau (maximum reading speed): median of points within 0.15 log of the best, iterated once.
  const maxY = Math.max(...validYs);
  const m1 = median(validYs.filter((y) => y >= maxY - 0.15));
  const plateau = validYs.filter((y) => y >= m1 - 0.15);
  const yMRS = median(plateau);
  const nP = plateau.length;
  const residualSd = plateau.length >= 3 ? clamp(sd(plateau, yMRS), 0.05, 0.15) : 0.08;

  // Per tested size: the best valid speed, or an error.
  const thr = yMRS - 0.097; // 80% of the plateau speed
  const bySize = new Map<number, number | null>();
  for (const t of trials) {
    const prev = bySize.get(t.x);
    if (t.y == null) { if (prev === undefined) bySize.set(t.x, null); continue; }
    if (prev == null || t.y > prev) bySize.set(t.x, t.y);
  }
  const sizes = [...bySize.keys()].sort((a, b) => b - a);
  let xp: number | null = null;
  let xo: number | null = null;
  for (const x of sizes) {
    const y = bySize.get(x);
    const on = y != null && y >= thr;
    if (on) { xp = x; continue; }
    if (xp != null) { xo = x; break; }
  }
  if (xp == null) return fallback();

  let xCps = xp;
  const yo = xo != null ? bySize.get(xo) : null;
  const yp = bySize.get(xp);
  if (xo != null && yo != null && yp != null && yp > yo) {
    xCps = clamp(xo + ((thr - yo) * (xp - xo)) / (yp - yo), xo, xp);
  }

  // Secondary: two-limb fit (y = yMRS − s·max(0, x_c − x)) with priors, only with ≥ 5 valid points.
  const pts = trials.filter((t) => t.y != null) as Array<{ x: number; y: number }>;
  if (pts.length >= 5) {
    const xs = pts.map((p) => p.x);
    const lo = Math.min(...xs) - 0.2;
    const hi = Math.max(...xs);
    let best = { cost: Infinity, xc: xp, s: 2.5 };
    for (let xc = lo; xc <= hi + 1e-9; xc += 0.01) {
      for (let s = 0.5; s <= 5 + 1e-9; s += 0.05) {
        let rss = 0;
        for (const p of pts) rss += (p.y - (yMRS - s * Math.max(0, xc - p.x))) ** 2;
        const prior = (xComf != null ? ((xc - xComf) / 0.35) ** 2 : 0) + (Math.log(s / 2.5) / 0.6) ** 2;
        const cost = rss + prior;
        if (cost < best.cost) best = { cost, xc, s };
      }
    }
    const xFit = best.xc - 0.097 / best.s;
    if (Math.abs(xFit - xCps) > 0.1) xCps = Math.max(xFit, xCps);
  }

  // Confidence: min(0.9, q_n · q_b · q_v · q_c).
  const qn = Math.min(1, nP / 3);
  const bracket = xo != null ? xp - xo : null;
  const qb = bracket == null ? 0.5 : bracket <= 0.12 ? 1 : bracket <= 0.22 ? 0.8 : 0.5;
  const qv = clamp((accuracy - 0.5) / 0.4, 0, 1);
  const dc = xComf != null ? Math.abs(xComf - xCps) : null;
  const qc = dc == null ? 0.85 : dc <= 0.2 ? 1 : dc <= 0.35 ? 0.85 : 0.7;
  const conf = r2(Math.min(0.9, qn * qb * qv * qc));

  const cps = 10 ** xCps;
  const F = 10 ** (xCps + marginLog);
  // Body text never goes below the 16 px web default (never shrink a site's text).
  const bodyPx = half(clamp(F, 16, 96));
  return {
    bodyPx,
    cpsPx: r1(cps),
    conf,
    source: 'measured',
    largePrint: (seed != null && seed >= 32) || bodyPx >= 32,
    residualSd,
  };
}

/** R3: QUEST+ posterior over the log Weber threshold from every faint-word trial (fixed slope). */
function contrastBand(raw: NonNullable<FittingRaw['reading']>, largePrint: boolean): { band: ContrastBand; alpha: number | null } {
  const trials = raw.faint.filter((t) => Number.isFinite(t.contrast));
  if (!trials.length) return { band: 'N', alpha: null };
  // On a white stage: L_text = 1.05 / CR − 0.05, Weber W = 1 − L_text.
  const weber = (cr: number): number => clamp(1 - (1.05 / Math.max(cr, 1) - 0.05), 0.001, 1);
  const beta = 3.5;
  const gamma = 0.25;
  const lambda = 0.02;
  const mu = largePrint ? -1.1 : -1.4;
  const sigma = largePrint ? 0.6 : 0.5;
  const grid: number[] = [];
  for (let a = -2.3; a <= -0.1 + 1e-9; a += 0.02) grid.push(a);
  const logPost = grid.map((a) => -0.5 * ((a - mu) / sigma) ** 2);
  for (const t of trials) {
    const x = Math.log10(weber(t.contrast));
    grid.forEach((a, i) => {
      const p = gamma + (1 - gamma - lambda) * (1 - Math.exp(-(10 ** (beta * (x - a)))));
      logPost[i] = (logPost[i] as number) + Math.log(t.correct ? p : 1 - p);
    });
  }
  const mx = Math.max(...logPost);
  const w = logPost.map((l) => Math.exp(l - mx));
  const z = w.reduce((a, b) => a + b, 0);
  const alpha = grid.reduce((acc, a, i) => acc + a * (w[i] as number), 0) / z;

  const ceiling = trials.filter((t) => t.correct && weber(t.contrast) <= 0.02).length >= 3;
  const cantSee = trials.filter((t) => !t.correct && weber(t.contrast) >= 0.3).length >= 2;
  if (ceiling) return { band: 'N', alpha };
  if (cantSee) return { band: 'S', alpha };
  return { band: alpha <= -1.52 ? 'N' : alpha <= -1.05 ? 'M' : 'S', alpha };
}

/** R4: light vs dark from reading speed near CPS, combined with the stated choice. */
function polarityOf(raw: NonNullable<FittingRaw['reading']>, residualSd: number): { value: Polarity; stated: Polarity | null } {
  const stated = raw.polarity.stated;
  const yL = raw.polarity.lightMs.map(sentenceSpeed).filter((y): y is number => y != null);
  const yD = raw.polarity.darkMs.map(sentenceSpeed).filter((y): y is number => y != null);
  let measured: Polarity | null = null;
  if (yL.length && yD.length) {
    const delta = mean(yD) - mean(yL);
    const se = residualSd * Math.sqrt(1 / yD.length + 1 / yL.length);
    if (Math.abs(delta) >= 0.08 && Math.abs(delta) / se >= 1.64) measured = delta > 0 ? 'dark' : 'light';
  }
  const statedPick = stated === 'light' || stated === 'dark' ? stated : null;
  let value: Polarity = 'none';
  if (measured && statedPick) value = measured === statedPick ? measured : 'none';
  else if (measured) value = measured;
  else if (statedPick) value = statedPick;
  return { value, stated };
}

/* ------------------------------------------------------------------ */
/* Part P: pointing                                                    */
/* ------------------------------------------------------------------ */

const MOUSE_LADDER = [24, 32, 44, 56, 72, 96];
const TOUCH_LADDER = [44, 56, 72, 96];

type Press = { dx: number; dy: number; hit: boolean; slipped: boolean };

function scored(presses: Press[]): Press[] {
  // The first click of a block positions the pointer and is not scored (blocks are 1 + 8).
  return presses.length > 8 ? presses.slice(1) : presses;
}

function blockPasses(sizePx: number, presses: Press[]): boolean {
  const n = presses.length;
  if (!n) return false;
  const misses = presses.filter((p) => !p.hit).length;
  const allowed = n >= 8 ? Math.floor(n / 8) : n >= 5 ? 1 : 0;
  const W = sizePx;
  const r = presses.map((p) => Math.hypot(p.dx, p.dy)).filter((d) => d <= 2 * W);
  const sigmaHat = r.length ? median(r) / 1.1774 : W; // all fly-bys: treat as very spread
  const sigmaAbs = Math.sqrt(Math.max(0, sigmaHat ** 2 - (0.16 * W) ** 2));
  const sigmaEff = Math.sqrt((1.15 * sigmaAbs) ** 2 + (0.16 * W) ** 2);
  const pMiss = Math.exp(-(W * W) / (8 * sigmaEff * sigmaEff));
  return misses <= allowed && pMiss <= 0.08;
}

function minTarget(blocks: Array<{ sizePx: number; presses: Press[] }>, ladder: number[]): number | null {
  const tested = blocks.filter((b) => b.presses.length > 0);
  if (!tested.length) return null;
  const results = tested.map((b) => ({ size: b.sizePx, pass: blockPasses(b.sizePx, b.presses) }));
  const failed = results.filter((x) => !x.pass).map((x) => x.size);
  const maxFailed = failed.length ? Math.max(...failed) : -Infinity;
  // The smallest passing level with no failure above it (a pass below a failure is not trusted).
  const passed = results.filter((x) => x.pass && x.size > maxFailed).map((x) => x.size);
  if (passed.length) return Math.min(...passed);
  const above = ladder.find((l) => l > maxFailed);
  return above ?? ladder[ladder.length - 1] ?? 96;
}

function pointingFit(
  raw: NonNullable<FittingRaw['pointing']>,
  inputClass: InputClass,
): { minPx: number | null; conf: number; missRate: number | null; ring: Press[] } {
  const ladder = inputClass === 'touch' ? TOUCH_LADDER : MOUSE_LADDER;
  const blocks = raw.blocks.map((b) => ({ sizePx: b.sizePx, presses: scored(b.presses) }));
  const ring = blocks.flatMap((b) => b.presses);
  const sStar = minTarget(blocks, ladder);
  if (sStar == null) return { minPx: null, conf: 0, missRate: null, ring };

  // Bootstrap: 200 resamples of press points within blocks; conf = share that lands on the same S*.
  let seed = 2166136261;
  for (const p of ring) seed = Math.imul(seed ^ Math.round(p.dx * 10 + p.dy * 7 + (p.hit ? 1 : 0)), 16777619);
  const rnd = mulberry32(seed);
  let same = 0;
  const B = 200;
  for (let i = 0; i < B; i++) {
    const re = blocks.map((b) => ({
      sizePx: b.sizePx,
      presses: b.presses.map(() => b.presses[Math.floor(rnd() * b.presses.length)] as Press),
    }));
    if (minTarget(re, ladder) === sStar) same++;
  }
  const atStar = blocks.find((b) => b.sizePx === sStar)?.presses ?? ring;
  const missRate = atStar.length ? atStar.filter((p) => !p.hit).length / atStar.length : null;
  return { minPx: sStar, conf: r2(same / B), missRate, ring };
}

/* ------------------------------------------------------------------ */
/* Part F: finding                                                     */
/* ------------------------------------------------------------------ */

function chip(gotInWay: string[], re: RegExp): boolean {
  return gotInWay.some((c) => re.test(c.toLowerCase()));
}

function attentionFit(raw: FittingRaw['finding'], largePrint: boolean): {
  motionP: number; clutterP: number; structureLevel: StructureLevel; searchSecMedian: number | null;
} {
  let zClutter = 0;
  let zMotion = 0;
  let errDiff = 0;
  let searchSecMedian: number | null = null;
  let rCalm = 0;
  let chips: string[] = [];

  if (raw) {
    chips = raw.gotInWay ?? [];
    const pc = clamp(Math.round(raw.preferredCalm ?? 0), 0, 2);
    rCalm = [-1, 0.5, 1.5][pc] as number; // 0..2 votes for the calmer page, on the −2..+2 preference scale
    const all = raw.trials.map((t) => ({ ...t, y: Math.log(t.found ? clamp(t.ms, 100, 12000) / 1000 : 12) }));
    const med = median(all.map((t) => t.y));
    const mad = median(all.map((t) => Math.abs(t.y - med)));
    const valid = mad > 0 ? all.filter((t) => Math.abs(t.y - med) <= 3 * mad) : all;
    const found = valid.filter((t) => t.found);
    if (found.length) searchSecMedian = r1(median(found.map((t) => t.ms / 1000)));

    if (all.length - valid.length <= 3 && valid.length >= 4) {
      // Pooled within-cell SD, floored at 0.30.
      const cells = new Map<string, number[]>();
      for (const t of valid) {
        const k = `${t.clutter ? 1 : 0}${t.motion ? 1 : 0}`;
        cells.set(k, [...(cells.get(k) ?? []), t.y]);
      }
      let ss = 0;
      let dof = 0;
      for (const ys of cells.values()) {
        if (ys.length < 2) continue;
        const m = mean(ys);
        ss += ys.reduce((a, y) => a + (y - m) ** 2, 0);
        dof += ys.length - 1;
      }
      const sw = Math.max(dof > 0 ? Math.sqrt(ss / dof) : 0, 0.3);
      const z = (a: typeof valid, b: typeof valid): number => {
        if (!a.length || !b.length) return 0;
        const delta = mean(a.map((t) => t.y)) - mean(b.map((t) => t.y));
        return clamp(delta / (sw * Math.sqrt(1 / a.length + 1 / b.length)), -2, 3);
      };
      zClutter = z(valid.filter((t) => t.clutter), valid.filter((t) => !t.clutter));
      zMotion = z(valid.filter((t) => t.motion), valid.filter((t) => !t.motion));
      const errBusy = all.filter((t) => t.clutter && !t.found).length;
      const errClean = all.filter((t) => !t.clutter && !t.found).length;
      errDiff = errBusy - errClean;
    }
  }

  const moving = chip(chips, /mov|motion|animat/);
  const stopped = chip(chips, /stop/);
  const tooMuch = chip(chips, /too much|busy|clutter|crowd/);
  const popups = chip(chips, /pop.?up/);
  const longText = chip(chips, /long|block|text/);
  const unclear = chip(chips, /hard to tell|what to click/);

  const motionP = sigmoid(logit(0.3) + (stopped ? 2 : 0) + 0.6 * rCalm + (moving ? 1 : 0) + 0.5 * zMotion);
  const clutterP = sigmoid(logit(0.25) + 0.6 * rCalm + (tooMuch ? 1 : 0) + (popups ? 0.5 : 0) + 0.5 * zClutter + (errDiff >= 1 ? 0.3 : 0));
  const chunkP = sigmoid(logit(0.25) + (longText ? 1.2 : 0) + (largePrint ? 0.4 : 0));
  const guideP = sigmoid(logit(0.2) + (unclear ? 1.2 : 0) + 0.3 * zClutter);
  const need = Math.max(clutterP, chunkP, guideP);
  const structureLevel: StructureLevel = need >= 0.8 ? 2 : need >= 0.6 ? 1 : 0;
  return { motionP: r2(motionP), clutterP: r2(clutterP), structureLevel, searchSecMedian };
}

/* ------------------------------------------------------------------ */
/* deriveFit                                                           */
/* ------------------------------------------------------------------ */

/**
 * Raw fitting trials → FitProfile. Units: `reading.seedPx` and `ladder[].px` are CSS font px of the stimulus
 * font at the fitting page's zoom (assumed 100%); `faint[].contrast` is the WCAG ratio shown on white;
 * `pointing` press offsets are CSS px from the target centre.
 */
export function deriveFit(raw: FittingRaw): FitProfile {
  const base = defaultFit();
  const inputClass = raw.inputClass;
  const skipped = [...new Set(raw.skipped ?? [])];

  // Reading: contrast band first (band S widens the size margin), then size, then polarity.
  let text = base.text;
  let band: ContrastBand = 'N';
  let polarity = base.polarity;
  if (raw.reading) {
    const seedLarge = raw.reading.seedPx != null && raw.reading.seedPx >= 32;
    band = contrastBand(raw.reading, seedLarge).band;
    const rs = readingSize(raw.reading, band === 'S' ? 0.2 : 0.1);
    text = { bodyPx: rs.bodyPx, cpsPx: rs.cpsPx, largePrint: rs.largePrint, conf: rs.conf, source: rs.source, override: null };
    polarity = polarityOf(raw.reading, rs.residualSd);
  }
  const floor = band === 'S' ? 15 : band === 'M' ? 7 : 4.5;
  const weightFloor = band === 'S' ? 600 : band === 'M' ? 500 : 400;
  const spacing = {
    lineHeight: band === 'S' || text.largePrint ? 1.8 : band === 'M' ? 1.6 : 1.5,
    wordEm: band === 'S' || text.largePrint ? 0.16 : 0,
    letterEm: 0,
  };

  // Pointing (keyboard, switch and voice users skip it: stored as null, never as a default).
  let targets: FitProfile['targets'] = { minPx: null, conf: 0 };
  let ring: Press[] = [];
  let missRate: number | null = null;
  if (raw.pointing && inputClass !== 'keyboard') {
    const pf = pointingFit(raw.pointing, inputClass);
    targets = { minPx: pf.minPx, conf: pf.conf };
    ring = pf.ring;
    missRate = pf.missRate;
  }

  // Click stability from every press: Steady Clicks when P(slip rate ≥ 5%) ≥ 0.70.
  const presses = raw.allPresses ?? [];
  const slipK = ring.length >= 8 ? ring.filter((p) => p.slipped).length : presses.filter((p) => p.slipped).length;
  const slipN = ring.length >= 8 ? ring.length : presses.length;
  const steadyOn = inputClass !== 'touch' && inputClass !== 'keyboard' && slipN >= 8 && jeffreysAtLeast(slipK, slipN, 0.05) >= 0.7;
  const repK = presses.filter((p) => p.repeat).length;
  const debounce = inputClass !== 'keyboard' && presses.length >= 30 && repK >= 3;
  const S = targets.minPx;
  const radiusPx = S ? Math.round(clamp(S / 5, 6, S / 2)) : 10;

  const att = attentionFit(raw.finding, text.largePrint);

  const allSlips = presses.length ? presses.filter((p) => p.slipped).length / presses.length : null;
  return {
    v: 'fit.1',
    createdAt: new Date().toISOString(),
    inputClass,
    text,
    contrast: { band, floor },
    polarity,
    weight: { floor: weightFloor },
    spacing,
    measure: { targetCpl: 66, maxCpl: 75, minCpl: text.largePrint ? 8 : 13 },
    targets,
    clicks: { steady: { on: steadyOn, windowMs: 300, radiusPx }, debounce },
    attention: { motion: { p: att.motionP, on: att.motionP >= 0.35 }, clutter: { p: att.clutterP }, structureLevel: att.structureLevel },
    baselines: {
      searchSecMedian: att.searchSecMedian,
      slipRate: r2(allSlips ?? (slipN ? slipK / slipN : base.baselines.slipRate)),
      repeatRate: r2(presses.length ? repK / presses.length : base.baselines.repeatRate),
      missRate: r2(missRate ?? base.baselines.missRate),
    },
    calibration: { version: FIT_VERSION, durationSec: Math.max(0, Math.round(raw.durationSec ?? 0)), skipped },
  };
}

/* ------------------------------------------------------------------ */
/* Views of a fit                                                      */
/* ------------------------------------------------------------------ */

const effectiveBody = (fit: FitProfile): number => fit.text.override ?? fit.text.bodyPx;

/** Coarse, diagnosis-free levels a generative model may see. */
export function summarizeFitForModel(fit: FitProfile): FitSummaryForModel {
  const F = effectiveBody(fit);
  const T = fit.targets.minPx;
  const level = fit.attention.structureLevel;
  return {
    text_need: fit.text.largePrint || F >= 22 ? 'large' : F >= 18 ? 'some' : 'none',
    target_need: T == null || T <= 24 ? 'none' : T >= 56 ? 'large' : 'some',
    clutter_tolerance: level === 2 || fit.attention.clutter.p >= 0.8 ? 'low' : level === 1 || fit.attention.clutter.p >= 0.6 ? 'medium' : 'high',
    structure_level: level,
    motion: fit.attention.motion.on ? 'reduce' : 'fine',
    polarity: fit.polarity.value,
  };
}

const px = (v: number): string => `${Math.round(v * 2) / 2} px`;

/** Rows for the "Your fit" card: what WebAble changes, from the usual web page to this fit. */
export function describeFit(fit: FitProfile): Array<{ label: string; from: string; to: string }> {
  const F = effectiveBody(fit);
  const T = fit.targets.minPx;
  const level = fit.attention.structureLevel;
  const noChange = 'No change';
  return [
    { label: 'Text size', from: '16 px', to: F > 16.5 ? px(F) : noChange },
    {
      label: 'Faint text',
      from: 'Site colours',
      to: fit.contrast.band === 'S' ? 'Strongest contrast' : fit.contrast.band === 'M' ? 'Lifted to 7:1' : 'Lifted to 4.5:1',
    },
    { label: 'Text weight', from: 'Site weight', to: fit.weight.floor >= 600 ? 'Semibold' : fit.weight.floor >= 500 ? 'Medium' : noChange },
    { label: 'Light or dark', from: 'Site colours', to: fit.polarity.value === 'dark' ? 'Dark pages' : fit.polarity.value === 'light' ? 'Light pages' : noChange },
    { label: 'Click areas', from: '24 px', to: T != null && T > 24 ? px(T) : noChange },
    { label: 'Steady clicks', from: 'Off', to: fit.clicks.steady.on ? 'On' : noChange },
    { label: 'Repeat clicks', from: 'Each one counts', to: fit.clicks.debounce ? 'Quick repeats ignored' : noChange },
    { label: 'Moving things', from: 'Moving', to: fit.attention.motion.on ? 'Paused' : noChange },
    { label: 'Busy pages', from: 'As the site shows them', to: level === 2 ? 'Calm view opens' : level === 1 ? 'Calm view offered' : noChange },
  ];
}
