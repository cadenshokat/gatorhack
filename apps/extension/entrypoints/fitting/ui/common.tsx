// Small shared pieces: the screen heading that takes focus, buttons with key hints, the trial clock.

import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export function Heading(props: { children: ComponentChildren; class?: string; autoFocus?: boolean }): JSX.Element {
  const ref = useRef<HTMLHeadingElement>(null);
  const autoFocus = props.autoFocus ?? true;
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  return (
    <h1 ref={ref} tabIndex={-1} class={`fx-h1 fade-in ${props.class ?? ''}`}>
      {props.children}
    </h1>
  );
}

export function Deck(props: { children: ComponentChildren }): JSX.Element {
  return <p class="fx-deck fade-in">{props.children}</p>;
}

type BtnKind = 'primary' | 'tonal' | 'quiet' | 'plain';

export function Btn(props: {
  kind?: BtnKind;
  onClick: () => void;
  children: ComponentChildren;
  kbd?: string;
  disabled?: boolean;
  class?: string;
  label?: string;
  pressed?: boolean;
  type?: 'button' | 'submit';
}): JSX.Element {
  return (
    <button
      type={props.type ?? 'button'}
      class={`fx-btn fx-btn-${props.kind ?? 'tonal'} ${props.class ?? ''}`}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.label}
      aria-pressed={props.pressed}
    >
      <span class="fx-btn-text">{props.children}</span>
      {props.kbd ? (
        <kbd aria-hidden="true" class="fx-kbd">
          {props.kbd}
        </kbd>
      ) : null}
    </button>
  );
}

/**
 * Trial timing. The onset is the first animation frame after the stimulus is painted. Any interruption
 * (pause, blur, hidden tab, zoom or pixel-ratio change) restarts the clock, so a trial never carries
 * time the person spent elsewhere. `armed()` ignores presses in the first 250 ms (accidental repeats).
 */
export function useTrialClock(paused: boolean, trialKey: unknown): { elapsed: () => number; armed: () => boolean; interrupted: () => boolean } {
  const onset = useRef(performance.now());
  const wasInterrupted = useRef(false);

  useEffect(() => {
    if (paused) {
      wasInterrupted.current = true;
      return;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        onset.current = performance.now();
      });
    });
    onset.current = performance.now() + 1e9; // not armed until painted
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [trialKey, paused]);

  useEffect(() => {
    wasInterrupted.current = false;
  }, [trialKey]);

  useEffect(() => {
    let dpr = window.devicePixelRatio;
    const restart = () => {
      wasInterrupted.current = true;
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
    interrupted: () => wasInterrupted.current,
  };
}

/** Window key handler active while `enabled`. Ignores keys with modifiers and keys typed into fields. */
export function useKeys(enabled: boolean, handler: (key: string, e: KeyboardEvent) => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      ref.current(e.key, e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

export function Check(props: { size?: number }): JSX.Element {
  const s = props.size ?? 16;
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true" class="fx-check">
      <path d="M3.2 8.4l3 3 6.6-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}
