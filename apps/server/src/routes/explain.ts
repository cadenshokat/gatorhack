// POST /v1/explain {req} -> ExplainResult
// The server redacts the passage again and refuses it if anything personal survives. EXPLAIN_MODEL writes a
// plain version; code checks numbers and condition words; Jev checks coverage per original sentence. Sentences
// with low coverage come back in showOriginalInstead. No Jev answer -> no explanation (fail closed).
import type { Hono } from 'hono';
import {
  EXPLAIN_MODEL, buildExplainCheckCall, conditionWordsKept, numbersKept, parseExplainCheck, redactText, stillSensitive,
} from '@webable/core';
import type { ExplainRequest, ExplainResult } from '@webable/core';
import { EXPLAIN_MAX_CHARS, jevKey } from '../config';
import { JevError, askJev, emptyJevMetrics, jevMetrics } from '../jev';
import { explainPassage } from '../openai';
import { ExplainBody } from '../schemas';
import { splitSentences } from '../text';
import { TtlLru } from '../lru';
import { HttpError, errorMessage, log, round, sha256 } from '../util';
import { readBody, wantsFresh } from './common';

const cache = new TtlLru<ExplainResponse>(200, 30 * 60_000);

/** Coverage below this shows the original sentence instead (faithful sentences scored 0.90+, a dropped fact 0.04). */
export const LOW_COVERAGE = 0.5;
/** Jev's adds/drops at or above this, or a failed code check, shows "may have missed or changed something". */
export const FACT_FLAG = 0.5;

/** ExplainResult plus the card's extra parts (terms, unclear) and a one-word verdict for the check line. */
export type ExplainResponse = ExplainResult & {
  plain: string[];
  terms: Array<{ term: string; meaning: string }>;
  unclear: string[];
  verdict: 'checked' | 'check_original' | 'unavailable';
  error?: string;
};

function failed(passageSentences: string[], model: string, ms: number, error: string): ExplainResponse {
  return {
    ok: false,
    explanation: null,
    sentences: passageSentences.map((original) => ({ original, covered: 0 })),
    checks: { numbersKept: false, conditionWordsKept: false, addedFact: 0, droppedFact: 0 },
    showOriginalInstead: passageSentences,
    model,
    ms,
    jev: emptyJevMetrics(),
    plain: [],
    terms: [],
    unclear: [],
    verdict: 'unavailable',
    error,
  };
}

export async function explain(req: ExplainRequest, opts: { fresh?: boolean } = {}): Promise<ExplainResponse> {
  const passage = redactText(req.passage).replace(/[ \t]+/g, ' ').trim();
  if (!passage) throw new HttpError(422, 'empty', 'There is no text to explain.');
  if (stillSensitive(passage)) throw new HttpError(422, 'sensitive', 'This passage still contains personal details, so it was not sent.');
  if (passage.length > EXPLAIN_MAX_CHARS) {
    throw new HttpError(422, 'too_long', `Select a shorter passage (at most ${EXPLAIN_MAX_CHARS} characters).`);
  }
  const sentences = splitSentences(passage);
  if (!jevKey()) {
    // Without Jev the explanation could not be checked, so do not pay for one.
    return failed(sentences, EXPLAIN_MODEL, 0, 'The explanation could not be checked against the original, so it is not shown.');
  }
  // The same passage asked again (another click, a rehearsal) is answered from memory; only checked answers are kept.
  const { value } = await cache.getOrMake(sha256(passage), () => explainChecked(passage, sentences, opts), {
    fresh: opts.fresh,
    keep: (r) => r.ok,
  });
  return value;
}

async function explainChecked(passage: string, sentences: string[], opts: { fresh?: boolean }): Promise<ExplainResponse> {
  const llm = await explainPassage(passage);
  if (!llm.ok) {
    log('explain: no explanation', { error: llm.error });
    return failed(sentences, llm.model, llm.ms, 'The explanation could not be written right now. The original text is unchanged.');
  }
  const { plain, terms, unclear } = llm.data;
  const explanation = plain.join('\n');
  const nk = numbersKept(passage, explanation);
  const ck = conditionWordsKept(passage, explanation);

  let check: { covered: number[]; addedFact: number; droppedFact: number };
  let jev = emptyJevMetrics();
  try {
    const call = buildExplainCheckCall(sentences, explanation);
    const r = await askJev({ state: call.state, questions: call.questions }, { tag: 'explain-check', fresh: opts.fresh });
    jev = jevMetrics([r]);
    check = parseExplainCheck(sentences, r.body);
  } catch (e) {
    log('explain: check unavailable; not showing an unchecked explanation', {
      kind: e instanceof JevError ? e.kind : 'error',
      error: e instanceof JevError ? undefined : errorMessage(e).slice(0, 160),
    });
    return failed(sentences, llm.model, llm.ms, 'The explanation could not be checked against the original, so it is not shown.');
  }

  const covered = sentences.map((_, i) => check.covered[i] ?? 0);
  const showOriginalInstead = sentences.filter((_, i) => covered[i]! < LOW_COVERAGE);
  const flagged = !nk || !ck || check.addedFact >= FACT_FLAG || check.droppedFact >= FACT_FLAG || showOriginalInstead.length > 0;
  log('explain', {
    model: llm.model,
    sentences: sentences.length,
    low: showOriginalInstead.length,
    numbers: nk,
    conditions: ck,
    added: round(check.addedFact, 2),
    dropped: round(check.droppedFact, 2),
  });
  return {
    ok: true,
    explanation,
    sentences: sentences.map((original, i) => ({ original, covered: covered[i]! })),
    checks: { numbersKept: nk, conditionWordsKept: ck, addedFact: check.addedFact, droppedFact: check.droppedFact },
    showOriginalInstead,
    model: llm.model,
    ms: llm.ms,
    jev,
    plain,
    terms,
    unclear,
    verdict: flagged ? 'check_original' : 'checked',
  };
}

export function registerExplain(app: Hono): void {
  app.post('/v1/explain', async (c) => {
    const { req } = await readBody(c, ExplainBody);
    return c.json(await explain(req, { fresh: wantsFresh(c) }));
  });
}
