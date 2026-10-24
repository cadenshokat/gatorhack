// Owner: A1.
import type { FitProfile, JevMetrics, Offer, StruggleCounts, StruggleJudgment, StruggleKind, StruggleSignals } from './types';
import type { JevQuestion, JevResponse } from './jev/api';

export interface CusumState { s: number; checks: number; lastCheckAt: number | null }
export interface OfferMemory { lastOfferAt: number | null; today: number; snoozedUntil: Record<string, number>; off: string[]; streak: Partial<Record<StruggleKind, number>> }

export function initialCusum(): CusumState { throw new Error('not implemented'); }
export function gate(_state: CusumState, _counts: StruggleCounts, _fit: FitProfile): { check: boolean; state: CusumState; reason: string } {
  throw new Error('not implemented');
}
export function toSignals(_counts: StruggleCounts, _fit: FitProfile, _pageKind: string): StruggleSignals { throw new Error('not implemented'); }
export function buildStruggleCall(_signals: StruggleSignals): { state: unknown; questions: Record<string, JevQuestion> } {
  throw new Error('not implemented');
}
export function parseStruggle(_resp: JevResponse, _metrics: JevMetrics): StruggleJudgment { throw new Error('not implemented'); }
export function initialOfferMemory(): OfferMemory { throw new Error('not implemented'); }
export function decideOffers(
  _history: StruggleJudgment[], _counts: StruggleCounts, _mem: OfferMemory, _nowMs: number, _pageAgeMs: number, _idle: boolean,
): { offers: Offer[]; waiting: StruggleKind[]; mem: OfferMemory } {
  throw new Error('not implemented');
}
