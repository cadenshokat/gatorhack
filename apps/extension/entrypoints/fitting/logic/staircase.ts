// Faint words: contrast falls on a 2-down, 1-up staircase.
// Two reads in a row make the next word fainter. One miss makes it stronger.
// The threshold is the average contrast ratio at the turn-around points, mapped onto the fit's three bands.

import type { ContrastBand } from '@webable/core';
import { STIMULI, type GrayStimulus } from './quest';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function indexNearWeber(weber: number): number {
  let best = 0;
  let gap = Infinity;
  for (let i = 0; i < STIMULI.length; i++) {
    const d = Math.abs((STIMULI[i] as GrayStimulus).weber - weber);
    if (d < gap) {
      gap = d;
      best = i;
    }
  }
  return best;
}

/**
 * Map a threshold contrast ratio (WCAG, text against white) to a band.
 * A turn-around near black means the person needs strong text. A turn-around on faint grey does not.
 * 7:1 and 3.5:1 are the same floors the rest of WebAble already uses for "strong" and "a bit more".
 */
export function bandFromRatio(ratio: number): ContrastBand {
  if (!(ratio > 1)) return 'N';
  if (ratio >= 7) return 'S';
  if (ratio >= 3.5) return 'M';
  return 'N';
}

export class ContrastStaircase {
  private index: number;
  private step: number;
  private run = 0;
  private dir: -1 | 1 | 0 = 0;
  private readonly reversals: number[] = [];
  trials = 0;
  finished = false;

  constructor() {
    this.index = indexNearWeber(0.55);
    this.step = 18;
  }

  current(): GrayStimulus {
    return STIMULI[this.index] as GrayStimulus;
  }

  /** Record one pick. `correct` means they chose the word that was shown. */
  record(correct: boolean): void {
    if (this.finished) return;
    this.trials += 1;
    if (correct) {
      this.run += 1;
      if (this.run < 2) {
        this.finishIfReady();
        return;
      }
      this.run = 0;
      this.move(1);
    } else {
      this.run = 0;
      this.move(-1);
    }
    this.finishIfReady();
  }

  private move(nextDir: -1 | 1): void {
    if (this.dir !== 0 && nextDir !== this.dir) {
      this.reversals.push(this.current().ratio);
      if (this.reversals.length === 2) this.step = 8;
    }
    this.dir = nextDir;
    const next = clamp(this.index + nextDir * this.step, 0, STIMULI.length - 1);
    this.index = next;
  }

  private finishIfReady(): void {
    const atFloor = this.index === 0 && this.dir < 0 && this.trials >= 3;
    const atCeiling = this.index === STIMULI.length - 1 && this.dir > 0 && this.run === 0 && this.trials >= 3;
    if (this.reversals.length >= 4 || this.trials >= 12 || atFloor || atCeiling) this.finished = true;
  }

  /** Mean contrast ratio at the turn-arounds, or the current level when there were not two turns. */
  thresholdRatio(): number | null {
    if (this.trials === 0) return null;
    if (this.reversals.length < 2) return this.current().ratio;
    const last = this.reversals.slice(-4);
    return last.reduce((a, b) => a + b, 0) / last.length;
  }

  band(): ContrastBand {
    const ratio = this.thresholdRatio();
    if (ratio == null) return 'N';
    if (this.index === STIMULI.length - 1 && this.reversals.length < 2) return 'N';
    return bandFromRatio(ratio);
  }
}
