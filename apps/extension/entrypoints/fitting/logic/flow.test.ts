import { deriveFit, DEMO_FITS } from '@webable/core';
import { describe, expect, it } from 'vitest';
import { planFind } from './finding';
import { BlockWalk } from './pointing';
import { makeRng } from './rand';
import { RawCollector } from './raw';
import { ladderPx, ladderStartPx, ladderStop, LADDER } from './read';
import { eyebrowFor, IN_THE_WAY, linesFor, mergeLines, partSetLine, planSteps, wordsFor, type StepId } from './steps';

const BANNED = /\b(test|score|results?|normal|calibrat\w*|profile|fit|calm view|lens|jev)\b/i;
const ALL: StepId[] = ['size', 'truefalse', 'faint', 'lightdark', 'dots', 'find'];

describe('words', () => {
  it('stay plain: no banned words in any step', () => {
    for (const input of ['mouse', 'touch'] as const) {
      for (const s of ALL) {
        const w = wordsFor(s, input);
        for (const text of [w.title, w.todo, w.success]) expect(text).not.toMatch(BANNED);
      }
    }
    for (const c of IN_THE_WAY) expect(c.label).not.toMatch(BANNED);
  });

  it('counts steps within a part', () => {
    expect(eyebrowFor('truefalse', ALL)).toBe('Reading · 2 of 4');
    expect(eyebrowFor('dots', ALL)).toBe('Pointing');
    expect(partSetLine('lightdark', 'dots')).toBe('Reading is set.');
    expect(partSetLine('size', 'truefalse')).toBeNull();
  });

  it('leaves out the dots for keyboard users and the colour steps under system colours', () => {
    expect(planSteps('keyboard', null)).not.toContain('dots');
    const forced = { forcedColors: true } as Parameters<typeof planSteps>[1];
    expect(planSteps('mouse', forced)).toEqual(['size', 'truefalse', 'dots', 'find']);
  });
});

describe('what we have learned', () => {
  it('shows the text change and refreshes it in place', () => {
    const rosa = DEMO_FITS.rosa;
    const first = linesFor('size', rosa);
    expect(first[0]).toMatchObject({ label: 'Text', from: '16', value: '22 px', changed: true });
    const merged = mergeLines(first, [{ ...first[0]!, value: '24 px' }]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.value).toBe('24 px');
    expect(linesFor('dots', rosa).map((l) => l.value)).toEqual(['56 px', 'on']);
    expect(linesFor('find', DEMO_FITS.typical).map((l) => l.value)).toEqual(['left alone', 'simplified']);
  });
});

describe('reading ladder', () => {
  it('starts a step above the comfortable size and goes 0.1 log down', () => {
    expect(ladderStartPx(20, null)).toBeCloseTo(25.2, 1);
    expect(ladderPx(25.2, 1)).toBeCloseTo(20, 0);
  });

  it('stops at two misses in a row, 9 sentences, or 35 s', () => {
    expect(ladderStop([{ correct: true }, { correct: false }], 1000, 15)).toBeNull();
    expect(ladderStop([{ correct: false }, { correct: false }], 1000, 15)).toBe('reversal');
    expect(ladderStop(Array.from({ length: 9 }, () => ({ correct: true })), 1000, 15)).toBe('max_trials');
    expect(ladderStop([{ correct: true }], LADDER.maxActiveMs, 15)).toBe('time');
  });
});

describe('dots walk', () => {
  const hit = { dx: 1, dy: 1, hit: true, slipped: false };
  const miss = { dx: 60, dy: 0, hit: false, slipped: false };

  it('goes down after clean blocks and stops after 3 blocks', () => {
    const w = new BlockWalk(false);
    w.press(hit); // positions the pointer
    for (let i = 0; i < 24; i++) w.press(hit);
    expect(w.done).toBe(true);
    expect(w.blocks.map((b) => b.sizePx)).toEqual([44, 32, 24]);
    expect(w.blocks.every((b) => b.presses.length === 8)).toBe(true);
  });

  it('stops at the first reversal', () => {
    const w = new BlockWalk(false);
    w.press(hit);
    for (let i = 0; i < 8; i++) w.press(hit);
    for (let i = 0; i < 8; i++) w.press(i < 3 ? miss : hit);
    expect(w.done).toBe(true);
    expect(w.stopReason).toBe('reversal');
  });
});

describe('find plan', () => {
  it('has 1 practice and 8 trials, two in each busy × moving cell, yoked by site', () => {
    const { practice, trials } = planFind(makeRng(7));
    expect(practice.clutter || practice.motion).toBe(false);
    expect(trials).toHaveLength(8);
    for (const c of [false, true]) for (const m of [false, true]) expect(trials.filter((t) => t.clutter === c && t.motion === m)).toHaveLength(2);
    for (const t of trials) expect(trials.filter((x) => x.template === t.template)).toHaveLength(2);
    for (const t of trials) expect(t.tiles.indexOf(t.target)).toBeLessThan(8);
  });
});

describe('raw answers to settings', () => {
  it('carries the comfortable size and R4 into core', () => {
    const raw = new RawCollector();
    raw.seedPx = 22;
    raw.stated = 'dark';
    raw.lightMs.push(2100);
    raw.skippedSteps.add('light or dark');
    const r = raw.toRaw();
    expect(r.reading?.seedPx).toBe(22);
    expect(r.reading?.polarity.lightMs).toEqual([2100]);
    expect(r.skipped).toContain('light or dark');
    const fit = deriveFit(r);
    expect(fit.text.bodyPx).toBe(22);
    expect(fit.polarity.value).toBe('dark');
  });

  it('turns moving things and the calmer page into paused motion and simplified pages', () => {
    const raw = new RawCollector();
    raw.complete('find');
    raw.findTrials = [{ clutter: true, motion: true, ms: 4000, found: true }];
    raw.preferredCalm = 2;
    raw.notes = ['moving things'];
    const fit = deriveFit(raw.toRaw());
    expect(fit.attention.motion.on).toBe(true);
    expect(fit.attention.structureLevel).toBeGreaterThan(0);
  });
});
