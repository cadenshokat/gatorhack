// POST /v1/understand {digest} -> PageUnderstanding
// One page = one set of parallel Jev calls (design B: evidence inside each question, <= 25 elements per call).
import type { Hono } from 'hono';
import { buildPageCalls, parsePageAnswers } from '@webable/core';
import type { PageDigest, PageUnderstanding } from '@webable/core';
import { askJevAll, jevMetrics } from '../jev';
import { sanitizeDigest } from '../sanitize';
import { UnderstandBody } from '../schemas';
import { log } from '../util';
import { readBody, wantsFresh } from './common';

/** The optional `caution` line measurably lowers residual unsure answers on pages with ad iframes or off-site links. */
export function needsCaution(d: PageDigest): boolean {
  return d.elements.some((e) => (e.iframe_kind !== undefined && e.iframe_kind !== '') || e.link_target === 'another website');
}

export async function understand(input: PageDigest, opts: { fresh?: boolean } = {}): Promise<PageUnderstanding> {
  const { digest, changed } = sanitizeDigest(input);
  if (changed) log('understand: server redaction changed labels', { count: changed });
  const calls = buildPageCalls(digest, { caution: needsCaution(digest) });
  const results = await askJevAll(
    calls.map((call) => ({ state: call.state, questions: call.questions })),
    { tag: 'understand', fresh: opts.fresh },
  );
  const metrics = jevMetrics(results);
  const u = parsePageAnswers(digest, calls, results.map((r) => r.body), metrics);
  return { ...u, metrics, cached: results.every((r) => r.cached) };
}

export function registerUnderstand(app: Hono): void {
  app.post('/v1/understand', async (c) => {
    const { digest } = await readBody(c, UnderstandBody);
    const u = await understand(digest, { fresh: wantsFresh(c) });
    c.header('X-WebAble-Cache', u.cached ? 'hit' : 'miss');
    return c.json(u);
  });
}
