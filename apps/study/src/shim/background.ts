// The study's "background worker": what apps/extension/entrypoints/background.ts does for each request, with the
// study treatment from engine-seams §1.2. Model answers come from `answers` (replayed fixtures, the real server in
// record mode, or from protocol 4.0.0 live mode: recorded page reads first, the hosted server for everything that
// depends on the person). Zoom is virtual (zoom.ts); learning while browsing stays off; the sheet's controls are hidden,
// so their requests only leave a note. A request type added upstream breaks this switch at compile time.

import { DEFAULT_SETTINGS } from '@webable/core';
import type {
  ComposeRequest, ComposeResponse, FitProfile, FitSummaryForModel, MeaningCheckRequest, MeaningVerdict,
  OverlayButtonEvidence, OverlayCloseResult, OverlayEvidence, PageDigest, PageOutline, PageUnderstanding, ReaderProfile,
  RedesignResult, RewordScoreRequest, RewordScoreResult, RewordWriteRequest, RewordWriteResult, Role, Settings,
  StruggleJudgment, StruggleSignals, TabReport,
} from '@webable/core';
import type { ExtRequest, HealthInfo } from '../../../extension/src/engine/bus';
import { StudyBgError } from './errors';
import type { VirtualZoom } from './zoom';

/** Where model answers come from. Each rejects the way the server path would (StudyBgError codes). */
export interface ModelAnswers {
  understand(digest: PageDigest, noCache: boolean): Promise<PageUnderstanding>;
  meaning(req: MeaningCheckRequest): Promise<MeaningVerdict>;
  overlayClose(overlay: OverlayEvidence, candidates: OverlayButtonEvidence[]): Promise<OverlayCloseResult>;
  compose(req: Omit<ComposeRequest, 'reader'>): Promise<ComposeResponse>;
  /** Live mode only (protocol 4.0.0): the answers that depend on the person, asked of the hosted server. */
  struggle?(signals: StruggleSignals): Promise<StruggleJudgment>;
  redesign?(outline: PageOutline, fit: FitSummaryForModel, roles: Record<string, Role>): Promise<RedesignResult>;
  rewordScore?(req: Omit<RewordScoreRequest, 'reader'>): Promise<RewordScoreResult>;
  rewordWrite?(req: Omit<RewordWriteRequest, 'reader'>): Promise<RewordWriteResult>;
}

export interface StudyBackgroundOptions {
  fit: FitProfile;
  answers: ModelAnswers;
  zoom: VirtualZoom;
  note(kind: string, detail?: string): void;
  onReport?(report: TabReport): void;
  /** Live mode: how this person likes to read (from the set-up questions), for the AI's rewrites. */
  reader?: ReaderProfile | null;
  /** Live mode: AI-designed layouts on (they need the hosted server). */
  aiLayouts?: boolean;
}

/** What the study's engine runs with without live AI: no AI layouts, no Jev view. */
export const STUDY_SETTINGS: Settings = { ...DEFAULT_SETTINGS, aiLayouts: false, lens: false };

const HEALTH: HealthInfo = { ok: true, ai: 'on', ms: 0 };

export interface StudyBackground {
  handle(req: ExtRequest): Promise<unknown>;
  lastReport(): TabReport | null;
}

export function createStudyBackground(opts: StudyBackgroundOptions): StudyBackground {
  const { answers, zoom, note } = opts;
  const settings: Settings = { ...STUDY_SETTINGS, aiLayouts: opts.aiLayouts === true && !!answers.redesign };
  let report: TabReport | null = null;
  const off = (what: string): never => {
    throw new StudyBgError('refused', `${what} is off in the study`);
  };

  async function handle(req: ExtRequest): Promise<unknown> {
    switch (req.type) {
      case 'understand':
        return answers.understand(req.digest, req.noCache === true);
      case 'meaning':
        return answers.meaning(req.req);
      case 'overlayClose':
        // Jev finds an overlay's own minimise/close button (never asked for consent notices), as background.ts does.
        if (req.overlay.kind_hint === 'consent') throw new StudyBgError('refused', 'WebAble never closes consent notices');
        return answers.overlayClose(req.overlay, req.candidates);
      case 'compose':
        return answers.compose(req.req);

      // Struggle offers are live (4.0.0): they depend on what the person does. Learning while browsing stays off.
      case 'struggle':
        if (!answers.struggle) return off('Struggle reading');
        return answers.struggle(req.signals);
      case 'attribute':
        return off('Attribution');
      case 'passiveEvidence':
        return off('Learning while browsing');
      case 'passiveFeedback':
        return off('Learning while browsing');
      case 'getPassive':
        return null;

      // AI layouts: live only. The screenshot check cannot run in a phone's browser; the engine swaps without it.
      case 'redesign':
        if (!settings.aiLayouts || !answers.redesign) {
          note('request_off', 'redesign');
          return off('AI layouts');
        }
        return answers.redesign(req.outline, req.fit, req.roles);
      case 'visualVerify':
        return off('The screenshot check');

      // The reader comes from the set-up questions (live mode); without one, paragraph rewrites stay off (reword.ts
      // turns itself off on a null reader) and the simplified page is written for a general reader.
      case 'getReader':
        return opts.reader ? structuredClone(opts.reader) : null;
      case 'readerImport':
        note('request_off', 'readerImport');
        return off('Importing an AI answer');
      case 'setReader':
        note('request_noop', 'setReader');
        return null;
      case 'rewordScore':
        if (!opts.reader || !answers.rewordScore) throw new StudyBgError('refused', 'No answer from an AI assistant has been added yet');
        return answers.rewordScore(req.req);
      case 'rewordWrite':
        if (!opts.reader || !answers.rewordWrite) throw new StudyBgError('refused', 'No answer from an AI assistant has been added yet');
        return answers.rewordWrite(req.req);

      // Local requests.
      case 'getFit':
        return structuredClone(opts.fit);
      case 'getSettings':
        return { ...settings, pausedOrigins: [] };
      case 'health':
        return { ...HEALTH };
      case 'setZoom':
        return zoom.set(req.factor);
      case 'getZoom':
        return zoom.get();
      case 'zoomInfo':
        return zoom.info();
      case 'pageStart':
        zoom.pageStart();
        return { ok: true };
      case 'report':
        report = req.report;
        opts.onReport?.(req.report);
        return { ok: true };
      case 'getReport':
        return report;

      // The sheet is hidden in the study; these are protocol deviations if they ever come.
      case 'openFitting':
        note('request_noop', 'openFitting');
        return { ok: true };
      case 'setSettings':
        note('request_noop', 'setSettings');
        return { ...settings, pausedOrigins: [] };
      case 'setFit':
        note('request_noop', 'setFit');
        return structuredClone(opts.fit);

      default: {
        const never: never = req;
        note('request_unknown', (never as { type?: string }).type ?? '');
        throw new StudyBgError('refused', `Unknown request ${(never as { type?: string }).type ?? ''}`);
      }
    }
  }

  return { handle, lastReport: () => report };
}
