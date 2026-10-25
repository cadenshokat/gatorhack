import { describe, expect, it } from 'vitest';
import { bodyFromCps, estimateReading, readingLadder, readingShouldStop, wordsPerMinute, type SpeedTrial } from './reading';

function trial(px: number, wpm: number, chars = 50, correct = true): SpeedTrial {
  const readingSec = chars / 5 / (wpm / 60);
  return { px, ms: Math.round((readingSec + 0.4) * 1000), correct, chars };
}

describe('reading size', () => {
  it('steps sizes down by about a tenth of a log unit', () => {
    const ladder = readingLadder(48, 8);
    expect(ladder[0]).toBe(48);
    expect(ladder.length).toBe(8);
    for (let i = 1; i < ladder.length; i++) {
      const ratio = (ladder[i] as number) / (ladder[i - 1] as number);
      expect(ratio).toBeGreaterThan(0.78);
      expect(ratio).toBeLessThan(0.81);
    }
  });

  it('turns a sentence time into words per minute and ignores a tap that is too fast', () => {
    expect(wordsPerMinute(3400, 50)).toBeGreaterThan(180);
    expect(wordsPerMinute(3400, 50)).toBeLessThan(220);
    expect(wordsPerMinute(200, 50)).toBeNull();
  });

  it('keeps the smallest size that still holds the pace, and sets body text to 1.4×', () => {
    const trials = [
      trial(48, 200),
      trial(38.1, 190),
      trial(30.3, 180),
      trial(24.1, 120),
      trial(19.1, 90),
    ];
    const est = estimateReading(trials);
    expect(est.dropped).toBe(true);
    expect(est.cpsPx).toBe(30.3);
    expect(est.bodyPx).toBe(bodyFromCps(30.3));
    expect(est.bodyPx).toBeGreaterThanOrEqual(16);
    expect(est.bodyPx).toBe(Math.round(30.3 * 1.4 * 2) / 2);
    expect(est.readingSupport).toBe(false);
    expect(est.topWpm).toBe(200);
  });

  it('asks for reading help when the top speed is slow, and never sets body text under 16', () => {
    const est = estimateReading([trial(48, 80), trial(38.1, 70), trial(30.3, 40)]);
    expect(est.readingSupport).toBe(true);
    expect(est.bodyPx).toBeGreaterThanOrEqual(16);
    expect(estimateReading([trial(10, 200), trial(8, 80)]).bodyPx).toBeGreaterThanOrEqual(16);
  });

  it('stops once speed has fallen off and at least three sentences were read', () => {
    const trials = [trial(48, 200), trial(38, 190), trial(30, 100)];
    expect(readingShouldStop(trials, 8, 10_000)).toBe('drop');
    expect(readingShouldStop([trial(48, 200)], 8, 10_000)).toBeNull();
    expect(readingShouldStop([trial(48, 200), trial(38, 190), trial(30, 180)], 3, 1000)).toBe('max');
  });
});
