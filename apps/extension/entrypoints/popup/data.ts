// Owner: P. Popup data: settings and fit in chrome.storage.local, this tab's report in chrome.storage.session,
// and the local server's /health. The popup is an extension page, so it reads storage directly.
import { DEFAULT_SETTINGS, type FitProfile, type Settings, type TabReport } from '@webable/core';
import { askExt, type HealthInfo } from '../../src/engine/bus';

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

export async function writeFit(fit: FitProfile): Promise<void> {
  try {
    await askExt<unknown>({ type: 'setFit', fit }, 3000);
    return;
  } catch {
    /* fall through */
  }
  await chrome.storage.local.set({ fit });
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
