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
  'a[href], button, input, select, textarea, summary, label, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], [tabindex]:not([tabindex="-1"]), [contenteditable="true"], iframe';

/**
 * Pick a bottom offset on the right edge where the pill covers no page control
 * (cookie buttons, chat bubbles, help links). Re-checked every few seconds.
 */
export function useFreeSpot(opts: {
  isOurUi: (t: EventTarget | null) => boolean;
  widthPx: number;
  heightPx: number;
  marginPx: number;
  frozen: boolean;
}): number {
  const { isOurUi, widthPx, heightPx, marginPx, frozen } = opts;
  const [bottom, setBottom] = useState(marginPx);
  useEffect(() => {
    if (frozen) return;
    const covered = (x: number, y: number): boolean => {
      let stack: Element[] = [];
      try {
        stack = document.elementsFromPoint(x, y);
      } catch {
        return false;
      }
      const top = stack.find((el) => !isOurUi(el));
      if (!top) return false;
      return Boolean(top.closest(INTERACTIVE));
    };
    const check = () => {
      if (document.hidden) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const step = Math.max(24, Math.round(heightPx * 0.75));
      const limit = vh * 0.55;
      for (let b = marginPx; b < limit; b += step) {
        const top = vh - b - heightPx;
        const left = vw - marginPx - widthPx;
        const pts: Array<[number, number]> = [
          [left + widthPx / 2, top + heightPx / 2],
          [left + 4, top + 4],
          [left + widthPx - 4, top + 4],
          [left + 4, top + heightPx - 4],
          [left + widthPx - 4, top + heightPx - 4],
        ];
        if (!pts.some(([x, y]) => covered(x, y))) {
          setBottom(b);
          return;
        }
      }
      setBottom(marginPx);
    };
    check();
    const iv = window.setInterval(check, 2500);
    window.addEventListener('resize', check, { passive: true });
    return () => {
      window.clearInterval(iv);
      window.removeEventListener('resize', check);
    };
  }, [isOurUi, widthPx, heightPx, marginPx, frozen]);
  return bottom;
}
