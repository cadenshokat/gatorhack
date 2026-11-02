// Posting to the WebAble server the way apps/extension/entrypoints/background.ts post() does: the same body transform
// (stripLocalData: what the page's content is stays on the phone), headers and error mapping. Used by record mode (the
// dev machine's server) and live mode (the hosted server, protocol 4.0.0).

import { stripLocalData } from '../../../extension/src/engine/extract/strip';
import { StudyBgError } from '../shim/errors';

export interface Poster {
  post<T>(path: string, body: unknown, timeoutMs: number): Promise<T>;
  /** Requests posted and not answered yet. */
  inFlight(): number;
  /** Posts per path, for the record. */
  posted(): Record<string, number>;
}

export function createPoster(origin: string, opts: { fresh?: boolean } = {}): Poster {
  const base = origin.replace(/\/+$/, '');
  let inFlight = 0;
  const posted: Record<string, number> = {};

  async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    posted[path] = (posted[path] ?? 0) + 1;
    inFlight++;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      let res: Response;
      try {
        res = await fetch(`${base}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-webable': '1', ...(opts.fresh ? { 'X-WebAble-Fresh': '1' } : {}) },
          body: JSON.stringify(stripLocalData(body)),
          signal: ctrl.signal,
        });
      } catch {
        if (ctrl.signal.aborted) throw new StudyBgError('timeout', `The WebAble server did not answer ${path} within ${timeoutMs / 1000} s`);
        throw new StudyBgError('network', `The WebAble server at ${base} could not be reached`);
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

  return { post, inFlight: () => inFlight, posted: () => ({ ...posted }) };
}
