// Round 8: the busy-page rule (the simplified page by default on busy reading pages).
import { describe, expect, it } from 'vitest';
import { BUSY_BARS, type BusyInput, busyVerdict, countDistractions, distractionShare } from './busy';

const ad = (p = 0.9) => ({ fine: 'advertising' as const, fineP: p });
const teaser = (p = 0.8) => ({ fine: 'teaser_other_content' as const, fineP: p });
const body = { fine: 'body_text' as const, fineP: 0.95, importance: 4 };

function input(over: Partial<BusyInput> = {}): BusyInput {
  return {
    purpose: { kind: 'news_index', p: 0.92 },
    mainRegion: { id: 'n4', p: 0.9 },
    elements: [body, ...Array.from({ length: 14 }, () => teaser())],
    share: 0.3,
    clutterP: 0.2,
    sensitive: false,
    meaningPass: true,
    interacted: false,
    pinned: false,
    ...over,
  };
}

describe('busy-page rule', () => {
  it('opens on a busy reading page', () => {
    const v = busyVerdict(input());
    expect(v.open).toBe(true);
    expect(v.count).toBe(14);
  });

  it('counts only the distraction family at p >= 0.7 (popup included, comments, not body text)', () => {
    expect(countDistractions([ad(0.69), ad(0.7), { fine: 'popup', fineP: 0.8 }, { fine: 'comments', fineP: 0.9 }, body, { fine: 'site_nav', fineP: 0.99 }])).toBe(3);
  });

  it('needs a reading purpose Jev is sure about', () => {
    expect(busyVerdict(input({ purpose: { kind: 'news_index', p: 0.79 } })).open).toBe(false);
    // Sure it is for reading, less sure which kind (a news home page): the reading kinds together count.
    expect(busyVerdict(input({ purpose: { kind: 'news_index', p: 0.64, probs: { news_index: 0.64, home_portal: 0.22, other: 0.14 } } })).open).toBe(true);
    expect(busyVerdict(input({ purpose: { kind: 'news_index', p: 0.64, probs: { news_index: 0.64, product: 0.3, other: 0.06 } } })).open).toBe(false);
    expect(busyVerdict(input({ purpose: { kind: 'form_task', p: 0.99 } })).open).toBe(false);
    expect(busyVerdict(input({ purpose: { kind: 'product', p: 0.99 } })).open).toBe(false);
    expect(busyVerdict(input({ purpose: null })).open).toBe(false);
    for (const kind of ['article', 'recipe', 'record_stats', 'scoreboard', 'schedule', 'standings', 'info_guide', 'faq', 'home_portal', 'directory_listing', 'comparison']) {
      expect(busyVerdict(input({ purpose: { kind, p: 0.85 } })).open).toBe(true);
    }
  });

  it('never replaces sign-in, checkout, account or statement pages, or pages with password or payment fields', () => {
    for (const kind of ['sign_in', 'checkout', 'account_dashboard', 'bill_statement']) {
      const v = busyVerdict(input({ purpose: { kind, p: 0.99 } }));
      expect(v.open).toBe(false);
      expect(v.reason).toMatch(/keep their own layout/);
    }
    expect(busyVerdict(input({ sensitive: true })).open).toBe(false);
    // Read as an article, but a fair chance it is a sign-in page: keep it.
    expect(busyVerdict(input({ purpose: { kind: 'article', p: 0.75, probs: { article: 0.75, sign_in: 0.25 } } })).open).toBe(false);
  });

  it('a quiet page stays as it is', () => {
    const v = busyVerdict(input({ elements: [body, teaser(), teaser(), ad()], share: 0.04 }));
    expect(v.open).toBe(false);
    expect(v.reason).toBe('the page is not busy');
  });

  it('a few big distractions make a page busy by their share of the page', () => {
    const few = [body, ad(), ad(), ad(), teaser()];
    expect(busyVerdict(input({ elements: few, share: BUSY_BARS.usual.share })).open).toBe(true);
    expect(busyVerdict(input({ elements: few, share: BUSY_BARS.usual.share - 0.01 })).open).toBe(false);
    // One huge ad alone is not a busy page.
    expect(busyVerdict(input({ elements: [body, ad()], share: 0.6 })).open).toBe(false);
  });

  it('lowers the bar when busy pages bother the person', () => {
    const some = [body, ...Array.from({ length: BUSY_BARS.sensitive.count }, () => teaser())];
    expect(busyVerdict(input({ elements: some, share: 0.02, clutterP: 0.3 })).open).toBe(false);
    const v = busyVerdict(input({ elements: some, share: 0.02, clutterP: 0.86 }));
    expect(v.open).toBe(true);
    expect(v.sensitiveBars).toBe(true);
  });

  it('needs clear main content: a main region Jev is sure of, or an important content block', () => {
    const noBody = Array.from({ length: 14 }, () => teaser());
    expect(busyVerdict(input({ mainRegion: { id: 'none', p: 0.95 }, elements: noBody })).open).toBe(false);
    expect(busyVerdict(input({ mainRegion: { id: 'n4', p: 0.6 }, elements: noBody })).open).toBe(false);
    expect(busyVerdict(input({ mainRegion: { id: 'n4', p: 0.6 }, elements: [{ fine: 'headline', fineP: 0.9, importance: 3 }, ...noBody] })).open).toBe(true);
    // An important-looking distraction does not count as main content.
    expect(busyVerdict(input({ mainRegion: null, elements: [{ ...teaser(), importance: 3 }, ...noBody] })).open).toBe(false);
  });

  it('needs the meaning check to pass', () => {
    expect(busyVerdict(input({ meaningPass: false })).open).toBe(false);
    expect(busyVerdict(input({ meaningPass: null })).open).toBe(false);
  });

  it('never swaps the page once the person has started using it', () => {
    const v = busyVerdict(input({ interacted: true }));
    expect(v.open).toBe(false);
    expect(v.reason).toMatch(/already started/);
  });

  it('keeps a site set to "Original page"', () => {
    expect(busyVerdict(input({ pinned: true })).open).toBe(false);
  });
});

describe('distraction share', () => {
  interface Box { id: string; kids: string[] }
  const contains = (a: Box, b: Box) => a.kids.includes(b.id);
  it('counts outermost boxes once', () => {
    const outer: Box = { id: 'a', kids: ['b'] };
    const inner: Box = { id: 'b', kids: [] };
    const other: Box = { id: 'c', kids: [] };
    expect(distractionShare([[inner, 100], [outer, 300], [other, 100]], 1000, contains)).toBeCloseTo(0.4);
    expect(distractionShare([[outer, 400]], 0, contains)).toBe(0);
  });

  it('leaves out a single box bigger than 40% of the page (a container or an overlay, not a part)', () => {
    const big: Box = { id: 'a', kids: ['b'] };
    const ad: Box = { id: 'b', kids: [] };
    expect(distractionShare([[big, 900], [ad, 50]], 1000, contains)).toBeCloseTo(0.05);
    expect(distractionShare([[big, 4000]], 1000, contains)).toBe(0);
  });
});
