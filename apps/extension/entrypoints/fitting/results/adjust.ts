// The "Adjust anything" rows: each control turns the current settings into the next FitProfile.
// Kept in step with core's deriveFit(), so a value set here means the same thing to the engine as a measured one:
// a text size the person picks goes in text.override; faint text moves the contrast band with its floor, weight and
// line height; click areas set targets.minPx and the steady-click radius that follows from it.
import type { ContrastBand, FitProfile, Polarity } from '@webable/core';

export const TEXT_LADDER: readonly number[] = [16, 18, 20, 22, 24, 28, 32, 36];
export const BUTTON_SIZES: readonly number[] = [32, 44, 56, 72, 96];

export type FaintLevel = 'off' | 'darker' | 'darkest';
export type ButtonChoice = 'off' | number;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const currentText = (fit: FitProfile): number => fit.text.override ?? fit.text.bodyPx;

/** The next text size one ladder step up (+1) or down (-1), or null at either end. */
export function nextTextSize(fit: FitProfile, dir: 1 | -1): number | null {
  const now = currentText(fit);
  if (dir > 0) return TEXT_LADDER.find((v) => v > now + 0.25) ?? null;
  for (let i = TEXT_LADDER.length - 1; i >= 0; i--) {
    const v = TEXT_LADDER[i] as number;
    if (v < now - 0.25) return v;
  }
  return null;
}

/** A size the person picks is stored as an override; picking the measured size again clears it. */
export function withTextSize(fit: FitProfile, px: number): FitProfile {
  const override = Math.abs(px - fit.text.bodyPx) < 0.25 ? null : px;
  return { ...fit, text: { ...fit.text, override } };
}

export function stepText(fit: FitProfile, dir: 1 | -1): FitProfile {
  const next = nextTextSize(fit, dir);
  return next == null ? fit : withTextSize(fit, next);
}

export function faintLevel(fit: FitProfile): FaintLevel {
  return fit.contrast.band === 'S' ? 'darkest' : fit.contrast.band === 'M' ? 'darker' : 'off';
}

/** Off keeps the basic 4.5:1 lift every page gets; darker is 7:1; darkest is the strongest. */
export function withFaint(fit: FitProfile, level: FaintLevel): FitProfile {
  const band: ContrastBand = level === 'darkest' ? 'S' : level === 'darker' ? 'M' : 'N';
  const floor = band === 'S' ? 15 : band === 'M' ? 7 : 4.5;
  const weight = band === 'S' ? 600 : band === 'M' ? 500 : 400;
  const lineHeight = band === 'S' || fit.text.largePrint ? 1.8 : band === 'M' ? 1.6 : 1.5;
  return {
    ...fit,
    contrast: { band, floor },
    weight: { ...fit.weight, floor: weight },
    spacing: { ...fit.spacing, lineHeight },
  };
}

export function withPolarity(fit: FitProfile, value: Polarity): FitProfile {
  return { ...fit, polarity: { value, stated: value } };
}

export function buttonChoice(fit: FitProfile): ButtonChoice {
  const t = fit.targets.minPx;
  if (t == null || !Number.isFinite(t) || t <= 24) return 'off';
  let best = BUTTON_SIZES[0] as number;
  for (const s of BUTTON_SIZES) if (Math.abs(s - t) < Math.abs(best - t)) best = s;
  return best;
}

export function withButtons(fit: FitProfile, choice: ButtonChoice): FitProfile {
  const minPx = choice === 'off' ? null : choice;
  const radiusPx = minPx ? Math.round(clamp(minPx / 5, 6, minPx / 2)) : 10;
  return {
    ...fit,
    targets: { minPx, conf: minPx == null ? 0 : 1 },
    clicks: { ...fit.clicks, steady: { ...fit.clicks.steady, radiusPx } },
  };
}

export function withSteady(fit: FitProfile, on: boolean): FitProfile {
  return { ...fit, clicks: { ...fit.clicks, steady: { ...fit.clicks.steady, on } } };
}

export function withMotion(fit: FitProfile, on: boolean): FitProfile {
  return { ...fit, attention: { ...fit.attention, motion: { ...fit.attention.motion, on } } };
}
