// Owner: A2. A2 may add optional fields to these measure types; keep the names.
import type { CheckResult, OpRecord } from '../types';

export interface ElementMeasure {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
  scrollW: number; scrollH: number; clientW: number; clientH: number;
  overflowHidden: boolean;
  fontPx: number | null;
  color: string | null; background: string | null; contrast: number | null;
  visible: boolean; focusable: boolean; inTabOrder: boolean; tabIndex: number | null;
  textChars: number;
  headingLevel: number | null;
  region: string | null;
}
export interface PageMeasure {
  elements: ElementMeasure[];
  docScrollW: number; viewportW: number;
  visibleTextByRegion: Record<string, number>;
  focusableCount: number;
  tabOrder: string[];
  headingPxByLevel: Record<number, number>;
  readingAnchor: { id: string; top: number } | null;
}
export function runChecks(_before: PageMeasure, _after: PageMeasure, _opIds: string[]): CheckResult[] { throw new Error('not implemented'); }
export function attribute(_fail: CheckResult, _ops: OpRecord[]): string | null { throw new Error('not implemented'); }
