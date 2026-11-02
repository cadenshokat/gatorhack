// Live mode (protocol 4.0.0): the AI answers that depend on the person come from the hosted WebAble server while they
// take part; the AI's read of each page still comes from the recording first, so it is instant and the same for
// everyone.
// - understand: recorded only (per element; see replay.ts).
// - meaning, overlayClose: recorded, else asked live (a miss used to fail closed).
// - compose: with a reader (the set-up questions), written live for this person; if that fails, the recorded answer
//   written for a general reader. Without a reader, recorded only.
// - struggle, redesign (AI layouts), rewordScore and rewordWrite: live only.
// Each live call is logged (what, whether it worked, how long it took) for the delivery record. The bodies are what
// apps/extension/entrypoints/background.ts posts: content the page shows stays on the phone (stripLocalData), and
// compose's page.host is the original site's hostname, as when the answers were recorded.

import type { ComposeResponse, MeaningVerdict, OverlayCloseResult, ReaderProfile } from '@webable/core';
import { stripOutlineData } from '../../../extension/src/engine/extract/strip';
import type { ModelAnswers } from '../shim/background';
import { createPoster } from './post';

/** Reasons a group failed for want of the AI (not because a check found a problem with what it wrote). */
const UNAVAILABLE = /unavailable|timeout|budget|error/;

export interface LiveCall {
  what: string;
  ok: boolean;
  ms: number;
}

export interface LiveAnswers {
  answers: ModelAnswers;
  calls(): LiveCall[];
  inFlight(): number;
}

export interface LiveOptions {
  origin: string;
  /** The recorded answers, once the fixtures are in. */
  recorded(): ModelAnswers;
  reader: ReaderProfile | null;
  originalHost: string;
  note(kind: string, detail?: string): void;
}

export function createLiveAnswers(o: LiveOptions): LiveAnswers {
  const poster = createPoster(o.origin);
  const calls: LiveCall[] = [];

  async function live<T>(what: string, path: string, body: unknown, timeoutMs: number): Promise<T> {
    const t0 = performance.now();
    try {
      const r = await poster.post<T>(path, body, timeoutMs);
      calls.push({ what, ok: true, ms: Math.round(performance.now() - t0) });
      return r;
    } catch (err) {
      calls.push({ what, ok: false, ms: Math.round(performance.now() - t0) });
      o.note('live_failed', `${what}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  const answers: ModelAnswers = {
    understand: (digest, noCache) => o.recorded().understand(digest, noCache),
    meaning: (req) =>
      o.recorded().meaning(req).catch(() => live<MeaningVerdict>('meaning', '/v1/meaning', { req }, 6000)),
    overlayClose: (overlay, candidates) =>
      o.recorded().overlayClose(overlay, candidates).catch(() =>
        live<OverlayCloseResult>('overlayClose', '/v1/overlay-close', { overlay, candidates: candidates.slice(0, 8) }, 8000)),
    async compose(req) {
      if (!o.reader) return o.recorded().compose(req);
      const groups = (Array.isArray(req.groups) ? req.groups : []).slice(0, 4);
      const page = { ...req.page, host: o.originalHost || req.page.host };
      let res: ComposeResponse;
      try {
        res = await live<ComposeResponse>('compose', '/v1/compose', { req: { ...req, page, groups, reader: o.reader } }, 20000);
      } catch {
        return o.recorded().compose(req);
      }
      // A group the server could not write (no model, no check, out of budget) gets its recorded answer, written for a
      // general reader, rather than the page's own words.
      const missing = (res.results ?? []).filter((r) => !r.ok && UNAVAILABLE.test(r.reason ?? ''));
      if (!missing.length) return res;
      o.note('live_fallback', `compose: ${missing.length} of ${res.results.length} from the recording`);
      const rec = await o.recorded().compose(req);
      const byId = new Map(rec.results.map((r) => [r.id, r] as const));
      return { ...res, results: res.results.map((r) => (missing.includes(r) ? byId.get(r.id) ?? r : r)) };
    },
    struggle: (signals) => live('struggle', '/v1/struggle', { signals }, 6000),
    redesign: (outline, fit, roles) =>
      live('redesign', '/v1/redesign', { outline: stripOutlineData(outline), fit, roles }, 22000),
    rewordScore: (req) =>
      live('rewordScore', '/v1/reword/score', { req: { ...req, paras: (req.paras ?? []).slice(0, 40), reader: o.reader } }, 10000),
    rewordWrite: (req) =>
      live('rewordWrite', '/v1/reword/write', { req: { ...req, items: (req.items ?? []).slice(0, 8), reader: o.reader } }, 25000),
  };

  return { answers, calls: () => calls.slice(), inFlight: () => poster.inFlight() };
}
