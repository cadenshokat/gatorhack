// Pure measure definitions (methods §3.1-3.2): what a tap is, misses, near misses, repeat taps, rage episodes, scroll
// travel and reversals, and the FrameMetrics they add up to. The DOM wiring is in meter.ts.

import type { FrameMetrics, TapRecord } from '../contracts';

export const TAP_MAX_MOVE_PX = 10;
export const TAP_MAX_MS = 800;
/** A tap "activated" something when a click on a control followed within this. */
export const ACTIVATE_MS = 500;
/** A proxied click (the simplified page driving the original control) follows a trusted pointerup within this. */
export const PROXY_MS = 300;
export const NEAR_MISS_PX = 24;
export const REPEAT_MS = 500;
export const REPEAT_PX = 30;
export const RAGE_MS = 1000;
export const RAGE_PX = 30;
export const RAGE_MIN_TAPS = 3;
export const TAP_LOG_MAX = 400;
/** A scroll reversal: a change of direction after at least this much travel (in screens). */
export const REVERSAL_MIN_SCREENS = 0.5;
/** The new direction must travel this far to count (a 2 px wobble is not a reversal). */
export const REVERSAL_CONFIRM_SCREENS = 0.1;

export interface Tap extends TapRecord {
  /** Internal: a link attempt was already counted for this tap. */
  link?: boolean;
}

/** A pointerdown -> pointerup pair with no pointercancel, movement <= 10 px and duration <= 800 ms. */
export function isTap(p: { dx: number; dy: number; maxMove: number; ms: number; cancelled: boolean; multi: boolean }): boolean {
  if (p.cancelled || p.multi) return false;
  if (p.ms > TAP_MAX_MS) return false;
  return Math.max(p.maxMove, Math.hypot(p.dx, p.dy)) <= TAP_MAX_MOVE_PX;
}

/** Pressed nothing interactive and activated nothing within 500 ms. */
export function isMiss(t: Pick<TapRecord, 'hit' | 'activated'>): boolean {
  return !t.hit && !t.activated;
}

export function isNearMiss(t: Pick<TapRecord, 'hit' | 'activated' | 'distPx'>): boolean {
  return isMiss(t) && t.distPx !== null && t.distPx <= NEAR_MISS_PX;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** For each tap: a second tap within 500 ms and 30 px of an earlier tap that activated something. */
export function repeatFlags(taps: readonly TapRecord[]): boolean[] {
  return taps.map((t, i) => {
    for (let j = i - 1; j >= 0; j--) {
      const e = taps[j] as TapRecord;
      if (t.t - e.t > REPEAT_MS) break;
      if (e.activated && dist(t, e) <= REPEAT_PX) return true;
    }
    return false;
  });
}

/** Episodes of 3+ taps within 1000 ms, all within 30 px of the first, at least one a miss or a repeat. */
export function rageEpisodes(taps: readonly TapRecord[], repeats: readonly boolean[] = repeatFlags(taps)): number {
  let n = 0;
  let i = 0;
  while (i < taps.length) {
    const first = taps[i] as TapRecord;
    let k = i + 1;
    while (k < taps.length) {
      const t = taps[k] as TapRecord;
      if (t.t - first.t > RAGE_MS || dist(t, first) > RAGE_PX) break;
      k++;
    }
    const size = k - i;
    let bad = false;
    for (let j = i; j < k; j++) if (isMiss(taps[j] as TapRecord) || repeats[j]) bad = true;
    if (size >= RAGE_MIN_TAPS && bad) {
      n++;
      i = k;
    } else {
      i++;
    }
  }
  return n;
}

/** Scroll travel and direction changes of one scroller, in screens. */
export class ScrollTrack {
  total = 0;
  reversals = 0;
  private dir = 0;
  private seg = 0;
  private prev = 0;
  private pending = false;

  /** dy in px, screen in px (the scroller's visible height). */
  add(dy: number, screen: number): void {
    if (!dy || !Number.isFinite(dy) || !(screen > 0)) return;
    const d = Math.sign(dy);
    const s = Math.abs(dy) / screen;
    this.total += s;
    if (this.dir === 0) {
      this.dir = d;
      this.seg = s;
      return;
    }
    if (d === this.dir) {
      this.seg += s;
    } else if (this.pending) {
      // The turn never travelled far enough: it was a wobble, so the earlier direction carries on.
      this.dir = d;
      this.seg = this.prev + s;
      this.prev = 0;
      this.pending = false;
      return;
    } else {
      this.prev = this.seg;
      this.pending = this.seg >= REVERSAL_MIN_SCREENS;
      this.dir = d;
      this.seg = s;
    }
    if (this.pending && this.seg >= REVERSAL_CONFIRM_SCREENS) {
      this.reversals++;
      this.pending = false;
      this.prev = 0;
    }
  }
}

export interface Counts {
  activations: number;
  linkAttempts: number;
  debounced: number;
  expands: number;
  scrollScreens: number;
  scrollReversals: number;
  answerSeenMs: number | null;
  simplifiedAtEnd: boolean;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function aggregate(taps: readonly TapRecord[], c: Counts): FrameMetrics {
  const repeats = repeatFlags(taps);
  return {
    taps: taps.length,
    misses: taps.filter(isMiss).length,
    nearMisses: taps.filter(isNearMiss).length,
    activations: c.activations,
    linkAttempts: c.linkAttempts,
    repeatTaps: repeats.filter(Boolean).length,
    rageEpisodes: rageEpisodes(taps, repeats),
    debounced: c.debounced,
    expands: c.expands,
    scrollScreens: r2(c.scrollScreens),
    scrollReversals: c.scrollReversals,
    answerSeen: c.answerSeenMs !== null,
    answerSeenMs: c.answerSeenMs === null ? null : Math.round(c.answerSeenMs),
    simplifiedAtEnd: c.simplifiedAtEnd,
    tapLog: taps.slice(0, TAP_LOG_MAX).map((t) => {
      const out: TapRecord = { t: Math.round(t.t), x: Math.round(t.x), y: Math.round(t.y), layer: t.layer, hit: t.hit, activated: t.activated, distPx: t.distPx === null ? null : Math.round(t.distPx * 10) / 10 };
      if (t.tag) out.tag = t.tag;
      return out;
    }),
  };
}
