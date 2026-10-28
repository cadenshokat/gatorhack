// The adapted condition: WebAble's real engine and in-page UI (apps/extension/src/engine + src/ui, imported unchanged)
// behind the chrome.* stand-in, exactly as apps/extension/entrypoints/content.ts starts them, without the site-task
// check. Loaded only in the adapted condition (a separate chunk); the engine itself is a further dynamic import, after
// the stand-in is in place and the page is drawn.

import type { EngineApi, EngineState } from '../../../extension/src/contracts';
import type { DeliveryRecord, FrameHost } from '../contracts';
import { loadFixtures } from '../replay/load';
import { createRecorder, type Recorder } from '../replay/record';
import { createReplayAnswers } from '../replay/replay';
import type { RecordedAnswers, ReplayMiss } from '../replay/types';
import { createStudyBackground, type ModelAnswers } from '../shim/background';
import { installChromeShim } from '../shim/chrome';
import { createVirtualZoom } from '../shim/zoom';
import { buildDelivery, measureBodyPx } from './delivery';
import type { Meter } from './meter';
import { nextPaint, pageDrawn } from './ready';
import type { FrameStatus, StudyTrial } from './types';

/**
 * The launcher (and with it the sheet: text size, Pause, the Jev view, Settings), the simplified page's two
 * "Original page" buttons (the top bar's and the footer's), and its rows that close it to use something on the page
 * itself (`.wa-peek`, e.g. the van Gogh story's "Play it on the page" video row, and the site-chat row): with the
 * launcher hidden there would be no way back to the simplified page. The "Original page" button on the "could not
 * simplify" message stays, so a person is never stuck on an empty page (that page view is a technical failure either way).
 */
const HIDE_CSS =
  '.wa-fab, .wa-strip__orig, .wa-foot .wa-btn, .wa-peek, [aria-label="Chat with the site"] { display: none !important; }';
const SETTLE_QUIET_MS = 600;
const SETTLE_CAP_MS = 8000;
const SETTLED_PHASES = new Set<EngineState['phase']>(['understood', 'calm', 'idle', 'error']);

export interface AdaptedRun {
  status(): Partial<FrameStatus>;
  delivery(): DeliveryRecord | null;
  recorded(): RecordedAnswers | null;
}

interface Options {
  host: FrameHost;
  trial: StudyTrial;
  meter: Meter;
  ready(info: { settleMs: number; late: boolean }): void;
}

function engineCommit(): string {
  const v: unknown = import.meta.env.VITE_ENGINE_COMMIT;
  return typeof v === 'string' && v ? v : 'dev';
}

function adoptHideSheet(root: ShadowRoot): void {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(HIDE_CSS);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return;
  } catch {
    /* no constructable sheets: a <style> element does the same */
  }
  const style = document.createElement('style');
  style.textContent = HIDE_CSS;
  root.append(style);
}

export function startAdapted(o: Options): AdaptedRun {
  const { host, trial, meter } = o;
  const misses: ReplayMiss[] = [];
  const miss = (m: ReplayMiss) => {
    misses.push(m);
    host.note('replay_miss', m.id ? `${m.what} ${m.id}` : m.what);
  };
  const zoom = createVirtualZoom((f) => host.zoom(f));
  meter.setZoom(() => zoom.get());

  let recorder: Recorder | null = null;
  let fixturesVersion = 'none';
  let api: EngineApi | null = null;
  let calmF: ((s: EngineState) => number) | null = null;
  let bodyPxBefore: number | null = null;
  let settleMs: number | null = null;
  let ready = false;
  let late = false;
  let error: string | undefined;
  const toasts = new Set<string>();
  const offers = new Set<string>();

  // Model answers: recorded from the real server (dev machine only) or replayed from the replica's fixtures.
  let answers: ModelAnswers;
  let fixturesLoaded: Promise<void> = Promise.resolve();
  if (trial.mode === 'record') {
    recorder = createRecorder({
      replicaId: trial.task.replicaId, fit: trial.fitName ?? 'custom', h: trial.frame.h, fresh: trial.recordFresh === true,
      originalHost: trial.originalHost ?? '',
    });
    answers = recorder.answers;
    fixturesVersion = 'record';
  } else {
    let replay: ModelAnswers | null = null;
    fixturesLoaded = loadFixtures(trial.fixturesUrl).then(({ fixtures, error: why }) => {
      if (!fixtures) host.note('fixtures_missing', why ?? '');
      fixturesVersion = fixtures ? `${fixtures.replicaId}@${fixtures.version}` : 'none';
      replay = createReplayAnswers(fixtures, miss);
    });
    // The engine never asks before the page is drawn and the fixtures are in (both awaited below).
    const need = (): ModelAnswers => {
      if (!replay) throw new Error('fixtures not loaded');
      return replay;
    };
    answers = {
      understand: (d, n) => need().understand(d, n),
      meaning: (r) => need().meaning(r),
      overlayClose: (a, b) => need().overlayClose(a, b),
      compose: (r) => need().compose(r),
    };
  }

  const bg = createStudyBackground({
    fit: trial.fit,
    answers,
    zoom,
    note: (k, d) => host.note(k, d),
  });
  installChromeShim(bg.handle);

  const finishReady = (isLate: boolean) => {
    if (ready) return;
    ready = true;
    late = isLate;
    settleMs = Math.round(performance.now());
    if (isLate) host.note('settle_late', String(settleMs));
    o.ready({ settleMs, late: isLate });
  };

  void (async () => {
    await Promise.all([pageDrawn(SETTLE_CAP_MS), fixturesLoaded]);
    bodyPxBefore = measureBodyPx();
    let engine: { api: EngineApi; start(): Promise<void>; stop(): void };
    let mountUi: (api: EngineApi) => () => void;
    try {
      const [ctl, mnt, tok] = await Promise.all([
        import('../../../extension/src/engine/controller'),
        import('../../../extension/src/ui/mount'),
        import('../../../extension/src/ui/tokens'),
      ]);
      mountUi = mnt.mountUi;
      calmF = (s) => tok.calmMetrics(s.fit).F;
      engine = ctl.createController();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      host.note('engine_error', `load: ${error}`);
      finishReady(true);
      return;
    }
    api = engine.api;
    if (import.meta.env.DEV) (window as { __studyEngine?: EngineApi }).__studyEngine = engine.api;
    try {
      // content.ts: mountUi(engine.api), then engine.start().
      mountUi(engine.api);
      const ui = document.querySelector('webable-ui');
      const outer = ui?.shadowRoot ?? null;
      if (outer) {
        const calmHost = outer.querySelector<HTMLElement>('.wa-calm-host');
        const calm = calmHost?.shadowRoot ?? null;
        adoptHideSheet(outer);
        if (calm) adoptHideSheet(calm);
        meter.attachLayer({ outer, calmHost: calmHost ?? null, calm });
      } else {
        // A closed root: the launcher cannot be hidden nor the simplified page measured (build with --mode e2e).
        host.note('engine_error', 'closed shadow root');
      }
    } catch (err) {
      host.note('engine_error', `mount: ${err instanceof Error ? err.message : String(err)}`);
    }

    let lastUpdate = performance.now();
    let wasOpen = false;
    engine.api.subscribe((s) => {
      lastUpdate = performance.now();
      // The simplified page closing once the page is shown means the person left it some way the study missed.
      if (wasOpen && !s.calm.open && ready) host.note('simplified_closed');
      wasOpen = !!s.calm.open;
      for (const t of s.toasts ?? []) toasts.add(t.id);
      for (const f of s.struggle?.offers ?? []) offers.add(f.kind);
    });
    let started = false;
    void engine.start().then(
      () => {
        started = true;
      },
      (err: unknown) => {
        started = true;
        host.note('engine_error', `start: ${err instanceof Error ? err.message : String(err)}`);
      },
    );

    // Settled: boot finished, nothing pending, a final phase, no Calm view loading, compose not working, and 600 ms
    // with no store updates. Capped at 8 s from the frame's start; the engine keeps going after a late ready.
    const settled = (): boolean => {
      if (!started || !api) return false;
      const s = api.getState();
      // Boot is over: 'tailored' then means Jev's read failed or was skipped, and nothing else will move it.
      return (s.pendingWork ?? 0) === 0 && (SETTLED_PHASES.has(s.phase) || s.phase === 'tailored') && !s.calm.loading
        && s.compose?.status !== 'working' && performance.now() - lastUpdate >= SETTLE_QUIET_MS;
    };
    const debounceOn = () => !!api?.getState().ops.some((op) => op.kind === 'debounce' && op.status === 'applied');
    await new Promise<void>((resolve) => {
      const tick = window.setInterval(() => {
        if (settled()) {
          window.clearInterval(tick);
          void nextPaint().then(() => {
            finishReady(false);
            meter.armDebounceCheck(debounceOn);
            resolve();
          });
          return;
        }
        if (!ready && performance.now() >= SETTLE_CAP_MS) finishReady(true);
      }, 100);
    });
  })().catch((err: unknown) => {
    error = err instanceof Error ? err.message : String(err);
    host.note('engine_error', error);
    finishReady(true);
  });

  return {
    status() {
      const s = api?.getState();
      const out: Partial<FrameStatus> = { ready, late, settleMs, replayMisses: misses.length };
      if (s) {
        out.phase = s.phase;
        out.pendingWork = s.pendingWork ?? 0;
        out.calmOpen = !!s.calm.open;
        out.composeStatus = s.compose?.status ?? 'idle';
      }
      if (recorder) out.inFlight = recorder.inFlight();
      if (error) out.error = error;
      return out;
    },
    delivery() {
      if (!api) return null;
      const s = api.getState();
      return buildDelivery({
        state: s,
        report: bg.lastReport(),
        engineCommit: engineCommit(),
        fixturesVersion,
        settleMs: settleMs ?? Math.round(performance.now()),
        bodyPxBefore,
        calmBodyPx: s.calm.open && calmF ? calmF(s) : null,
        replayMisses: misses,
        toastsSeen: toasts.size,
        offersSeen: offers.size,
      });
    },
    recorded: () => recorder?.recorded() ?? null,
  };
}
