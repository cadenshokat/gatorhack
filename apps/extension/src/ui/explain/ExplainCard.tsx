// Owner: D2. The explanation card, beside the outlined original (never over it, never instead of it).
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ExplainResult } from '@webable/core';
import type { EngineApi, EngineState } from '../../contracts';
import { fmtCost, fmtMs, fmtP } from '../panel/format';
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

export function checksPassed(r: ExplainResult): boolean {
  const c = r.checks;
  return Boolean(c && c.numbersKept && c.conditionWordsKept && c.addedFact < 0.5 && c.droppedFact < 0.5);
}

function errorText(err: string): string {
  if (/sensitive|password|payment/i.test(err)) {
    return 'This page has password or payment fields, so nothing from it is sent for explaining.';
  }
  if (/redact|personal/i.test(err)) return 'This passage still had personal details after redaction, so it was not sent.';
  if (/timeout|timed out|abort/i.test(err)) return 'The explanation took too long. The original text is unchanged.';
  return 'The explanation service is not reachable right now. The original text is unchanged.';
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

interface Props {
  api: EngineApi;
  s: EngineState;
  u: number;
  /** Space kept free at the bottom right for the pill (px from the viewport bottom). */
  pillReserve: number;
  pillWidth: number;
}

export function ExplainCard({ api, s, u, pillReserve, pillWidth }: Props) {
  const ex = s.explain;
  const a = useAnchor(ex.anchor);
  const [details, setDetails] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const akey = anchorKey(ex.anchor);
  useEffect(() => {
    setDetails(false);
  }, [akey]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 16;
  const gap = 16;
  const cardW = Math.min(Math.round(420 * u), vw - 2 * margin);
  let left: number;
  let top: number;
  let below = false;
  if (a && a.x + a.w + gap + cardW <= vw - margin) {
    left = a.x + a.w + gap;
    top = a.y;
  } else if (a && a.x - gap - cardW >= margin) {
    left = a.x - gap - cardW;
    top = a.y;
  } else {
    below = true;
    left = a ? Math.min(Math.max(margin, a.x), vw - margin - cardW) : (vw - cardW) / 2;
    top = a ? a.y + a.h + gap : 80;
  }
  // Keep the card clear of the pill when they share the right edge, and give it room to read.
  const overPill = left + cardW > vw - pillWidth - margin;
  const bottomLimit = vh - (overPill ? pillReserve : margin);
  const minH = Math.min(Math.round(420 * u), bottomLimit - margin);
  if (!below) top = Math.max(margin, Math.min(bottomLimit - minH, top));
  else top = Math.max(margin, Math.min(bottomLimit - Math.min(minH, 220), top));
  const maxH = Math.max(160, bottomLimit - top);

  const r = ex.result;
  const passed = r ? checksPassed(r) : false;
  const plain = r?.explanation ? splitPlain(r.explanation) : [];
  const flagged = r?.showOriginalInstead ?? [];

  return (
    <>
      {a && (
        <div
          class="wa-ex-outline"
          aria-hidden="true"
          style={{ transform: `translate3d(${Math.round(a.x - 6)}px, ${Math.round(a.y - 6)}px, 0)`, width: `${Math.round(a.w + 12)}px`, height: `${Math.round(a.h + 12)}px` }}
        />
      )}
      <section
        class="wa-ex"
        role="region"
        aria-label="Plain words"
        aria-busy={ex.loading}
        style={{ left: `${Math.round(left)}px`, top: `${Math.round(top)}px`, width: `${cardW}px`, maxHeight: `${Math.round(maxH)}px` }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            api.closeExplain();
          }
        }}
      >
        <header class="wa-ex-head">
          <span class="wa-ex-eyebrow">In plain words</span>
          <span class="wa-badge">Explained by AI</span>
          <button ref={closeRef} class="wa-iconbtn" aria-label="Close explanation" onClick={() => api.closeExplain()}>
            <IconClose size={15} />
          </button>
        </header>

        {ex.loading && !r ? (
          <div class="wa-ex-loading" aria-live="polite">
            <span class="wa-shimmer" style={{ width: '92%' }} />
            <span class="wa-shimmer" style={{ width: '78%' }} />
            <span class="wa-shimmer" style={{ width: '85%' }} />
            <p>Writing a plain version, then Jev checks it against the original.</p>
          </div>
        ) : ex.error && !r ? (
          <p class="wa-ex-msg" role="status">{errorText(ex.error)}</p>
        ) : r ? (
          <div class="wa-ex-body">
            {r.ok && plain.length > 0 ? (
              <ul class="wa-ex-list">
                {plain.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            ) : (
              <p class="wa-ex-msg">No plain version is shown: it did not pass the checks. The original text is below.</p>
            )}

            {r.ok && (
              <p class={`wa-ex-check ${passed ? 'is-ok' : 'is-warn'}`} role="status">
                {passed ? <IconCheck size={15} /> : <IconWarn size={15} />}
                {passed
                  ? 'Checked against the original'
                  : 'This explanation may have missed or changed something. Check the original.'}
              </p>
            )}

            {flagged.length > 0 && (
              <div class="wa-ex-orig">
                <p class="wa-ex-orig-title">
                  {flagged.length === 1 ? 'This sentence is shown as written' : 'These sentences are shown as written'}, because Jev
                  found the plain version did not cover {flagged.length === 1 ? 'it' : 'them'}:
                </p>
                {flagged.map((t, i) => {
                  const cov = r.sentences?.find((x) => x.original === t)?.covered;
                  return (
                    <blockquote key={i}>
                      {t}
                      {typeof cov === 'number' && <span class="wa-ex-cov">covered {fmtP(cov)}</span>}
                    </blockquote>
                  );
                })}
              </div>
            )}

            <button class="wa-link" aria-expanded={details} onClick={() => setDetails(!details)}>
              {details ? 'Hide how it was checked' : 'How it was checked'}
            </button>
            {details && (
              <div class="wa-ex-details">
                <ul class="wa-ex-checks">
                  <li data-ok={String(r.checks.numbersKept)}>
                    {r.checks.numbersKept ? <IconCheck size={14} /> : <IconWarn size={14} />} Every number kept
                  </li>
                  <li data-ok={String(r.checks.conditionWordsKept)}>
                    {r.checks.conditionWordsKept ? <IconCheck size={14} /> : <IconWarn size={14} />} Condition words kept (if, unless, not…)
                  </li>
                  <li data-ok={String(r.checks.addedFact < 0.5)}>
                    {r.checks.addedFact < 0.5 ? <IconCheck size={14} /> : <IconWarn size={14} />} Added a fact: Jev {fmtP(r.checks.addedFact)}
                  </li>
                  <li data-ok={String(r.checks.droppedFact < 0.5)}>
                    {r.checks.droppedFact < 0.5 ? <IconCheck size={14} /> : <IconWarn size={14} />} Dropped a fact: Jev {fmtP(r.checks.droppedFact)}
                  </li>
                </ul>
                {r.sentences && r.sentences.length > 0 && (
                  <ol class="wa-ex-cover">
                    {r.sentences.map((x, i) => (
                      <li key={i}>
                        <span class="wa-ex-cover-text">{x.original}</span>
                        <span class="wa-ex-cover-bar" aria-hidden="true">
                          <i data-low={String(x.covered < 0.5)} style={{ width: `${Math.round(Math.max(0.03, x.covered) * 100)}%` }} />
                        </span>
                        <span class="wa-num">{fmtP(x.covered)}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <p class="wa-ex-meta">
                  Written by {r.model} in {fmtMs(r.ms)}. Checked by {r.jev?.model ?? 'Jev'}: {r.jev?.questions ?? 0} answers in{' '}
                  {fmtMs(r.jev?.wallMs)}, {fmtCost(r.jev?.costUsd ?? 0)}.
                </p>
              </div>
            )}
          </div>
        ) : null}

        <footer class="wa-ex-foot">
          <span>
            Explained by AI · The original is the official text.
            {r
              ? ' This passage, with personal details removed, was sent to OpenAI.'
              : ex.loading
                ? ' Sending this passage, with personal details removed, to OpenAI.'
                : ''}
          </span>
          <button class="wa-btn wa-btn-sm" onClick={() => api.closeExplain()}>
            Close
          </button>
        </footer>
      </section>
    </>
  );
}
