// POST /v1/redesign {outline, fit, roles} -> RedesignResult
// Heuristic spec (always a candidate) + 3 LAYOUT_MODEL stances in parallel (+ the cached deep layout when one
// exists); repairSpec on every spec; one Jev judge call; code picks. No Jev answer -> the heuristic, not applied.
import type { Hono } from 'hono';
import {
  FitSpecSchema, LAYOUT_MODEL, applyUnfold, buildJudgeCall, chooseCandidate, fitSpecJsonSchema, heuristicSpec, repairSpec,
  scoreCandidates,
} from '@webable/core';
import type { FitSummaryForModel, LayoutCandidate, PageOutline, RedesignResult, Role } from '@webable/core';
import { REDESIGN_CACHE_TTL_MS, jevKey } from '../config';
import { JevError, askJev, emptyJevMetrics, jevMetrics } from '../jev';
import { TtlLru } from '../lru';
import { deepEnabled, getDeepLayout, layoutCandidates, openAiAvailable, startDeepLayout } from '../openai';
import { fitToText, outlineToText, trimOutline } from '../prompts';
import { sanitizeOutline, sanitizeRoles } from '../sanitize';
import { RedesignBody } from '../schemas';
import { HttpError, errorMessage, hashOf, log, round } from '../util';
import { readBody, wantsFresh } from './common';

interface CandidateSet {
  cands: LayoutCandidate[]; // repaired, not yet scored; heuristic first
  llm: RedesignResult['llm'];
  /** false when the generative wave failed for a transient reason: do not cache, try again next time. */
  complete: boolean;
}

const candidateCache = new TtlLru<CandidateSet>(100, REDESIGN_CACHE_TTL_MS);
const resultCache = new TtlLru<{ result: RedesignResult; deep: boolean }>(100, REDESIGN_CACHE_TTL_MS);

function schemaReady(): boolean {
  return !!fitSpecJsonSchema && typeof fitSpecJsonSchema === 'object' && Object.keys(fitSpecJsonSchema).length > 0;
}

/** Validate a model's spec against the contract schema, then repair it against the outline. */
function toCandidate(name: LayoutCandidate['name'], data: unknown, outline: PageOutline): LayoutCandidate | null {
  const parsed = FitSpecSchema.safeParse(data);
  if (!parsed.success) {
    log('redesign: spec failed the schema', { candidate: name, issues: parsed.error.issues.length });
    return null;
  }
  const { spec, repairs } = repairSpec(parsed.data, outline);
  return { name, spec, repairs };
}

/** Jev said these folded sections are needed before acting (need >= 0.60): core's applyUnfold opens each one. */
export function unfoldAll(cands: LayoutCandidate[], unfold: Array<{ candidate: string; sectionIndex: number }>): LayoutCandidate[] {
  return cands.map((cand) => {
    const idx = unfold.filter((u) => u.candidate === cand.name).map((u) => u.sectionIndex);
    return idx.length ? applyUnfold(cand, idx) : cand;
  });
}

async function makeCandidates(outline: PageOutline, roles: Record<string, Role>, fit: FitSummaryForModel, deepKey: string): Promise<CandidateSet> {
  let heuristic: LayoutCandidate;
  try {
    const { spec, repairs } = repairSpec(heuristicSpec(outline, roles, fit), outline);
    heuristic = { name: 'heuristic', spec, repairs };
  } catch (e) {
    log('redesign: heuristic failed', { error: errorMessage(e).slice(0, 120) });
    throw new HttpError(500, 'heuristic_failed', 'The local layout could not be built for this page.');
  }
  const cands: LayoutCandidate[] = [heuristic];
  const llm: RedesignResult['llm'] = { model: LAYOUT_MODEL, ms: 0, costUsd: 0 };
  if (!openAiAvailable() || !schemaReady() || !jevKey()) {
    // Without Jev nothing could pick an AI layout over the heuristic, so do not pay for candidates.
    log('redesign: generative layouts unavailable', { key: openAiAvailable(), schema: schemaReady(), judge: jevKey() !== null });
    return { cands, llm, complete: true };
  }
  const fitText = fitToText(fit);
  const outlineText = outlineToText(trimOutline(outline));
  const t0 = performance.now();
  if (startDeepLayout(deepKey, fitText, outlineText, fitSpecJsonSchema)) log('redesign: deep layout started in the background');
  const raw = await layoutCandidates(fitText, outlineText, fitSpecJsonSchema);
  llm.ms = round(performance.now() - t0);
  for (const r of raw) {
    llm.costUsd += r.result.costUsd;
    if (!r.result.ok) continue;
    const name = r.stance === 'deep' ? 'deep' : r.stance;
    const cand = toCandidate(name, r.result.data, outline);
    if (cand) cands.push(cand);
  }
  llm.costUsd = round(llm.costUsd, 6);
  return { cands, llm, complete: cands.length > 1 };
}

export async function redesign(
  body: { outline: PageOutline; fit: FitSummaryForModel; roles: Record<string, Role> },
  opts: { fresh?: boolean } = {},
): Promise<{ result: RedesignResult; cache: 'hit' | 'rejudged' | 'miss' }> {
  if (body.outline.nodes.length === 0) throw new HttpError(422, 'empty_outline', 'The outline has no nodes, so there is nothing to lay out.');
  const { outline, changed } = sanitizeOutline(body.outline);
  if (changed) log('redesign: vocabulary filter changed labels', { count: changed });
  const roles = sanitizeRoles(body.roles, outline);
  const fit = body.fit;
  const key = hashOf('redesign.v1', outline, fit, roles);
  const deepKey = hashOf('deep.v1', outline, fit);

  const deep = deepEnabled() ? getDeepLayout(deepKey) : undefined;
  const cachedResult = opts.fresh ? undefined : resultCache.get(key);
  if (cachedResult && (cachedResult.deep || !deep)) return { result: cachedResult.result, cache: 'hit' };

  const { value: set } = await candidateCache.getOrMake(key, () => makeCandidates(outline, roles, fit, deepKey), {
    fresh: opts.fresh,
    keep: (s) => s.complete,
  });
  let cands = set.cands.map((c) => ({ ...c, repairs: [...c.repairs] }));
  const llm = { ...set.llm };
  if (deep) {
    const d = toCandidate('deep', deep.data, outline);
    if (d) cands.push(d);
  }

  let chosen: LayoutCandidate['name'] = 'heuristic';
  let autoApply = false;
  let judge = emptyJevMetrics();
  let judged = false;
  if (cands.length >= 2) {
    try {
      const call = buildJudgeCall(cands, fit, outline);
      const r = await askJev({ state: call.state, questions: call.questions }, { tag: 'judge', fresh: opts.fresh });
      judge = jevMetrics([r]);
      const scored = scoreCandidates(cands, r.body);
      cands = unfoldAll(scored.cands, scored.unfold);
      ({ chosen, autoApply } = chooseCandidate(cands));
      judged = true;
    } catch (e) {
      // Fail closed: no judgment means no AI layout is chosen.
      cands = cands.map((c) => ({ ...c, pEasier: undefined, pHides: undefined, fitScore: undefined, composite: undefined }));
      log('redesign: judge unavailable; keeping the heuristic', {
        kind: e instanceof JevError ? e.kind : 'error',
        error: e instanceof JevError ? undefined : errorMessage(e).slice(0, 160),
      });
    }
  } else {
    judged = true; // nothing to judge: the heuristic is the answer
  }

  const result: RedesignResult = { chosen, candidates: cands, autoApply, llm, judge };
  // Cache only a complete answer: a transient model or Jev failure is retried on the next open.
  if (judged && set.complete) resultCache.set(key, { result, deep: !!deep });
  log('redesign', {
    candidates: cands.map((c) => c.name).join(','),
    chosen,
    autoApply,
    llmMs: llm.ms,
    llmUsd: llm.costUsd.toFixed(4),
    judgeMs: round(judge.wallMs),
  });
  return { result, cache: cachedResult ? 'rejudged' : 'miss' };
}

export function registerRedesign(app: Hono): void {
  app.post('/v1/redesign', async (c) => {
    const body = await readBody(c, RedesignBody);
    const { result, cache } = await redesign(body, { fresh: wantsFresh(c) });
    c.header('X-WebAble-Cache', cache);
    return c.json(result);
  });
}
