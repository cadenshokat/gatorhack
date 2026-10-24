// Owner: D2. Small hooks shared by the in-page chrome.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { FitProfile } from '@webable/core';
import type { EngineApi, EngineState } from '../../contracts';
import { ask } from '../../engine/bus';
import { clamp } from './format';

/** Re-render on every engine notification. Reads the state fresh, so in-place mutation is fine. */
export function useEngineState(api: EngineApi): EngineState {
  const [, setTick] = useState(0);
  useEffect(() => {
    const off = api.subscribe(() => setTick((t) => (t + 1) % 1_000_000));
    return () => off();
  }, [api]);
  return api.getState();
}

function systemReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** The fit's "reduce motion" or the system setting. */
export function useReducedMotion(fit: FitProfile | null): boolean {
  const [sys, setSys] = useState(systemReducedMotion);
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    const on = () => setSys(mq ? mq.matches : false);
    mq.addEventListener('change', on);
    return () => mq?.removeEventListener('change', on);
  }, []);
  return sys || Boolean(fit?.attention?.motion?.on);
}

/** The tab's zoom factor (the tailor may zoom the tab). Our UI is zoomed with the page, so sizes divide by it. */
export function useTabZoom(): number {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    let alive = true;
    let timer = 0;
    const read = () => {
      let p: Promise<unknown>;
      try {
        p = ask<unknown>({ type: 'getZoom' }, 2500);
      } catch {
        return;
      }
      p.then((r) => {
        if (!alive) return;
        const z = typeof r === 'number' ? r
          : r && typeof r === 'object' && typeof (r as { factor?: unknown }).factor === 'number' ? (r as { factor: number }).factor
          : r && typeof r === 'object' && typeof (r as { zoom?: unknown }).zoom === 'number' ? (r as { zoom: number }).zoom
          : 1;
        if (Number.isFinite(z) && z > 0.2 && z < 6) setZoom(z);
      }).catch(() => {});
    };
    read();
    // Chrome zoom changes fire a resize in the page.
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(read, 250);
    };
    window.addEventListener('resize', onResize, { passive: true });
    const poll = window.setInterval(read, 10_000);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return zoom;
}

export interface ChromeSizing {
  /** One design pixel, in CSS px. All chrome spacing is a multiple of it. */
  u: number;
  fontPx: number;
  targetPx: number;
}

/** Size the chrome from the fit (rendered size), then divide by the tab zoom. */
export function chromeSizing(fit: FitProfile | null, zoom: number): ChromeSizing {
  const body = fit ? (fit.text?.override ?? fit.text?.bodyPx ?? 16) : 16;
  const effective = clamp(Math.round(body * 0.78), 15, 20);
  const z = zoom > 0 ? zoom : 1;
  const fontPx = Math.max(11, effective / z);
  const targetEffective = Math.max(44, fit?.targets?.minPx ?? 44);
  return { u: fontPx / 15, fontPx, targetPx: Math.max(30, targetEffective / z) };
}

/** Tween a number toward its target for the live counter. */
export function useTweened(target: number, ms: number, reduce: boolean, start?: number): number {
  const first = reduce || start === undefined ? target : start;
  const [value, setValue] = useState(first);
  const from = useRef(first);
  const shown = useRef(first);
  useEffect(() => {
    if (reduce || !Number.isFinite(target) || ms <= 0) {
      shown.current = target;
      setValue(target);
      return;
    }
    from.current = shown.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = clamp((now - start) / ms, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from.current + (target - from.current) * eased;
      shown.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduce]);
  return value;
}

/** True once `ms` have passed since `key` last changed, unless `hold` is set. */
export function useElapsed(key: string, ms: number, hold: boolean): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(false);
    if (hold) return;
    const t = window.setTimeout(() => setDone(true), ms);
    return () => window.clearTimeout(t);
  }, [key, ms, hold]);
  return done;
}

const INTERACTIVE =
  'a[href], button, input, select, textarea, summary, label, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], [onclick], [tabindex]:not([tabindex="-1"]), [contenteditable="true"], iframe';

export type PillSide = 'right' | 'left';
export interface PillSpot {
  side: PillSide;
  /** Distance from the viewport bottom, CSS px. */
  bottom: number;
}

interface SpotScore {
  /** Probes over a site control that stays put on screen (fixed or sticky: chat bubbles, cookie and survey buttons). */
  fixedControl: number;
  /** Probes over a site control in the page flow (it scrolls away). */
  flowControl: number;
  /** Probes over fixed overlay content that is not a control (a survey card's text). */
  fixedContent: number;
}

function weight(s: SpotScore): number {
  return s.fixedControl * 8 + s.flowControl * 2 + s.fixedContent;
}

/**
 * Where the WebAble pill sits: the corner (or a slot up the edge) with no site control under it. Fixed controls
 * (a survey's "No thanks", a chat bubble) count most; the pill only moves when a spot is clearly better, and
 * not while the person is scrolling, so it does not hop around.
 */
export function usePillSpot(opts: {
  isOurUi: (t: EventTarget | null) => boolean;
  widthPx: number;
  heightPx: number;
  marginPx: number;
  /** Keep the pill at least this far from the bottom (our own bars live below it). */
  minBottomPx: number;
  frozen: boolean;
  /** Changes when the page under the pill changes a lot (original page shown, Calm view closed): look again now. */
  recheckKey?: string;
}): PillSpot {
  const { isOurUi, widthPx, heightPx, marginPx, minBottomPx, frozen, recheckKey = '' } = opts;
  const [spot, setSpot] = useState<PillSpot>({ side: 'right', bottom: Math.max(marginPx, minBottomPx) });
  const current = useRef(spot);
  current.current = spot;
  useEffect(() => {
    if (frozen) return;
    let lastScroll = 0;
    let pending: { key: string; hits: number } | null = null;

    const fixedCache = new WeakMap<Element, boolean>();
    const inFixed = (el: Element): boolean => {
      const hit = fixedCache.get(el);
      if (hit !== undefined) return hit;
      let cur: Element | null = el;
      let fixed = false;
      for (let i = 0; cur && i < 14; i++) {
        let pos = '';
        try {
          pos = getComputedStyle(cur).position;
        } catch {
          pos = '';
        }
        if (pos === 'fixed' || pos === 'sticky') {
          fixed = true;
          break;
        }
        cur = cur.parentElement;
      }
      fixedCache.set(el, fixed);
      return fixed;
    };
    const probe = (x: number, y: number, s: SpotScore) => {
      let stack: Element[] = [];
      try {
        stack = document.elementsFromPoint(x, y);
      } catch {
        return;
      }
      // The first real element under the point. A modal dialog's backdrop hit-tests as the dialog itself, so an
      // element whose box does not contain the point is looked through, and so is a fixed full-screen backdrop
      // (the page under a backdrop still counts: otherwise every spot scores the same and the pill never moves).
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const vh = window.innerHeight;
      const top = stack.find((el) => {
        if (isOurUi(el) || el === document.documentElement || el === document.body) return false;
        const r = el.getBoundingClientRect();
        if (!(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) return false;
        if (r.width >= vw * 0.9 && r.height >= vh * 0.9 && !el.closest(INTERACTIVE) && inFixed(el)) return false;
        return true;
      });
      if (!top) return;
      const control = top.closest(INTERACTIVE);
      const fixed = inFixed(top);
      if (control) {
        if (fixed) s.fixedControl++;
        else s.flowControl++;
      } else if (fixed) {
        s.fixedContent++;
      }
    };
    const score = (side: PillSide, bottom: number): SpotScore => {
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const vh = window.innerHeight;
      const left = side === 'right' ? vw - marginPx - widthPx : marginPx;
      const top = vh - bottom - heightPx;
      const s: SpotScore = { fixedControl: 0, flowControl: 0, fixedContent: 0 };
      const xs = [left + 4, left + widthPx / 2, left + widthPx - 4];
      const ys = [top + 4, top + heightPx / 2, top + heightPx - 4];
      for (const x of xs) for (const y of ys) probe(x, y, s);
      return s;
    };
    const check = () => {
      if (document.hidden) return;
      if (performance.now() - lastScroll < 900) return;
      const vh = window.innerHeight;
      const base = Math.max(marginPx, minBottomPx);
      const step = Math.max(24, Math.round(heightPx * 0.8));
      const limit = Math.max(base, vh * 0.42);
      const cands: PillSpot[] = [
        { side: 'right', bottom: base },
        { side: 'left', bottom: base },
      ];
      for (let b = base + step; b < limit; b += step) cands.push({ side: 'right', bottom: b });
      for (let b = base + step; b < limit; b += step) cands.push({ side: 'left', bottom: b });
      const cur = current.current;
      const curOk = cur.bottom >= base && cur.bottom < limit + step;
      const atHome = cur.side === 'right' && cur.bottom === base;
      const curW = curOk ? weight(score(cur.side, cur.bottom)) : Number.POSITIVE_INFINITY;
      // Go back to the bottom-right home spot as soon as it is clear again (seen twice), so the pill stays predictable.
      if (!atHome && weight(score('right', base)) === 0) {
        const key = `right:${base}`;
        if (curOk && curW === 0 && (!pending || pending.key !== key)) {
          pending = { key, hits: 1 };
          return;
        }
        pending = null;
        setSpot({ side: 'right', bottom: base });
        return;
      }
      if (curW === 0) {
        pending = null;
        return;
      }
      let best = cands[0]!;
      let bestW = Number.POSITIVE_INFINITY;
      for (const c of cands) {
        const w = weight(score(c.side, c.bottom));
        // Small preference for the bottom-right home spot and for staying low.
        const penalty = (c.side === 'left' ? 0.25 : 0) + (c.bottom - base) / (vh * 4);
        if (w + penalty < bestW) {
          best = c;
          bestW = w + penalty;
        }
        if (w === 0 && c.side === 'right' && c.bottom === base) break;
      }
      // Move only for a clearly better spot, seen twice in a row (the page may be animating), except when the pill
      // sits on a site control that stays on screen: then move at once.
      if (!(bestW + 1 < curW)) {
        pending = null;
        return;
      }
      const key = `${best.side}:${best.bottom}`;
      if (curOk && curW < 8 && (!pending || pending.key !== key)) {
        pending = { key, hits: 1 };
        return;
      }
      pending = null;
      if (best.side !== cur.side || best.bottom !== cur.bottom) setSpot(best);
    };
    const onScroll = () => {
      lastScroll = performance.now();
    };
    const first = window.setTimeout(check, 60);
    const again = window.setTimeout(check, 700);
    const iv = window.setInterval(check, 1600);
    window.addEventListener('resize', check, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(again);
      window.clearInterval(iv);
      window.removeEventListener('resize', check);
      window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
    };
  }, [isOurUi, widthPx, heightPx, marginPx, minBottomPx, frozen, recheckKey]);
  // Our own bar below the pill may appear later: never sit on it.
  const base = Math.max(marginPx, minBottomPx);
  return spot.bottom < base ? { ...spot, bottom: base } : spot;
}

/** macOS shows the Option and Shift symbols; other systems spell the keys out. */
export function isMac(): boolean {
  try {
    const p = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '';
    return /mac/i.test(p);
  } catch {
    return false;
  }
}

/** The shortcut modifiers: '⌥⇧' on a Mac, 'Alt+Shift' elsewhere. */
export function modifierLabel(): string {
  return isMac() ? '⌥⇧' : 'Alt+Shift';
}

/** 'Alt+Shift+L' (or '⌥⇧L' on a Mac). */
export function shortcutLabel(letter: string): string {
  return isMac() ? `⌥⇧${letter}` : `Alt+Shift+${letter}`;
}
