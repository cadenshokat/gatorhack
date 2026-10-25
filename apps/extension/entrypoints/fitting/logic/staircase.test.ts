import { describe, expect, it } from 'vitest';
import { bandFromRatio, ContrastStaircase } from './staircase';

describe('faint-word staircase', () => {
  it('maps a strong threshold to more help and a faint one to little help', () => {
    expect(bandFromRatio(12)).toBe('S');
    expect(bandFromRatio(7)).toBe('S');
    expect(bandFromRatio(5)).toBe('M');
    expect(bandFromRatio(3.5)).toBe('M');
    expect(bandFromRatio(1.6)).toBe('N');
  });

  it('makes the word fainter after two correct picks, and stronger after a miss', () => {
    const stair = new ContrastStaircase();
    const first = stair.current().gray;
    stair.record(true);
    expect(stair.current().gray).toBe(first);
    stair.record(true);
    expect(stair.current().gray).toBeGreaterThan(first);
    const faded = stair.current().gray;
    stair.record(false);
    expect(stair.current().gray).toBeLessThan(faded);
  });

  it('stops after enough turn-arounds', () => {
    const stair = new ContrastStaircase();
    const pattern = [true, true, false, true, true, false, true, true, false, true, true, false];
    for (const hit of pattern) {
      if (stair.finished) break;
      stair.record(hit);
    }
    expect(stair.finished).toBe(true);
    expect(stair.thresholdRatio()).toBeGreaterThan(1);
    expect(['N', 'M', 'S']).toContain(stair.band());
  });
});
