// Round 3 package S: Explain end to end in real Chrome. Details come back from the server's own redaction, the
// selection box ignores Chrome's empty trailing line, and the card and pill land beside the text.
import { describe, expect, it } from 'vitest';
import { redactText, type ExplainResult } from '@webable/core';
import { restoreFromAnswer } from '../src/engine/explain';
import { selectionBox } from '../src/engine/select';
import { placeCard, unavailableText } from '../src/ui/explain/ExplainCard';
import { placePill } from '../src/ui/explain/ExplainAffordance';

const SUNCAP =
  "At the direction of the U.S. Department of Agriculture, Food and Nutrition Administration (FNA), Florida’s SUNCAP Program ended September 30, 2026. The Social Security Administration (SSA) will no longer determine eligibility for food assistance for households receiving Supplemental Security Insurance (SSI) in Florida.";

const result = (over: Partial<ExplainResult>): ExplainResult => ({
  ok: true, explanation: null, sentences: [], checks: { numbersKept: true, conditionWordsKept: true, addedFact: 0.1, droppedFact: 0.1 },
  showOriginalInstead: [], model: 'gpt-5.4-mini', ms: 1200, jev: { model: 'jev', calls: 1, questions: 4, inputTokens: 1, wallMs: 100, serverMs: 50, costUsd: 0 },
  ...over,
});

describe('restoreFromAnswer', () => {
  const ours = redactText(SUNCAP);
  const server = redactText(ours).replace(/[ \t]+/g, ' ').trim();

  it('puts back details the server redacted a second time', () => {
    // The server's second pass replaced words ours kept, so only its passage aligns those placeholders.
    const first = server.slice(0, server.indexOf('[date].') + '[date].'.length);
    expect(first).toMatch(/Department of \[name\].*\[name\]'s SUNCAP/);
    const explanation = first.replace('At the direction of', 'Following');
    const res = result({ explanation, sentences: [{ original: first, covered: 0.9 }], ...{ passage: server } });
    const out = restoreFromAnswer(res, SUNCAP, ours);
    expect(out.explanation).not.toMatch(/\[[a-z ]+\]/);
    expect(out.explanation).toContain('Department of Agriculture');
    expect(out.explanation).toContain('September 30, 2026');
    expect(out.explanation).toMatch(/Florida's SUNCAP|Florida’s SUNCAP/);
    // The sentence comes from the server's text, whose redaction straightened the apostrophe.
    expect(out.sentences[0]!.original.replace(/’/g, "'")).toBe(SUNCAP.slice(0, SUNCAP.indexOf('2026.') + 5).replace(/’/g, "'"));
  });

  it('falls back to our own redaction when the server sent no passage', () => {
    const explanation = 'The program ended [date].';
    const out = restoreFromAnswer(result({ explanation }), SUNCAP, ours);
    expect(out.explanation).toBe('The program ended September 30, 2026.');
  });
});

describe('selectionBox', () => {
  const r = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height });
  it('ignores the empty line box a triple-click adds at the start of the next block', () => {
    const box = selectionBox([r(100, 200, 600, 24), r(100, 224, 420, 24), r(100, 300, 0, 24)]);
    expect([box!.x, box!.y, box!.width, box!.height]).toEqual([100, 200, 600, 48]);
  });
  it('is null when nothing has a size', () => {
    expect(selectionBox([r(0, 0, 0, 0)])).toBeNull();
  });
});

describe('placement', () => {
  const base = { vw: 1440, vh: 900, cardW: 420, minH: 400, pillReserve: 96, pillWidth: 170, pillSide: 'right' as const, bottomReserve: 0 };
  const overlapsPassage = (p: ReturnType<typeof placeCard>, a: { x: number; y: number; w: number; h: number }, vh = 900) => {
    const top = p.top ?? vh - (p.bottom ?? 0) - p.maxHeight;
    const bottom = p.top !== null ? p.top + p.maxHeight : vh - (p.bottom ?? 0);
    return p.left < a.x + a.w && p.left + p.width > a.x && top < a.y + a.h && bottom > a.y;
  };
  it('puts the card beside the passage, on the left when the right has no room', () => {
    expect(placeCard({ ...base, anchor: { x: 100, y: 200, w: 600, h: 120 } })).toMatchObject({ where: 'right', left: 716 });
    expect(placeCard({ ...base, anchor: { x: 600, y: 200, w: 700, h: 120 } })).toMatchObject({ where: 'left', left: 164 });
  });
  it('takes a narrower side before covering anything', () => {
    const p = placeCard({ ...base, minW: 300, anchor: { x: 360, y: 200, w: 720, h: 300 } });
    expect(p.where).toBe('right');
    expect(p.width).toBeGreaterThanOrEqual(300);
    expect(p.width).toBeLessThan(420);
  });
  it('with no side room: below, above, or a scroll that makes room below; never over it', () => {
    const col = { ...base, vw: 1000, vh: 720, cardW: 425, minW: 304, minStack: 243 };
    const below = { x: 300, y: 120, w: 400, h: 200 };
    expect(placeCard({ ...col, anchor: below })).toMatchObject({ where: 'below', scrollBy: 0 });
    const above = { x: 300, y: 380, w: 400, h: 200 };
    const pa = placeCard({ ...col, anchor: above });
    expect(pa.where).toBe('above');
    expect(overlapsPassage(pa, above, 720)).toBe(false);
    // A paragraph as tall as SNAP's SUNCAP one (239..562 of a 720 px viewport), with no room at the sides.
    const suncap = { x: 300, y: 239, w: 400, h: 323 };
    const ps = placeCard({ ...col, anchor: suncap });
    expect(ps.where).toBe('below');
    expect(ps.scrollBy).toBeGreaterThan(0);
    expect(suncap.y - ps.scrollBy).toBeGreaterThanOrEqual(720 * 0.12);
  });
  it('a passage taller than the screen gets a sheet near the bottom', () => {
    const p = placeCard({ ...base, vw: 1000, anchor: { x: 40, y: 60, w: 920, h: 1200 } });
    expect(p.where).toBe('over');
    expect(p.top! + p.maxHeight).toBeLessThanOrEqual(900);
  });
  it('keeps the card clear of our bottom bar', () => {
    const p = placeCard({ ...base, bottomReserve: 120, anchor: { x: 100, y: 700, w: 600, h: 120 } });
    expect((p.top ?? 0) + p.maxHeight).toBeLessThanOrEqual(900 - 120);
  });
  it('puts the pill under the selection, or above it near the bottom', () => {
    expect(placePill({ x: 100, y: 200, w: 600, h: 48 }, 1440, 900, 132, 44)).toEqual({ left: 568, top: 256 });
    expect(placePill({ x: 100, y: 820, w: 600, h: 48 }, 1440, 900, 132, 44).top).toBe(768);
  });
});

describe('card wording', () => {
  it('shows the server sentence when nothing could be written', () => {
    const r = { ...result({ ok: false, explanation: null, jev: { model: 'jev', calls: 0, questions: 0, inputTokens: 0, wallMs: 0, serverMs: null, costUsd: 0 } }), error: 'llm_unavailable', message: "Couldn't write a plain version right now. The original is below." };
    expect(unavailableText(r)).toBe("Couldn't write a plain version right now. The original is below.");
  });
});
