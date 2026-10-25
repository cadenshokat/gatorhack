// Point: the dot ring's block statistics and the sequential walk that picks the next dot size (fitting brief round 4 §3).
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
  /** Scored presses only (the very first press of the warm-up positions the pointer and is not scored). */
  presses: RingPress[];
  pass: boolean;
}

/**
 * The warm-up's Point walk (fitting brief round 4 §3): from 44 px (56 on touch), each size passes after 4 clean scored
 * presses with a tight spread, fails at 2 misses, and is otherwise judged after 6 presses. The walk goes down after a
 * pass and up after a fail, and stops at the first reversal, the end of the ladder, or 18 presses in all.
 */
export class SequentialWalk {
  static readonly NEED_CLEAN = 4;
  static readonly MAX_PER_SIZE = 6;
  static readonly MAX_PRESSES = 18;

  readonly blocks: BlockRecord[] = [];
  private readonly ladder: readonly number[];
  private idx: number;
  private direction: -1 | 1 | null = null;
  private presses: RingPress[] = [];
  private total = 0;
  private positioned = false;
  private finished = false;
  stopReason: 'reversal' | 'ladder_end' | 'max_presses' | null = null;

  constructor(touch: boolean) {
    this.ladder = touch ? TOUCH_LADDER : MOUSE_LADDER;
    this.idx = this.ladder.indexOf(touch ? 56 : 44);
  }

  get done(): boolean {
    return this.finished;
  }

  /** Dot size (px at 100%) for the next press, or null when finished. */
  current(): number | null {
    return this.finished ? null : (this.ladder[this.idx] ?? null);
  }

  /** The very first press only positions the pointer. */
  get positioning(): boolean {
    return !this.positioned;
  }

  get pressCount(): number {
    return this.total;
  }

  get scoredCount(): number {
    return this.blocks.reduce((a, b) => a + b.presses.length, 0) + this.presses.length;
  }

  progress(): number {
    return this.finished ? 1 : Math.min(0.95, this.total / 14);
  }

  /** Record one press at the current size. */
  press(p: RingPress): void {
    if (this.finished) return;
    this.total += 1;
    if (!this.positioned) {
      this.positioned = true;
      this.checkBudget();
      return;
    }
    this.presses.push(p);
    const size = this.ladder[this.idx] ?? 44;
    const n = this.presses.length;
    const misses = this.presses.filter((x) => !x.hit).length;
    let pass: boolean | null = null;
    if (misses >= 2) pass = false;
    else if (n >= SequentialWalk.NEED_CLEAN && misses === 0 && blockStats(size, this.presses).pMiss <= 0.08) pass = true;
    else if (n >= SequentialWalk.MAX_PER_SIZE) pass = misses <= 1 && blockStats(size, this.presses).pMiss <= 0.08;
    if (pass !== null) this.closeBlock(size, pass);
    else this.checkBudget();
  }

  private closeBlock(size: number, pass: boolean): void {
    this.blocks.push({ sizePx: size, presses: this.presses, pass });
    this.presses = [];
    const dir: -1 | 1 = pass ? -1 : 1;
    if (this.direction === null) this.direction = dir;
    else if (dir !== this.direction) return this.finish('reversal');
    const next = this.idx + this.direction;
    if (next < 0 || next >= this.ladder.length) return this.finish('ladder_end');
    this.idx = next;
    this.checkBudget();
  }

  private checkBudget(): void {
    // A size cut short by the press budget is dropped: half a size says nothing reliable.
    if (this.total >= SequentialWalk.MAX_PRESSES) this.finish('max_presses');
  }

  private finish(reason: 'reversal' | 'ladder_end' | 'max_presses'): void {
    this.finished = true;
    this.stopReason = reason;
    this.presses = [];
  }

  /** Smallest size that passed above every fail (the same rule as core). Display only. */
  roughMinTarget(): number | null {
    if (!this.blocks.length) return null;
    const failed = this.blocks.filter((b) => !b.pass).map((b) => b.sizePx);
    const maxFailed = failed.length ? Math.max(...failed) : -Infinity;
    const passed = this.blocks.filter((b) => b.pass && b.sizePx > maxFailed).map((b) => b.sizePx);
    if (passed.length) return Math.min(...passed);
    return this.ladder.find((l) => l > maxFailed) ?? 96;
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
