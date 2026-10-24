// Owner: round 2 engine package. Jev finds an overlay's own minimise/close control.
import type { JevMetrics, OverlayButtonEvidence, OverlayCloseResult, OverlayEvidence } from '../types';
import type { JevQuestion, JevResponse } from './api';

export function buildOverlayCloseCall(_overlay: OverlayEvidence, _candidates: OverlayButtonEvidence[]): { state: unknown; questions: Record<string, JevQuestion> } {
  throw new Error('not implemented');
}
export function parseOverlayClose(
  _resp: JevResponse, _overlay: OverlayEvidence, _candidates: OverlayButtonEvidence[], _metrics: JevMetrics,
): OverlayCloseResult {
  throw new Error('not implemented');
}
