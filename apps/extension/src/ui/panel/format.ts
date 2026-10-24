// Owner: D2. Number formatting and Jev totals for the in-page chrome.
import type { JevMetrics, Role } from '@webable/core';
import type { EngineState } from '../../contracts';

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Probability as two decimals, the way Jev quantises it ('0.97'). */
export function fmtP(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return '–';
  return clamp(p, 0, 1).toFixed(2);
}

export function fmtCount(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** '$0.00047', '$0.0018', '$0.013'. Small amounts keep two significant digits. */
export function fmtCost(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '$0';
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  const digits = Math.min(7, Math.max(4, 1 - Math.floor(Math.log10(usd))));
  // Two significant digits, trailing zeros dropped: $0.00047, $0.0018, $0.00009.
  return `$${usd.toFixed(digits).replace(/(\.\d*?[1-9])0+$/, '$1')}`;
}

/** '182 ms' below a second, '1.37 s' above. */
export function fmtMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '–';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Always seconds, for the counter: '0.31 s'. */
export function fmtSeconds(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '–';
  return `${(ms / 1000).toFixed(2)} s`;
}

export function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k tokens`;
  return `${Math.round(n)} tokens`;
}

/** '+1.4 s' since the engine booted. */
export function fmtSince(atMs: number): string {
  if (!Number.isFinite(atMs)) return '';
  if (atMs < 60_000) return `+${(Math.max(0, atMs) / 1000).toFixed(1)} s`;
  const m = Math.floor(atMs / 60_000);
  const s = Math.round((atMs % 60_000) / 1000);
  return `+${m} min ${s} s`;
}

export const ROLE_LABEL: Record<Role, string> = {
  main_content: 'content',
  form_field: 'field',
  action_button: 'button',
  navigation: 'navigation',
  search: 'search',
  advertising: 'advertising',
  recommendations: 'recommended',
  popup_overlay: 'popup',
  consent_notice: 'consent',
  help_contact: 'help',
  account_utility: 'account',
  legal_footer: 'legal',
  other: 'other',
};

export function roleLabel(role: Role | string | null | undefined): string {
  if (!role) return 'other';
  return (ROLE_LABEL as Record<string, string>)[role] ?? String(role).replace(/_/g, ' ');
}

export interface JevTotals {
  /** Typed answers Jev returned on this page (one per question). */
  decisions: number;
  calls: number;
  costUsd: number;
  inputTokens: number;
  /** Wall time of the page-understanding call (the headline number), else the latest call. */
  headlineMs: number | null;
  serverMs: number | null;
  model: string;
  cached: boolean;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Every Jev metrics object the engine holds for this page, deduplicated by identity. */
export function jevMetricsList(s: EngineState): JevMetrics[] {
  const seen = new Set<JevMetrics>();
  const add = (m: JevMetrics | null | undefined) => {
    if (m && typeof m === 'object') seen.add(m);
  };
  add(s.understanding?.metrics);
  for (const j of s.struggle.history) add(j?.metrics);
  add(s.struggle.latest?.metrics);
  add(s.calm.redesign?.judge);
  add(s.calm.visual?.metrics);
  add(s.explain.result?.jev);
  return [...seen];
}

export function jevTotals(s: EngineState): JevTotals {
  const list = jevMetricsList(s);
  let decisions = 0;
  let calls = 0;
  let costUsd = 0;
  let inputTokens = 0;
  for (const m of list) {
    decisions += num(m.questions);
    calls += num(m.calls);
    costUsd += num(m.costUsd);
    inputTokens += num(m.inputTokens);
  }
  const head = s.understanding?.metrics ?? list[list.length - 1] ?? null;
  return {
    decisions,
    calls,
    costUsd,
    inputTokens,
    headlineMs: head ? num(head.wallMs) : null,
    serverMs: head && typeof head.serverMs === 'number' ? head.serverMs : null,
    model: head?.model || 'jev-1.14.0',
    cached: Boolean(s.understanding?.cached),
  };
}

/** Plain copy for the engine phase, about the page, never about the person. */
export function phaseLine(s: EngineState, origin: string): string {
  if (!s.settings.enabled) return 'WebAble is off. Pages are shown as the site made them.';
  if (s.settings.pausedOrigins.includes(origin)) return 'Paused on this site. The page is as the site made it.';
  if (s.showingOriginal) return 'Showing the original page. Your changes are kept for when you switch back.';
  switch (s.phase) {
    case 'idle':
      return s.fit ? 'Waiting for the page to settle.' : 'No fit yet. Run the fitting so pages can be fitted.';
    case 'reading':
      return 'Reading this page.';
    case 'tailored':
      return 'Text and buttons fitted. Asking Jev about the page.';
    case 'understood':
      return 'Fitted to your settings. Every change can be undone.';
    case 'calm':
      return 'Calm view is open. Every button still drives the page.';
    case 'error':
      return 'Some steps did not finish. Every change below can be undone.';
    default:
      return '';
  }
}

export function pageOrigin(): string {
  try {
    return location.origin;
  } catch {
    return '';
  }
}
