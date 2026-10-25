// How a sample page looks before WebAble and with it, as CSS custom properties for MiniPage.
// "With WebAble" uses the person's real values and the engine's own rules: their text size (zoom-like scaling on pages
// that keep their layout, the heading ramp on the simple page), grey text lifted to their contrast floor with core's
// liftToRatio, their weight and line height, and controls at least their click-area size.
import { HEADING_RAMP, contrastTarget, liftToRatio, parseColor, type FitProfile, type Rgba } from '@webable/core';
import type { SampleSite } from './sites';

export type View = 'before' | 'with';

export interface Look {
  view: View;
  /** 'site' keeps the site's own layout; 'simple' is WebAble's clean single-column page. */
  layout: 'site' | 'simple';
  dark: boolean;
  ads: boolean;
  popup: boolean;
  strip: 'moving' | 'paused' | 'none';
  vars: Record<string, string>;
}

/** The sample sites' own type and colours: small grey text, tiny controls. */
export const SITE = {
  body: 13,
  small: 11,
  nav: 12,
  h1: 26,
  h2: 15,
  deck: 15,
  brand: 24,
  btn: 12,
  control: 28,
  lineHeight: 1.5,
  text: '#8c8c8c',
  muted: '#a3a3a3',
  head: '#222222',
  bg: '#ffffff',
  surface: '#f5f4f0',
  line: '#ebe8e2',
} as const;

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const rgba = (css: string): Rgba => parseColor(css) ?? WHITE;
const px = (v: number): string => `${Math.round(v * 2) / 2}px`;

/** The text size the person's settings show, unrounded (a size they set wins). */
export const personBodyPx = (fit: FitProfile): number => {
  const v = fit.text.override ?? fit.text.bodyPx;
  return Number.isFinite(v) && v > 0 ? v : 16;
};

export function beforeLook(site: SampleSite): Look {
  return {
    view: 'before',
    layout: 'site',
    dark: false,
    ads: true,
    popup: true,
    strip: 'moving',
    vars: {
      '--mp-body': px(SITE.body),
      '--mp-small': px(SITE.small),
      '--mp-nav': px(SITE.nav),
      '--mp-h1': px(SITE.h1),
      '--mp-h2': px(SITE.h2),
      '--mp-deck': px(SITE.deck),
      '--mp-brand': px(SITE.brand),
      '--mp-btn': px(SITE.btn),
      '--mp-ctl': px(SITE.control),
      '--mp-lh': String(SITE.lineHeight),
      '--mp-w': '400',
      '--mp-cpl': '72',
      '--mp-bg': SITE.bg,
      '--mp-surface': SITE.surface,
      '--mp-line': SITE.line,
      '--mp-text': SITE.text,
      '--mp-muted': SITE.muted,
      '--mp-head': SITE.head,
      '--mp-link': site.accent,
      '--mp-btn-bg': site.accent,
      '--mp-strip-bg': site.stripBg,
      '--mp-strip-ink': site.stripInk,
    },
  };
}

export function withLook(site: SampleSite, fit: FitProfile): Look {
  const F = personBodyPx(fit);
  const simple = site.mode === 'simple';
  const dark = fit.polarity?.value === 'dark';
  const floor = Number.isFinite(fit.contrast?.floor) ? fit.contrast.floor : 4.5;
  const weight = fit.weight?.floor ?? 400;
  const minPx = fit.targets?.minPx != null && fit.targets.minPx > 0 ? fit.targets.minPx : null;

  // Pages that keep their layout scale every size together (like zoom); the simple page uses core's heading ramp.
  const k = F / SITE.body;
  const size = simple
    ? { small: F * 0.875, nav: F * 0.875, h1: F * HEADING_RAMP[1], h2: F * HEADING_RAMP[2], deck: F * HEADING_RAMP[3], brand: F * 1.25, btn: F * 0.9 }
    : { small: SITE.small * k, nav: SITE.nav * k, h1: SITE.h1 * k, h2: SITE.h2 * k, deck: SITE.deck * k, brand: SITE.brand * k, btn: SITE.btn * k };
  const control = Math.max(minPx ?? (simple ? 0 : SITE.control), Math.round(size.btn * 1.25 + (simple ? 18 : 14)));

  const bg = dark ? '#141414' : SITE.bg;
  const back = rgba(bg);
  const lift = (css: string, sizePx: number, w: number): string => liftToRatio(rgba(css), back, contrastTarget(floor, sizePx, w));
  // Grey text is lifted to the floor itself (the normal-size target), so headings never end up dimmer than the meta
  // line under them. On a dark page the site's ink and greys start from their light-on-dark versions.
  const ink = dark ? { text: '#a6a6a6', muted: '#8f8f8f', head: '#f2f1ec' } : { text: SITE.text, muted: SITE.muted, head: SITE.head };
  const textTarget = contrastTarget(floor, 16, 400);
  const liftText = (css: string): string => liftToRatio(rgba(css), back, textTarget);
  const stripBg = dark ? '#262626' : site.stripBg;

  return {
    view: 'with',
    layout: simple ? 'simple' : 'site',
    dark,
    ads: site.mode === 'table',
    popup: false,
    strip: site.mode === 'table' ? (fit.attention?.motion?.on ? 'paused' : 'moving') : 'none',
    vars: {
      '--mp-body': px(F),
      '--mp-small': px(size.small),
      '--mp-nav': px(size.nav),
      '--mp-h1': px(size.h1),
      '--mp-h2': px(size.h2),
      '--mp-deck': px(size.deck),
      '--mp-brand': px(size.brand),
      '--mp-btn': px(size.btn),
      '--mp-ctl': px(control),
      '--mp-lh': String(fit.spacing?.lineHeight ?? 1.5),
      '--mp-w': String(weight),
      '--mp-cpl': String(fit.measure?.targetCpl ?? 66),
      '--mp-bg': bg,
      '--mp-surface': dark ? '#1f1f1f' : SITE.surface,
      '--mp-line': dark ? '#333333' : SITE.line,
      '--mp-text': liftText(ink.text),
      '--mp-muted': liftText(ink.muted),
      '--mp-head': liftText(ink.head),
      '--mp-link': lift(site.accent, size.small, 600),
      // White labels on the site's colour, darkened until they meet the floor too.
      '--mp-btn-bg': liftToRatio(rgba(site.accent), WHITE, contrastTarget(floor, size.btn, 600)),
      '--mp-strip-bg': stripBg,
      '--mp-strip-ink': liftToRatio(rgba(site.stripInk), rgba(stripBg), contrastTarget(floor, size.small, 400)),
    },
  };
}

export function lookFor(site: SampleSite, view: View, fit: FitProfile): Look {
  return view === 'before' ? beforeLook(site) : withLook(site, fit);
}

/** One plain change WebAble made to the sample page: `lead` then the new value (`strong`, in the accent). */
export interface PageChange {
  lead: string;
  strong: string;
}

/** What WebAble changed on this sample page, for the line under the preview. */
export function pageChanges(site: SampleSite, fit: FitProfile): PageChange[] {
  const look = withLook(site, fit);
  const out: PageChange[] = [{ lead: `Text ${SITE.body} → `, strong: `${Math.round(personBodyPx(fit))} px` }];
  if (look.vars['--mp-text']?.toLowerCase() !== SITE.text) out.push({ lead: 'Faint text ', strong: look.dark ? 'brighter' : 'darker' });
  if (look.dark) out.push({ lead: 'Page ', strong: 'dark' });
  const minPx = fit.targets?.minPx;
  if (minPx != null && minPx > SITE.control) out.push({ lead: 'Buttons ', strong: `${Math.round(minPx)} px` });
  if (site.mode === 'simple') out.push({ lead: 'Ads and pop-up ', strong: 'gone' });
  if (site.mode === 'form') out.push({ lead: 'Offers and pop-up ', strong: 'gone' });
  if (site.mode === 'table') {
    out.push({ lead: 'Pop-up ', strong: 'gone' });
    if (look.strip === 'paused') out.push({ lead: 'Moving strip ', strong: 'paused' });
  }
  return out;
}

/** A note shown with pages WebAble deliberately leaves in their own layout. */
export function pageNote(site: SampleSite): string | null {
  return site.mode === 'table' ? 'Statements keep their layout.' : null;
}
