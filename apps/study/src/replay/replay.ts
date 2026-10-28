// Answers from the frozen fixtures. Replay never makes up an answer: anything it cannot match fails closed the way a
// server error does, and is logged as a miss.
// - understand: per element (Jev's "design B": each element's evidence sits in its own question, so answers are
//   independent). An element gets the judgment recorded for the same id with the same fingerprint, else the one
//   judgment recorded for its fingerprint when that fingerprint is unique both live and in the recording; otherwise it
//   stays unjudged (decide() then makes no decision for it). Page fields come from the canonical whole-page read and
//   are used only when the ids they name can be matched live.
// - meaning: by the sha256 of the request; a miss rejects, so the engine checks on the device (its own fallback).
// - overlayClose: by fingerprint; a miss rejects, so the pop-up is left alone.
// - compose: per group id; a miss fails that group closed with reason 'llm_unavailable' (it keeps the page's words).

import type {
  ComposeResponse, ComposeResult, ElementJudgment, JevMetrics, MeaningCheckRequest, MeaningVerdict,
  OverlayButtonEvidence, OverlayCloseResult, OverlayEvidence, PageDigest, PageUnderstanding,
} from '@webable/core';
import { stripLocalData } from '../../../extension/src/engine/extract/strip';
import type { ModelAnswers } from '../shim/background';
import { StudyBgError } from '../shim/errors';
import { candidateFor, canonicalJson, fingerprintTable, overlayKeyText, sha256 } from './keys';
import type { ElementEntry, PageFields, ReplayMiss, ReplicaFixtures } from './types';

const ZERO_METRICS: JevMetrics = { model: '', calls: 0, questions: 0, inputTokens: 0, wallMs: 0, serverMs: null, costUsd: 0 };

/** The key of a meaning request: what background.ts would post, canonical JSON, sha256. */
export function meaningKey(req: MeaningCheckRequest): Promise<string> {
  return sha256(canonicalJson(stripLocalData({ req })));
}

export function overlayKey(overlay: OverlayEvidence, candidates: OverlayButtonEvidence[]): Promise<string> {
  return sha256(overlayKeyText(overlay, candidates));
}

/** A group with no frozen answer: shown in the page's own words, as when the model cannot be reached. */
export function unavailableGroup(id: string): ComposeResult {
  return {
    id, ok: false, blocks: null, better: null,
    checks: { covered: false, numbersKept: false, noNewNumbers: false, linksKept: false, quotesKept: false, dropped: 0, added: 0 },
    reason: 'llm_unavailable',
  };
}

/** Lookups over the frozen element table. Pure, so tests can drive it. */
export class ElementTable {
  private byIdFp = new Map<string, ElementEntry>();
  private byFp = new Map<string, ElementEntry[]>();

  constructor(entries: ElementEntry[]) {
    for (const e of entries) {
      const k = `${e.id}\n${e.fp}`;
      if (!this.byIdFp.has(k)) this.byIdFp.set(k, e);
      const list = this.byFp.get(e.fp) ?? [];
      list.push(e);
      this.byFp.set(e.fp, list);
    }
  }

  /** The frozen entry for a live element: same id and fingerprint, else a fingerprint unique live and when recorded. */
  find(id: string, fp: string, liveUnique: boolean): ElementEntry | null {
    const exact = this.byIdFp.get(`${id}\n${fp}`);
    if (exact) return exact;
    if (!liveUnique) return null;
    const list = this.byFp.get(fp);
    if (!list?.length || !list.every((e) => e.uniq)) return null;
    return list[0] ?? null;
  }
}

/**
 * The live id for an id the recorded page call named: the same id with the same fingerprint, else the one live element
 * whose fingerprint is unique (live and when recorded). null when it cannot be matched.
 */
export function liveIdFor(recordedId: string, page: PageFields, live: Map<string, [string, boolean]>): string | null {
  const rec = page.ids[recordedId];
  if (!rec) return null;
  const [fp, uniq] = rec;
  const same = live.get(recordedId);
  if (same && same[0] === fp) return recordedId;
  if (!uniq) return null;
  let found: string | null = null;
  for (const [id, [lfp, luniq]] of live) {
    if (lfp !== fp) continue;
    if (!luniq) return null;
    found = id;
  }
  return found;
}

function remapProbs(probs: Record<string, number>, map: (id: string) => string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, p] of Object.entries(probs ?? {})) {
    if (k === 'none') {
      out[k] = p;
      continue;
    }
    const to = map(k);
    if (to) out[to] = p;
  }
  return out;
}

/** Answers one understand request from the fixtures. Pure apart from the miss callback. */
export function replayUnderstand(fx: ReplicaFixtures, digest: PageDigest, miss: (m: ReplayMiss) => void): PageUnderstanding {
  const table = new ElementTable(fx.understand.elements);
  const live = fingerprintTable(digest);
  const elements: ElementJudgment[] = [];
  for (const [id, [fp, uniq]] of live) {
    const hit = table.find(id, fp, uniq);
    if (hit) elements.push({ ...structuredClone(hit.j), id });
    else miss({ what: 'element', id });
  }
  const whole = (digest.mainCandidates?.length ?? 0) > 0 || (digest.regions?.length ?? 0) > 0;
  const page = fx.understand.page;
  const recorded = page?.metrics ?? ZERO_METRICS;
  const out: PageUnderstanding = {
    elements,
    mainPick: { id: 'none', p: 0, probs: {} },
    // Honest labelling, as the server does for a cached view: this view cost nothing; firstRead is the live read.
    metrics: { ...recorded, calls: 0, inputTokens: 0, costUsd: 0, serverMs: null, wallMs: 0 },
    cached: true,
    firstRead: structuredClone(recorded),
  };
  // A read of a few new items is not asked the page questions (core buildPageCalls), so it carries no page fields.
  if (!whole) return out;
  if (!page) {
    miss({ what: 'page' });
    return out;
  }
  const map = (rid: string) => liveIdFor(rid, page, live);
  if (page.purpose) out.purpose = structuredClone(page.purpose);
  if (page.mainPick.id === 'none') out.mainPick = { ...structuredClone(page.mainPick), probs: remapProbs(page.mainPick.probs, map) };
  else {
    const to = map(page.mainPick.id);
    if (to) out.mainPick = { id: to, p: page.mainPick.p, probs: remapProbs(page.mainPick.probs, map) };
    else miss({ what: 'mainPick', id: page.mainPick.id });
  }
  if (page.mainRegion) {
    if (page.mainRegion.id === 'none') out.mainRegion = { ...structuredClone(page.mainRegion), probs: remapProbs(page.mainRegion.probs, map) };
    else {
      const to = map(page.mainRegion.id);
      if (to) out.mainRegion = { id: to, p: page.mainRegion.p, probs: remapProbs(page.mainRegion.probs, map) };
      else miss({ what: 'mainRegion', id: page.mainRegion.id });
    }
  }
  return out;
}

export function createReplayAnswers(fx: ReplicaFixtures | null, miss: (m: ReplayMiss) => void): ModelAnswers {
  return {
    async understand(digest) {
      if (!fx) {
        miss({ what: 'fixtures' });
        throw new StudyBgError('network', 'No recorded answers for this page');
      }
      return replayUnderstand(fx, digest, miss);
    },
    async meaning(req) {
      const key = await meaningKey(req);
      const v = fx?.meaning[key];
      if (!v) {
        miss({ what: 'meaning', id: key.slice(0, 12) });
        throw new StudyBgError('network', 'No recorded meaning check for this plan');
      }
      return structuredClone(v);
    },
    async overlayClose(overlay, candidates) {
      const key = await overlayKey(overlay, candidates);
      const e = fx?.overlayClose[key];
      if (!e) {
        miss({ what: 'overlayClose', id: overlay.id });
        throw new StudyBgError('network', 'No recorded answer for this pop-up');
      }
      let pick: string = 'none';
      if (e.pick !== 'none') {
        const c = candidateFor(candidates.slice(0, 8), e.pick);
        if (!c) {
          miss({ what: 'overlayClose', id: overlay.id });
          throw new StudyBgError('network', 'The recorded button is not on this pop-up');
        }
        pick = c.id;
      }
      return { ...structuredClone(e.result), pick } as OverlayCloseResult;
    },
    async compose(req) {
      // background.ts sends at most 4 groups a call; the engine never sends more.
      const groups = (Array.isArray(req.groups) ? req.groups : []).slice(0, 4);
      const results: ComposeResult[] = groups.map((g) => {
        const r = fx?.compose[g.id];
        if (r) return structuredClone(r);
        miss({ what: 'compose', id: g.id });
        return unavailableGroup(g.id);
      });
      const meta = fx?.composeMeta;
      const res: ComposeResponse = { results, model: meta?.model ?? '', ms: 0, jev: meta ? { ...meta.jev, calls: 0, inputTokens: 0, costUsd: 0, wallMs: 0, serverMs: null } : ZERO_METRICS };
      return res;
    },
  };
}

