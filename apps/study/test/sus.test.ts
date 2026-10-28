import { describe, expect, it } from 'vitest';
import type { Likert7 } from '../src/contracts';
import { contribution, susFlagged, susProrated, susResponse, susScore } from '../src/experiment/sus';

const all = (r: Likert7): Likert7[] => Array.from({ length: 10 }, () => r);

describe('SUS on 7 points', () => {
  it('scores all 4s as 50', () => {
    expect(susScore(all(4))).toBe(50);
  });

  it('scores the best pattern as 100 and the worst as 0', () => {
    const best = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? 7 : 1)) as Likert7[];
    const worst = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? 1 : 7)) as Likert7[];
    expect(susScore(best)).toBe(100);
    expect(susScore(worst)).toBe(0);
  });

  it('reverses the even (negative) items', () => {
    expect(contribution(1, 7)).toBe(6);
    expect(contribution(2, 7)).toBe(0);
    expect(contribution(2, 1)).toBe(6);
  });

  it('gives no score with any item missing, and never imputes', () => {
    const items: Array<Likert7 | null> = all(5);
    items[3] = null;
    expect(susScore(items)).toBeNull();
    const r = susResponse(items, null);
    expect(r.score).toBeNull();
    expect(r.answered).toBe(9);
  });

  it('prorates only with exactly one item missing', () => {
    const one: Array<Likert7 | null> = all(4);
    one[0] = null;
    expect(susProrated(one)).toBe(50);
    const two: Array<Likert7 | null> = [...one];
    two[1] = null;
    expect(susProrated(two)).toBeNull();
  });

  it('flags straight-lining and agreeing with opposite statements', () => {
    expect(susFlagged(all(6))).toBe(true);
    const items = all(4);
    items[2] = 7; // easy to use
    items[1] = 6; // unnecessarily complex
    items[7] = 6; // cumbersome
    expect(susFlagged(items)).toBe(true);
    items[7] = 2;
    expect(susFlagged(items)).toBe(false);
  });
});
