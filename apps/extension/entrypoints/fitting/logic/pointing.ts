// P1 dot ring: block statistics and the ladder walk that picks the next dot size (fitting brief §4).
// Core's deriveFit recomputes the minimum target from the blocks; this decides only what to show next.

import { median } from './rand';

export const MOUSE_LADDER = [24, 32, 44, 56, 72, 96] as const;
export const TOUCH_LADDER = [44, 56, 72, 96] as const;
export const RING_COUNT = 9;
/** Visiting order across the ring (ISO 9241-9 style): each step jumps to the far side. */
export const RING_ORDER: number[] = Array.from({ length: RING_COUNT }, (_, k) => (k * 5) % RING_COUNT);

export interface RingPress {
  dx: number;
  dy: number;
  hit: boolean;
  slipped: boolean;
}

export interface BlockStats {
  misses: number;
  sigma: number;
  sigmaAbs: number;
  pMiss: number;
  pass: boolean;
}

/** P(miss) for a circular target of diameter L with a circular Gaussian spread sigma. */
export function pMissCircle(L: number, sigma: number): number {
  if (sigma <= 0) return 0;
  return Math.exp(-(L * L) / (8 * sigma * sigma));
}

export function blockStats(sizePx: number, presses: RingPress[]): BlockStats {
  const W = sizePx;
  const misses = presses.filter((p) => !p.hit).length;
  const r = presses.map((p) => Math.hypot(p.dx, p.dy)).filter((d) => d <= 2 * W);
  const sigma = r.length ? median(r) / 1.1774 : W;
  const sigmaAbs = Math.sqrt(Math.max(0, sigma * sigma - (0.16 * W) ** 2));
  const pMiss = pMissCircle(W, Math.sqrt((1.15 * sigmaAbs) ** 2 + (0.16 * W) ** 2));
  return { misses, sigma, sigmaAbs, pMiss, pass: misses <= 1 && pMiss <= 0.08 };
}

export interface BlockRecord {
  sizePx: number;
  presses: RingPress[];
  pass: boolean;
  medianMoveMs: number;
}

export class PointingWalk {
  readonly blocks: BlockRecord[] = [];
  private readonly ladder: readonly number[];
  private direction: 'down' | 'up' | null = null;
  private nextSize: number | null;
  maxBlocks: number;

  constructor(touch: boolean, maxBlocks = 3) {
    this.ladder = touch ? TOUCH_LADDER : MOUSE_LADDER;
    this.nextSize = touch ? 56 : 44;
    this.maxBlocks = maxBlocks;
  }

  get done(): boolean {
    return this.nextSize === null;
  }

  current(): number | null {
    return this.nextSize;
  }

  progress(): number {
    return this.done ? 1 : Math.min(0.95, this.blocks.length / 3);
  }

  record(sizePx: number, presses: RingPress[], medianMoveMs: number): BlockRecord {
    const pass = blockStats(sizePx, presses).pass;
    const rec: BlockRecord = { sizePx, presses, pass, medianMoveMs };
    this.blocks.push(rec);
    const i = this.ladder.indexOf(sizePx);
    if (this.direction === null) this.direction = pass ? 'down' : 'up';
    const stop =
      this.blocks.length >= this.maxBlocks ||
      (this.direction === 'down' && !pass) ||
      (this.direction === 'up' && pass);
    if (stop) {
      this.nextSize = null;
      return rec;
    }
    const j = this.direction === 'down' ? i - 1 : i + 1;
    this.nextSize = j >= 0 && j < this.ladder.length ? (this.ladder[j] ?? null) : null;
    return rec;
  }

  /** Smallest size that passed; if none, the next size above the largest tried. Display only. */
  roughMinTarget(): number | null {
    if (this.blocks.length === 0) return null;
    const passed = this.blocks.filter((b) => b.pass).map((b) => b.sizePx);
    if (passed.length) return Math.min(...passed);
    const largest = Math.max(...this.blocks.map((b) => b.sizePx));
    const i = this.ladder.indexOf(largest);
    return this.ladder[Math.min(this.ladder.length - 1, i + 1)] ?? 96;
  }
}

/** Ring geometry for a stage of the given size; grows so large dots never touch their neighbours. */
export function ringDiameter(stageW: number, stageH: number, touch: boolean, dotPx: number): number {
  const m = Math.min(stageW, stageH);
  const base = touch
    ? Math.min(260, Math.max(120, Math.round(0.3 * m)))
    : Math.min(280, Math.max(160, Math.round(0.28 * m)));
  const noTouching = Math.ceil((dotPx * RING_COUNT * 1.35) / Math.PI);
  return Math.max(base, noTouching);
}
