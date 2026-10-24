// Owner: D1. Design tokens sized from the person's fit.
//
// Visual language: apple.com / Google Store ("Showroom"): light by default, white cards on #F5F5F7, three heading sizes far
// apart at weight 600, pill buttons, one blue action colour, fern only for WebAble's own controls.
// Every length is computed here (the model never computes sizes) and divided by the tab zoom, so the Calm view shows the
// person's comfortable size on screen even when the page itself was zoomed.
import type { FitProfile } from '@webable/core';

export type ThemeMode = 'light' | 'dark' | 'max';
export interface Tokens { [name: string]: string }

export interface TokenOptions {
  /** Current tab zoom factor; lengths are divided by it. Default 1. */
  zoom?: number;
  /** Rhythm preset from the FitSpec. Default 'airy'. */
  density?: 'airy' | 'comfortable';
  /** The person's in-view text size step (Text − / Text +). Default 1. */
  scale?: number;
}

/** Numbers behind the tokens, in CSS px at 100% zoom (before dividing by zoom). */
export interface CalmMetrics {
  F: number; // body px
  T: number; // target px (hit size)
  ctl: number; // control height
  primaryH: number; // primary action pill height
  page: number; // page heading px
  section: number; // section heading px
  title: number; // title px
  lhBody: number;
  lhPage: number;
  lhSection: number;
  lhTitle: number;
  wBody: number;
  wCtl: number;
  wHead: number;
  wordEm: number;
  letterEm: number;
  measureCh: number;
  bandGap: number;
  headGap: number;
  cardGap: number;
  cardPad: number;
  panelPad: number;
  pillPad: number;
  fieldPad: number;
  stripH: number;
  check: number; // checkbox / radio visual size
  row: number; // minimum row height in grouped lists
  colMax: number; // single task column width
  tileMin: number;
  zoom: number;
}

const FONT_TEXT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const FONT_DISPLAY =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Shadows are never the keyword `none`, so they can be combined with edge shadows in one declaration. */
const NO_SHADOW = '0 0 0 0 transparent';

interface Palette {
  canvas: string; raised: string; tonal: string; hover: string; press: string; well: string;
  ink: string; ink2: string; line: string; lineStrong: string;
  action: string; onAction: string; actionHover: string; link: string; badge: string;
  accent: string; onAccent: string; accentHover: string; accentTint: string;
  warning: string; warningTint: string; focus: string; selection: string; glass: string;
  shadowCard: string; shadowLift: string; shadowFloat: string;
  edge: number; // card and control edge width in px
  edgeColor: string;
  scheme: 'light' | 'dark';
}

const LIGHT: Palette = {
  canvas: '#F5F5F7', raised: '#FFFFFF', tonal: '#E8E8ED', hover: '#DCDCE1', press: '#D2D2D7', well: '#F5F5F7',
  ink: '#1D1D1F', ink2: '#5E5E63', line: '#D2D2D7', lineStrong: '#86868B',
  action: '#0071E3', onAction: '#FFFFFF', actionHover: '#0077ED', link: '#0066CC', badge: '#B64400',
  accent: '#2D6A3E', onAccent: '#FFFFFF', accentHover: '#22552F', accentTint: '#E4EFE6',
  warning: '#7A4800', warningTint: '#FAEFD9', focus: '#0071E3', selection: '#B3D7FF',
  glass: 'rgba(255,255,255,.72)',
  shadowCard: '0 1px 2px rgba(0,0,0,.04), 0 6px 20px rgba(0,0,0,.06)',
  shadowLift: '0 2px 4px rgba(0,0,0,.05), 0 12px 32px rgba(0,0,0,.10)',
  shadowFloat: '0 12px 40px rgba(0,0,0,.16)',
  edge: 0, edgeColor: 'transparent', scheme: 'light',
};

const DARK: Palette = {
  canvas: '#000000', raised: '#1C1C1E', tonal: '#2C2C2E', hover: '#3A3A3C', press: '#48484A', well: '#2C2C2E',
  ink: '#F5F5F7', ink2: '#A1A1A6', line: '#38383A', lineStrong: '#8E8E93',
  action: '#0071E3', onAction: '#FFFFFF', actionHover: '#0077ED', link: '#2997FF', badge: '#FF9F45',
  accent: '#8FCB9B', onAccent: '#0F1A12', accentHover: '#A9D9B2', accentTint: '#1B2B1F',
  warning: '#F2B75E', warningTint: '#2E2412', focus: '#2997FF', selection: '#1F4E85',
  glass: 'rgba(22,22,23,.78)',
  shadowCard: NO_SHADOW, shadowLift: NO_SHADOW, shadowFloat: '0 12px 40px rgba(0,0,0,.6)',
  edge: 0, edgeColor: 'transparent', scheme: 'dark',
};

function moreContrast(p: Palette): Palette {
  const dark = p.scheme === 'dark';
  return {
    ...p,
    ink2: p.ink,
    line: p.lineStrong,
    link: dark ? '#6CB4FF' : '#0040DD',
    action: dark ? '#6CB4FF' : '#0040DD',
    actionHover: dark ? '#8AC4FF' : '#0033B8',
    onAction: dark ? '#000000' : '#FFFFFF',
    edge: 1,
    edgeColor: p.lineStrong,
  };
}

const MAX_LIGHT: Palette = {
  canvas: '#FFFFFF', raised: '#FFFFFF', tonal: '#F0F0F0', hover: '#E2E2E2', press: '#D4D4D4', well: '#FFFFFF',
  ink: '#000000', ink2: '#000000', line: '#000000', lineStrong: '#000000',
  action: '#0040DD', onAction: '#FFFFFF', actionHover: '#0033B8', link: '#0040DD', badge: '#8A2E00',
  accent: '#1F4D2B', onAccent: '#FFFFFF', accentHover: '#163A20', accentTint: '#E4EFE6',
  warning: '#5C3600', warningTint: '#FAEFD9', focus: '#000000', selection: '#B3D7FF',
  glass: 'rgba(255,255,255,.97)',
  shadowCard: NO_SHADOW, shadowLift: NO_SHADOW, shadowFloat: NO_SHADOW,
  edge: 2, edgeColor: '#000000', scheme: 'light',
};

const MAX_DARK: Palette = {
  canvas: '#000000', raised: '#000000', tonal: '#1A1A1A', hover: '#2A2A2A', press: '#333333', well: '#1A1A1A',
  ink: '#FFFFFF', ink2: '#FFFFFF', line: '#FFFFFF', lineStrong: '#FFFFFF',
  action: '#6CB4FF', onAction: '#000000', actionHover: '#8AC4FF', link: '#6CB4FF', badge: '#FFB366',
  accent: '#A9D9B2', onAccent: '#000000', accentHover: '#C2E6CA', accentTint: '#1B2B1F',
  warning: '#F2B75E', warningTint: '#2E2412', focus: '#FFFFFF', selection: '#1F4E85',
  glass: 'rgba(0,0,0,.96)',
  shadowCard: NO_SHADOW, shadowLift: NO_SHADOW, shadowFloat: NO_SHADOW,
  edge: 2, edgeColor: '#FFFFFF', scheme: 'dark',
};

/** Light unless the fit says dark (never from the OS setting alone); max contrast when the fit's band is S. */
export function themeModeFor(fit: FitProfile | null): ThemeMode {
  if (fit?.contrast.band === 'S') return 'max';
  if (fit?.polarity.value === 'dark') return 'dark';
  return 'light';
}

function paletteFor(fit: FitProfile | null, mode: ThemeMode): Palette {
  const dark = mode === 'dark' || (mode === 'max' && fit?.polarity.value === 'dark');
  if (mode === 'max') return dark ? MAX_DARK : MAX_LIGHT;
  const base = dark ? DARK : LIGHT;
  return fit?.contrast.band === 'M' ? moreContrast(base) : base;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const finite = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Heading ratios to F, interpolated between anchors (docs/12 §4.2). */
const RAMP: Array<[number, number, number, number]> = [
  [16, 2.5, 1.75, 1.25],
  [24, 2.0, 1.5, 1.17],
  [32, 1.6, 1.3, 1.12],
  [40, 1.35, 1.18, 1.08],
];

export function typeRamp(F: number): { page: number; section: number; title: number } {
  const first = RAMP[0]!;
  const last = RAMP[RAMP.length - 1]!;
  let r: [number, number, number] = [first[1], first[2], first[3]];
  if (F >= last[0]) r = [last[1], last[2], last[3]];
  else if (F > first[0]) {
    for (let i = 0; i < RAMP.length - 1; i++) {
      const a = RAMP[i]!;
      const b = RAMP[i + 1]!;
      if (F >= a[0] && F <= b[0]) {
        const t = (F - a[0]) / (b[0] - a[0]);
        r = [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
        break;
      }
    }
  }
  return { page: F * r[0], section: F * r[1], title: F * r[2] };
}

/** Structure parameters by level (research-fitting §8.18): open sections, records first, group size, split above n sentences. */
export function structureParams(level: 0 | 1 | 2): { sectionsOpen: number; listFirst: number; groupSize: number; splitSentences: number; stepMax: number } {
  if (level === 2) return { sectionsOpen: 1, listFirst: 8, groupSize: 4, splitSentences: 3, stepMax: 5 };
  if (level === 1) return { sectionsOpen: 2, listFirst: 12, groupSize: 5, splitSentences: 4, stepMax: 8 };
  return { sectionsOpen: Infinity, listFirst: Infinity, groupSize: 6, splitSentences: Infinity, stepMax: 12 };
}

export function calmMetrics(fit: FitProfile | null, opts: TokenOptions = {}): CalmMetrics {
  const zoom = clamp(finite(opts.zoom, 1), 0.25, 5);
  const scale = clamp(finite(opts.scale, 1), 0.7, 2);
  const airy = (opts.density ?? 'airy') === 'airy';
  const stated = fit ? finite(fit.text.override ?? fit.text.bodyPx, 16) : 16;
  // Never below the reference stores' body size; only the person's own Text − step may go a little lower.
  const F = Math.round(clamp(Math.max(16, stated) * scale, 14, 64) * 10) / 10;
  const T = clamp(finite(fit?.targets.minPx ?? null, 44), 24, 96);
  const ctl = Math.max(T, 44, Math.round(F * 2.2));
  const primaryH = Math.max(T, 52, Math.round(F * 2.55));
  const ramp = typeRamp(F);
  const lhBody = clamp(finite(fit?.spacing.lineHeight, 1.5), 1.4, 2.2);
  const loose = lhBody > 1.5;
  const floor = clamp(finite(fit?.weight.floor, 400), 300, 700);
  return {
    F, T, ctl, primaryH,
    page: ramp.page, section: ramp.section, title: ramp.title,
    lhBody, lhPage: loose ? 1.15 : 1.08, lhSection: loose ? 1.18 : 1.14, lhTitle: 1.25,
    wBody: clamp(Math.max(400, floor), 400, 700),
    wCtl: clamp(Math.max(500, floor), 500, 700),
    wHead: clamp(Math.max(600, floor), 600, 700),
    wordEm: clamp(finite(fit?.spacing.wordEm, 0), 0, 0.3),
    letterEm: clamp(finite(fit?.spacing.letterEm, 0), 0, 0.15),
    measureCh: clamp(finite(fit?.measure.targetCpl, 66), 30, 80),
    // The band gap is clamped (x0.75) so the primary section still starts in the first screen.
    bandGap: (airy ? Math.max(64, 4 * F) : Math.max(48, 3 * F)) * 0.75,
    headGap: Math.max(20, 1.25 * F) * (airy ? 1 : 0.85),
    cardGap: airy ? Math.max(20, F) : Math.max(16, 0.75 * F),
    cardPad: airy ? Math.max(20, 1.25 * F) : Math.max(16, F),
    panelPad: airy ? Math.max(28, 1.6 * F) : Math.max(22, 1.3 * F),
    pillPad: Math.max(20, 1.25 * F),
    fieldPad: Math.max(14, 0.8 * F),
    stripH: Math.max(56, T + 12),
    check: clamp(Math.round(Math.max(26, F * 1.25, T * 0.5)), 26, 44),
    row: Math.max(T, 64, Math.round(F * 3)),
    colMax: clamp(Math.round(40 * F), 720, 1040),
    tileMin: Math.max(240, 11 * F),
    zoom,
  };
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

export function tokensFor(fit: FitProfile | null, mode: ThemeMode, opts: TokenOptions = {}): Tokens {
  const p = paletteFor(fit, mode);
  const m = calmMetrics(fit, opts);
  const px = (n: number): string => `${r2(n / m.zoom)}px`;
  const tracking = (em: number): string => (m.letterEm > 0 ? `${m.letterEm}em` : `${em}em`);
  return {
    // colour
    canvas: p.canvas, raised: p.raised, tonal: p.tonal, hover: p.hover, press: p.press, well: p.well,
    ink: p.ink, 'ink-2': p.ink2, line: p.line, 'line-strong': p.lineStrong,
    action: p.action, 'on-action': p.onAction, 'action-hover': p.actionHover, link: p.link, badge: p.badge,
    accent: p.accent, 'on-accent': p.onAccent, 'accent-hover': p.accentHover, 'accent-tint': p.accentTint,
    warning: p.warning, 'warning-tint': p.warningTint, focus: p.focus, selection: p.selection, glass: p.glass,
    'shadow-card': p.shadowCard, 'shadow-lift': p.shadowLift, 'shadow-float': p.shadowFloat,
    edge: px(p.edge), 'edge-color': p.edgeColor, 'ctl-edge': px(Math.max(1, p.edge)),
    scheme: p.scheme,
    // type
    font: FONT_TEXT, 'font-display': FONT_DISPLAY,
    f: px(m.F), 'f-page': px(m.page), 'f-section': px(m.section), 'f-title': px(m.title),
    'lh-body': String(m.lhBody), 'lh-page': String(m.lhPage), 'lh-section': String(m.lhSection), 'lh-title': String(m.lhTitle),
    'w-body': String(m.wBody), 'w-ctl': String(m.wCtl), 'w-head': String(m.wHead),
    'tr-page': tracking(-0.022), 'tr-section': tracking(-0.016), 'tr-title': tracking(-0.01),
    'word-sp': `${m.wordEm}em`, 'letter-sp': `${m.letterEm}em`, measure: `${m.measureCh}ch`,
    // size and space
    t: px(m.T), ctl: px(m.ctl), 'primary-h': px(m.primaryH), 'pill-pad': px(m.pillPad), 'field-pad': px(m.fieldPad),
    'strip-h': px(m.stripH), 'band-gap': px(m.bandGap), 'head-gap': px(m.headGap), 'card-gap': px(m.cardGap),
    'card-pad': px(m.cardPad), 'panel-pad': px(m.panelPad), check: px(m.check), row: px(m.row),
    'col-max': px(m.colMax), 'page-max': px(1280), 'tile-min': px(m.tileMin), 'side-pad': px(Math.max(24, m.F)),
    'r-card': px(22), 'r-panel': px(28), 'r-media': px(16), 'r-field': px(14), 'r-small': px(10), 'r-pill': '999px',
    gap: px(Math.max(10, m.F * 0.6)), 'gap-s': px(Math.max(6, m.F * 0.35)), hair: px(1), ring: px(3),
  };
}

export function tokensToCss(t: Tokens, selector = ':host'): string {
  const body = Object.entries(t)
    .map(([k, v]) => `--wa-${k}:${v};`)
    .join('');
  return `${selector}{${body}}`;
}

/** The same tokens as an inline style object (custom properties go through the CSSOM, which page CSP allows). */
export function tokensToStyle(t: Tokens): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t)) out[`--wa-${k}`] = v;
  return out;
}
