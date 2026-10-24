// Silent environment capture on the first screen (fitting brief §2). Kept in memory only.

export const STIMULUS_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export type DeviceClass = 'phone' | 'tablet' | 'laptop' | 'desktop';

export interface Env {
  dpr: number;
  vw: number;
  vh: number;
  defaultFontPx: number;
  reducedMotion: boolean;
  moreContrast: boolean;
  forcedColors: boolean;
  darkScheme: boolean;
  coarse: boolean;
  hover: boolean;
  deviceClass: DeviceClass;
  /** x-height / font size of the stimulus font, measured. */
  xRatio: number;
  /** average character advance / font size for the sentence pool, measured. */
  charRatio: number;
}

function mq(q: string): boolean {
  try {
    return window.matchMedia(q).matches;
  } catch {
    return false;
  }
}

function probeDefaultFontPx(): number {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;visibility:hidden;font-size:medium;line-height:normal;';
  el.textContent = 'x';
  document.body.appendChild(el);
  const px = parseFloat(getComputedStyle(el).fontSize) || 16;
  el.remove();
  return px;
}

let canvas: HTMLCanvasElement | null = null;
function ctx2d(): CanvasRenderingContext2D | null {
  canvas ??= document.createElement('canvas');
  return canvas.getContext('2d');
}

export function measureXRatio(): number {
  const c = ctx2d();
  if (!c) return 0.52;
  c.font = `400 100px ${STIMULUS_FONT}`;
  const m = c.measureText('x');
  const r = m.actualBoundingBoxAscent / 100;
  return r > 0.3 && r < 0.8 ? r : 0.52;
}

export function measureCharRatio(sample: string): number {
  const c = ctx2d();
  if (!c || !sample) return 0.5;
  c.font = `400 100px ${STIMULUS_FONT}`;
  const r = c.measureText(sample).width / sample.length / 100;
  return r > 0.3 && r < 0.9 ? r : 0.5;
}

export function captureEnv(sample: string): Env {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const coarse = mq('(pointer: coarse)');
  const deviceClass: DeviceClass = coarse ? (Math.min(vw, vh) < 600 ? 'phone' : 'tablet') : vw >= 1600 ? 'desktop' : 'laptop';
  return {
    dpr: window.devicePixelRatio || 1,
    vw,
    vh,
    defaultFontPx: probeDefaultFontPx(),
    reducedMotion: mq('(prefers-reduced-motion: reduce)'),
    moreContrast: mq('(prefers-contrast: more)'),
    forcedColors: mq('(forced-colors: active)'),
    darkScheme: mq('(prefers-color-scheme: dark)'),
    coarse,
    hover: mq('(hover: hover)'),
    deviceClass,
    xRatio: measureXRatio(),
    charRatio: measureCharRatio(sample),
  };
}
