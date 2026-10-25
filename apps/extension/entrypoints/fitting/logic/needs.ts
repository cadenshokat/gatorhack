// How much WebAble helps with each need, from 0 to 100. Longer petals mean more help.
// The eight needs are the results chart. Scores describe the fit, never a condition.

import type { FitProfile } from '@webable/core';
import { effectiveTextPx } from './fitview';
import type { ColourNeed } from './colour';

export const NEED_IDS = [
  'small_text',
  'faint_text',
  'small_buttons',
  'steady_clicking',
  'moving_things',
  'busy_pages',
  'long_reading',
  'telling_colours',
] as const;

export type NeedId = (typeof NEED_IDS)[number];

/**
 * Optional measurements the shared fit does not store yet.
 * Saved on the fit object (storage keeps unknown fields) until they can live on FitProfile.
 * - `topWpm`: fastest reading speed in the reading game, words per minute.
 * - `readingSupport`: true when that speed is under 100 words per minute.
 * - `colourNeed`: crossings from the colour-ordering game, and a 0–100 help score.
 * - `colourAssist`: when false, the person turned off labels and patterns for colour. Absent means the score stands.
 */
export interface OnboardingExtras {
  topWpm?: number;
  readingSupport?: boolean;
  colourNeed?: ColourNeed;
  colourAssist?: boolean;
}

export interface NeedScore {
  id: NeedId;
  score: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round = (n: number): number => Math.round(clamp(n, 0, 100));

export function textHelp(px: number): number {
  if (px <= 16.5) return 8;
  if (px >= 40) return 100;
  const t = (px - 16) / 24;
  return round(5 + Math.sqrt(Math.min(1, Math.max(0, t))) * 95);
}

export function buttonHelp(minPx: number | null): number {
  if (minPx == null || minPx <= 24) return 8;
  if (minPx >= 96) return 100;
  return round(28 + ((minPx - 24) / 72) * 72);
}

export function readingHelp(extra: OnboardingExtras | null | undefined, largePrint: boolean, lineHeight = 1.5): number {
  if (extra?.readingSupport) return 80;
  if (lineHeight >= 1.75 || largePrint) return 72;
  if (lineHeight >= 1.58) return 55;
  const wpm = extra?.topWpm;
  if (wpm != null && Number.isFinite(wpm)) {
    return round(8 + Math.min(1, Math.max(0, (240 - wpm) / 180)) * 74);
  }
  return 8;
}

export type HelpLevel = 'high' | 'medium' | 'low' | 'none';

/** A lot, Some, A little, or Not needed. */
export function helpLevel(score: number): HelpLevel {
  if (score >= 75) return 'high';
  if (score >= 48) return 'medium';
  if (score >= 22) return 'low';
  return 'none';
}

export function needScores(fit: FitProfile, extra?: OnboardingExtras | null): NeedScore[] {
  const px = effectiveTextPx(fit);
  const band = fit.contrast.band;
  const faint = band === 'S' ? 92 : band === 'M' ? 62 : 12;
  const motion = fit.attention.motion.on
    ? Math.max(62, Math.round(fit.attention.motion.p * 100))
    : Math.round(fit.attention.motion.p * 100);
  let busy = Math.round(fit.attention.clutter.p * 100);
  if (fit.attention.structureLevel >= 2) busy = Math.max(busy, 80);
  else if (fit.attention.structureLevel === 1) busy = Math.max(busy, 55);
  const colour = extra?.colourAssist === false ? 0 : (extra?.colourNeed?.score ?? 6);
  const steady = fit.clicks.steady.on && fit.clicks.debounce ? 88 : fit.clicks.steady.on ? 62 : 6;
  return [
    { id: 'small_text', score: textHelp(px) },
    { id: 'faint_text', score: faint },
    { id: 'small_buttons', score: buttonHelp(fit.targets.minPx) },
    { id: 'steady_clicking', score: steady },
    { id: 'moving_things', score: round(motion) },
    { id: 'busy_pages', score: round(busy) },
    { id: 'long_reading', score: readingHelp(extra, fit.text.largePrint, fit.spacing.lineHeight) },
    { id: 'telling_colours', score: colour },
  ];
}

function byHelp(a: NeedScore, b: NeedScore): number {
  return b.score - a.score || NEED_IDS.indexOf(a.id) - NEED_IDS.indexOf(b.id);
}

/**
 * Up to four rows, strongest help first.
 * Medium and high only, unless fewer than two qualify: then the strongest low row is added.
 * When nothing is above low, the list is empty and the results page says most pages already work.
 */
export function topBenefits(scores: readonly NeedScore[]): NeedScore[] {
  const ranked = [...scores].sort(byHelp);
  const strong = ranked.filter((s) => {
    const level = helpLevel(s.score);
    return level === 'high' || level === 'medium';
  });
  if (strong.length === 0) return [];
  const picked = strong.slice(0, 4);
  if (picked.length >= 2) return picked;
  const low = ranked.find((s) => helpLevel(s.score) === 'low');
  return low ? [...picked, low] : picked;
}

export function extrasOf(fit: Partial<OnboardingExtras> | null | undefined): OnboardingExtras {
  if (!fit) return {};
  const out: OnboardingExtras = {};
  if (fit.topWpm != null) out.topWpm = fit.topWpm;
  if (fit.readingSupport != null) out.readingSupport = fit.readingSupport;
  if (fit.colourNeed) out.colourNeed = fit.colourNeed;
  if (fit.colourAssist != null) out.colourAssist = fit.colourAssist;
  return out;
}
