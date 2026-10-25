// The onboarding's steps, their words, and the "What we've learned" lines (docs/design/ONBOARDING.md, "The flow").
// Pure data and functions, so the words can be checked without a browser.

import type { BrowserSettings, FitProfile, InputClass } from '@webable/core';

export type StepId = 'size' | 'truefalse' | 'faint' | 'lightdark' | 'dots' | 'find';
export type PartId = 'reading' | 'pointing' | 'finding';

export const PARTS: Array<{ id: PartId; label: string }> = [
  { id: 'reading', label: 'Reading' },
  { id: 'pointing', label: 'Pointing' },
  { id: 'finding', label: 'Finding' },
];

export const PART_OF: Record<StepId, PartId> = {
  size: 'reading',
  truefalse: 'reading',
  faint: 'reading',
  lightdark: 'reading',
  dots: 'pointing',
  find: 'finding',
};

const ORDER: StepId[] = ['size', 'truefalse', 'faint', 'lightdark', 'dots', 'find'];

/**
 * The steps this person does. Keyboard users skip the dots (WebAble never changes keyboard use). With the system's own
 * colours on, the faint word and light-or-dark steps are left out: the system's colours win, and grey text cannot be
 * shown faithfully anyway.
 */
export function planSteps(input: InputClass, settings: BrowserSettings | null): StepId[] {
  return ORDER.filter((s) => {
    if (s === 'dots') return input !== 'keyboard';
    if (s === 'faint' || s === 'lightdark') return !settings?.forcedColors;
    return true;
  });
}

export function partsFor(steps: StepId[]): Array<{ id: PartId; label: string }> {
  const used = new Set(steps.map((s) => PART_OF[s]));
  return PARTS.filter((p) => used.has(p.id));
}

export interface StepWords {
  title: string;
  /** What to do, in one sentence. */
  todo: string;
  /** What counts as success, in one sentence. */
  success: string;
}

export function wordsFor(step: StepId, input: InputClass): StepWords {
  const touch = input === 'touch';
  switch (step) {
    case 'size':
      return {
        title: 'Pick a comfortable size',
        todo: 'Make the words larger or smaller until they feel easy to read.',
        success: 'Any size is right if it feels relaxed to you.',
      };
    case 'truefalse':
      return {
        title: 'True or false?',
        todo: 'Read each short sentence and say whether it is true or false.',
        success: 'The words get smaller as you go. When you can’t read one, just say so.',
      };
    case 'faint':
      return {
        title: 'Which word is it?',
        todo: 'A word appears, a little lighter each time. Pick it from the four below it.',
        success: 'When you can’t see a word, say so. That helps as much as an answer.',
      };
    case 'lightdark':
      return {
        title: 'Light or dark?',
        todo: 'Read two sentences on a light page and two on a dark one, then pick the easier one.',
        success: 'There is no better choice, only the one that suits your eyes.',
      };
    case 'dots':
      return {
        title: touch ? 'Tap the dots' : 'Click the dots',
        todo: `${touch ? 'Tap' : 'Click'} each dot as it fills in, at your usual pace.`,
        success: 'Close is fine. A miss tells us just as much.',
      };
    case 'find':
      return {
        title: 'Find it',
        todo: `We name a link on a made-up page. ${touch ? 'Tap' : 'Click'} it when you spot it.`,
        success: 'Take your time. If it’s hard to spot, we’ll show you where it is.',
      };
  }
}

/** "Reading · 2 of 4", or just "Pointing" when the part has one step. */
export function eyebrowFor(step: StepId, steps: StepId[]): string {
  const part = PART_OF[step];
  const label = PARTS.find((p) => p.id === part)?.label ?? '';
  const inPart = steps.filter((s) => PART_OF[s] === part);
  if (inPart.length < 2) return label;
  return `${label} · ${inPart.indexOf(step) + 1} of ${inPart.length}`;
}

/** "Reading is set." when the step before this one finished a part. */
export function partSetLine(prev: StepId | null, next: StepId): string | null {
  if (!prev || PART_OF[prev] === PART_OF[next]) return null;
  const label = PARTS.find((p) => p.id === PART_OF[prev])?.label ?? '';
  return `${label} is set.`;
}

/* ------------------------------------------------------------------ */
/* What we've learned                                                  */
/* ------------------------------------------------------------------ */

export type LineId = 'text' | 'faint' | 'colours' | 'buttons' | 'steady' | 'motion' | 'busy';

export interface LearnedLine {
  id: LineId;
  label: string;
  /** The usual value, shown before an arrow ("16"), when WebAble changes it. */
  from: string | null;
  value: string;
  /** WebAble changes something here (the value shows in the accent colour). */
  changed: boolean;
}

const halfPx = (v: number): string => `${Math.round(v * 2) / 2} px`;

/** The rail lines one finished step adds (or refreshes, for the text size). */
export function linesFor(step: StepId, fit: FitProfile): LearnedLine[] {
  switch (step) {
    case 'size':
    case 'truefalse': {
      const px = fit.text.override ?? fit.text.bodyPx;
      return px > 16.25
        ? [{ id: 'text', label: 'Text', from: '16', value: halfPx(px), changed: true }]
        : [{ id: 'text', label: 'Text', from: null, value: 'as it is', changed: false }];
    }
    case 'faint': {
      const b = fit.contrast.band;
      return [{ id: 'faint', label: 'Faint text', from: null, value: b === 'S' ? 'darkest' : b === 'M' ? 'darker' : 'as it is', changed: b !== 'N' }];
    }
    case 'lightdark': {
      const v = fit.polarity.value;
      return [{ id: 'colours', label: 'Pages', from: null, value: v === 'dark' ? 'dark' : v === 'light' ? 'light' : 'as the site', changed: v !== 'none' }];
    }
    case 'dots': {
      const T = fit.targets.minPx;
      return [
        T != null && T > 24
          ? { id: 'buttons', label: 'Buttons', from: null, value: `${T} px`, changed: true }
          : { id: 'buttons', label: 'Buttons', from: null, value: 'as they are', changed: false },
        { id: 'steady', label: 'Steady clicks', from: null, value: fit.clicks.steady.on ? 'on' : 'off', changed: fit.clicks.steady.on },
      ];
    }
    case 'find':
      return [
        { id: 'motion', label: 'Moving things', from: null, value: fit.attention.motion.on ? 'paused' : 'left alone', changed: fit.attention.motion.on },
        // Simplified busy pages apply to everyone.
        { id: 'busy', label: 'Busy pages', from: null, value: 'simplified', changed: true },
      ];
  }
}

/** Merge new lines into the rail: a line with the same id is refreshed in place, new ones go to the end. */
export function mergeLines(rail: LearnedLine[], add: LearnedLine[]): LearnedLine[] {
  const out = rail.slice();
  for (const l of add) {
    const i = out.findIndex((x) => x.id === l.id);
    if (i >= 0) out[i] = l;
    else out.push(l);
  }
  return out;
}

/** F3's chips, and the words core reads from them. */
export const IN_THE_WAY: Array<{ id: string; label: string }> = [
  { id: 'moving things', label: 'Moving things' },
  { id: 'popups', label: 'Pop-ups' },
  { id: 'too much on the page', label: 'Too much on the page' },
  { id: 'small text', label: 'Small text' },
];
