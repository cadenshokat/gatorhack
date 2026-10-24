// Owner: P, U. Pure parts of the in-page chrome: shortcuts, the offer's "why" split, overlay views, explain states,
// steady sizing at any page zoom, the corner dock and the page controls.
import { describe, expect, it } from 'vitest';
import { DEMO_FITS, type ExplainResult, type JevMetrics, type OverlayAction } from '@webable/core';
import type { EngineState } from '../../contracts';
import { jevAnswered, writerUnavailable } from '../explain/ExplainCard';
import { splitWhy } from '../offers/OfferCard';
import { overlayView } from '../offers/Overlays';
import { parseZoom } from '../zoom';
import { dockHeights, planDock, type DockInput } from './dock';
import { chromeSizing } from './hooks';
import { shortcutFor } from './keys';
import { columnButtons, columnLabel, textSizeLabel } from './Panel';

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
  it('maps Alt+Shift+[ and ] to page width narrower and wider, by physical key', () => {
    expect(shortcutFor(key('BracketLeft'))).toBe('narrower');
    expect(shortcutFor(key('BracketRight'))).toBe('wider');
    expect(shortcutFor(key('BracketLeft', { shift: false }))).toBeNull();
    expect(shortcutFor(key('BracketRight', { ctrl: true }))).toBeNull();
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

describe('steady size at any page zoom', () => {
  const rosa = DEMO_FITS.rosa;
  it('sizes from the fit only: scale and target never change with the zoom', () => {
    const a = chromeSizing(rosa, 1);
    for (const z of [1.25, 1.5, 2, 2.5, 3]) {
      const b = chromeSizing(rosa, z);
      expect(b.scale).toBe(a.scale);
      expect(b.target).toBeCloseTo(a.target, 6);
      // On screen: CSS px x page zoom. No floors, so the product is the same at every zoom.
      expect(b.u * z).toBeCloseTo(a.u, 6);
      expect(b.fontPx * z).toBeCloseTo(a.fontPx, 6);
      expect(b.targetPx * z).toBeCloseTo(a.targetPx, 6);
      expect(b.zoom * z).toBeCloseTo(b.scale, 6);
    }
  });
  it("keeps the person's minimum target on screen", () => {
    const s = chromeSizing(rosa, 2);
    expect(s.target * s.scale).toBeCloseTo(56, 6); // rosa: 56 px click areas
    expect(chromeSizing(null, 1.5).target * chromeSizing(null, 1.5).scale).toBeCloseTo(44, 6);
  });
  it('grows a little for large text, within bounds', () => {
    expect(chromeSizing(null, 1).scale).toBe(1);
    expect(chromeSizing(rosa, 1).scale).toBeGreaterThan(1);
    expect(chromeSizing({ ...rosa, text: { ...rosa.text, bodyPx: 64 } }, 1).scale).toBeLessThanOrEqual(20 / 15);
  });
  it('reads the zoom answer in its usual shapes and rejects junk', () => {
    expect(parseZoom(1.5)).toBe(1.5);
    expect(parseZoom({ factor: 2 })).toBe(2);
    expect(parseZoom({ zoom: 1.25 })).toBe(1.25);
    expect(parseZoom('2')).toBeNull();
    expect(parseZoom(0)).toBeNull();
    expect(parseZoom(Number.NaN)).toBeNull();
    expect(parseZoom(9)).toBeNull();
  });
});

describe('corner dock', () => {
  const base: DockInput = {
    vw: 1271, vh: 794, margin: 16, gap: 10, pillW: 150, pillH: 49, hasItems: false, itemsW: 360,
    panelOpen: false, panelW: 392, barH: null, barMaxW: 1080,
  };
  it('sits at the bottom margin with no cookie bar', () => {
    expect(planDock(base).minBottom).toBe(16);
  });
  it('stays above a centred cookie bar it would overlap', () => {
    const p = planDock({ ...base, barH: 82 });
    expect(p.barW).toBe(1080);
    expect(p.minBottom).toBe(16 + 82 + 10);
  });
  it('stays at the bottom beside the bar on a wide screen', () => {
    expect(planDock({ ...base, vw: 1800, barH: 82 }).minBottom).toBe(16);
    // An offer makes the dock wider: it needs more room beside the bar before it may stay at the bottom.
    expect(planDock({ ...base, vw: 1900, barH: 82, hasItems: true }).minBottom).toBe(16);
    expect(planDock({ ...base, vw: 1800, barH: 82, hasItems: true }).minBottom).toBe(108);
  });
  it('puts offers beside the open panel only when both fit', () => {
    expect(planDock({ ...base, hasItems: true, panelOpen: true }).itemsBeside).toBe(true);
    expect(planDock({ ...base, vw: 700, hasItems: true, panelOpen: true }).itemsBeside).toBe(false);
    expect(planDock({ ...base, hasItems: false, panelOpen: true }).itemsBeside).toBe(false);
  });
  it('gives the parts above the pill the rest of the height, and the pill gives way on short screens', () => {
    const h = dockHeights(794, 16, 16, 49, 8, false);
    expect(h.aboveMax).toBe(794 - 16 - 16 - 49 - 8);
    expect(h.pillWithPanel).toBe(true);
    const short = dockHeights(360, 16, 16, 49, 8, true);
    expect(short.pillWithPanel).toBe(false);
    expect(short.aboveMax).toBe(360 - 32);
  });
});

describe('page controls', () => {
  const col = (on: boolean, widthPx: number | null): EngineState['column'] => ({ on, widthPx, minPx: 720, maxPx: 1312 });
  it('says the column width in plain words', () => {
    expect(columnLabel(col(true, 960))).toBe('960 px column');
    expect(columnLabel(col(true, 959.6))).toBe('960 px column');
    expect(columnLabel(col(false, null))).toBe('Full width');
    expect(columnLabel(undefined)).toBe('Full width');
  });
  it('enables only the steps that can happen', () => {
    expect(columnButtons(col(true, 960))).toEqual({ narrower: true, wider: true, full: false });
    expect(columnButtons(col(true, 720))).toEqual({ narrower: false, wider: true, full: false });
    expect(columnButtons(col(true, 1312))).toEqual({ narrower: true, wider: false, full: false });
    expect(columnButtons(col(false, null))).toEqual({ narrower: true, wider: false, full: true });
  });
  it('shows the text size as the page zoom', () => {
    expect(textSizeLabel(1.5)).toBe('150%');
    expect(textSizeLabel(1.75)).toBe('175%');
    expect(textSizeLabel(Number.NaN)).toBe('100%');
  });
});
