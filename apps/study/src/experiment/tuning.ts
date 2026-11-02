// Setting WebAble up for the person (protocol 4.0.0), in place of the long warm-up: what gets in their way on
// websites, a comfortable text size (the onboarding's own size step), light or dark, and how they like to read. The
// answers change the fit the engine uses and give the AI a short description of how this person likes to read (the
// same ReaderProfile the extension builds from what a person's AI assistant knows about them). Pure, so tests can
// drive it.

import type { FitProfile, ReaderPoint, ReaderProfile } from '@webable/core';
import type { TapBaseline } from '../contracts';

/** What gets in the person's way on websites (any number). */
export type Need = 'small_text' | 'tap_wrong' | 'busy' | 'motion' | 'long_text';
export const NEEDS: readonly Need[] = ['small_text', 'tap_wrong', 'busy', 'motion', 'long_text'];

export type Shape = 'steps' | 'points' | 'paragraphs';
export type Words = 'plain' | 'as_is';

export interface SetupAnswers {
  needs: Need[];
  polarity: 'light' | 'dark';
  shape: Shape;
  words: Words;
}

/** Bigger buttons: the onboarding's touch ladder (44, 56, 72, 96). */
const TARGET_LARGER = 56;
const TARGET_LARGEST = 72;
/** Tapping beside a button this often on the study's own screens counts as needing the larger step. */
const MISS_RATE_LARGEST = 0.1;

/**
 * The fit after the set-up answers. The size step's measured text size stands; the answers add what a short
 * measurement cannot: bigger buttons and steady taps for "I tap the wrong thing", the simplified page sooner for busy
 * or wordy pages, motion stopped, light or dark. The person's own tapping on the study's screens (the baseline) sets
 * how much bigger, and is what the AI compares their tapping on the websites with.
 */
export function tuneFit(base: FitProfile, a: SetupAnswers, baseline: TapBaseline | null): FitProfile {
  const fit: FitProfile = structuredClone(base);
  const missRate = baseline && baseline.taps >= 8 ? baseline.misses / baseline.taps : null;
  if (a.needs.includes('tap_wrong') || (missRate !== null && missRate >= MISS_RATE_LARGEST)) {
    const want = missRate !== null && missRate >= MISS_RATE_LARGEST ? TARGET_LARGEST : TARGET_LARGER;
    fit.targets = { minPx: Math.max(fit.targets.minPx ?? 0, want), conf: Math.max(fit.targets.conf, 0.6) };
    fit.clicks = { ...fit.clicks, steady: { ...fit.clicks.steady, on: true } };
  }
  if (a.needs.includes('busy')) {
    fit.attention = { ...fit.attention, structureLevel: 2, clutter: { p: Math.max(fit.attention.clutter.p, 0.85) } };
  } else if (a.needs.includes('long_text')) {
    fit.attention = {
      ...fit.attention,
      structureLevel: Math.max(fit.attention.structureLevel, 1) as FitProfile['attention']['structureLevel'],
      clutter: { p: Math.max(fit.attention.clutter.p, 0.65) },
    };
  }
  if (a.needs.includes('motion')) fit.attention = { ...fit.attention, motion: { p: 0.9, on: true } };
  fit.polarity = { value: a.polarity, stated: a.polarity };
  if (baseline && baseline.taps >= 8) {
    fit.baselines = {
      ...fit.baselines,
      missRate: Math.round((baseline.misses / baseline.taps) * 1000) / 1000,
      repeatRate: Math.round((baseline.repeats / baseline.taps) * 1000) / 1000,
    };
  }
  return fit;
}

const point = (id: number, kind: ReaderPoint['kind'], says: string, evidence: string): ReaderPoint => ({
  id: `r${id}`, kind, says, evidence, support: 1, on: true,
});

/** How this person likes to read, for the AI that rewrites pages. Said in the person's terms; never a condition. */
export function readerFor(a: SetupAnswers, now: Date = new Date()): ReaderProfile {
  const plain = a.words === 'plain';
  const points: ReaderPoint[] = [];
  const shapeWords = { steps: 'steps', points: 'short points', paragraphs: 'paragraphs' }[a.shape];
  points.push(point(1, 'format', `You like information as ${shapeWords}.`, `How do you like information? ${shapeWords[0]!.toUpperCase()}${shapeWords.slice(1)}.`));
  if (plain) {
    points.push(point(2, 'words', 'You like plain, everyday words.', 'How should websites be written for you? Plain and short.'));
    points.push(point(3, 'length', 'You like things short, with the main point first.', 'How should websites be written for you? Plain and short.'));
  } else {
    points.push(point(2, 'words', 'You are happy with the words the website uses.', 'How should websites be written for you? As the website wrote it.'));
    points.push(point(3, 'length', 'You do not need things made shorter.', 'How should websites be written for you? As the website wrote it.'));
  }
  if (a.needs.includes('long_text')) {
    points.push(point(4, 'length', 'Long pages full of words get in your way.', 'What gets in your way on websites? Long pages full of words.'));
  }
  const headline = `${shapeWords[0]!.toUpperCase()}${shapeWords.slice(1)}${plain ? ', in plain, short words' : ', in the website’s own words'}.`;
  return {
    v: 'reader.1',
    createdAt: now.toISOString(),
    source: 'your answers',
    headline,
    points,
    level: plain ? 'plain' : 'everyday',
    length: plain || a.needs.includes('long_text') ? 'shorter' : 'as_is',
    shape: a.shape === 'steps' ? 'steps' : a.shape === 'points' ? 'bullets' : 'prose',
    answerFirst: plain,
  };
}

/** The "WebAble is set up for you" list: what will change, in the person's terms, from what they told us. */
export function setupSummary(fit: FitProfile, a: SetupAnswers, live: boolean): string[] {
  const out: string[] = [];
  if (fit.text.bodyPx > 16.5) out.push('Larger text, at the size you picked');
  else out.push('Text at the size you picked');
  if ((fit.targets.minPx ?? 0) >= TARGET_LARGER) out.push('Bigger buttons and links, easier to tap');
  if (a.needs.includes('busy') || a.needs.includes('long_text')) out.push('Busy pages become a clean, simple page');
  else out.push('Very busy pages become a clean, simple page');
  if (a.needs.includes('motion')) out.push('Videos and moving things stopped');
  if (a.polarity === 'dark') out.push('Dark pages with light text');
  if (live) {
    const shape = { steps: 'steps', points: 'short points', paragraphs: 'clear paragraphs' }[a.shape];
    out.push(a.words === 'plain' ? `Long text rewritten as ${shape}, in plain words` : `Long text laid out as ${shape}`);
    out.push('If you have trouble on a page, WebAble offers help');
  }
  return out;
}

/**
 * Learning between websites: help the person said yes to on one website is kept for the next ones (the extension
 * keeps the same choices for every site). Returns the new fit and what changed, or null when nothing did.
 */
export function learnFromOffers(fit: FitProfile, accepted: string[]): { fit: FitProfile; learned: string[] } | null {
  const next: FitProfile = structuredClone(fit);
  const learned: string[] = [];
  for (const kind of new Set(accepted)) {
    if (kind === 'bigger_targets') {
      const now = next.targets.minPx ?? 44;
      const T = [56, 72, 96].find((x) => x > now) ?? 96;
      next.targets = { minPx: T, conf: Math.max(next.targets.conf, 0.7) };
      learned.push('bigger_targets');
    } else if (kind === 'larger_text') {
      next.text = { ...next.text, bodyPx: Math.round(next.text.bodyPx * 1.15 * 2) / 2 };
      learned.push('larger_text');
    } else if (kind === 'steady_clicks' && !next.clicks.steady.on) {
      next.clicks = { ...next.clicks, steady: { ...next.clicks.steady, on: true } };
      learned.push('steady_clicks');
    } else if (kind === 'debounce' && !next.clicks.debounce) {
      next.clicks = { ...next.clicks, debounce: true };
      learned.push('debounce');
    } else if (kind === 'calm_view' && next.attention.structureLevel < 2) {
      next.attention = { ...next.attention, structureLevel: 2, clutter: { p: Math.max(next.attention.clutter.p, 0.85) } };
      learned.push('calm_view');
    }
  }
  return learned.length ? { fit: next, learned } : null;
}
