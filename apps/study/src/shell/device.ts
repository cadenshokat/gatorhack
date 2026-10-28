// What we note about the phone: once at the start and again at each round, so a change of phone or browser is visible.
// Nothing here identifies the person.

import type { DeviceInfo } from '../contracts';

const inputs = new Set<'touch' | 'mouse' | 'pen'>();

/** Every pointer type seen anywhere in the study, from the first press on. */
export function watchInputs(): void {
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'mouse' || e.pointerType === 'pen') inputs.add(e.pointerType);
    },
    { capture: true, passive: true },
  );
}

const mq = (q: string): boolean => {
  try {
    return matchMedia(q).matches;
  } catch {
    return false;
  }
};

/** The rendered height of a 16 px line: larger when the browser or phone scales text up on its own. */
function referenceLinePx(): number {
  const el = document.createElement('div');
  el.textContent = 'Aa';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:absolute;visibility:hidden;font:16px/1 system-ui;left:-999px;top:0';
  document.body.appendChild(el);
  const h = el.getBoundingClientRect().height;
  el.remove();
  return Math.round(h * 100) / 100;
}

export function readDevice(): DeviceInfo & { refLinePx: number; coarse: boolean; orientation: string } {
  return {
    userAgent: navigator.userAgent,
    screen: { w: screen.width, h: screen.height, dpr: Math.round(devicePixelRatio * 100) / 100 },
    viewport: { w: innerWidth, h: innerHeight },
    touch: (navigator.maxTouchPoints ?? 0) > 0,
    reducedMotion: mq('(prefers-reduced-motion: reduce)'),
    darkMode: mq('(prefers-color-scheme: dark)'),
    language: navigator.language,
    inputsSeen: [...inputs],
    refLinePx: referenceLinePx(),
    coarse: mq('(pointer: coarse)'),
    orientation: screen.orientation?.type ?? (innerWidth > innerHeight ? 'landscape' : 'portrait'),
  };
}

export function inputsSeen(): Array<'touch' | 'mouse' | 'pen'> {
  return [...inputs];
}
