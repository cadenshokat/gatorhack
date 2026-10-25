import { describe, expect, it } from 'vitest';
import { blockStats } from './pointing';
import { nextBubble, summarizeBubbles, type BubbleTap } from './bubbles';

function tap(size: 72 | 44 | 24, hit: boolean, extra: Partial<BubbleTap> = {}): BubbleTap {
  return {
    sizePx: size,
    dx: hit ? 1 : 40,
    dy: hit ? 0 : 30,
    hit,
    slipped: false,
    reentries: 0,
    holdMs: 90,
    gapMs: 700,
    via: 'pointer',
    ...extra,
  };
}

describe('bubbles', () => {
  it('moves to a smaller bubble once the larger one is easy, and stops on the small one', () => {
    const taps: BubbleTap[] = [];
    expect(nextBubble(taps).size).toBe(72);
    for (let i = 0; i < 4; i++) taps.push(tap(72, true));
    expect(nextBubble(taps)).toMatchObject({ size: 44, done: false });
    for (let i = 0; i < 4; i++) taps.push(tap(44, true));
    expect(nextBubble(taps)).toMatchObject({ size: 24, done: false });
    for (let i = 0; i < 4; i++) taps.push(tap(24, true));
    expect(nextBubble(taps)).toMatchObject({ done: true, reason: 'sure' });
    const summary = summarizeBubbles(taps);
    expect(summary.minPx).toBe(24);
    expect(summary.blocks[0]?.presses.length).toBeGreaterThan(0);
    expect(blockStats(24, summary.blocks.find((b) => b.sizePx === 24)?.presses ?? []).pass).toBe(true);
  });

  it('sets a larger tap when the small bubbles are missed, and steadier clicks when taps slip', () => {
    const taps: BubbleTap[] = [];
    for (let i = 0; i < 4; i++) taps.push(tap(72, true));
    for (let i = 0; i < 4; i++) taps.push(tap(44, false, { slipped: true, gapMs: 200 }));
    expect(nextBubble(taps).done).toBe(true);
    const summary = summarizeBubbles(taps);
    expect(summary.minPx).toBe(72);
    expect(summary.steady).toBe(true);
    expect(summary.debounce).toBe(true);
  });

  it('does not treat keyboard pops as a need for bigger buttons', () => {
    const taps = Array.from({ length: 8 }, () => tap(72, true, { via: 'key', dx: 0, dy: 0 }));
    expect(nextBubble(taps).done).toBe(true);
    expect(summarizeBubbles(taps).minPx).toBeNull();
  });
});
