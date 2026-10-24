// Owner: C1. The in-page engine: implements EngineApi and owns EngineState.
//
// Boot order (SPEC "Architecture"): wait for load (1.5 s cap) and 400 ms DOM quiet -> settings + fit from the
// background -> if disabled, paused for this origin or no fit: idle (the pill still mounts) -> reader -> page zoom
// (verified on its own) -> fit ops (verified) -> Jev understand -> decisions -> ops from decisions (verified) ->
// Calm view automatically at structure level 2 on a busy page, else offered. Late overlays (cookie banners, chat
// panels) get an incremental Jev read. SPA navigations re-run the element ops; zoom and behaviour ops stay.

import {
  DEFAULT_SETTINGS, decideElements, heuristicSpec, repairSpec, summarizeDecisions, summarizeFitForModel,
} from '@webable/core';
import type {
  BgRequest, CheckResult, ElementDecision, ElementEvidence, ElementJudgment, FitProfile, FitSpec, FitSummaryForModel, JevMetrics,
  LedgerEntry, Offer, OfferKind, OpKind, OutlineNode, PageDigest, PageOutline, PageUnderstanding, RedesignResult,
  Role, Settings, StruggleJudgment, StruggleKind, TabReport, VisualVerdict,
} from '@webable/core';
import type { EngineApi, EngineState, Toast } from '../contracts';
import { isOurUi } from '../ui/mount';
import { ask, askExt, errText, plainError, tell, type ZoomInfo } from './bus';
import { createStore, throttle } from './store';
import { routeKey, settle, sleep, waitForLoad, waitForQuiet, waitForVisible, watchNavigation } from './nav';
import { PageReader, collapse, type NodeInfo, type ReadResult } from './reader';
import { Tailor, resetBackgroundCache, type Op, type TextPlan } from './tailor';
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
  };
}

/* ------------------------------------------------------------------ */
/* Controller                                                          */
/* ------------------------------------------------------------------ */

export function createController(): Controller {
  const store = createStore<EngineState>(initialState());
  const reader = new PageReader();
  const verifyIds = new WeakMap<Element, string>();
  let verifyNext = 1;
  const idOf = (el: Element): string => {
    const rid = reader.idFor(el);
    if (rid) return rid;
    let v = verifyIds.get(el);
    if (!v) {
      v = `v${verifyNext++}`;
      verifyIds.set(el, v);
    }
    return v;
  };
  const tailor = new Tailor({
    ask: <T,>(req: BgRequest) => ask<T>(req),
    zoomInfo: () => zoomInfo(),
    isOurUi: safeOurs,
    idOf,
    onBehaviour: (kind) => {
      behaviourCounts[kind]++;
    },
  });
  const verifier = new Verifier({ idOf, isOurUi: safeOurs });

  // Engine-internal state (not part of EngineState).
  let generation = 0;
  let read: ReadResult | null = null;
  let plan: TextPlan | null = null;
  let opsList: Op[] = [];
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

  const syncOps = () => {
    store.set({ ops: opsList.map((o) => ({ ...o.rec, targetIds: [...o.rec.targetIds] })) });
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
    };
  };
  const pushReport = throttle(() => {
    if (stopped) return;
    tell({ type: 'report', report: buildReport() });
  }, 500);
  store.subscribe(() => pushReport());

  /* ---------------- zoom ---------------- */

  async function zoomInfo(): Promise<{ factor: number; personChanged: boolean }> {
    try {
      const z = await askExt<ZoomInfo>({ type: 'zoomInfo' });
      if (z && Number.isFinite(z.factor)) return { factor: z.factor, personChanged: !!z.personChanged };
    } catch {
      /* fall back to getZoom */
    }
    try {
      const f = await ask<number>({ type: 'getZoom' });
      return { factor: Number.isFinite(f) && f > 0 ? f : 1, personChanged: false };
    } catch {
      return { factor: 1, personChanged: false };
    }
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

  async function applyBatch(batch: Op[], r: ReadResult | null, opts: { quiet?: boolean } = {}): Promise<Op[]> {
    const fit = getFit();
    if (!batch.length || stopped) return [];
    const gen = generation;
    if (store.get().showingOriginal) {
      // Recorded now, applied when the person turns the original page off.
      for (const op of batch) opsList.push(op);
      syncOps();
      return batch;
    }
    const probe = verifier.probe(r, batch.flatMap((o) => o.elements));
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
    if (zoomInBatch) await waitResize();
    await settle();
    if (gen !== generation || stopped) {
      verifier.stopVolatile();
      return [];
    }
    const outcome = await verifier.verify(
      batch.filter((o) => o.active), before, probe,
      { ops: opsList, coverOps, contrastFloor: fit?.contrast.floor, mainRoot },
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
    for (const rv of outcome.reversed) {
      const where = /\bin the ([a-z ]+?)(?= is| are| now| can| faded| hid| disappeared| got| \(|$)/.exec(rv.result.detail)?.[1];
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

  function pausedHere(settings: Settings): boolean {
    return settings.pausedOrigins.includes(location.origin) || settings.pausedOrigins.includes(location.hostname);
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

      // 1. Page zoom, verified on its own (frozen per page view: kept across same-document navigations).
      const zi = await zoomInfo();
      if (gen !== generation) return;
      const existingZoom = opsList.find((o) => o.rec.kind === 'page_zoom' && o.rec.status === 'applied');
      let p = tailor.planText(fit, r.pageBodyPx, existingZoom && plan ? plan.ownZoom : zi.factor, zi.personChanged, zi.factor);
      if (existingZoom && plan) {
        // Keep the zoom already set; recompute the residual for this route's body size.
        const total = Math.max(1, (p.zoom * p.residual));
        const residual = Math.max(1, total / plan.zoom);
        const exponent = Math.min(1, Math.max(0.2, 1 - 0.48 * Math.log2(residual)));
        p = { ...p, zoom: plan.zoom, residual, exponent, targetBodyPx: r.pageBodyPx * residual, effectiveBodyPx: Math.round(r.pageBodyPx * residual * plan.zoom * 10) / 10 };
      }
      plan = p;
      if (!existingZoom && !undoneKinds.has('page_zoom')) {
        // Try the planned zoom; if a check reverses it (the layout scrolls sideways, say), step down one preset
        // once; if that fails too, the text map carries the whole scale.
        const total = Math.max(1, p.zoom * p.residual);
        const steps = [1.1, 1.25, 1.5, 1.75, 2];
        let tryZoom = p.zoom;
        for (let attempt = 0; attempt < 2 && tryZoom > p.ownZoom + 0.005; attempt++) {
          const attemptPlan: TextPlan = { ...p, zoom: tryZoom, residual: Math.max(1, total / tryZoom) };
          const z = tailor.zoomOp(attemptPlan);
          if (!z) break;
          const kept = await applyBatch([z], r, { quiet: true });
          if (gen !== generation) return;
          if (kept.includes(z)) {
            p = { ...attemptPlan, targetBodyPx: r.pageBodyPx * attemptPlan.residual, effectiveBodyPx: Math.round(r.pageBodyPx * attemptPlan.residual * tryZoom * 10) / 10 };
            break;
          }
          const lower = [...steps].reverse().find((x) => x < tryZoom - 0.005 && x > p.ownZoom + 0.005);
          if (!lower) break;
          tryZoom = lower;
        }
        if (!opsList.some((o) => o.rec.kind === 'page_zoom' && o.active)) {
          // No zoom kept: the residual map carries the whole scale (still capped by the text map's own rules).
          const residual = Math.max(1, total / p.ownZoom);
          p = { ...p, zoom: p.ownZoom, residual, exponent: Math.min(1, Math.max(0.2, 1 - 0.48 * Math.log2(residual))), targetBodyPx: r.pageBodyPx * residual, effectiveBodyPx: Math.round(r.pageBodyPx * residual * p.ownZoom * 10) / 10 };
        }
        plan = p;
      }
      if (gen !== generation) return;

      // 2. Fit ops (planned after zoom so rects are current), one write phase, verified.
      const fitOps = tailor.planFitOps(fit, r, p).filter((o) => {
        if (undoneKinds.has(o.rec.kind)) return false;
        // Persistent behaviour ops that are already running stay as they are.
        if (o.persistent && opsList.some((x) => x.rec.kind === o.rec.kind && x.rec.status === 'applied')) return false;
        return true;
      });
      const zoomOp = opsList.find((o) => o.rec.kind === 'page_zoom' && o.active);
      if (zoomOp && kind !== 'navigation') {
        log({ source: 'fit', title: zoomOp.title, detail: zoomOp.detail, action: 'applied', opId: zoomOp.rec.id });
      }
      if (zi.factor > 1.001 && !zoomOp && kind === 'first') {
        log({ source: 'fit', title: `Kept your own zoom (${pct(zi.factor)})`, action: 'kept' });
      }
      await applyBatch(fitOps, r);
      if (gen !== generation) return;
      watchCarousels(gen, r);
      // When the text map did not stay, say what zoom alone did for text size.
      const tmActive = opsList.some((o) => o.rec.kind === 'text_map' && o.active);
      if (zoomOp?.active && !tmActive && kind !== 'navigation') {
        log({
          source: 'fit',
          title: `Text is ${Math.round(r.pageBodyPx * p.zoom)} px here (was ${Math.round(r.pageBodyPx * p.ownZoom)} px)`,
          detail: `From the ${pct(p.zoom)} zoom; text, buttons and images grow together.`,
          action: 'applied',
          opId: zoomOp.rec.id,
        });
      }
      store.set({ phase: 'tailored' });
      startStruggle();
      watchLateContent();

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
      const res = await ask<PageUnderstanding>({ type: 'understand', digest: r.digest });
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
    log({
      source: 'jev',
      title: `Jev read this page: ${m.questions} decisions in ${(m.wallMs / 1000).toFixed(2)} s ($${m.costUsd.toFixed(4)})`,
      detail: `${m.model || 'jev'} · ${m.calls} call${m.calls === 1 ? '' : 's'}${m.serverMs !== null ? ` · server ${m.serverMs} ms` : ''} · ${m.inputTokens.toLocaleString()} tokens${u.cached ? ' · cached' : ''}`,
      action: 'kept',
    });
    await applyDecisions(decisions, r, null);
    if (gen !== generation) return;
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
          if (fit.attention.structureLevel < 1 || undoneKinds.has('dim')) {
            foldsSkipped++;
            break;
          }
          if (!guardFold(el, protectedEls)) {
            foldsSkipped++;
            break;
          }
          if (foldCands.some((f) => f.el.contains(el) || el.contains(f.el))) break;
          const foldP = Math.min(1, FOLD_ROLES.reduce((s, role) => s + (j.roleProbs[role] ?? 0), 0) || j.roleP);
          const roleWord = j.role === 'advertising' ? 'advertising' : j.role === 'recommendations' ? 'recommendations' : j.role === 'popup_overlay' ? 'popup' : j.role;
          const label = name && noun !== 'the cookie notice' ? ` ${quote(name, 6)}` : '';
          foldCands.push({ el, title: `Dimmed ${noun}${label} (${roleWord} ${p2(foldP)})`, detail: d.reasons.join('; '), p: foldP, noun });
          break;
        }
        case 'promote': {
          if (undoneKinds.has('promote_main') || opsList.some((o) => o.rec.kind === 'promote_main' && o.rec.status === 'applied')) break;
          const mainP = store.get().understanding?.mainPick.p ?? j.main;
          ops.push(tailor.promoteOp(el, r, fit.targets.minPx, `Outlined ${quote(name, 5) || 'the main button'}, the main action (${p2(mainP)})`, mainP));
          break;
        }
        case 'keep_popup':
          if (alreadyMentioned(el)) break;
          mentioned.push(el);
          protectEntries.push({ source: 'jev', title: `Kept ${noun === 'the popup' ? 'the notice' : noun}${name ? ` ${quote(name, 6)}` : ''} in view (part of the task ${p2(j.task)})`, detail: d.reasons.join('; '), p: j.task, action: 'kept' });
          break;
        case 'protect': {
          if (node?.consent || j.role === 'consent_notice' || r.local.consentIds.includes(d.id)) {
            if (!consentSaid) {
              consentSaid = true;
              mentioned.push(el);
              protectEntries.push({ source: 'jev', title: 'Left the cookie notice for you to answer', detail: 'WebAble never answers or hides consent notices.', p: j.roleProbs.consent_notice ?? j.roleP, action: 'protected' });
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
    // New text in the main region gets the existing size buckets (no new CSS).
    const tm = opsList.find((o) => o.rec.kind === 'text_map' && o.active);
    if (tm && added.length) {
      const inMain = read.mainRoot ? added.filter((el) => read?.mainRoot?.contains(el)) : added;
      tailor.markLateText(tm, inMain.slice(0, 50), read.texts);
    }
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
      cached: latest.cached && u.cached,
    };
    const union = judgedDigest(r.digest);
    const decisions = decide(merged, union, r);
    store.set({ understanding: merged, decisions, digest: union });
    log({
      source: 'jev',
      title: `Jev read ${u.elements.length} new item${u.elements.length === 1 ? '' : 's'} on the page (${(u.metrics.wallMs / 1000).toFixed(2)} s)`,
      detail: `${u.metrics.questions} more decisions`,
      action: 'kept',
    });
    await applyDecisions(decisions, r, new Set(u.elements.map((e) => e.id)));
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
    const usable = offers.filter((o) => (dismissedOffers.get(o.kind) ?? 0) <= now);
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
        const steps = [1.1, 1.25, 1.5, 1.75, 2];
        const widthAt100 = (document.documentElement.clientWidth || innerWidth) * zi.factor;
        const zMax = Math.min(2, Math.max(1, widthAt100 / 800));
        const next = steps.find((z) => z > zi.factor + 0.01 && z <= zMax + 0.001);
        if (next && plan) {
          superseded = opsList.filter((o) => o.rec.kind === 'page_zoom' && o.active);
          for (const o of superseded) {
            o.active = false; // superseded: the new op restores the person's own zoom on undo
            o.rec.status = 'reversed';
          }
          op = tailor.zoomOp({ ...plan, ownZoom: superseded.length ? plan.ownZoom : zi.factor, zoom: next });
          if (op) {
            op.source = 'signals';
            op.title = `Zoomed this page to ${pct(next)} (was ${pct(zi.factor)})`;
          }
        } else {
          toast('Text is already as large as this page layout allows');
        }
        break;
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
    if (kept.includes(op)) {
      toast(kind === 'larger_text' && op.rec.kind === 'page_zoom' ? `${OFFER_TOAST[kind]} (${op.title.match(/\d+%/)?.[0] ?? ''})`.replace(' ()', '') : OFFER_TOAST[kind], op.rec.id);
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
      await ask<number>({ type: 'setZoom', factor: plan.ownZoom });
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
      await ask<number>({ type: 'setZoom', factor: plan.zoom });
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
      log({ source: 'layout', title: 'The AI layout was not available, so this is the simple layout', detail: plainError(err), action: 'skipped' });
      return;
    }
    writeCachedRedesign(key, res);
    if (gen !== calmGen || !store.get().calm.open) return;
    const chosen = res.candidates.find((c) => c.name === res.chosen);
    store.set((s) => ({ calm: { ...s.calm, loading: false, redesign: res } }));
    const ms = Math.round(performance.now() - t0);
    if (!chosen || res.chosen === 'heuristic') {
      const best = [...res.candidates].filter((c) => c.name !== 'heuristic').sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0))[0];
      log({
        source: 'layout',
        title: 'Jev kept the simple layout: no AI layout was clearly easier',
        detail: best ? `Best AI layout: ${Math.round((best.pEasier ?? 0) * 100)}% likely easier, ${Math.round((best.pHides ?? 0) * 100)}% chance something needed is folded` : undefined,
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
      log({ source: 'check', title: `Reversed the AI layout: Jev's screenshot check saw ${reasons[0] ?? 'a problem'}`, detail: result.detail, action: 'reversed' });
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
    void resumeZoom();
  }

  /* ---------------- original page, undo ---------------- */

  function showOriginal(on: boolean): void {
    const s = store.get();
    if (on === s.showingOriginal) return;
    if (on) {
      calmWasOpen = s.calm.open;
      if (s.calm.open) closeCalm();
      store.set({ showingOriginal: true });
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
    void (async () => {
      await revertOp(op);
      op.rec.status = 'reversed';
      undoneKinds.add(op.rec.kind);
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
      zoomSuspended = false;
    }
    judged = new Set();
    decided = new Set();
    jevEls = new Map();
    incrementalRounds = 0;
    pendingLate = false;
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
  };

  return {
    api,
    async start() {
      stopped = false;
      stopNav = watchNavigation((url) => {
        void onNavigate(url);
      });
      try {
        chrome.storage.onChanged.addListener(onStorage);
      } catch {
        /* storage events unavailable */
      }
      await boot('first');
    },
    stop() {
      stopped = true;
      generation++;
      stopNav?.();
      stopNav = null;
      stopSignals?.();
      stopSignals = null;
      mo?.disconnect();
      mo = null;
      if (flushTimer) clearTimeout(flushTimer);
      if (incrementalTimer) clearTimeout(incrementalTimer);
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
