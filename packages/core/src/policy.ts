// Owner: A1.
import type { ElementDecision, PageDigest, PageUnderstanding } from './types';

export interface LocalFacts { focusedIds: string[]; requiredIds: string[]; filledIds: string[]; consentIds: string[]; offsiteIds: string[] }

export function decideElements(_u: PageUnderstanding, _digest: PageDigest, _local: LocalFacts): ElementDecision[] {
  throw new Error('not implemented');
}
export function summarizeDecisions(_d: ElementDecision[]): { folded: number; protected: number; mainId: string | null } {
  throw new Error('not implemented');
}
