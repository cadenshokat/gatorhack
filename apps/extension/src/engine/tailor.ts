// Owner: C1. Page-level ops from the fit, and element ops from Jev's decisions.
//
// Rules (research-fitting §8, research-engineering §9):
//  - every op is a named function with bounded parameters, an id and a revert;
//  - style goes through constructed stylesheets in document.adoptedStyleSheets plus data-wa-* tokens on elements;
//    all reads happen before all writes;
//  - text grows with tab zoom first (never lowering the person's own zoom), then one monotone map applied per
//    computed size bucket (never per-element floors);
//  - nothing is hidden, nothing moves (except unpinning a tall sticky header), ARIA, names, focus order and keyboard
//    handling are never touched, and no url() appears in any CSS.

import {
  CHROME_ZOOM_PRESETS, contrastRatio, liftToRatio, mapFontSize, parseColor, planTextScale,
} from '@webable/core';
import type { FitProfile, LedgerEntry, OpKind, OpRecord } from '@webable/core';
import type { ReadResult, TextSample } from './reader';
import { collapse, parseRgb, ratio as wcagRatio, visibleTextOf } from './reader';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Op {
  rec: OpRecord;
  /** Elements this op writes to (attribution, verify probes). */
  elements: Element[];
  /** Bisect order for unattributed failures: higher is riskier and is reverted first. */
  risk: number;
  /** Whether the op's effect is on the page right now. */
  active: boolean;
  /** Keeps across same-document navigation (zoom and behaviour ops). */
  persistent: boolean;
  source: LedgerEntry['source'];
  title: string;
  detail?: string;
  p?: number;
  apply(): void | Promise<void>;
  revert(): void | Promise<void>;
  /** Remove the op's effect from one element only (hit-area tokens that did not work). */
  drop?(el: Element): void;
  /** Elements whose expanded hit area should be probed after applying (targets, promote_main). */
  hitProbes?: Array<{ el: Element; padX: number; padY: number }>;
}

export interface TailorHost {
  ask<T>(req: import('@webable/core').BgRequest): Promise<T>;
  zoomInfo(): Promise<{ factor: number; personChanged: boolean }>;
  isOurUi(t: EventTarget | null): boolean;
  idOf(el: Element): string;
  /** Called by behaviour ops (debounce, steady clicks) when they act, for the ledger detail. */
  onBehaviour?(kind: 'steady' | 'debounce'): void;
}

export interface TextPlan {
  ownZoom: number;
  zoom: number; // the zoom WebAble will use (>= own)
  residual: number;
  exponent: number;
  pageBodyPx: number;
  targetBodyPx: number; // CSS px of body text after the residual map
  effectiveBodyPx: number; // what the person sees, in px at 100%
  wasBodyPx: number;
}

/* ------------------------------------------------------------------ */
/* Style layer                                                         */
/* ------------------------------------------------------------------ */

/** Our constructed sheets, kept attached to document.adoptedStyleSheets (watchdog re-attaches). */
export class SheetLayer {
  private sheets = new Set<CSSStyleSheet>();
  private reattaches: number[] = [];

  make(css: string): CSSStyleSheet {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return sheet;
  }

  attach(sheet: CSSStyleSheet): void {
    this.sheets.add(sheet);
    this.sync(true);
  }

  detach(sheet: CSSStyleSheet): void {
    this.sheets.delete(sheet);
    try {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    } catch {
      /* page replaced the array with something odd; nothing to remove */
    }
  }

  /** Re-attach any sheet the page dropped. At most 10 times per 10 s, then pause. */
  sync(force = false): boolean {
    const cur = document.adoptedStyleSheets;
    const missing = [...this.sheets].filter((s) => !cur.includes(s));
    if (!missing.length) return false;
    const now = Date.now();
    this.reattaches = this.reattaches.filter((t) => now - t < 10000);
    if (!force && this.reattaches.length >= 10) return false;
    if (!force) this.reattaches.push(now);
    try {
      document.adoptedStyleSheets = [...cur, ...missing];
    } catch {
      return false;
    }
    return true;
  }

  clear(): void {
    for (const s of [...this.sheets]) this.detach(s);
    this.counts.clear();
  }

  private sharedSheets = new Map<string, CSSStyleSheet>();
  private counts = new Map<string, number>();

  /** A sheet shared by several ops (dims, hit areas), attached while at least one op uses it. */
  shared(key: string, css: string): { attach(): void; detach(): void } {
    let sheet = this.sharedSheets.get(key);
    if (!sheet) {
      sheet = this.make(css);
      this.sharedSheets.set(key, sheet);
    }
    const s = sheet;
    let mine = false;
    return {
      attach: () => {
        if (mine) return;
        mine = true;
        const n = (this.counts.get(key) ?? 0) + 1;
        this.counts.set(key, n);
        if (n === 1) this.attach(s);
      },
      detach: () => {
        if (!mine) return;
        mine = false;
        const n = Math.max(0, (this.counts.get(key) ?? 0) - 1);
        this.counts.set(key, n);
        if (n === 0) this.detach(s);
      },
    };
  }
}

/** Selector with doubled attribute for specificity (0,2,0) so site rules lose against our !important rules. */
function sel(attr: string, value?: string): string {
  const one = value === undefined ? `[${attr}]` : `[${attr}="${value}"]`;
  return `${one}${one}`;
}

function setTokens(writes: Array<[Element, string, string]>): void {
  for (const [el, attr, value] of writes) el.setAttribute(attr, value);
}

function clearTokens(els: Iterable<Element>, attrs: string[]): void {
  for (const el of els) for (const a of attrs) el.removeAttribute(a);
}

let opCounter = 0;
function opId(kind: OpKind): string {
  opCounter += 1;
  return `${kind}-${opCounter}`;
}

function record(kind: OpKind, scope: OpRecord['scope'], targets: Element[], reason: string, idOf: (el: Element) => string): OpRecord {
  return {
    id: opId(kind),
    kind,
    scope,
    targetIds: targets.slice(0, 300).map(idOf),
    status: 'applied',
    reason,
  };
}

/* ------------------------------------------------------------------ */
/* Fallback maths (used only if the core module is unavailable)        */
/* ------------------------------------------------------------------ */

const ZOOM_STEPS = [1.1, 1.25, 1.5, 1.75, 2];

function snapDown(z: number): number {
  let best = 1;
  for (const p of ZOOM_STEPS) if (p <= z + 1e-6) best = p;
  return best;
}

function expOf(k: number): number {
  return Math.min(1, Math.max(0.2, 1 - 0.48 * Math.log2(Math.max(k, 1))));
}

function localPlan(fit: FitProfile, b: number): { zoom: number; residual: number; exponent: number; targetBodyPx: number } {
  const F = fit.text.override ?? fit.text.bodyPx;
  const k = F / Math.max(b, 1);
  const zoom = k > 1.15 ? snapDown(Math.min(k, 2)) : 1;
  const residual = Math.max(1, k / zoom);
  return { zoom, residual, exponent: expOf(residual), targetBodyPx: b * residual };
}

function localMap(s: number, b: number, F: number, e: number): number {
  const k = F / Math.max(b, 1);
  const out = s >= b ? F * (s / b) ** e : Math.min(F, s * k);
  return Math.max(s, out);
}

function safeMap(s: number, b: number, F: number, e: number): number {
  try {
    const v = mapFontSize(s, b, F, e);
    if (Number.isFinite(v) && v > 0) return Math.max(s, v);
  } catch {
    /* fall through */
  }
  return localMap(s, b, F, e);
}

function rgbaOf(css: string): { r: number; g: number; b: number; a: number } | null {
  const local = parseRgb(css);
  if (local) return local;
  try {
    return parseColor(css);
  } catch {
    return null;
  }
}

function safeRatio(fg: { r: number; g: number; b: number; a: number }, bg: { r: number; g: number; b: number; a: number }): number {
  try {
    const v = contrastRatio(fg, bg);
    if (Number.isFinite(v)) return v;
  } catch {
    /* fall through */
  }
  return wcagRatio(fg, bg);
}

function localLift(fg: { r: number; g: number; b: number; a: number }, bg: { r: number; g: number; b: number; a: number }, target: number): string {
  // Mix toward black or white (whichever raises contrast) with a binary search on the mix amount: hue is kept.
  const lb = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b;
  const toward = lb > 128 ? 0 : 255;
  let lo = 0;
  let hi = 1;
  const mix = (t: number) => ({ r: fg.r + (toward - fg.r) * t, g: fg.g + (toward - fg.g) * t, b: fg.b + (toward - fg.b) * t, a: 1 });
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (wcagRatio(mix(mid), bg) >= target) hi = mid;
    else lo = mid;
  }
  const c = mix(hi);
  return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
}

function safeLift(fg: { r: number; g: number; b: number; a: number }, bg: { r: number; g: number; b: number; a: number }, target: number): string {
  try {
    const v = liftToRatio(fg, bg, target);
    if (typeof v === 'string' && v && !/url\(/i.test(v)) {
      const parsed = rgbaOf(v);
      if (!parsed || wcagRatio(parsed, bg) >= target - 0.1) return v;
    }
  } catch {
    /* fall through */
  }
  return localLift(fg, bg, target);
}

/* ------------------------------------------------------------------ */
/* Effective background (nearest opaque ancestor, composited)          */
/* ------------------------------------------------------------------ */

type Rgba = { r: number; g: number; b: number; a: number };
let bgCache = new WeakMap<Element, Rgba | null>();

/** Forget cached backgrounds (after the page changed). */
export function resetBackgroundCache(): void {
  bgCache = new WeakMap();
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  if (a <= 0) return { r: 255, g: 255, b: 255, a: 1 };
  return {
    r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
    g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
    b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
    a,
  };
}

/** The background a text element is painted on, or null when unknown (image, gradient, filter, blend). */
export function effectiveBackground(el: Element): Rgba | null {
  if (bgCache.has(el)) return bgCache.get(el) ?? null;
  const layers: Rgba[] = [];
  let unknown = false;
  let n: Element | null = el;
  let depth = 0;
  while (n && depth < 40) {
    const cs = getComputedStyle(n);
    if (cs.backgroundImage !== 'none' || (cs.filter !== 'none' && cs.filter !== '') || cs.mixBlendMode !== 'normal') {
      unknown = true;
      break;
    }
    const c = parseRgb(cs.backgroundColor);
    if (c && c.a > 0) {
      layers.push(c);
      if (c.a >= 0.99) break;
    }
    n = n.parentElement;
    depth++;
  }
  let result: Rgba | null = null;
  if (!unknown) {
    let acc: Rgba = { r: 255, g: 255, b: 255, a: 1 }; // the canvas
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (l) acc = over(l, acc);
    }
    result = acc;
  }
  bgCache.set(el, result);
  return result;
}

/* ------------------------------------------------------------------ */
/* Static CSS                                                          */
/* ------------------------------------------------------------------ */

const MOTION_CSS = `
*:not([role="progressbar"]):not([aria-busy="true"]),
*:not([role="progressbar"]):not([aria-busy="true"])::before,
*:not([role="progressbar"]):not([aria-busy="true"])::after {
  animation-duration: 0.001ms !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001ms !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
}
html { scroll-behavior: auto !important; }
`;

const FOCUS_CSS = `
:focus-visible {
  outline: 3px solid #111111 !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 5px #ffffff !important;
}
`;

const DIM_CSS = `
${sel('data-wa-dim')} { opacity: 0.35 !important; }
${sel('data-wa-dim', 'g')} { filter: grayscale(1) !important; }
${sel('data-wa-dim')}:hover, ${sel('data-wa-dim')}:focus-within { opacity: 1 !important; filter: none !important; }
`;

const MAIN_CSS = `
${sel('data-wa-main')} { outline: 3px solid #0071E3 !important; outline-offset: 3px !important; }
`;

function targetCss(attrX: string, attrY: string, attrPos: string, attrOn: string): string {
  const rules: string[] = [];
  rules.push(`${sel(attrPos)} { position: relative !important; }`);
  rules.push(`${sel(attrOn)}::after {
  content: "" !important;
  position: absolute !important;
  top: calc(-1 * var(--wa-ty, 0px)) !important;
  bottom: calc(-1 * var(--wa-ty, 0px)) !important;
  left: calc(-1 * var(--wa-tx, 0px)) !important;
  right: calc(-1 * var(--wa-tx, 0px)) !important;
  background: transparent !important;
  border: 0 !important;
  pointer-events: auto !important;
  display: block !important;
}`);
  for (let v = 2; v <= 24; v += 2) {
    rules.push(`${sel(attrX, String(v))} { --wa-tx: ${v}px; }`);
    rules.push(`${sel(attrY, String(v))} { --wa-ty: ${v}px; }`);
  }
  return rules.join('\n');
}

const TARGET_CSS = targetCss('data-wa-tx', 'data-wa-ty', 'data-wa-tp', 'data-wa-t');

/* ------------------------------------------------------------------ */
/* Hit-area planning (shared by targets and promote_main)              */
/* ------------------------------------------------------------------ */

interface Box { l: number; t: number; r: number; b: number; el: Element }

function activatableFor(el: Element): Element {
  // Replaced inputs (checkbox, radio) expand their <label> instead.
  if (el.tagName === 'INPUT') {
    const labels = (el as HTMLInputElement).labels;
    const label = labels && labels.length ? labels[0] : null;
    if (label) {
      const r = label.getBoundingClientRect();
      if (r.width > 0 && r.width <= 700 && r.height > 0 && r.height <= 140) return label;
    }
  }
  return el;
}

function canExpand(el: Element): { ok: boolean; needsPosition: boolean } {
  if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.tagName === 'IMG' || el.tagName === 'IFRAME') {
    return { ok: false, needsPosition: false };
  }
  const cs = getComputedStyle(el);
  if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') return { ok: false, needsPosition: false };
  const after = getComputedStyle(el, '::after').content;
  if (after && after !== 'none' && after !== 'normal') return { ok: false, needsPosition: false };
  if (cs.display === 'inline' && el.getClientRects().length > 1) return { ok: false, needsPosition: false };
  if (cs.display === 'contents' || cs.display === 'none') return { ok: false, needsPosition: false };
  if (cs.position !== 'static') return { ok: true, needsPosition: false };
  // Adding position: relative is safe only without absolute/fixed descendants.
  const desc = el.querySelectorAll('*');
  if (desc.length > 40) return { ok: false, needsPosition: false };
  for (const d of Array.from(desc)) {
    const p = getComputedStyle(d).position;
    if (p === 'absolute' || p === 'fixed') return { ok: false, needsPosition: false };
  }
  return { ok: true, needsPosition: true };
}

/** Plan hit-area pads for `targets` at size T, capped at half the gap to the nearest other control. */
function planPads(
  targets: Element[], neighbours: Element[], T: number,
): Array<{ el: Element; padX: number; padY: number; needsPosition: boolean }> {
  const boxes: Box[] = [];
  const CELL = 128;
  const grid = new Map<string, Box[]>();
  const put = (b: Box) => {
    for (let gx = Math.floor(b.l / CELL); gx <= Math.floor(b.r / CELL); gx++) {
      for (let gy = Math.floor(b.t / CELL); gy <= Math.floor(b.b / CELL); gy++) {
        const k = `${gx},${gy}`;
        const arr = grid.get(k);
        if (arr) arr.push(b);
        else grid.set(k, [b]);
      }
    }
  };
  for (const el of neighbours) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const b = { l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY, el };
    boxes.push(b);
    put(b);
  }
  const out: Array<{ el: Element; padX: number; padY: number; needsPosition: boolean }> = [];
  for (const el of targets) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (Math.min(r.width, r.height) >= T) continue;
    const ex = canExpand(el);
    if (!ex.ok) continue;
    const me = { l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY };
    const reach = T / 2 + 24;
    let gapX = Infinity;
    let gapY = Infinity;
    const seen = new Set<Box>();
    for (let gx = Math.floor((me.l - reach) / CELL); gx <= Math.floor((me.r + reach) / CELL); gx++) {
      for (let gy = Math.floor((me.t - reach) / CELL); gy <= Math.floor((me.b + reach) / CELL); gy++) {
        for (const n of grid.get(`${gx},${gy}`) ?? []) {
          if (seen.has(n)) continue;
          seen.add(n);
          if (n.el === el || n.el.contains(el) || el.contains(n.el)) continue;
          const vOverlap = n.t < me.b + reach && n.b > me.t - reach;
          const hOverlap = n.l < me.r + reach && n.r > me.l - reach;
          if (vOverlap) {
            if (n.l >= me.r) gapX = Math.min(gapX, n.l - me.r);
            else if (n.r <= me.l) gapX = Math.min(gapX, me.l - n.r);
          }
          if (hOverlap) {
            if (n.t >= me.b) gapY = Math.min(gapY, n.t - me.b);
            else if (n.b <= me.t) gapY = Math.min(gapY, me.t - n.b);
          }
          // Boxes that already overlap ours (not nested): no room on either axis.
          if (n.l < me.r && n.r > me.l && n.t < me.b && n.b > me.t) {
            gapX = 0;
            gapY = 0;
          }
        }
      }
    }
    const want = (side: number) => Math.max(0, (T - side) / 2);
    const cap = (gap: number) => (gap === Infinity ? 24 : Math.max(0, Math.floor(gap / 2) - 1));
    const even = (v: number) => Math.max(0, Math.min(24, Math.floor(v / 2) * 2));
    const padX = even(Math.min(want(r.width), cap(gapX), 24));
    const padY = even(Math.min(want(r.height), cap(gapY), 24));
    if (padX === 0 && padY === 0) continue;
    out.push({ el, padX, padY, needsPosition: ex.needsPosition });
  }
  return out;
}

function applyPads(pads: Array<{ el: Element; padX: number; padY: number; needsPosition: boolean }>): void {
  const writes: Array<[Element, string, string]> = [];
  for (const p of pads) {
    writes.push([p.el, 'data-wa-t', '']);
    if (p.padX) writes.push([p.el, 'data-wa-tx', String(p.padX)]);
    if (p.padY) writes.push([p.el, 'data-wa-ty', String(p.padY)]);
    if (p.needsPosition) writes.push([p.el, 'data-wa-tp', '']);
  }
  setTokens(writes);
}

const TARGET_ATTRS = ['data-wa-t', 'data-wa-tx', 'data-wa-ty', 'data-wa-tp'];

/* ------------------------------------------------------------------ */
/* The tailor                                                          */
/* ------------------------------------------------------------------ */

const ACTIVATABLE = 'a[href], button, summary, label, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], [role="tab"], [role="option"], input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"], input[type="reset"]';
const NO_CAPTURE = '[draggable="true"], [contenteditable=""], [contenteditable="true"], input[type="range"], input[type="text"], input[type="search"], input[type="email"], input[type="number"], textarea, select, canvas, video, audio, iframe, [role="slider"]';

export class Tailor {
  readonly sheets = new SheetLayer();
  private host: TailorHost;
  private canvasCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

  constructor(host: TailorHost) {
    this.host = host;
  }

  /* ---------------- text plan and zoom ---------------- */

  /** `currentZoom` is the tab's zoom right now (innerWidth is measured at it); `ownZoom` is the person's own. */
  planText(fit: FitProfile, pageBodyPx: number, ownZoom: number, personChanged: boolean, currentZoom: number = ownZoom): TextPlan {
    let base: { zoom: number; residual: number; exponent: number; targetBodyPx: number };
    try {
      base = planTextScale(fit, pageBodyPx);
      if (![base.zoom, base.residual, base.exponent, base.targetBodyPx].every((v) => Number.isFinite(v) && v > 0)) {
        base = localPlan(fit, pageBodyPx);
      }
    } catch {
      base = localPlan(fit, pageBodyPx);
    }
    const total = Math.max(1, base.zoom * base.residual);
    // Keep the desktop layout: zMax = clamp(width at 100% / 800, 1, 2).
    const widthAt100 = (document.documentElement.clientWidth || innerWidth) * currentZoom;
    const zMax = Math.min(2, Math.max(1, widthAt100 / 800));
    let zoom = Math.min(base.zoom, snapDown(zMax) >= 1.1 ? snapDown(zMax) : 1);
    if (!isPreset(zoom)) zoom = snapDown(zoom);
    // Never lower the person's own zoom; when they changed it themselves, their choice wins.
    if (personChanged || zoom <= ownZoom + 0.005) zoom = ownZoom;
    const residual = Math.max(1, total / zoom);
    const exponent = residual === base.residual ? base.exponent : expOf(residual);
    const targetBodyPx = pageBodyPx * residual;
    return {
      ownZoom,
      zoom,
      residual,
      exponent,
      pageBodyPx,
      targetBodyPx,
      effectiveBodyPx: Math.round(targetBodyPx * zoom * 10) / 10,
      wasBodyPx: Math.round(pageBodyPx * ownZoom * 10) / 10,
    };
  }

  zoomOp(plan: TextPlan): Op | null {
    if (plan.zoom <= plan.ownZoom + 0.005) return null;
    const host = this.host;
    const op: Op = {
      rec: record('page_zoom', 'page', [], `zoom ${pct(plan.zoom)} (own ${pct(plan.ownZoom)}) for body ${plan.pageBodyPx} px`, host.idOf),
      elements: [],
      risk: 1,
      active: false,
      persistent: true,
      source: 'fit',
      title: `Zoomed this page to ${pct(plan.zoom)} (was ${pct(plan.ownZoom)})`,
      detail: 'Page zoom grows text, buttons and images together, so the layout keeps its proportions.',
      async apply() {
        await host.ask<number>({ type: 'setZoom', factor: plan.zoom });
        op.active = true;
      },
      async revert() {
        op.active = false;
        const info = await host.zoomInfo().catch(() => ({ factor: plan.zoom, personChanged: false }));
        if (info.personChanged) return; // the person's own choice wins
        await host.ask<number>({ type: 'setZoom', factor: plan.ownZoom });
      },
    };
    return op;
  }

  /* ---------------- batch 1: fit ops (reads only; nothing applied here) ---------------- */

  planFitOps(fit: FitProfile, read: ReadResult, plan: TextPlan): Op[] {
    const ops: Op[] = [];
    const live = read.texts.filter((t) => t.el.isConnected);
    const tm = this.textMapOp(live, plan);
    if (tm) ops.push(tm);
    const sp = this.spacingOp(fit, live);
    if (sp) ops.push(sp);
    const ms = this.measureOp(fit, live, tm ? plan : null);
    if (ms) ops.push(ms);
    const wt = this.weightOp(fit, live);
    if (wt) ops.push(wt);
    const ct = this.contrastOp(fit, live);
    if (ct) ops.push(ct);
    const tg = this.targetsOp(fit.targets.minPx, read);
    if (tg) ops.push(tg);
    if (fit.clicks.steady.on && fit.inputClass !== 'touch' && fit.inputClass !== 'keyboard') {
      ops.push(this.steadyOp(fit.clicks.steady.windowMs, fit.clicks.steady.radiusPx));
    }
    if (fit.clicks.debounce && fit.inputClass !== 'keyboard') ops.push(this.debounceOp());
    const reduceMotion = fit.attention.motion.on || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) ops.push(this.motionOp(read));
    if (fit.contrast.band !== 'N' || (fit.targets.minPx ?? 0) >= 44 || fit.inputClass === 'keyboard') ops.push(this.focusOp());
    const up = this.unpinOp(read);
    if (up) ops.push(up);
    return ops;
  }

  /** text_map: residual scale through mapFontSize, per computed size bucket, in the main region only. */
  textMapOp(texts: TextSample[], plan: TextPlan): Op | null {
    if (plan.residual <= 1.02) return null;
    const b = plan.pageBodyPx;
    const F = plan.targetBodyPx;
    const e = plan.exponent;
    const samples = texts.filter((t) => t.inMain && !t.iconFont);
    if (!samples.length) return null;
    // A single-line box that cuts its text with an ellipsis (or nowrap) is pinned at its own size, unless every box
    // of that kind has room for the larger text right now: pinning it while smaller text grows would swap their order.
    const mapped = (t: TextSample): number => {
      const s0 = Math.round(t.fontPx * 2) / 2;
      return Math.max(s0, Math.round(safeMap(s0, b, F, e) * 2) / 2);
    };
    const roomToGrow = (t: TextSample): boolean => {
      const el = t.el as HTMLElement;
      const cs = getComputedStyle(el);
      const clamp = cs.getPropertyValue('-webkit-line-clamp');
      if ((clamp && clamp !== 'none') || cs.position === 'absolute') return false;
      if (!(cs.textOverflow === 'ellipsis' || cs.whiteSpace === 'nowrap')) return false;
      if (el.scrollHeight > el.clientHeight + 1 || el.clientWidth <= 0) return false;
      const ratio = mapped(t) / Math.max(1, t.fontPx);
      return el.scrollWidth * ratio <= el.clientWidth - 2;
    };
    const riskySigs = new Set<string>();
    const bySig = new Map<string, TextSample[]>();
    for (const t of samples) if (t.clipRisk) bySig.set(t.sig, [...(bySig.get(t.sig) ?? []), t]);
    for (const [sig, ts] of bySig) if (!ts.every(roomToGrow)) riskySigs.add(sig);
    // Text that stays at its own size must not be overtaken by text that was clearly smaller (the hierarchy
    // check's rule): smaller sizes grow at most up to the pinned size. The cap rises with size, so the map stays
    // monotone and nothing shrinks.
    const pinned = [...new Set(samples.filter((t) => riskySigs.has(t.sig)).map((t) => Math.round(t.fontPx * 2) / 2))].sort((x, y) => x - y);
    const capFor = (sz: number): number => pinned.find((p) => sz * 1.05 < p) ?? Infinity;
    const buckets = new Map<string, { px: number; idx: number }>();
    const writes: Array<[Element, string, string]> = [];
    const lh: Element[] = [];
    let grown = 0;
    for (const t of samples) {
      const s = Math.round(t.fontPx * 2) / 2;
      const keep = riskySigs.has(t.sig);
      let px: number;
      if (keep) px = s; // pinned at its own size so inherited growth cannot reach it
      else {
        // One monotone map for every size (s >= b: F'(s/b)^e; s < b: min(F', s k)), so no two texts swap order.
        px = Math.max(s, Math.min(capFor(s), Math.round(safeMap(s, b, F, e) * 2) / 2));
      }
      const key = `${s}|${px}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { px, idx: buckets.size };
        buckets.set(key, bucket);
      }
      writes.push([t.el, 'data-wa-tm', String(bucket.idx)]);
      if (px > s + 0.25) grown++;
      if (!keep && t.lineHeightPx !== null && t.lineHeightPx < 1.2 * px) lh.push(t.el);
    }
    if (!grown) return null;
    const rules: string[] = [];
    for (const { px, idx } of buckets.values()) rules.push(`${sel('data-wa-tm', String(idx))} { font-size: ${px}px !important; }`);
    rules.push(`${sel('data-wa-lh')} { line-height: 1.35 !important; }`);
    const layer = this.sheets;
    const sheet = layer.make(rules.join('\n'));
    const els = writes.map((w) => w[0]);
    const op: Op = {
      rec: record('text_map', 'page', els, `residual ${plan.residual.toFixed(2)}, exponent ${plan.exponent.toFixed(2)}, ${buckets.size} size buckets`, this.host.idOf),
      elements: els,
      risk: 9,
      active: false,
      persistent: false,
      source: 'fit',
      title: `Text is ${round1(plan.effectiveBodyPx)} px here (was ${round1(plan.wasBodyPx)} px)`,
      detail: `Main text grew by one smooth scale (×${plan.residual.toFixed(2)}${plan.zoom > plan.ownZoom ? ` on top of ${pct(plan.zoom)} zoom` : ''}); headings stay larger than body text.`,
      apply() {
        setTokens(writes);
        setTokens(lh.map((el) => [el, 'data-wa-lh', ''] as [Element, string, string]));
        layer.attach(sheet);
        op.active = true;
      },
      revert() {
        layer.detach(sheet);
        clearTokens(els, ['data-wa-tm', 'data-wa-lh']);
        op.active = false;
      },
    };
    return op;
  }

  /** spacing: line height and word spacing on prose in main, never above WCAG 1.4.12 values. */
  spacingOp(fit: FitProfile, texts: TextSample[]): Op | null {
    const L = Math.min(1.5, fit.spacing.lineHeight);
    const W = Math.min(0.16, Math.max(0, fit.spacing.wordEm));
    const Lt = fit.spacing.letterEm > 0 && W >= fit.spacing.letterEm ? Math.min(0.12, fit.spacing.letterEm) : 0;
    if (L <= 1.25 && W <= 0 && Lt <= 0) return null;
    const riskySigs = new Set(texts.filter((t) => t.clipRisk).map((t) => t.sig));
    const els: Element[] = [];
    const paras: Element[] = [];
    for (const t of texts) {
      if (!t.inMain || t.control || t.iconFont || riskySigs.has(t.sig)) continue;
      const tag = t.el.tagName;
      if (tag === 'PRE' || tag === 'CODE' || tag === 'KBD' || tag === 'SAMP') continue;
      if (!(t.running || t.headingLevel !== null)) continue;
      if (t.el.closest('nav, button, [role="tab"], [role="tablist"], [role="menu"], [role="navigation"]')) continue;
      const ratio = t.lineHeightPx !== null ? t.lineHeightPx / t.fontPx : 1.2;
      if (ratio >= L - 0.02 && W <= 0 && Lt <= 0) continue;
      els.push(t.el);
      if (tag === 'P') {
        const mb = parseFloat(getComputedStyle(t.el).marginBottom);
        if (Number.isFinite(mb) && mb < 0.5 * t.fontPx) paras.push(t.el);
      }
    }
    if (!els.length) return null;
    const decl = [`line-height: ${L} !important;`];
    if (W > 0) decl.push(`word-spacing: ${W}em !important;`);
    if (Lt > 0) decl.push(`letter-spacing: ${Lt}em !important;`);
    const css = `[data-wa-sp][data-wa-sp][data-wa-sp] { ${decl.join(' ')} }
${sel('data-wa-pg')} { margin-block-end: 1em !important; }`;
    const layer = this.sheets;
    const sheet = layer.make(css);
    const op: Op = {
      rec: record('spacing', 'page', els, `line height ${L}${W ? `, word ${W}em` : ''}${Lt ? `, letter ${Lt}em` : ''}`, this.host.idOf),
      elements: els,
      risk: 8,
      active: false,
      persistent: false,
      source: 'fit',
      title: `Lines in paragraphs are spaced ${L}×${W ? ' with a little more room between words' : ''}`,
      detail: 'Only paragraphs and headings in the main part of the page; buttons, tabs and menus are left as they are.',
      apply() {
        setTokens(els.map((el) => [el, 'data-wa-sp', ''] as [Element, string, string]));
        setTokens(paras.map((el) => [el, 'data-wa-pg', ''] as [Element, string, string]));
        layer.attach(sheet);
        op.active = true;
      },
      revert() {
        layer.detach(sheet);
        clearTokens(els, ['data-wa-sp', 'data-wa-pg']);
        op.active = false;
      },
    };
    return op;
  }

  /** measure: max-inline-size on running-text blocks in main that are wider than maxCpl. */
  measureOp(fit: FitProfile, texts: TextSample[], plan: TextPlan | null): Op | null {
    const { targetCpl, maxCpl } = fit.measure;
    if (!(maxCpl > 0) || !(targetCpl > 0)) return null;
    const ctx = this.canvas();
    if (!ctx) return null;
    const writes: Array<[Element, string, string]> = [];
    const widths = new Set<number>();
    const seen = new Set<Element>();
    for (const t of texts) {
      if (!t.inMain || !t.running || t.control || t.chars < 120) continue;
      const el = t.el;
      if (seen.has(el)) continue;
      seen.add(el);
      const parent = el.parentElement;
      if (!parent) continue;
      const pcs = getComputedStyle(parent);
      if (pcs.display.includes('flex') || pcs.display.includes('grid')) continue;
      const cs = getComputedStyle(el);
      if (cs.float !== 'none' || cs.display.startsWith('inline')) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0) continue;
      const sample = visibleTextOf(el, 300);
      if (sample.length < 40) continue;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const avg = ctx.measureText(sample).width / sample.length;
      if (!(avg > 0)) continue;
      // After the text map the font is larger by s'/s; characters widen by the same factor.
      const scale = plan ? safeMap(t.fontPx, plan.pageBodyPx, plan.targetBodyPx, plan.exponent) / t.fontPx : 1;
      const charW = avg * Math.max(1, scale);
      const cpl = r.width / charW;
      if (cpl <= maxCpl) continue;
      const width = Math.max(13 * charW, Math.round((targetCpl * charW) / 8) * 8);
      if (width >= r.width - 8) continue;
      widths.add(width);
      writes.push([el, 'data-wa-m', String(width)]);
    }
    if (!writes.length) return null;
    const rules = [...widths].map((w) => `${sel('data-wa-m', String(w))} { max-inline-size: ${w}px !important; }`).join('\n');
    const layer = this.sheets;
    const sheet = layer.make(rules);
    const els = writes.map((w) => w[0]);
    const op: Op = {
      rec: record('measure', 'page', els, `target ${targetCpl} characters per line (max ${maxCpl})`, this.host.idOf),
      elements: els,
      risk: 7,
      active: false,
      persistent: false,
      source: 'fit',
      title: `Long lines are shorter (about ${targetCpl} letters)`,
      detail: `${els.length} paragraph${els.length === 1 ? ' was' : 's were'} wider than ${maxCpl} letters per line.`,
      apply() {
        setTokens(writes);
        layer.attach(sheet);
        op.active = true;
      },
      revert() {
        layer.detach(sheet);
        clearTokens(els, ['data-wa-m']);
        op.active = false;
      },
    };
    return op;
  }

  /** weight: raise thin text to the fit's floor (never above 500 for running text, never synthetic bold). */
  weightOp(fit: FitProfile, texts: TextSample[]): Op | null {
    const floor = Math.min(500, Math.max(400, Math.round(fit.weight.floor / 100) * 100));
    const riskySigs = new Set(texts.filter((t) => t.clipRisk).map((t) => t.sig));
    const els: Element[] = [];
    for (const t of texts) {
      if (t.iconFont || t.headingLevel !== null || t.weight >= floor) continue;
      if (t.control && floor > 400) continue; // wider glyphs can cut off button labels
      if (riskySigs.has(t.sig)) continue;
      if (t.fontPx >= 28) continue;
      els.push(t.el);
    }
    if (!els.length) return null;
    const layer = this.sheets;
    const sheet = layer.make(`${sel('data-wa-w')} { font-weight: ${floor} !important; }`);
    const op: Op = {
      rec: record('weight', 'page', els, `weight floor ${floor}`, this.host.idOf),
      elements: els,
      risk: 6,
      active: false,
      persistent: false,
      source: 'fit',
      title: `Thin text is a little heavier (at least ${floor})`,
      apply() {
        setTokens(els.map((el) => [el, 'data-wa-w', ''] as [Element, string, string]));
        layer.attach(sheet);
        op.active = true;
      },
      revert() {
        layer.detach(sheet);
        clearTokens(els, ['data-wa-w']);
        op.active = false;
      },
    };
    return op;
  }

  /** contrast: lift only text below the fit's floor, keeping its hue; at most 16 new colours per page. */
  contrastOp(fit: FitProfile, texts: TextSample[]): Op | null {
    if (matchMedia('(forced-colors: active)').matches) return null;
    const band = fit.contrast.band;
    const normal = Math.max(4.5, fit.contrast.floor || 4.5);
    const large = band === 'N' ? 3 : band === 'M' ? 4.5 : 7;
    interface Pair { fg: Rgba; bg: Rgba; target: number; chars: number; els: Element[]; key: string }
    const pairs = new Map<string, Pair>();
    let sampled = 0;
    for (const t of texts) {
      if (t.disabled || t.iconFont || t.opacity < 0.95) continue;
      if (t.el.closest('img, svg, picture, video, canvas, [aria-disabled="true"], :disabled')) continue;
      const fg = rgbaOf(t.color);
      if (!fg || fg.a < 0.6) continue;
      const bg = effectiveBackground(t.el);
      if (!bg) continue;
      sampled++;
      const fgFlat = fg.a < 1 ? over(fg, bg) : fg;
      const isLarge = t.fontPx >= 24 || (t.fontPx >= 18.66 && t.weight >= 700);
      const target = isLarge ? large : normal;
      const cr = safeRatio(fgFlat, bg);
      if (cr >= target - 0.05) continue;
      const key = `${t.color}|${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}|${target}`;
      const p = pairs.get(key);
      if (p) {
        p.chars += t.chars;
        p.els.push(t.el);
      } else pairs.set(key, { fg: fgFlat, bg, target, chars: t.chars, els: [t.el], key });
      if (sampled > 3000) break;
    }
    if (!pairs.size) return null;
    const chosen = [...pairs.values()].sort((a, b) => b.chars - a.chars).slice(0, 16);
    const writes: Array<[Element, string, string]> = [];
    const rules: string[] = [];
    chosen.forEach((p, i) => {
      const color = safeLift(p.fg, p.bg, p.target + 0.1);
      if (/url\(/i.test(color)) return;
      rules.push(`${sel('data-wa-c', String(i))} { color: ${color} !important; }`);
      for (const el of p.els) writes.push([el, 'data-wa-c', String(i)]);
    });
    if (!writes.length) return null;
    const layer = this.sheets;
    const sheet = layer.make(rules.join('\n'));
    const els = writes.map((w) => w[0]);
    const op: Op = {
      rec: record('contrast', 'page', els, `floor ${normal}:1 (large text ${large}:1), ${chosen.length} colours`, this.host.idOf),
      elements: els,
      risk: 4,
      active: false,
      persistent: false,
      source: 'fit',
      title: `Darkened ${els.length} faint text item${els.length === 1 ? '' : 's'} to at least ${normal}:1 contrast`,
      detail: 'Only text below your contrast floor changed, and each colour kept its hue.',
      apply() {
        setTokens(writes);
        layer.attach(sheet);
        op.active = true;
      },
      revert() {
        layer.detach(sheet);
        clearTokens(els, ['data-wa-c']);
        op.active = false;
      },
    };
    return op;
  }

  /** targets: invisible hit-area expansion (::after) to the fit's size, capped at half the gap to neighbours. */
  targetsOp(minPx: number | null, read: ReadResult, source: LedgerEntry['source'] = 'fit'): Op | null {
    if (minPx === null || minPx <= 24) return null;
    const T = Math.min(96, minPx);
    const candidates: Element[] = [];
    let inlineSkipped = 0;
    const seen = new Set<Element>();
    for (const c of read.controls) {
      if (!c.el.isConnected || c.disabled) continue;
      if (c.kind === 'field' || c.kind === 'select') continue;
      if (c.inline) {
        inlineSkipped++;
        continue;
      }
      if (this.host.isOurUi(c.el)) continue;
      const target = activatableFor(c.el);
      if (seen.has(target)) continue;
      seen.add(target);
      candidates.push(target);
    }
    const neighbours = read.controls.filter((c) => c.el.isConnected).map((c) => activatableFor(c.el));
    const pads = planPads(candidates, neighbours, T);
    if (!pads.length) return null;
    return this.padsOp('targets', pads, T, source, inlineSkipped);
  }

  private padsOp(
    kind: 'targets' | 'promote_main', pads: Array<{ el: Element; padX: number; padY: number; needsPosition: boolean }>,
    T: number, source: LedgerEntry['source'], inlineSkipped: number,
  ): Op {
    const sheet = this.sheets.shared('targets', TARGET_CSS);
    const els = pads.map((p) => p.el);
    const op: Op = {
      rec: record(kind, kind === 'targets' ? 'page' : 'element', els, `hit area ${T} px on ${els.length} controls`, this.host.idOf),
      elements: els,
      risk: 5,
      active: false,
      persistent: false,
      source,
      title: `Made ${els.length} button${els.length === 1 ? '' : 's'} and link${els.length === 1 ? '' : 's'} easier to hit (${T} px hit area)`,
      detail: inlineSkipped
        ? `Buttons look the same; their clickable area is larger. ${inlineSkipped} link${inlineSkipped === 1 ? ' inside a sentence was' : 's inside sentences were'} left as ${inlineSkipped === 1 ? 'it is' : 'they are'}.`
        : 'Buttons look the same; their clickable area is larger.',
      hitProbes: pads.map((p) => ({ el: p.el, padX: p.padX, padY: p.padY })),
      apply() {
        sheet.attach();
        applyPads(pads.filter((p) => p.el.isConnected && op.elements.includes(p.el)));
        op.active = true;
      },
      revert() {
        clearTokens(op.elements, TARGET_ATTRS);
        sheet.detach();
        op.active = false;
      },
      drop(el: Element) {
        clearTokens([el], TARGET_ATTRS);
        const i = op.elements.indexOf(el);
        if (i >= 0) op.elements.splice(i, 1);
        op.hitProbes = op.hitProbes?.filter((h) => h.el !== el);
      },
    };
    return op;
  }

  /** steady_clicks: pointer capture so a small slip during a press still clicks the pressed control. */
  steadyOp(windowMs: number, radiusPx: number): Op {
    const T = Math.min(400, Math.max(200, windowMs || 300));
    const r = Math.min(24, Math.max(4, radiusPx || 10));
    const host = this.host;
    let st: { el: Element; id: number; x: number; y: number; t0: number } | null = null;
    const release = () => {
      if (!st) return;
      try {
        if (st.el.hasPointerCapture(st.id)) st.el.releasePointerCapture(st.id);
      } catch {
        /* already released */
      }
      st = null;
    };
    const down = (e: PointerEvent) => {
      if (!e.isTrusted || e.button !== 0 || (e.pointerType !== 'mouse' && e.pointerType !== 'pen')) return;
      if (host.isOurUi(e.target)) return;
      const origin = e.target instanceof Element ? e.target : null;
      // Never capture a press that starts in a text field, slider, editor or media (even inside a label).
      if (!origin || origin.closest(NO_CAPTURE)) return;
      const t = origin.closest(ACTIVATABLE);
      if (!t || t.closest(NO_CAPTURE)) return;
      try {
        t.setPointerCapture(e.pointerId);
        st = { el: t, id: e.pointerId, x: e.clientX, y: e.clientY, t0: e.timeStamp };
      } catch {
        st = null;
      }
    };
    const move = (e: PointerEvent) => {
      if (!st || e.pointerId !== st.id) return;
      const d = Math.hypot(e.clientX - st.x, e.clientY - st.y);
      const dt = e.timeStamp - st.t0;
      // A deliberate drag or cancel: far at any time, or past the radius after the window.
      if (d > 3 * r || (dt > T && d > r)) release();
    };
    const up = (e: PointerEvent) => {
      if (!st || e.pointerId !== st.id) return;
      const under = document.elementFromPoint(e.clientX, e.clientY);
      if (under && !st.el.contains(under)) host.onBehaviour?.('steady');
      st = null; // capture releases itself after pointerup; the click goes to the captured control (Chrome 135+)
    };
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const op: Op = {
      rec: record('steady_clicks', 'page', [], `window ${T} ms, radius ${r} px`, host.idOf),
      elements: [],
      risk: 0,
      active: false,
      persistent: true,
      source: 'fit',
      title: 'Steady clicks: a small slip while clicking still counts',
      detail: `If the pointer moves a little (up to ${r} px within ${T} ms) during a click, the click still goes to the button you pressed.`,
      apply() {
        window.addEventListener('pointerdown', down, opts);
        window.addEventListener('pointermove', move, opts);
        window.addEventListener('pointerup', up, opts);
        window.addEventListener('pointercancel', release, opts);
        op.active = true;
      },
      revert() {
        window.removeEventListener('pointerdown', down, opts);
        window.removeEventListener('pointermove', move, opts);
        window.removeEventListener('pointerup', up, opts);
        window.removeEventListener('pointercancel', release, opts);
        release();
        op.active = false;
      },
    };
    return op;
  }

  /** debounce: drop a second mouse click on the same control within 400 ms (keyboard clicks untouched). */
  debounceOp(): Op {
    const host = this.host;
    const WINDOW = 400;
    let last: { el: Element; t: number } | null = null;
    let dropped = 0;
    const skipPage = !!document.querySelector('[ondblclick]');
    const click = (e: MouseEvent) => {
      if (!e.isTrusted || e.detail === 0 || e.button !== 0) return;
      if (host.isOurUi(e.target)) return;
      const t = e.target instanceof Element ? e.target.closest(ACTIVATABLE) : null;
      if (!t || t.matches('input[type="number"], [role="spinbutton"], [role="slider"]') || t.closest('[ondblclick]')) {
        last = null;
        return;
      }
      if (last && last.el === t && e.timeStamp - last.t < WINDOW) {
        e.stopImmediatePropagation();
        e.preventDefault();
        dropped++;
        host.onBehaviour?.('debounce');
        last = { el: t, t: e.timeStamp };
        return;
      }
      last = { el: t, t: e.timeStamp };
    };
    const opts: AddEventListenerOptions = { capture: true };
    const op: Op = {
      rec: record('debounce', 'page', [], `drop repeat clicks within ${WINDOW} ms${skipPage ? ' (skipped: page uses double clicks)' : ''}`, host.idOf),
      elements: [],
      risk: 0,
      active: false,
      persistent: true,
      source: 'fit',
      title: 'Ignoring accidental double clicks on buttons and links',
      detail: `A second click on the same button within ${WINDOW} ms is ignored. Keyboard presses are never changed.`,
      apply() {
        if (skipPage) return;
        window.addEventListener('click', click, opts);
        op.active = true;
      },
      revert() {
        window.removeEventListener('click', click, opts);
        op.active = false;
        void dropped;
      },
    };
    return op;
  }

  /** motion: animations jump to their end state, autoplaying muted video pauses, carousels get paused if they allow. */
  motionOp(read: ReadResult): Op {
    const layer = this.sheets;
    const sheet = layer.make(MOTION_CSS);
    const pausedAnims: Animation[] = [];
    const pausedVideos: HTMLMediaElement[] = [];
    const pausedSvgs: SVGSVGElement[] = [];
    const hovered: Element[] = [];
    const host = this.host;
    let summary = { animations: 0, videos: 0, carousels: 0 };
    const op: Op = {
      rec: record('motion', 'page', read.carousels, 'reduce motion', host.idOf),
      elements: [...read.carousels],
      risk: 2,
      active: false,
      persistent: true,
      source: 'fit',
      title: 'Animations and transitions jump straight to their end',
      apply() {
        layer.attach(sheet);
        summary = { animations: 0, videos: 0, carousels: 0 };
        try {
          for (const a of document.getAnimations()) {
            const timing = a.effect?.getComputedTiming();
            if (timing && timing.iterations === Infinity) {
              if (a.playState === 'running') {
                a.pause();
                pausedAnims.push(a);
                summary.animations++;
              }
            } else if (a.playState === 'running') {
              try {
                a.finish();
                summary.animations++;
              } catch {
                /* infinite or unfinishable */
              }
            }
          }
        } catch {
          /* getAnimations unsupported */
        }
        for (const v of Array.from(document.querySelectorAll('video'))) {
          if (!v.paused && v.muted && !host.isOurUi(v)) {
            v.pause();
            pausedVideos.push(v);
            summary.videos++;
          }
        }
        for (const svg of Array.from(document.querySelectorAll('svg'))) {
          if (svg.querySelector('animate, animateTransform, animateMotion')) {
            try {
              svg.pauseAnimations();
              pausedSvgs.push(svg);
            } catch {
              /* not an SVGSVGElement */
            }
          }
        }
        for (const root of read.carousels) {
          if (!root.isConnected) continue;
          const pause = Array.from(root.querySelectorAll('button, [role="button"]')).find((b) => /\b(pause|stop)\b/i.test(`${b.getAttribute('aria-label') ?? ''} ${b.textContent ?? ''}`));
          if (pause instanceof HTMLElement) {
            pause.click(); // the site's own pause control (WCAG 2.2.2)
            summary.carousels++;
          } else {
            // Many carousels pause while hovered: tell it the pointer is over it.
            for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter'] as const) {
              const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
              root.dispatchEvent(new Ctor(type, { bubbles: type.endsWith('over'), cancelable: false, composed: true }));
            }
            hovered.push(root);
          }
        }
        const bits: string[] = [];
        if (summary.animations) bits.push(`${summary.animations} animation${summary.animations === 1 ? '' : 's'} finished or paused`);
        if (summary.videos) bits.push(`${summary.videos} muted video${summary.videos === 1 ? '' : 's'} paused`);
        if (summary.carousels) bits.push(`pressed the pause button on ${summary.carousels} moving banner${summary.carousels === 1 ? '' : 's'}`);
        op.detail = bits.length ? `${bits.join(', ')}.` : 'Animations and transitions jump to their end state.';
        op.active = true;
      },
      revert() {
        layer.detach(sheet);
        for (const a of pausedAnims.splice(0)) {
          try {
            a.play();
          } catch {
            /* gone */
          }
        }
        for (const v of pausedVideos.splice(0)) void v.play().catch(() => undefined);
        for (const s of pausedSvgs.splice(0)) {
          try {
            s.unpauseAnimations();
          } catch {
            /* gone */
          }
        }
        for (const root of hovered.splice(0)) {
          for (const type of ['pointerout', 'pointerleave', 'mouseout', 'mouseleave'] as const) {
            const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
            root.dispatchEvent(new Ctor(type, { bubbles: type.endsWith('out'), cancelable: false, composed: true }));
          }
        }
        op.active = false;
      },
    };
    return op;
  }

  /** focus_ring: a two-tone :focus-visible ring (selector only; focus order never changes). */
  focusOp(): Op {
    const layer = this.sheets;
    const sheet = layer.make(FOCUS_CSS);
    const op: Op = {
      rec: record('focus_ring', 'page', [], 'two-tone focus ring', this.host.idOf),
      elements: [],
      risk: 0,
      active: false,
      persistent: true,
      source: 'fit',
      title: 'Keyboard focus shows a clear ring',
      apply() {
        layer.attach(sheet);
        op.active = true;
      },
      revert() {
        layer.detach(sheet);
        op.active = false;
      },
    };
    return op;
  }

  /** unpin_sticky: a sticky or fixed top bar taller than 20% of the screen scrolls away (never consent or dialogs). */
  unpinOp(read: ReadResult): Op | null {
    const vh = document.documentElement.clientHeight || innerHeight;
    const bars = read.stickyBars.filter((el) => {
      if (!el.isConnected) return false;
      const r = el.getBoundingClientRect();
      return r.top <= 2 && r.height > 0 && r.bottom < vh * 0.6;
    });
    if (!bars.length) return null;
    const covered = bars.reduce((s, el) => s + el.getBoundingClientRect().height, 0);
    if (covered <= 0.2 * vh) return null;
    const writes: Array<[Element, string, string]> = bars.map((el) => [el, 'data-wa-unpin', getComputedStyle(el).position === 'fixed' ? 'f' : 's']);
    const layer = this.sheets;
    const sheet = layer.make(`${sel('data-wa-unpin', 's')} { position: relative !important; top: auto !important; }
${sel('data-wa-unpin', 'f')} { position: absolute !important; }`);
    const share = Math.round((covered / vh) * 100);
    const op: Op = {
      rec: record('unpin_sticky', 'element', bars, `sticky top bars cover ${share}% of the screen`, this.host.idOf),
      elements: bars,
      risk: 3,
      active: false,
      persistent: false,
      source: 'fit',
      title: `Let the top bar scroll away (it covered ${share}% of the screen)`,
      apply() {
        setTokens(writes);
        layer.attach(sheet);
        op.active = true;
      },
      revert() {
        layer.detach(sheet);
        clearTokens(bars, ['data-wa-unpin']);
        op.active = false;
      },
    };
    return op;
  }

  /* ---------------- batch 2: ops from Jev's decisions ---------------- */

  /** dim folded distractions (opacity 0.35, grayscale when safe; restored on hover and focus). */
  dimOp(target: Element | Element[], title: string, detail: string, p: number): Op {
    const els = Array.isArray(target) ? target : [target];
    const grayOk = (el: Element) => {
      for (const d of Array.from(el.querySelectorAll('*')).slice(0, 400)) {
        const pos = getComputedStyle(d).position;
        if (pos === 'fixed' || pos === 'sticky') return false;
      }
      return true;
    };
    const gray = new Map(els.map((el) => [el, grayOk(el)] as const));
    const sheet = this.sheets.shared('dim', DIM_CSS);
    const op: Op = {
      rec: record('dim', 'element', els, detail, this.host.idOf),
      elements: els,
      risk: 3,
      active: false,
      persistent: false,
      source: 'jev',
      title,
      detail: 'Faded, not hidden: it comes back when you point at it or move to it with the keyboard.',
      p,
      apply() {
        for (const el of els) el.setAttribute('data-wa-dim', gray.get(el) ? 'g' : '');
        sheet.attach();
        op.active = true;
      },
      revert() {
        for (const el of els) el.removeAttribute('data-wa-dim');
        sheet.detach();
        op.active = false;
      },
    };
    return op;
  }

  /** promote_main: an outline and a hit area on the main action; it never moves. */
  promoteOp(el: Element, read: ReadResult | null, minPx: number | null, title: string, p: number): Op {
    const T = Math.max(44, Math.min(96, minPx ?? 44));
    const target = activatableFor(el);
    const neighbours = read ? read.controls.filter((c) => c.el.isConnected).map((c) => activatableFor(c.el)) : [];
    const pads = planPads([target], neighbours, T);
    const outlineSheet = this.sheets.shared('main', MAIN_CSS);
    const targetSheet = this.sheets.shared('targets', TARGET_CSS);
    let ownPads = false;
    const op: Op = {
      rec: record('promote_main', 'element', [target], `outline and ${T} px hit area`, this.host.idOf),
      elements: [target],
      risk: 2,
      active: false,
      persistent: false,
      source: 'jev',
      title,
      detail: 'Outlined where it is; nothing on the page moved.',
      p,
      hitProbes: pads.map((x) => ({ el: x.el, padX: x.padX, padY: x.padY })),
      apply() {
        target.setAttribute('data-wa-main', '');
        outlineSheet.attach();
        // If the targets op already expanded this control, leave its tokens alone.
        ownPads = pads.length > 0 && !target.hasAttribute('data-wa-t');
        if (ownPads) {
          targetSheet.attach();
          applyPads(pads);
        }
        op.active = true;
      },
      revert() {
        target.removeAttribute('data-wa-main');
        outlineSheet.detach();
        if (ownPads) {
          clearTokens([target], TARGET_ATTRS);
          targetSheet.detach();
          ownPads = false;
        }
        op.active = false;
      },
      drop(x: Element) {
        clearTokens([x], TARGET_ATTRS);
        op.hitProbes = [];
      },
    };
    return op;
  }

  /* ---------------- marking late content with existing tokens ---------------- */

  /** Give newly added text the same size bucket as existing text of the same computed size (no new CSS). */
  markLateText(op: Op, added: Element[], texts: TextSample[]): number {
    if (!op.active || op.rec.kind !== 'text_map') return 0;
    const bySize = new Map<number, string>();
    for (const el of op.elements) {
      const v = el.getAttribute('data-wa-tm');
      if (v === null) continue;
      const t = texts.find((x) => x.el === el);
      if (t) bySize.set(Math.round(t.fontPx * 2) / 2, v);
    }
    let n = 0;
    const writes: Array<[Element, string, string]> = [];
    for (const root of added) {
      const list = [root, ...Array.from(root.querySelectorAll('*')).slice(0, 400)];
      for (const el of list) {
        if (el.hasAttribute('data-wa-tm') || this.host.isOurUi(el)) continue;
        let direct = '';
        for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) direct += (c as Text).data;
        if (!collapse(direct)) continue;
        const s = Math.round(parseFloat(getComputedStyle(el).fontSize) * 2) / 2;
        const bucket = bySize.get(s);
        if (bucket === undefined) continue;
        writes.push([el, 'data-wa-tm', bucket]);
        op.elements.push(el);
        n++;
      }
    }
    setTokens(writes);
    return n;
  }

  private canvas(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
    if (this.canvasCtx) return this.canvasCtx;
    try {
      this.canvasCtx = new OffscreenCanvas(8, 8).getContext('2d');
    } catch {
      this.canvasCtx = document.createElement('canvas').getContext('2d');
    }
    return this.canvasCtx;
  }
}

function isPreset(z: number): boolean {
  return CHROME_ZOOM_PRESETS.some((p) => Math.abs(p - z) < 0.001);
}

function pct(z: number): string {
  return `${Math.round(z * 100)}%`;
}

function round1(v: number): number {
  return Math.round(v);
}
