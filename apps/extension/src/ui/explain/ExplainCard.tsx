// Owner: S (round 3), P. The plain-words card, beside the outlined original (never over it, never instead of it).
// It says only what a reader needs: the plain version, whether it was checked against the original, and any
// sentence the plain version did not cover, shown as written. No numbers, no model names. Positions are viewport px; they are divided by the layer's CSS zoom so the
// card stays beside the passage however the in-page layer is scaled.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { RefObject } from 'preact';
import type { ExplainResult } from '@webable/core';
import type { EngineApi, EngineState } from '../../contracts';
import { IconCheck, IconClose, IconWarn } from '../panel/icons';

type Anchor = NonNullable<EngineState['explain']['anchor']>;

export function splitPlain(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** The server's extra fields on an explain answer (read defensively; the contract type stays ExplainResult). */
type ExplainExtra = ExplainResult & { error?: unknown; verdict?: unknown };

/** True when Jev actually answered the coverage check (only then are coverage numbers shown). */
export function jevAnswered(r: ExplainResult): boolean {
  return Boolean(r.jev && Number(r.jev.questions) > 0 && Number(r.jev.calls) > 0);
}

/** True when no plain version could be written (the writing model is unavailable), as opposed to failing a check. */
export function writerUnavailable(r: ExplainResult): boolean {
  if (r.ok) return false;
  const x = r as ExplainExtra;
  const err = typeof x.error === 'string' ? x.error : '';
  if (/llm_unavailable|no_credits|insufficient_quota|could not be written|not reachable|unavailable/i.test(err)) return true;
  // Nothing was written and Jev was never asked: the writer did not answer.
  return r.explanation === null && !jevAnswered(r);
}

/** Every code check and both of Jev's fact checks passed. */
export function checksPassed(r: ExplainResult): boolean {
  const c = r.checks;
  return Boolean(c && c.numbersKept && c.conditionWordsKept && c.addedFact < 0.5 && c.droppedFact < 0.5);
}

/** What the card says when there is no plain version (pure; the server's own sentence when it sent one). */
export function unavailableText(r: ExplainResult): string {
  const x = r as ExplainExtra & { message?: unknown };
  if (typeof x.message === 'string' && x.message.trim()) return x.message.trim();
  return writerUnavailable(r)
    ? "Couldn't write a plain version right now. The original is below."
    : "Couldn't check a plain version against the original, so it isn't shown. The original is below.";
}

function errorText(err: string): string {
  if (/sensitive|password|payment/i.test(err)) {
    return 'This page has password or payment fields, so nothing from it is sent for explaining.';
  }
  if (/redact|personal/i.test(err)) return 'This passage has personal details in it, so it was not sent.';
  if (/timeout|timed out|abort/i.test(err)) return 'That took too long. The text on the page is unchanged.';
  if (/^(Select |This passage)/.test(err)) return err;
  return "Plain words aren't available right now. The text on the page is unchanged.";
}

/** Follow page scroll from the moment the anchor was taken (anchors are viewport coordinates). */
function anchorKey(a: Anchor | null): string {
  return a ? `${Math.round(a.x)},${Math.round(a.y)},${Math.round(a.w)},${Math.round(a.h)}` : '';
}

function useAnchor(anchor: Anchor | null): Anchor | null {
  const base = useRef<{ sx: number; sy: number; key: string } | null>(null);
  const key = anchorKey(anchor);
  // Compare by value: the engine may hand us a fresh anchor object with the same numbers on every update.
  if (anchor && base.current?.key !== key) base.current = { sx: window.scrollX, sy: window.scrollY, key };
  const [, setTick] = useState(0);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTick((t) => (t + 1) % 1e6));
    };
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, []);
  if (!anchor || !base.current) return null;
  return {
    x: anchor.x - (window.scrollX - base.current.sx),
    y: anchor.y - (window.scrollY - base.current.sy),
    w: anchor.w,
    h: anchor.h,
  };
}

/**
 * The CSS zoom in effect where `ref` sits (Chrome's Element.currentCSSZoom; 1 when nothing is zoomed). A layer that
 * keeps our UI at a steady physical size may zoom it; fixed positions inside it are multiplied by that zoom.
 */
export function useLayerZoom(ref: RefObject<Element>): number {
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current?.parentElement as (Element & { currentCSSZoom?: number }) | null | undefined;
    const z = el && typeof el.currentCSSZoom === 'number' ? el.currentCSSZoom : 1;
    if (Number.isFinite(z) && z > 0.05 && Math.abs(z - k) > 0.001) setK(z);
  });
  return k;
}

export interface CardPlace {
  left: number;
  /** Set when the card hangs from its top edge (beside or below the passage). */
  top: number | null;
  /** Set when the card stands on its bottom edge (above the passage). */
  bottom: number | null;
  width: number;
  maxHeight: number;
  where: 'right' | 'left' | 'below' | 'above' | 'over';
  /** Scroll the page by this much first to make room below the passage (0: no need). */
  scrollBy: number;
}

/**
 * Where the card goes, in viewport px, never over the passage when there is any other way:
 * 1. beside it (right, then left) at full width, or at a narrower width of at least `minW`;
 * 2. below it, or above it, when there is room to read (`minStack`);
 * 3. otherwise ask to scroll the page so there is room below (only while the passage's top stays in view);
 * 4. a very tall passage: over its lower part, as a sheet near the bottom.
 * Kept clear of the pill's corner and of our bottom bars. Pure.
 */
export function placeCard(o: {
  anchor: Anchor | null; vw: number; vh: number; cardW: number; minH: number;
  pillReserve: number; pillWidth: number; pillSide: 'right' | 'left'; bottomReserve: number;
  minW?: number; minStack?: number;
}): CardPlace {
  const margin = 16;
  const gap = 16;
  const a = o.anchor;
  const fullW = Math.min(o.cardW, o.vw - 2 * margin);
  const minW = Math.min(fullW, o.minW ?? fullW * 0.7);
  const minStack = o.minStack ?? 240;
  const limitFor = (left: number, w: number): number => {
    const overPill = o.pillSide === 'right' ? left + w > o.vw - o.pillWidth - margin : left < o.pillWidth + margin;
    return o.vh - Math.max(overPill ? o.pillReserve : margin, o.bottomReserve, margin);
  };
  const beside = (where: 'right' | 'left', left: number, w: number): CardPlace => {
    const bottomLimit = limitFor(left, w);
    const minH = Math.min(o.minH, bottomLimit - margin);
    const top = Math.max(margin, Math.min(bottomLimit - minH, a ? a.y : 80));
    return { left, top, bottom: null, width: w, maxHeight: Math.max(160, bottomLimit - top), where, scrollBy: 0 };
  };
  if (!a) return beside('right', (o.vw - fullW) / 2, fullW);

  const roomR = o.vw - margin - (a.x + a.w + gap);
  const roomL = a.x - gap - margin;
  if (roomR >= fullW) return beside('right', a.x + a.w + gap, fullW);
  if (roomL >= fullW) return beside('left', a.x - gap - fullW, fullW);
  if (Math.max(roomR, roomL) >= minW) {
    return roomR >= roomL ? beside('right', a.x + a.w + gap, Math.floor(roomR)) : beside('left', margin, Math.floor(roomL));
  }

  const left = Math.min(Math.max(margin, a.x), o.vw - margin - fullW);
  const bottomLimit = limitFor(left, fullW);
  const belowTop = a.y + a.h + gap;
  const roomBelow = bottomLimit - belowTop;
  const roomAbove = a.y - gap - margin;
  if (roomBelow >= minStack) {
    return { left, top: belowTop, bottom: null, width: fullW, maxHeight: roomBelow, where: 'below', scrollBy: 0 };
  }
  if (roomAbove >= minStack) {
    return { left, top: null, bottom: o.vh - (a.y - gap), width: fullW, maxHeight: roomAbove, where: 'above', scrollBy: 0 };
  }
  // Scroll so the card fits below, keeping the passage's first lines in view.
  const need = minStack - roomBelow;
  const topSafe = Math.max(margin, o.vh * 0.12);
  if (need > 0 && a.y - need >= topSafe) {
    return { left, top: belowTop - need, bottom: null, width: fullW, maxHeight: minStack, where: 'below', scrollBy: Math.ceil(need) };
  }
  const sheetH = Math.min(o.minH, Math.max(minStack, (bottomLimit - margin) * 0.5));
  const top = Math.max(margin, bottomLimit - sheetH);
  return { left, top, bottom: null, width: fullW, maxHeight: bottomLimit - top, where: 'over', scrollBy: 0 };
}

interface Props {
  api: EngineApi;
  s: EngineState;
  /** One design pixel in the layer's CSS px (the chrome's size unit). */
  u: number;
  /** Space kept free at the bottom for the pill and its stack (px from the viewport bottom). */
  pillReserve?: number;
  pillWidth?: number;
  /** Which edge the pill sits on. */
  pillSide?: 'right' | 'left';
  /** Space our own bars take at the bottom (the docked cookie-notice bar), px from the viewport bottom. */
  bottomReserve?: number;
}

export function ExplainCard({ api, s, u, pillReserve = 96, pillWidth = 170, pillSide = 'right', bottomReserve = 0 }: Props) {
  const ex = s.explain;
  const a = useAnchor(ex.anchor);
  const probe = useRef<HTMLDivElement>(null);
  const k = useLayerZoom(probe);

  const akey = anchorKey(ex.anchor);

  // Everything below is in viewport px; styles divide by k (the layer's zoom).
  const place = placeCard({
    anchor: a,
    vw: window.innerWidth,
    vh: window.innerHeight,
    cardW: Math.round(420 * u * k),
    minH: Math.round(400 * u * k),
    minW: Math.round(300 * u * k),
    minStack: Math.round(240 * u * k),
    pillReserve,
    pillWidth,
    pillSide,
    bottomReserve,
  });
  const px = (v: number) => `${Math.round((v / k) * 100) / 100}px`;

  // No room beside, below or above: scroll the page once (for this passage) so the card fits below it.
  const scrolledFor = useRef('');
  useLayoutEffect(() => {
    if (!place.scrollBy || scrolledFor.current === akey) return;
    scrolledFor.current = akey;
    const smooth = !(s.fit?.attention?.motion?.on ?? false) && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({ top: place.scrollBy, behavior: smooth ? 'smooth' : 'auto' });
  });
  const boxStyle: Record<string, string> = { left: px(place.left), width: px(place.width), maxHeight: px(place.maxHeight) };
  if (place.top !== null) boxStyle.top = px(place.top);
  if (place.bottom !== null) boxStyle.bottom = px(place.bottom);

  const r = ex.result;
  const answered = r ? jevAnswered(r) : false;
  const passed = r ? checksPassed(r) : false;
  const plain = r?.explanation ? splitPlain(r.explanation) : [];
  const flagged = r?.showOriginalInstead ?? [];
  const failed = !!r && (!r.ok || !answered);

  return (
    <>
      <div ref={probe} hidden />
      {a && (
        <div
          class="wa-ex-outline"
          aria-hidden="true"
          style={{ left: px(a.x - 6), top: px(a.y - 6), width: px(a.w + 12), height: px(a.h + 12) }}
        />
      )}
      <section
        class="wa-ex"
        role="region"
        aria-label="Plain words"
        aria-busy={ex.loading}
        data-where={place.where}
        style={boxStyle}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            api.closeExplain();
          }
        }}
      >
        <header class="wa-ex-head">
          <span class="wa-ex-eyebrow">In plain words</span>
          <button class="wa-ex-x" aria-label="Close" onClick={() => api.closeExplain()}>
            <IconClose size={15} />
          </button>
        </header>

        {ex.loading && !r ? (
          <div class="wa-ex-loading" aria-live="polite">
            <span class="wa-shimmer" style={{ width: '92%' }} />
            <span class="wa-shimmer" style={{ width: '78%' }} />
            <span class="wa-shimmer" style={{ width: '85%' }} />
            <p>Writing this in plain words, then checking it against the original.</p>
          </div>
        ) : ex.error && !r ? (
          <p class="wa-ex-msg" role="status">{errorText(ex.error)}</p>
        ) : r && failed ? (
          <div class="wa-ex-body">
            <p class="wa-ex-msg" role="status">{unavailableText(r)}</p>
            {writerUnavailable(r) && s.ai === 'no_credits' && (
              <p class="wa-ex-note">Plain words are paused for now. They come back on their own.</p>
            )}
            {ex.original && <blockquote class="wa-ex-quote">{ex.original}</blockquote>}
          </div>
        ) : r ? (
          <>
          {/* Provenance first, outside the scrolling body, so it is never below the fold of the card. */}
          <p class={`wa-ex-status ${passed ? 'is-ok' : 'is-warn'}`} role="status">
            {passed ? <IconCheck size={15} /> : <IconWarn size={15} />}
            <span>
              {passed ? 'Checked against the original' : 'This may have missed something. Check the original.'}
            </span>
          </p>
          <div class="wa-ex-body">
            {plain.length > 0 ? (
              <ul class="wa-ex-list">
                {plain.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            ) : (
              <p class="wa-ex-msg">No plain version is shown. The original text is unchanged.</p>
            )}

            {flagged.length > 0 && (
              <div class="wa-ex-orig">
                <p class="wa-ex-orig-title">
                  Kept as written: the plain version did not cover {flagged.length === 1 ? 'this sentence' : 'these sentences'}.
                </p>
                {flagged.map((t, i) => (
                  <blockquote key={i}>{t}</blockquote>
                ))}
              </div>
            )}
          </div>
          </>
        ) : null}

        <footer class="wa-ex-foot">
          <span>
            {ex.loading && !r
              ? 'Sending only this passage to OpenAI, with personal details removed.'
              : r && r.ok
                ? 'The text on the page is the official version.'
                : 'Nothing on the page was changed.'}
          </span>
          <button class="wa-kbtn wa-ex-close" onClick={() => api.closeExplain()}>
            Close
          </button>
        </footer>
      </section>
    </>
  );
}
