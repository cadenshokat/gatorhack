// UMUX-Lite (Lewis, Utesch & Maher, CHI 2013): two statements after each round in place of the ten SUS statements
// (protocol 4.0.0, to keep the study near 15 minutes). Answered 1–7 with words on every answer, as the SUS was.
// Plain wording for this study: "capabilities meet my requirements" becomes "let me do what I needed to do".
// Score = (item1 − 1 + item2 − 1) × 100 / 12, from 0 to 100; null unless both are answered; never imputed.

import type { Likert7, UmuxResponse } from '../contracts';

export const UMUX_ITEMS = ['These websites let me do what I needed to do.', 'These websites were easy to use.'] as const;

export function umuxResponse(items: [Likert7 | null, Likert7 | null], at: string): UmuxResponse {
  const [a, b] = items;
  const score = a != null && b != null ? Math.round(((a - 1 + (b - 1)) * 100 * 10) / 12) / 10 : null;
  return { instrument: 'umux-lite-lewis-2013-en-7pt-plain@1.0.0', items: [a, b], score, submittedAt: at };
}
