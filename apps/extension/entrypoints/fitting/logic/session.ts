// Turns a shared fit plus this onboarding's own measurements into the fit we save.
// The shared reader still builds the fit. These fields are the ones this round measures directly.
// Optional extras (reading speed, colour crossings) are not part of FitProfile yet.

import type { BrowserSettings, ContrastBand, FitProfile, Polarity, StructureLevel } from '@webable/core';
import type { ColourNeed } from './colour';
import type { OnboardingExtras } from './needs';

export interface SessionMeasures {
  reading: {
    cpsPx: number | null;
    bodyPx: number;
    topWpm: number | null;
    readingSupport: boolean;
    dropped: boolean;
  } | null;
  band: ContrastBand | null;
  polarity: Polarity | null;
  minPx: number | null;
  steady: boolean;
  debounce: boolean;
  clutterP: number | null;
  structureLevel: StructureLevel | null;
  motionOn: boolean;
  motionP: number;
  colour: ColourNeed | null;
  keyboard: boolean;
}

export function emptyMeasures(keyboard: boolean): SessionMeasures {
  return {
    reading: null,
    band: null,
    polarity: null,
    minPx: null,
    steady: false,
    debounce: false,
    clutterP: null,
    structureLevel: null,
    motionOn: false,
    motionP: 0.3,
    colour: null,
    keyboard,
  };
}

export function applySession(
  base: FitProfile,
  measures: SessionMeasures,
  settings: BrowserSettings | null,
): FitProfile & OnboardingExtras {
  const fit: FitProfile & OnboardingExtras = JSON.parse(JSON.stringify(base)) as FitProfile & OnboardingExtras;
  const lockedColours = !!settings?.forcedColors;

  if (measures.reading?.cpsPx != null) {
    const body = measures.reading.bodyPx;
    fit.text = {
      ...fit.text,
      bodyPx: body,
      cpsPx: measures.reading.cpsPx,
      largePrint: body >= 32,
      conf: measures.reading.dropped ? 0.8 : 0.55,
      source: 'measured',
      override: null,
    };
    fit.measure = { ...fit.measure, minCpl: body >= 32 ? 8 : 13 };
    if (measures.reading.topWpm != null) fit.topWpm = measures.reading.topWpm;
    fit.readingSupport = measures.reading.readingSupport;
  }

  if (!lockedColours && measures.band) {
    const band = measures.band;
    fit.contrast = { band, floor: band === 'S' ? 15 : band === 'M' ? 7 : 4.5 };
    fit.weight = { floor: band === 'S' ? 600 : band === 'M' ? 500 : 400 };
  }

  if (!lockedColours && measures.polarity && measures.polarity !== 'none') {
    fit.polarity = { value: measures.polarity, stated: measures.polarity };
  }

  if (!measures.keyboard && measures.minPx != null) {
    fit.targets = { minPx: measures.minPx, conf: 0.7 };
    fit.clicks.steady.radiusPx = Math.round(Math.min(measures.minPx / 2, Math.max(6, measures.minPx / 5)));
  }
  if (!measures.keyboard && measures.steady) fit.clicks.steady.on = true;
  if (!measures.keyboard && measures.debounce) fit.clicks.debounce = true;

  if (measures.clutterP != null) {
    fit.attention.clutter = { p: measures.clutterP };
    if (measures.structureLevel != null) fit.attention.structureLevel = measures.structureLevel;
    // A system setting that already holds motion still stays on. The game's probability is written either way.
    if (settings?.reducedMotion) {
      fit.attention.motion = { on: true, p: Math.max(fit.attention.motion.p, measures.motionP) };
    } else {
      fit.attention.motion = { on: measures.motionOn, p: measures.motionP };
    }
  } else if (measures.motionOn) {
    fit.attention.motion = { on: true, p: Math.max(fit.attention.motion.p, measures.motionP) };
  }

  if (measures.reading || measures.band) {
    fit.spacing = {
      ...fit.spacing,
      lineHeight: fit.contrast.band === 'S' || fit.text.largePrint ? 1.8 : fit.contrast.band === 'M' ? 1.6 : 1.5,
    };
  }

  if (measures.colour) fit.colourNeed = measures.colour;
  return fit;
}
