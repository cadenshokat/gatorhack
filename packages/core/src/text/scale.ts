// Owner: A2.
import type { FitProfile } from '../types';

export const CHROME_ZOOM_PRESETS: number[] = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
export function planTextScale(_fit: FitProfile, _pageBodyPx: number): { zoom: number; residual: number; exponent: number; targetBodyPx: number } {
  throw new Error('not implemented');
}
export function mapFontSize(_sizePx: number, _pageBodyPx: number, _targetBodyPx: number, _exponent: number): number {
  throw new Error('not implemented');
}
