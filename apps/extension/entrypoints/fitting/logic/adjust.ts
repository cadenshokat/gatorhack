// One tap on a results row: a little less, a little more, or off.
// Each tap changes the same fields the rest of WebAble already reads.

import type { ContrastBand, FitProfile, StructureLevel } from '@webable/core';
import { cloneFit, effectiveTextPx, stepText } from './fitview';
import type { NeedId, OnboardingExtras } from './needs';

export type AdjustDir = 'less' | 'more' | 'off';
type Fit = FitProfile & OnboardingExtras;

const BANDS: ContrastBand[] = ['N', 'M', 'S'];

function bandIndex(band: ContrastBand): number {
  const i = BANDS.indexOf(band);
  return i < 0 ? 0 : i;
}

function applyBand(fit: Fit, band: ContrastBand): void {
  fit.contrast = { band, floor: band === 'S' ? 15 : band === 'M' ? 7 : 4.5 };
  fit.weight = { floor: band === 'S' ? 600 : band === 'M' ? 500 : 400 };
}

function buttonStep(minPx: number | null, dir: AdjustDir): number | null {
  if (dir === 'off') return null;
  const current = minPx ?? 0;
  if (dir === 'more') {
    if (current < 44) return 44;
    if (current < 72) return 72;
    return 96;
  }
  if (current <= 44) return null;
  if (current <= 72) return 44;
  if (current <= 96) return 72;
  return 96;
}

function lineStep(lineHeight: number, dir: AdjustDir): number {
  const steps = [1.5, 1.6, 1.8];
  const index = lineHeight >= 1.7 ? 2 : lineHeight >= 1.55 ? 1 : 0;
  if (dir === 'off') return 1.5;
  const next = index + (dir === 'more' ? 1 : -1);
  return steps[Math.min(2, Math.max(0, next))] ?? 1.5;
}

export function adjustNeed(base: Fit, id: NeedId, dir: AdjustDir): Fit {
  const fit = cloneFit(base) as Fit;
  if (base.topWpm != null) fit.topWpm = base.topWpm;
  if (base.readingSupport != null) fit.readingSupport = base.readingSupport;
  if (base.colourNeed) fit.colourNeed = { ...base.colourNeed, axes: [...base.colourNeed.axes] };
  if (base.colourAssist != null) fit.colourAssist = base.colourAssist;

  switch (id) {
    case 'small_text': {
      const current = effectiveTextPx(fit);
      const next = dir === 'off' ? 16 : stepText(current, dir === 'more' ? 1 : -1);
      fit.text = {
        ...fit.text,
        bodyPx: next,
        override: next <= 16.5 ? null : next,
        largePrint: next >= 32,
        source: fit.text.source === 'default' ? 'stated' : fit.text.source,
      };
      fit.measure = { ...fit.measure, minCpl: next >= 32 ? 8 : 13 };
      fit.layout = { column: next >= 29 ? 'auto' : 'off' };
      break;
    }
    case 'faint_text': {
      const next = dir === 'off' ? 0 : bandIndex(fit.contrast.band) + (dir === 'more' ? 1 : -1);
      applyBand(fit, BANDS[Math.min(2, Math.max(0, next))] ?? 'N');
      break;
    }
    case 'small_buttons': {
      const minPx = buttonStep(fit.targets.minPx, dir);
      fit.targets = { minPx, conf: minPx == null ? 0 : 1 };
      fit.clicks.steady.radiusPx = minPx ? Math.round(Math.min(minPx / 2, Math.max(6, minPx / 5))) : 10;
      break;
    }
    case 'steady_clicking': {
      const level = fit.clicks.steady.on && fit.clicks.debounce ? 2 : fit.clicks.steady.on ? 1 : 0;
      const next = dir === 'off' ? 0 : Math.min(2, Math.max(0, level + (dir === 'more' ? 1 : -1)));
      fit.clicks.steady.on = next >= 1;
      fit.clicks.debounce = next >= 2;
      break;
    }
    case 'moving_things': {
      if (dir === 'off' || (dir === 'less' && fit.attention.motion.p < 0.75)) {
        fit.attention.motion = { on: false, p: 0.2 };
      } else if (dir === 'less') {
        fit.attention.motion = { on: true, p: 0.55 };
      } else {
        const p = fit.attention.motion.on ? Math.min(0.92, fit.attention.motion.p + 0.2) : 0.62;
        fit.attention.motion = { on: true, p: Math.max(0.62, p) };
      }
      break;
    }
    case 'busy_pages': {
      const level = fit.attention.structureLevel;
      const next = (dir === 'off' ? 0 : Math.min(2, Math.max(0, level + (dir === 'more' ? 1 : -1)))) as StructureLevel;
      fit.attention.structureLevel = next;
      fit.attention.clutter = { p: next === 2 ? 0.86 : next === 1 ? 0.58 : 0.2 };
      break;
    }
    case 'long_reading': {
      const lineHeight = lineStep(fit.spacing.lineHeight, dir);
      fit.spacing = { ...fit.spacing, lineHeight };
      fit.readingSupport = lineHeight > 1.5 || (dir !== 'off' && dir !== 'less' && !!fit.readingSupport);
      if (lineHeight <= 1.5) fit.readingSupport = false;
      break;
    }
    case 'telling_colours': {
      const score = fit.colourNeed?.score ?? 0;
      const axes = fit.colourNeed?.axes ?? [];
      const crossings = fit.colourNeed?.crossings ?? 0;
      if (dir === 'off' || (dir === 'less' && score < 75)) {
        fit.colourAssist = false;
        fit.colourNeed = { crossings, score: 0, axes };
      } else if (dir === 'less') {
        fit.colourAssist = true;
        fit.colourNeed = { crossings, score: 55, axes };
      } else {
        fit.colourAssist = true;
        fit.colourNeed = { crossings, score: score < 48 ? 55 : Math.min(100, Math.max(85, score)), axes };
      }
      break;
    }
  }
  return fit;
}
