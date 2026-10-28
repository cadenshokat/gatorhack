// Who the study is for (protocol 2.0.0): people aged 50 or over who say that at least one kind of trouble with websites
// often happens to them: getting around a website, finding the information they need, or understanding what it says.
// No diagnosis or health question. Asked before the agreement; the answers stay on the phone and are saved only with
// the rest of the session, after "I agree to take part". Someone who is not eligible leaves with nothing saved.

import type { AboutYou, WebTrouble } from '../contracts';

/** The age answers: the four bands that can take part, and "Under 50". */
export type AgeAnswer = '50-64' | '65-74' | '75-84' | '85+' | 'under_50';

export const ELIGIBLE_AGES: ReadonlyArray<AgeAnswer> = ['50-64', '65-74', '75-84', '85+'];

export const TROUBLES: ReadonlyArray<WebTrouble> = ['getting_around', 'finding', 'understanding'];

export function eligible(age: AgeAnswer | null, troubles: readonly WebTrouble[] | null | undefined): boolean {
  return age != null && ELIGIBLE_AGES.includes(age) && !!troubles?.some((t) => TROUBLES.includes(t));
}

/** The screening answers as they are saved (only for someone who can take part). */
export function screened(about: AboutYou, age: AgeAnswer, troubles: readonly WebTrouble[]): AboutYou {
  return { ...about, ageBand: age === 'under_50' ? null : age, troubles: [...troubles] };
}
