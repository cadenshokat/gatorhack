// A fit, seen three ways: how the stage page looks with it, the five marks on the fit strip, and the plain rows on the
// last screen ("Bigger text: 22 px. You read fastest from this size up."). Rows name page changes, never the person.

import {
  contrastRatio, deriveFit, fitSources, liftToRatio, parseColor, planPageZoom,
  type BrowserSettings, type ContrastBand, type FitDimension, type FitProfile, type FitSource, type FittingRaw,
  type Polarity, type StructureLevel, type WarmupCalibration, type WarmupMetrics,
} from '@webable/core';
import type { MarkId } from './plan';

export function cloneFit(fit: FitProfile): FitProfile {
  return JSON.parse(JSON.stringify(fit)) as FitProfile;
}

export function effectiveTextPx(fit: FitProfile): number {
  return fit.text.override ?? fit.text.bodyPx;
}

/** deriveFit with the browser settings; never throws (a conservative default keeps the page working). */
export function deriveSafely(raw: FittingRaw, settings: BrowserSettings | null, metrics?: WarmupMetrics): FitProfile {
  try {
    return deriveFit(raw, { settings, metrics: metrics ?? null });
  } catch (err) {
    console.warn('[WebAble warm-up] deriveFit failed; keeping defaults', err);
    return deriveFit({ inputClass: raw.inputClass, durationSec: raw.durationSec, skipped: raw.skipped, reading: null, pointing: null, finding: null, allPresses: [] });
  }
}

/* ------------------------------------------------------------------ */
/* What the person changed on the last screen                          */
/* ------------------------------------------------------------------ */

/** Text sizes one Chrome zoom step apart on a 16 px page (110% changes too little to act on). */
export const TEXT_LADDER = [16, 20, 24, 28, 32, 40, 48];
export const TARGET_CHOICES: Array<number | null> = [null, 32, 44, 56, 72];

export interface Overrides {
  textPx?: number;
  band?: ContrastBand;
  targets?: number | null;
  steady?: boolean;
  motion?: boolean;
  level?: StructureLevel;
  polarity?: Polarity;
}

export type RowKey = 'text' | 'contrast' | 'targets' | 'steady' | 'motion' | 'calm' | 'colours';

const DIM_OF: Record<RowKey, FitDimension> = {
  text: 'text_size', contrast: 'contrast', targets: 'targets', steady: 'steady_clicks', motion: 'motion', calm: 'clutter', colours: 'colors',
};

/** The next text size up or down the ladder from the current one (snapping first when between steps). */
export function stepText(current: number, dir: -1 | 1): number {
  if (dir > 0) return TEXT_LADDER.find((v) => v > current + 0.25) ?? (TEXT_LADDER[TEXT_LADDER.length - 1] as number);
  const below = [...TEXT_LADDER].reverse().find((v) => v < current - 0.25);
  return below ?? (TEXT_LADDER[0] as number);
}

/** The fit with the person's own changes on top, and the sources updated ("You set this"). */
export function applyOverrides(base: FitProfile, ov: Overrides, colourChosen: boolean, settings: BrowserSettings | null = null): FitProfile {
  const fit = cloneFit(base);
  const cal = fit.calibration as WarmupCalibration;
  const sources: Partial<Record<FitDimension, FitSource>> = { ...(cal.sources ?? fitSources(base)) };
  const mark = (k: RowKey) => {
    sources[DIM_OF[k]] = 'person';
  };
  if (ov.textPx !== undefined && Math.abs(ov.textPx - fit.text.bodyPx) > 0.25) {
    fit.text.override = ov.textPx;
    fit.text.largePrint = ov.textPx >= 32;
    fit.measure.minCpl = ov.textPx >= 32 ? 8 : 13;
    mark('text');
  }
  if (ov.band !== undefined && ov.band !== fit.contrast.band) {
    fit.contrast = { band: ov.band, floor: ov.band === 'S' ? 15 : ov.band === 'M' ? 7 : 4.5 };
    fit.weight.floor = ov.band === 'S' ? 600 : ov.band === 'M' ? 500 : 400;
    fit.spacing.lineHeight = ov.band === 'S' || fit.text.largePrint ? 1.8 : ov.band === 'M' ? 1.6 : 1.5;
    mark('contrast');
  }
  if (ov.targets !== undefined && ov.targets !== fit.targets.minPx) {
    fit.targets = { minPx: ov.targets, conf: 1 };
    fit.clicks.steady.radiusPx = ov.targets ? Math.round(Math.min(ov.targets / 2, Math.max(6, ov.targets / 5))) : 10;
    mark('targets');
  }
  if (ov.steady !== undefined && ov.steady !== fit.clicks.steady.on) {
    fit.clicks.steady.on = ov.steady;
    mark('steady');
  }
  if (ov.motion !== undefined && ov.motion !== fit.attention.motion.on) {
    fit.attention.motion = { p: ov.motion ? Math.max(0.9, fit.attention.motion.p) : Math.min(0.2, fit.attention.motion.p), on: ov.motion };
    mark('motion');
  }
  if (ov.level !== undefined && ov.level !== fit.attention.structureLevel) {
    fit.attention.structureLevel = ov.level;
    fit.attention.clutter.p = ov.level === 2 ? Math.max(0.86, fit.attention.clutter.p) : ov.level === 1 ? 0.7 : Math.min(0.25, fit.attention.clutter.p);
    mark('calm');
  }
  if (ov.polarity !== undefined) {
    fit.polarity = { value: ov.polarity, stated: ov.polarity };
    if (colourChosen) mark('colours');
    else if (settings?.forcedColors) sources.colors = 'setting';
    else if (ov.polarity === 'dark' && settings?.colorScheme === 'dark') sources.colors = 'setting';
  }
  fit.calibration = { ...cal, sources } as FitProfile['calibration'];
  return fit;
}

export function sourcesOf(fit: FitProfile): Partial<Record<FitDimension, FitSource>> {
  return (fit.calibration as WarmupCalibration).sources ?? fitSources(fit);
}

/* ------------------------------------------------------------------ */
/* The stage page                                                      */
/* ------------------------------------------------------------------ */

/** The stage page's own colours at web defaults (#999 captions, the usual greys). */
export const SITE = { ink: '#1A1A1A', body: '#333333', meta: '#767676', caption: '#999999', nav: '#8A8A8A' };

export interface PageLook {
  /** Text size, carried by zoom as on real pages (round 3: zoom carries size; CSS carries structure). */
  zoom: number;
  ink: string;
  body: string;
  meta: string;
  caption: string;
  nav: string;
  weight: number;
  lineHeight: number;
  /** Hit areas grown to this size (px), or null. */
  hitPx: number | null;
  motionOff: boolean;
  calm: StructureLevel;
  dark: boolean;
}

function lift(fg: string, floor: number, band: ContrastBand): string {
  if (band === 'S') return '#111111';
  try {
    const f = parseColor(fg);
    const b = parseColor('#ffffff');
    if (!f || !b) return fg;
    return contrastRatio(f, b) >= floor ? fg : liftToRatio(f, b, floor);
  } catch {
    return floor >= 7 ? '#595959' : '#767676';
  }
}

export const SITE_LOOK: PageLook = {
  zoom: 1, ...SITE, weight: 400, lineHeight: 1.5, hitPx: null, motionOff: false, calm: 0, dark: false,
};

/** How the stage page looks with the parts of the fit that have landed so far. */
export function lookOf(fit: FitProfile | null, landed: ReadonlySet<MarkId>, opts: { motionOff?: boolean } = {}): PageLook {
  if (!fit) return { ...SITE_LOOK, motionOff: !!opts.motionOff };
  const look: PageLook = { ...SITE_LOOK };
  if (landed.has('text')) {
    try {
      look.zoom = planPageZoom(fit, 16).zoom;
    } catch {
      look.zoom = Math.max(1, effectiveTextPx(fit) / 16);
    }
  }
  if (landed.has('contrast')) {
    const { band, floor } = fit.contrast;
    look.caption = lift(SITE.caption, floor, band);
    look.meta = lift(SITE.meta, floor, band);
    look.nav = lift(SITE.nav, floor, band);
    look.body = band === 'S' ? '#111111' : SITE.body;
    look.ink = band === 'S' ? '#000000' : SITE.ink;
    look.weight = Math.max(400, Math.min(600, fit.weight.floor));
    look.lineHeight = Math.max(1.5, fit.spacing.lineHeight);
  }
  if (landed.has('clicks') && fit.targets.minPx != null && fit.targets.minPx > 24) look.hitPx = fit.targets.minPx;
  if (landed.has('calm')) {
    look.calm = fit.attention.structureLevel;
    look.motionOff = fit.attention.motion.on;
  }
  if (opts.motionOff) look.motionOff = true;
  if (landed.has('colours')) look.dark = fit.polarity.value === 'dark';
  return look;
}

/** Every part of the fit, for the results-page samples. Text size is applied as font size by the sample, so zoom stays 1. */
export function fullLook(fit: FitProfile): PageLook {
  const all = new Set<MarkId>(['text', 'contrast', 'clicks', 'calm', 'colours']);
  const look = lookOf(fit, all, { motionOff: fit.attention.motion.on });
  look.zoom = 1;
  return look;
}

/* ------------------------------------------------------------------ */
/* The fit strip                                                       */
/* ------------------------------------------------------------------ */

export type MarkState = 'pending' | 'active' | 'done' | 'setting' | 'skipped';

export function markValue(id: MarkId, fit: FitProfile, settings: BrowserSettings | null): string {
  switch (id) {
    case 'text': {
      const v = effectiveTextPx(fit);
      return v > 16.25 ? `${Math.round(v * 2) / 2} px` : '16 px';
    }
    case 'contrast':
      if (settings?.forcedColors) return 'System';
      return fit.contrast.band === 'S' ? 'Strongest' : fit.contrast.band === 'M' ? 'Darker' : 'As is';
    case 'clicks':
      return fit.targets.minPx != null ? `${fit.targets.minPx} px` : 'As is';
    case 'calm':
      return fit.attention.structureLevel === 2 ? 'Calm view' : fit.attention.structureLevel === 1 ? 'Offered' : fit.attention.motion.on ? 'Paused' : 'As is';
    case 'colours':
      if (settings?.forcedColors) return 'System';
      return fit.polarity.value === 'dark' ? 'Dark' : fit.polarity.value === 'light' ? 'Light' : 'Site';
    default:
      return '';
  }
}

/* ------------------------------------------------------------------ */
/* The last screen's rows                                              */
/* ------------------------------------------------------------------ */

export interface Choice {
  label: string;
  value: string;
}

export interface FitRow {
  key: RowKey;
  /** "Bigger text: 22 px." */
  title: string;
  /** "You read fastest from this size up." */
  line: string;
  source: FitSource;
  /** Changes the page from how the site made it. */
  changed: boolean;
  choices: Choice[];
  current: string;
}

export function sourceLabel(s: FitSource): string {
  switch (s) {
    case 'warmup':
      return 'From your warm-up';
    case 'setting':
      return 'From your browser settings';
    case 'person':
      return 'You set this';
    default:
      return 'WebAble’s starting point';
  }
}

export function fitRows(fit: FitProfile, settings: BrowserSettings | null): FitRow[] {
  const src = sourcesOf(fit);
  const s = (k: RowKey): FitSource => src[DIM_OF[k]] ?? 'default';
  const text = effectiveTextPx(fit);
  const rows: FitRow[] = [];

  const textSrc = s('text');
  rows.push({
    key: 'text',
    title: text > 16.25 ? `Bigger text: ${Math.round(text * 2) / 2} px.` : 'Text: as each site sets it.',
    line:
      text <= 16.25
        ? 'You read comfortably at the usual size.'
        : textSrc === 'person'
          ? 'Pages are zoomed to this size. Headings stay in proportion.'
          : textSrc === 'setting'
            ? 'Your Chrome font and zoom settings ask for this size.'
            : 'You read fastest from this size up.',
    source: textSrc,
    changed: text > 16.25,
    choices: TEXT_LADDER.map((v) => ({ label: `${v} px`, value: String(v) })),
    current: String(text),
  });

  const band = fit.contrast.band;
  rows.push({
    key: 'contrast',
    title: settings?.forcedColors
      ? 'Your system colours.'
      : band === 'S'
        ? 'Strongest contrast.'
        : band === 'M'
          ? 'Darker grey text.'
          : 'Grey text: as each site sets it.',
    line: settings?.forcedColors
      ? 'WebAble leaves colours to your system setting.'
      : band === 'S'
        ? 'Text is drawn near-black on light pages. Colours keep their hue.'
        : band === 'M'
          ? 'Faint grey text is darkened to at least 7:1. Colours keep their hue.'
          : 'Only text too faint to read anywhere (below 4.5:1) is darkened.',
    source: s('contrast'),
    changed: band !== 'N' && !settings?.forcedColors,
    choices: settings?.forcedColors
      ? []
      : [
          { label: 'As the site', value: 'N' },
          { label: 'Darker grey', value: 'M' },
          { label: 'Strongest', value: 'S' },
        ],
    current: band,
  });

  const T = fit.targets.minPx;
  rows.push({
    key: 'targets',
    title: T != null && T > 24 ? `Bigger click areas: ${T} px.` : 'Click areas: as each site makes them.',
    line: T != null && T > 24 ? 'Small buttons and links answer to a larger area. They look the same.' : 'Buttons and links keep their size.',
    source: s('targets'),
    changed: T != null && T > 24,
    choices: TARGET_CHOICES.map((v) => ({ label: v == null ? 'As the site' : `${v} px`, value: v == null ? 'none' : String(v) })),
    current: T == null || T <= 24 ? 'none' : String(T),
  });

  rows.push({
    key: 'steady',
    title: fit.clicks.steady.on ? 'Steady clicks.' : 'Steady clicks: off.',
    line: fit.clicks.steady.on ? 'A small slip still clicks what you pressed.' : 'A click lands where the button is released.',
    source: s('steady'),
    changed: fit.clicks.steady.on,
    choices: [
      { label: 'Off', value: 'off' },
      { label: 'On', value: 'on' },
    ],
    current: fit.clicks.steady.on ? 'on' : 'off',
  });

  const motionSrc = s('motion');
  rows.push({
    key: 'motion',
    title: fit.attention.motion.on ? 'Moving parts paused.' : 'Moving parts: as each site plays them.',
    line: fit.attention.motion.on
      ? motionSrc === 'setting'
        ? 'Your system is set to reduce motion.'
        : 'Carousels, tickers and animations hold still.'
      : 'Carousels and animations play as usual.',
    source: motionSrc,
    changed: fit.attention.motion.on,
    choices: [
      { label: 'Play', value: 'off' },
      { label: 'Paused', value: 'on' },
    ],
    current: fit.attention.motion.on ? 'on' : 'off',
  });

  const level = fit.attention.structureLevel;
  rows.push({
    key: 'calm',
    title: level === 2 ? 'Calm view on busy pages.' : level === 1 ? 'Calm view offered on busy pages.' : 'Busy pages: as each site lays them out.',
    line:
      level === 2
        ? 'Busy pages open in a calmer layout. The original is one click away.'
        : level === 1
          ? 'WebAble offers a calmer layout when a page is busy.'
          : 'A calmer layout is there when you ask for it.',
    source: s('calm'),
    changed: level > 0,
    choices: [
      { label: 'Off', value: '0' },
      { label: 'Offered', value: '1' },
      { label: 'On busy pages', value: '2' },
    ],
    current: String(level),
  });

  return rows;
}
