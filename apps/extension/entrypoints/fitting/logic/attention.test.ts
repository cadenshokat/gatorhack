import { describe, expect, it } from 'vitest';
import { attentionFromRounds, softFromDelta, SOFT_CAP } from './attention';

describe('find it', () => {
  it('keeps a small time gap at the floor and a long gap at the soft cap', () => {
    expect(softFromDelta(200, 0.22)).toBe(0.22);
    expect(softFromDelta(300, 0.3)).toBe(0.3);
    expect(softFromDelta(2800, 0.22)).toBe(SOFT_CAP);
    expect(softFromDelta(9000, 0.3)).toBe(SOFT_CAP);
    expect(softFromDelta(1550, 0.22)).toBeGreaterThan(0.22);
    expect(softFromDelta(1550, 0.22)).toBeLessThan(SOFT_CAP);
  });

  it('reads clutter from the still busy page and motion from the moving round', () => {
    const calm = attentionFromRounds(
      { ms: 2000, found: true },
      { ms: 2200, found: true },
      { ms: 2300, found: true },
    );
    expect(calm.clutterP).toBeLessThan(0.3);
    expect(calm.structureLevel).toBe(0);
    expect(calm.motionOn).toBe(false);
    expect(calm.motionP).toBeLessThan(0.4);
    expect(calm.preferredCalm).toBe(0);
    expect(calm.gotInWay).toEqual([]);

    const slowed = attentionFromRounds(
      { ms: 1800, found: true },
      { ms: 5200, found: true },
      { ms: 9000, found: true },
    );
    expect(slowed.clutterP).toBe(SOFT_CAP);
    expect(slowed.structureLevel).toBe(1);
    expect(slowed.motionOn).toBe(true);
    expect(slowed.motionP).toBe(SOFT_CAP);
    expect(slowed.structureLevel).not.toBe(2);
    expect(slowed.preferredCalm).toBe(0);
    expect(slowed.gotInWay).toEqual([]);
  });

  it('treats a round that was not found as a long search, still short of a hard result', () => {
    const missed = attentionFromRounds(
      { ms: 1500, found: true },
      { ms: 20000, found: false },
      { ms: 21000, found: false },
    );
    expect(missed.clutterP).toBe(SOFT_CAP);
    expect(missed.motionP).toBe(SOFT_CAP);
    expect(missed.structureLevel).toBe(1);
    expect(missed.motionOn).toBe(true);
  });
});
