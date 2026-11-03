// Who the study is for (protocol 2.0.0): people aged 50 and over who often have trouble using websites: getting around
// a website, finding the information they need, or understanding what it says. From 4.3.0 the only answers that stop
// someone are "Under 50" together with "None of these"; any other pair goes on. No diagnosis or health question. From 3.0.0 asked right after the agreement (the committee's order: information,
// agreement, then questions); nothing is sent until these answers pass, so someone who is not eligible leaves with
// nothing saved.

import type { AboutYou, WebTrouble } from '../contracts';

/** The age answers: the four bands that can take part, and "Under 50". */
export type AgeAnswer = '50-64' | '65-74' | '75-84' | '85+' | 'under_50';

export const ELIGIBLE_AGES: ReadonlyArray<AgeAnswer> = ['50-64', '65-74', '75-84', '85+'];

export const TROUBLES: ReadonlyArray<WebTrouble> = ['getting_around', 'finding', 'understanding'];

export function eligible(age: AgeAnswer | null, troubles: readonly WebTrouble[] | null | undefined): boolean {
  if (age == null || troubles == null) return false;
  return ELIGIBLE_AGES.includes(age) || troubles.some((t) => TROUBLES.includes(t));
}

/** The screening answers as they are saved (only for someone who can take part), "Under 50" included from 4.3.0. */
export function screened(about: AboutYou, age: AgeAnswer, troubles: readonly WebTrouble[]): AboutYou {
  return { ...about, ageBand: age, troubles: [...troubles] };
}
