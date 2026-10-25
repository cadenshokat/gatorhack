// Find it: three short rounds on the same task.
// A clean page, then a busy page with nothing moving, then that busy page plus one moving banner.
// How much longer the busy page takes sets clutter. How much longer the moving round takes sets motion.
// Both stay soft. The banner itself is not a target, and looking at it does not count.

import type { StructureLevel } from '@webable/core';

export const SOFT_CAP = 0.58;
export const CLUTTER_FLOOR = 0.22;
export const MOTION_FLOOR = 0.3;

export interface FindRound {
  ms: number;
  found: boolean;
}

export interface FindAttention {
  clutterP: number;
  structureLevel: StructureLevel;
  motionOn: boolean;
  motionP: number;
  /** Left at 0 so a slow round cannot turn a busy page into the strongest layout. */
  preferredCalm: number;
  gotInWay: string[];
}

/** 0–1. A small gap stays at the floor. About 2.5 seconds extra reaches the soft cap, and never past it. */
export function softFromDelta(deltaMs: number, floor: number): number {
  if (!(deltaMs > 300)) return floor;
  const t = Math.min(1, (deltaMs - 300) / 2500);
  const p = floor + t * (SOFT_CAP - floor);
  return Math.round(p * 1000) / 1000;
}

function gap(later: FindRound, earlier: FindRound): number {
  if (!later.found || !earlier.found) return 2800;
  return later.ms - earlier.ms;
}

export function attentionFromRounds(clean: FindRound, busyStill: FindRound, busyMoving: FindRound): FindAttention {
  const clutterP = softFromDelta(gap(busyStill, clean), CLUTTER_FLOOR);
  const motionP = softFromDelta(gap(busyMoving, busyStill), MOTION_FLOOR);
  return {
    clutterP,
    structureLevel: clutterP >= 0.5 ? 1 : 0,
    motionOn: motionP >= 0.5,
    motionP,
    preferredCalm: 0,
    gotInWay: [],
  };
}
