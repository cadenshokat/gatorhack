// R2 reading ladder: the walk that picks the next sentence size. Core's deriveFit does the scoring;
// this file only decides which size to show next and when to stop (fitting brief §3 R2).

import { clamp, median } from './rand';

/** Fixed decision and press time, seconds. */
export const T0_S = 0.6;
/** Raw times are reported as if every sentence had this many characters, so length differences cancel. */
export const STANDARD_CHARS = 56;
const EPS = 1e-6;

export interface LadderResponse {
  correct: boolean;
  cantRead: boolean;
  rtMs: number;
  chars: number;
}

export interface LadderTrial extends LadderResponse {
  logPx: number;
  px: number;
  wpm: number;
  y: number;
  onPlateau: boolean;
}

export function wpmFor(chars: number, rtMs: number): number {
  const t = Math.max(0.05, rtMs / 1000 - T0_S);
  return Math.min(900, (60 * (chars / 6)) / t);
}

/** Reading time scaled to a standard-length sentence, keeping the fixed press time. */
export function normalizedMs(chars: number, rtMs: number): number {
  const t = Math.max(0, rtMs / 1000 - T0_S);
  return Math.round((T0_S + (t * STANDARD_CHARS) / Math.max(1, chars)) * 1000);
}

export function roundPx(px: number): number {
  return Math.round(px * 10) / 10;
}

type Phase = 'A' | 'B' | 'up' | 'done';

export class ReadingLadder {
  readonly trials: LadderTrial[] = [];
  displayLimited = false;
  private phase: Phase = 'A';
  private nextLog: number | null;
  private queue: number[] = [];
  private activeMs = 0;
  private retested = false;
  private readonly minLog: number;
  private readonly maxLog: number;

  constructor(
    startPx: number,
    minPx: number,
    maxPx: number,
    private readonly maxTrials = 9,
    private readonly maxActiveMs = 35_000,
  ) {
    this.minLog = Math.log10(minPx);
    this.maxLog = Math.log10(Math.max(minPx, maxPx));
    this.nextLog = Math.log10(clamp(startPx, minPx, maxPx));
  }

  get done(): boolean {
    return this.phase === 'done' || this.nextLog === null;
  }

  /** Font size in CSS px for the next sentence, or null when the ladder is finished. */
  currentPx(): number | null {
    return this.nextLog === null || this.phase === 'done' ? null : roundPx(10 ** this.nextLog);
  }

  /** Share of the expected trials done, for the progress ruler. */
  progress(): number {
    if (this.done) return 1;
    return Math.min(0.95, this.trials.length / 7);
  }

  medianRtMs(): number {
    return median(this.trials.map((t) => t.rtMs));
  }

  private plateauWpm(): number {
    const on = this.trials.filter((t) => t.onPlateau).map((t) => t.wpm);
    return on.length ? median(on) : 0;
  }

  record(r: LadderResponse, trialActiveMs: number): void {
    if (this.done || this.nextLog === null) return;
    const x = this.nextLog;
    const wpm = wpmFor(r.chars, r.rtMs);
    const y = Math.log10(wpm);
    const readable = r.correct && !r.cantRead;
    const prior = this.trials.filter((t) => t.correct && !t.cantRead).map((t) => t.y);
    const maxY = Math.max(y, ...prior);
    const onPlateau = readable && y >= maxY - 0.1;
    this.trials.push({ ...r, logPx: x, px: roundPx(10 ** x), wpm, y, onPlateau });
    this.activeMs += trialActiveMs;

    if (this.trials.length >= this.maxTrials || this.activeMs >= this.maxActiveMs) {
      this.finish();
      return;
    }

    switch (this.phase) {
      case 'A': {
        if (!readable && !r.cantRead && !this.retested) {
          // One wrong answer while descending may be a slip of the finger: ask once more at the same size.
          this.retested = true;
          return;
        }
        if (this.trials.length <= 2 && !this.trials.some((t) => t.onPlateau) && !onPlateau) {
          // The starting size itself was not readable: one step up, then stop.
          this.displayLimited = true;
          const up = x + 0.1;
          if (up <= this.maxLog + EPS) {
            this.phase = 'up';
            this.nextLog = up;
          } else this.finish();
          return;
        }
        if (onPlateau) {
          if (x <= this.minLog + EPS) {
            this.finish();
            return;
          }
          this.nextLog = Math.max(x - 0.2, this.minLog);
          return;
        }
        // First size off the plateau: refine between it and the size above.
        this.phase = 'B';
        this.queue = [];
        const prev = this.trials[this.trials.length - 2];
        if (prev && prev.logPx - x >= 0.15) this.queue.push(x + 0.1);
        if (readable && wpm >= 0.5 * this.plateauWpm() && x - 0.1 >= this.minLog - EPS) this.queue.push(x - 0.1);
        this.advanceQueue();
        return;
      }
      case 'B': {
        // A second size off the plateau brackets the knee, and "Can't read it" below the plateau stops.
        if (!onPlateau) {
          this.finish();
          return;
        }
        this.advanceQueue();
        return;
      }
      default:
        this.finish();
    }
  }

  private advanceQueue(): void {
    const next = this.queue.shift();
    if (next === undefined) this.finish();
    else this.nextLog = next;
  }

  private finish(): void {
    this.phase = 'done';
    this.nextLog = null;
  }

  /** Rough critical size (font px) for sizing the later reading screens: the smallest size that is on
   *  the plateau along with every larger size. Display only; core's deriveFit computes the real one. */
  roughCriticalPx(): number | null {
    const sorted = this.trials.slice().sort((a, b) => b.logPx - a.logPx);
    let best: number | null = null;
    for (const t of sorted) {
      if (!t.onPlateau) break;
      best = t.px;
    }
    return best;
  }
}
