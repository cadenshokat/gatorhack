// What WebAble does for this person, read from their saved settings (FitProfile).
// Six areas, each 0-100 for "how much WebAble helps here", plus the three plain lines the results page leads with.
// Pure and deterministic: the chart, the lines and the tests all read the same numbers.
import type { FitProfile } from '@webable/core';

export type NeedId = 'text' | 'faint' | 'buttons' | 'steady' | 'motion' | 'busy';

/** Chart order, clockwise from the top. */
export const NEED_ORDER: readonly NeedId[] = ['text', 'faint', 'buttons', 'steady', 'motion', 'busy'];

export const NEED_LABELS: Record<NeedId, string> = {
  text: 'Text size',
  faint: 'Faint text',
  buttons: 'Button size',
  steady: 'Steady clicks',
  motion: 'Moving things',
  busy: 'Busy pages',
};

/** Simplified busy pages are on for everyone, so this area never drops below this. */
export const BUSY_FLOOR = 35;

/** Below this a help is too small to lead with. */
const LINE_MIN = 12;

export interface Need {
  id: NeedId;
  label: string;
  value: number; // 0-100
}

/** A help line: `lead`, then `strong` (the value, shown in the accent), then `tail`. */
export interface HelpLine {
  id: NeedId;
  lead: string;
  strong?: string;
  tail?: string;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const finite = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** The text size WebAble shows, in whole px (a size the person set wins over the measured one). */
export function bodyPxOf(fit: FitProfile): number {
  return Math.round(finite(fit.text.override ?? fit.text.bodyPx, 16));
}

/** The smallest click area WebAble makes, in px, or null when it leaves click areas alone. */
export function minPxOf(fit: FitProfile): number | null {
  const t = fit.targets.minPx;
  return typeof t === 'number' && Number.isFinite(t) && t > 24 ? Math.round(t) : null;
}

/**
 * Text: none at the web's usual 16 px, all of it at 24 px and up (one and a half times the usual size). Log scale,
 * because size is felt as a ratio: 18 px is a little, 20 px some, 22 px a lot.
 */
export function textValue(px: number): number {
  if (!(px > 16.5)) return 0;
  return Math.round(clamp((100 * Math.log(px / 16)) / Math.log(1.5), 0, 100));
}

/** Click areas: none at 24 px (the usual minimum), some at 44 px, all of it at 72 px and up, log scale. */
export function buttonsValue(minPx: number | null): number {
  if (minPx == null || minPx <= 24) return 0;
  return Math.round(clamp((100 * Math.log(minPx / 24)) / Math.log(3), 0, 100));
}

export function needValues(fit: FitProfile): Need[] {
  const band = fit.contrast?.band ?? 'N';
  const slip = clamp(finite(fit.baselines?.slipRate, 0.02), 0, 1);
  const motionP = clamp(finite(fit.attention?.motion?.p, 0.3), 0, 1);
  const clutterP = clamp(finite(fit.attention?.clutter?.p, 0.25), 0, 1);
  const level = fit.attention?.structureLevel ?? 0;
  const values: Record<NeedId, number> = {
    text: textValue(bodyPxOf(fit)),
    // Everyone gets faint text lifted to the basic 4.5:1; "darker" and "darkest" go further.
    faint: band === 'S' ? 85 : band === 'M' ? 55 : 15,
    buttons: buttonsValue(minPxOf(fit)),
    // On/off helps sit mid-range and rise with how often clicks slipped or motion got in the way.
    steady: fit.clicks?.steady?.on ? Math.round(clamp(55 + slip * 200, 55, 85)) : 0,
    motion: fit.attention?.motion?.on ? Math.round(clamp(50 + motionP * 35, 50, 85)) : 0,
    busy: Math.round(clamp(Math.max(BUSY_FLOOR, level === 2 ? 80 : level === 1 ? 58 : 0, clutterP * 100), BUSY_FLOOR, 100)),
  };
  return NEED_ORDER.map((id) => ({ id, label: NEED_LABELS[id], value: values[id] }));
}

export function helpLine(id: NeedId, fit: FitProfile): HelpLine {
  switch (id) {
    case 'text':
      return { id, lead: 'Show text at ', strong: `${bodyPxOf(fit)} px`, tail: ', with headings kept in proportion.' };
    case 'faint':
      return { id, lead: 'Make faint grey text darker.' };
    case 'buttons':
      return { id, lead: 'Make buttons and links easier to hit, ', strong: `${minPxOf(fit) ?? 44} px`, tail: ' or larger.' };
    case 'steady':
      return { id, lead: 'Keep your click on the button you meant, even if your hand moves.' };
    case 'motion':
      return { id, lead: 'Pause slideshows and moving ads.' };
    case 'busy':
      return { id, lead: 'Show busy pages, like news and recipes, as a clean, simple page.' };
  }
}

const byValue = (a: Need, b: Need): number => b.value - a.value || NEED_ORDER.indexOf(a.id) - NEED_ORDER.indexOf(b.id);

/**
 * The three areas WebAble helps most, strongest first. Busy pages is always one of them (it applies to everyone);
 * the other two are the highest of the rest. Areas WebAble barely touches are left out, so a person who needs little
 * sees fewer, truer lines.
 */
export function topNeeds(fit: FitProfile, values: Need[] = needValues(fit)): Need[] {
  const busy = values.find((n) => n.id === 'busy') as Need;
  const rest = values.filter((n) => n.id !== 'busy' && n.value >= LINE_MIN).sort(byValue).slice(0, 2);
  return [...rest, busy].sort(byValue);
}

export function topHelps(fit: FitProfile, values: Need[] = needValues(fit)): HelpLine[] {
  return topNeeds(fit, values).map((n) => helpLine(n.id, fit));
}

/** Plain words for an amount, for the chart's hidden table (never a number). */
export function amountWords(value: number): string {
  if (value >= 70) return 'A lot';
  if (value >= 40) return 'Some';
  if (value >= LINE_MIN) return 'A little';
  return 'Not needed';
}
