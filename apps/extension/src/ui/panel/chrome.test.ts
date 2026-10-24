// Owner: P. Pure parts of the in-page chrome: shortcuts, the offer's "why" split, overlay views, explain states.
import { describe, expect, it } from 'vitest';
import type { ExplainResult, JevMetrics, OverlayAction } from '@webable/core';
import { jevAnswered, writerUnavailable } from '../explain/ExplainCard';
import { splitWhy } from '../offers/OfferCard';
import { overlayView } from '../offers/Overlays';
import { shortcutFor } from './keys';

const key = (code: string, mods: { alt?: boolean; shift?: boolean; ctrl?: boolean; meta?: boolean } = {}) => ({
  code,
  altKey: mods.alt ?? true,
  shiftKey: mods.shift ?? true,
  ctrlKey: mods.ctrl ?? false,
  metaKey: mods.meta ?? false,
});

describe('shortcuts', () => {
  it('maps Alt+Shift+L/C/O/W and keeps Alt+J for the Lens', () => {
    expect(shortcutFor(key('KeyL'))).toBe('lens');
    expect(shortcutFor(key('KeyC'))).toBe('calm');
    expect(shortcutFor(key('KeyO'))).toBe('original');
    expect(shortcutFor(key('KeyW'))).toBe('panel');
    expect(shortcutFor(key('KeyJ', { shift: false }))).toBe('lens');
  });
  it('ignores other combinations', () => {
    expect(shortcutFor(key('KeyL', { alt: false }))).toBeNull();
    expect(shortcutFor(key('KeyL', { ctrl: true }))).toBeNull();
    expect(shortcutFor(key('KeyL', { meta: true }))).toBeNull();
    expect(shortcutFor(key('KeyC', { shift: false }))).toBeNull();
    expect(shortcutFor(key('KeyX'))).toBeNull();
  });
});

describe('offer "why"', () => {
  const why =
    '5 near-miss clicks in the last 30 s. WebAble counted this on your device. To check the suggestion, it sent only counts like these: ' +
    'no page text and nothing you typed. Jev: 0.91 that clicks keep missing their controls, in 2 checks in a row (offers start at 0.75).';
  it('splits counts, privacy note and Jev answer without repeating any of them', () => {
    const p = splitWhy(why);
    expect(p).not.toBeNull();
    expect(p!.counts).toBe('5 near-miss clicks in the last 30 s.');
    expect(p!.privacy.startsWith('WebAble counted this')).toBe(true);
    expect(p!.jev).toBe('that clicks keep missing their controls, in 2 checks in a row');
    expect(p!.threshold).toBe(0.75);
    const all = `${p!.counts} ${p!.privacy} ${p!.jev}`;
    expect(all.match(/WebAble counted/g)).toHaveLength(1);
  });
  it('reads a different threshold and falls back when the shape is unknown', () => {
    expect(splitWhy(why.replace('0.75', '0.80'))!.threshold).toBe(0.8);
    expect(splitWhy('Just a sentence.')).toBeNull();
  });
});

describe('overlay views', () => {
  const base: OverlayAction = { id: 'n7', kind: 'consent', action: 'docked', coverageBefore: 0.31, coverageAfter: 0.05, detail: 'x' };
  it('reads the engine fields defensively', () => {
    const v = overlayView({ ...base, choices: [{ id: 'n8', label: 'Accept all' }, { id: 'n9', label: ' Reject  non-essential ' }], revealed: false, edge: 'bottom' } as OverlayAction);
    expect(v.name).toBe('Cookie notice');
    expect(v.choices).toEqual([{ id: 'n8', label: 'Accept all' }, { id: 'n9', label: 'Reject non-essential' }]);
    expect(v.edge).toBe('bottom');
    expect(v.revealed).toBe(false);
  });
  it('falls back to a kind name and ignores junk', () => {
    const v = overlayView({ ...base, kind: 'survey', action: 'tucked', name: 42, choices: 'no', edge: 'middle', revealed: 'yes' } as unknown as OverlayAction);
    expect(v.name).toBe('Survey');
    expect(v.choices).toEqual([]);
    expect(v.edge).toBeNull();
    expect(v.revealed).toBe(false);
  });
});

describe('explain card states', () => {
  const none: JevMetrics = { model: 'jev-1.14.0', calls: 0, questions: 0, inputTokens: 0, wallMs: 0, serverMs: null, costUsd: 0 };
  const failed = (over: Partial<ExplainResult> & { error?: string } = {}): ExplainResult => ({
    ok: false, explanation: null, sentences: [], checks: { numbersKept: false, conditionWordsKept: false, addedFact: 0, droppedFact: 0 },
    showOriginalInstead: [], model: 'm', ms: 0, jev: none, ...over,
  } as ExplainResult);
  it('treats llm_unavailable as "could not write", never as a failed check', () => {
    const r = failed({ error: 'llm_unavailable' } as Partial<ExplainResult>);
    expect(writerUnavailable(r)).toBe(true);
    expect(jevAnswered(r)).toBe(false);
  });
  it('a result Jev answered is not "unavailable"', () => {
    const r = failed({ jev: { ...none, calls: 1, questions: 12 }, explanation: 'x' });
    expect(jevAnswered(r)).toBe(true);
    expect(writerUnavailable(r)).toBe(false);
    expect(writerUnavailable({ ...r, ok: true })).toBe(false);
  });
});
