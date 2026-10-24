// Owner: A1.
import type { FitSummaryForModel, LayoutCandidate, PageOutline } from '../types';
import type { JevQuestion, JevResponse } from './api';

export function buildJudgeCall(_cands: LayoutCandidate[], _fit: FitSummaryForModel, _outline: PageOutline): { state: unknown; questions: Record<string, JevQuestion> } {
  throw new Error('not implemented');
}
export function scoreCandidates(_cands: LayoutCandidate[], _resp: JevResponse): { cands: LayoutCandidate[]; unfold: Array<{ candidate: string; sectionIndex: number }> } {
  throw new Error('not implemented');
}
export function chooseCandidate(_cands: LayoutCandidate[]): { chosen: LayoutCandidate['name']; autoApply: boolean } {
  throw new Error('not implemented');
}
