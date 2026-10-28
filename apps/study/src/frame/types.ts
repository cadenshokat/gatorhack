// The frame's own additions to the shared contracts (src/contracts.ts is the lead's). All optional for the shell.

import type { FrameApi, TrialConfig } from '../contracts';
import type { RecordedAnswers } from '../replay/types';

/** Extra trial fields the dev host passes (the shell need not): record mode needs them. */
export interface StudyTrialExtras {
  /** The canonical recording pass: posts carry X-WebAble-Fresh: 1. */
  recordFresh?: boolean;
  /** ReplicaManifest.originalHost, for compose's page.host in record mode. */
  originalHost?: string;
  /** The fit's name in the recording matrix ('typical', 'rosa'…), for the fixtures' bookkeeping. */
  fitName?: string;
}

export type StudyTrial = TrialConfig & StudyTrialExtras;

/** Where the frame is, for the dev host and the record and replay-check scripts. */
export interface FrameStatus {
  condition: TrialConfig['condition'] | 'none';
  mode: TrialConfig['mode'] | 'none';
  ready: boolean;
  late: boolean;
  settleMs: number | null;
  measuring: boolean;
  /** Adapted: the engine's phase, its pending work and the simplified page's state. */
  phase?: string;
  pendingWork?: number;
  calmOpen?: boolean;
  composeStatus?: string;
  /** Record mode: posts not answered yet. */
  inFlight?: number;
  replayMisses?: number;
  error?: string;
}

/** window.__studyFrame: the contract's FrameApi plus two dev-only reads. */
export interface StudyFrameApi extends FrameApi {
  status(): FrameStatus;
  /** Record mode only: the answers this page view collected (null otherwise). */
  recorded(): RecordedAnswers | null;
}
