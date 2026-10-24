// Contract between the in-page engine (src/engine) and the in-page UI (src/ui).
// The engine owns all state; the UI subscribes and calls the actions below.

import type {
  CheckResult, ElementDecision, ExplainResult, FitProfile, FitSpec, HealthStatus, LedgerEntry, Offer, OfferKind,
  OpRecord, OverlayAction, PageDigest, PageOutline, PageUnderstanding, RedesignResult, Settings, StruggleJudgment,
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
  overlays: OverlayAction[];
  ai: HealthStatus['ai'];
  /** The page-width column (round 3): content held to a centred column so enlarged pages don't fill the screen. */
  column: { on: boolean; widthPx: number | null; minPx: number; maxPx: number };
  /** Text size steps the person took on this site (0 = the fit's size). */
  textStep: number;
  /** The tab's current page zoom (1 = 100%). In-page UI divides by it so it stays the same physical size. */
  pageZoom: number;
  /**
   * The zoom text is shown at. Equal to pageZoom, except with the page column on: the column is a narrower virtual
   * window, the tab's zoom is raised by screen ÷ column and the body is drawn back down by the same factor.
   */
  textZoom?: number;
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
  /** Undo one overlay action (restores the overlay; remembers 'leave' for this site and kind). */
  restoreOverlay(id: string): void;
  /** Page width: -1 narrower, 1 wider, 0 back to automatic, 'off' full width. Remembered per site. */
  adjustColumn(step: -1 | 0 | 1 | 'off'): void;
  /** Text size: one zoom preset smaller or larger than the fit, remembered per site. */
  adjustText(step: -1 | 1): void;
}
