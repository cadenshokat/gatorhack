import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComposeResponse, PageDigest } from '@webable/core';
import { createRecorder } from '../../src/replay/record';

const METRICS = { model: 'jev-1.14.0', calls: 1, questions: 4, inputTokens: 100, wallMs: 300, serverMs: 200, costUsd: 0.0001 };

function mockFetch(answer: (url: string, body: unknown) => { status?: number; json: unknown }) {
  const calls: Array<{ url: string; headers: Record<string, string>; body: unknown }> = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, headers: init.headers as Record<string, string>, body });
    const a = answer(url, body);
    return new Response(JSON.stringify(a.json), { status: a.status ?? 200, headers: { 'content-type': 'application/json' } });
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('record mode', () => {
  it('posts compose as background.ts does, with the original host, and keeps every group answer', async () => {
    const res: ComposeResponse = {
      results: [{ id: 'g1', ok: false, blocks: null, better: 0.2, checks: { covered: true, numbersKept: true, noNewNumbers: true, linksKept: true, quotesKept: true, dropped: 0, added: 0 }, reason: 'plain_is_better' }],
      model: 'gpt-5.4-mini', ms: 900, jev: METRICS,
    };
    const calls = mockFetch(() => ({ json: res }));
    const r = createRecorder({ replicaId: 'r', fit: 'typical', h: 664, fresh: true, originalHost: 'apnews.com' });
    const groups = Array.from({ length: 6 }, (_, i) => ({ id: `g${i + 1}`, heading: null, units: [], linkTexts: [] }));
    await r.answers.compose({ page: { title: 'T', host: '127.0.0.1', purpose: 'article' }, groups });
    const c = calls[0]!;
    expect(c.url).toBe('http://127.0.0.1:41741/v1/compose');
    expect(c.headers).toMatchObject({ 'content-type': 'application/json', 'x-webable': '1', 'X-WebAble-Fresh': '1' });
    const body = c.body as { req: { page: { host: string }; groups: unknown[]; reader: unknown } };
    expect(body.req.page.host).toBe('apnews.com');
    expect(body.req.groups).toHaveLength(4);
    expect(body.req.reader).toBeNull();
    const rec = r.recorded();
    expect(rec.compose.g1?.reason).toBe('plain_is_better');
    expect(rec.composeMeta?.model).toBe('gpt-5.4-mini');
    expect(rec.posted['/v1/compose']).toBe(1);
  });

  it('keeps understand answers per element with fingerprints, and page fields from a whole-page read only', async () => {
    const digest = {
      v: 'digest.1', page: { title: '', url_path: '/', headings: [], landmarks: [], viewport: 'mobile, 390 x 664', element_count: 2 },
      elements: [
        { id: 'n1', tag: 'a', role_hint: 'link', label: 'News', zone: 'header_band', landmark: 'banner', size: '1 x 1 px', position: '', fixed: false, class_words: [], visual_weight: 'low' },
        { id: 'n2', tag: 'p', role_hint: 'text', label: '', zone: 'center_column', landmark: 'main', size: '1 x 1 px', position: '', fixed: false, class_words: [], visual_weight: 'low', kind: 'text', data: { kind: 'logo', src: 'x', label: 'secret' } },
      ],
      mainCandidates: ['n1'], hasSensitiveFields: false, lang: 'en',
    } as unknown as PageDigest;
    const calls = mockFetch(() => ({
      json: {
        elements: [{ id: 'n1', role: 'navigation', roleP: 0.9, roleProbs: {}, task: 0.1, main: 0, help: 0 }],
        mainPick: { id: 'none', p: 0.9, probs: {} }, metrics: METRICS, cached: false, purpose: { kind: 'article', p: 0.9, probs: {} },
      },
    }));
    const r = createRecorder({ replicaId: 'r', fit: 'rosa', h: 568, fresh: false, originalHost: 'x.com' });
    await r.answers.understand(digest, true);
    expect(calls[0]!.headers).not.toHaveProperty('X-WebAble-Fresh');
    expect(calls[0]!.body).toMatchObject({ noCache: true });
    // stripLocalData (as background.ts): data on anything shaped like an outline node never leaves.
    expect(JSON.stringify(calls[0]!.body)).not.toContain('secret');
    const rec = r.recorded();
    expect(rec.understand.elements).toHaveLength(1);
    expect(rec.understand.elements[0]).toMatchObject({ id: 'n1', uniq: true, from: 'union' });
    expect(rec.understand.page?.purpose?.kind).toBe('article');
    expect(Object.keys(rec.understand.page?.ids ?? {})).toEqual(['n1', 'n2']);
  });

  it('maps server errors the way background.ts does and never freezes them', async () => {
    mockFetch(() => ({ status: 422, json: { message: 'refused here' } }));
    const r = createRecorder({ replicaId: 'r', fit: 'typical', h: 664, fresh: true, originalHost: '' });
    await expect(r.answers.meaning({ purpose: null, original: { mainRegion: '', leadRoles: [], mustKeep: [] }, calm: { leadRoles: [], shownRoles: [], foldedRoles: [] } }))
      .rejects.toMatchObject({ code: 'refused', status: 422 });
    mockFetch(() => ({ status: 500, json: { error: 'boom' } }));
    await expect(r.answers.overlayClose({ id: 'n1', kind_hint: 'chat', label: '', position: '', size: '', opened_by_itself: true, class_words: [] }, []))
      .rejects.toMatchObject({ code: 'server' });
    const rec = r.recorded();
    expect(rec.errors.map((e) => `${e.what}:${e.code}`)).toEqual(['meaning:refused', 'overlayClose:server']);
    expect(rec.meaning).toEqual({});
    expect(r.inFlight()).toBe(0);
  });
});
