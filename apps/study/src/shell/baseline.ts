// The tap baseline (protocol 4.0.0): how the person taps on the study's own question screens before any website.
// Every person sees the same simple screens, so this is a fair baseline of their speed and accuracy, measured during
// ordinary use rather than in a separate test (pointing measured during ordinary use matches lab measures: Gajos,
// Reinecke & Herrmann, CHI 2012). Only positions, times and counts; never what was chosen.

import type { TapBaseline } from '../contracts';

const TAPPABLE = 'button, a[href], input, textarea, select, label, [role="radio"], [role="checkbox"], [role="button"]';
const NEAR_PX = 24;
const REPEAT_MS = 500;
const REPEAT_PX = 30;

interface State {
  on: boolean;
  screens: number;
  taps: number;
  misses: number;
  nearMisses: number;
  repeats: number;
  changes: number;
  answerMs: number[];
  offCentre: number[];
  screenAt: number;
  answered: boolean;
  lastAnswer: Element | null;
  last: { t: number; x: number; y: number } | null;
}

const s: State = {
  on: false, screens: 0, taps: 0, misses: 0, nearMisses: 0, repeats: 0, changes: 0, answerMs: [], offCentre: [],
  screenAt: 0, answered: false, lastAnswer: null, last: null,
};

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const v = [...xs].sort((a, b) => a - b);
  const m = v.length >> 1;
  return Math.round(v.length % 2 ? (v[m] as number) : ((v[m - 1] as number) + (v[m] as number)) / 2);
};

function nearestPx(x: number, y: number): number | null {
  let best: number | null = null;
  for (const el of document.querySelectorAll(TAPPABLE)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const d = Math.hypot(dx, dy);
    if (best === null || d < best) best = d;
  }
  return best;
}

function onDown(e: PointerEvent): void {
  if (!s.on || !e.isPrimary) return;
  const now = performance.now();
  s.taps++;
  if (s.last && now - s.last.t <= REPEAT_MS && Math.hypot(e.clientX - s.last.x, e.clientY - s.last.y) <= REPEAT_PX) s.repeats++;
  s.last = { t: now, x: e.clientX, y: e.clientY };
  const target = e.target instanceof Element ? e.target.closest(TAPPABLE) : null;
  if (!target) {
    s.misses++;
    const d = nearestPx(e.clientX, e.clientY);
    if (d !== null && d <= NEAR_PX) s.nearMisses++;
    return;
  }
  // An answer button (full-width rows): how far from its middle, top to bottom; and how long the question took.
  if (target.matches('.st-choice')) {
    const r = target.getBoundingClientRect();
    s.offCentre.push(Math.abs(e.clientY - (r.top + r.height / 2)));
    if (!s.answered) {
      s.answered = true;
      s.answerMs.push(now - s.screenAt);
    }
    if (target.getAttribute('role') === 'radio' && s.lastAnswer && s.lastAnswer !== target && s.lastAnswer.isConnected) s.changes++;
    if (target.getAttribute('role') === 'radio') s.lastAnswer = target;
  }
}

/** Start measuring (once, at the study's start). */
export function startBaseline(): void {
  if (s.on) return;
  s.on = true;
  s.screenAt = performance.now();
  window.addEventListener('pointerdown', onDown, true);
}

/** A new question screen opened (ui.tsx Screen calls this). */
export function baselineScreen(): void {
  if (!s.on) return;
  s.screens++;
  s.screenAt = performance.now();
  s.answered = false;
  s.lastAnswer = null;
}

/** Stop at the first website: what was measured so far. */
export function stopBaseline(): TapBaseline {
  s.on = false;
  window.removeEventListener('pointerdown', onDown, true);
  return baselineNow();
}

export function baselineNow(): TapBaseline {
  return {
    screens: s.screens,
    taps: s.taps,
    misses: s.misses,
    nearMisses: s.nearMisses,
    repeats: s.repeats,
    changes: s.changes,
    medianAnswerMs: median(s.answerMs),
    medianOffCentrePx: median(s.offCentre),
  };
}
