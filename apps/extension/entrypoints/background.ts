// Owner: C1. The background service worker.
//
// - Routes BgRequest from content scripts to the local server (`${settings.serverOrigin}/v1/*`). Content scripts
//   never fetch the server themselves (page origin, CORS, mixed content); the worker holds no keys.
// - Per-tab zoom (chrome.tabs.setZoomSettings scope 'per-tab'), and whether the person changed it themselves.
// - Fit and settings from chrome.storage.local; TabReport per tab in chrome.storage.session (`report:<tabId>`).
// - Visual verify: captureVisibleTab PNG, downscaled so the long side is <= 1568 px, 'before' kept per tab,
//   both posted on 'after'.
// - Explain passages are redacted again here (core redactText) before they leave the browser.
// - `globalThis.__webable = { setFit, getReport, setSettings }` for the eval harness.

import { DEFAULT_SETTINGS, DEMO_FITS, SERVER_ORIGIN, redactText, stillSensitive } from '@webable/core';
import type {
  ExplainResult, FitProfile, OverlayCloseResult, PageUnderstanding, RedesignResult, Settings, StruggleJudgment, TabReport,
  VisualVerdict, VisualVerifyRequest,
} from '@webable/core';
import type { BusEnvelope, BusErrorCode, BusReply, ExtRequest, HealthInfo, ZoomInfo } from '../src/engine/bus';

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

class BgError extends Error {
  readonly code: BusErrorCode;
  readonly status: number | null;
  constructor(code: BusErrorCode, message: string, status: number | null = null) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function toReply(err: unknown): BusReply {
  if (err instanceof BgError) return { ok: false, code: err.code, error: err.message, status: err.status };
  const msg = err instanceof Error ? err.message : String(err);
  return { ok: false, code: 'network', error: msg };
}

function isEnvelope(msg: unknown): msg is BusEnvelope {
  return !!msg && typeof msg === 'object' && (msg as { __wa?: unknown }).__wa === 1 && typeof (msg as { req?: { type?: unknown } }).req?.type === 'string';
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

async function getSettings(): Promise<Settings> {
  const got = await chrome.storage.local.get('settings');
  const stored = (got.settings ?? {}) as Partial<Settings>;
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

async function getFit(): Promise<FitProfile | null> {
  const got = await chrome.storage.local.get('fit');
  const fit = got.fit as FitProfile | undefined;
  return fit && fit.v === 'fit.1' ? fit : null;
}

async function setFit(fit: FitProfile | null): Promise<FitProfile | null> {
  if (fit === null) await chrome.storage.local.remove('fit');
  else await chrome.storage.local.set({ fit });
  return fit;
}

async function getReport(tabId: number): Promise<TabReport | null> {
  const k = `report:${tabId}`;
  const got = await chrome.storage.session.get(k);
  return (got[k] as TabReport | undefined) ?? null;
}

/* ------------------------------------------------------------------ */
/* Server calls                                                        */
/* ------------------------------------------------------------------ */

async function serverOrigin(): Promise<string> {
  const s = await getSettings();
  const o = (s.serverOrigin || SERVER_ORIGIN).replace(/\/+$/, '');
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(o) ? o : SERVER_ORIGIN;
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const origin = await serverOrigin();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${origin}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webable': '1' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (ctrl.signal.aborted) throw new BgError('timeout', `The WebAble server did not answer ${path} within ${timeoutMs / 1000} s`);
    throw new BgError('network', `The WebAble server at ${origin} could not be reached`);
  }
  let text = '';
  try {
    text = await res.text();
  } catch {
    clearTimeout(timer);
    if (ctrl.signal.aborted) throw new BgError('timeout', `The WebAble server did not finish ${path} within ${timeoutMs / 1000} s`);
    throw new BgError('network', 'The answer from the WebAble server was cut off');
  }
  clearTimeout(timer);
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const j = (json ?? {}) as { error?: unknown; message?: unknown };
    const msg = typeof j.message === 'string' ? j.message : typeof j.error === 'string' ? j.error : `HTTP ${res.status}`;
    throw new BgError(res.status === 422 ? 'refused' : 'server', msg, res.status);
  }
  if (json === null) throw new BgError('bad_response', `Empty answer from ${path}`);
  return json as T;
}

async function health(): Promise<HealthInfo> {
  const origin = await serverOrigin();
  const t0 = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${origin}/health`, { signal: ctrl.signal });
    const j = (await res.json()) as { ok?: unknown; jev?: { warm?: unknown; model?: unknown }; ai?: unknown; openai?: unknown };
    const ok = res.ok && j.ok !== false;
    // HealthStatus.ai ('on' | 'off' | 'no_credits'); an older server only says openai: boolean.
    const ai: HealthInfo['ai'] = j.ai === 'on' || j.ai === 'off' || j.ai === 'no_credits'
      ? j.ai
      : ok && j.openai !== false ? 'on' : 'off';
    const info: HealthInfo = { ok, ai, ms: Math.round(performance.now() - t0) };
    if (j.jev && typeof j.jev === 'object') info.jev = { warm: !!j.jev.warm, model: typeof j.jev.model === 'string' ? j.jev.model : '' };
    if (typeof j.openai === 'boolean') info.openai = j.openai;
    else info.openai = ai === 'on';
    return info;
  } catch {
    return { ok: false, ai: 'off', ms: Math.round(performance.now() - t0), error: ctrl.signal.aborted ? 'timeout' : `not reachable at ${origin}` };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Zoom                                                                */
/* ------------------------------------------------------------------ */

const ourZoom = new Map<number, number>();
const personZoomed = new Set<number>();
const loadingAt = new Map<number, number>();

async function zoomState(tabId: number): Promise<void> {
  if (ourZoom.has(tabId)) return;
  try {
    const got = await chrome.storage.session.get(`zoom:${tabId}`);
    const v = got[`zoom:${tabId}`] as { ours: number; person: boolean } | undefined;
    if (v) {
      ourZoom.set(tabId, v.ours);
      if (v.person) personZoomed.add(tabId);
    }
  } catch {
    /* fresh worker */
  }
}

function saveZoomState(tabId: number): void {
  const ours = ourZoom.get(tabId);
  if (ours === undefined) {
    void chrome.storage.session.remove(`zoom:${tabId}`).catch(() => undefined);
    return;
  }
  void chrome.storage.session.set({ [`zoom:${tabId}`]: { ours, person: personZoomed.has(tabId) } }).catch(() => undefined);
}

async function setZoom(tabId: number, factor: number): Promise<number> {
  const f = Math.min(5, Math.max(0.25, Math.round(factor * 100) / 100));
  try {
    await chrome.tabs.setZoomSettings(tabId, { mode: 'automatic', scope: 'per-tab' });
  } catch {
    /* some pages (chrome://) refuse; setZoom below reports it */
  }
  ourZoom.set(tabId, f);
  saveZoomState(tabId);
  await chrome.tabs.setZoom(tabId, f);
  return f;
}

/* ------------------------------------------------------------------ */
/* Screenshots                                                         */
/* ------------------------------------------------------------------ */

const beforeShots = new Map<number, string>();

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function capture(windowId: number): Promise<string> {
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  const long = Math.max(bmp.width, bmp.height);
  if (long <= 1568) {
    bmp.close();
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  }
  const scale = 1568 / long;
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new BgError('bad_response', 'Could not scale the screenshot');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const out = await canvas.convertToBlob({ type: 'image/png' });
  return bytesToBase64(new Uint8Array(await out.arrayBuffer()));
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

function updateBadge(tabId: number, report: TabReport): void {
  const applied = report.ops.filter((o) => o.status === 'applied').length;
  const text = report.phase === 'idle' || report.phase === 'error' ? '' : applied ? String(Math.min(applied, 99)) : '';
  void chrome.action.setBadgeText({ tabId, text }).catch(() => undefined);
  void chrome.action.setBadgeBackgroundColor({ tabId, color: '#3A7D44' }).catch(() => undefined);
  void chrome.action.setTitle({ tabId, title: applied ? `WebAble: ${applied} change${applied === 1 ? '' : 's'} on this page` : 'WebAble' }).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Request routing                                                     */
/* ------------------------------------------------------------------ */

async function handle(req: ExtRequest, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const tabId = sender.tab?.id;
  const needTab = (): number => {
    if (tabId === undefined) throw new BgError('refused', 'This request needs a browser tab');
    return tabId;
  };
  switch (req.type) {
    case 'understand':
      // noCache: the page's first read in this session is a live Jev read (honest metrics); later views may be cached.
      return post<PageUnderstanding>('/v1/understand', req.noCache ? { digest: req.digest, noCache: true } : { digest: req.digest }, 12000);
    case 'struggle':
      return post<StruggleJudgment>('/v1/struggle', { signals: req.signals }, 6000);
    case 'redesign':
      return post<RedesignResult>('/v1/redesign', { outline: req.outline, fit: req.fit, roles: req.roles }, 22000);
    case 'explain': {
      // Second redaction pass (the server runs a third); fail closed when redaction is unavailable.
      let passage: string;
      try {
        passage = redactText(req.req.passage);
      } catch {
        throw new BgError('refused', 'Personal details could not be checked, so the passage was not sent.');
      }
      let sensitive = false;
      try {
        sensitive = stillSensitive(passage);
      } catch {
        sensitive = true;
      }
      if (sensitive) throw new BgError('refused', 'This passage has personal details that could not be removed, so it was not sent.');
      return post<ExplainResult>('/v1/explain', { req: { passage, pageKind: req.req.pageKind } }, 22000);
    }
    case 'visualVerify': {
      const t = needTab();
      const windowId = sender.tab?.windowId;
      if (windowId === undefined || !sender.tab?.active) throw new BgError('refused', 'Screenshots need the tab to be in front');
      const shot = await capture(windowId);
      if (req.phase === 'before') {
        beforeShots.set(t, shot);
        void chrome.storage.session.set({ [`vv:${t}`]: shot }).catch(() => undefined);
        return { ok: true };
      }
      let before = beforeShots.get(t);
      if (!before) {
        const got = await chrome.storage.session.get(`vv:${t}`).catch(() => ({} as Record<string, unknown>));
        before = got[`vv:${t}`] as string | undefined;
      }
      if (!before) throw new BgError('refused', 'No "before" screenshot for this tab');
      beforeShots.delete(t);
      void chrome.storage.session.remove(`vv:${t}`).catch(() => undefined);
      const body: VisualVerifyRequest = { before, after: shot, controls: req.controls, help: req.help, mainLabel: req.mainLabel };
      return post<VisualVerdict>('/v1/verify-visual', body, 15000);
    }
    case 'setZoom':
      return setZoom(needTab(), req.factor);
    case 'getZoom':
      return chrome.tabs.getZoom(needTab());
    case 'zoomInfo': {
      const t = needTab();
      await zoomState(t);
      const factor = await chrome.tabs.getZoom(t);
      const info: ZoomInfo = { factor, ours: ourZoom.get(t) ?? null, personChanged: personZoomed.has(t) };
      return info;
    }
    case 'pageStart': {
      // A new document in this tab: per-tab zoom was reset by the navigation; forget what WebAble set.
      const t = needTab();
      ourZoom.delete(t);
      personZoomed.delete(t);
      beforeShots.delete(t);
      saveZoomState(t);
      return { ok: true };
    }
    case 'getFit':
      return getFit();
    case 'getSettings':
      return getSettings();
    case 'report': {
      const t = needTab();
      await chrome.storage.session.set({ [`report:${t}`]: req.report });
      updateBadge(t, req.report);
      return { ok: true };
    }
    case 'openFitting':
      await chrome.tabs.create({ url: chrome.runtime.getURL('/fitting.html') });
      return { ok: true };
    case 'health':
      return health();
    case 'overlayClose':
      // Jev finds an overlay's own minimise/close button (never asked for consent notices).
      if (req.overlay.kind_hint === 'consent') throw new BgError('refused', 'WebAble never closes consent notices');
      return post<OverlayCloseResult>('/v1/overlay-close', { overlay: req.overlay, candidates: req.candidates.slice(0, 8) }, 8000);
    case 'setFit':
      return setFit(req.fit);
    case 'setSettings':
      return setSettings(req.patch);
    case 'getReport': {
      const t = req.tabId ?? tabId ?? (await activeTabId());
      return t === undefined ? null : getReport(t);
    }
    case 'getPassive':
    case 'passiveEvidence':
    case 'passiveFeedback':
    case 'attribute':
      // Round 4 (passive fit package) implements these.
      return null;
    default: {
      const never: never = req;
      throw new BgError('refused', `Unknown request ${(never as { type?: string }).type ?? ''}`);
    }
  }
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

/* ------------------------------------------------------------------ */
/* Eval-harness hooks                                                  */
/* ------------------------------------------------------------------ */

type DemoName = keyof typeof DEMO_FITS;

interface WebableHooks {
  setFit(fit: FitProfile | DemoName | null): Promise<FitProfile | null>;
  getReport(target?: number | string): Promise<TabReport | null>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
}

const hooks: WebableHooks = {
  async setFit(fit) {
    if (typeof fit === 'string') {
      const demo = (DEMO_FITS as Record<string, FitProfile>)[fit];
      if (!demo) throw new Error(`Unknown demo fit "${fit}" (rosa, typical, reader)`);
      return setFit({ ...demo, createdAt: new Date().toISOString() });
    }
    return setFit(fit);
  },
  async getReport(target) {
    if (typeof target === 'number') return getReport(target);
    if (typeof target === 'string') {
      // A URL (or part of one): the most recent report whose url contains it.
      const all = await chrome.storage.session.get(null);
      for (const [k, v] of Object.entries(all)) {
        if (k.startsWith('report:') && (v as TabReport | undefined)?.url?.includes(target)) return v as TabReport;
      }
      return null;
    }
    const t = await activeTabId();
    return t === undefined ? null : getReport(t);
  },
  setSettings,
};

/* ------------------------------------------------------------------ */
/* Worker                                                              */
/* ------------------------------------------------------------------ */

export default defineBackground(() => {
  (globalThis as { __webable?: WebableHooks }).__webable = hooks;

  // Content scripts may read and write session storage (the Calm view cache).
  void chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => undefined);

  chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
    if (!isEnvelope(msg)) return false;
    handle(msg.req, sender).then(
      (data) => sendResponse({ ok: true, data: data ?? null } satisfies BusReply),
      (err: unknown) => sendResponse(toReply(err)),
    );
    return true; // async reply
  });

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason !== 'install') return;
    void (async () => {
      const fit = await getFit();
      if (!fit) await chrome.tabs.create({ url: chrome.runtime.getURL('/fitting.html') });
    })();
  });

  // The person's own zoom wins: a change WebAble did not make stops page scale in that tab.
  chrome.tabs.onZoomChange.addListener((info) => {
    const { tabId, newZoomFactor } = info;
    void (async () => {
      await zoomState(tabId);
      const ours = ourZoom.get(tabId);
      if (ours === undefined) return;
      if (Math.abs(ours - newZoomFactor) < 0.005) return;
      const loading = loadingAt.get(tabId);
      if (loading !== undefined && Date.now() - loading < 3000) return; // reset by a navigation
      personZoomed.add(tabId);
      saveZoomState(tabId);
    })();
  });

  chrome.tabs.onUpdated.addListener((tabId, change) => {
    // Navigations reset per-tab zoom; such a change is not the person's choice. (The new document's content
    // script sends 'pageStart', which clears what WebAble set.)
    if (change.status === 'loading') loadingAt.set(tabId, Date.now());
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    ourZoom.delete(tabId);
    personZoomed.delete(tabId);
    beforeShots.delete(tabId);
    loadingAt.delete(tabId);
    void chrome.storage.session.remove([`report:${tabId}`, `vv:${tabId}`, `zoom:${tabId}`]).catch(() => undefined);
  });
});
