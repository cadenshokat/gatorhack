// Owner: A1.
import type { JevMetrics, PageDigest, PageUnderstanding } from '../types';
import type { JevQuestion, JevResponse } from './api';

export interface PageCall { state: unknown; questions: Record<string, JevQuestion>; elementIds: string[] }

export function buildPageCalls(_digest: PageDigest, _opts?: { caution?: boolean }): PageCall[] {
  throw new Error('not implemented');
}
export function parsePageAnswers(
  _digest: PageDigest, _calls: PageCall[], _responses: JevResponse[], _metrics: JevMetrics,
): PageUnderstanding {
  throw new Error('not implemented');
}
