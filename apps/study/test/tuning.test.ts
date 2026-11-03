import { defaultFit } from '@webable/core';
import { describe, expect, it } from 'vitest';
import type { TapBaseline } from '../src/contracts';
import { learnFromOffers, readerFor, setupSummary, tuneFit, type SetupAnswers } from '../src/experiment/tuning';
import { umuxResponse } from '../src/experiment/umux';

const answers = (patch: Partial<SetupAnswers> = {}): SetupAnswers => ({
  needs: [], polarity: 'light', shape: 'paragraphs', words: 'as_is', ...patch,
});
const baseline = (taps: number, misses: number): TapBaseline => ({
  screens: 10, taps, misses, nearMisses: 0, repeats: 0, changes: 0, medianAnswerMs: 2000, medianOffCentrePx: 8,
});

describe('setting WebAble up from the answers', () => {
  it('gives bigger buttons and steady taps to someone who taps the wrong thing', () => {
    const fit = tuneFit(defaultFit(), answers({ needs: ['tap_wrong'] }), null);
    expect(fit.targets.minPx).toBe(56);
    expect(fit.clicks.steady.on).toBe(true);
  });

  it('goes a step bigger when the person often tapped beside the buttons on the question screens', () => {
    const fit = tuneFit(defaultFit(), answers(), baseline(20, 4));
    expect(fit.targets.minPx).toBe(72);
    expect(fit.baselines.missRate).toBe(0.2);
  });

  it('keeps the measured baseline out when there were too few taps to tell', () => {
    const fit = tuneFit(defaultFit(), answers(), baseline(3, 2));
    expect(fit.targets.minPx).toBe(defaultFit().targets.minPx);
    expect(fit.baselines.missRate).toBe(defaultFit().baselines.missRate);
  });

  it('opens the simplified page sooner for busy pages, stops motion, and keeps light or dark', () => {
    const fit = tuneFit(defaultFit(), answers({ needs: ['busy', 'motion'], polarity: 'dark' }), null);
    expect(fit.attention.structureLevel).toBe(2);
    expect(fit.attention.motion.on).toBe(true);
    expect(fit.polarity.value).toBe('dark');
  });

  it('describes the reader the way the server accepts it', () => {
    const r = readerFor(answers({ shape: 'steps', words: 'plain', needs: ['long_text'] }), new Date('2026-11-02T12:00:00Z'));
    expect(r).toMatchObject({ v: 'reader.1', level: 'plain', length: 'shorter', shape: 'steps', answerFirst: true });
    expect(r.points.length).toBeGreaterThanOrEqual(3);
    expect(r.points.length).toBeLessThanOrEqual(12);
    for (const p of r.points) expect(p.id).toMatch(/^r\d{1,3}$/);
    expect(r.headline).toBe('Steps, in plain, short words.');
  });

  it('says what will change in plain words, and the AI lines only with live AI', () => {
    const a = answers({ needs: ['tap_wrong'] });
    const fit = tuneFit(defaultFit(), a, null);
    expect(setupSummary(fit, a, false)).toContain('Bigger buttons and links, easier to tap');
    expect(setupSummary(fit, a, false).some((l) => /offers help/.test(l))).toBe(false);
    expect(setupSummary(fit, a, true).some((l) => /offers help/.test(l))).toBe(true);
  });
});

describe('learning between websites', () => {
  it('keeps help the person said yes to, and nothing else', () => {
    const got = learnFromOffers(defaultFit(), ['bigger_targets', 'main_actions']);
    expect(got?.learned).toEqual(['bigger_targets']);
    expect(got?.fit.targets.minPx).toBe(56);
    expect(learnFromOffers(defaultFit(), ['main_actions'])).toBeNull();
  });
});

describe('UMUX', () => {
  it('keeps the UMUX-Lite score from statements 1 and 3', () => {
    expect(umuxResponse([7, 1, 7, 1], 'x').score).toBe(100);
    expect(umuxResponse([1, 7, 1, 7], 'x').score).toBe(0);
    expect(umuxResponse([4, null, 5, null], 'x').score).toBe(58.3);
    expect(umuxResponse([4, 4, null, 4], 'x').score).toBeNull();
  });
  it('scores the full UMUX with statements 2 and 4 reversed, only when all 4 are answered', () => {
    expect(umuxResponse([7, 1, 7, 1], 'x').umux).toBe(100);
    expect(umuxResponse([1, 7, 1, 7], 'x').umux).toBe(0);
    expect(umuxResponse([6, 3, 5, 2], 'x').umux).toBe(75);
    expect(umuxResponse([6, null, 5, 2], 'x').umux).toBeNull();
  });
});
