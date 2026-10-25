// Owner: S (round 3), P. The "Explain" pill that appears beside a long text selection. Explaining is never automatic.
// It sits just below the end of the selection (above it when there is no room), in viewport px divided by the
// layer's CSS zoom, so it lands next to the text however the in-page layer is scaled.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { EngineApi } from '../../contracts';
import { IconSpark } from '../panel/icons';
import { useLayerZoom } from './ExplainCard';

export interface Explainable {
  text: string;
  rect: { x: number; y: number; w: number; h: number };
}

/** Where the pill goes, in viewport px (pure). `w`/`h` are the pill's own size in viewport px. */
export function placePill(rect: Explainable['rect'], vw: number, vh: number, w: number, h: number): { left: number; top: number } {
  const gap = 8;
  const left = Math.max(8, Math.min(vw - w - 8, rect.x + rect.w - w));
  const below = rect.y + rect.h + gap;
  const top = below + h + gap <= vh ? below : rect.y - h - gap >= 8 ? rect.y - h - gap : Math.max(8, Math.min(vh - h - 8, below));
  return { left, top };
}

export function ExplainAffordance({ api, item, onDone, u = 1 }: { api: EngineApi; item: Explainable; onDone: () => void; u?: number }) {
  const probe = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const k = useLayerZoom(probe);
  // The pill's own size in viewport px, measured once drawn (about 132 x 44 design px until then).
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const r = btn.current?.getBoundingClientRect();
    if (r && r.width > 0 && (!size || Math.abs(r.width - size.w) > 0.5 || Math.abs(r.height - size.h) > 0.5)) setSize({ w: r.width, h: r.height });
  });
  const w = size?.w ?? 132 * u * k;
  const h = size?.h ?? Math.max(40, 44 * u * k);
  const { left, top } = placePill(item.rect, window.innerWidth, window.innerHeight, w, h);
  return (
    <>
      <span ref={probe} hidden />
      <button
        ref={btn}
        class="wa-ex-pill"
        style={{ left: `${Math.round(left / k)}px`, top: `${Math.round(top / k)}px` }}
        title="Explain this in plain words. Sends only this passage to OpenAI, with personal details removed."
        // Keep the page's selection while pressing our button.
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => {
          void api.explainSelection(item.text, item.rect).catch(() => {});
          onDone();
        }}
      >
        <IconSpark size={15} />
        Explain
      </button>
    </>
  );
}
