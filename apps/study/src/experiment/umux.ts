// UMUX (Finstad 2010): four statements after each round (protocol 4.3.0; 4.0.0 to 4.2.0 asked only UMUX-Lite's two).
// Statements 1 and 3 are UMUX-Lite (Lewis, Utesch & Maher, CHI 2013), so `score` stays the UMUX-Lite score and is
// comparable with earlier sessions; `umux` is the full UMUX score. Answered 1–7 with words on every answer, as the SUS
// was. Plain wording for this study: "capabilities meet my requirements" becomes "let me do what I needed to do", and
// "correcting things" becomes "fixing mistakes".
// UMUX-Lite = (s1 − 1 + s3 − 1) × 100 / 12. UMUX = (s1 − 1 + 7 − s2 + s3 − 1 + 7 − s4) × 100 / 24 (2 and 4 are
// negative). Both run 0 to 100, and are null unless their statements are all answered; never imputed.

import type { Likert7, UmuxResponse } from '../contracts';

export const UMUX_ITEMS = [
  'These websites let me do what I needed to do.',
  'Using these websites was frustrating.',
  'These websites were easy to use.',
  'I had to spend too much time fixing mistakes on these websites.',
] as const;

const tenth = (x: number) => Math.round(x * 10) / 10;

export function umuxResponse(items: Array<Likert7 | null>, at: string): UmuxResponse {
  const [a, b, c, d] = items;
  const score = a != null && c != null ? tenth(((a - 1 + (c - 1)) * 100) / 12) : null;
  const umux = a != null && b != null && c != null && d != null ? tenth(((a - 1 + (7 - b) + (c - 1) + (7 - d)) * 100) / 24) : null;
  return { instrument: 'umux-finstad-2010-en-7pt-plain@1.0.0', items: [...items], score, umux, submittedAt: at };
}
