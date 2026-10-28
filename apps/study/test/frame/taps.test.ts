import { describe, expect, it } from 'vitest';
import type { TapRecord } from '../../src/contracts';
import { ScrollTrack, aggregate, isMiss, isNearMiss, isTap, rageEpisodes, repeatFlags } from '../../src/frame/metrics';

const tap = (t: number, x: number, y: number, o: Partial<TapRecord> = {}): TapRecord => ({
  t, x, y, layer: 'page', hit: false, activated: false, distPx: 50, ...o,
});

const counts = {
  activations: 0, linkAttempts: 0, debounced: 0, expands: 0, scrollScreens: 0, scrollReversals: 0, answerSeenMs: null, simplifiedAtEnd: false,
};

describe('what counts as a tap', () => {
  const base = { dx: 0, dy: 0, maxMove: 0, ms: 120, cancelled: false, multi: false };
  it('is a short, still press', () => {
    expect(isTap(base)).toBe(true);
    expect(isTap({ ...base, dx: 6, dy: 8 })).toBe(true); // 10 px
    expect(isTap({ ...base, ms: 800 })).toBe(true);
  });
  it('is not a drag, a long press, a cancelled press or a pinch', () => {
    expect(isTap({ ...base, dx: 8, dy: 8 })).toBe(false);
    expect(isTap({ ...base, maxMove: 14 })).toBe(false);
    expect(isTap({ ...base, ms: 801 })).toBe(false);
    expect(isTap({ ...base, cancelled: true })).toBe(false);
    expect(isTap({ ...base, multi: true })).toBe(false);
  });
});

describe('misses and near misses', () => {
  it('a miss pressed nothing and activated nothing', () => {
    expect(isMiss({ hit: false, activated: false })).toBe(true);
    expect(isMiss({ hit: false, activated: true })).toBe(false); // rescued by the browser's touch adjustment
    expect(isMiss({ hit: true, activated: false })).toBe(false);
  });
  it('a near miss is within 24 px of a control', () => {
    expect(isNearMiss({ hit: false, activated: false, distPx: 24 })).toBe(true);
    expect(isNearMiss({ hit: false, activated: false, distPx: 24.5 })).toBe(false);
    expect(isNearMiss({ hit: false, activated: false, distPx: null })).toBe(false);
  });
});

describe('repeat taps and rage', () => {
  it('a repeat follows a tap that activated something, within 500 ms and 30 px', () => {
    const taps = [tap(0, 100, 100, { hit: true, activated: true }), tap(400, 110, 110), tap(1000, 110, 110), tap(1200, 300, 300)];
    expect(repeatFlags(taps)).toEqual([false, true, false, false]);
  });
  it('a tap after a miss is not a repeat', () => {
    expect(repeatFlags([tap(0, 100, 100), tap(200, 100, 100)])).toEqual([false, false]);
  });
  it('rage is 3+ taps in a second in one spot with a miss among them, counted once', () => {
    const burst = [tap(0, 100, 100), tap(200, 105, 100), tap(400, 100, 108), tap(600, 102, 102)];
    expect(rageEpisodes(burst)).toBe(1);
    const spread = [tap(0, 100, 100), tap(200, 160, 100), tap(400, 100, 160)];
    expect(rageEpisodes(spread)).toBe(0);
    const slow = [tap(0, 100, 100), tap(600, 100, 100), tap(1200, 100, 100)];
    expect(rageEpisodes(slow)).toBe(0);
    const allHits = [0, 150, 300].map((t) => tap(t, 100, 100, { hit: true }));
    expect(rageEpisodes(allHits)).toBe(0);
  });
});

describe('scroll travel', () => {
  it('adds travel in screens and counts a turn after half a screen', () => {
    const s = new ScrollTrack();
    s.add(300, 600);
    s.add(300, 600); // 1 screen down
    s.add(-120, 600); // turn up
    expect(s.reversals).toBe(1);
    expect(s.total).toBeCloseTo(1.2);
  });
  it('ignores a turn before half a screen, and a 2 px wobble', () => {
    const s = new ScrollTrack();
    s.add(200, 600);
    s.add(-200, 600);
    expect(s.reversals).toBe(0);
    s.add(-400, 600);
    s.add(2, 600); // wobble
    s.add(-300, 600);
    expect(s.reversals).toBe(0);
    s.add(600, 600);
    expect(s.reversals).toBe(1);
  });
});

describe('aggregate', () => {
  it('adds up the measures and keeps only the first 400 taps in the log', () => {
    const taps = Array.from({ length: 450 }, (_, i) => tap(i * 2000, 50, 50, { distPx: i % 2 ? 10 : 40.04 }));
    const m = aggregate(taps, { ...counts, activations: 3, scrollScreens: 2.345, answerSeenMs: 812.4 });
    expect(m.taps).toBe(450);
    expect(m.misses).toBe(450);
    expect(m.nearMisses).toBe(225);
    expect(m.tapLog).toHaveLength(400);
    expect(m.tapLog[0]).toEqual({ t: 0, x: 50, y: 50, layer: 'page', hit: false, activated: false, distPx: 40 });
    expect(m.scrollScreens).toBe(2.35);
    expect(m.answerSeen).toBe(true);
    expect(m.answerSeenMs).toBe(812);
    expect(m.activations).toBe(3);
  });
});
