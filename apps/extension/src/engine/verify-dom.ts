// Owner: C1. Hard DOM checks after every batch of ops; a failing op is reversed.
//
// Pipeline (research-fitting §9): snapshot B over a fixed probe set -> apply -> settle (2 rAF + fonts) ->
// restore the reading anchor -> snapshot A -> core runChecks(B, A) -> attribute the failure (core attribute(),
// which reads the op tokens measured here) -> reverse that op -> settle and check again (up to 5 rounds).
// Hit-area tokens whose edges do not reach their control are dropped (no rollback).
//
// False rollbacks are worse than none, so:
//  - elements the page itself changed during the batch (a rotating carousel, a chat panel opening) are left
//    out of both snapshots;
//  - a control or text only counts as covered when what covers it is something WebAble changed
//    (a site's own cookie banner covering more after zoom is not our doing).

import { attribute, runChecks, specCoverage } from '@webable/core';
import type {
  CheckName, CheckResult, ElementMeasure, FitSpec, OpKind, PageMeasure, PageOutline,
} from '@webable/core';
import type { Op } from './tailor';
import { effectiveBackground } from './tailor';
import type { ReadResult } from './reader';
import { parseRgb, ratio } from './reader';
import { settle } from './nav';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Snapshot {
  measure: PageMeasure;
  els: Map<string, Element>;
  at: number;
}

export interface SnapshotContext {
  /** Ops whose tokens are on the page (opIds come from the active ones). */
  ops?: Op[];
  /**
   * Ops whose elements count as "something WebAble changed" when they cover text or a control. Must be the same
   * set in both snapshots of a batch (active ops plus the batch), so only new covering counts.
   */
  coverOps?: Op[];
  /** The fit's contrast floor (4.5 / 7 / …). */
  contrastFloor?: number;
  /**
   * The region the text map scales. Headings outside it keep their size while body text inside grows, so they
   * are compared with text in their own region only (pairwise order), not with the page's body size.
   */
  mainRoot?: Element | null;
}

interface Fail {
  result: CheckResult;
  ids: string[];
  kinds?: OpKind[];
  local: boolean;
}

export interface VerifyOutcome {
  checks: CheckResult[];
  reversed: Array<{ op: Op; result: CheckResult }>;
  dropped: number;
  ms: number;
  soft: string[];
}

export interface VerifyHost {
  idOf(el: Element): string;
  isOurUi(t: EventTarget | null): boolean;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex], [contenteditable=""], [contenteditable="true"], iframe';
const CONTROL = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="switch"]';
const HELP_NAME = /\b(help|contact|support|chat|call|faq|questions?|pharmacist|customer (service|care)|feedback)\b/i;

/** Which op kinds can plausibly cause each failure (fallback attribution when core is unavailable). */
const CAUSES: Record<CheckName, OpKind[]> = {
  clipping: ['text_map', 'spacing', 'weight', 'measure', 'targets', 'unpin_sticky', 'page_zoom'],
  overlap: ['text_map', 'spacing', 'targets', 'measure', 'unpin_sticky', 'weight', 'page_zoom'],
  contrast: ['contrast', 'dim'],
  reachability: ['targets', 'promote_main', 'unpin_sticky', 'dim', 'text_map', 'page_zoom'],
  content_loss: ['text_map', 'measure', 'spacing', 'unpin_sticky', 'page_zoom'],
  hierarchy: ['text_map'],
  overflow: ['text_map', 'measure', 'spacing', 'targets', 'weight', 'page_zoom'],
  reading_position: [],
  visual: [],
};

const PLAIN: Record<CheckName, string> = {
  clipping: 'it cut off text',
  overlap: 'it made things overlap',
  contrast: 'it made text harder to read',
  reachability: 'it covered or faded a control',
  content_loss: 'it hid some text',
  hierarchy: 'it put some text out of size order',
  overflow: 'it made the page scroll sideways',
  reading_position: 'it moved your place on the page',
  visual: 'the screenshot check flagged it',
};

export function plainCheck(name: CheckName): string {
  return PLAIN[name];
}

/* ------------------------------------------------------------------ */
/* Measuring helpers                                                   */
/* ------------------------------------------------------------------ */

type Rect = { x: number; y: number; w: number; h: number };

function directTextNodes(el: Element): Text[] {
  const out: Text[] = [];
  for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && (c as Text).data.trim()) out.push(c as Text);
  return out;
}

function regionOf(el: Element): string {
  const lm = el.closest('header, nav, main, aside, footer, dialog, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], [role="dialog"]');
  if (!lm) return 'page';
  const role = lm.getAttribute('role');
  const name = role ?? lm.tagName.toLowerCase();
  switch (name) {
    case 'banner':
    case 'header':
      return 'header';
    case 'navigation':
    case 'nav':
      return 'menu';
    case 'complementary':
    case 'aside':
      return 'side column';
    case 'contentinfo':
    case 'footer':
      return 'footer';
    case 'main':
      return 'main content';
    default:
      return name;
  }
}

function headingLevel(el: Element): number | null {
  const m = /^H([1-6])$/.exec(el.tagName);
  if (m) return Number(m[1]);
  if (el.getAttribute('role') === 'heading') return Number(el.getAttribute('aria-level') ?? '2') || 2;
  return null;
}

function effectiveOpacity(el: Element): number {
  let o = 1;
  let n: Element | null = el;
  let d = 0;
  while (n && d < 30) {
    const v = parseFloat(getComputedStyle(n).opacity);
    if (Number.isFinite(v)) o *= v;
    n = n.parentElement;
    d++;
  }
  return o;
}

function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const bt = Math.min(a.y + a.h, b.y + b.h);
  return r > x && bt > y ? { x, y, w: r - x, h: bt - y } : null;
}

/** Clip box: intersection of ancestors' padding boxes that clip (≤ 6 levels or the nearest scroller). */
function clipBox(el: Element, fixed: boolean, vw: number, vh: number): Rect | null {
  let box: Rect | null = fixed ? { x: 0, y: 0, w: vw, h: vh } : null;
  let n = el.parentElement;
  let d = 0;
  while (n && d < 6 && n !== document.body && n !== document.documentElement) {
    const cs = getComputedStyle(n);
    const ox = cs.overflowX;
    const oy = cs.overflowY;
    const clips = ox === 'hidden' || ox === 'clip' || oy === 'hidden' || oy === 'clip' || cs.contain.includes('paint');
    const scroller = ox === 'auto' || ox === 'scroll' || oy === 'auto' || oy === 'scroll';
    if (clips || scroller) {
      const r = n.getBoundingClientRect();
      const pad: Rect = { x: r.left + n.clientLeft, y: r.top + n.clientTop, w: n.clientWidth, h: n.clientHeight };
      if (clips) box = box ? intersect(box, pad) ?? { x: pad.x, y: pad.y, w: 0, h: 0 } : pad;
      if (scroller) break;
    }
    n = n.parentElement;
    d++;
  }
  return box;
}

function rectOf(r: DOMRect): Rect {
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}

/* ------------------------------------------------------------------ */
/* The verifier                                                        */
/* ------------------------------------------------------------------ */

export class Verifier {
  private host: VerifyHost;
  /** Probe elements by id (the same ids in both snapshots of a batch). */
  private lastEls = new Map<string, Element>();
  private volatile = new Set<Element>();
  private mo: MutationObserver | null = null;

  constructor(host: VerifyHost) {
    this.host = host;
  }

  /** Fixed probe set: controls, text and headings in the viewport plus half a screen, op targets, clip ancestors, help. */
  probe(read: ReadResult | null, extra: Element[] = []): Element[] {
    const vh = document.documentElement.clientHeight || innerHeight;
    const lo = -0.5 * vh;
    const hi = 1.5 * vh;
    const inBand = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.bottom >= lo && r.top <= hi && r.width > 0 && r.height > 0;
    };
    const set = new Set<Element>();
    const add = (el: Element | null | undefined) => {
      if (el && el.isConnected && !this.host.isOurUi(el)) set.add(el);
    };
    let controls = 0;
    if (read) {
      for (const c of read.controls) {
        if (controls >= 200) break;
        if (c.el.isConnected && inBand(c.el)) {
          add(c.el);
          controls++;
        }
      }
      let texts = 0;
      const ordered = [...read.texts.filter((t) => t.inMain), ...read.texts.filter((t) => !t.inMain)];
      for (const t of ordered) {
        if (texts >= 260) break;
        if (t.el.isConnected && inBand(t.el)) {
          add(t.el);
          texts++;
        }
      }
      for (const n of read.nodes.values()) {
        if (!n.el.isConnected) continue;
        if (n.help && (n.kind === 'link' || n.kind === 'button')) add(n.el);
        if ((n.kind === 'heading' || n.kind === 'image') && inBand(n.el)) add(n.el);
      }
    } else {
      for (const el of Array.from(document.querySelectorAll(CONTROL)).slice(0, 400)) {
        if (controls >= 200) break;
        if (inBand(el)) {
          add(el);
          controls++;
        }
      }
    }
    let ex = 0;
    for (const el of extra) {
      if (ex >= 150) break;
      if (el.isConnected && inBand(el)) {
        add(el);
        ex++;
      }
    }
    return [...set].sort((a, b) => (a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  }

  /** Start recording elements the page itself changes (left out of the checks). */
  watchVolatile(): void {
    this.volatile.clear();
    this.mo?.disconnect();
    this.mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes' && r.attributeName?.startsWith('data-wa-')) continue;
        const t = r.target.nodeType === 1 ? (r.target as Element) : r.target.parentElement;
        if (this.volatile.size >= 800) break;
        if (t && t !== document.documentElement && t !== document.body && !this.host.isOurUi(t)) this.volatile.add(t);
      }
    });
    this.mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  }

  stopVolatile(): void {
    this.mo?.takeRecords();
    this.mo?.disconnect();
    this.mo = null;
  }

  private isVolatile(el: Element): boolean {
    for (const v of this.volatile) if (v === el || v.contains(el)) return true;
    return false;
  }

  snapshot(probe: Element[], ctx: SnapshotContext = {}): Snapshot {
    const vw = document.documentElement.clientWidth || innerWidth;
    const vh = document.documentElement.clientHeight || innerHeight;
    const elements: ElementMeasure[] = [];
    const els = new Map<string, Element>();
    const idOfProbe = new Map<Element, string>();
    for (const el of probe) {
      const id = this.host.idOf(el);
      els.set(id, el);
      idOfProbe.set(el, id);
    }
    // Op tokens: element -> op ids (self and up to 5 ancestors are read per element below).
    const tokens = new Map<Element, string[]>();
    for (const op of ctx.ops ?? []) {
      if (!op.active) continue;
      for (const el of op.elements) {
        const list = tokens.get(el);
        if (list) list.push(op.rec.id);
        else tokens.set(el, [op.rec.id]);
      }
    }
    const opEls = new Set<Element>();
    for (const op of ctx.coverOps ?? ctx.ops ?? []) for (const el of op.elements) opEls.add(el);
    const coveredByUs = (hit: Element | null, el: Element, x: number, y: number): boolean => {
      if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return false;
      if (this.host.isOurUi(hit)) return false;
      // An invisible hit area (our transparent ::after) outside its control's own box paints nothing.
      if (hit.hasAttribute('data-wa-t')) {
        const b = hit.getBoundingClientRect();
        if (x < b.left || x > b.right || y < b.top || y > b.bottom) return false;
      }
      let n: Element | null = hit;
      let d = 0;
      while (n && d < 6) {
        // Covered by an element WebAble changed, unless that element also contains the covered one
        // (two parts of one region are not "covering" each other).
        if (opEls.has(n)) return !n.contains(el);
        n = n.parentElement;
        d++;
      }
      return false;
    };
    const textByRegion: Record<string, number> = {};
    const headingPx: Record<number, number> = {};
    const tabOrder: string[] = [];
    let focusable = 0;
    let anchor: PageMeasure['readingAnchor'] = null;
    let occlusionBudget = 160;
    // Whether an element sits in a position: fixed layer (a dialog, a cookie bar, a chat panel). Such layers cover
    // the page by design, so their boxes are compared only with boxes in the same layer.
    const fixedCache = new Map<Element, boolean>();
    const inFixedLayer = (start: Element): boolean => {
      const path: Element[] = [];
      let p: Element | null = start;
      let hit = false;
      while (p && p !== document.body && p !== document.documentElement) {
        const known = fixedCache.get(p);
        if (known !== undefined) {
          hit = known;
          break;
        }
        path.push(p);
        if (getComputedStyle(p).position === 'fixed') {
          hit = true;
          break;
        }
        p = p.parentElement;
      }
      for (const x of path) fixedCache.set(x, hit);
      return hit;
    };

    for (const el of probe) {
      const id = idOfProbe.get(el) ?? this.host.idOf(el);
      const connected = el.isConnected;
      const cs = connected ? getComputedStyle(el) : null;
      const r = connected ? el.getBoundingClientRect() : new DOMRect(0, 0, 0, 0);
      const visible = connected && el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true }) && r.width * r.height >= 1;
      const textNodes = connected ? directTextNodes(el) : [];
      const textChars = textNodes.reduce((s, t) => s + t.data.trim().length, 0);
      const fontPx = cs && textChars > 0 ? parseFloat(cs.fontSize) : null;
      let contrast: number | null = null;
      let background: string | null = null;
      if (cs && textChars > 0) {
        const bg = effectiveBackground(el);
        const fg = parseRgb(cs.color);
        if (bg) background = `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`;
        if (bg && fg) {
          const flat = fg.a < 1 ? { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 } : fg;
          contrast = Math.round(ratio(flat, bg) * 100) / 100;
        }
      }
      const isFocusable = connected && el.matches(FOCUSABLE) && !(el as HTMLButtonElement).disabled;
      const tabIndex = el instanceof HTMLElement ? el.tabIndex : null;
      const inTabOrder = isFocusable && visible && (tabIndex ?? -1) >= 0 && !el.closest('[inert]');
      if (isFocusable && visible) focusable++;
      if (inTabOrder) tabOrder.push(id);
      const rawLevel = headingLevel(el);
      const hl = rawLevel !== null && ctx.mainRoot && ctx.mainRoot !== document.body && !ctx.mainRoot.contains(el) ? null : rawLevel;
      const region = connected ? regionOf(el) : 'page';
      if (visible && textChars > 0) textByRegion[region] = (textByRegion[region] ?? 0) + textChars;
      if (hl !== null && fontPx !== null && visible) headingPx[hl] = Math.max(headingPx[hl] ?? 0, fontPx);
      if (!anchor && visible && textChars > 20 && r.top >= 0 && r.top <= vh * 0.25) anchor = { id, top: Math.round(r.top) };

      const m: ElementMeasure = {
        id,
        rect: rectOf(r),
        scrollW: connected ? el.scrollWidth : 0,
        scrollH: connected ? el.scrollHeight : 0,
        clientW: connected ? el.clientWidth : 0,
        clientH: connected ? el.clientHeight : 0,
        overflowHidden: !!cs && (cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.overflowY === 'hidden' || cs.overflowY === 'clip'),
        fontPx,
        color: cs ? cs.color : null,
        background,
        contrast,
        visible,
        focusable: isFocusable,
        inTabOrder,
        tabIndex,
        textChars,
        headingLevel: hl,
        region,
      };

      if (cs && connected) {
        // Nearest probed ancestor, and the op tokens on this element and up to 5 ancestors.
        const ops: string[] = [];
        let p: Element | null = el;
        let depth = 0;
        let parentId: string | null = null;
        while (p && depth < 40) {
          if (depth <= 5) for (const t of tokens.get(p) ?? []) if (!ops.includes(t)) ops.push(t);
          if (depth > 0 && parentId === null) parentId = idOfProbe.get(p) ?? null;
          if (depth > 5 && parentId !== null) break;
          p = p.parentElement;
          depth++;
        }
        m.parentId = parentId;
        m.fixedLayer = inFixedLayer(el);
        if (ops.length) m.opIds = ops;
        m.fontWeight = parseFloat(cs.fontWeight) || 400;
        const lh = parseFloat(cs.lineHeight);
        if (Number.isFinite(lh)) m.lineHeightPx = lh;
        const isControl = el.matches(CONTROL);
        m.isControl = isControl;
        m.pointerEvents = cs.pointerEvents !== 'none';
        const inViewport = r.top >= 0 && r.left >= 0 && r.bottom <= vh && r.right <= vw && r.width > 0;
        m.inViewport = inViewport;
        m.inDoc = r.left + scrollX >= -1 && r.top + scrollY >= -1 && r.right + scrollX <= document.documentElement.scrollWidth + 1;
        const clamp = cs.getPropertyValue('-webkit-line-clamp');
        m.truncated = (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1)
          || (!!clamp && clamp !== 'none' && el.scrollHeight > el.clientHeight + 1);
        const scroller = cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowY === 'auto' || cs.overflowY === 'scroll';
        m.scrollable = scroller && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
        const tag = el.tagName;
        m.isMedia = tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'svg' || tag === 'SVG';
        m.dimmed = !!el.closest('[data-wa-dim]');
        m.contrastOp = el.hasAttribute('data-wa-c');

        // Text lines (for overlap) and the visible share inside the clip box (for clipping).
        if (textNodes.length && visible) {
          const lines: Rect[] = [];
          for (const t of textNodes.slice(0, 6)) {
            const range = document.createRange();
            range.selectNodeContents(t);
            for (const lr of Array.from(range.getClientRects()).slice(0, 8)) {
              if (lr.width * lr.height >= 1) lines.push(rectOf(lr));
            }
          }
          if (lines.length) {
            m.lines = lines.slice(0, 12);
            const fixed = cs.position === 'fixed' || !!el.closest('[style*="position: fixed"]');
            const clip = clipBox(el, fixed, vw, vh);
            if (clip) {
              let total = 0;
              let inside = 0;
              for (const l of lines) {
                const a = l.w * l.h;
                total += a;
                const i = intersect(l, clip);
                if (i) inside += i.w * i.h;
              }
              m.visFrac = total > 0 ? Math.round((inside / total) * 1000) / 1000 : 1;
            } else m.visFrac = 1;
            // Paint occlusion, counted only when what covers the text is something WebAble changed.
            if (inViewport && occlusionBudget > 0) {
              occlusionBudget--;
              const first = lines[0];
              if (first) {
                let occ = 0;
                for (const fx of [0.15, 0.5, 0.85]) {
                  const px = first.x + first.w * fx;
                  const py = first.y + first.h / 2;
                  if (coveredByUs(document.elementFromPoint(px, py), el, px, py)) occ++;
                }
                m.occluded = occ;
              }
            }
          }
        }

        // Controls: hit test (5 points), counted as blocked only when covered by our change.
        if (isControl && visible && inViewport) {
          const pts: Array<[number, number]> = [
            [r.left + r.width / 2, r.top + r.height / 2],
            [r.left + r.width * 0.25, r.top + r.height * 0.25],
            [r.left + r.width * 0.75, r.top + r.height * 0.25],
            [r.left + r.width * 0.25, r.top + r.height * 0.75],
            [r.left + r.width * 0.75, r.top + r.height * 0.75],
          ];
          let blocked = 0;
          for (const [x, y] of pts) {
            if (coveredByUs(document.elementFromPoint(x, y), el, x, y)) blocked++;
          }
          m.hitOK = blocked < pts.length;
        }
        if (isControl) {
          const name = `${el.getAttribute('aria-label') ?? ''} ${(el.textContent ?? '').slice(0, 120)}`;
          if (HELP_NAME.test(name) || /^(tel|mailto):/i.test(el.getAttribute('href') ?? '')) {
            m.isHelp = true;
            m.opacity = Math.round(effectiveOpacity(el) * 100) / 100;
          }
        }
      }
      elements.push(m);
    }

    const active = document.activeElement;
    const measure: PageMeasure = {
      elements,
      docScrollW: document.documentElement.scrollWidth,
      viewportW: document.documentElement.clientWidth,
      visibleTextByRegion: textByRegion,
      focusableCount: focusable,
      tabOrder,
      headingPxByLevel: headingPx,
      readingAnchor: anchor,
      activeId: active ? idOfProbe.get(active) ?? null : null,
      activeIsBody: !active || active === document.body,
    };
    if (ctx.contrastFloor) measure.contrastFloor = ctx.contrastFloor;
    this.lastEls = els;
    return { measure, els, at: performance.now() };
  }

  /** Scroll so the reading anchor sits where it was (|delta| > 2 px). */
  restoreAnchor(before: Snapshot): void {
    const a = before.measure.readingAnchor;
    if (!a) return;
    const el = before.els.get(a.id);
    if (!el || !el.isConnected) return;
    const delta = el.getBoundingClientRect().top - a.top;
    if (Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
  }

  /**
   * Run all checks for one batch. For each failure: reverse the op it is attributed to and check again; if the
   * failure is still there, that op was not the cause, so it is re-applied and the next candidate is tried
   * (bisection, never a cascade of innocent reversals). Then drop hit tokens that do not work.
   */
  async verify(
    batch: Op[], before: Snapshot, probe: Element[], ctx: SnapshotContext,
    revert: (op: Op, why: CheckResult) => Promise<void>,
    reapply?: (op: Op) => Promise<void>,
  ): Promise<VerifyOutcome> {
    const t0 = performance.now();
    this.restoreAnchor(before);
    const snapCtx = (): SnapshotContext => ({ ...ctx, ops: ctx.ops ?? batch });
    let after = this.snapshot(probe, snapCtx());
    let ev = this.evaluate(before, after, batch.filter((o) => o.active));
    const reversed: VerifyOutcome['reversed'] = [];
    const tried = new Map<string, Set<Op>>();
    const unresolved = new Set<string>();
    const keyOf = (f: Fail) => `${f.result.name}|${[...f.ids].sort().join(',')}`;
    const stillFails = (f: Fail, fails: Fail[]) => fails.some((g) => g.result.name === f.result.name
      && (f.ids.length === 0 ? g.ids.length === 0 : g.ids.some((id) => f.ids.includes(id))));

    for (let round = 0; round < 8; round++) {
      const f = ev.fails.find((x) => !unresolved.has(keyOf(x)));
      if (!f) break;
      const key = keyOf(f);
      const seen = tried.get(key) ?? new Set<Op>();
      tried.set(key, seen);
      const op = this.attributeFail(f, batch.filter((o) => o.active && !seen.has(o)));
      if (!op) {
        unresolved.add(key);
        continue;
      }
      seen.add(op);
      const result: CheckResult = { name: f.result.name, pass: false, detail: f.result.detail, opId: op.rec.id };
      await revert(op, result);
      await settle();
      after = this.snapshot(probe, snapCtx());
      const next = this.evaluate(before, after, batch.filter((o) => o.active));
      if (stillFails(f, next.fails) && reapply) {
        // Not the cause: put it back exactly as it was.
        await reapply(op);
        await settle();
        after = this.snapshot(probe, snapCtx());
        ev = this.evaluate(before, after, batch.filter((o) => o.active));
        continue;
      }
      reversed.push({ op, result });
      ev = next;
    }

    let dropped = 0;
    for (const op of batch) {
      if (!op.active || !op.hitProbes || !op.drop) continue;
      dropped += this.probeHitAreas(op);
    }

    const checks: CheckResult[] = [...ev.results.filter((r) => r.pass || !ev.fails.some((f) => f.result === r))];
    for (const f of ev.fails) checks.push({ name: f.result.name, pass: false, detail: `${f.result.detail} (not caused by one change; left as is)` });
    for (const r of reversed) checks.push(r.result);
    return { checks, reversed, dropped, ms: Math.round(performance.now() - t0), soft: ev.soft };
  }

  /** Probe expanded hit areas; returns how many element tokens were dropped. */
  probeHitAreas(op: Op): number {
    const vw = document.documentElement.clientWidth || innerWidth;
    const vh = document.documentElement.clientHeight || innerHeight;
    let dropped = 0;
    for (const p of [...(op.hitProbes ?? [])]) {
      const el = p.el;
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      const box = { l: r.left - p.padX + 1, t: r.top - p.padY + 1, r: r.right + p.padX - 1, b: r.bottom + p.padY - 1 };
      if (box.l < 0 || box.t < 0 || box.r > vw || box.b > vh) continue; // only what is on screen
      const pts: Array<[number, number]> = [];
      if (p.padX) pts.push([box.l, (box.t + box.b) / 2], [box.r, (box.t + box.b) / 2]);
      if (p.padY) pts.push([(box.l + box.r) / 2, box.t], [(box.l + box.r) / 2, box.b]);
      const miss = pts.some(([x, y]) => {
        const h = document.elementFromPoint(x, y);
        return !(h && (h === el || el.contains(h) || this.host.isOurUi(h)));
      });
      if (miss) {
        op.drop?.(el);
        dropped++;
      }
    }
    return dropped;
  }

  /* -------------------------------------------------------------- */

  private evaluate(before: Snapshot, after: Snapshot, active: Op[]): { results: CheckResult[]; fails: Fail[]; soft: string[] } {
    const fails: Fail[] = [];
    const soft: string[] = [];
    const B = this.withoutVolatile(before.measure);
    const A = this.withoutVolatile(after.measure, new Set(B.elements.map((e) => e.id)));
    let results: CheckResult[] = [];
    try {
      results = runChecks(B, A, active.map((o) => o.rec.id));
      for (const r of results) {
        if (!r.pass) fails.push({ result: r, ids: idsIn(r.detail), local: false });
        else if (r.detail.startsWith('soft:')) soft.push(r.detail.slice(5).trim());
      }
    } catch {
      // Core checks unavailable: run the local set.
      const local = this.localChecks(B, A, before, after);
      fails.push(...local);
      const names: CheckName[] = ['clipping', 'content_loss', 'hierarchy', 'overflow', 'contrast', 'reachability'];
      results = names.map((name) => {
        const fs = local.filter((f) => f.result.name === name);
        return fs.length ? { name, pass: false, detail: fs.map((f) => f.result.detail).join('; ') } : { name, pass: true, detail: passDetail(name) };
      });
    }
    return { results, fails, soft };
  }

  private withoutVolatile(m: PageMeasure, keep?: Set<string>): PageMeasure {
    const drop = new Set<string>();
    for (const e of m.elements) {
      if (keep && !keep.has(e.id)) {
        drop.add(e.id);
        continue;
      }
      const el = this.lastEls.get(e.id);
      if (el && this.volatile.size && this.isVolatile(el)) drop.add(e.id);
    }
    if (!drop.size) return m;
    return {
      ...m,
      elements: m.elements.filter((e) => !drop.has(e.id)),
      tabOrder: m.tabOrder.filter((id) => !drop.has(id)),
    };
  }

  /** Fallback checks when the core module is unavailable (a subset of §9 on the same measurements). */
  private localChecks(B: PageMeasure, A: PageMeasure, before: Snapshot, after: Snapshot): Fail[] {
    const fails: Fail[] = [];
    const a = new Map(A.elements.map((e) => [e.id, e] as const));
    if (A.docScrollW - A.viewportW > 8 && B.docScrollW - B.viewportW <= 8) {
      fails.push({ result: { name: 'overflow', pass: false, detail: `The page now scrolls sideways (by ${A.docScrollW - A.viewportW} px)` }, ids: [], local: true });
    }
    const lost: string[] = [];
    const clipped: string[] = [];
    const blocked: string[] = [];
    const faded: string[] = [];
    for (const e of B.elements) {
      const x = a.get(e.id);
      if (!x) continue;
      if (e.visible && e.textChars > 0 && !x.visible) lost.push(e.id);
      if (e.textChars > 0 && (x.visFrac ?? 1) < (e.visFrac ?? 1) - 0.02) clipped.push(e.id);
      if (e.hitOK !== false && x.hitOK === false && x.inViewport) blocked.push(e.id);
      if (e.isHelp && (e.opacity ?? 1) >= 0.9 && e.visible && (!x.visible || (x.opacity ?? 1) < 0.9)) faded.push(e.id);
    }
    if (lost.length) fails.push({ result: { name: 'content_loss', pass: false, detail: `Text disappeared (${lost.slice(0, 4).join(', ')})` }, ids: lost, local: true });
    if (clipped.length) fails.push({ result: { name: 'clipping', pass: false, detail: `Text is cut off (${clipped.slice(0, 4).join(', ')})` }, ids: clipped, local: true });
    if (blocked.length) fails.push({ result: { name: 'reachability', pass: false, detail: `A control can no longer be clicked (${blocked.slice(0, 4).join(', ')})` }, ids: blocked, local: true });
    if (faded.length) fails.push({ result: { name: 'reachability', pass: false, detail: `A help link faded (${faded.slice(0, 4).join(', ')})` }, ids: faded, kinds: ['dim'], local: true });
    const seqB = B.tabOrder.filter((id) => A.tabOrder.includes(id)).join(',');
    const seqA = A.tabOrder.filter((id) => B.tabOrder.includes(id)).join(',');
    if (seqA !== seqB) fails.push({ result: { name: 'reachability', pass: false, detail: 'The keyboard order changed' }, ids: [], local: true });
    // Hierarchy: within a region, a clearly larger text never becomes smaller.
    const inv: string[] = [];
    const byRegion = new Map<string, ElementMeasure[]>();
    for (const e of B.elements) {
      if (e.fontPx === null || !e.visible) continue;
      const k = e.region ?? 'page';
      const list = byRegion.get(k);
      if (list) list.push(e);
      else byRegion.set(k, [e]);
    }
    for (const list of byRegion.values()) {
      const sorted = [...list].sort((p, q) => (q.fontPx ?? 0) - (p.fontPx ?? 0)).slice(0, 120);
      for (let i = 0; i < sorted.length && inv.length < 6; i++) {
        const ei = sorted[i];
        const ai = ei ? a.get(ei.id) : undefined;
        if (!ei || !ai || ai.fontPx === null) continue;
        for (let j = i + 1; j < sorted.length; j++) {
          const ej = sorted[j];
          if (!ej || (ei.fontPx ?? 0) <= 1.05 * (ej.fontPx ?? 0)) continue;
          const aj = a.get(ej.id);
          if (aj && aj.fontPx !== null && ai.fontPx < aj.fontPx - 0.25) {
            inv.push(ei.id);
            break;
          }
        }
      }
    }
    if (inv.length) fails.push({ result: { name: 'hierarchy', pass: false, detail: `Text sizes swapped order (${inv.slice(0, 4).join(', ')})` }, ids: inv, kinds: ['text_map'], local: true });
    void before;
    void after;
    return fails;
  }

  private attributeFail(f: Fail, active: Op[]): Op | null {
    if (!active.length) return null;
    const viaElements = () => this.byElements(f, active);
    const viaKinds = () => {
      if (!f.kinds?.length) return null;
      const hinted = active.filter((o) => f.kinds?.includes(o.rec.kind));
      if (hinted.length === 1) return hinted[0] ?? null;
      return hinted.length ? this.byElements(f, hinted) ?? hinted[0] ?? null : null;
    };
    const viaCore = () => {
      try {
        const id = attribute(f.result, active.map((o) => o.rec));
        return id ? active.find((o) => o.rec.id === id) ?? null : null;
      } catch {
        return null;
      }
    };
    const viaRisk = () => {
      const kinds = CAUSES[f.result.name];
      return active.filter((o) => kinds.includes(o.rec.kind)).sort((x, y) => y.risk - x.risk)[0] ?? null;
    };
    return f.local ? viaElements() ?? viaKinds() ?? viaCore() ?? viaRisk() : viaCore() ?? viaElements() ?? viaRisk();
  }

  private byElements(f: Fail, ops: Op[]): Op | null {
    for (const id of f.ids) {
      let n: Element | null = this.lastEls.get(id) ?? null;
      let d = 0;
      while (n && d < 6) {
        const el = n;
        const hit = ops.find((o) => o.elements.includes(el));
        if (hit) return hit;
        n = n.parentElement;
        d++;
      }
    }
    return null;
  }
}

function idsIn(detail: string): string[] {
  return Array.from(detail.matchAll(/\b([nv]\d{1,5})\b/g)).map((m) => m[1] ?? '').filter(Boolean);
}

function passDetail(name: CheckName): string {
  switch (name) {
    case 'clipping':
      return 'No text newly cut off';
    case 'overlap':
      return 'Nothing newly overlaps';
    case 'contrast':
      return 'No text got fainter';
    case 'reachability':
      return 'Every control is still reachable and the keyboard order is unchanged';
    case 'content_loss':
      return 'No content lost';
    case 'hierarchy':
      return 'Text sizes keep their order';
    case 'overflow':
      return 'No sideways scrolling';
    case 'reading_position':
      return 'The reading position held';
    case 'visual':
      return 'The screenshot check passed';
    default:
      return 'Passed';
  }
}

/* ------------------------------------------------------------------ */
/* Calm view conservation                                              */
/* ------------------------------------------------------------------ */

/**
 * Visible-text coverage of a Calm view spec: every outline node must be rendered or in a drawer
 * (directly, or through an ancestor that is placed). 100% is required.
 */
export function calmCoverage(spec: FitSpec, outline: PageOutline): { coverage: number; missing: string[] } {
  // Core's coverage follows the placement rule the renderer uses: a listed node brings its subtree, and a
  // container counts as placed when all its children are (a wrapper is not "missing" because its parts are
  // listed one by one). Listing such a wrapper again would pull its whole subtree into the drawer.
  return specCoverage(spec, outline);
}

/** Place every missing node (the topmost ones; descendants come along) into a "More on this page" end drawer. */
export function completeSpec(spec: FitSpec, outline: PageOutline): { spec: FitSpec; added: number } {
  const { missing } = calmCoverage(spec, outline);
  if (!missing.length) return { spec, added: 0 };
  const missingSet = new Set(missing);
  const byId = new Map(outline.nodes.map((n) => [n.id, n] as const));
  const tops = missing.filter((id) => {
    const p = byId.get(id)?.parent;
    return !p || !missingSet.has(p);
  });
  const sections = [...spec.sections];
  let rest = [...tops];
  const drawerIdx = sections.findIndex((s) => s.state === 'end_drawer' && s.label === 'More on this page');
  const drawer = drawerIdx >= 0 ? sections[drawerIdx] : undefined;
  if (drawer) {
    const room = Math.max(0, 40 - drawer.nodes.length);
    sections[drawerIdx] = { ...drawer, nodes: [...drawer.nodes, ...rest.slice(0, room)] };
    rest = rest.slice(room);
  }
  for (let i = 0; i < rest.length; i += 40) {
    sections.push({
      heading_ref: null, label: 'More on this page', role: 'other', nodes: rest.slice(i, i + 40), layout: 'as_is',
      emphasis: 'quiet', state: 'end_drawer', why: 'not_needed_for_task', show_first: 0,
    });
  }
  return { spec: { ...spec, sections }, added: tops.length };
}
