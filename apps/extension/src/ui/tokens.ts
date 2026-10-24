// Owner: D1. Design tokens sized from the person's fit.
import type { FitProfile } from '@webable/core';

export type ThemeMode = 'light' | 'dark' | 'max';
export interface Tokens { [name: string]: string }

export function tokensFor(_fit: FitProfile | null, _mode: ThemeMode): Tokens {
  return {};
}
export function tokensToCss(_t: Tokens, _selector = ':host'): string {
  return '';
}
