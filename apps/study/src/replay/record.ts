// Record mode (dev machine only, scripts/record.mjs): forward each model request to the real server on
// 127.0.0.1:41741 with exactly the transforms apps/extension/entrypoints/background.ts applies before posting
// (stripLocalData, slicing, the consent refusal upstream, reader null for compose, the x-webable header), plus
// X-WebAble-Fresh on the canonical pass so no answer comes from the server's cache, and compose's page.host rewritten
// to the original site's hostname (it goes into the prompt; replay ignores it). Every answer is also collected for the
// fixtures file; failures are collected as errors and never frozen.

import { SERVER_ORIGIN } from '@webable/core';
import type {
  ComposeResponse, MeaningVerdict, OverlayCloseResult, PageDigest, PageUnderstanding,
} from '@webable/core';
import { stripLocalData } from '../../../extension/src/engine/extract/strip';
import type { ModelAnswers } from '../shim/background';
import { StudyBgError } from '../shim/errors';
import { fingerprintTable, nthOfFp } from './keys';
import { meaningKey, overlayKey } from './replay';
import { RECORDED_V, type RecordedAnswers } from './types';

export interface RecordOptions {
  replicaId: string;
  fit: string;
  h: number;
  /** The canonical pass: X-WebAble-Fresh: 1 on every post. */
  fresh: boolean;
  /** The original site's hostname, for compose's page.host. */
  originalHost: string;
  origin?: string;
}

export interface Recorder {
  answers: ModelAnswers;
  recorded(): RecordedAnswers;
  /** Requests posted and not answered yet. */
  inFlight(): number;
}

export function createRecorder(opts: RecordOptions): Recorder {
  const origin = (opts.origin ?? SERVER_ORIGIN).replace(/\/+$/, '');
  let inFlight = 0;
  const rec: RecordedAnswers = {
    v: RECORDED_V, replicaId: opts.replicaId, fit: opts.fit, h: opts.h, fresh: opts.fresh,
    understand: { page: null, elements: [] },
    meaning: {}, overlayClose: {}, compose: {}, composeMeta: null, errors: [], posted: {},
  };

  /** background.ts post(): the same body transform, headers and error mapping. */
  async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    rec.posted[path] = (rec.posted[path] ?? 0) + 1;
    inFlight++;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      let res: Response;
      try {
        res = await fetch(`${origin}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-webable': '1', ...(opts.fresh ? { 'X-WebAble-Fresh': '1' } : {}) },
          body: JSON.stringify(stripLocalData(body)),
          signal: ctrl.signal,
        });
      } catch {
        if (ctrl.signal.aborted) throw new StudyBgError('timeout', `The WebAble server did not answer ${path} within ${timeoutMs / 1000} s`);
        throw new StudyBgError('network', `The WebAble server at ${origin} could not be reached`);
      }
      let text = '';
      try {
        text = await res.text();
      } catch {
        if (ctrl.signal.aborted) throw new StudyBgError('timeout', `The WebAble server did not finish ${path} within ${timeoutMs / 1000} s`);
        throw new StudyBgError('network', 'The answer from the WebAble server was cut off');
      }
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      if (!res.ok) {
        const j = (json ?? {}) as { error?: unknown; message?: unknown };
        const msg = typeof j.message === 'string' ? j.message : typeof j.error === 'string' ? j.error : `HTTP ${res.status}`;
        throw new StudyBgError(res.status === 422 ? 'refused' : 'server', msg, res.status);
      }
      if (json === null) throw new StudyBgError('bad_response', `Empty answer from ${path}`);
      return json as T;
    } finally {
      clearTimeout(timer);
      inFlight--;
    }
  }

  const failed = (what: string) => (err: unknown): never => {
    const e = err instanceof StudyBgError ? err : new StudyBgError('network', err instanceof Error ? err.message : String(err));
    rec.errors.push({ what, code: e.code, error: e.message });
    throw e;
  };

  function keepUnderstanding(digest: PageDigest, u: PageUnderstanding): void {
    const table = fingerprintTable(digest);
    const have = new Set(rec.understand.elements.map((e) => `${e.id}\n${e.fp}`));
    for (const j of u.elements ?? []) {
      const t = table.get(j.id);
      if (!t) continue;
      const k = `${j.id}\n${t[0]}`;
      if (have.has(k)) continue;
      have.add(k);
      rec.understand.elements.push({ id: j.id, fp: t[0], uniq: t[1], j: structuredClone(j), from: opts.fresh ? 'canonical' : 'union' });
    }
    const whole = (digest.mainCandidates?.length ?? 0) > 0 || (digest.regions?.length ?? 0) > 0;
    if (whole && !rec.understand.page) {
      rec.understand.page = {
        ...(u.purpose ? { purpose: structuredClone(u.purpose) } : {}),
        ...(u.mainRegion ? { mainRegion: structuredClone(u.mainRegion) } : {}),
        mainPick: structuredClone(u.mainPick),
        metrics: structuredClone(u.firstRead ?? u.metrics),
        ids: Object.fromEntries(table),
      };
    }
  }

  const answers: ModelAnswers = {
    async understand(digest, noCache) {
      const body = noCache ? { digest, noCache: true } : { digest };
      const u = await post<PageUnderstanding>('/v1/understand', body, 12000).catch(failed('understand'));
      if (u && Array.isArray(u.elements)) keepUnderstanding(digest, u);
      return u;
    },
    async meaning(req) {
      const v = await post<MeaningVerdict>('/v1/meaning', { req }, 6000).catch(failed('meaning'));
      if (v && typeof v.leadsWithMain === 'number') {
        const key = await meaningKey(req);
        if (!(key in rec.meaning)) rec.meaning[key] = structuredClone(v);
      }
      return v;
    },
    async overlayClose(overlay, candidates) {
      const cands = candidates.slice(0, 8);
      const r = await post<OverlayCloseResult>('/v1/overlay-close', { overlay, candidates: cands }, 8000).catch(failed('overlayClose'));
      if (r && typeof r.accept === 'boolean') {
        const key = await overlayKey(overlay, cands);
        const { pick, ...result } = r;
        const at = pick === 'none' ? null : nthOfFp(cands, pick);
        if (!(key in rec.overlayClose) && (pick === 'none' || at)) {
          rec.overlayClose[key] = { result: structuredClone(result), pick: at ?? 'none' };
        }
      }
      return r;
    },
    async compose(req) {
      const groups = (Array.isArray(req.groups) ? req.groups : []).slice(0, 4);
      const page = { ...req.page, host: opts.originalHost || req.page.host };
      const res = await post<ComposeResponse>('/v1/compose', { req: { ...req, page, groups, reader: null } }, 20000).catch(failed('compose'));
      if (res && Array.isArray(res.results)) {
        for (const r of res.results) if (r && typeof r.id === 'string' && !(r.id in rec.compose)) rec.compose[r.id] = structuredClone(r);
        if (!rec.composeMeta) rec.composeMeta = { model: res.model, ms: res.ms, jev: structuredClone(res.jev) };
      }
      return res;
    },
  };

  return { answers, recorded: () => structuredClone(rec), inFlight: () => inFlight };
}
