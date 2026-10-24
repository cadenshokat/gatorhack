// Owner: A2.
import type { FitSpec, FitSummaryForModel, PageOutline, Role } from '../types';

export function heuristicSpec(_outline: PageOutline, _roles: Record<string, Role>, _fit: FitSummaryForModel): FitSpec {
  throw new Error('not implemented');
}
