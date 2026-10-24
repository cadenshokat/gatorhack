// Collects FittingRaw in memory while the flow runs. Nothing here is persisted: only the derived fit is
// saved, and per-trial data is dropped when the page closes (fitting brief §2, privacy).

import type { FittingRaw, InputClass, Polarity } from '@webable/core';
import type { RingPress } from './pointing';

export type TaskId = 'R1' | 'R2' | 'R3' | 'R4' | 'P1' | 'F1' | 'F2' | 'F3';
export const READING_TASKS: TaskId[] = ['R1', 'R2', 'R3', 'R4'];
export const FINDING_TASKS: TaskId[] = ['F1', 'F2', 'F3'];

export type GotInWay =
  | 'moving things'
  | 'too much on the page'
  | 'long blocks of text'
  | 'hard to tell what to click'
  | 'popups';

/** Added to gotInWay when the person pressed "Stop motion" during Find it (strong evidence, brief §5).
 *  Worded so core's chip matching counts it as the stop press only, not also as the "moving things" chip. */
export const STOPPED_MOTION = 'pressed stop';

interface PressDown {
  x: number;
  y: number;
  t: number;
  el: Element | null;
  repeat: boolean;
}

function rectHas(r: DOMRect, x: number, y: number): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

export class RawCollector {
  inputClass: InputClass = 'mouse';
  /** Tab zoom when the flow started; every px value is reported as CSS px x zoom. */
  zoom = 1;
  readonly skipped = new Set<TaskId>();
  readonly done = new Set<TaskId>();

  /** R1 choice as CSS px on this page (not zoom-scaled), for sizing later screens. */
  comfortCssPx: number | null = null;
  largePrint = false;
  /** Rough critical size from R2 in CSS px, display and sizing only. */
  roughCriticalCssPx: number | null = null;
  roughTargetPx: number | null = null;
  ladderMedianRtMs: number | null = null;
  express = false;

  ladder: Array<{ px: number; ms: number; correct: boolean }> = [];
  faint: Array<{ contrast: number; correct: boolean }> = [];
  lightMs: number[] = [];
  darkMs: number[] = [];
  stated: Polarity | null = null;
  blocks: Array<{ sizePx: number; presses: RingPress[] }> = [];
  findTrials: Array<{ clutter: boolean; motion: boolean; ms: number; found: boolean }> = [];
  preferredCalm = 0;
  gotInWay: string[] = [];
  stoppedMotion = false;
  readonly presses: Array<{ slipped: boolean; repeat: boolean }> = [];

  private activeMs = 0;
  private runningSince: number | null = null;
  private down: PressDown | null = null;
  private lastUp: { x: number; y: number; t: number; el: Element | null } | null = null;

  /* ---------------- active time (pauses and hidden tabs excluded) ---------------- */

  startClock(): void {
    if (this.runningSince === null) this.runningSince = performance.now();
  }

  stopClock(): void {
    if (this.runningSince !== null) {
      this.activeMs += performance.now() - this.runningSince;
      this.runningSince = null;
    }
  }

  get durationSec(): number {
    const live = this.runningSince === null ? 0 : performance.now() - this.runningSince;
    return Math.round((this.activeMs + live) / 1000);
  }

  /* ---------------- presses anywhere in the flow ---------------- */

  private isRepeat(x: number, y: number, t: number, el: Element | null): boolean {
    const last = this.lastUp;
    if (!last || t - last.t > 500) return false;
    return Math.hypot(x - last.x, y - last.y) <= 5 || (el !== null && el === last.el);
  }

  onPointerDown(e: PointerEvent): void {
    if (!e.isPrimary) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('[data-ring]')) return; // the ring reports its own presses
    const el = target?.closest('button, a, [role="button"], [data-press]') ?? null;
    this.down = { x: e.clientX, y: e.clientY, t: e.timeStamp, el, repeat: this.isRepeat(e.clientX, e.clientY, e.timeStamp, el) };
  }

  onPointerUp(e: PointerEvent): void {
    const d = this.down;
    if (!d || !e.isPrimary) return;
    this.down = null;
    const slipped = d.el ? !rectHas(d.el.getBoundingClientRect(), e.clientX, e.clientY) : false;
    this.presses.push({ slipped, repeat: d.repeat });
    this.lastUp = { x: e.clientX, y: e.clientY, t: e.timeStamp, el: d.el };
  }

  /** Ring presses: the ring knows the dot geometry, so it decides slipped itself. */
  ringPress(downX: number, downY: number, downT: number, upX: number, upY: number, upT: number, slipped: boolean): boolean {
    const repeat = this.isRepeat(downX, downY, downT, null);
    this.presses.push({ slipped, repeat });
    this.lastUp = { x: upX, y: upY, t: upT, el: null };
    return repeat;
  }

  /* ---------------- tasks ---------------- */

  skip(id: TaskId): void {
    if (!this.done.has(id)) this.skipped.add(id);
  }

  complete(id: TaskId): void {
    this.done.add(id);
    this.skipped.delete(id);
  }

  /** px as reported to core: CSS px scaled by the tab zoom, so it means px at 100%. */
  eff(cssPx: number): number {
    return Math.round(cssPx * this.zoom * 10) / 10;
  }

  toRaw(): FittingRaw {
    const readingTouched = READING_TASKS.some((t) => this.done.has(t));
    const findingTouched = FINDING_TASKS.some((t) => this.done.has(t));
    const gotInWay = [...this.gotInWay];
    if (this.stoppedMotion && !gotInWay.includes(STOPPED_MOTION)) gotInWay.push(STOPPED_MOTION);
    return {
      inputClass: this.inputClass,
      durationSec: this.durationSec,
      skipped: [...this.skipped],
      reading: readingTouched
        ? {
            seedPx: this.comfortCssPx === null ? null : this.eff(this.comfortCssPx),
            ladder: this.ladder.map((t) => ({ ...t })),
            faint: this.faint.map((t) => ({ ...t })),
            polarity: { lightMs: [...this.lightMs], darkMs: [...this.darkMs], stated: this.stated },
          }
        : null,
      pointing: this.blocks.length
        ? { blocks: this.blocks.map((b) => ({ sizePx: b.sizePx, presses: b.presses.map((p) => ({ ...p })) })) }
        : null,
      finding: findingTouched
        ? { trials: this.findTrials.map((t) => ({ ...t })), preferredCalm: this.preferredCalm, gotInWay }
        : null,
      allPresses: this.presses.map((p) => ({ ...p })),
    };
  }
}
