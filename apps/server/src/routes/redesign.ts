// POST /v1/redesign {outline, fit, roles} -> RedesignResult
// Candidates: the heuristic spec (always), three local variants made in code (focus / guided / overview, no model),
// and, when the generative model is available, its three stances (+ the cached deep layout when one exists).
// repairSpec runs on every spec; one Jev judge call scores them all the same way; code picks. No Jev answer -> the
// heuristic, not applied. Each candidate says where it came from: `source` and the first `repairs` line.
import type { Hono } from 'hono';
import {
  FitSpecSchema, LAYOUT_MODEL, applyUnfold, buildJudgeCall, candidateSource, chooseCandidate, fitSpecJsonSchema,
  heuristicSpec, localVariants, repairSpec, scoreCandidates, sourceTag,
} from '@webable/core';
import type { CandidateSource, FitSummaryForModel, LayoutCandidate, PageOutline, RedesignResult, Role } from '@webable/core';
import { aiStatus } from '../ai';
import type { AiStatus } from '../ai';
import { REDESIGN_CACHE_TTL_MS, jevKey } from '../config';
import { JevError, askJev, emptyJevMetrics, jevMetrics } from '../jev';
import { TtlLru } from '../lru';
import { deepEnabled, getDeepLayout, layoutCandidates, startDeepLayout } from '../openai';
import { fitToText, outlineToText, trimOutline } from '../prompts';
import { sanitizeOutline, sanitizeRoles } from '../sanitize';
import { RedesignBody } from '../schemas';
import { HttpError, errorMessage, hashOf, log, round } from '../util';
import { readBody, wantsFresh } from './common';

/** A candidate with its source spelled out (also the first `repairs` line). */
export type SourcedCandidate = LayoutCandidate & { source: CandidateSource };

/** RedesignResult plus where each candidate came from and whether AI was available. */
export interface RedesignResponse extends RedesignResult {
  candidates: SourcedCandidate[];
  ai: AiStatus;
  sources: Record<CandidateSource, number>;
}

type Mode = 'ai' | 'local';

interface CandidateSet {
  cands: LayoutCandidate[]; // repaired and tagged, not yet scored; heuristic first, then local, then the model's
  llm: RedesignResult['llm'];
  /** false when the generative wave failed for a transient reason: do not cache, try again next time. */
  complete: boolean;
}

const candidateCache = new TtlLru<CandidateSet>(100, REDESIGN_CACHE_TTL_MS);
const resultCache = new TtlLru<{ result: RedesignResponse; deep: boolean }>(100, REDESIGN_CACHE_TTL_MS);

function schemaReady(): boolean {
  return !!fitSpecJsonSchema && typeof fitSpecJsonSchema === 'object' && Object.keys(fitSpecJsonSchema).length > 0;
}

/** Validate a model's spec against the contract schema, then repair it against the outline. */
function toCandidate(name: LayoutCandidate['name'], data: unknown, outline: PageOutline, model: string): LayoutCandidate | null {
  const parsed = FitSpecSchema.safeParse(data);
  if (!parsed.success) {
    log('redesign: spec failed the schema', { candidate: name, issues: parsed.error.issues.length });
    return null;
  }
  const { spec, repairs } = repairSpec(parsed.data, outline);
  return { name, spec, repairs: [sourceTag('ai', model), ...repairs] };
}

/** Jev said these folded sections are needed before acting (need >= 0.60): core's applyUnfold opens each one. */
export function unfoldAll(cands: LayoutCandidate[], unfold: Array<{ candidate: string; sectionIndex: number }>): LayoutCandidate[] {
  return cands.map((cand) => {
    const idx = unfold.filter((u) => u.candidate === cand.name).map((u) => u.sectionIndex);
    return idx.length ? applyUnfold(cand, idx) : cand;
  });
}

/**
 * Core's scoring and choice key candidates by name, and a local and a model candidate can share a stance name
 * ('focus'). Give each one a unique stand-in name for those two calls only, then map back by position.
 */
const standIn = (i: number): LayoutCandidate['name'] => `c${i}` as unknown as LayoutCandidate['name'];

export function scoreAndChoose(cands: LayoutCandidate[], body: Parameters<typeof scoreCandidates>[1]): {
  cands: LayoutCandidate[];
  index: number;
  autoApply: boolean;
} {
  const coded = cands.map((c, i) => ({ ...c, name: standIn(i) }));
  const scored = scoreCandidates(coded, body);
  const unfolded = unfoldAll(scored.cands, scored.unfold);
  const { chosen, autoApply } = chooseCandidate(unfolded);
  const back = unfolded.map((c, i) => ({ ...c, name: (cands[i] as LayoutCandidate).name }));
  const at = unfolded.findIndex((c) => c.name === chosen);
  if (at >= 0) return { cands: back, index: at, autoApply };
  // Nothing qualified: the instant layout stays, never applied on its own.
  return { cands: back, index: Math.max(0, back.findIndex((c) => c.name === 'heuristic')), autoApply: false };
}

/** Put the chosen candidate before any other candidate with the same name, so a lookup by name finds it. */
export function chosenFirst<T extends LayoutCandidate>(cands: T[], index: number): T[] {
  const chosen = cands[index];
  if (!chosen) return cands;
  const first = cands.findIndex((c) => c.name === chosen.name);
  if (first < 0 || first >= index) return cands;
  const rest = cands.filter((_, i) => i !== index);
  rest.splice(first, 0, chosen);
  return rest;
}

function withSources(cands: LayoutCandidate[]): SourcedCandidate[] {
  return cands.map((c) => ({ ...c, source: candidateSource(c) }));
}

function countSources(cands: SourcedCandidate[]): Record<CandidateSource, number> {
  const out: Record<CandidateSource, number> = { heuristic: 0, local: 0, ai: 0 };
  for (const c of cands) out[c.source]++;
  return out;
}

async function makeCandidates(outline: PageOutline, roles: Record<string, Role>, fit: FitSummaryForModel, deepKey: string, mode: Mode): Promise<CandidateSet> {
  let heuristic: LayoutCandidate;
  try {
    const { spec, repairs } = repairSpec(heuristicSpec(outline, roles, fit), outline);
    heuristic = { name: 'heuristic', spec, repairs: [sourceTag('heuristic', 'the instant layout'), ...repairs] };
  } catch (e) {
    log('redesign: heuristic failed', { error: errorMessage(e).slice(0, 120) });
    throw new HttpError(500, 'heuristic_failed', 'The local layout could not be built for this page.');
  }
  const llm: RedesignResult['llm'] = { model: mode === 'ai' ? LAYOUT_MODEL : 'none (local layouts)', ms: 0, costUsd: 0 };
  if (!jevKey()) {
    // Without Jev nothing could pick another layout over the heuristic, so do not build or pay for candidates.
    log('redesign: no judge; keeping the instant layout', { judge: false });
    return { cands: [heuristic], llm, complete: true };
  }
  const cands: LayoutCandidate[] = [heuristic];
  const t0 = performance.now();
  try {
    cands.push(...localVariants(outline, roles, fit));
  } catch (e) {
    log('redesign: local variants failed', { error: errorMessage(e).slice(0, 120) });
  }
  const localMs = round(performance.now() - t0, 1);
  if (mode === 'local') {
    log('redesign: AI unavailable; judging local layouts', { ai: aiStatus(), local: cands.length - 1, ms: localMs });
    return { cands, llm, complete: true };
  }

  const fitText = fitToText(fit);
  const outlineText = outlineToText(trimOutline(outline));
  const t1 = performance.now();
  if (startDeepLayout(deepKey, fitText, outlineText, fitSpecJsonSchema)) log('redesign: deep layout started in the background');
  const raw = await layoutCandidates(fitText, outlineText, fitSpecJsonSchema);
  llm.ms = round(performance.now() - t1);
  let fromModel = 0;
  for (const r of raw) {
    llm.costUsd += r.result.costUsd;
    if (!r.result.ok) continue;
    const name = r.stance === 'deep' ? 'deep' : r.stance;
    const cand = toCandidate(name, r.result.data, outline, r.result.model);
    if (cand) {
      cands.push(cand);
      fromModel++;
    }
  }
  llm.costUsd = round(llm.costUsd, 6);
  if (!fromModel) llm.model = `${LAYOUT_MODEL} (no answer)`;
  return { cands, llm, complete: fromModel > 0 };
}

export async function redesign(
  body: { outline: PageOutline; fit: FitSummaryForModel; roles: Record<string, Role> },
  opts: { fresh?: boolean } = {},
): Promise<{ result: RedesignResponse; cache: 'hit' | 'rejudged' | 'miss' }> {
  if (body.outline.nodes.length === 0) throw new HttpError(422, 'empty_outline', 'The outline has no nodes, so there is nothing to lay out.');
  const { outline, changed } = sanitizeOutline(body.outline);
  if (changed) log('redesign: vocabulary filter changed labels', { count: changed });
  const roles = sanitizeRoles(body.roles, outline);
  const fit = body.fit;
  const ai = aiStatus();
  const mode: Mode = ai === 'on' && schemaReady() ? 'ai' : 'local';
  const key = hashOf('redesign.v2', mode, outline, fit, roles);
  const deepKey = hashOf('deep.v1', outline, fit);

  const deep = mode === 'ai' && deepEnabled() ? getDeepLayout(deepKey) : undefined;
  const cachedResult = opts.fresh ? undefined : resultCache.get(key);
  if (cachedResult && (cachedResult.deep || !deep)) return { result: cachedResult.result, cache: 'hit' };

  const { value: set } = await candidateCache.getOrMake(key, () => makeCandidates(outline, roles, fit, deepKey, mode), {
    fresh: opts.fresh,
    keep: (s) => s.complete,
  });
  let cands = set.cands.map((c) => ({ ...c, repairs: [...c.repairs] }));
  const llm = { ...set.llm };
  if (deep) {
    const d = toCandidate('deep', deep.data, outline, deep.model);
    if (d) cands.push(d);
  }

  let index = 0;
  let autoApply = false;
  let judge = emptyJevMetrics();
  let judged = false;
  if (cands.length >= 2) {
    try {
      const call = buildJudgeCall(cands, fit, outline);
      const r = await askJev({ state: call.state, questions: call.questions }, { tag: 'judge', fresh: opts.fresh });
      judge = jevMetrics([r]);
      ({ cands, index, autoApply } = scoreAndChoose(cands, r.body));
      judged = true;
    } catch (e) {
      // Fail closed: no judgment means no other layout is chosen.
      cands = cands.map((c) => ({ ...c, pEasier: undefined, pHides: undefined, fitScore: undefined, composite: undefined }));
      log('redesign: judge unavailable; keeping the heuristic', {
        kind: e instanceof JevError ? e.kind : 'error',
        error: e instanceof JevError ? undefined : errorMessage(e).slice(0, 160),
      });
    }
  } else {
    judged = true; // nothing to judge: the heuristic is the answer
  }

  const winner = cands[index] ?? cands[0]!;
  const ordered = withSources(chosenFirst(cands, index));
  const result: RedesignResponse = {
    chosen: winner.name,
    candidates: ordered,
    autoApply,
    llm,
    judge,
    ai,
    sources: countSources(ordered),
  };
  // Cache only a complete answer: a transient model or Jev failure is retried on the next open.
  if (judged && set.complete) resultCache.set(key, { result, deep: !!deep });
  log('redesign', {
    mode,
    candidates: ordered.map((c) => `${c.source === 'local' ? 'local:' : c.source === 'ai' ? 'ai:' : ''}${c.name}`).join(','),
    chosen: `${candidateSource(winner)}:${winner.name}`,
    composite: winner.composite !== undefined ? round(winner.composite, 2) : undefined,
    autoApply,
    llmMs: llm.ms,
    llmUsd: llm.costUsd.toFixed(4),
    judgeQ: judge.questions,
    judgeMs: round(judge.wallMs),
    judgeUsd: judge.costUsd.toFixed(5),
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
