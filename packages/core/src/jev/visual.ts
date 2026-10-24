// Owner: A1.
import type { JevMetrics, VisualVerdict, VisualVerifyRequest } from '../types';
import type { JevQuestion, JevResponse } from './api';

export function buildVisualCall(_req: VisualVerifyRequest): { state: unknown; questions: Record<string, JevQuestion>; assets: Record<string, unknown> } {
  throw new Error('not implemented');
}
export function parseVisual(_resp: JevResponse, _metrics: JevMetrics): VisualVerdict { throw new Error('not implemented'); }
