// Running totals for /v1/stats and the Lens session meter ("Today: N decisions · $X").
import { median, round } from './util';

const WINDOW = 200;

interface JevTotals {
  calls: number;
  cacheHits: number;
  decisions: number; // typed answers received (questions answered)
  inputTokens: number;
  costUsd: number;
  errors: number;
  retries: number;
  wallMs: number[];
  serverMs: number[];
  lastModel: string | null;
}

interface ModelTotals {
  calls: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  costUsd: number;
  ms: number[];
}

interface OpenAiTotals {
  calls: number;
  errors: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  costUsd: number;
  byModel: Record<string, ModelTotals>;
}

interface RouteTotals {
  count: number;
  errors: number;
  ms: number[];
}

const startedAt = new Date().toISOString();
const jev: JevTotals = {
  calls: 0, cacheHits: 0, decisions: 0, inputTokens: 0, costUsd: 0, errors: 0, retries: 0, wallMs: [], serverMs: [], lastModel: null,
};
const openai: OpenAiTotals = { calls: 0, errors: 0, inputTokens: 0, cachedTokens: 0, outputTokens: 0, costUsd: 0, byModel: {} };
const routes: Record<string, RouteTotals> = {};

function push(arr: number[], v: number): void {
  arr.push(v);
  if (arr.length > WINDOW) arr.shift();
}

export function recordJevCall(c: { questions: number; inputTokens: number; costUsd: number; wallMs: number; serverMs: number | null; model: string; retries: number }): void {
  jev.calls++;
  jev.decisions += c.questions;
  jev.inputTokens += c.inputTokens;
  jev.costUsd += c.costUsd;
  jev.retries += c.retries;
  jev.lastModel = c.model;
  push(jev.wallMs, c.wallMs);
  if (c.serverMs !== null) push(jev.serverMs, c.serverMs);
}

export function recordJevCacheHit(): void {
  jev.cacheHits++;
}

export function recordJevError(): void {
  jev.errors++;
}

export function recordOpenAiCall(c: { model: string; inputTokens: number; cachedTokens: number; outputTokens: number; costUsd: number; ms: number }): void {
  openai.calls++;
  openai.inputTokens += c.inputTokens;
  openai.cachedTokens += c.cachedTokens;
  openai.outputTokens += c.outputTokens;
  openai.costUsd += c.costUsd;
  const m = (openai.byModel[c.model] ??= { calls: 0, inputTokens: 0, cachedTokens: 0, outputTokens: 0, costUsd: 0, ms: [] });
  m.calls++;
  m.inputTokens += c.inputTokens;
  m.cachedTokens += c.cachedTokens;
  m.outputTokens += c.outputTokens;
  m.costUsd += c.costUsd;
  push(m.ms, c.ms);
}

export function recordOpenAiError(): void {
  openai.errors++;
}

export function openAiSpentUsd(): number {
  return openai.costUsd;
}

export function recordRoute(route: string, status: number, ms: number): void {
  const r = (routes[route] ??= { count: 0, errors: 0, ms: [] });
  r.count++;
  if (status >= 400) r.errors++;
  push(r.ms, ms);
}

export function statsSnapshot() {
  const ms = (xs: number[]) => {
    const m = median(xs);
    return m === null ? null : round(m);
  };
  return {
    startedAt,
    uptimeSec: round(process.uptime()),
    jev: {
      model: jev.lastModel,
      calls: jev.calls,
      cacheHits: jev.cacheHits,
      decisions: jev.decisions,
      inputTokens: jev.inputTokens,
      costUsd: round(jev.costUsd, 6),
      errors: jev.errors,
      retries: jev.retries,
      wallMsP50: ms(jev.wallMs),
      serverMsP50: ms(jev.serverMs),
    },
    openai: {
      calls: openai.calls,
      errors: openai.errors,
      inputTokens: openai.inputTokens,
      cachedTokens: openai.cachedTokens,
      outputTokens: openai.outputTokens,
      costUsd: round(openai.costUsd, 5),
      byModel: Object.fromEntries(
        Object.entries(openai.byModel).map(([k, v]) => [
          k,
          { calls: v.calls, inputTokens: v.inputTokens, cachedTokens: v.cachedTokens, outputTokens: v.outputTokens, costUsd: round(v.costUsd, 5), msP50: ms(v.ms) },
        ]),
      ),
    },
    routes: Object.fromEntries(Object.entries(routes).map(([k, v]) => [k, { count: v.count, errors: v.errors, msP50: ms(v.ms) }])),
    totalUsd: round(jev.costUsd + openai.costUsd, 5),
  };
}
