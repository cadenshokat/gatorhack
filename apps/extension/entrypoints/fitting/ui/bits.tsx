// Shared controls for the onboarding. Large targets, visible focus, and a focus trap for the instruction card.

import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useReducedMotion(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setOn(mq.matches);
    const fn = () => setOn(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return on;
}

export function useFocusTrap(active: boolean): { ref: { current: HTMLDivElement | null } } {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const list = () =>
      [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
    const focusFirst = () => {
      const preferred = root.querySelector<HTMLElement>('[data-focus="true"]');
      (preferred ?? list()[0])?.focus();
    };
    const id = window.setTimeout(focusFirst, 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = list();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      root.removeEventListener('keydown', onKey);
    };
  }, [active]);
  return { ref };
}

export function Button(props: {
  kind?: 'primary' | 'quiet' | 'choice';
  children: ComponentChildren;
  onClick: () => void;
  disabled?: boolean;
  data?: string;
  focus?: boolean;
  pressed?: boolean;
  label?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      class={`ob-btn ob-btn-${props.kind ?? 'choice'}`}
      onClick={props.onClick}
      disabled={props.disabled}
      data-answer={props.data}
      data-focus={props.focus ? 'true' : undefined}
      aria-pressed={props.pressed}
      aria-label={props.label}
    >
      {props.children}
    </button>
  );
}
