// Owner: round 2 server package. Three deterministic layout candidates made on the device, for Jev to judge
// when no generative model is available (or alongside it).
import type { FitSummaryForModel, LayoutCandidate, PageOutline, Role } from '../types';

export function localVariants(_outline: PageOutline, _roles: Record<string, Role>, _fit: FitSummaryForModel): LayoutCandidate[] {
  throw new Error('not implemented');
}
