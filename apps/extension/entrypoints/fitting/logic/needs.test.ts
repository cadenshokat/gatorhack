import { DEMO_FITS, defaultFit } from '@webable/core';
import { describe, expect, it } from 'vitest';
import { NEED_IDS, needScores, readingHelp, textHelp, topBenefits } from './needs';

describe('need scores', () => {
  it('lists the eight needs in chart order, longer when the fit asks for more help', () => {
    expect(textHelp(16)).toBeLessThan(15);
    expect(textHelp(22)).toBeGreaterThan(textHelp(18));
    expect(textHelp(40)).toBe(100);
    const rosa = needScores(DEMO_FITS.rosa);
    const typical = needScores(DEMO_FITS.typical);
    expect(rosa.map((s) => s.id)).toEqual([...NEED_IDS]);
    expect(rosa.find((s) => s.id === 'small_text')?.score).toBeGreaterThan(typical.find((s) => s.id === 'small_text')?.score ?? 100);
    expect(rosa.find((s) => s.id === 'busy_pages')?.score).toBeGreaterThan(70);
    expect(rosa.find((s) => s.id === 'moving_things')?.score).toBeGreaterThan(70);
    expect(typical.every((s) => s.score < 42)).toBe(true);
  });

  it('ranks at most four benefits and keeps reading and colour help when they were measured', () => {
    const rosa = topBenefits(needScores(DEMO_FITS.rosa));
    expect(rosa.length).toBeLessThanOrEqual(4);
    expect(rosa.length).toBeGreaterThan(0);
    for (let i = 1; i < rosa.length; i++) expect(rosa[i]?.score).toBeLessThanOrEqual(rosa[i - 1]?.score ?? 0);
    expect(topBenefits(needScores(DEMO_FITS.typical))).toEqual([]);

    const slow = needScores(defaultFit(), { readingSupport: true, topWpm: 70 });
    expect(slow.find((s) => s.id === 'long_reading')?.score).toBe(80);
    expect(readingHelp({ topWpm: 60 }, false)).toBeGreaterThan(readingHelp({ topWpm: 220 }, false));

    const colour = needScores(defaultFit(), { colourNeed: { crossings: 3, score: 100, axes: ['red-green'] } });
    expect(colour.find((s) => s.id === 'telling_colours')?.score).toBe(100);
  });
});
