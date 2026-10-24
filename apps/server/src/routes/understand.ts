// POST /v1/understand {digest, noCache?} -> PageUnderstanding
// One page = one set of parallel Jev calls (design B: evidence inside each question, <= 25 elements per call).
// Cached answers are labelled honestly: `cached: true`, `metrics` says what this view cost (no calls, $0, the time it
// took to answer), and `firstRead` keeps the live read's own numbers (its latency, tokens and $).
import type { Hono } from 'hono';
import { buildPageCalls, parsePageAnswers } from '@webable/core';
import type { JevMetrics, PageDigest, PageUnderstanding } from '@webable/core';
import { askJevAll, jevMetrics } from '../jev';
import type { JevResult } from '../jev';
import { sanitizeDigest } from '../sanitize';
import { UnderstandBody } from '../schemas';
import { log, round } from '../util';
import { readBody, wantsFresh } from './common';

/** The optional `caution` line measurably lowers residual unsure answers on pages with ad iframes or off-site links. */
export function needsCaution(d: PageDigest): boolean {
  return d.elements.some((e) => (e.iframe_kind !== undefined && e.iframe_kind !== '') || e.link_target === 'another website');
}

/**
 * Metrics for this view. All live: the calls' own metrics. All cached: no calls, no tokens, $0, the time this
 * answer took; the decisions are still the page's. Mixed: the live calls' cost, every decision.
 */
export function viewMetrics(results: JevResult[], elapsedMs: number): { metrics: JevMetrics; cached: boolean; firstRead?: JevMetrics } {
  const all = jevMetrics(results);
  const live = results.filter((r) => !r.cached);
  if (live.length === results.length) return { metrics: all, cached: false };
  if (live.length === 0) {
    return {
      metrics: { ...all, calls: 0, inputTokens: 0, costUsd: 0, serverMs: null, wallMs: round(elapsedMs) },
      cached: true,
      // Cached entries keep the live read's body, latency and server time, so these are the first read's numbers.
      firstRead: all,
    };
  }
  const m = jevMetrics(live);
  return { metrics: { ...m, questions: all.questions }, cached: false };
}

export async function understand(input: PageDigest, opts: { fresh?: boolean } = {}): Promise<PageUnderstanding> {
  const t0 = performance.now();
  const { digest, changed } = sanitizeDigest(input);
  if (changed) log('understand: server redaction changed labels', { count: changed });
  const calls = buildPageCalls(digest, { caution: needsCaution(digest) });
  const results = await askJevAll(
    calls.map((call) => ({ state: call.state, questions: call.questions })),
    { tag: 'understand', fresh: opts.fresh },
  );
  const view = viewMetrics(results, performance.now() - t0);
  const u = parsePageAnswers(digest, calls, results.map((r) => r.body), view.metrics);
  if (view.cached) log('understand: from cache', { decisions: view.metrics.questions, firstReadMs: view.firstRead?.wallMs });
  return { ...u, metrics: view.metrics, cached: view.cached, ...(view.firstRead ? { firstRead: view.firstRead } : {}) };
}

export function registerUnderstand(app: Hono): void {
  app.post('/v1/understand', async (c) => {
    const { digest, noCache } = await readBody(c, UnderstandBody);
    const u = await understand(digest, { fresh: noCache === true || wantsFresh(c) });
    c.header('X-WebAble-Cache', u.cached ? 'hit' : 'miss');
    return c.json(u);
  });
}
