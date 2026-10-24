// Owner: L. Pure parts of the Jev Lens: display classes, placement, scrim, plain rule.
import { describe, expect, it } from 'vitest';
import { decideElements } from '@webable/core';
import type { ElementEvidence, ElementJudgment, PageDigest, PageUnderstanding, Role } from '@webable/core';
import { lensItems, mergedChip } from './display';
import { chipBudget, overlaps, placeChips, scrimPath, type PlaceItem } from './place';
import { compareRule, plainRule } from './rule';

function ev(id: string, over: Partial<ElementEvidence> = {}): ElementEvidence {
  return {
    id, tag: 'button', role_hint: 'button', label: id, zone: 'center_column', landmark: 'main', size: '100 x 40 px',
    position: 'middle', fixed: false, class_words: [], visual_weight: 'medium', ...over,
  };
}
function jd(id: string, role: Role, roleP: number, probs: Partial<Record<Role, number>>, task = 0.5, main = 0.1, help = 0.01): ElementJudgment {
  return { id, role, roleP, roleProbs: { [role]: roleP, ...probs }, task, main, help };
}

const digest: PageDigest = {
  v: 'digest.1',
  page: { title: 'Refill', url_path: '/refill', headings: [], landmarks: ['main'], viewport: 'desktop, 1280 x 720', element_count: 6 },
  elements: [
    ev('n1', { label: 'Confirm refill', size: '104 x 28 px', class_words: ['btn', 'confirm'] }),
    ev('n2', { label: 'Continue shopping', size: '210 x 48 px', class_words: ['btn', 'continue'], visual_weight: 'high' }),
    ev('n3', { tag: 'div', role_hint: 'region', label: 'Sponsored GlucoBoost', class_words: ['ad', 'slot'], size: '300 x 250 px' }),
    ev('n4', { tag: 'a', role_hint: 'link', label: 'Call your pharmacist', size: '160 x 20 px' }),
    ev('n5', { tag: 'div', role_hint: 'dialog', label: 'We value your privacy', class_words: ['cookie', 'banner'], zone: 'overlay_bottom', fixed: true, size: '1280 x 200 px' }),
    ev('n6', { tag: 'div', role_hint: 'region', label: 'Flu shot offer', class_words: ['hero'], size: '900 x 300 px' }),
  ],
  mainCandidates: ['n1', 'n2'],
  hasSensitiveFields: false,
  lang: 'en',
};

const u: PageUnderstanding = {
  elements: [
    jd('n1', 'action_button', 0.97, {}, 0.95, 0.99, 0.01),
    jd('n2', 'action_button', 0.6, { navigation: 0.3 }, 0.1, 0.05, 0.01),
    jd('n3', 'advertising', 0.98, {}, 0.02, 0, 0.01),
    jd('n4', 'help_contact', 0.99, {}, 0.2, 0, 0.99),
    jd('n5', 'consent_notice', 0.97, {}, 0.05, 0, 0.02),
    jd('n6', 'advertising', 0.7, { recommendations: 0.04 }, 0.1, 0, 0.02),
  ],
  mainPick: { id: 'n1', p: 0.95, probs: { n1: 0.95, n2: 0.03, none: 0.02 } },
  metrics: { model: 'jev-1.14.0', calls: 1, questions: 25, inputTokens: 9000, wallMs: 300, serverMs: 200, costUsd: 0.0004 },
  cached: false,
};

const decisions = decideElements(u, digest, { focusedIds: [], requiredIds: [], filledIds: [], consentIds: ['n5'], offsiteIds: [] });

describe('display classes', () => {
  const items = lensItems(digest, decisions, u);
  const by = new Map(items.map((i) => [i.id, i]));
  it('shows the number the policy acted on', () => {
    expect(by.get('n1')!.cls).toBe('main');
    expect(by.get('n1')!.num).toBe('0.95');
    expect(by.get('n3')!.cls).toBe('folded');
    expect(by.get('n3')!.chip).toBe('Folded · ad');
    expect(by.get('n3')!.num).toBe('0.98');
    expect(by.get('n4')!.cls).toBe('guarded');
    expect(by.get('n4')!.chip).toBe('Help');
    expect(by.get('n5')!.cls).toBe('guarded');
    expect(by.get('n5')!.num).toBe('rule');
    expect(by.get('n6')!.cls).toBe('unsure');
    expect(by.get('n6')!.num).toBe('0.74');
    expect(by.get('n2')!.cls).toBe('kept');
  });
  it('explains with the policy thresholds', () => {
    expect(by.get('n3')!.because).toEqual(['ads 0.98 ≥ 0.90', 'task 0.02 ≤ 0.20', 'help 0.01 ≤ 0.10']);
    expect(by.get('n6')!.because.join(' · ')).toContain('not sure: left alone');
  });
  it('merges chips with ranges', () => {
    const a = by.get('n3')!;
    const b = { ...a, id: 'x', p: 0.96 };
    expect(mergedChip([a, b])).toEqual({ words: '2 folded ·', num: '0.96–0.98' });
  });
  it('treats unanswered elements as pending, then kept when answers lack them', () => {
    expect(lensItems(digest, [], null).every((i) => i.cls === 'pending')).toBe(true);
  });
});

describe('placement', () => {
  const size = () => ({ w: 120, h: 22 });
  it('never overlaps chips and respects reserved areas', () => {
    const items: PlaceItem[] = [];
    for (let i = 0; i < 30; i++) {
      items.push({ id: `e${i}`, cls: i % 3 === 0 ? 'folded' : 'guarded', box: { x: 40 + (i % 6) * 200, y: 80 + Math.floor(i / 6) * 120, w: 150, h: 40 }, priority: 30 + i / 100 });
    }
    items.push({ id: 'main', cls: 'main', box: { x: 600, y: 400, w: 104, h: 28 }, priority: 61 });
    const reserved = [{ x: 0, y: 0, w: 1280, h: 60 }];
    const res = placeChips(items, { vw: 1280, vh: 720, reserved, budget: 12, prev: new Map(), size, mergePx: 0 });
    expect(res.chips.length).toBeLessThanOrEqual(12);
    expect(res.chips.some((c) => c.cls === 'main')).toBe(true);
    for (let i = 0; i < res.chips.length; i++) {
      const a = res.chips[i]!;
      for (const r of reserved) expect(overlaps(a, r)).toBe(false);
      for (let k = i + 1; k < res.chips.length; k++) expect(overlaps(a, res.chips[k]!)).toBe(false);
    }
    expect(res.listed.length + res.chips.reduce((n, c) => n + c.ids.length, 0)).toBe(items.length);
  });
  it('merges same-class neighbours within 48 px', () => {
    const items: PlaceItem[] = [
      { id: 'a', cls: 'folded', box: { x: 100, y: 100, w: 100, h: 50 }, priority: 40.9 },
      { id: 'b', cls: 'folded', box: { x: 230, y: 100, w: 100, h: 50 }, priority: 40.95 },
      { id: 'c', cls: 'guarded', box: { x: 360, y: 100, w: 100, h: 50 }, priority: 30.9 },
    ];
    const res = placeChips(items, { vw: 1280, vh: 720, reserved: [], budget: 12, prev: new Map(), size });
    const folded = res.chips.find((c) => c.cls === 'folded')!;
    expect(folded.ids.sort()).toEqual(['a', 'b']);
  });
  it('budget is 12 at 1280 x 720 and clamps to 6..14', () => {
    expect(chipBudget(1280, 720)).toBe(12);
    expect(chipBudget(640, 400)).toBe(6);
    expect(chipBudget(2560, 1440)).toBe(14);
  });
});

describe('scrim', () => {
  it('cuts disjoint holes: a folded child stays dim inside a lit parent', () => {
    const d = scrimPath(100, 100, [
      { r: { x: 10, y: 10, w: 80, h: 80 }, lit: true },
      { r: { x: 40, y: 40, w: 20, h: 20 }, lit: false },
    ]);
    const holes = d.split('M').length - 2;
    expect(holes).toBeGreaterThanOrEqual(3);
    expect(d.startsWith('M0 0H100V100H0Z')).toBe(true);
  });
  it('is just the outer rect when nothing is lit', () => {
    expect(scrimPath(50, 50, [{ r: { x: 0, y: 0, w: 10, h: 10 }, lit: false }])).toBe('M0 0H50V50H0Z');
  });
});

describe('plain rule', () => {
  it('picks the largest heavy main-area button and folds by keyword', () => {
    const r = plainRule(digest);
    expect(r.mainId).toBe('n2');
    expect(r.foldIds.sort()).toEqual(['n3', 'n5']);
    expect(r.helpIds).toEqual(['n4']);
  });
  it('says where it differs, never "wrong"', () => {
    const items = lensItems(digest, decisions, u);
    const d = compareRule(plainRule(digest), items);
    expect(d.agrees).toBe(false);
    expect(d.lines[0]).toBe('Main: rule → Continue shopping (210×48); Jev → Confirm refill 0.95.');
    expect(d.lines.join(' ')).toContain('Folded: rule 2, Jev 1, both 1.');
    expect(d.lines.join(' ').toLowerCase()).not.toContain('wrong');
  });
});
