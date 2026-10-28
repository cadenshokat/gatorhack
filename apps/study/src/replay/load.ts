// Loads replicas/<id>/fixtures.json (served at /_r/<id>/fixtures.json). A missing or foreign file gives null: every
// model request then fails closed and is logged as a miss.

import { FIXTURES_V, type ReplicaFixtures } from './types';

export function isFixtures(x: unknown): x is ReplicaFixtures {
  const f = x as Partial<ReplicaFixtures> | null;
  return !!f && typeof f === 'object' && f.v === FIXTURES_V && !!f.understand && Array.isArray(f.understand.elements)
    && typeof f.meaning === 'object' && typeof f.compose === 'object' && typeof f.overlayClose === 'object';
}

export async function loadFixtures(url: string, timeoutMs = 8000): Promise<{ fixtures: ReplicaFixtures | null; error: string | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return { fixtures: null, error: `HTTP ${res.status}` };
    // A dev server answers a missing file with its HTML page.
    if (!/json/i.test(res.headers.get('content-type') ?? '')) return { fixtures: null, error: 'no fixtures file' };
    const json: unknown = await res.json();
    if (!isFixtures(json)) return { fixtures: null, error: 'not a study-fixtures.1 file' };
    return { fixtures: json, error: null };
  } catch (err) {
    return { fixtures: null, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
