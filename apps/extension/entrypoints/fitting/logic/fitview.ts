// Turning raw results into a fit, and a fit into the plain rows of the "Your fit" card.
// Core's deriveFit and describeFit are the source of truth; the local fallbacks below exist only so the
// page keeps working if core throws, and they are deliberately conservative.

import { deriveFit, describeFit, type FitProfile, type FittingRaw } from '@webable/core';
import type { Env } from './env';
import { clamp } from './rand';
import { STOPPED_MOTION } from './raw';

export const TEXT_STEPS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 64];
export const TARGET_STEPS = [24, 32, 44, 56, 72, 96];
/** What a typical page uses, the "from" side of each fit mark when core gives none. */
export const TYPICAL_BODY_PX = 16;
export const TYPICAL_TARGET_PX = 24;

export function cloneFit(fit: FitProfile): FitProfile {
  return JSON.parse(JSON.stringify(fit)) as FitProfile;
}

/** OS settings the raw format has no field for: reduced motion always turns motion reduction on. */
export function applyEnv(fit: FitProfile, env: Env | null): FitProfile {
  if (!env) return fit;
  const out = cloneFit(fit);
  if (env.reducedMotion) {
    out.attention.motion.on = true;
    out.attention.motion.p = Math.max(out.attention.motion.p, 0.92);
  }
  return out;
}

export function deriveSafely(raw: FittingRaw, env: Env | null): { fit: FitProfile; fromCore: boolean } {
  try {
    const fit = deriveFit(raw);
    if (fit && fit.v === 'fit.1') return { fit: applyEnv(fit, env), fromCore: true };
  } catch (err) {
    console.warn('[WebAble fitting] deriveFit failed; using a conservative local fit', err);
  }
  return { fit: applyEnv(fallbackFit(raw), env), fromCore: false };
}

export function effectiveTextPx(fit: FitProfile): number {
  return fit.text.override ?? fit.text.bodyPx;
}

function stepIndex(steps: number[], v: number): number {
  let best = 0;
  for (let i = 0; i < steps.length; i++) if (Math.abs((steps[i] ?? 0) - v) < Math.abs((steps[best] ?? 0) - v)) best = i;
  return best;
}

export function stepValue(steps: number[], v: number, dir: -1 | 1): number {
  const i = stepIndex(steps, v);
  const cur = steps[i] ?? v;
  // When the value sits between steps, the first press snaps to the nearest step in that direction.
  if (dir > 0 && cur > v + 0.01) return cur;
  if (dir < 0 && cur < v - 0.01) return cur;
  return steps[clamp(i + dir, 0, steps.length - 1)] ?? cur;
}

export function canStep(steps: number[], v: number, dir: -1 | 1): boolean {
  return stepValue(steps, v, dir) !== v;
}

/* ------------------------------------------------------------------ */
/* Rows for "Your fit"                                                 */
/* ------------------------------------------------------------------ */

export type RowKey =
  | 'text' | 'contrast' | 'weight' | 'polarity' | 'targets' | 'steady' | 'debounce' | 'motion' | 'busy' | 'other';

export interface FitRow {
  key: RowKey;
  label: string;
  line: string;
  from: string;
  to: string;
  changed: boolean;
}

const NO_CHANGE = 'No change';

/** describeFit's labels, mapped to the row each stepper and plain line belongs to. */
const KEY_BY_LABEL: Record<string, RowKey> = {
  'Text size': 'text',
  'Faint text': 'contrast',
  'Text weight': 'weight',
  'Light or dark': 'polarity',
  'Click areas': 'targets',
  'Steady clicks': 'steady',
  'Repeat clicks': 'debounce',
  'Moving things': 'motion',
  'Busy pages': 'busy',
};

function keyFor(label: string): RowKey {
  const exact = KEY_BY_LABEL[label];
  if (exact) return exact;
  const l = label.toLowerCase();
  if (/contrast|faint/.test(l)) return 'contrast';
  if (/weight|bold/.test(l)) return 'weight';
  if (/text|size|font/.test(l)) return 'text';
  if (/light|dark|polarity/.test(l)) return 'polarity';
  if (/steady|slip/.test(l)) return 'steady';
  if (/repeat|double/.test(l)) return 'debounce';
  if (/click|target|tap/.test(l)) return 'targets';
  if (/motion|moving|animat/.test(l)) return 'motion';
  if (/busy|clutter|layout|calm/.test(l)) return 'busy';
  return 'other';
}

/** One plain sentence per row: about the page and the clicks, never about the person's body. */
function lineFor(key: RowKey, fit: FitProfile): string {
  const text = Math.round(effectiveTextPx(fit) * 2) / 2;
  switch (key) {
    case 'text':
      return text > TYPICAL_BODY_PX + 0.5
        ? `You read most comfortably at ${text} px or larger. Smaller page text is scaled up to match.`
        : 'Text stays the size each site chose.';
    case 'contrast':
      return fit.contrast.band === 'S'
        ? 'Text is drawn at the strongest contrast the page allows.'
        : fit.contrast.band === 'M'
          ? 'Faint gray text is darkened to 7:1. Colors keep their hue.'
          : 'Only text below 4.5:1 is darkened. Colors keep their hue.';
    case 'weight':
      return fit.weight.floor >= 500 ? 'Very thin text is drawn a little heavier.' : 'Text keeps the weight each site chose.';
    case 'polarity':
      return fit.polarity.value === 'dark'
        ? 'Calm view uses light text on a dark page.'
        : fit.polarity.value === 'light'
          ? 'Calm view uses dark text on a light page.'
          : 'Pages keep their own colors.';
    case 'targets':
      return fit.targets.minPx !== null && fit.targets.minPx > TYPICAL_TARGET_PX
        ? 'Small buttons and links get a larger click area. Their look does not change.'
        : 'Click areas stay as each site made them.';
    case 'steady':
      return fit.clicks.steady.on
        ? 'A click stays on the button you pressed, even if the pointer moves a little.'
        : 'Clicks work as usual.';
    case 'debounce':
      return fit.clicks.debounce ? 'A quick second click on the same button counts once.' : 'Every click counts.';
    case 'motion':
      return fit.attention.motion.on ? 'Carousels and animations are paused.' : 'Moving things play as usual.';
    case 'busy':
      return fit.attention.structureLevel === 2
        ? 'Busy pages open in a calmer layout. The original is one click away.'
        : fit.attention.structureLevel === 1
          ? 'A calmer layout is offered on busy pages.'
          : 'Pages keep their layout. A calmer layout is there when you ask.';
    default:
      return '';
  }
}

/** Display-only wording tidy-up so the card reads in one spelling. */
const tidy = (s: string): string => s.replace(/colour/g, 'color').replace(/Colour/g, 'Color');

function px(n: number | null | undefined): string {
  return n === null || n === undefined ? NO_CHANGE : `${Math.round(n)} px`;
}

/** Rows computed locally from the fit, used only when core's describeFit is unavailable. */
function localRows(fit: FitProfile): Array<{ label: string; from: string; to: string }> {
  const text = effectiveTextPx(fit);
  const lvl = fit.attention.structureLevel;
  return [
    { label: 'Text size', from: '16 px', to: text > 16.5 ? px(text) : NO_CHANGE },
    {
      label: 'Faint text',
      from: 'Site colors',
      to: fit.contrast.band === 'S' ? 'Strongest contrast' : fit.contrast.band === 'M' ? 'Lifted to 7:1' : 'Lifted to 4.5:1',
    },
    { label: 'Light or dark', from: 'Site colors', to: fit.polarity.value === 'none' ? NO_CHANGE : `${fit.polarity.value} pages` },
    { label: 'Click areas', from: '24 px', to: (fit.targets.minPx ?? 0) > 24 ? px(fit.targets.minPx) : NO_CHANGE },
    { label: 'Steady clicks', from: 'Off', to: fit.clicks.steady.on ? 'On' : NO_CHANGE },
    { label: 'Moving things', from: 'Moving', to: fit.attention.motion.on ? 'Paused' : NO_CHANGE },
    { label: 'Busy pages', from: 'As the site shows them', to: lvl === 2 ? 'Calm view opens' : lvl === 1 ? 'Calm view offered' : NO_CHANGE },
  ];
}

export function fitRows(fit: FitProfile): FitRow[] {
  let described: Array<{ label: string; from: string; to: string }> = [];
  try {
    described = describeFit(fit) ?? [];
  } catch {
    described = [];
  }
  if (!described.length) described = localRows(fit);
  return described.map((d) => {
    const key = keyFor(d.label);
    const to = tidy(d.to);
    const from = tidy(d.from);
    return { key, label: tidy(d.label), line: lineFor(key, fit), from, to, changed: to !== NO_CHANGE && to !== from };
  });
}

export function isNoChange(s: string): boolean {
  return s === NO_CHANGE;
}

/* ------------------------------------------------------------------ */
/* Conservative local fit (only when core is unavailable)              */
/* ------------------------------------------------------------------ */

export function fallbackFit(raw: FittingRaw): FitProfile {
  const r = raw.reading;
  const plateau = r?.ladder.filter((t) => t.correct).map((t) => t.px) ?? [];
  const cps = plateau.length ? Math.min(...plateau) : null;
  const seed = r?.seedPx ?? null;
  const bodyPx = clamp(Math.round(cps ? cps * 1.26 : seed ? seed * 0.8 : 16), 12, 64);
  const faintMiss = r?.faint.some((f) => !f.correct && f.contrast >= 2.3) ?? false;
  const blocks = raw.pointing?.blocks ?? [];
  const passed = blocks
    .filter((b) => b.presses.filter((p) => !p.hit).length <= 1)
    .map((b) => b.sizePx);
  const minPx = blocks.length ? (passed.length ? Math.min(...passed) : 96) : null;
  const slips = raw.allPresses.filter((p) => p.slipped).length;
  const repeats = raw.allPresses.filter((p) => p.repeat).length;
  const got = raw.finding?.gotInWay ?? [];
  const calm = raw.finding?.preferredCalm ?? 0;
  const clutterP = clamp(0.25 + 0.2 * calm + (got.includes('too much on the page') ? 0.3 : 0), 0, 0.99);
  const motionP = clamp(0.3 + (got.includes('moving things') ? 0.3 : 0) + (got.includes(STOPPED_MOTION) ? 0.35 : 0), 0, 0.99);
  const findMs = raw.finding?.trials.filter((t) => t.found).map((t) => t.ms) ?? [];
  return {
    v: 'fit.1',
    createdAt: new Date().toISOString(),
    inputClass: raw.inputClass,
    text: {
      bodyPx,
      cpsPx: cps,
      largePrint: bodyPx >= 32,
      conf: cps ? 0.5 : seed ? 0.35 : 0.2,
      source: cps ? 'measured' : seed ? 'stated' : 'default',
      override: null,
    },
    contrast: faintMiss ? { band: 'M', floor: 7 } : { band: 'N', floor: 4.5 },
    polarity: { value: r?.polarity.stated === 'dark' ? 'dark' : 'none', stated: r?.polarity.stated ?? null },
    weight: { floor: faintMiss ? 500 : 400 },
    spacing: { lineHeight: 1.5, wordEm: 0, letterEm: 0 },
    measure: { targetCpl: 66, maxCpl: 75, minCpl: bodyPx >= 32 ? 8 : 13 },
    targets: { minPx, conf: blocks.length ? 0.4 : 0 },
    clicks: { steady: { on: slips >= 2, windowMs: 300, radiusPx: 10 }, debounce: repeats >= 3 },
    attention: {
      motion: { p: motionP, on: motionP >= 0.35 },
      clutter: { p: clutterP },
      structureLevel: clutterP >= 0.8 ? 2 : clutterP >= 0.6 ? 1 : 0,
    },
    baselines: {
      searchSecMedian: findMs.length ? Math.round((findMs.sort((a, b) => a - b)[findMs.length >> 1] ?? 0) / 100) / 10 : null,
      slipRate: raw.allPresses.length ? slips / raw.allPresses.length : 0,
      repeatRate: raw.allPresses.length ? repeats / raw.allPresses.length : 0,
      missRate: blocks.length
        ? blocks.reduce((a, b) => a + b.presses.filter((p) => !p.hit).length, 0) /
          Math.max(1, blocks.reduce((a, b) => a + b.presses.length, 0))
        : 0,
    },
    calibration: { version: 'fit-1', durationSec: raw.durationSec, skipped: raw.skipped },
  };
}
