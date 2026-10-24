import type { Sentence } from '../content/sentences';
import type { Env } from '../logic/env';
import type { RawCollector } from '../logic/raw';

export interface ScreenProps {
  raw: RawCollector;
  env: Env;
  paused: boolean;
  /** 0..1 progress inside this screen, for the ruler. */
  onProgress: (f: number) => void;
  onDone: () => void;
}

export interface SentenceSource {
  next: () => Sentence;
}

/** The comfortable size from R1 (CSS px), or the R1 starting size when R1 was skipped. */
export function seedCssPx(props: ScreenProps): number {
  return props.raw.comfortCssPx ?? Math.max(1.5 * props.env.defaultFontPx, 24);
}

/** Rough comfortable reading size in CSS px for sizing later stimuli: critical size x 1.26 when known. */
export function comfortableCssPx(props: ScreenProps): number {
  const cps = props.raw.roughCriticalCssPx;
  if (cps) return cps * 1.26;
  if (props.raw.comfortCssPx) return props.raw.comfortCssPx * 0.8;
  return 16;
}
