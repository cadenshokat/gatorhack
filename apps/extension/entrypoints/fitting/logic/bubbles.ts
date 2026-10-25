// Pop the bubbles: three target sizes at varied distances.
// Misses and spread come from pointing.ts. Re-entries and very short gaps are counted here.
// Those set the smallest comfortable tap, steadier clicks, and a short pause between double taps.

import { blockStats, type RingPress } from './pointing';

export const BUBBLE_SIZES = [72, 44, 24] as const;
export type BubbleSize = (typeof BUBBLE_SIZES)[number];

export interface BubbleTap {
  sizePx: BubbleSize;
  dx: number;
  dy: number;
  hit: boolean;
  slipped: boolean;
  /** Pointer left the bubble and came back before the finger went up. */
  reentries: number;
  holdMs: number;
  /** Time since the previous tap. Short gaps suggest a double tap. */
  gapMs: number;
  via: 'pointer' | 'key';
}

export interface BubbleBlock {
  sizePx: number;
  presses: RingPress[];
}

export interface BubbleSummary {
  minPx: number | null;
  steady: boolean;
  debounce: boolean;
  blocks: BubbleBlock[];
}

function toPress(t: BubbleTap): RingPress {
  return { dx: t.dx, dy: t.dy, hit: t.hit, slipped: t.slipped };
}

/** What to show next, and whether the sizes already tell us enough. */
export function nextBubble(taps: readonly BubbleTap[]): { size: BubbleSize; done: boolean; reason: 'sure' | 'max' | null } {
  const pointer = taps.filter((t) => t.via === 'pointer');
  if (pointer.length === 0 && taps.length >= 8) return { size: 72, done: true, reason: 'max' };
  for (const size of BUBBLE_SIZES) {
    const mine = pointer.filter((t) => t.sizePx === size);
    if (mine.length === 0) return { size, done: false, reason: null };
    const stats = blockStats(size, mine.map(toPress));
    if (mine.length >= 4 && stats.pass) {
      if (size === 24) return { size, done: true, reason: 'sure' };
      continue;
    }
    if (mine.length >= 4 && !stats.pass) return { size, done: true, reason: 'sure' };
    if (mine.length >= 8) {
      if (size === 24) return { size, done: true, reason: 'max' };
      continue;
    }
    return { size, done: false, reason: null };
  }
  return { size: 24, done: true, reason: 'max' };
}

/**
 * Smallest size that stayed accurate, with no miss-heavy size above it.
 * Steadier clicks when taps slip, the pointer re-enters, or the spread is wide.
 * A short pause between clicks when several taps land on top of each other.
 */
export function summarizeBubbles(taps: readonly BubbleTap[]): BubbleSummary {
  const pointer = taps.filter((t) => t.via === 'pointer');
  const blocks: Array<BubbleBlock & { pass: boolean; sigmaAbs: number }> = [];
  for (const sizePx of BUBBLE_SIZES) {
    const mine = pointer.filter((t) => t.sizePx === sizePx);
    if (!mine.length) continue;
    const presses = mine.map(toPress);
    const stats = blockStats(sizePx, presses);
    blocks.push({ sizePx, presses, pass: stats.pass, sigmaAbs: stats.sigmaAbs });
  }

  let minPx: number | null = null;
  if (blocks.length) {
    const failed = blocks.filter((b) => !b.pass).map((b) => b.sizePx);
    const maxFailed = failed.length ? Math.max(...failed) : -Infinity;
    const passed = blocks.filter((b) => b.pass && b.sizePx > maxFailed).map((b) => b.sizePx);
    if (passed.length) minPx = Math.min(...passed);
    else if (failed.length) minPx = 96;
  }

  const n = pointer.length;
  const slips = pointer.filter((t) => t.slipped || !t.hit).length;
  const reentries = pointer.filter((t) => t.reentries > 0).length;
  const jitter = blocks.some((b) => b.sigmaAbs > 8 && b.presses.length >= 4);
  const steady = n >= 8 && (slips / n >= 0.12 || reentries / n >= 0.25 || jitter);
  const repeats = pointer.filter((t) => t.gapMs > 0 && t.gapMs < 350).length;
  const debounce = n >= 8 && repeats >= 3;
  return {
    minPx,
    steady,
    debounce,
    blocks: blocks.map((b) => ({ sizePx: b.sizePx, presses: b.presses })),
  };
}
