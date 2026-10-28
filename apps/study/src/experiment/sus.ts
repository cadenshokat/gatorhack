// The System Usability Scale (Brooke, 1996; © Digital Equipment Corporation, 1986), with 7-point items (Finstad, 2010).
// The ten statements keep their order, meaning and alternating tone, so the standard scoring holds. Two wording changes,
// both used in published work: "these websites" for "this system" (the all-positive SUS of Sauro & Lewis 2011 already
// said "website"; one round's 3 websites are rated together) and "awkward" for "cumbersome" (Finstad 2006; Bangor,
// Kortum & Miller 2008). Instrument 1.1.0 from 27 Oct 2026; 1.0.0 used the original words.
// Scoring: odd items give r − 1, even items 7 − r, each 0–6; the sum (0–60) × 100/60 gives 0–100. No score unless all
// ten are answered (never imputed). Scores are compared within this study only, never graded against 5-point norms.

import type { Likert7, SusResponse } from '../contracts';

export const SUS_INSTRUMENT = 'sus-brooke-1996-en-7pt-websites-awkward@1.1.0' as const;

export const SUS_ITEMS: readonly string[] = [
  'I think that I would like to use these websites frequently.',
  'I found these websites unnecessarily complex.',
  'I thought these websites were easy to use.',
  'I think that I would need the support of a technical person to be able to use these websites.',
  'I found the various functions in these websites were well integrated.',
  'I thought there was too much inconsistency in these websites.',
  'I would imagine that most people would learn to use these websites very quickly.',
  'I found these websites very awkward to use.',
  'I felt very confident using these websites.',
  'I needed to learn a lot of things before I could get going with these websites.',
];

/** Opposite-tone pairs (1-based) a careful respondent rarely agrees with both of (Sauro & Lewis 2011). */
const OPPOSITE_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [3, 2],
  [3, 8],
  [9, 4],
  [7, 10],
];

/** One item's contribution, 0–6. `item` is 1-based. */
export function contribution(item: number, r: Likert7): number {
  return item % 2 === 1 ? r - 1 : 7 - r;
}

/** 0–100, or null unless all ten items are answered. */
export function susScore(items: ReadonlyArray<Likert7 | null>): number | null {
  if (items.length !== 10 || items.some((r) => r == null)) return null;
  const sum = items.reduce<number>((s, r, i) => s + contribution(i + 1, r as Likert7), 0);
  return Math.round(((sum * 100) / 60) * 100) / 100;
}

/** The preregistered sensitivity score: with exactly one item missing, sum × 100/54. Never the primary score. */
export function susProrated(items: ReadonlyArray<Likert7 | null>): number | null {
  const missing = items.filter((r) => r == null).length;
  if (items.length !== 10 || missing > 1) return null;
  if (missing === 0) return susScore(items);
  const sum = items.reduce<number>((s, r, i) => (r == null ? s : s + contribution(i + 1, r)), 0);
  return Math.round(((sum * 100) / 54) * 100) / 100;
}

/** All ten answers identical, or two or more opposite pairs both answered 6 or above. */
export function susFlagged(items: ReadonlyArray<Likert7 | null>): boolean {
  const given = items.filter((r): r is Likert7 => r != null);
  if (given.length === 10 && given.every((r) => r === given[0])) return true;
  let both = 0;
  for (const [a, b] of OPPOSITE_PAIRS) {
    const ra = items[a - 1];
    const rb = items[b - 1];
    if (ra != null && rb != null && ra >= 6 && rb >= 6) both++;
  }
  return both >= 2;
}

export function susResponse(items: ReadonlyArray<Likert7 | null>, submittedAt: string | null): SusResponse {
  return {
    instrument: SUS_INSTRUMENT,
    items: [...items],
    score: susScore(items),
    answered: items.filter((r) => r != null).length,
    flagged: susFlagged(items),
    submittedAt,
  };
}
