// The frame runtime every replica loads first (/_study/frame.js, the first child of the replica's <head>). It finds
// the study shell on the parent window (window.parent.__studyHost), measures what the person does between begin()
// and end() in both conditions, blocks every navigation, and in the adapted condition starts WebAble's real engine.
// Opened on its own (no host), it does nothing visible: it only keeps links from leaving the page.

import type { FrameHost } from '../contracts';
import type { AdaptedRun } from './adapted';
import { Meter } from './meter';
import { showLinkNote } from './note';
import { nextPaint, pageDrawn } from './ready';
import type { FrameStatus, StudyFrameApi, StudyTrial } from './types';

const ORIGINAL_CAP_MS = 8000;

function findHost(): FrameHost | null {
  try {
    if (window.parent === window) return null;
    const h = (window.parent as unknown as { __studyHost?: FrameHost }).__studyHost;
    return h && typeof h.trial === 'function' && typeof h.ready === 'function' ? h : null;
  } catch {
    return null; // another origin
  }
}

/** iOS must not inflate text on its own (the same in both conditions). */
function textSizeAdjust(): void {
  const css = 'html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }';
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = css;
    (document.head ?? document.documentElement).append(style);
  }
}

const host = findHost();
let trial: StudyTrial | null = null;
try {
  trial = host ? (host.trial() as StudyTrial) : null;
} catch {
  trial = null;
}

// First, before the replica's own scripts and the engine add theirs.
const meter = new Meter(trial?.task ?? null, {
  note: (kind, detail) => {
    try {
      host?.note(kind, detail);
    } catch {
      /* the shell is gone */
    }
  },
  linkNote: () => {
    if (host) showLinkNote();
  },
});
meter.install();

if (host && trial) boot(host, trial);

function boot(h: FrameHost, t: StudyTrial): void {
  textSizeAdjust();
  let adapted: AdaptedRun | null = null;
  let ready = false;
  let late = false;
  let settleMs: number | null = null;
  let error: string | undefined;
  const markReady = (info: { settleMs: number; late: boolean }) => {
    if (ready) return;
    ready = true;
    late = info.late;
    settleMs = info.settleMs;
    try {
      h.ready(info);
    } catch {
      /* the shell is gone */
    }
  };

  const api: StudyFrameApi = {
    begin: () => meter.begin(),
    end: () => meter.end(),
    delivery: () => adapted?.delivery() ?? null,
    status: (): FrameStatus => ({
      condition: t.condition,
      mode: t.mode,
      ready,
      late,
      settleMs,
      measuring: meter.isMeasuring(),
      ...(adapted?.status() ?? {}),
      ...(error ? { error } : {}),
    }),
    recorded: () => adapted?.recorded() ?? null,
  };
  (window as unknown as { __studyFrame?: StudyFrameApi }).__studyFrame = api;

  if (t.condition === 'adapted') {
    // A separate chunk: the original and practice pages never load engine code.
    import('./adapted').then(
      (m) => {
        adapted = m.startAdapted({ host: h, trial: t, meter, ready: markReady });
      },
      (err: unknown) => {
        error = err instanceof Error ? err.message : String(err);
        h.note('engine_error', `load: ${error}`);
        markReady({ settleMs: Math.round(performance.now()), late: true });
      },
    );
    return;
  }
  // Original and practice: loaded, fonts in, first-screen images decoded, painted.
  void pageDrawn(ORIGINAL_CAP_MS).then(async ({ capped }) => {
    await nextPaint();
    markReady({ settleMs: Math.round(performance.now()), late: capped });
  });
}
