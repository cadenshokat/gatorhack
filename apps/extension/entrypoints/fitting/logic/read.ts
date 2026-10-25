// Read: sizing the sentence card and scaling times. Core's ReadPosterior picks the sizes and decides when to stop.

/** Fixed decision and press time, seconds (core uses the same). */
export const T0_S = 0.6;
/** Times are reported as if every sentence had 56 characters, so length differences cancel. */
export const STANDARD_CHARS = 56;

/** Reading time scaled to a standard-length sentence, keeping the fixed press time. */
export function normalizedMs(chars: number, rtMs: number): number {
  const t = Math.max(0, rtMs / 1000 - T0_S);
  return Math.round((T0_S + (t * STANDARD_CHARS) / Math.max(1, chars)) * 1000);
}

/**
 * The largest sentence size (CSS px) that fits the card: at least `minCh` characters per line, and the longest sentence
 * (58 characters) inside the card's height at line height 1.25.
 */
export function maxSentenceCss(cardW: number, cardH: number, charRatio: number, minCh = 13): number {
  let best = 16;
  for (let s = 16; s <= 200; s += 1) {
    const cpl = cardW / (charRatio * s);
    if (cpl < minCh) break;
    const lines = Math.ceil(58 / Math.max(1, cpl - 2)); // word wrap loses about two characters a line
    if (lines * 1.25 * s > cardH) break;
    best = s;
  }
  return best;
}
