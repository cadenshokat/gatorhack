// Small shared pieces: pill buttons with key hints, the trial clock, window keys, the check mark.

import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

type BtnKind = 'primary' | 'tonal' | 'quiet' | 'answer';

export function Btn(props: {
  kind?: BtnKind;
  onClick: () => void;
  children: ComponentChildren;
  kbd?: string;
  disabled?: boolean;
  class?: string;
  label?: string;
  pressed?: boolean;
  data?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      class={`wu-btn wu-btn-${props.kind ?? 'tonal'} ${props.class ?? ''}`}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.label}
      aria-pressed={props.pressed}
      data-answer={props.data}
    >
      <span class="wu-btn-text">{props.children}</span>
      {props.kbd ? (
        <kbd aria-hidden="true" class="wu-kbd">
          {props.kbd}
        </kbd>
      ) : null}
    </button>
  );
}

/**
 * Trial timing. The onset is the second animation frame after the stimulus is set (it has been painted). Any
 * interruption (pause, focus change, hidden tab, pixel-ratio change) restarts the clock, so a trial never carries time
 * the person spent elsewhere. `armed()` ignores presses in the first 250 ms (accidental repeats).
 */
export function useTrialClock(paused: boolean, trialKey: unknown): { elapsed: () => number; armed: () => boolean } {
  const onset = useRef(performance.now());

  useEffect(() => {
    if (paused) return;
    let raf2 = 0;
    onset.current = performance.now() + 1e9; // not armed until painted
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        onset.current = performance.now();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [trialKey, paused]);

  useEffect(() => {
    let dpr = window.devicePixelRatio;
    const restart = () => {
      onset.current = performance.now();
    };
    const onVis = () => {
      if (!document.hidden) restart();
    };
    const onResize = () => {
      if (window.devicePixelRatio !== dpr) {
        dpr = window.devicePixelRatio;
        restart();
      }
    };
    window.addEventListener('focus', restart);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('focus', restart);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return {
    elapsed: () => Math.max(0, performance.now() - onset.current),
    armed: () => performance.now() - onset.current > 250,
  };
}

/** Window key handler active while `enabled`. Ignores keys with modifiers and keys typed into fields. */
export function useKeys(enabled: boolean, handler: (key: string, e: KeyboardEvent) => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      ref.current(e.key, e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

export function Check(props: { size?: number; class?: string }): JSX.Element {
  const s = props.size ?? 16;
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true" class={`wu-check ${props.class ?? ''}`}>
      <path d="M3.4 8.4l3 3 6.2-6.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function Wordmark(): JSX.Element {
  return (
    <div class="wu-wordmark">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="9.25" fill="none" stroke="currentColor" stroke-width="1.5" />
        <circle cx="11" cy="11" r="4" fill="currentColor" />
      </svg>
      <span>WebAble</span>
    </div>
  );
}
