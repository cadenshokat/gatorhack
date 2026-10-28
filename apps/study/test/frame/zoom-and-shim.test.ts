import { afterEach, describe, expect, it } from 'vitest';
import type { TabReport } from '@webable/core';
import { DEMO_FITS } from '@webable/core';
import { askExt, BusError } from '../../../extension/src/engine/bus';
import { createStudyBackground, type ModelAnswers } from '../../src/shim/background';
import { createChromeShim, installChromeShim } from '../../src/shim/chrome';
import { StudyBgError } from '../../src/shim/errors';
import { createVirtualZoom, normalizeZoom } from '../../src/shim/zoom';

describe('virtual zoom', () => {
  it('rounds to 0.01 and clamps to 0.25-5, as background.ts does', () => {
    expect(normalizeZoom(1.254)).toBe(1.25);
    expect(normalizeZoom(1.256)).toBe(1.26);
    expect(normalizeZoom(9)).toBe(5);
    expect(normalizeZoom(0.1)).toBe(0.25);
    expect(normalizeZoom(Number.NaN)).toBe(1);
  });

  it('asks the shell to resize the frame, and does nothing for the same factor again', () => {
    const asked: number[] = [];
    const z = createVirtualZoom((f) => {
      asked.push(f);
      return f;
    });
    expect(z.set(1.5)).toBe(1.5);
    expect(z.set(1.504)).toBe(1.5);
    expect(z.set(1.25)).toBe(1.25);
    expect(asked).toEqual([1.5, 1.25]);
    expect(z.get()).toBe(1.25);
  });

  it('reports what WebAble set, never a change by the person, and forgets it on a new page', () => {
    const z = createVirtualZoom((f) => f);
    expect(z.info()).toEqual({ factor: 1, ours: null, personChanged: false });
    z.set(1.75);
    expect(z.info()).toEqual({ factor: 1.75, ours: 1.75, personChanged: false });
    z.pageStart();
    expect(z.info().ours).toBeNull();
  });

  it('keeps the factor the shell says it applied', () => {
    const z = createVirtualZoom(() => 1.3);
    expect(z.set(1.25)).toBe(1.3);
  });
});

describe('chrome stand-in', () => {
  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  it('stores copies, never references, and announces changes', async () => {
    const shim = createChromeShim(async () => null);
    const seen: Array<[string, unknown]> = [];
    shim.storage.onChanged.addListener((changes, area) => seen.push([area, changes]));
    const v = { a: [1, 2] };
    await shim.storage.local.set({ k: v });
    v.a.push(3);
    const got = await shim.storage.local.get('k');
    expect(got).toEqual({ k: { a: [1, 2] } });
    (got.k as { a: number[] }).a.push(9);
    expect(await shim.storage.local.get(['k', 'missing'])).toEqual({ k: { a: [1, 2] } });
    expect(await shim.storage.session.get(null)).toEqual({});
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual([['local', { k: { oldValue: undefined, newValue: { a: [1, 2] } } }]]);
    await shim.storage.local.remove('k');
    expect(await shim.storage.local.get('k')).toEqual({});
  });

  it('runs bus.ts unchanged: answers and errors keep their codes', async () => {
    installChromeShim(async (req) => {
      if (req.type === 'getZoom') return 1.25;
      if (req.type === 'struggle') throw new StudyBgError('refused', 'off');
      return null;
    });
    expect(await askExt<number>({ type: 'getZoom' })).toBe(1.25);
    expect(await askExt<null>({ type: 'getFit' })).toBeNull();
    const err = await askExt({ type: 'struggle', signals: { page_kind: '', time_on_page: '', task_progress: '' } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusError);
    expect((err as BusError).code).toBe('refused');
  });
});

describe('study background', () => {
  const answers: ModelAnswers = {
    understand: async () => ({ elements: [], mainPick: { id: 'none', p: 0, probs: {} }, metrics: { model: '', calls: 0, questions: 0, inputTokens: 0, wallMs: 0, serverMs: null, costUsd: 0 }, cached: true }),
    meaning: async () => ({ leadsWithMain: 1, missingMain: 0, pass: true, metrics: { model: '', calls: 0, questions: 0, inputTokens: 0, wallMs: 0, serverMs: null, costUsd: 0 } }),
    overlayClose: async () => {
      throw new Error('not asked');
    },
    compose: async () => ({ results: [], model: '', ms: 0, jev: { model: '', calls: 0, questions: 0, inputTokens: 0, wallMs: 0, serverMs: null, costUsd: 0 } }),
  };
  const notes: string[] = [];
  const reports: TabReport[] = [];
  const bg = createStudyBackground({ fit: DEMO_FITS.rosa, answers, zoom: createVirtualZoom((f) => f), note: (k, d) => notes.push(`${k}:${d ?? ''}`), onReport: (r) => reports.push(r) });

  it('turns AI layouts and the Jev view off, and learns nothing', async () => {
    expect(await bg.handle({ type: 'getSettings' })).toMatchObject({ aiLayouts: false, lens: false, enabled: true });
    expect(await bg.handle({ type: 'getPassive' })).toBeNull();
    expect(await bg.handle({ type: 'getReader' })).toBeNull();
    expect(await bg.handle({ type: 'getFit' })).toEqual(DEMO_FITS.rosa);
    await expect(bg.handle({ type: 'passiveEvidence', items: [] })).rejects.toMatchObject({ code: 'refused' });
    await expect(bg.handle({ type: 'attribute', question: { kind: 'zoom_reason', evidence: {} } })).rejects.toMatchObject({ code: 'refused' });
  });

  it('never asks about a consent notice', async () => {
    const overlay = { id: 'n1', kind_hint: 'consent' as const, label: '', position: '', size: '', opened_by_itself: true, class_words: [] };
    await expect(bg.handle({ type: 'overlayClose', overlay, candidates: [] })).rejects.toMatchObject({ code: 'refused' });
  });

  it('zooms virtually and keeps the latest report', async () => {
    expect(await bg.handle({ type: 'setZoom', factor: 1.5 })).toBe(1.5);
    expect(await bg.handle({ type: 'zoomInfo' })).toEqual({ factor: 1.5, ours: 1.5, personChanged: false });
    const report = { url: 'x', phase: 'calm', fitApplied: true, ops: [], checks: [], ledger: [], understanding: null, struggle: null, redesign: null, errors: [] } as TabReport;
    await bg.handle({ type: 'report', report });
    expect(bg.lastReport()).toBe(report);
    expect(reports).toHaveLength(1);
  });

  it('notes the sheet controls the study hides', async () => {
    await bg.handle({ type: 'setSettings', patch: { enabled: false } });
    expect(notes).toContain('request_noop:setSettings');
    expect(await bg.handle({ type: 'getSettings' })).toMatchObject({ enabled: true });
  });
});
