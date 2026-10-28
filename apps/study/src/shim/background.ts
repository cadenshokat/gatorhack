// The study's "background worker": what apps/extension/entrypoints/background.ts does for each request, with the
// study treatment from engine-seams §1.2. Model answers come from `answers` (replayed fixtures, or the real server in
// record mode); zoom is virtual (zoom.ts); nothing is learned about the person; the sheet's controls are hidden, so
// their requests only leave a note. A request type added upstream breaks this switch at compile time.

import { DEFAULT_SETTINGS } from '@webable/core';
import type {
  ComposeRequest, ComposeResponse, FitProfile, MeaningCheckRequest, MeaningVerdict, OverlayButtonEvidence,
  OverlayCloseResult, OverlayEvidence, PageDigest, PageUnderstanding, Settings, TabReport,
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
}

export interface StudyBackgroundOptions {
  fit: FitProfile;
  answers: ModelAnswers;
  zoom: VirtualZoom;
  note(kind: string, detail?: string): void;
  onReport?(report: TabReport): void;
}

/** What the study's engine runs with: no AI layouts (so no screenshots), no Jev view. */
export const STUDY_SETTINGS: Settings = { ...DEFAULT_SETTINGS, aiLayouts: false, lens: false };

const HEALTH: HealthInfo = { ok: true, ai: 'on', ms: 0 };

export interface StudyBackground {
  handle(req: ExtRequest): Promise<unknown>;
  lastReport(): TabReport | null;
}

export function createStudyBackground(opts: StudyBackgroundOptions): StudyBackground {
  const { answers, zoom, note } = opts;
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

      // Behaviour-dependent: learning and struggle offers are not part of the study.
      case 'struggle':
        return off('Struggle reading');
      case 'attribute':
        return off('Attribution');
      case 'passiveEvidence':
        return off('Learning while browsing');
      case 'passiveFeedback':
        return off('Learning while browsing');
      case 'getPassive':
        return null;

      // AI layouts are off (settings.aiLayouts false), so these should never come; say so if they do.
      case 'redesign':
        note('request_off', 'redesign');
        return off('AI layouts');
      case 'visualVerify':
        note('request_off', 'visualVerify');
        return off('The screenshot check');

      // No AI answer imported: paragraph rewrites stay off (reword.ts turns itself off on a null reader).
      case 'getReader':
        return null;
      case 'readerImport':
        note('request_off', 'readerImport');
        return off('Importing an AI answer');
      case 'setReader':
        note('request_noop', 'setReader');
        return null;
      case 'rewordScore':
      case 'rewordWrite':
        throw new StudyBgError('refused', 'No answer from an AI assistant has been added yet');

      // Local requests.
      case 'getFit':
        return structuredClone(opts.fit);
      case 'getSettings':
        return { ...STUDY_SETTINGS, pausedOrigins: [] };
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
        return { ...STUDY_SETTINGS, pausedOrigins: [] };
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
