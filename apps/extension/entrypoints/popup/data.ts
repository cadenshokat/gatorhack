// Owner: P, F. Popup data: settings and fit in chrome.storage.local, this tab's report in chrome.storage.session,
// what WebAble has learned (the background's `getPassive`), and the local server's /health. The popup is an extension
// page, so it reads storage directly.
import {
  DEFAULT_SETTINGS,
  type FitDimension,
  type FitProfile,
  type PassiveEvidence,
  type PassiveFitState,
  type Settings,
  type TabReport,
} from '@webable/core';
import { askExt, BusError, type ExtRequest, type HealthInfo } from '../../src/engine/bus';
import { DIM_ORDER } from '../../src/ui/panel/learned';

export type AiState = 'on' | 'off' | 'no_credits';

/** The server's HealthStatus as the popup reads it (older servers only say `openai: boolean`). */
export interface Health {
  ok: boolean;
  jev?: { warm?: boolean; model?: string };
  ai?: AiState;
  openai?: boolean;
}

function aiFrom(body: { ai?: unknown; openai?: unknown }): AiState | undefined {
  if (body.ai === 'on' || body.ai === 'off' || body.ai === 'no_credits') return body.ai;
  if (typeof body.openai === 'boolean') return body.openai ? 'on' : 'off';
  return undefined;
}

function healthFrom(body: unknown, okDefault: boolean): Health {
  const b = (body && typeof body === 'object' ? body : {}) as { ok?: unknown; jev?: unknown; ai?: unknown; openai?: unknown };
  const j = b.jev && typeof b.jev === 'object' ? (b.jev as { warm?: unknown; model?: unknown }) : null;
  return {
    ok: typeof b.ok === 'boolean' ? b.ok : okDefault,
    jev: j ? { warm: Boolean(j.warm), model: typeof j.model === 'string' ? j.model : undefined } : undefined,
    ai: aiFrom(b),
    openai: typeof b.openai === 'boolean' ? b.openai : undefined,
  };
}

export interface TodayMeter {
  day: string;
  decisions: number;
  usd: number;
  pages: number;
}

export interface ActiveTab {
  id: number | null;
  url: string;
  origin: string | null; // only for http(s) pages
}

export function mergeSettings(v: unknown): Settings {
  const s = (v && typeof v === 'object' ? v : {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    pausedOrigins: Array.isArray(s.pausedOrigins) ? s.pausedOrigins.filter((x): x is string => typeof x === 'string') : [],
    serverOrigin: typeof s.serverOrigin === 'string' && s.serverOrigin ? s.serverOrigin : DEFAULT_SETTINGS.serverOrigin,
  };
}

export async function readLocal(): Promise<{ settings: Settings; fit: FitProfile | null; today: TodayMeter | null }> {
  const got = await chrome.storage.local.get(['settings', 'fit', 'todayMeter']);
  const fit = got.fit && typeof got.fit === 'object' ? (got.fit as FitProfile) : null;
  const t = got.todayMeter as Partial<TodayMeter> | undefined;
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = t && t.day === day ? { day, decisions: Number(t.decisions) || 0, usd: Number(t.usd) || 0, pages: Number(t.pages) || 0 } : null;
  return { settings: mergeSettings(got.settings), fit, today };
}

/** Through the background first (it may tell open tabs); straight to storage if the worker is not answering. */
export async function writeSettings(next: Settings, patch: Partial<Settings>): Promise<void> {
  try {
    await askExt<unknown>({ type: 'setSettings', patch }, 3000);
    return;
  } catch {
    /* fall through */
  }
  await chrome.storage.local.set({ settings: next });
}

/** Save a fit, or clear it (null: no warm-up, so pages fit from the browser's settings and what WebAble learns). */
export async function writeFit(fit: FitProfile | null): Promise<void> {
  try {
    await askExt<unknown>({ type: 'setFit', fit }, 3000);
    return;
  } catch {
    /* fall through */
  }
  if (fit) await chrome.storage.local.set({ fit });
  else await chrome.storage.local.remove('fit');
}

export async function activeTab(): Promise<ActiveTab> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    let origin: string | null = null;
    try {
      const u = new URL(url);
      if (u.protocol === 'http:' || u.protocol === 'https:') origin = u.origin;
    } catch {
      origin = null;
    }
    return { id: typeof tab?.id === 'number' ? tab.id : null, url, origin };
  } catch {
    return { id: null, url: '', origin: null };
  }
}

export async function readReport(tabId: number | null): Promise<TabReport | null> {
  if (tabId == null) return null;
  try {
    const key = `report:${tabId}`;
    const got = await chrome.storage.session.get(key);
    const r = got[key];
    return r && typeof r === 'object' ? (r as TabReport) : null;
  } catch {
    return null;
  }
}

/**
 * Server status. The popup is an extension page with host access to the local server, so it asks /health
 * directly (that answer carries the AI state); if that fails, it asks through the background worker.
 */
export async function checkHealth(serverOrigin: string, timeoutMs = 2500): Promise<Health | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${serverOrigin.replace(/\/$/, '')}/health`, { signal: ctl.signal, cache: 'no-store' });
    const body: unknown = await res.json().catch(() => null);
    return healthFrom(body, res.ok);
  } catch {
    /* fall through to the worker */
  } finally {
    clearTimeout(t);
  }
  try {
    const h = await askExt<HealthInfo>({ type: 'health' }, timeoutMs + 1000);
    if (h && typeof h === 'object' && typeof h.ok === 'boolean') {
      if (!h.ok && h.error && !h.jev) return null; // the worker reached nothing either
      return healthFrom(h, h.ok);
    }
  } catch {
    /* nothing answered */
  }
  return null;
}

/* ------------------------------------------------------------------ what WebAble has learned */

function isPassiveState(v: unknown): v is PassiveFitState {
  return Boolean(v && typeof v === 'object' && (v as { beliefs?: unknown }).beliefs && typeof (v as { beliefs: unknown }).beliefs === 'object');
}

/** The passive fit state from the background, or null when it has none (or an older worker answers). */
export async function readPassive(timeoutMs = 3000): Promise<PassiveFitState | null> {
  try {
    const r = await askExt<unknown>({ type: 'getPassive' }, timeoutMs);
    return isPassiveState(r) ? r : null;
  } catch {
    return null;
  }
}

/** "Not right", "Forget this" or "Use this" on one learned need. */
export async function sendPassiveFeedback(dim: FitDimension, action: 'not_right' | 'forget' | 'confirm'): Promise<boolean> {
  try {
    await askExt<unknown>({ type: 'passiveFeedback', dim, action }, 4000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Demo requests the background answers beyond the shared contract (it also exposes them as
 * `globalThis.__webable.seedDemoHistory()` and `resetPassive()` for the eval harness).
 */
type DemoRequest = { type: 'seedDemoHistory' } | { type: 'resetPassive' };

function refused(e: unknown): boolean {
  return e instanceof BusError && (e.code === 'refused' || e.code === 'bad_response');
}

/** A demo record: PassiveEvidence plus the counts the passive engine keeps with it (kind, zoom, clicks, page). */
type DemoRecord = PassiveEvidence & {
  kind: 'zoom' | 'clicks';
  zoom?: number;
  bodyPx?: number;
  clicks?: number;
  misses?: number;
  page?: string;
};

/** One page's clicks as log-odds (Hurst 2008 rates: +1.50 a miss, -0.27 a clean click), capped at ±2 per page. */
function pageWeight(clicks: number, misses: number): number {
  const w = misses * Math.log(0.283 / 0.063) + (clicks - misses) * Math.log(0.717 / 0.937);
  return Math.round(Math.max(-2, Math.min(2, w)) * 1000) / 1000;
}

/**
 * A realistic week, written as evidence the shared contract already carries: zooms held on 4 sites over 3 days and
 * clicks that landed beside a button on 3 sites. Used only when the background has no `seedDemoHistory` of its own.
 */
export function demoWeek(now: Date = new Date()): PassiveEvidence[] {
  const at = (daysBack: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysBack);
    d.setHours(hour, (daysBack * 17 + hour * 7) % 60, 0, 0);
    // Never in the future (an early-morning demo): keep today's items before now.
    return new Date(Math.min(d.getTime(), now.getTime() - (daysBack === 0 ? 5 * 60_000 : 0))).toISOString();
  };
  const zoom = (site: string, z: number, body: number, daysBack: number, hour: number): DemoRecord => ({
    dim: 'text_size',
    kind: 'zoom',
    weight: 0.9,
    what: `You zoomed in to ${Math.round(z * 100)}% on ${site}`,
    site,
    at: at(daysBack, hour),
    layer: 'usual',
    value: Math.round(z * body * 2) / 2,
    zoom: z,
    bodyPx: body,
  });
  const clicks = (site: string, n: number, m: number, daysBack: number, hour: number): DemoRecord => ({
    dim: 'targets',
    kind: 'clicks',
    weight: pageWeight(n, m),
    what: m ? `${m} of ${n} clicks on ${site} landed just beside a button` : `${n} clicks on ${site}, none missed`,
    site,
    at: at(daysBack, hour),
    layer: 'usual',
    clicks: n,
    misses: m,
    page: `demo-${site.replace(/[^a-z0-9]/gi, '')}-${daysBack}`,
  });
  const items: DemoRecord[] = [
    zoom('nytimes.com', 1.25, 16, 2, 9),
    zoom('cvs.com', 1.5, 14, 2, 19),
    clicks('cvs.com', 22, 5, 2, 19),
    clicks('wikipedia.org', 9, 0, 2, 21),
    zoom('weather.gov', 1.25, 14, 1, 8),
    clicks('mail.google.com', 30, 6, 1, 10),
    zoom('mail.google.com', 1.25, 14, 1, 10),
    clicks('weather.gov', 18, 4, 0, 8),
    zoom('cvs.com', 1.5, 14, 0, 9),
  ];
  // Oldest first, as they happened.
  return items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** "Show a week of learning": the background's own seed, else the same week sent as ordinary evidence. */
export async function seedDemoHistory(): Promise<boolean> {
  try {
    await askExt<unknown>({ type: 'seedDemoHistory' } as DemoRequest as unknown as ExtRequest, 6000);
    return true;
  } catch (e) {
    if (!refused(e)) return false;
  }
  try {
    await askExt<unknown>({ type: 'passiveEvidence', items: demoWeek() }, 6000);
    return true;
  } catch {
    return false;
  }
}

/** "Start fresh": the background's own reset, else forget every learned need one by one. */
export async function resetPassive(): Promise<boolean> {
  try {
    await askExt<unknown>({ type: 'resetPassive' } as DemoRequest as unknown as ExtRequest, 6000);
    return true;
  } catch (e) {
    if (!refused(e)) return false;
  }
  const done = await Promise.all(DIM_ORDER.map((dim) => sendPassiveFeedback(dim, 'forget')));
  return done.some(Boolean);
}
