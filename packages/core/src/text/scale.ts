// Owner: A2.
// Text size: page zoom first (snapped down to Chrome presets, so the hierarchy cannot invert), then one
// monotone compressive map for whatever scale is left (research-fitting §8.1–§8.2). Never per-element floors.
import type { FitProfile } from '../types';

export const CHROME_ZOOM_PRESETS: number[] = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

/** Page-scale presets WebAble may pick (Chrome presets between 100% and the 200% cap). */
export const PAGE_SCALE_PRESETS: number[] = CHROME_ZOOM_PRESETS.filter((z) => z > 1 && z <= 2);

/** Below this total scale nothing changes: the cost of change dominates small benefits (Gajos 2010). */
export const MIN_SCALE_TO_ACT = 1.15;
/** A residual this small is left alone. */
export const MIN_RESIDUAL = 1.02;
export const MAX_PAGE_ZOOM = 2;

export interface TextScalePlan {
  /** Absolute tab zoom factor to set (1 = 100%). Never below the person's own zoom. */
  zoom: number;
  /** Scale left for the text map after zoom (1 = none). */
  residual: number;
  /** Exponent of the compressive map for sizes above body (1 = proportional). */
  exponent: number;
  /** Target CSS px for the page's body text before zoom (pageBodyPx when residual is 1). */
  targetBodyPx: number;
}

export interface TextScaleOptions {
  /** The tab's current zoom set by the person (not by WebAble). Default 1. */
  ownZoom?: number;
  /** Window width in CSS px at 100% zoom (innerWidth × current zoom). Caps zoom at clamp(w/800, 1, 2). */
  viewportW?: number;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** The person's comfortable body size the plan aims for (override wins). */
export function fitBodyPx(fit: FitProfile): number {
  const v = fit.text.override ?? fit.text.bodyPx;
  return Number.isFinite(v) && v > 0 ? v : 16;
}

/** Largest preset ≤ v (1 when v is below the first preset). */
export function snapZoomDown(v: number, presets: number[] = PAGE_SCALE_PRESETS): number {
  let best = 1;
  for (const p of presets) if (p <= v + 1e-9 && p > best) best = p;
  return best;
}

/** e = min(1, max(0.2, 1 − 0.48·log2 k_r)). */
export function compressiveExponent(residual: number): number {
  if (residual <= 1) return 1;
  return round3(Math.min(1, Math.max(0.2, 1 - 0.48 * Math.log2(residual))));
}

/**
 * Plan text scaling for a page whose running text is `pageBodyPx` (char-weighted median computed size in
 * main, CSS px). k = F / (b · Z_own); if k ≤ 1.15 nothing changes. Otherwise zoom = snap_down(min(Z_own·k, zMax))
 * over Chrome presets, and the residual F / (b · zoom) goes to the text map. A 'default' fit (never measured,
 * never set) changes nothing.
 */
export function planTextScale(fit: FitProfile, pageBodyPx: number, opts: TextScaleOptions = {}): TextScalePlan {
  const ownZoom = opts.ownZoom && Number.isFinite(opts.ownZoom) && opts.ownZoom > 0 ? opts.ownZoom : 1;
  const b = Number.isFinite(pageBodyPx) && pageBodyPx > 0 ? pageBodyPx : 16;
  const none: TextScalePlan = { zoom: ownZoom, residual: 1, exponent: 1, targetBodyPx: b };
  if (fit.text.source === 'default' && fit.text.override == null) return none;

  const F = fitBodyPx(fit);
  const k = F / (b * ownZoom);
  if (k <= MIN_SCALE_TO_ACT) return none;

  const zMax = opts.viewportW && opts.viewportW > 0 ? clamp(opts.viewportW / 800, 1, MAX_PAGE_ZOOM) : MAX_PAGE_ZOOM;
  const wanted = Math.min(ownZoom * k, zMax);
  const zoom = Math.max(ownZoom, snapZoomDown(wanted));

  let residual = F / (b * zoom);
  if (residual <= MIN_RESIDUAL) residual = 1;
  residual = round3(residual);
  const exponent = compressiveExponent(residual);
  return { zoom, residual, exponent, targetBodyPx: residual === 1 ? b : round3(b * residual) };
}

/**
 * The text map for one computed size s (CSS px), with page body b and target body F′ = b·k_r:
 *   s ≥ b: s′ = F′·(s/b)^e;  s < b: s′ = min(F′, s·k_r);  never s′ < s.
 * Monotone in s (never inverts order), continuous at b, and anything at or above body lands at or above F′,
 * so headings never fall below body.
 */
export function mapFontSize(sizePx: number, pageBodyPx: number, targetBodyPx: number, exponent: number): number {
  if (!Number.isFinite(sizePx) || sizePx <= 0) return sizePx;
  const b = pageBodyPx > 0 ? pageBodyPx : 16;
  const F = targetBodyPx;
  if (!(F > b)) return sizePx;
  const kr = F / b;
  const e = clamp(Number.isFinite(exponent) ? exponent : 1, 0.2, 1);
  const mapped = sizePx >= b ? F * (sizePx / b) ** e : Math.min(F, sizePx * kr);
  return Math.max(sizePx, Math.round(mapped * 100) / 100);
}
