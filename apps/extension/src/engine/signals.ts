// Owner: C2. Live struggle signals.
import type { BgRequest, FitProfile, Offer, StruggleJudgment, StruggleKind } from '@webable/core';

export interface SignalsHost {
  elementFor(id: string): Element | null;
  fit(): FitProfile | null;
  pageKind(): string;
  onJudgment(j: StruggleJudgment, waiting: StruggleKind[], offers: Offer[]): void;
  ask<T>(req: BgRequest): Promise<T>;
  isOurUi(target: EventTarget | null): boolean;
}

export function startSignals(_ctx: { api: SignalsHost }): () => void {
  return () => {};
}
