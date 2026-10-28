// Virtual tab zoom (engine-seams §2.3, Option B). The shell resizes the iframe to frame.w/f x frame.h/f and scales it
// by f, so inside the frame innerWidth becomes w/f, media queries and vw follow, and a real `resize` fires: what
// Chrome's tab zoom does. The numbers follow apps/extension/entrypoints/background.ts setZoom: round to 0.01, clamp
// to 0.25-5, and the same factor again is no change.

import type { ZoomInfo } from '../../../extension/src/engine/bus';

export interface VirtualZoom {
  /** Resolves to the factor applied. */
  set(factor: number): number;
  get(): number;
  info(): ZoomInfo;
  /** A new document: forget what WebAble set. */
  pageStart(): void;
}

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 5;

/** background.ts:480 */
export function normalizeZoom(factor: number): number {
  const f = Number.isFinite(factor) ? factor : 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(f * 100) / 100));
}

/** `apply` is FrameHost.zoom: it resizes and scales the iframe and returns the factor it applied. */
export function createVirtualZoom(apply: (f: number) => number): VirtualZoom {
  let current = 1;
  let ours: number | null = null;
  return {
    set(factor) {
      const f = normalizeZoom(factor);
      ours = f;
      // The same factor again is no change (and no resize).
      if (Math.abs(current - f) < 0.005) return current;
      let got = f;
      try {
        const r = apply(f);
        if (typeof r === 'number' && Number.isFinite(r) && r > 0) got = r;
      } catch {
        return current;
      }
      current = got;
      return got;
    },
    get: () => current,
    info: () => ({ factor: current, ours, personChanged: false }),
    pageStart() {
      ours = null;
    },
  };
}
