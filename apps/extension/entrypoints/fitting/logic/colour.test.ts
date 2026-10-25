import { describe, expect, it } from 'vitest';
import { MOVABLE, scoreArrangement } from './colour';

describe('colour order', () => {
  it('scores a smooth line as no extra help', () => {
    const perfect = scoreArrangement(MOVABLE.map((c) => c.id));
    expect(perfect.crossings).toBe(0);
    expect(perfect.score).toBe(0);
    expect(perfect.axes).toEqual([]);
  });

  it('notes a single red-green jump and does not grow help from it', () => {
    const placed = ['c4', 'c1', 'c2', 'c3', 'c5', 'c6', 'c7'];
    const scored = scoreArrangement(placed);
    expect(scored.crossings).toBeGreaterThan(0);
    expect(scored.crossings).toBeLessThan(3);
    expect(scored.axes).toContain('red-green');
    expect(scored.score).toBe(0);
  });

  it('grows help only when crossings form a pattern, and notes a yellow-blue jump on its own', () => {
    const reversed = scoreArrangement([...MOVABLE].reverse().map((c) => c.id));
    expect(reversed.crossings).toBeGreaterThan(0);
    expect(reversed.crossings).toBeLessThan(3);
    expect(reversed.score).toBe(0);
    const pattern = scoreArrangement(['c4', 'c1', 'c6', 'c2', 'c7', 'c3', 'c5']);
    expect(pattern.crossings).toBeGreaterThanOrEqual(3);
    expect(pattern.score).toBeGreaterThanOrEqual(55);
    expect(pattern.score).toBeLessThanOrEqual(100);
    const jumped = scoreArrangement(['c2', 'c6', 'c1', 'c3', 'c4', 'c5', 'c7']);
    expect(jumped.axes).toContain('blue-yellow');
    expect(jumped.score).toBe(0);
  });
});
