// Contract between the in-page engine (src/engine) and the in-page UI (src/ui).
// The engine owns all state; the UI subscribes and calls the actions below.

import type {
  CheckResult, ElementDecision, ExplainResult, FitProfile, FitSpec, LedgerEntry, Offer, OfferKind,
  OpRecord, PageDigest, PageOutline, PageUnderstanding, RedesignResult, Settings, StruggleJudgment,
  StruggleKind, VisualVerdict,
} from '@webable/core';

export interface Toast {
  id: string;
  text: string; // 'Buttons are bigger on this page'
  undoOpId?: string; // toasts with an undo never time out
}

export interface EngineState {
  phase: 'idle' | 'reading' | 'tailored' | 'understood' | 'calm' | 'error';
  fit: FitProfile | null;
  settings: Settings;
  startedAt: number; // performance.now() at boot
  digest: PageDigest | null;
  outline: PageOutline | null;
  ops: OpRecord[];
  checks: CheckResult[];
  ledger: LedgerEntry[];
  understanding: PageUnderstanding | null;
  decisions: ElementDecision[];
  lens: { on: boolean };
  calm: {
    open: boolean;
    loading: boolean;
    spec: FitSpec | null;
    source: 'heuristic' | 'ai' | 'cached' | null;
    aiReady: boolean; // an AI layout arrived while the person was busy: show the chip
    redesign: RedesignResult | null;
    visual: VisualVerdict | null;
  };
  struggle: {
    latest: StruggleJudgment | null;
    history: StruggleJudgment[];
    waiting: StruggleKind[];
    offers: Offer[]; // at most one is shown at a time
  };
  toasts: Toast[];
  explain: {
    open: boolean;
    loading: boolean;
    anchor: { x: number; y: number; w: number; h: number } | null;
    original: string | null;
    result: ExplainResult | null;
    error: string | null;
  };
  showingOriginal: boolean;
}

export interface EngineApi {
  getState(): EngineState;
  subscribe(listener: (s: EngineState) => void): () => void;

  /** The DOM element behind an outline or digest id ('n<k>'), or null if it is gone. */
  elementFor(id: string): Element | null;

  toggleLens(on?: boolean): void;
  openCalm(): Promise<void>;
  closeCalm(): void;
  useAiLayout(): void; // accept the AI layout chip
  showOriginal(on: boolean): void; // one click back to the untouched page
  undoOp(opId: string): void;
  acceptOffer(kind: OfferKind): void;
  dismissOffer(kind: OfferKind, forever: boolean): void;
  dismissToast(id: string): void;
  explainSelection(text: string, anchor: { x: number; y: number; w: number; h: number }): Promise<void>;
  closeExplain(): void;
  openFitting(): void;
}
