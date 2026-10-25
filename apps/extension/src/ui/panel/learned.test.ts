// Owner: F. "What helps you": rows, sources, confidence dots, learned offers and the demo week, from the passive state.
import { describe, expect, it } from 'vitest';
import type { DimensionBelief, FitDimension, PassiveEvidence, PassiveFitState } from '@webable/core';
import { demoWeek } from '../../../entrypoints/popup/data';
import { primaryLabel } from '../offers/OfferCard';
import {
  actionFact,
  confidenceOf,
  DIM_ORDER,
  evidenceLines,
  feedbackNote,
  hasWarmup,
  helpRows,
  isPassiveOffer,
  learnedChip,
  offerDim,
  offerFact,
  periodOf,
  relDay,
  settingsLine,
  sourceChip,
} from './learned';
import { warmupLabel } from './Panel';
import { EMPTY_HELPS, FEEDBACK_NOTE, HOW_IT_LEARNS, withNoted } from './WhatHelps';

// Saturday Oct 24 2026, 3 pm local time.
const NOW = new Date(2026, 9, 24, 15, 0, 0);
const at = (daysBack: number, hour = 10) => new Date(2026, 9, 24 - daysBack, hour, 0, 0).toISOString();

function belief(dim: FitDimension, b: Partial<DimensionBelief> = {}): DimensionBelief {
  return {
    dim, p: 0.1, value: null, source: 'default', action: 'none', explanation: '', evidence: [], locked: false, sites: 0, days: 0,
    updatedAt: NOW.toISOString(), ...b,
  };
}

function state(beliefs: Partial<Record<FitDimension, Partial<DimensionBelief>>>): PassiveFitState {
  const all = {} as Record<FitDimension, DimensionBelief>;
  for (const d of DIM_ORDER) all[d] = belief(d, beliefs[d]);
  return { v: 'passive.1', settings: null, beliefs: all, updatedAt: NOW.toISOString() };
}

const zoom = (site: string, pct: number, daysBack: number): PassiveEvidence => ({
  dim: 'text_size', weight: 0.9, what: `You zoomed in to ${pct}% on ${site}`, site, at: at(daysBack), layer: 'usual', value: 16 * (pct / 100),
});

const WEEK = state({
  text_size: {
    p: 0.96, value: 22, source: 'learned', action: 'apply', sites: 4, days: 3,
    explanation: 'Text is larger because you zoomed in on 4 sites this week (average 140%).',
    evidence: [zoom('cnn.com', 133, 0), zoom('nytimes.com', 125, 1), zoom('medicare.gov', 150, 1), zoom('cvs.com', 133, 2)],
  },
  targets: { p: 0.82, value: 44, source: 'learned', action: 'offer', sites: 3, days: 2, explanation: '7 of your last 80 clicks landed just beside a button.' },
  motion: {
    p: 1, source: 'setting', action: 'apply', explanation: 'Motion is paused because your Mac is set to Reduce motion.',
    evidence: [{ dim: 'motion', weight: 3, what: 'Your Mac is set to Reduce motion', at: at(0), layer: 'usual' }],
  },
  clutter: { p: 0.5, source: 'learned', action: 'ask', explanation: 'You closed pop-ups on 2 news sites today.' },
  contrast: { p: 0.2, source: 'learned', action: 'none', explanation: 'Should not show.' },
});

describe('what helps you: rows', () => {
  it('lists one row per need that is not "none": on first, then suggested, then questions', () => {
    const rows = helpRows(WEEK, NOW, true);
    expect(rows.map((r) => r.dim)).toEqual(['text_size', 'motion', 'targets', 'clutter']);
    expect(rows.map((r) => r.status)).toEqual(['on', 'on', 'suggested', 'asking']);
    expect(rows[0]!.sentence).toBe('Text is larger because you zoomed in on 4 sites this week (average 140%).');
    expect(rows[0]!.value).toBe('22 px');
  });
  it('has nothing to show without a state', () => {
    expect(helpRows(null, NOW)).toEqual([]);
    expect(helpRows(state({}), NOW)).toEqual([]);
  });
  it('offers "Use this" only where the need is not on yet; every row can be corrected and forgotten', () => {
    const rows = helpRows(WEEK, NOW);
    const byDim = Object.fromEntries(rows.map((r) => [r.dim, r]));
    expect(byDim.text_size!.canConfirm).toBe(false);
    expect(byDim.targets!.canConfirm).toBe(true);
    expect(rows.every((r) => r.canNotRight && r.canForget)).toBe(true);
  });
  it('says what a suggestion would change when the engine gave only the fact', () => {
    const rows = helpRows(WEEK, NOW);
    const byDim = Object.fromEntries(rows.map((r) => [r.dim, r]));
    expect(byDim.targets!.sentence).toBe('7 of your last 80 clicks landed just beside a button. Bigger click areas may help.');
    expect(byDim.clutter!.sentence).toBe('You closed pop-ups on 2 news sites today. Calm view may help on busy pages.');
    expect(byDim.text_size!.sentence).not.toMatch(/may help/);
    const asked = helpRows(state({ text_size: { p: 0.5, source: 'learned', action: 'ask', explanation: 'Would larger text help?' } }), NOW);
    expect(asked[0]!.sentence).toBe('Would larger text help?');
  });
  it('falls back to a plain sentence when the engine gave none', () => {
    const rows = helpRows(state({ targets: { p: 0.95, value: 48, source: 'learned', action: 'apply' } }), NOW);
    expect(rows[0]!.sentence).toBe('Click areas are at least 48 px.');
  });
  it('keeps a row the person just corrected in place while its note shows', () => {
    const rows = helpRows(WEEK, NOW);
    const gone = rows[1]!;
    const live = rows.filter((r) => r.dim !== gone.dim);
    const kept = withNoted(live, { [gone.dim]: { text: FEEDBACK_NOTE.forget, row: gone, index: 1, at: Date.now() } });
    expect(kept.map((r) => r.dim)).toEqual(rows.map((r) => r.dim));
  });

  it('says what a correction really did: learning turned down or cleared, a setting turned off but never changed', () => {
    const rows = helpRows(WEEK, NOW, true);
    const text = rows.find((r) => r.dim === 'text_size')!;
    const motion = rows.find((r) => r.dim === 'motion')!;
    expect(feedbackNote(text, 'not_right')).toBe(FEEDBACK_NOTE.not_right);
    expect(feedbackNote(text, 'forget')).toBe(FEEDBACK_NOTE.forget);
    expect(feedbackNote(motion, 'not_right')).toBe('Turned off on every site. Your Mac settings are unchanged.');
    expect(feedbackNote({ source: 'setting', chip: 'From your Chrome settings' }, 'forget')).toBe(
      'Turned off on every site. Your Chrome settings are unchanged.',
    );
    expect(feedbackNote({ source: 'setting', chip: 'From your device' }, 'forget')).toMatch(/Your device settings are unchanged/);
    expect(feedbackNote({ source: 'warmup', chip: 'From your warm-up' }, 'not_right')).toMatch(/new warm-up/);
    expect(feedbackNote({ source: 'person', chip: 'You set this' }, 'forget')).toMatch(/Your choice/);
    for (const r of rows) expect(feedbackNote(r, 'confirm')).toBe(FEEDBACK_NOTE.confirm);
  });
});

describe('what helps you: sources and confidence', () => {
  it('names where each need came from', () => {
    expect(sourceChip(WEEK.beliefs.text_size, NOW)).toBe('Learned on 4 sites this week');
    expect(sourceChip(WEEK.beliefs.motion, NOW, true)).toBe('From your Mac settings');
    expect(sourceChip(belief('text_size', { source: 'setting', explanation: 'Text starts at 20 px because Chrome’s default font size is 20 px.' }), NOW, true)).toBe(
      'From your Chrome settings',
    );
    expect(sourceChip(belief('targets', { source: 'setting', evidence: [{ dim: 'targets', weight: 3, what: 'Your main pointer is a touch screen', at: at(0), layer: 'usual' }] }), NOW)).toBe(
      'From your device',
    );
    expect(sourceChip(belief('contrast', { source: 'setting' }), NOW, false)).toBe("From your computer's settings");
    expect(sourceChip(belief('contrast', { source: 'warmup' }), NOW)).toBe('From your warm-up');
    expect(sourceChip(belief('steady_clicks', { source: 'person', locked: true }), NOW)).toBe('You set this');
  });
  it('says how recent and how wide the learning is', () => {
    expect(learnedChip(belief('text_size', { source: 'learned', sites: 2, evidence: [zoom('cnn.com', 133, 0), zoom('drugs.com', 125, 0)] }), NOW)).toBe(
      'Learned on 2 sites today',
    );
    expect(learnedChip(belief('text_size', { source: 'learned', sites: 0, evidence: [zoom('cnn.com', 133, 1)] }), NOW)).toBe('Learned on 1 site since yesterday');
    expect(learnedChip(belief('text_size', { source: 'learned' }), NOW)).toBe('Learned from what you did');
    expect(periodOf([zoom('a.com', 125, 11)], NOW)).toBe('in the last 12 days');
  });
  it('shows confidence as filled dots, never a percentage', () => {
    expect(confidenceOf({ p: 0.95, source: 'learned', locked: false }).dots).toBe(4);
    expect(confidenceOf({ p: 0.8, source: 'learned', locked: false })).toEqual({ dots: 3, sure: 'Fairly sure' });
    expect(confidenceOf({ p: 0.5, source: 'learned', locked: false }).dots).toBe(2);
    expect(confidenceOf({ p: 0.1, source: 'learned', locked: false }).dots).toBe(1);
    expect(confidenceOf({ p: 0.2, source: 'setting', locked: false }).dots).toBe(4);
    expect(confidenceOf({ p: 0.2, source: 'person', locked: true }).dots).toBe(4);
    for (const r of helpRows(WEEK, NOW)) expect(`${r.sure} ${r.chip} ${r.statusLabel}`).not.toMatch(/%|\d\.\d/);
  });
  it('reads days in plain words', () => {
    expect(relDay(at(0), NOW)).toBe('today');
    expect(relDay(at(1), NOW)).toBe('yesterday');
    expect(relDay(at(3), NOW)).toBe('Wednesday');
    expect(relDay(at(12), NOW)).toBe('Oct 12');
    expect(relDay('not a date', NOW)).toBe('');
  });
  it('summarises what it read from Chrome and the system', () => {
    const s = { ...WEEK, settings: { defaultFontPx: 20, minFontPx: null, defaultZoom: 1.25, siteZooms: [], reducedMotion: true, contrastMore: false, forcedColors: false, colorScheme: 'light' as const, reducedTransparency: false, languages: ['en-US'], pointer: 'fine' as const, anyHover: true } };
    expect(settingsLine(s, true)).toBe('From Chrome and your Mac: 20 px default text, 125% default zoom, Reduce motion.');
    expect(settingsLine({ ...s, settings: { ...s.settings, defaultFontPx: 16, defaultZoom: 1, reducedMotion: false } })).toBeNull();
  });
});

describe('learned offers', () => {
  const offer = { kind: 'larger_text' as const, question: 'Make text larger on every site?', fact: 'You zoomed in on 2 sites today.', why: '', p: 0.82 };
  it('tells learned offers from this page’s struggle offers', () => {
    expect(isPassiveOffer(offer)).toBe(true);
    expect(isPassiveOffer({ question: 'Would larger text help on every site?' })).toBe(true);
    expect(isPassiveOffer({ question: 'Make buttons bigger on this page?' })).toBe(false);
  });
  it('labels the yes button with the action, short enough for one line (the question says "every site")', () => {
    expect(primaryLabel(offer)).toBe('Make larger');
    expect(primaryLabel({ ...offer, kind: 'bigger_targets', question: 'Make buttons bigger on every site?' })).toBe('Make bigger');
    expect(primaryLabel({ ...offer, kind: 'steady_clicks', question: 'Turn on steady clicks on every site?' })).toBe('Turn on');
    for (const k of ['larger_text', 'bigger_targets', 'steady_clicks'] as const) {
      expect(primaryLabel({ ...offer, kind: k }).length).toBeLessThanOrEqual(12);
    }
  });
  it('keeps a fact that names what the person did, else builds one from the evidence', () => {
    const b = WEEK.beliefs.text_size;
    expect(offerFact(offer, b, NOW)).toBe('You zoomed in on 2 sites today.');
    expect(offerFact({ fact: 'Text on these pages is small.' }, b, NOW)).toBe('You zoomed in on 4 sites this week.');
    const clicks = belief('targets', {
      source: 'learned', sites: 2,
      evidence: [
        { dim: 'targets', weight: 2, what: '5 of 22 clicks on cvs.com landed just beside a button', site: 'cvs.com', at: at(2), layer: 'usual' },
        { dim: 'targets', weight: 2, what: '4 of 18 clicks on weather.gov landed just beside a button', site: 'weather.gov', at: at(0), layer: 'usual' },
        { dim: 'targets', weight: -1, what: '9 clicks on wikipedia.org, none missed', site: 'wikipedia.org', at: at(1), layer: 'usual' },
      ],
    });
    expect(actionFact(clicks, NOW)).toBe('9 clicks landed just beside a button on 2 sites this week.');
    expect(offerDim('larger_text')).toBe('text_size');
    expect(offerDim('bigger_targets')).toBe('targets');
  });
  it('lists what the person did, newest first, without repeats', () => {
    const b = belief('text_size', { evidence: [zoom('cvs.com', 133, 2), zoom('cnn.com', 133, 0), zoom('cnn.com', 133, 0), zoom('nytimes.com', 125, 1)] });
    const { lines, more } = evidenceLines(b, NOW, 2);
    expect(lines).toEqual([
      { what: 'You zoomed in to 133% on cnn.com', when: 'today' },
      { what: 'You zoomed in to 125% on nytimes.com', when: 'yesterday' },
    ]);
    expect(more).toBe(1);
  });
});

describe('warm-up and demo week', () => {
  it('offers the warm-up until it is taken', () => {
    expect(warmupLabel({ fit: null, passive: null })).toBe('Take the 70-second warm-up');
    expect(warmupLabel({ fit: null, passive: state({ contrast: { source: 'warmup', action: 'apply', p: 0.95 } }) })).toBe('Redo the warm-up');
    expect(hasWarmup(WEEK)).toBe(false);
  });
  it('builds a realistic week: zooms on 4 sites over 3 days, missed clicks on 3 sites, nothing in the future', () => {
    const now = new Date(2026, 9, 24, 7, 30);
    const week = demoWeek(now) as Array<PassiveEvidence & { kind?: string; misses?: number }>;
    const zooms = week.filter((e) => e.kind === 'zoom');
    const missed = week.filter((e) => e.kind === 'clicks' && (e.misses ?? 0) > 0);
    expect(new Set(zooms.map((e) => e.site)).size).toBe(4);
    expect(new Set(zooms.map((e) => e.at.slice(0, 10))).size).toBeGreaterThanOrEqual(2);
    expect(new Set(week.map((e) => new Date(e.at).getDate())).size).toBe(3);
    expect(new Set(missed.map((e) => e.site)).size).toBe(3);
    expect(week.every((e) => Date.parse(e.at) <= now.getTime())).toBe(true);
    expect(week.every((e) => Math.abs(e.weight) <= 2 && (e.dim !== 'text_size' || typeof e.value === 'number'))).toBe(true);
    expect(week.map((e) => Date.parse(e.at))).toEqual([...week.map((e) => Date.parse(e.at))].sort((a, b) => a - b));
  });
});

describe('wording', () => {
  it('speaks about the page and the person’s actions, never a condition', () => {
    const copy = [
      ...HOW_IT_LEARNS, EMPTY_HELPS.title, EMPTY_HELPS.body, ...Object.values(FEEDBACK_NOTE),
      ...helpRows(WEEK, NOW).flatMap((r) => [feedbackNote(r, 'not_right'), feedbackNote(r, 'forget')]),
      ...helpRows(WEEK, NOW).flatMap((r) => [r.sentence, r.chip, r.sure, r.statusLabel]),
      ...helpRows(state(Object.fromEntries(DIM_ORDER.map((d) => [d, { p: 0.95, source: 'learned', action: 'apply' }]))), NOW).map((r) => r.sentence),
    ].join(' ');
    expect(copy).not.toMatch(/accessib|complian|disab|tremor|dyslex|parkinson|arthritis|vision loss|impair|diagnos|condition|elderly|senior/i);
    expect(HOW_IT_LEARNS[0]).toMatch(/learns the need, never the cause/);
    expect(HOW_IT_LEARNS[1]).toMatch(/stays on this laptop/);
  });
});
