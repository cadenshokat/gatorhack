// Owner: C1, round 3: T. The in-page engine: implements EngineApi and owns EngineState.
//
// Boot order (SPEC "Architecture", round 3): wait for load (1.5 s cap) and 400 ms DOM quiet -> settings + fit from the
// background -> if disabled, paused for this origin or no fit: idle (the pill still mounts) -> reader -> page zoom
// (verified on its own; zoom carries size) -> page column (verified, widened in steps if needed) -> fit ops
// (verified) -> heading ramp (verified, single headings dropped) -> Jev understand -> decisions -> ops from decisions (verified) ->
// Calm view automatically at structure level 2 on a busy page, else offered. Late overlays (cookie banners, chat
// panels) get an incremental Jev read. SPA navigations re-run the element ops; zoom and behaviour ops stay.

import {
  DEFAULT_SETTINGS, candidateSource, chooseOfferForFit, columnLimits, decideElements, heuristicSpec, nearestPreset, personZoomLadder,
  bisectColumn, planColumn, repairSpec, stepColumn, stepZoom, summarizeDecisions, summarizeFitForModel,
} from '@webable/core';
import type {
  BgRequest, CheckName, CheckResult, ElementDecision, ElementEvidence, ElementJudgment, FitProfile, FitSpec, FitSummaryForModel, HealthStatus,
  JevMetrics, LedgerEntry, Offer, OfferKind, OpKind, OutlineNode, OverlayAction, PageDigest, PageOutline, PageUnderstanding,
  RedesignResult, Role, Settings, StruggleJudgment, StruggleKind, TabReport, VisualVerdict, ZoomPlan,
} from '@webable/core';
import type { EngineApi, EngineState, Toast } from '../contracts';
import { isOurUi } from '../ui/mount';
import { ask, askExt, errText, plainError, tell, type HealthInfo, type ZoomInfo } from './bus';
import { OverlayManager, type OverlayView } from './overlays';
import { createStore, throttle } from './store';
import { routeKey, settle, sleep, waitForLoad, waitForQuiet, waitForVisible, watchNavigation } from './nav';
import { PageReader, collapse, type NodeInfo, type ReadResult } from './reader';
import { Tailor, resetBackgroundCache, type ColumnOp, type Op } from './tailor';
import { Verifier, calmCoverage, completeSpec, plainCheck } from './verify-dom';
import { noteOfferOutcome, startSignals, type SignalsHost } from './signals';
import { requestExplain } from './explain';

export interface Controller {
  api: EngineApi;
  start(): Promise<void>;
  stop(): void;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function safeOurs(t: EventTarget | null): boolean {
  if (t instanceof Element && t.tagName === 'WEBABLE-UI') return true;
  try {
    return isOurUi(t);
  } catch {
    return false;
  }
}

function quote(name: string, words = 6): string {
  const w = collapse(name).split(' ').filter(Boolean);
  if (!w.length) return '';
  const s = w.length > words ? `${w.slice(0, words).join(' ')}…` : w.join(' ');
  return `“${s}”`;
}

function p2(p: number): string {
  return (Math.round(p * 100) / 100).toFixed(2);
}

function r2(p: number): number {
  return Math.round(p * 100) / 100;
}

function pct(z: number): string {
  return `${Math.round(z * 100)}%`;
}

/* ------------------------------------------------------------------ */
/* Per-site memory (round 3): text steps and page width               */
/* ------------------------------------------------------------------ */

interface SitePrefs {
  /** A−/A+ steps from the fit's zoom. */
  textStep?: number;
  /** The person's page width: 'off' (full width) or a column width in screen px. */
  column?: 'off' | number;
  /** When the automatic column last did not fit this site (ms); it is tried again after COLUMN_RETRY_MS. */
  columnFailed?: number;
}

const SITE_PREFS_KEY = 'sitePrefs';
/** A site whose page did not fit the automatic column is tried again after three days (an ad can fail one visit). */
const COLUMN_RETRY_MS = 3 * 24 * 3600 * 1000;

/**
 * Page zoom is the browser's own zoom: what the site does at the narrower viewport (line-clamped headlines, links
 * folded into its menu, sections it hides, its own type sizes for that width) is the site's designed layout at that
 * size, the same as Ctrl +. Zoom rolls back only for what breaks a page: sideways scrolling and text drawn over text.
 */
const ZOOM_IGNORES: CheckName[] = ['clipping', 'reachability', 'content_loss', 'hierarchy'];
/**
 * The page column is a narrower window: the site's own narrower layout folding a menu, hiding a link or setting
 * smaller headings is its design (heading_scale runs after). Text cut off, text over text and sideways scrolling
 * still roll it back.
 */
const COLUMN_IGNORES: CheckName[] = ['reachability', 'content_loss', 'hierarchy'];

function siteKey(): string {
  return (location.hostname || location.origin).replace(/^www\./, '');
}

async function loadSitePrefs(): Promise<SitePrefs> {
  try {
    const got = await chrome.storage.local.get(SITE_PREFS_KEY);
    const all = (got[SITE_PREFS_KEY] ?? {}) as Record<string, SitePrefs>;
    return { ...(all[siteKey()] ?? {}) };
  } catch {
    return {};
  }
}

async function saveSitePrefs(patch: Partial<Record<keyof SitePrefs, SitePrefs[keyof SitePrefs] | undefined>>): Promise<void> {
  try {
    const got = await chrome.storage.local.get(SITE_PREFS_KEY);
    const all = { ...((got[SITE_PREFS_KEY] ?? {}) as Record<string, SitePrefs>) };
    const next: Record<string, unknown> = { ...(all[siteKey()] ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === 0) delete next[k];
      else next[k] = v;
    }
    if (Object.keys(next).length) all[siteKey()] = next as SitePrefs;
    else delete all[siteKey()];
    const keys = Object.keys(all);
    if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete all[k];
    await chrome.storage.local.set({ [SITE_PREFS_KEY]: all });
  } catch {
    /* storage unavailable: the choice holds for this page only */
  }
}

const OP_NOUN: Record<OpKind, string> = {
  page_zoom: 'page zoom',
  text_map: 'the larger text',
  spacing: 'line spacing',
  contrast: 'the darker text',
  weight: 'the heavier text',
  measure: 'the shorter lines',
  targets: 'the larger click areas',
  steady_clicks: 'steady clicks',
  debounce: 'double-click protection',
  motion: 'stopped motion',
  dim: 'the fading',
  promote_main: 'the main-button outline',
  unpin_sticky: 'the unpinned top bar',
  focus_ring: 'the focus ring',
  calm_view: 'the calm layout',
  unobstruct: 'the moved overlay',
  column: 'the narrower page',
  heading_scale: 'the larger headings',
};

const OFFER_TOAST: Record<OfferKind, string> = {
  bigger_targets: 'Buttons are easier to hit on this page',
  steady_clicks: 'Steady clicks are on for this page',
  debounce: 'Accidental double clicks are ignored on this page',
  larger_text: 'Text is larger on this page',
  explain: 'Showing a plain-language explanation',
  calm_view: 'Calm view is open',
  main_actions: 'The main button is easier to find',
  explain_field: 'Showing what this field asks for',
};

const FOLD_ROLES: Role[] = ['advertising', 'recommendations', 'popup_overlay'];
const PROTECT_ROLE_LIST: Role[] = ['main_content', 'form_field', 'action_button', 'navigation', 'help_contact', 'consent_notice', 'account_utility'];

function addMetrics(a: JevMetrics, b: JevMetrics): JevMetrics {
  return {
    model: b.model || a.model,
    calls: a.calls + b.calls,
    questions: a.questions + b.questions,
    inputTokens: a.inputTokens + b.inputTokens,
    wallMs: a.wallMs + b.wallMs,
    serverMs: a.serverMs === null && b.serverMs === null ? null : (a.serverMs ?? 0) + (b.serverMs ?? 0),
    costUsd: a.costUsd + b.costUsd,
  };
}

function isUnderstanding(x: unknown): x is PageUnderstanding {
  return !!x && typeof x === 'object' && Array.isArray((x as PageUnderstanding).elements) && !!(x as PageUnderstanding).metrics;
}

function hashString(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function outlineSignature(o: PageOutline): string {
  return hashString(o.nodes.map((n) => `${n.kind}:${n.label}:${n.parent ?? ''}`).join('|'));
}

/** Minimal spec when the core heuristic is unavailable: everything open, in page order. */
function fallbackSpec(outline: PageOutline): FitSpec {
  const tops = outline.nodes.filter((n) => !n.parent).map((n) => n.id);
  const sections: FitSpec['sections'] = [];
  for (let i = 0; i < tops.length; i += 40) {
    sections.push({
      heading_ref: null, label: i === 0 ? 'Overview' : 'More on this page', role: i === 0 ? 'primary' : 'other',
      nodes: tops.slice(i, i + 40), layout: 'as_is', emphasis: i === 0 ? 'lead' : 'normal', state: 'open',
      why: i === 0 ? 'main_task' : 'reference_info', show_first: 0,
    });
  }
  if (!sections.length) {
    sections.push({ heading_ref: null, label: 'Overview', role: 'primary', nodes: [], layout: 'as_is', emphasis: 'lead', state: 'open', why: 'main_task', show_first: 0 });
  }
  return { page_type: 'other', task: 'other', strip: [], sections, primary_action: null, form_steps: [], density: 'comfortable' };
}

function fallbackSummary(fit: FitProfile): FitSummaryForModel {
  const body = fit.text.override ?? fit.text.bodyPx;
  const t = fit.targets.minPx ?? 24;
  return {
    text_need: body >= 22 ? 'large' : body >= 18 ? 'some' : 'none',
    target_need: t >= 56 ? 'large' : t >= 40 ? 'some' : 'none',
    clutter_tolerance: fit.attention.clutter.p >= 0.6 ? 'low' : fit.attention.clutter.p >= 0.3 ? 'medium' : 'high',
    structure_level: fit.attention.structureLevel,
    motion: fit.attention.motion.on ? 'reduce' : 'fine',
    polarity: fit.polarity.value,
  };
}

function initialState(): EngineState {
  return {
    phase: 'idle',
    fit: null,
    settings: { ...DEFAULT_SETTINGS },
    startedAt: performance.now(),
    digest: null,
    outline: null,
    ops: [],
    checks: [],
    ledger: [],
    understanding: null,
    decisions: [],
    lens: { on: false },
    calm: { open: false, loading: false, spec: null, source: null, aiReady: false, redesign: null, visual: null },
    struggle: { latest: null, history: [], waiting: [], offers: [] },
    toasts: [],
    explain: { open: false, loading: false, anchor: null, original: null, result: null, error: null },
    showingOriginal: false,
    overlays: [],
    ai: 'on',
    column: { on: false, widthPx: null, minPx: 720, maxPx: 1600 },
    textStep: 0,
    pageZoom: 1,
    passive: null,
    textZoom: 1,
  };
}

/* ------------------------------------------------------------------ */
/* Controller                                                          */
/* ------------------------------------------------------------------ */

export function createController(): Controller {
  const store = createStore<EngineState>(initialState());
  const reader = new PageReader();
  const verifyIds = new WeakMap<Element, string>();
  /** The other way round, so a check's element ids can be looked up (elementFor), held weakly. */
  const verifyEls = new Map<string, WeakRef<Element>>();
  let verifyNext = 1;
  const idOf = (el: Element): string => {
    const rid = reader.idFor(el);
    if (rid) return rid;
    let v = verifyIds.get(el);
    if (!v) {
      v = `v${verifyNext++}`;
      verifyIds.set(el, v);
      if (verifyEls.size > 20000) verifyEls.clear();
      verifyEls.set(v, new WeakRef(el));
    }
    return v;
  };
  /**
   * The page column is a narrower virtual window (Tailor.columnOp): the tab's zoom is the text zoom × colMul and the
   * body is drawn at 1/colMul with CSS zoom. Everything that plans text size works in text zoom (zoomInfo's factor);
   * state.pageZoom is the tab's real zoom (our UI divides by it) and state.textZoom the zoom text is shown at.
   */
  let colMul = 1;
  /** The tab zoom WebAble last set, to tell the person's own Ctrl +/− apart while the column is on. */
  let lastTabZoom: number | null = null;
  const setZoomState = (tab: number) => {
    if (!(Number.isFinite(tab) && tab > 0)) return;
    const text = Math.round((tab / colMul) * 10000) / 10000;
    const cur = store.get();
    if (Math.abs(cur.pageZoom - tab) > 0.001 || Math.abs((cur.textZoom ?? cur.pageZoom) - text) > 0.001) store.set({ pageZoom: tab, textZoom: text });
  };
  /** Set the tab's zoom for a text zoom (× the column's multiplier). */
  const setTextZoom = async (text: number): Promise<void> => {
    const tab = Math.round(text * colMul * 10000) / 10000;
    lastTabZoom = tab;
    await ask<number>({ type: 'setZoom', factor: tab });
    setZoomState(tab);
  };
  const tailor = new Tailor({
    ask: <T,>(req: BgRequest) => {
      if (req.type === 'setZoom') {
        const tab = Math.round(req.factor * colMul * 10000) / 10000;
        lastTabZoom = tab;
        return ask<T>({ ...req, factor: tab });
      }
      return ask<T>(req);
    },
    zoomInfo: () => zoomInfo(),
    screenWidth: () => screenWidth(),
    columnScale: (k) => columnScale(k),
    isOurUi: safeOurs,
    idOf,
    onBehaviour: (kind) => {
      behaviourCounts[kind]++;
    },
    onZoom: (factor) => setZoomState(factor * colMul),
  });
  const verifier = new Verifier({ idOf, isOurUi: safeOurs });

  // Engine-internal state (not part of EngineState).
  let generation = 0;
  let read: ReadResult | null = null;
  let plan: ZoomPlan | null = null;
  let opsList: Op[] = [];
  /** This site's remembered text steps and page width. */
  let sitePrefs: SitePrefs = {};
  /** How much wider than planned the automatic column had to be to fit this page (1 = as planned). */
  let columnWiden = 1;
  const undoneKinds = new Set<OpKind>();
  const opOffer = new Map<string, OfferKind>();
  let judged = new Set<string>();
  let decided = new Set<string>();
  /** Every element Jev has answered for on this page, so later partial reads extend the decisions instead of replacing them. */
  let jevEls = new Map<string, ElementEvidence>();
  let incrementalRounds = 0;
  /** A significant change arrived before Jev's first answer; read again once it lands. */
  let pendingLate = false;
  let lastIncrementalAt = 0;
  let incrementalTimer: ReturnType<typeof setTimeout> | null = null;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let flushFirstAt = 0;
  let pendingAdded: Element[] = [];
  let pendingChanged = new Set<Element>();
  let mo: MutationObserver | null = null;
  let stopNav: (() => void) | null = null;
  let stopSignals: (() => void) | null = null;
  let stopped = false;
  let errors: string[] = [];
  const behaviourCounts = { steady: 0, debounce: 0 };
  let explainSeq = 0;
  // Calm view
  let calmOpenedAt = 0;
  let calmEngaged = false;
  let calmGen = 0;
  let heuristicSpecCache: FitSpec | null = null;
  let pendingAi: { spec: FitSpec; result: RedesignResult } | null = null;
  let zoomSuspended = false;
  let calmWasOpen = false;
  const redesignCache = new Map<string, RedesignResult>();
  const dismissedOffers = new Map<OfferKind, number>();

  const getFit = () => store.get().fit;

  /* ---------------- ledger, ops, toasts, errors ---------------- */

  const log = (e: Omit<LedgerEntry, 'at'>) => {
    const entry: LedgerEntry = { at: Math.round(performance.now() - store.get().startedAt), ...e };
    if (entry.p !== undefined) entry.p = r2(entry.p);
    store.set((s) => ({ ledger: [...s.ledger, entry].slice(-240) }));
  };

  const activeColumn = (): ColumnOp | null => (opsList.find((o) => o.rec.kind === 'column' && o.active) as ColumnOp | undefined) ?? null;

  /** Viewport width in screen px (CSS px × zoom). */
  const screenWidth = (): number => {
    const zoom = store.get().pageZoom;
    return (document.documentElement.clientWidth || innerWidth) * (zoom > 0 ? zoom : 1);
  };
  /** The zoom text is shown at (the tab's zoom without the column's share). */
  const textZoomNow = (): number => store.get().pageZoom / colMul;

  const columnState = (): EngineState['column'] => {
    const op = activeColumn();
    const sw = screenWidth();
    const lim = columnLimits(sw);
    return { on: !!op, widthPx: op ? op.spec.widthPx : null, minPx: lim?.minPx ?? 720, maxPx: lim?.maxPx ?? Math.max(720, Math.round(sw - 128)) };
  };

  const syncOps = () => {
    const column = columnState();
    const cur = store.get().column;
    const same = cur.on === column.on && cur.widthPx === column.widthPx && cur.minPx === column.minPx && cur.maxPx === column.maxPx;
    store.set({ ops: opsList.map((o) => ({ ...o.rec, targetIds: [...o.rec.targetIds] })), ...(same ? {} : { column }) });
  };

  const addError = (msg: string) => {
    if (!msg) return;
    errors = [...errors.filter((e) => e !== msg), msg].slice(-20);
    pushReport();
  };

  let toastSeq = 0;
  const toast = (text: string, undoOpId?: string) => {
    const t: Toast = undoOpId ? { id: `t${++toastSeq}`, text, undoOpId } : { id: `t${++toastSeq}`, text };
    store.set((s) => ({ toasts: [...s.toasts, t].slice(-4) }));
    if (!undoOpId) {
      setTimeout(() => store.set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), 6000);
    }
  };

  /* ---------------- report to the background (throttled 500 ms) ---------------- */

  const buildReport = (): TabReport => {
    const s = store.get();
    const u = s.understanding;
    let summary: { folded: number; protected: number; mainId: string | null } = { folded: 0, protected: 0, mainId: null };
    try {
      summary = summarizeDecisions(s.decisions);
    } catch {
      summary = {
        folded: s.decisions.filter((d) => d.verdict === 'fold').length,
        protected: s.decisions.filter((d) => d.verdict === 'protect').length,
        mainId: s.decisions.find((d) => d.verdict === 'promote')?.id ?? null,
      };
    }
    return {
      url: location.href,
      phase: s.phase,
      fitApplied: s.ops.some((o) => o.status === 'applied' && opsList.find((x) => x.rec.id === o.id)?.source === 'fit'),
      ops: s.ops,
      checks: s.checks,
      ledger: s.ledger.slice(-120),
      understanding: u ? { metrics: u.metrics, decisions: u.metrics.questions || s.decisions.length, folded: summary.folded, protected: summary.protected, mainId: summary.mainId } : null,
      struggle: s.struggle.latest,
      redesign: s.calm.redesign ? { chosen: s.calm.redesign.chosen, autoApply: s.calm.redesign.autoApply, ms: s.calm.redesign.llm.ms } : null,
      errors,
      overlays: s.overlays,
      ai: s.ai,
    };
  };
  const pushReport = throttle(() => {
    if (stopped) return;
    tell({ type: 'report', report: buildReport() });
  }, 500);
  store.subscribe(() => pushReport());

  /* ---------------- one writer at a time (verified batches, overlay moves) ---------------- */

  let lockChain: Promise<unknown> = Promise.resolve();
  function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = lockChain.then(fn, fn);
    lockChain = run.catch(() => undefined);
    return run;
  }

  /* ---------------- overlays that cover the task ("make room") ---------------- */

  /** What the task needs in view: the main action, main-form fields in the first screens, the h1. */
  function taskTargets(): Element[] {
    const out: Element[] = [];
    const promoted = store.get().decisions.find((d) => d.verdict === 'promote');
    const main = promoted ? reader.elementFor(promoted.id) : null;
    if (main) out.push(main);
    const vh = document.documentElement.clientHeight || innerHeight;
    if (!main) {
      // No main pick (a portal home page): the buttons Jev scored most likely to be the main action stand in for it.
      const likely = store.get().decisions
        .filter((d) => d.verdict !== 'fold' && d.judgment.main >= 0.1)
        .sort((a, b) => b.judgment.main - a.judgment.main)
        .slice(0, 2);
      for (const d of likely) {
        const el = reader.elementFor(d.id);
        if (!el || !el.isConnected || !el.matches('a[href], button, [role="button"], input[type="submit"]')) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh) out.push(el);
      }
    }
    if (read) {
      for (const n of read.nodes.values()) {
        if (out.length >= 14) break;
        if (!n.inMain || !n.el.isConnected) continue;
        if (n.kind !== 'field' && n.kind !== 'select' && n.kind !== 'checkbox' && n.kind !== 'radio') continue;
        const r = n.el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh) out.push(n.el);
      }
    }
    const h1 = Array.from(document.querySelectorAll('h1')).find((h) => !safeOurs(h) && h.getBoundingClientRect().height > 0);
    if (h1) out.push(h1);
    return out;
  }

  const overlays = new OverlayManager({
    ask: <T,>(req: BgRequest) => ask<T>(req),
    isOurUi: safeOurs,
    ensureId: (el) => reader.ensureId(el),
    decisions: () => store.get().decisions,
    elementFor: (id) => reader.elementFor(id) ?? verifyEls.get(id)?.deref() ?? null,
    taskTargets,
    mainRoot: () => read?.mainRoot ?? null,
    sheets: tailor.sheets,
    lock: withLock,
    addOp: (op) => {
      opsList.push(op);
      syncOps();
    },
    syncOps: () => syncOps(),
    log: (e) => log(e),
    toast: (text, undoOpId) => toast(text, undoOpId),
    publish: (list: OverlayView[]) => store.set({ overlays: list }),
    // Scans also run under the Calm view, so the page is already clear when the person closes it.
    paused: () => {
      const s = store.get();
      return stopped || s.showingOriginal || !(s.phase === 'tailored' || s.phase === 'understood' || s.phase === 'calm');
    },
    quiet: () => store.get().calm.open,
    ledgerHas: (title) => store.get().ledger.some((e) => e.title === title),
  });

  /* ---------------- zoom ---------------- */

  /** The text zoom (`factor`: the tab's zoom without the page column's share) and the tab's own zoom (`tab`). */
  async function zoomInfo(): Promise<{ factor: number; tab: number; personChanged: boolean }> {
    const out = (tab: number, personChanged: boolean) => ({ factor: Math.round((tab / colMul) * 10000) / 10000, tab, personChanged });
    try {
      const z = await askExt<ZoomInfo>({ type: 'zoomInfo' });
      if (z && Number.isFinite(z.factor)) return out(z.factor, !!z.personChanged);
    } catch {
      /* fall back to getZoom */
    }
    try {
      const f = await ask<number>({ type: 'getZoom' });
      return out(Number.isFinite(f) && f > 0 ? f : 1, false);
    } catch {
      return out(colMul, false);
    }
  }

  /**
   * Draw the page column at scale k (1 = none): the tab's zoom becomes text zoom ÷ k, capped at Chrome's 500%.
   * Resolves after the resize with the k in effect.
   */
  async function columnScale(k: number): Promise<number> {
    const zi = await zoomInfo();
    const text = zi.factor > 0 ? zi.factor : 1;
    let mul = k > 0 && k < 1 ? 1 / k : 1;
    mul = Math.max(1, Math.min(mul, 5 / text));
    if (Math.abs(mul - colMul) < 0.0005 && Math.abs(zi.tab - text * mul) < 0.002) return 1 / colMul;
    colMul = mul;
    const resized = waitResize(900);
    await setTextZoom(text);
    await resized;
    await sleep(250);
    return 1 / mul;
  }

  const waitResize = (cap = 600) => new Promise<void>((resolve) => {
    const t = setTimeout(done, cap);
    function done() {
      clearTimeout(t);
      window.removeEventListener('resize', done);
      resolve();
    }
    window.addEventListener('resize', done, { once: true });
  });

  /* ---------------- applying and verifying a batch ---------------- */

  interface BatchOptions {
    quiet?: boolean;
    /** Probe the whole page's main text (text size, spacing, heading and column batches). */
    wide?: boolean;
    /** Checks this batch does not roll back for (see SnapshotContext.ignore). */
    ignore?: CheckName[];
  }

  function applyBatch(batch: Op[], r: ReadResult | null, opts: BatchOptions = {}): Promise<Op[]> {
    if (!batch.length || stopped) return Promise.resolve([]);
    return withLock(() => applyBatchNow(batch, r, opts));
  }

  async function applyBatchNow(batch: Op[], r: ReadResult | null, opts: BatchOptions = {}): Promise<Op[]> {
    const fit = getFit();
    if (!batch.length || stopped) return [];
    const gen = generation;
    if (store.get().showingOriginal) {
      // Recorded now, applied when the person turns the original page off.
      for (const op of batch) opsList.push(op);
      syncOps();
      return batch;
    }
    const probe = verifier.probe(r, batch.flatMap((o) => o.elements), { wide: !!opts.wide });
    const coverOps = [...opsList.filter((o) => o.active), ...batch];
    const mainRoot = r?.mainRoot ?? null;
    const before = verifier.snapshot(probe, { ops: opsList.filter((o) => o.active), coverOps, contrastFloor: fit?.contrast.floor, mainRoot });
    verifier.watchVolatile();
    const zoomInBatch = batch.some((o) => o.rec.kind === 'page_zoom');
    for (const op of batch) {
      try {
        await op.apply();
      } catch (err) {
        op.rec.status = 'skipped';
        op.rec.reason = `${op.rec.reason}; not applied: ${errText(err)}`;
        if (!opts.quiet) log({ source: op.source, title: `Could not apply ${OP_NOUN[op.rec.kind]}`, detail: plainError(err), action: 'skipped', opId: op.rec.id });
      }
      opsList.push(op);
    }
    // A zoom change: wait for the resize, then a moment for the site's own responsive scripts (menus that fold).
    if (zoomInBatch) {
      await waitResize();
      await sleep(350);
    }
    await settle();
    if (gen !== generation || stopped) {
      verifier.stopVolatile();
      return [];
    }
    const outcome = await verifier.verify(
      batch.filter((o) => o.active), before, probe,
      { ops: opsList, coverOps, contrastFloor: fit?.contrast.floor, mainRoot, guardOps: [], ...(opts.ignore ? { ignore: opts.ignore } : {}) },
      async (op) => {
        await op.revert();
        op.rec.status = 'reversed';
      },
      async (op) => {
        await op.apply();
        op.rec.status = 'applied';
      },
    );
    verifier.stopVolatile();
    for (const op of batch) {
      if (op.active && !opts.quiet) log({ source: op.source, title: op.title, detail: op.detail, p: op.p, action: 'applied', opId: op.rec.id });
    }
    for (const d of outcome.droppedEls) {
      if (opts.quiet) continue;
      log({
        source: 'check',
        title: `Kept ${d.count} heading${d.count === 1 ? '' : 's'} at the site's own size where a larger one did not fit`,
        detail: d.result.detail,
        action: 'skipped',
        opId: d.op.rec.id,
      });
    }
    for (const rv of outcome.reversed) {
      if (opts.quiet && rv.op.rec.kind === 'column') continue; // the column's tries are summed up by tryColumn
      const where = /\bin the ([a-z ]+?)(?= is| are| now| can| faded| hid| disappeared| got| sticks| \(|$)/.exec(rv.result.detail)?.[1];
      log({
        source: 'check',
        title: `Reversed ${OP_NOUN[rv.op.rec.kind]}: ${plainCheck(rv.result.name)}${where ? ` in the ${where}` : ''}`,
        detail: rv.result.detail,
        action: 'reversed',
        opId: rv.op.rec.id,
      });
    }
    if (outcome.dropped) {
      log({ source: 'check', title: `Kept ${outcome.dropped} click area${outcome.dropped === 1 ? '' : 's'} at the original size where a larger one would not reach`, action: 'skipped' });
    }
    store.set((s) => ({ checks: [...s.checks, ...outcome.checks].slice(-80) }));
    syncOps();
    return batch.filter((o) => o.active);
  }

  async function revertOp(op: Op): Promise<void> {
    if (!op.active) return;
    try {
      await op.revert();
    } catch (err) {
      addError(plainError(err));
    }
  }

  /* ---------------- boot ---------------- */

  async function loadSettingsAndFit(): Promise<{ settings: Settings; fit: FitProfile | null }> {
    let settings: Settings = { ...DEFAULT_SETTINGS };
    let fit: FitProfile | null = null;
    try {
      const s = await ask<Partial<Settings> | null>({ type: 'getSettings' });
      settings = { ...DEFAULT_SETTINGS, ...(s ?? {}) };
    } catch (err) {
      addError(plainError(err));
    }
    try {
      fit = await ask<FitProfile | null>({ type: 'getFit' });
      if (fit && fit.v !== 'fit.1') fit = null;
    } catch (err) {
      addError(plainError(err));
    }
    return { settings, fit };
  }

  /** AI availability from the server's /health ('on' | 'off' | 'no_credits'), for the panel's "AI layouts off" line. */
  async function refreshHealth(): Promise<void> {
    try {
      const h = await askExt<HealthInfo>({ type: 'health' });
      const ai: HealthStatus['ai'] = h.ai === 'on' || h.ai === 'off' || h.ai === 'no_credits'
        ? h.ai
        : h.ok && h.openai !== false ? 'on' : 'off';
      if (store.get().ai !== ai) store.set({ ai });
    } catch {
      if (store.get().ai !== 'off') store.set({ ai: 'off' });
    }
  }

  /** True on the first Jev read of this page in this browser session (that read skips the server's cache). */
  async function firstReadInSession(): Promise<boolean> {
    const key = `read:${hashString(`${location.origin}${location.pathname}`)}`;
    try {
      const got = await chrome.storage.session.get(key);
      if (got[key]) return false;
      await chrome.storage.session.set({ [key]: Date.now() });
      return true;
    } catch {
      return false;
    }
  }

  function pausedHere(settings: Settings): boolean {
    return settings.pausedOrigins.includes(location.origin) || settings.pausedOrigins.includes(location.hostname);
  }

  /* ---------------- text size and the page column (round 3) ---------------- */

  /** One person action at a time (A−/A+, Narrower/Wider): each one is verified before the next starts. */
  let personChain: Promise<unknown> = Promise.resolve();
  function personAction(fn: () => Promise<void>): void {
    const run = personChain.then(fn, fn);
    personChain = run.catch((err: unknown) => addError(plainError(err)));
  }

  /** Zoom stopped short of the person's size: say so, and offer Calm view (it renders at their size). */
  function noteSizeShortfall(p: ZoomPlan): void {
    if (!p.capped || p.step !== 0) return;
    const eff = Math.round(p.bodyPx * p.zoom);
    const target = Math.round(p.targetPx);
    log({
      source: 'fit',
      title: `Text is ${eff} px here; your size is ${target} px`,
      detail: `Zoom stops at ${pct(p.cap)} on fitted pages, so this page's ${p.bodyPx} px text stays short of your size. Calm view shows the page at your size.`,
      action: 'offered',
    });
    const s = store.get();
    if (s.struggle.offers.length || (dismissedOffers.get('calm_view') ?? 0) > Date.now()) return;
    const offer: Offer = {
      kind: 'calm_view',
      question: 'Show this page at your text size?',
      fact: `Zoom stops at ${pct(p.cap)} here, so text is ${eff} px, not ${target} px.`,
      why: 'Calm view sets the whole page at your size, and every control still works the original page.',
      p: 1,
    };
    store.set({ struggle: { ...s.struggle, offers: [offer] } });
  }

  /** Whether this page gets a column, and how wide: the site's remembered choice, then the fit, then automatic. */
  function columnWish(): { mode: 'auto' | 'person'; fixedPx: number | null } | null {
    const pref = sitePrefs.column;
    if (pref === 'off') return null;
    if (typeof pref === 'number' && pref > 0) return { mode: 'person', fixedPx: pref };
    const fitPref = getFit()?.layout?.column ?? 'auto';
    if (fitPref === 'off') return null;
    if (typeof fitPref === 'number' && fitPref > 0) return { mode: 'person', fixedPx: fitPref };
    if (sitePrefs.columnFailed && Date.now() - sitePrefs.columnFailed < COLUMN_RETRY_MS) return null;
    // Automatic: on pages WebAble zooms.
    return opsList.some((o) => o.rec.kind === 'page_zoom' && o.active) ? { mode: 'auto', fixedPx: null } : null;
  }

  function columnWidthFor(mode: 'auto' | 'person', fixedPx: number | null): number | null {
    const sw = screenWidth();
    const planned = planColumn({ screenW: sw, zoom: textZoomNow(), charPx: read?.body.charPx ?? 8, fixedPx });
    if (!planned) return null;
    if (mode !== 'auto' || Math.abs(columnWiden - 1) < 0.001) return planned.widthPx;
    return Math.min(planned.maxPx, Math.max(planned.minPx, Math.round((planned.widthPx * columnWiden) / 8) * 8));
  }

  /** One verified column try; a failed try leaves no op behind. */
  async function attemptColumn(r: ReadResult | null, w: number, mode: 'auto' | 'person', fails: string[]): Promise<ColumnOp | null> {
    if (stopped) return null;
    const op = tailor.columnOp({ widthPx: w, zoom: textZoomNow(), mode });
    const kept = await applyBatch([op], r, { quiet: true, wide: true, ignore: COLUMN_IGNORES });
    if (kept.includes(op)) return op;
    const why = [...store.get().checks].reverse().find((c) => !c.pass && c.opId === op.rec.id);
    if (why) fails.push(why.detail);
    opsList = opsList.filter((o) => o !== op);
    syncOps();
    return null;
  }

  /**
   * The column as narrow as the page allows: the readable width first; if the page does not fit it, the widest
   * column, then two bisection steps between them. A narrower body squeezes the site's current layout (its media
   * queries still see the whole window), so the site's fixed-width parts decide how far it can go.
   */
  async function tryColumn(r: ReadResult | null, first: number, maxPx: number, mode: 'auto' | 'person'): Promise<{ op: ColumnOp | null; width: number; fails: string[] }> {
    const fails: string[] = [];
    const firstOp = await attemptColumn(r, first, mode, fails);
    // A width the person just picked is tried as it is (adjustColumn passes maxPx = first); a remembered one that no
    // longer fits after a text size change widens like the automatic column.
    if (firstOp || maxPx <= first + 8) return { op: firstOp, width: first, fails };
    let best = await attemptColumn(r, maxPx, mode, fails);
    if (!best) return { op: null, width: first, fails };
    let bestW = maxPx;
    let lo = first;
    for (let i = 0; i < 2; i++) {
      const mid = bisectColumn(lo, bestW);
      if (mid === null) break;
      // Take the column off before the narrower try, so the checks compare with the page as the site made it.
      await revertOp(best);
      const op = await attemptColumn(r, mid, mode, fails);
      if (op) {
        best.rec.status = 'reversed';
        opsList = opsList.filter((o) => o !== best);
        best = op;
        bestW = mid;
      } else {
        lo = mid;
        try {
          await best.apply();
        } catch (err) {
          addError(plainError(err));
        }
      }
    }
    syncOps();
    return { op: best, width: bestW, fails };
  }

  /**
   * The page's body size as the page sets it now. The page column narrows the window, and a site may switch to the
   * type scale it uses at that width: the body size read at the start, scaled by how its running text changed.
   */
  function liveBodyPx(r: ReadResult): number {
    if (!activeColumn()) return r.pageBodyPx;
    const collect = (pick: (t: ReadResult['texts'][number]) => boolean): Array<[number, number]> => {
      const out: Array<[number, number]> = [];
      for (const t of r.texts) {
        if (!t.inMain || !t.el.isConnected || !(t.fontPx > 0) || !pick(t)) continue;
        const v = parseFloat(getComputedStyle(t.el).fontSize);
        if (Number.isFinite(v) && v > 0) out.push([v / t.fontPx, t.chars]);
        if (out.length >= 300) break;
      }
      return out;
    };
    let ratios = collect((t) => t.running && t.chars >= 60);
    // A page of headline links (a news front page) has little running text: its headlines are its body.
    if (ratios.length < 3) ratios = collect((t) => t.headingLevel === null && t.chars >= 20);
    if (!ratios.length) return r.pageBodyPx;
    ratios.sort((a, b) => a[0] - b[0]);
    const total = ratios.reduce((a, x) => a + x[1], 0);
    let acc = 0;
    let med = 1;
    for (const [q, w] of ratios) {
      acc += w;
      if (acc >= total / 2) {
        med = q;
        break;
      }
    }
    return Math.round(r.pageBodyPx * med * 10) / 10;
  }

  /** Letters a line before tightenColumn narrowed the column (for the ledger), or null. */
  let tightenedFrom: number | null = null;

  /**
   * Reading pages: inside the column the site may still run its paragraphs wider than is comfortable to read. When
   * they run past 80 letters a line (WCAG 1.4.8), narrow the column once towards 72 letters (never under 720 px or
   * half the screen); a narrower try that does not fit leaves the first column as it was.
   */
  async function tightenColumn(r: ReadResult, res: { op: ColumnOp | null; width: number; fails: string[] }): Promise<{ op: ColumnOp | null; width: number; fails: string[] }> {
    const cur = res.op;
    if (!cur || stopped) return res;
    const cpl = tailor.measureCpl(r);
    if (cpl === null || cpl <= 80) return res;
    const sw = screenWidth();
    const lim = columnLimits(sw);
    if (!lim) return res;
    const target = Math.max(lim.minPx, Math.round((sw * 0.5) / 8) * 8, Math.round((res.width * 72) / cpl / 8) * 8);
    if (target >= res.width - 40) return res;
    await revertOp(cur);
    const op = await attemptColumn(r, target, 'auto', res.fails);
    if (op) {
      cur.rec.status = 'reversed';
      opsList = opsList.filter((o) => o !== cur);
      columnWiden *= target / res.width;
      tightenedFrom = cpl;
      syncOps();
      return { op, width: target, fails: res.fails };
    }
    try {
      await cur.apply();
      cur.rec.status = 'applied';
    } catch (err) {
      addError(plainError(err));
    }
    syncOps();
    return res;
  }

  /** Hold the page to a column when it should have one (verified; as narrow as the page allows). */
  async function applyColumnFor(r: ReadResult, quiet: boolean): Promise<void> {
    const wish = columnWish();
    if (!wish || undoneKinds.has('column') || store.get().showingOriginal || activeColumn()) {
      syncOps();
      return;
    }
    const first = columnWidthFor(wish.mode, wish.fixedPx);
    if (first === null) {
      if (!quiet) log({ source: 'fit', title: 'This window is too narrow for a page column', action: 'skipped' });
      syncOps();
      return;
    }
    tightenedFrom = null;
    let res = await tryColumn(r, first, columnLimits(screenWidth())?.maxPx ?? first, wish.mode);
    if (res.op && wish.mode === 'auto') res = await tightenColumn(r, res);
    if (res.op) {
      if (wish.mode === 'auto' && res.width > first) columnWiden *= res.width / first;
      if (!quiet) {
        log({
          source: res.op.source,
          title: res.op.title,
          detail: res.width > first
            ? `${res.op.detail} This page's own layout did not fit ${first} px (about 70 letters a line), so the column is as narrow as the page allows.`
            : res.width < first && tightenedFrom
              ? `${res.op.detail} Its paragraphs ran to about ${tightenedFrom} letters a line at ${first} px, so the column is narrower, nearer 70.`
              : res.op.detail,
          action: 'applied',
          opId: res.op.rec.id,
        });
      }
    } else if (wish.mode === 'auto') {
      sitePrefs.columnFailed = Date.now();
      void saveSitePrefs({ columnFailed: sitePrefs.columnFailed });
      log({
        source: 'check',
        title: 'Kept this site at full width: a narrower page did not fit it',
        detail: `${res.fails.at(-1) ?? res.fails[0] ?? 'A check failed.'} Narrower in the WebAble panel tries again.`,
        action: 'reversed',
      });
    } else {
      log({ source: 'check', title: `Kept this page at full width: your ${first} px column did not fit it`, detail: res.fails[0] ?? '', action: 'reversed' });
    }
    syncOps();
  }

  /** Take the column off and decide again (after the zoom changed, or the person reset the width). */
  async function replaceColumn(quiet: boolean): Promise<void> {
    const cur = activeColumn();
    if (cur) {
      await revertOp(cur);
      cur.rec.status = 'reversed';
      opsList = opsList.filter((o) => o !== cur);
    }
    if (read) await applyColumnFor(read, quiet);
    syncOps();
  }

  /** Follow a zoom or window change: keep the column's planned width at the new zoom (no new op). */
  function reflowColumn(): void {
    const op = activeColumn();
    if (op) {
      const zoom = textZoomNow();
      const sw = screenWidth();
      const lim = columnLimits(sw);
      let w: number;
      if (!lim) w = Math.round(sw);
      else if (op.spec.mode === 'auto') w = columnWidthFor('auto', null) ?? op.spec.widthPx;
      else {
        const want = typeof sitePrefs.column === 'number' ? sitePrefs.column : op.spec.widthPx;
        w = Math.min(lim.maxPx, Math.max(lim.minPx, want));
      }
      if (w !== op.spec.widthPx || Math.abs(zoom - op.spec.zoom) > 0.001) op.setWidth(w, zoom);
    }
    syncOps();
  }

  /**
   * Back to a page kept in the back/forward cache: the navigation reset the tab's per-tab zoom while the page kept
   * WebAble's styles (the page column's zoomed body among them). Put back the zoom WebAble last set.
   */
  const onPageShow = (e: PageTransitionEvent) => {
    if (!e.persisted || stopped || lastTabZoom === null || store.get().showingOriginal) return;
    const want = lastTabZoom;
    void zoomInfo().then(async (zi) => {
      if (Math.abs(zi.tab - want) <= 0.005) return;
      await ask<number>({ type: 'setZoom', factor: want }).catch(() => undefined);
      setZoomState(want);
    });
  };

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  const onResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      if (stopped) return;
      void zoomInfo().then(async (zi) => {
        // The person's own Ctrl +/− while the column is on: Chrome stepped the tab's (column-raised) zoom; take one
        // step along the text sizes instead, so the page column keeps its width and the steps feel like Chrome's.
        if (colMul > 1.001 && lastTabZoom !== null && Math.abs(zi.tab - lastTabZoom) > 0.005 && activeColumn()) {
          const prevText = lastTabZoom / colMul;
          const next = Math.abs(zi.tab - 1) < 0.005 ? 1 : stepZoom(prevText, zi.tab > lastTabZoom ? 1 : -1, !!getFit()?.text.largePrint);
          await setTextZoom(next).catch(() => undefined);
        } else setZoomState(zi.tab);
        reflowColumn();
      });
    }, 160);
  };

  /**
   * Set the tab to `next` zoom as one verified op (replacing WebAble's current zoom op). Its Undo goes back to the
   * person's own zoom. Returns whether it stayed.
   */
  async function changeZoom(next: number, source: LedgerEntry['source'], step: number): Promise<Op | 'own' | null> {
    const fit = getFit();
    const r = read;
    if (!fit || !r) return null;
    const zi = await zoomInfo();
    const base = plan ?? tailor.planZoom(fit, r.pageBodyPx, zi.factor, false, 0);
    const own = base.ownZoom;
    const newPlan: ZoomPlan = { ...base, zoom: next, step, effectiveBodyPx: Math.round(r.pageBodyPx * next * 10) / 10 };
    const superseded = opsList.filter((o) => o.rec.kind === 'page_zoom' && o.active);
    const op = tailor.zoomOp(newPlan, own);
    if (!op) {
      // Back to the person's own zoom.
      for (const o of superseded) {
        await revertOp(o);
        o.rec.status = 'reversed';
      }
      if (Math.abs(zi.factor - own) > 0.005) await setTextZoom(own).catch(() => undefined);
      plan = newPlan;
      syncOps();
      return 'own';
    }
    op.source = source;
    for (const o of superseded) {
      o.active = false; // superseded: the new op restores the person's own zoom on undo
      o.rec.status = 'reversed';
    }
    const kept = await applyBatch([op], r, { quiet: true, wide: true, ignore: ZOOM_IGNORES });
    if (kept.includes(op)) {
      plan = newPlan;
      return op;
    }
    for (const o of superseded) {
      try {
        await o.apply();
        o.rec.status = 'applied';
      } catch (err) {
        addError(plainError(err));
      }
    }
    syncOps();
    return null;
  }

  /** A−/A+: one Chrome zoom preset smaller or larger, verified, remembered for this site. */
  async function adjustText(dir: -1 | 1): Promise<void> {
    const fit = getFit();
    if (!fit || !read || store.get().showingOriginal) return;
    const zi = await zoomInfo();
    const largePrint = !!fit.text.largePrint;
    const next = stepZoom(zi.factor, dir, largePrint);
    if (Math.abs(next - zi.factor) < 0.005) {
      toast(dir > 0 ? 'Text is as large as WebAble makes it' : 'Text is as small as it goes');
      return;
    }
    const ladder = personZoomLadder(largePrint);
    const idx = (z: number) => ladder.findIndex((x) => Math.abs(x - nearestPreset(z)) < 1e-6);
    const step = idx(next) - idx(plan?.fitZoom ?? zi.factor);
    // The text size is the person's own need; the page column follows it. Take the column off first, so the new size
    // is checked on the page as the site lays it out, then hold the page to a column again for the new size.
    const col = activeColumn();
    if (col) {
      await revertOp(col);
      col.rec.status = 'reversed';
      opsList = opsList.filter((o) => o !== col);
      syncOps();
    }
    const res = await changeZoom(next, 'person', step);
    if (!res) {
      toast('That text size did not fit this page, so it stayed as it was');
      if (col) await replaceColumn(true);
      return;
    }
    sitePrefs.textStep = step;
    void saveSitePrefs({ textStep: step });
    store.set({ textStep: step });
    log({
      source: 'person',
      title: `Text ${dir > 0 ? 'larger' : 'smaller'}: page zoom ${pct(next)}`,
      detail: `Body text is ${Math.round(read.pageBodyPx * next)} px here. WebAble remembers this for ${siteKey()}.`,
      action: 'applied',
      ...(res !== 'own' ? { opId: res.rec.id } : {}),
    });
    await replaceColumn(false);
  }

  /** Page width: Narrower, Wider, back to automatic, or full width. Verified, remembered for this site. */
  async function adjustColumn(step: -1 | 0 | 1 | 'off'): Promise<void> {
    if (!read || store.get().showingOriginal) return;
    const cur = activeColumn();
    if (step === 'off') {
      sitePrefs.column = 'off';
      void saveSitePrefs({ column: 'off' });
      if (cur) {
        await revertOp(cur);
        cur.rec.status = 'reversed';
      }
      syncOps();
      log({ source: 'person', title: `Showing ${siteKey()} at full width`, detail: 'Narrower in the WebAble panel brings the column back.', action: 'reversed' });
      return;
    }
    if (step === 0) {
      delete sitePrefs.column;
      delete sitePrefs.columnFailed;
      void saveSitePrefs({ column: undefined, columnFailed: undefined });
      columnWiden = 1;
      await replaceColumn(false);
      if (!activeColumn()) log({ source: 'person', title: 'Page width is automatic: this page stays full width', action: 'kept' });
      return;
    }
    const zoom = textZoomNow();
    const sw = screenWidth();
    const lim = columnLimits(sw);
    if (!lim) {
      toast('This window is too narrow for a narrower page');
      return;
    }
    let target: number | null;
    if (!cur) {
      if (step === 1) {
        toast('The page is already at full width');
        return;
      }
      target = planColumn({ screenW: sw, zoom, charPx: read.body.charPx })?.widthPx ?? lim.maxPx;
      if (target >= lim.maxPx) target = stepColumn(lim.maxPx, -1, sw);
    } else {
      target = stepColumn(cur.spec.widthPx, step, sw);
      if (target === cur.spec.widthPx) {
        toast(step > 0 ? 'This is the widest column; Full width shows the whole page' : 'This is the narrowest the column goes');
        return;
      }
    }
    if (target === null) return;
    if (cur) {
      await revertOp(cur);
      cur.rec.status = 'reversed';
    }
    const res = await tryColumn(read, target, target, 'person');
    if (res.op) {
      if (cur) opsList = opsList.filter((o) => o !== cur);
      sitePrefs.column = target;
      delete sitePrefs.columnFailed;
      void saveSitePrefs({ column: target, columnFailed: undefined });
      log({ source: 'person', title: res.op.title, detail: `WebAble remembers this width for ${siteKey()}.`, action: 'applied', opId: res.op.rec.id });
    } else {
      if (cur) {
        try {
          await cur.apply();
          cur.rec.status = 'applied';
        } catch (err) {
          addError(plainError(err));
        }
      }
      toast('That width did not fit this page, so it stayed as it was');
      log({ source: 'check', title: `Kept the page as it was: a ${target} px column did not fit`, detail: res.fails[0] ?? '', action: 'reversed' });
    }
    syncOps();
  }

  async function boot(kind: 'first' | 'navigation' | 'refit'): Promise<void> {
    const gen = ++generation;
    if (kind === 'first') {
      await waitForVisible();
      await waitForLoad(1500);
      await waitForQuiet(400, 2000);
    }
    if (gen !== generation || stopped) return;
    if (kind === 'first') await askExt<unknown>({ type: 'pageStart' }).catch(() => undefined);
    if (kind !== 'navigation') void refreshHealth();
    const { settings, fit } = await loadSettingsAndFit();
    if (gen !== generation || stopped) return;
    store.set((s) => ({ settings, fit, lens: kind === 'first' ? { on: settings.lens } : s.lens, startedAt: kind === 'navigation' ? performance.now() : s.startedAt }));

    if (!settings.enabled || pausedHere(settings) || !fit) {
      store.set({ phase: 'idle' });
      if (!settings.enabled) log({ source: 'person', title: 'WebAble is turned off', action: 'skipped' });
      else if (pausedHere(settings)) log({ source: 'person', title: 'WebAble is paused on this site', action: 'skipped' });
      else if (!fit) log({ source: 'fit', title: 'No fit yet: run the two-minute fitting to fit pages to you', action: 'skipped' });
      return;
    }

    try {
      store.set({ phase: 'reading' });
      resetBackgroundCache();
      const r = reader.read();
      read = r;
      store.set({ digest: r.digest, outline: r.outline });
      log({
        source: 'fit',
        title: `Read the page: ${r.outline.nodes.length} items in ${Math.max(1, Math.round(r.stats.ms))} ms`,
        detail: `${r.digest.elements.length} of them go to Jev as structure only (role, size, position, redacted labels; no page text).${r.sensitive ? ' This page has password or payment fields, so no generative AI sees it.' : ''}`,
        action: 'kept',
      });

      // 1. Page zoom, verified on its own (zoom carries size; frozen per page view, kept across same-document
      //    navigations). The person's A−/A+ steps on this site are remembered.
      const zi = await zoomInfo();
      if (gen !== generation) return;
      sitePrefs = await loadSitePrefs();
      if (gen !== generation) return;
      setZoomState(zi.tab);
      const existingZoom = opsList.find((o) => o.rec.kind === 'page_zoom' && o.rec.status === 'applied');
      let p: ZoomPlan;
      if (existingZoom && plan) {
        // Keep the zoom already set; recompute what it does for this route's body text.
        p = { ...plan, bodyPx: r.pageBodyPx, effectiveBodyPx: Math.round(r.pageBodyPx * plan.zoom * 10) / 10 };
      } else {
        p = tailor.planZoom(fit, r.pageBodyPx, zi.factor, zi.personChanged, sitePrefs.textStep ?? 0);
      }
      plan = p;
      store.set({ textStep: p.step });
      if (!existingZoom && !undoneKinds.has('page_zoom')) {
        // Try the planned zoom; if a check reverses it (the layout scrolls sideways, say), step down one preset once.
        let tryZoom = p.zoom;
        for (let attempt = 0; attempt < 2 && Math.abs(tryZoom - p.ownZoom) > 0.005; attempt++) {
          const attemptPlan: ZoomPlan = { ...p, zoom: tryZoom, effectiveBodyPx: Math.round(r.pageBodyPx * tryZoom * 10) / 10 };
          const z = tailor.zoomOp(attemptPlan, zi.factor);
          if (!z) break;
          const kept = await applyBatch([z], r, { quiet: true, wide: true, ignore: ZOOM_IGNORES });
          if (gen !== generation) return;
          if (kept.includes(z)) {
            p = attemptPlan;
            break;
          }
          const lower = stepZoom(tryZoom, -1, !!fit.text.largePrint);
          if (!(lower > p.ownZoom + 0.005) || lower >= tryZoom) break;
          tryZoom = lower;
        }
        if (!opsList.some((o) => o.rec.kind === 'page_zoom' && o.active)) {
          p = { ...p, zoom: p.ownZoom, effectiveBodyPx: Math.round(r.pageBodyPx * p.ownZoom * 10) / 10 };
        }
        plan = p;
      }
      if (gen !== generation) return;
      const zoomOp = opsList.find((o) => o.rec.kind === 'page_zoom' && o.active);
      if (zoomOp && kind !== 'navigation') {
        log({ source: zoomOp.source, title: zoomOp.title, detail: `${zoomOp.detail} Body text was measured at ${r.pageBodyPx} px (${r.body.source}).`, action: 'applied', opId: zoomOp.rec.id });
      }
      if (zi.factor > 1.001 && !zoomOp && kind === 'first') {
        log({ source: 'fit', title: `Kept your own zoom (${pct(zi.factor)})`, action: 'kept' });
      }
      if (kind !== 'navigation') noteSizeShortfall(p);

      // 2. The page column (verified; widened in steps when the page does not fit it).
      if (!activeColumn()) await applyColumnFor(r, kind === 'navigation');
      if (gen !== generation) return;

      // 3. Fit ops (planned after zoom and column so boxes are current), one write phase, verified.
      const fitOps = tailor.planFitOps(fit, r, { column: !!activeColumn() }).filter((o) => {
        if (undoneKinds.has(o.rec.kind)) return false;
        // Persistent behaviour ops that are already running stay as they are.
        if (o.persistent && opsList.some((x) => x.rec.kind === o.rec.kind && x.rec.status === 'applied')) return false;
        return true;
      });
      await applyBatch(fitOps, r, { wide: true });
      if (gen !== generation) return;

      // 4. Headings: raise weak ones to the minimum ramp (verified; a heading that does not fit keeps its size).
      if (!undoneKinds.has('heading_scale')) {
        const hs = tailor.headingScaleOp(r, liveBodyPx(r));
        if (hs) await applyBatch([hs], r, { wide: true });
        if (gen !== generation) return;
      }
      watchCarousels(gen, r);
      store.set({ phase: 'tailored' });
      startStruggle();
      watchLateContent();
      overlays.schedule('fitted');

      // 3. Jev reads the page (async; the fit is already applied).
      await understand(gen, r);
    } catch (err) {
      console.warn('[WebAble] boot failed', err);
      addError(`Something went wrong while fitting this page: ${errText(err)}`);
      // Keep the page working: undo everything this run applied.
      for (const op of [...opsList].reverse()) await revertOp(op);
      for (const op of opsList) if (op.rec.status === 'applied') op.rec.status = 'reversed';
      syncOps();
      store.set({ phase: 'error' });
    }
  }

  /* ---------------- Jev understanding and decisions ---------------- */

  async function understand(gen: number, r: ReadResult): Promise<void> {
    if (!r.digest.elements.length) {
      log({ source: 'jev', title: 'Nothing on this page needed a decision', action: 'skipped' });
      return;
    }
    let u: PageUnderstanding;
    try {
      const noCache = await firstReadInSession();
      const res = await ask<PageUnderstanding>(noCache ? { type: 'understand', digest: r.digest, noCache: true } : { type: 'understand', digest: r.digest });
      if (!isUnderstanding(res)) throw new Error('Unexpected answer from Jev');
      u = res;
    } catch (err) {
      if (gen !== generation) return;
      log({ source: 'jev', title: 'Jev could not be reached, so only your fit was applied', detail: plainError(err), action: 'skipped' });
      addError(plainError(err));
      return;
    }
    if (gen !== generation || stopped) return;
    judged = new Set(u.elements.map((e) => e.id));
    jevEls = new Map(r.digest.elements.map((e) => [e.id, e] as const));
    const decisions = decide(u, r.digest, r);
    const m = u.metrics;
    store.set({ understanding: u, decisions, digest: r.digest, phase: store.get().calm.open ? 'calm' : 'understood' });
    if (u.cached) {
      const f = u.firstRead;
      log({
        source: 'jev',
        title: `Jev's read of this page came from the cache: ${m.questions} decisions${f ? ` (first read ${Math.round(f.wallMs)} ms, $${f.costUsd.toFixed(4)})` : ''}`,
        detail: `This page has the same structure as an earlier visit, so no new Jev call was made: this view cost $0.${f ? ` ${f.model || 'jev'} · ${f.calls} call${f.calls === 1 ? '' : 's'} · ${f.inputTokens.toLocaleString()} tokens on the first read.` : ''}`,
        action: 'kept',
      });
    } else {
      log({
        source: 'jev',
        title: `Jev read this page: ${m.questions} decisions in ${(m.wallMs / 1000).toFixed(2)} s ($${m.costUsd.toFixed(4)})`,
        detail: `${m.model || 'jev'} · ${m.calls} call${m.calls === 1 ? '' : 's'}${m.serverMs !== null ? ` · server ${m.serverMs} ms` : ''} · ${m.inputTokens.toLocaleString()} tokens`,
        action: 'kept',
      });
    }
    await applyDecisions(decisions, r, null);
    if (gen !== generation) return;
    overlays.schedule('jev');
    maybeAutoCalm(r, decisions);
    // Overlays that appeared while Jev was answering (cookie banners at 0.8 s, chat panels) get their own read.
    if (pendingLate) {
      pendingLate = false;
      scheduleIncremental();
    }
  }

  /** The latest read's digest, but listing every element Jev has answered for (latest evidence wins). */
  function judgedDigest(latest: PageDigest): PageDigest {
    if (!jevEls.size) return latest;
    const els = new Map(jevEls);
    for (const e of latest.elements) if (els.has(e.id)) els.set(e.id, e);
    for (const e of latest.elements) if (!els.has(e.id)) els.set(e.id, e);
    return { ...latest, elements: [...els.values()].filter((e) => reader.elementFor(e.id)?.isConnected ?? false) };
  }

  function decide(u: PageUnderstanding, digest: PageDigest, r: ReadResult): ElementDecision[] {
    const judgedIds = new Set(u.elements.map((e) => e.id));
    const d: PageDigest = { ...digest, elements: digest.elements.filter((e) => judgedIds.has(e.id)) };
    try {
      return decideElements(u, d, r.local);
    } catch (err) {
      addError(`Decisions could not be made: ${errText(err)}`);
      return [];
    }
  }

  function describe(id: string, j: ElementJudgment | null): { noun: string; name: string } {
    const n = read?.nodes.get(id);
    const name = n?.name ?? '';
    let noun = 'this item';
    if (n) {
      if (n.carousel) noun = 'the moving promo banner';
      else if (n.consent) noun = 'the cookie notice';
      else if (n.iframeKind === 'ad_network' || n.ad) noun = 'the ad';
      else if (n.help && /chat|assistant/i.test(`${n.classWords.join(' ')} ${name}`)) noun = 'the chat panel';
      else if (n.overlay) noun = j?.role === 'popup_overlay' ? 'the popup' : 'the floating panel';
      else if (j?.role === 'recommendations') noun = n.cards ? 'the product cards' : 'the recommendations';
      else if (j?.role === 'advertising') noun = n.kind === 'button' || n.kind === 'link' ? 'the promotion button' : 'the promotion';
      else if (j?.role === 'popup_overlay') noun = 'the popup';
      else if (n.kind === 'button') noun = 'the button';
      else if (n.kind === 'link') noun = 'the link';
      else if (n.kind === 'field' || n.kind === 'select' || n.kind === 'checkbox' || n.kind === 'radio') noun = 'the field';
    }
    return { noun, name };
  }

  function strongProtect(d: ElementDecision): boolean {
    const j = d.judgment;
    if (d.reasons.some((x) => x.includes('(rule)'))) return true;
    if (j.help >= 0.3 || j.task >= 0.3) return true;
    if (!FOLD_ROLES.includes(j.role)) return true;
    const topProtect = Math.max(0, ...PROTECT_ROLE_LIST.map((role) => j.roleProbs[role] ?? 0));
    return topProtect >= 0.3;
  }

  function guardFold(el: Element, protectedEls: Element[]): boolean {
    if (el === document.body || el === document.documentElement || el === read?.mainRoot) return false;
    if (!el.isConnected || safeOurs(el)) return false;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || innerWidth;
    const vh = document.documentElement.clientHeight || innerHeight;
    if (r.width * r.height > 0.7 * vw * Math.max(vh, r.height > vh ? vh : r.height) && r.width > 0.9 * vw && r.height > 0.9 * vh) return false;
    if (document.activeElement && el.contains(document.activeElement) && document.activeElement !== document.body) return false;
    for (const p of protectedEls) if (p !== el && el.contains(p)) return false;
    if (el.querySelector('input:not([type="hidden"]), select, textarea, [contenteditable="true"]')) return false;
    if (el.closest('[data-wa-dim]')) return false;
    return true;
  }

  /**
   * A carousel may be dimmed as a whole even though its own dots and arrows are protected (dimming fades, every
   * control stays usable and comes back on hover or focus), unless it holds help, consent, a field, focus or the
   * main action.
   */
  function guardCarousel(car: Element, r: ReadResult): boolean {
    if (car === document.body || car === document.documentElement || car === r.mainRoot || !car.isConnected || safeOurs(car)) return false;
    const rect = car.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || innerWidth;
    const vh = document.documentElement.clientHeight || innerHeight;
    if (rect.width > 0.9 * vw && rect.height > 0.9 * vh) return false;
    if (document.activeElement && document.activeElement !== document.body && car.contains(document.activeElement)) return false;
    if (car.querySelector('input:not([type="hidden"]), select, textarea, [contenteditable="true"]')) return false;
    if (car.closest('[data-wa-dim]')) return false;
    for (const n of r.nodes.values()) if ((n.help || n.consent) && car.contains(n.el)) return false;
    for (const d of store.get().decisions) {
      if (d.verdict !== 'promote' && d.verdict !== 'keep_popup') continue;
      const el = reader.elementFor(d.id);
      if (el && car.contains(el)) return false;
    }
    return true;
  }

  async function applyDecisions(decisions: ElementDecision[], r: ReadResult, only: Set<string> | null): Promise<void> {
    const fit = getFit();
    if (!fit) return;
    const subset = decisions.filter((d) => (!only || only.has(d.id)) && !decided.has(d.id));
    for (const d of subset) decided.add(d.id);
    // Elements a fold must never cover. A weak protection (an ad whose only protect signal is a small
    // action_button share, like "Schedule now" inside a promo carousel) does not stop its container from being
    // dimmed: dimming fades but keeps every control usable, and it comes back on hover or focus.
    const protectedEls: Element[] = [];
    for (const d of decisions) {
      if (d.verdict === 'promote' || d.verdict === 'keep_popup' || (d.verdict === 'protect' && strongProtect(d))) {
        const el = reader.elementFor(d.id);
        if (el) protectedEls.push(el);
      }
    }
    // Help and consent nodes the reader found are protected too (local rule).
    for (const n of r.nodes.values()) if ((n.help || n.consent) && n.el.isConnected) protectedEls.push(n.el);

    const ops: Op[] = [];
    const foldCands: Array<{ el: Element; title: string; detail: string; p: number; noun: string }> = [];
    let foldsSkipped = 0;
    const protectEntries: Array<Omit<LedgerEntry, 'at'>> = [];
    let protectedQuiet = 0;
    // One ledger line per protected region: skip items inside one already mentioned, and say "cookie notice" once.
    const mentioned: Element[] = [];
    let consentSaid = store.get().ledger.some((e) => e.title === 'Left the cookie notice for you to answer');
    const alreadyMentioned = (el: Element) => mentioned.some((m) => m === el || m.contains(el) || el.contains(m));
    for (const d of subset) {
      const el = reader.elementFor(d.id);
      if (!el) continue;
      const j = d.judgment;
      const { noun, name } = describe(d.id, j);
      const node: NodeInfo | undefined = r.nodes.get(d.id);
      switch (d.verdict) {
        case 'fold': {
          // A floating popup Jev folded is tucked out of the way by the overlay module, not dimmed in place.
          if (overlays.inOverlay(el)) break;
          if (fit.attention.structureLevel < 1 || undoneKinds.has('dim')) {
            foldsSkipped++;
            break;
          }
          // A rotating carousel: dim the whole carousel, not the slide that happened to be showing (the next slide
          // would come in at full colour).
          const carousel = r.carousels.find((c) => c !== el && c.isConnected && c.contains(el));
          const target = carousel && guardCarousel(carousel, r) ? carousel : el;
          if (!guardFold(target, protectedEls)) {
            foldsSkipped++;
            break;
          }
          if (foldCands.some((f) => f.el.contains(target) || target.contains(f.el))) break;
          const foldP = Math.min(1, FOLD_ROLES.reduce((s, role) => s + (j.roleProbs[role] ?? 0), 0) || j.roleP);
          const roleWord = j.role === 'advertising' ? 'advertising' : j.role === 'recommendations' ? 'recommendations' : j.role === 'popup_overlay' ? 'popup' : j.role;
          const label = name && noun !== 'the cookie notice' && target === el ? ` ${quote(name, 6)}` : '';
          const what = target !== el ? 'the moving promo banner' : noun;
          foldCands.push({ el: target, title: `Dimmed ${what}${label} (${roleWord} ${p2(foldP)})`, detail: d.reasons.join('; '), p: foldP, noun: what });
          break;
        }
        case 'promote': {
          if (undoneKinds.has('promote_main') || opsList.some((o) => o.rec.kind === 'promote_main' && o.rec.status === 'applied')) break;
          const mainP = store.get().understanding?.mainPick.p ?? j.main;
          ops.push(tailor.promoteOp(el, r, fit.targets.minPx, `Outlined ${quote(name, 5) || 'the main button'}, the main action (${p2(mainP)})`, mainP));
          break;
        }
        case 'keep_popup':
          // A floating warning: the overlay module says "Kept the session warning in front (task 0.81)".
          if (overlays.inOverlay(el)) break;
          if (alreadyMentioned(el)) break;
          mentioned.push(el);
          protectEntries.push({ source: 'jev', title: `Kept ${noun === 'the popup' ? 'the notice' : noun}${name ? ` ${quote(name, 6)}` : ''} in view (part of the task ${p2(j.task)})`, detail: d.reasons.join('; '), p: j.task, action: 'kept' });
          break;
        case 'protect': {
          if (node?.consent || j.role === 'consent_notice' || r.local.consentIds.includes(d.id)) {
            // Already moved into the cookie bar: that ledger line says it was not answered.
            if (el.closest('[data-wa-ov]')) consentSaid = true;
            if (!consentSaid) {
              consentSaid = true;
              mentioned.push(el);
              protectEntries.push({ source: 'jev', title: 'Left the cookie notice for you to answer', detail: 'WebAble never answers consent notices or removes them.', p: j.roleProbs.consent_notice ?? j.roleP, action: 'protected' });
            }
          } else if (j.help >= 0.5 || j.role === 'help_contact') {
            if (alreadyMentioned(el)) break;
            mentioned.push(el);
            const helpP = Math.max(j.help, j.role === 'help_contact' ? j.roleP : 0);
            protectEntries.push({ source: 'jev', title: `Kept ${quote(name, 6) || 'the help link'} in view (help ${p2(helpP)})`, detail: d.reasons.join('; '), p: helpP, action: 'protected' });
          } else protectedQuiet++;
          break;
        }
        default:
          break;
      }
    }
    // Folds: the four most certain each get their own line and undo; the rest are dimmed together.
    foldCands.sort((a, b) => b.p - a.p);
    for (const f of foldCands.slice(0, 4)) ops.push(tailor.dimOp(f.el, f.title, f.detail, f.p));
    const rest = foldCands.slice(4, 24);
    if (rest.length) {
      const minP = Math.min(...rest.map((f) => f.p));
      const ads = rest.filter((f) => f.noun === 'the ad').length;
      const what = ads === rest.length ? 'ads' : 'ads, promotions and teasers';
      ops.push(tailor.dimOp(rest.map((f) => f.el), `Dimmed ${rest.length} more ${what} (each at least ${p2(minP)})`, rest.map((f) => f.detail).slice(0, 3).join(' | '), minP));
    }
    // Ledger: the notable protections first (help, consent, popups kept), then one summary line.
    for (const e of protectEntries.slice(0, 6)) log(e);
    if (protectedQuiet > 0 && !only) {
      log({ source: 'jev', title: `Protected ${protectedQuiet} more item${protectedQuiet === 1 ? '' : 's'} the task needs (fields, buttons, menus)`, action: 'protected' });
    }
    if (foldsSkipped > 0 && fit.attention.structureLevel < 1 && !only) {
      log({ source: 'jev', title: `Jev found ${foldsSkipped} distraction${foldsSkipped === 1 ? '' : 's'}; your fit leaves them as they are`, action: 'kept' });
    }
    if (ops.length) await applyBatch(ops, r);
  }

  function maybeAutoCalm(r: ReadResult, decisions: ElementDecision[]): void {
    const fit = getFit();
    const s = store.get();
    if (!fit || s.calm.open || s.showingOriginal) return;
    const folded = decisions.filter((d) => d.verdict === 'fold').length;
    const busy = folded >= 3 || r.digest.page.element_count >= 60;
    if (fit.attention.structureLevel === 2 && busy && !undoneKinds.has('calm_view')) {
      void openCalm('auto', `This page is busy (${folded} distraction${folded === 1 ? '' : 's'}, ${r.digest.page.element_count} items), so it opened in Calm view`);
    } else if (busy && fit.attention.structureLevel >= 1) {
      log({ source: 'layout', title: 'A calmer layout of this page is ready: open Calm view', action: 'offered' });
    }
  }

  /** Say honestly whether a moving banner stopped: watch it for 7 s after motion was reduced. */
  function watchCarousels(gen: number, r: ReadResult): void {
    const motion = opsList.find((o) => o.rec.kind === 'motion' && o.active);
    const roots = r.carousels.filter((c) => c.isConnected);
    if (!motion || !roots.length) return;
    let changes = 0;
    const obs = new MutationObserver((recs) => {
      for (const rec of recs) if (!(rec.type === 'attributes' && rec.attributeName?.startsWith('data-wa-'))) changes++;
    });
    for (const root of roots) obs.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'aria-hidden', 'hidden'] });
    setTimeout(() => {
      obs.disconnect();
      if (gen !== generation || stopped || !motion.active) return;
      if (changes > 0) {
        log({ source: 'fit', title: 'The moving banner keeps changing on its own; Calm view folds it away', detail: 'Its own script moves it, and it has no pause button WebAble could press.', action: 'skipped', opId: motion.rec.id });
      } else {
        log({ source: 'fit', title: 'The moving banner stopped', action: 'applied', opId: motion.rec.id });
      }
    }, 7000);
  }

  /* ---------------- late content: cookie banners, chat panels, lazy sections ---------------- */

  function watchLateContent(): void {
    if (mo) return;
    mo = new MutationObserver((records) => {
      for (const rec of records) {
        if (rec.type === 'childList') {
          for (const n of Array.from(rec.addedNodes)) {
            if (n.nodeType === 1 && !safeOurs(n as Element)) pendingAdded.push(n as Element);
          }
        } else if (rec.type === 'attributes') {
          if (rec.attributeName?.startsWith('data-wa-')) continue;
          const t = rec.target as Element;
          if (!safeOurs(t)) pendingChanged.add(t);
        }
      }
      if (pendingAdded.length > 2000) pendingAdded = pendingAdded.slice(-2000);
      if (pendingChanged.size > 600) pendingChanged = new Set([...pendingChanged].slice(-600));
      scheduleFlush();
    });
    mo.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-hidden', 'aria-modal'],
    });
  }

  function scheduleFlush(): void {
    const now = Date.now();
    if (!flushFirstAt) flushFirstAt = now;
    if (flushTimer) clearTimeout(flushTimer);
    const wait = now - flushFirstAt >= 1000 ? 0 : 300;
    flushTimer = setTimeout(flush, wait);
  }

  function flush(): void {
    flushTimer = null;
    flushFirstAt = 0;
    if (stopped) return;
    tailor.sheets.sync();
    const added = pendingAdded.filter((el) => el.isConnected);
    const changed = [...pendingChanged].filter((el) => el.isConnected);
    pendingAdded = [];
    pendingChanged = new Set();
    if (!read || store.get().showingOriginal) return;
    const vw = document.documentElement.clientWidth || innerWidth;
    const vh = document.documentElement.clientHeight || innerHeight;
    const significant = [...added.slice(0, 120), ...changed.slice(0, 120)].some((el) => {
      if (!el.isConnected || safeOurs(el)) return false;
      const known = reader.idFor(el);
      if (known && judged.has(known)) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      const role = el.getAttribute('role');
      if (cs.position === 'fixed' && r.width * r.height >= 0.01 * vw * vh) return true;
      if (role === 'dialog' || role === 'alertdialog' || el.getAttribute('aria-modal') === 'true' || el.tagName === 'DIALOG') return true;
      if (el.tagName === 'IFRAME' && r.width * r.height >= 20000) return true;
      if (r.width * r.height >= 0.15 * vw * vh && el.querySelectorAll('*').length >= 25) return true;
      return false;
    });
    if (significant) scheduleIncremental();
  }

  function scheduleIncremental(): void {
    if (incrementalTimer || incrementalRounds >= 8) return;
    const wait = Math.max(0, 2000 - (Date.now() - lastIncrementalAt));
    incrementalTimer = setTimeout(() => {
      incrementalTimer = null;
      void incremental(generation);
    }, wait + 250);
  }

  async function incremental(gen: number): Promise<void> {
    if (stopped || gen !== generation || !read) return;
    const phase = store.get().phase;
    if (phase === 'reading' || phase === 'idle' || phase === 'error') return;
    incrementalRounds++;
    lastIncrementalAt = Date.now();
    const r = reader.read();
    read = r;
    store.set({ digest: judgedDigest(r.digest), outline: r.outline });
    refreshCalmSpec();
    const u0 = store.get().understanding;
    if (!u0) {
      // Jev has not answered yet (or is unavailable): read again when the first answer lands.
      pendingLate = true;
      incrementalRounds--;
      return;
    }
    const fresh = r.digest.elements.filter((e) => !judged.has(e.id)).slice(0, 40);
    if (!fresh.length) return;
    const partial: PageDigest = { ...r.digest, elements: fresh, mainCandidates: [] };
    let u: PageUnderstanding;
    try {
      const res = await ask<PageUnderstanding>({ type: 'understand', digest: partial });
      if (!isUnderstanding(res)) return;
      u = res;
    } catch (err) {
      addError(plainError(err));
      return;
    }
    if (gen !== generation || stopped) return;
    for (const e of u.elements) judged.add(e.id);
    for (const e of fresh) jevEls.set(e.id, e);
    const latest = store.get().understanding ?? u0;
    const merged: PageUnderstanding = {
      elements: [...latest.elements.filter((e) => !u.elements.some((x) => x.id === e.id)), ...u.elements],
      mainPick: latest.mainPick,
      metrics: addMetrics(latest.metrics, u.metrics),
      // The page read stays "from cache" when it was; later reads of new items add their own cost to this view.
      cached: latest.cached,
      ...(latest.firstRead ? { firstRead: latest.firstRead } : {}),
    };
    const union = judgedDigest(r.digest);
    const decisions = decide(merged, union, r);
    store.set({ understanding: merged, decisions, digest: union });
    log({
      source: 'jev',
      title: `Jev read ${u.elements.length} new item${u.elements.length === 1 ? '' : 's'} on the page (${u.cached ? 'from the cache' : `${(u.metrics.wallMs / 1000).toFixed(2)} s`})`,
      detail: `${u.metrics.questions} more decisions`,
      action: 'kept',
    });
    await applyDecisions(decisions, r, new Set(u.elements.map((e) => e.id)));
    overlays.schedule('jev');
  }

  /* ---------------- struggle signals ---------------- */

  function startStruggle(): void {
    if (stopSignals) return;
    const host: SignalsHost = {
      elementFor: (id) => reader.elementFor(id),
      fit: () => store.get().fit,
      pageKind: () => read?.pageKind ?? 'web page',
      onJudgment: (j, waiting, offers) => onJudgment(j, waiting, offers),
      ask: <T,>(req: BgRequest) => ask<T>(req),
      isOurUi: safeOurs,
    };
    try {
      stopSignals = startSignals({ api: host });
    } catch (err) {
      addError(`Struggle signals could not start: ${errText(err)}`);
    }
  }

  function onJudgment(j: StruggleJudgment, waiting: StruggleKind[], offers: Offer[]): void {
    const s = store.get();
    const now = Date.now();
    // Offer choice against the fit: "Make buttons bigger" is pointless when the fit's targets already meet the need.
    const folded = s.decisions.filter((d) => d.verdict === 'fold').length;
    const pageFacts = {
      targetsApplied: opsList.some((o) => o.rec.kind === 'targets' && o.active),
      busy: folded >= 2 || (s.digest?.page.element_count ?? 0) >= 40,
      calmOpen: s.calm.open,
    };
    const fitted: Offer[] = [];
    for (const o of offers) {
      let next: Offer | null = o;
      try {
        next = chooseOfferForFit(o, s.fit, pageFacts);
      } catch {
        next = o;
      }
      if (next) fitted.push(next);
      else log({ source: 'signals', title: 'Did not offer bigger buttons: your fit already makes them large here', detail: o.why, p: o.p, action: 'skipped' });
    }
    const usable = fitted.filter((o) => (dismissedOffers.get(o.kind) ?? 0) <= now);
    const current = s.struggle.offers[0];
    const keep = current && usable.some((o) => o.kind === current.kind) ? current : usable[0];
    const shown = keep ? [keep] : current ? [current] : [];
    if (keep && (!current || current.kind !== keep.kind)) {
      log({ source: 'signals', title: `Offered: ${keep.question}`, detail: `${keep.fact} ${keep.why}`.trim(), p: keep.p, action: 'offered' });
    }
    const prevWaiting = s.struggle.waiting.join(',');
    if (waiting.length && waiting.join(',') !== prevWaiting) {
      const parts = waiting.map((k) => `${k} ${p2(j.kinds[k] ?? 0)}`);
      log({ source: 'signals', title: `Watching, not acting yet: ${parts.join(', ')}`, detail: 'Jev is unsure (0.50–0.75), so nothing changes until a second window agrees.', action: 'waiting' });
    }
    store.set({
      struggle: { latest: j, history: [...s.struggle.history, j].slice(-30), waiting, offers: shown },
    });
  }

  /* ---------------- offers ---------------- */

  async function acceptOffer(kind: OfferKind): Promise<void> {
    const s = store.get();
    const offer = s.struggle.offers.find((o) => o.kind === kind);
    store.set({ struggle: { ...s.struggle, offers: s.struggle.offers.filter((o) => o.kind !== kind) } });
    try {
      noteOfferOutcome(kind, 'accepted');
    } catch {
      /* signals not running */
    }
    log({ source: 'person', title: `You accepted: ${offer?.question ?? kind}`, action: 'applied' });
    const fit = getFit();
    const r = read;
    let op: Op | null = null;
    // Ops the new one replaces; they come back if the new one does not pass the checks.
    let superseded: Op[] = [];
    switch (kind) {
      case 'bigger_targets': {
        const current = Math.max(fit?.targets.minPx ?? 0, 0);
        const ladder = [44, 56, 72, 96];
        const T = ladder.find((x) => x > current) ?? 96;
        if (r) {
          superseded = opsList.filter((o) => o.rec.kind === 'targets' && o.active);
          for (const o of superseded) {
            await revertOp(o);
            o.rec.status = 'reversed';
          }
          op = tailor.targetsOp(T, r, 'signals');
        }
        break;
      }
      case 'steady_clicks':
        if (!opsList.some((o) => o.rec.kind === 'steady_clicks' && o.active)) {
          op = tailor.steadyOp(fit?.clicks.steady.windowMs ?? 300, fit?.clicks.steady.radiusPx ?? 10);
          op.source = 'signals';
        }
        break;
      case 'debounce':
        if (!opsList.some((o) => o.rec.kind === 'debounce' && o.active)) {
          op = tailor.debounceOp();
          op.source = 'signals';
        }
        break;
      case 'larger_text': {
        const zi = await zoomInfo();
        const next = stepZoom(zi.factor, 1, !!fit?.text.largePrint);
        if (next > zi.factor + 0.005 && read) {
          const res = await changeZoom(next, 'signals', plan?.step ?? 0);
          if (res && res !== 'own') {
            opOffer.set(res.rec.id, kind);
            res.title = `Zoomed this page to ${pct(next)} (was ${pct(zi.factor)})`;
            log({ source: 'signals', title: res.title, detail: res.detail, action: 'applied', opId: res.rec.id });
            toast(`${OFFER_TOAST[kind]} (${pct(next)})`, res.rec.id);
            await replaceColumn(false);
          } else toast('That change did not fit this page, so it was undone');
        } else {
          toast('Text is already as large as WebAble makes it');
        }
        return;
      }
      case 'calm_view':
        await openCalm('person');
        return;
      case 'main_actions': {
        const mainId = store.get().decisions.find((d) => d.verdict === 'promote')?.id ?? store.get().understanding?.mainPick.id;
        const el = mainId && mainId !== 'none' ? reader.elementFor(mainId) : null;
        if (el && !opsList.some((o) => o.rec.kind === 'promote_main' && o.active)) {
          const name = read?.nodes.get(mainId ?? '')?.name ?? '';
          op = tailor.promoteOp(el, r, fit?.targets.minPx ?? 44, `Outlined ${quote(name, 5) || 'the main button'}, the main action`, store.get().understanding?.mainPick.p ?? 0);
          op.source = 'signals';
        } else if (r) {
          op = tailor.targetsOp(Math.max(56, fit?.targets.minPx ?? 0), r, 'signals');
        }
        break;
      }
      case 'explain':
        explainDensest();
        return;
      case 'explain_field':
        explainField();
        return;
      default:
        break;
    }
    if (!op) {
      for (const o of superseded) {
        try {
          await o.apply();
          o.rec.status = 'applied';
        } catch (err) {
          addError(plainError(err));
        }
      }
      syncOps();
      return;
    }
    opOffer.set(op.rec.id, kind);
    const kept = await applyBatch([op], r);
    if (kept.includes(op) && op.rec.kind === 'targets') tailor.flashTargets(op.elements, 800);
    if (kept.includes(op)) {
      toast(OFFER_TOAST[kind], op.rec.id);
    } else {
      // The new change did not pass the checks: put back what it replaced.
      for (const o of superseded) {
        try {
          await o.apply();
          o.rec.status = 'applied';
        } catch (err) {
          addError(plainError(err));
        }
      }
      syncOps();
      toast('That change did not fit this page, so it was undone');
    }
  }

  function dismissOffer(kind: OfferKind, forever: boolean): void {
    const s = store.get();
    store.set({ struggle: { ...s.struggle, offers: s.struggle.offers.filter((o) => o.kind !== kind) } });
    dismissedOffers.set(kind, forever ? Number.MAX_SAFE_INTEGER : Date.now() + 30 * 60 * 1000);
    try {
      noteOfferOutcome(kind, forever ? 'never' : 'not_now');
    } catch {
      /* signals not running */
    }
    log({ source: 'person', title: forever ? 'You turned off this suggestion' : 'Not now: WebAble will not ask again for a while', action: 'skipped' });
  }

  /* ---------------- explain ---------------- */

  function normAnchor(a: { x: number; y: number; w?: number; h?: number; width?: number; height?: number }): { x: number; y: number; w: number; h: number } {
    return { x: a.x, y: a.y, w: a.w ?? a.width ?? 0, h: a.h ?? a.height ?? 0 };
  }

  async function explainSelection(text: string, anchor: { x: number; y: number; w: number; h: number }): Promise<void> {
    const seq = ++explainSeq;
    const a = normAnchor(anchor);
    const s = store.get();
    if (!s.settings.explain) {
      store.set({ explain: { open: true, loading: false, anchor: a, original: text, result: null, error: 'Explain is turned off in WebAble settings.' } });
      return;
    }
    store.set({ explain: { open: true, loading: true, anchor: a, original: text, result: null, error: null } });
    const sensitive = !!(read?.sensitive || read?.privatePage);
    try {
      const res = await requestExplain(text, read?.pageKind ?? 'web page', sensitive);
      if (seq !== explainSeq) return;
      store.set({ explain: { open: true, loading: false, anchor: a, original: text, result: res, error: res.ok ? null : 'The explanation did not pass its checks, so the original text is shown.' } });
      const flagged = res.showOriginalInstead.length;
      log({
        source: 'explain',
        title: res.ok ? `Explained a passage in plain words${flagged ? `; ${flagged} sentence${flagged === 1 ? '' : 's'} kept as written` : ''}` : 'The explanation did not pass its checks; the original text is shown',
        detail: `Numbers kept: ${res.checks.numbersKept ? 'yes' : 'no'} · conditions kept: ${res.checks.conditionWordsKept ? 'yes' : 'no'} · Jev: added a fact ${p2(res.checks.addedFact)}, dropped a fact ${p2(res.checks.droppedFact)}`,
        action: res.ok ? 'applied' : 'skipped',
      });
    } catch (err) {
      if (seq !== explainSeq) return;
      const msg = err instanceof Error && err.name === 'ExplainError' ? err.message : plainError(err);
      store.set({ explain: { open: true, loading: false, anchor: a, original: text, result: null, error: msg } });
    }
  }

  function explainDensest(): void {
    const vh = document.documentElement.clientHeight || innerHeight;
    let best: { el: Element; chars: number } | null = null;
    for (const t of read?.texts ?? []) {
      if (!t.running || t.chars < 120 || !t.el.isConnected) continue;
      const r = t.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      const chars = collapse(t.el.textContent ?? '').length;
      if (!best || chars > best.chars) best = { el: t.el, chars };
    }
    if (!best) {
      toast('There is no long text in view to explain');
      return;
    }
    const r = best.el.getBoundingClientRect();
    void explainSelection(collapse(best.el.textContent ?? '').slice(0, 2000), { x: r.left, y: r.top, w: r.width, h: r.height });
  }

  function explainField(): void {
    const el = document.activeElement;
    if (!el || el === document.body) {
      toast('Click into a field first, then ask again');
      return;
    }
    const parts: string[] = [];
    const labels = (el as HTMLInputElement).labels;
    if (labels) for (const l of Array.from(labels)) parts.push(collapse(l.textContent ?? ''));
    for (const id of (el.getAttribute('aria-describedby') ?? '').split(/\s+/)) {
      const d = id ? document.getElementById(id) : null;
      if (d) parts.push(collapse(d.textContent ?? ''));
    }
    const text = parts.filter(Boolean).join('. ');
    if (text.split(' ').length < 3) {
      toast('This field has too little text to explain');
      return;
    }
    const r = el.getBoundingClientRect();
    void explainSelection(text, { x: r.left, y: r.top, w: r.width, h: r.height });
  }

  /* ---------------- Calm view ---------------- */

  /**
   * Roles for the layout: Jev's role per element, except that an element Jev judged mostly help (help >= 0.5)
   * is laid out as help, so it lands in the open Help section instead of a drawer.
   */
  function rolesNow(): Record<string, Role> {
    const out: Record<string, Role> = {};
    for (const e of store.get().understanding?.elements ?? []) out[e.id] = e.role;
    for (const d of store.get().decisions) {
      if (d.verdict !== 'fold' && d.judgment.help >= 0.5 && d.judgment.role !== 'consent_notice') out[d.id] = 'help_contact';
    }
    return out;
  }

  /**
   * Outline nodes the layout must keep in view. Jev's "protect" verdict only means "never dim this"; for layout,
   * an element whose own role is a distraction (an ad's "Schedule now" link) or that sits inside something Jev
   * folded (a promo carousel's slide buttons) goes with its container, unless it is help, consent, a rule-based
   * protection (focus, required, typed value) or the main action.
   */
  function enrichOutline(outline: PageOutline): PageOutline {
    const u = store.get().understanding;
    const decisions = store.get().decisions;
    const role = new Map<string, Role>(Object.entries(rolesNow()));
    for (const e of u?.elements ?? []) if (!role.has(e.id)) role.set(e.id, e.role);
    const parent = new Map(outline.nodes.map((n) => [n.id, n.parent ?? null] as const));
    const folded = new Set(decisions.filter((d) => d.verdict === 'fold').map((d) => d.id));
    const underFold = (id: string): boolean => {
      let p = parent.get(id) ?? null;
      for (let i = 0; p && i < 40; i++) {
        if (folded.has(p)) return true;
        p = parent.get(p) ?? null;
      }
      return false;
    };
    const prot = new Set<string>();
    for (const d of decisions) {
      const j = d.judgment;
      if (d.verdict === 'promote' || d.verdict === 'keep_popup') prot.add(d.id);
      else if (d.verdict !== 'protect') continue;
      else if (d.reasons.some((x) => x.includes('(rule)')) || j.help >= 0.3 || j.role === 'consent_notice') prot.add(d.id);
      else if (!FOLD_ROLES.includes(j.role) && !underFold(d.id)) prot.add(d.id);
    }
    const nodes: OutlineNode[] = outline.nodes.map((n) => {
      const out: OutlineNode = { ...n };
      const r = role.get(n.id);
      if (r) out.jevRole = r;
      if (prot.has(n.id)) out.protected = true;
      return out;
    });
    return { ...outline, nodes };
  }

  function buildHeuristic(outline: PageOutline, summary: FitSummaryForModel, roles: Record<string, Role>): FitSpec {
    let spec: FitSpec;
    try {
      spec = heuristicSpec(outline, roles, summary);
    } catch (err) {
      addError(`The simple layout could not be built: ${errText(err)}`);
      spec = fallbackSpec(outline);
    }
    try {
      spec = repairSpec(spec, outline).spec;
    } catch {
      /* keep as is */
    }
    return alignPrimary(completeSpec(spec, outline).spec);
  }

  /**
   * The Calm view's big blue action is the one Jev named (promote: main pick >= 0.90 and checks passed). A layout's
   * own guess ("Save to list" on an article) is not dressed up as the page's main action when Jev was not sure.
   */
  function alignPrimary(spec: FitSpec): FitSpec {
    const s = store.get();
    if (!s.understanding) return spec;
    const promoted = s.decisions.find((d) => d.verdict === 'promote');
    if (!promoted) return spec.primary_action === null ? spec : { ...spec, primary_action: null };
    if (spec.primary_action === promoted.id) return spec;
    const pe = reader.elementFor(promoted.id);
    const cur = spec.primary_action ? reader.elementFor(spec.primary_action) : null;
    if (pe && cur && (pe.contains(cur) || cur.contains(pe))) return spec;
    const listed = spec.sections.some((sec) => sec.nodes.includes(promoted.id)) || (read?.outline.nodes.some((n) => n.id === promoted.id) ?? false);
    return listed ? { ...spec, primary_action: promoted.id } : spec;
  }

  async function suspendZoom(): Promise<void> {
    const z = opsList.find((o) => o.rec.kind === 'page_zoom' && o.active);
    if (!z || !plan || zoomSuspended) return;
    zoomSuspended = true;
    try {
      await setTextZoom(plan.ownZoom);
    } catch {
      zoomSuspended = false;
    }
  }

  async function resumeZoom(): Promise<void> {
    if (!zoomSuspended) return;
    zoomSuspended = false;
    const z = opsList.find((o) => o.rec.kind === 'page_zoom' && o.active);
    if (!z || !plan || store.get().showingOriginal) return;
    try {
      await setTextZoom(plan.zoom);
    } catch {
      /* stays at own zoom */
    }
  }

  const onEngage = (e: Event) => {
    if (!store.get().calm.open) return;
    if (e.type === 'wheel' || e.type === 'pointerdown' || e.type === 'keydown' || e.type === 'touchstart') calmEngaged = true;
  };

  async function openCalm(by: 'auto' | 'person' = 'person', why?: string): Promise<void> {
    const s = store.get();
    if (s.calm.open) return;
    if (s.showingOriginal) showOriginal(false);
    const fit = s.fit;
    if (!read) {
      read = reader.read();
      store.set({ digest: read.digest, outline: read.outline });
    }
    const r = read;
    const gen = ++calmGen;
    let summary: FitSummaryForModel;
    try {
      summary = summarizeFitForModel(fit ?? fallbackFitLike());
    } catch {
      summary = fallbackSummary(fit ?? fallbackFitLike());
    }
    const roles = rolesNow();
    const outline = enrichOutline(r.outline);
    const spec = buildHeuristic(outline, summary, roles);
    heuristicSpecCache = spec;
    const cov = calmCoverage(spec, outline);
    const key = `${location.pathname}|${outlineSignature(r.outline)}`;
    const cached = redesignCache.get(key) ?? (await readCachedRedesign(key));
    const wantAi = s.settings.aiLayouts && !r.sensitive && !r.privatePage && outline.nodes.length > 0;
    await suspendZoom();
    calmOpenedAt = performance.now();
    calmEngaged = false;
    calmWasOpen = false;
    pendingAi = null;
    window.addEventListener('wheel', onEngage, { capture: true, passive: true });
    window.addEventListener('pointerdown', onEngage, { capture: true, passive: true });
    window.addEventListener('keydown', onEngage, { capture: true, passive: true });
    window.addEventListener('touchstart', onEngage, { capture: true, passive: true });

    let first = spec;
    let source: EngineState['calm']['source'] = 'heuristic';
    if (cached && wantAi) {
      const chosen = cached.candidates.find((c) => c.name === cached.chosen);
      if (chosen && cached.chosen !== 'heuristic' && cached.autoApply) {
        first = finishAiSpec(chosen.spec, outline);
        source = 'cached';
      }
    }
    store.set((st) => ({
      phase: 'calm',
      calm: { open: true, loading: wantAi && !cached, spec: first, source, aiReady: false, redesign: cached ?? st.calm.redesign, visual: null },
    }));
    overlays.setHidden(true);
    log({
      source: by === 'auto' ? 'layout' : 'person',
      title: why ?? (source === 'cached' ? 'Opened Calm view with the layout Jev picked last time' : 'Opened Calm view'),
      detail: `Every item on the page is in this view (${Math.round(cov.coverage * 100)}% placed${cov.missing.length ? `, ${cov.missing.length} added to “More on this page”` : ''}). Every control still drives the original page.`,
      action: 'applied',
    });
    store.set((st) => ({ checks: [...st.checks, { name: 'content_loss' as const, pass: cov.coverage >= 1 || cov.missing.length === 0, detail: `Calm view places ${outline.nodes.length - cov.missing.length} of ${outline.nodes.length} items; the rest are in “More on this page”` }].slice(-80) }));
    if (!r.sensitive && !r.privatePage && !s.settings.aiLayouts) {
      log({ source: 'layout', title: 'AI layouts are off in settings, so this is the simple layout', action: 'skipped' });
    } else if (r.sensitive) {
      log({ source: 'layout', title: 'This page has password or payment fields, so no AI sees it; this is the simple layout', action: 'skipped' });
    }
    if (wantAi && !cached) void requestAi(gen, outline, summary, roles, key);
  }

  function fallbackFitLike(): FitProfile {
    return {
      v: 'fit.1', createdAt: new Date().toISOString(), inputClass: 'mouse',
      text: { bodyPx: 16, cpsPx: null, largePrint: false, conf: 0, source: 'default', override: null },
      contrast: { band: 'N', floor: 4.5 }, polarity: { value: 'light', stated: null }, weight: { floor: 400 },
      spacing: { lineHeight: 1.4, wordEm: 0, letterEm: 0 }, measure: { targetCpl: 66, maxCpl: 80, minCpl: 45 },
      targets: { minPx: null, conf: 0 }, clicks: { steady: { on: false, windowMs: 300, radiusPx: 10 }, debounce: false },
      attention: { motion: { p: 0, on: false }, clutter: { p: 0 }, structureLevel: 1 },
      baselines: { searchSecMedian: null, slipRate: 0, repeatRate: 0, missRate: 0 },
      calibration: { version: 'default', durationSec: 0, skipped: [] },
    };
  }

  function finishAiSpec(spec: FitSpec, outline: PageOutline): FitSpec {
    let out = spec;
    try {
      out = repairSpec(spec, outline).spec;
    } catch {
      /* the server repaired it already */
    }
    return alignPrimary(completeSpec(out, outline).spec);
  }

  async function readCachedRedesign(key: string): Promise<RedesignResult | undefined> {
    try {
      const k = `calm:${hashString(key)}`;
      const got = await chrome.storage.session.get(k);
      const v = got[k] as { at: number; res: RedesignResult } | undefined;
      if (v && Date.now() - v.at < 30 * 60 * 1000) {
        redesignCache.set(key, v.res);
        return v.res;
      }
    } catch {
      /* session storage not available to content scripts */
    }
    return undefined;
  }

  function writeCachedRedesign(key: string, res: RedesignResult): void {
    redesignCache.set(key, res);
    try {
      void chrome.storage.session.set({ [`calm:${hashString(key)}`]: { at: Date.now(), res } }).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }

  async function requestAi(gen: number, outline: PageOutline, summary: FitSummaryForModel, roles: Record<string, Role>, key: string): Promise<void> {
    const t0 = performance.now();
    let res: RedesignResult;
    try {
      res = await ask<RedesignResult>({ type: 'redesign', outline, fit: summary, roles });
      if (!res || !Array.isArray(res.candidates)) throw new Error('Unexpected answer');
    } catch (err) {
      if (gen !== calmGen) return;
      store.set((s) => ({ calm: { ...s.calm, loading: false } }));
      log({ source: 'layout', title: 'No other layout was available, so this is the simple layout', detail: plainError(err), action: 'skipped' });
      return;
    }
    writeCachedRedesign(key, res);
    if (gen !== calmGen || !store.get().calm.open) return;
    const chosen = res.candidates.find((c) => c.name === res.chosen);
    store.set((s) => ({ calm: { ...s.calm, loading: false, redesign: res } }));
    const ms = Math.round(performance.now() - t0);
    if (!chosen || res.chosen === 'heuristic') {
      const best = [...res.candidates].filter((c) => candidateSource(c) !== 'heuristic').sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0))[0];
      const bestWord = best && candidateSource(best) === 'ai' ? 'AI layout' : 'other layout';
      log({
        source: 'layout',
        title: `Jev kept the simple layout: no ${res.ai === 'on' ? 'other' : 'local'} layout was clearly easier`,
        detail: best ? `Best ${bestWord} (${best.name}): ${Math.round((best.pEasier ?? 0) * 100)}% likely easier, ${Math.round((best.pHides ?? 0) * 100)}% chance something needed is folded` : undefined,
        action: 'kept',
      });
      return;
    }
    const spec = finishAiSpec(chosen.spec, outline);
    pendingAi = { spec, result: res };
    const easier = Math.round((chosen.pEasier ?? 0) * 100);
    const hides = Math.round((chosen.pHides ?? 0) * 100);
    const inWindow = performance.now() - calmOpenedAt <= 8000;
    if (res.autoApply && !calmEngaged && inWindow) {
      await swapToAi('auto', `${easier}% likely easier, ${hides}% chance something needed is folded`, ms);
    } else {
      store.set((s) => ({ calm: { ...s.calm, aiReady: true } }));
      log({
        source: 'layout',
        title: `A layout picked by Jev is ready (${easier}% likely easier)`,
        detail: res.autoApply ? 'You were already using the page, so it waits until you choose it.' : `Jev was not sure enough to switch on its own (${hides}% chance something needed is folded).`,
        p: chosen.pEasier,
        action: 'offered',
      });
    }
  }

  function visualFacts(): { controls: string[]; help: string[]; mainLabel: string | null } {
    const digest = store.get().digest;
    const decisions = store.get().decisions;
    const byId = new Map((digest?.elements ?? []).map((e) => [e.id, e] as const));
    const controls = (digest?.elements ?? [])
      .filter((e) => ['input', 'select', 'textarea', 'fieldset'].includes(e.tag) || /checkbox|radio|textbox|combobox|radiogroup/.test(e.role_hint))
      .map((e) => e.label)
      .filter(Boolean)
      .slice(0, 12);
    const help = decisions
      .filter((d) => d.judgment.role === 'help_contact' || d.judgment.help >= 0.5)
      .map((d) => byId.get(d.id)?.label ?? '')
      .filter(Boolean)
      .slice(0, 6);
    const mainId = decisions.find((d) => d.verdict === 'promote')?.id ?? null;
    return { controls, help, mainLabel: mainId ? byId.get(mainId)?.label ?? null : null };
  }

  async function swapToAi(by: 'auto' | 'person', why: string, ms?: number): Promise<void> {
    const pending = pendingAi;
    if (!pending || !store.get().calm.open) return;
    const gen = calmGen;
    // Two Calm layouts show different parts of the page on the first screen by design (a stepper keeps later
    // fields in later steps), so "is every control from before still shown" is not a fair question here; the
    // DOM coverage check already proves every item is placed. Jev checks for cut-off or faint text and the main button.
    const facts = { ...visualFacts(), controls: [] as string[], help: [] as string[] };
    let haveBefore = false;
    try {
      await ask<unknown>({ type: 'visualVerify', ...facts, phase: 'before' });
      haveBefore = true;
    } catch {
      haveBefore = false;
    }
    if (gen !== calmGen || !store.get().calm.open) return;
    pendingAi = null;
    store.set((s) => ({ calm: { ...s.calm, spec: pending.spec, source: 'ai', aiReady: false } }));
    log({
      source: by === 'auto' ? 'layout' : 'person',
      title: by === 'auto' ? 'Switched to the layout Jev picked for your fit' : 'You chose the layout Jev picked',
      detail: `${why}${ms ? ` · ${(ms / 1000).toFixed(1)} s` : ''}`,
      action: 'applied',
    });
    if (!haveBefore) return;
    await settle();
    await sleep(400);
    if (gen !== calmGen || !store.get().calm.open) return;
    let verdict: VisualVerdict;
    try {
      verdict = await ask<VisualVerdict>({ type: 'visualVerify', ...facts, phase: 'after' });
      if (!verdict || typeof verdict.rollback !== 'boolean') return;
    } catch (err) {
      log({ source: 'check', title: 'The screenshot check was not available', detail: plainError(err), action: 'skipped' });
      return;
    }
    if (gen !== calmGen) return;
    store.set((s) => ({ calm: { ...s.calm, visual: verdict } }));
    const reasons: string[] = [];
    if (verdict.clipped >= 0.7) reasons.push(`text cut off ${p2(verdict.clipped)}`);
    if (verdict.faint >= 0.7) reasons.push(`faint text ${p2(verdict.faint)}`);
    if (verdict.keepsControls <= 0.3) reasons.push(`a form control missing ${p2(1 - verdict.keepsControls)}`);
    if (verdict.keepsHelp <= 0.3) reasons.push(`a help link missing ${p2(1 - verdict.keepsHelp)}`);
    const result: CheckResult = verdict.rollback
      ? { name: 'visual', pass: false, detail: `Jev compared screenshots: ${reasons.join(', ') || 'a problem'}` }
      : { name: 'visual', pass: true, detail: `Jev compared screenshots: nothing cut off ${p2(1 - verdict.clipped)}, text readable ${p2(1 - verdict.faint)}${verdict.mainVisible !== null ? `, main button visible ${p2(verdict.mainVisible)}` : ''}` };
    store.set((s) => ({ checks: [...s.checks, result].slice(-80) }));
    if (verdict.rollback && heuristicSpecCache) {
      store.set((s) => ({ calm: { ...s.calm, spec: heuristicSpecCache, source: 'heuristic' } }));
      log({ source: 'check', title: `Reversed the new layout: Jev's screenshot check saw ${reasons[0] ?? 'a problem'}`, detail: result.detail, action: 'reversed' });
      toast('Went back to the simple layout: the screenshot check found a problem');
    } else {
      log({ source: 'check', title: 'Jev checked the new layout against a screenshot: no text cut off or too faint', detail: result.detail, action: 'kept' });
    }
  }

  function refreshCalmSpec(): void {
    const s = store.get();
    if (!s.calm.open || !s.calm.spec || !read) return;
    const outline = enrichOutline(read.outline);
    let spec = s.calm.spec;
    try {
      spec = repairSpec(spec, outline).spec;
    } catch {
      /* keep */
    }
    const done = completeSpec(spec, outline);
    const next = alignPrimary(done.spec);
    if (done.added || next !== s.calm.spec) store.set({ calm: { ...s.calm, spec: next } });
    if (heuristicSpecCache) heuristicSpecCache = alignPrimary(completeSpec(heuristicSpecCache, outline).spec);
  }

  function closeCalm(): void {
    const s = store.get();
    if (!s.calm.open) return;
    calmGen++;
    pendingAi = null;
    window.removeEventListener('wheel', onEngage, { capture: true });
    window.removeEventListener('pointerdown', onEngage, { capture: true });
    window.removeEventListener('keydown', onEngage, { capture: true });
    window.removeEventListener('touchstart', onEngage, { capture: true });
    store.set({
      calm: { ...s.calm, open: false, loading: false, aiReady: false },
      phase: s.understanding ? 'understood' : s.phase === 'calm' ? 'tailored' : s.phase,
    });
    log({ source: 'person', title: 'Closed Calm view', action: 'kept' });
    overlays.setHidden(store.get().showingOriginal);
    void resumeZoom().then(() => overlays.schedule('calm-closed'));
  }

  /* ---------------- original page, undo ---------------- */

  function showOriginal(on: boolean): void {
    const s = store.get();
    if (on === s.showingOriginal) return;
    if (on) {
      calmWasOpen = s.calm.open;
      if (s.calm.open) closeCalm();
      store.set({ showingOriginal: true });
      overlays.setHidden(true);
      void (async () => {
        for (const op of [...opsList].reverse()) {
          if (op.active) await revertOp(op);
        }
        zoomSuspended = false;
      })();
      log({ source: 'person', title: 'Showing the original page', action: 'kept' });
    } else {
      store.set({ showingOriginal: false });
      void (async () => {
        for (const op of opsList) {
          if (op.rec.status === 'applied' && !op.active) {
            try {
              await op.apply();
            } catch (err) {
              addError(plainError(err));
            }
          }
        }
        overlays.setHidden(store.get().calm.open);
        overlays.schedule('original-off');
        if (calmWasOpen) {
          calmWasOpen = false;
          await openCalm('person', 'Back to your fitted page in Calm view');
        }
      })();
      log({ source: 'person', title: 'Back to your fitted page', action: 'applied' });
    }
  }

  function undoOp(opId: string): void {
    const op = opsList.find((o) => o.rec.id === opId);
    store.set((s) => ({ toasts: s.toasts.filter((t) => t.undoOpId !== opId) }));
    if (!op || op.rec.status !== 'applied') return;
    // Moved overlays: the overlay module brings them back and remembers "leave" for this site and kind.
    if (op.rec.kind === 'unobstruct' && overlays.undo(opId)) return;
    void (async () => {
      await revertOp(op);
      op.rec.status = 'reversed';
      undoneKinds.add(op.rec.kind);
      // Without WebAble's zoom the automatic column has no reason to stay.
      if (op.rec.kind === 'page_zoom' && activeColumn()?.spec.mode === 'auto') await replaceColumn(true);
      syncOps();
      const offer = opOffer.get(opId);
      if (offer) {
        try {
          noteOfferOutcome(offer, 'undone');
        } catch {
          /* signals not running */
        }
      }
    })();
    log({ source: 'person', title: `Undid: ${op.title}`, action: 'reversed', opId });
  }

  /* ---------------- navigation, settings changes, teardown ---------------- */

  async function teardownPage(full: boolean): Promise<void> {
    if (incrementalTimer) clearTimeout(incrementalTimer);
    incrementalTimer = null;
    if (store.get().calm.open) closeCalm();
    const keep: Op[] = [];
    for (const op of [...opsList].reverse()) {
      if (!full && op.persistent && op.rec.status === 'applied') {
        keep.unshift(op);
        continue;
      }
      await revertOp(op);
    }
    opsList = keep;
    if (full) {
      tailor.sheets.clear();
      undoneKinds.clear();
      plan = null;
      columnWiden = 1;
      zoomSuspended = false;
    }
    judged = new Set();
    decided = new Set();
    jevEls = new Map();
    incrementalRounds = 0;
    pendingLate = false;
    overlays.reset();
    overlays.setHidden(false);
    reader.reset();
    read = null;
    const s = store.get();
    const keptEntries = s.ledger.filter((e) => e.opId && keep.some((o) => o.rec.id === e.opId)).map((e) => ({ ...e, at: 0 }));
    store.set({
      digest: null, outline: null, understanding: null, decisions: [], checks: [], ledger: keptEntries,
      calm: { open: false, loading: false, spec: null, source: null, aiReady: false, redesign: null, visual: null },
      struggle: { latest: null, history: [], waiting: [], offers: [] },
      explain: { open: false, loading: false, anchor: null, original: null, result: null, error: null },
      toasts: [],
      showingOriginal: false,
    });
    syncOps();
    if (stopSignals) {
      stopSignals();
      stopSignals = null;
    }
  }

  let lastRoute = routeKey(location.href);
  async function onNavigate(url: string): Promise<void> {
    const key = routeKey(url);
    if (key === lastRoute || stopped) return;
    lastRoute = key;
    await teardownPage(false);
    errors = [];
    void boot('navigation');
  }

  let refitTimer: ReturnType<typeof setTimeout> | null = null;
  const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || stopped) return;
    const fitChanged = 'fit' in changes;
    const settingsChange = changes.settings;
    let needsReboot = fitChanged;
    if (settingsChange) {
      const oldS = { ...DEFAULT_SETTINGS, ...((settingsChange.oldValue as Partial<Settings> | undefined) ?? {}) };
      const newS = { ...DEFAULT_SETTINGS, ...((settingsChange.newValue as Partial<Settings> | undefined) ?? {}) };
      if (oldS.enabled !== newS.enabled || pausedHere(oldS) !== pausedHere(newS) || oldS.serverOrigin !== newS.serverOrigin) needsReboot = true;
      if (oldS.lens !== newS.lens) toggleLens(newS.lens);
      store.set({ settings: newS });
    }
    if (!needsReboot) return;
    if (refitTimer) clearTimeout(refitTimer);
    refitTimer = setTimeout(() => {
      refitTimer = null;
      void (async () => {
        await teardownPage(true);
        errors = [];
        store.set({ ledger: [], startedAt: performance.now(), phase: 'idle' });
        await boot('refit');
      })();
    }, 150);
  };

  function toggleLens(on?: boolean): void {
    const s = store.get();
    store.set({ lens: { on: on ?? !s.lens.on } });
  }

  /* ---------------- the API ---------------- */

  const api: EngineApi = {
    getState: () => store.get(),
    subscribe: (l) => store.subscribe(l),
    elementFor: (id) => reader.elementFor(id),
    toggleLens,
    openCalm: () => openCalm('person'),
    closeCalm,
    useAiLayout: () => {
      if (pendingAi) void swapToAi('person', 'Chosen from the “A calmer layout is ready” chip');
    },
    showOriginal,
    undoOp,
    acceptOffer: (kind) => {
      void acceptOffer(kind).catch((err: unknown) => addError(plainError(err)));
    },
    dismissOffer,
    dismissToast: (id) => store.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    explainSelection,
    closeExplain: () => {
      explainSeq++;
      store.set({ explain: { open: false, loading: false, anchor: null, original: null, result: null, error: null } });
    },
    openFitting: () => {
      void askExt<unknown>({ type: 'openFitting' }).catch((err: unknown) => addError(plainError(err)));
    },
    restoreOverlay: (id) => overlays.restore(id),
    adjustColumn: (step) => personAction(() => adjustColumn(step)),
    passiveFeedback: () => {
      // Round 4 (passive fit package) implements this.
    },
    adjustText: (step) => personAction(() => adjustText(step)),
  };

  return {
    api,
    async start() {
      stopped = false;
      overlays.start();
      stopNav = watchNavigation((url) => {
        void onNavigate(url);
      });
      try {
        chrome.storage.onChanged.addListener(onStorage);
      } catch {
        /* storage events unavailable */
      }
      window.addEventListener('resize', onResize, { passive: true });
      window.addEventListener('pageshow', onPageShow);
      await boot('first');
    },
    stop() {
      stopped = true;
      generation++;
      overlays.stop();
      stopNav?.();
      stopNav = null;
      stopSignals?.();
      stopSignals = null;
      mo?.disconnect();
      mo = null;
      if (flushTimer) clearTimeout(flushTimer);
      if (incrementalTimer) clearTimeout(incrementalTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pageshow', onPageShow);
      try {
        chrome.storage.onChanged.removeListener(onStorage);
      } catch {
        /* ignore */
      }
      for (const op of [...opsList].reverse()) {
        if (!op.active) continue;
        try {
          void op.revert();
        } catch {
          /* best effort */
        }
      }
      tailor.sheets.clear();
      pushReport.cancel();
    },
  };
}
