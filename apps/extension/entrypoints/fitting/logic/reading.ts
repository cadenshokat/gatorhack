// Reading size: short sentences that step down by about 0.1 log units.
// Critical print size is the smallest size before speed falls more than 20% from the person's top speed.
// Body text is about 1.4× that size, and never under 16. Core's deriveFit still receives the trials;
// the fitting applies this estimate on top because the saved fit has no other place for it.

export const LOG_STEP = 0.1;
export const MOTOR_MS = 400;
/** Top speed under this (words per minute) asks for help with long reading. */
export const SLOW_WPM = 100;
const DROP = 0.2;

export interface SpeedTrial {
  px: number;
  ms: number;
  correct: boolean;
  chars: number;
}

export interface ReadingEstimate {
  cpsPx: number | null;
  bodyPx: number;
  topWpm: number | null;
  readingSupport: boolean;
  /** A smaller size fell off the pace, so the size above it is the one to keep. */
  dropped: boolean;
}

/** Largest sentence size that still fits the window as three lines. */
export function readingStartPx(width: number): number {
  if (width < 520) return 32;
  if (width < 800) return 40;
  return 48;
}

export function readingLadder(start = 48, count = 8): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(Math.round(start * 10 ** (-LOG_STEP * i) * 10) / 10);
  return out;
}

/** Words per minute for one sentence, after a small allowance for the tap. Null when it is not a reading time. */
export function wordsPerMinute(ms: number, chars: number): number | null {
  if (!(chars > 0) || !Number.isFinite(ms)) return null;
  const readingSec = ms / 1000 - MOTOR_MS / 1000;
  if (!(readingSec > 0.25)) return null;
  const wpm = chars / 5 / (readingSec / 60);
  if (!Number.isFinite(wpm) || wpm <= 0 || wpm > 900) return null;
  return wpm;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** Body text from a critical print size: 1.4×, at least 16, rounded to the nearest 0.5 px. */
export function bodyFromCps(cpsPx: number): number {
  return Math.max(16, Math.round(cpsPx * 1.4 * 2) / 2);
}

export function estimateReading(trials: readonly SpeedTrial[]): ReadingEstimate {
  const bySize = new Map<number, number[]>();
  for (const t of trials) {
    if (!t.correct || !(t.px > 0)) continue;
    const wpm = wordsPerMinute(t.ms, t.chars);
    if (wpm == null) continue;
    const list = bySize.get(t.px) ?? [];
    list.push(wpm);
    bySize.set(t.px, list);
  }
  const speeds = [...bySize.entries()]
    .map(([px, wpms]) => ({ px, wpm: median(wpms) }))
    .sort((a, b) => b.px - a.px);
  if (!speeds.length) {
    return { cpsPx: null, bodyPx: 16, topWpm: null, readingSupport: false, dropped: false };
  }
  const topWpm = Math.max(...speeds.map((s) => s.wpm));
  const floor = topWpm * (1 - DROP);
  let cps: number | null = null;
  let dropped = false;
  for (const s of speeds) {
    if (s.wpm + 1e-6 >= floor) cps = s.px;
    else {
      dropped = true;
      break;
    }
  }
  const cpsPx = cps == null ? null : Math.round(cps * 10) / 10;
  return {
    cpsPx,
    bodyPx: cpsPx == null ? 16 : bodyFromCps(cpsPx),
    topWpm: Math.round(topWpm),
    readingSupport: topWpm < SLOW_WPM,
    dropped,
  };
}

/** Stop once the size has clearly fallen off, the ladder is done, or the section has run long enough. */
export function readingShouldStop(
  trials: readonly SpeedTrial[],
  planned: number,
  activeMs: number,
): 'drop' | 'max' | 'time' | null {
  const scored = trials.filter((t) => t.correct).length;
  const est = estimateReading(trials);
  if (scored >= 3 && est.dropped) return 'drop';
  if (trials.length >= planned) return 'max';
  if (activeMs >= 38_000 && scored >= 3) return 'time';
  return null;
}
