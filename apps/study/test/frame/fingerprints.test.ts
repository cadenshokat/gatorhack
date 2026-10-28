import { describe, expect, it } from 'vitest';
import type { ElementEvidence, ElementJudgment, OverlayButtonEvidence, PageDigest } from '@webable/core';
import { buttonFp, candidateFor, canonicalJson, elementFp, fingerprintTable, nthOfFp, sha256 } from '../../src/replay/keys';
import { ElementTable, liveIdFor, replayUnderstand, createReplayAnswers, meaningKey, unavailableGroup } from '../../src/replay/replay';
import { FIXTURES_V, type ElementEntry, type ReplayMiss, type ReplicaFixtures } from '../../src/replay/types';

function ev(id: string, over: Partial<ElementEvidence> = {}): ElementEvidence {
  return {
    id, tag: 'a', role_hint: 'link', label: 'News', zone: 'header_band', landmark: 'banner', size: '60 x 20 px',
    position: 'top, left', fixed: false, class_words: ['nav'], visual_weight: 'low', ...over,
  };
}

function judgment(id: string, role: ElementJudgment['role'] = 'navigation'): ElementJudgment {
  return { id, role, roleP: 0.9, roleProbs: { [role]: 0.9 }, task: 0.1, main: 0, help: 0 };
}

const METRICS = { model: 'jev-1.14.0', calls: 3, questions: 120, inputTokens: 9000, wallMs: 410, serverMs: 300, costUsd: 0.0004 };

function fixtures(over: Partial<ReplicaFixtures> = {}): ReplicaFixtures {
  return {
    v: FIXTURES_V, replicaId: 'r', version: '1', servePath: '/x', originalHost: 'example.com', engineCommit: 'c',
    serverCommit: 'c', models: { jev: 'jev-1.14.0', compose: 'gpt-5.4-mini' }, recordedAt: '2026-10-27T00:00:00Z',
    matrix: { fits: ['typical'], heights: [664], engines: ['chromium'], canonical: { fit: 'typical', h: 664 } },
    understand: { page: null, elements: [] }, meaning: {}, overlayClose: {}, compose: {}, composeMeta: null, runs: [],
    ...over,
  };
}

describe('element fingerprints', () => {
  it('leave out everything that depends on layout', () => {
    const a = ev('n1');
    const b = ev('n9', { size: '200 x 90 px', position: 'middle', zone: 'center_column', fixed: true, visual_weight: 'high', text_chars: 99 });
    expect(elementFp(a)).toBe(elementFp(b));
  });

  it('change with what the element is', () => {
    expect(elementFp(ev('n1'))).not.toBe(elementFp(ev('n1', { label: 'Sports' })));
    expect(elementFp(ev('n1'))).not.toBe(elementFp(ev('n1', { landmark: 'main' })));
    expect(elementFp(ev('n1'))).not.toBe(elementFp(ev('n1', { link_target: 'another website' })));
  });

  it('mark which fingerprints are unique in a digest, regions included', () => {
    const d = { elements: [ev('n1'), ev('n2'), ev('n3', { label: 'Weather' })], regions: [ev('n4', { tag: 'section', role_hint: 'region holding text' })] } as PageDigest;
    const t = fingerprintTable(d);
    expect(t.get('n1')?.[1]).toBe(false);
    expect(t.get('n2')?.[1]).toBe(false);
    expect(t.get('n3')?.[1]).toBe(true);
    expect(t.get('n4')?.[1]).toBe(true);
  });
});

describe('canonical JSON and sha256', () => {
  it('sort keys at every depth', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[1,{"y":2,"z":1}]},"b":1}');
  });

  it('hash the same request the same way whatever the key order', async () => {
    const a = await sha256(canonicalJson({ x: 1, y: [2, 3] }));
    const b = await sha256(canonicalJson({ y: [2, 3], x: 1 }));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('key meaning requests by content', async () => {
    const req = { purpose: 'article' as const, original: { mainRegion: 'article', leadRoles: ['headline' as const], mustKeep: [] }, calm: { leadRoles: ['headline' as const], shownRoles: [], foldedRoles: [] } };
    expect(await meaningKey(req)).toBe(await meaningKey(structuredClone(req)));
  });
});

describe('overlay button picks', () => {
  const b = (id: string, label: string): OverlayButtonEvidence => ({ id, tag: 'button', label, visible_text: label, position_in_overlay: 'top right corner', size: '24 x 24 px', class_words: [] });

  it('round-trip through fingerprint and position among equals', () => {
    const rec = [b('n1', 'Close'), b('n2', 'Subscribe'), b('n3', 'Close')];
    const pick = nthOfFp(rec, 'n3');
    expect(pick).toEqual({ fp: buttonFp(rec[2]!), nth: 1 });
    const live = [b('n40', 'Close'), b('n41', 'Subscribe'), b('n42', 'Close')];
    expect(candidateFor(live, pick!)?.id).toBe('n42');
    expect(candidateFor([b('n50', 'Subscribe')], pick!)).toBeNull();
  });
});

describe('element table', () => {
  const entries: ElementEntry[] = [
    { id: 'n1', fp: 'A', uniq: true, j: judgment('n1'), from: 'canonical' },
    { id: 'n2', fp: 'B', uniq: false, j: judgment('n2'), from: 'canonical' },
    { id: 'n3', fp: 'B', uniq: false, j: judgment('n3'), from: 'canonical' },
  ];
  const t = new ElementTable(entries);

  it('match by id and fingerprint first', () => {
    expect(t.find('n2', 'B', false)?.id).toBe('n2');
  });

  it('fall back to a fingerprint unique live and when recorded', () => {
    expect(t.find('n7', 'A', true)?.id).toBe('n1');
    expect(t.find('n7', 'A', false)).toBeNull();
  });

  it('never guess between equal fingerprints', () => {
    expect(t.find('n9', 'B', true)).toBeNull();
  });
});

describe('understand replay', () => {
  const recorded: PageDigest = {
    v: 'digest.1', page: { title: '', url_path: '/', headings: [], landmarks: [], viewport: 'mobile, 390 x 664', element_count: 3 },
    elements: [ev('n1'), ev('n2', { label: 'Sports' }), ev('n3', { tag: 'p', role_hint: 'text', label: '', landmark: 'main' })],
    mainCandidates: ['n1'], hasSensitiveFields: false, lang: 'en',
    regions: [ev('n5', { tag: 'article', role_hint: 'region holding text', label: '', landmark: 'main' })],
  };
  const table = fingerprintTable(recorded);
  const fx = fixtures({
    understand: {
      page: {
        purpose: { kind: 'article', p: 0.97, probs: { article: 0.97 } },
        mainRegion: { id: 'n5', p: 0.9, probs: { n5: 0.9, none: 0.1 } },
        mainPick: { id: 'n1', p: 0.4, probs: { n1: 0.4, none: 0.6 } },
        metrics: METRICS,
        ids: Object.fromEntries(table),
      },
      elements: [...table].map(([id, [fp, uniq]]) => ({ id, fp, uniq, j: judgment(id), from: 'canonical' as const })),
    },
  });

  it('answer every element and the page fields, with ids remapped', () => {
    // The live page view numbered everything one higher.
    const live: PageDigest = {
      ...recorded,
      elements: recorded.elements.map((e) => ({ ...e, id: `n${Number(e.id.slice(1)) + 1}` })),
      mainCandidates: ['n2'],
      regions: [{ ...recorded.regions![0]!, id: 'n6' }],
    };
    const misses: ReplayMiss[] = [];
    const u = replayUnderstand(fx, live, (m) => misses.push(m));
    expect(u.elements.map((e) => e.id).sort()).toEqual(['n2', 'n3', 'n4', 'n6']);
    expect(u.mainRegion).toEqual({ id: 'n6', p: 0.9, probs: { n6: 0.9, none: 0.1 } });
    expect(u.mainPick.id).toBe('n2');
    expect(u.purpose?.kind).toBe('article');
    expect(u.cached).toBe(true);
    expect(u.metrics.costUsd).toBe(0);
    expect(u.firstRead).toEqual(METRICS);
    expect(misses).toEqual([]);
  });

  it('log a miss for an element it cannot match, and drop a page field whose id is gone', () => {
    const live: PageDigest = { ...recorded, elements: [...recorded.elements, ev('n8', { label: 'Weather' })], regions: [] , mainCandidates: ['n1'] };
    const misses: ReplayMiss[] = [];
    const u = replayUnderstand(fx, live, (m) => misses.push(m));
    expect(misses).toContainEqual({ what: 'element', id: 'n8' });
    expect(misses).toContainEqual({ what: 'mainRegion', id: 'n5' });
    expect(u.mainRegion).toBeUndefined();
    expect(u.purpose?.kind).toBe('article');
  });

  it('give a read of a few new items no page fields', () => {
    const partial: PageDigest = { ...recorded, mainCandidates: [] };
    delete partial.regions;
    const u = replayUnderstand(fx, partial, () => undefined);
    expect(u.purpose).toBeUndefined();
    expect(u.mainPick.id).toBe('none');
  });

  it('map a live id the page named through a unique fingerprint only', () => {
    const page = fx.understand.page!;
    expect(liveIdFor('n5', page, new Map([['n9', [table.get('n5')![0], true]]]))).toBe('n9');
    expect(liveIdFor('n5', page, new Map([['n9', [table.get('n5')![0], false]], ['n10', [table.get('n5')![0], false]]]))).toBeNull();
  });
});

describe('compose, meaning and overlay replay', () => {
  it('fail a group with no frozen answer closed, as llm_unavailable', async () => {
    const ok = { ...unavailableGroup('g1'), ok: true, reason: undefined, blocks: [] };
    const misses: ReplayMiss[] = [];
    const a = createReplayAnswers(fixtures({ compose: { g1: ok } }), (m) => misses.push(m));
    const res = await a.compose({ page: { title: 't', host: 'h', purpose: null }, groups: [{ id: 'g1', heading: null, units: [], linkTexts: [] }, { id: 'g2', heading: null, units: [], linkTexts: [] }] });
    expect(res.results[0]?.ok).toBe(true);
    expect(res.results[1]).toMatchObject({ id: 'g2', ok: false, reason: 'llm_unavailable', blocks: null });
    expect(misses).toEqual([{ what: 'compose', id: 'g2' }]);
  });

  it('reject a meaning check it has no answer for, so the engine checks on the device', async () => {
    const misses: ReplayMiss[] = [];
    const a = createReplayAnswers(fixtures(), (m) => misses.push(m));
    await expect(a.meaning({ purpose: null, original: { mainRegion: '', leadRoles: [], mustKeep: [] }, calm: { leadRoles: [], shownRoles: [], foldedRoles: [] } })).rejects.toMatchObject({ code: 'network' });
    expect(misses[0]?.what).toBe('meaning');
  });

  it('reject every understand without fixtures', async () => {
    const a = createReplayAnswers(null, () => undefined);
    await expect(a.understand({} as PageDigest, false)).rejects.toMatchObject({ code: 'network' });
  });
});
