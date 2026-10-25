// Owner: L. Plain words for Jev's page read (round 7). Every phrase a person sees is written here.
// Numbers are "Jev's probability". This file never says "confidence" or "chance".
//
// When a field is missing or empty, the helpers return null or an empty list so the Lens can keep the v2 view.
import type { ElementJudgment, FineRole, PageDigest, PagePurpose, PageUnderstanding } from '@webable/core';

export type FineFamily = 'content' | 'data' | 'task' | 'navigation' | 'help' | 'distraction' | 'other';

export type OutlineWeight = 'solid' | 'dashed' | 'hair';

/** Article plus the kind of page, so the header can say "a record and stats page". */
const PURPOSE: Record<PagePurpose, { article: string; name: string }> = {
  record_stats: { article: 'a', name: 'record and stats page' },
  scoreboard: { article: 'a', name: 'scoreboard' },
  schedule: { article: 'a', name: 'schedule' },
  standings: { article: 'a', name: 'standings page' },
  roster: { article: 'a', name: 'roster' },
  article: { article: 'an', name: 'article' },
  news_index: { article: 'a', name: 'news index' },
  recipe: { article: 'a', name: 'recipe' },
  product: { article: 'a', name: 'product page' },
  search_results: { article: 'a', name: 'search results page' },
  form_task: { article: 'a', name: 'form' },
  checkout: { article: 'a', name: 'checkout' },
  sign_in: { article: 'a', name: 'sign-in page' },
  account_dashboard: { article: 'an', name: 'account page' },
  bill_statement: { article: 'a', name: 'bill or statement' },
  appointment: { article: 'an', name: 'appointment page' },
  status_lookup: { article: 'a', name: 'status lookup' },
  info_guide: { article: 'a', name: 'guide' },
  faq: { article: 'a', name: 'questions and answers page' },
  directory_listing: { article: 'a', name: 'directory' },
  location_hours: { article: 'a', name: 'location and hours page' },
  calendar_dates: { article: 'a', name: 'calendar' },
  comparison: { article: 'a', name: 'comparison' },
  video: { article: 'a', name: 'video' },
  gallery: { article: 'a', name: 'gallery' },
  home_portal: { article: 'a', name: 'home page' },
  other: { article: 'another', name: 'kind of page' },
};

/** Fine role in plain words. Chip text uses these, capitalised as a title. */
export const FINE_WORDS: Record<FineRole, string> = {
  page_title: 'Page title',
  headline: 'Headline',
  dek_summary: 'Summary',
  body_text: 'Body text',
  byline: 'Byline',
  dateline: 'Dateline',
  lead_image: 'Lead image',
  figure: 'Figure',
  caption: 'Caption',
  quote: 'Quote',
  key_fact: 'Key fact',
  stat_value: 'Stat value',
  stat_label: 'Stat label',
  scoreboard: 'Scoreboard',
  team_or_org_logo: 'Team logo',
  data_table: 'Data table',
  table_row: 'Table row',
  chart: 'Chart',
  schedule_item: 'Schedule',
  standings: 'Standings',
  price: 'Price',
  rating: 'Rating',
  comparison_row: 'Comparison',
  ingredient_list: 'Ingredients',
  instruction_steps: 'Steps',
  recipe_meta: 'Recipe details',
  form_field: 'Form field',
  primary_action: 'Main action',
  secondary_action: 'Other action',
  step_indicator: 'Step',
  search_box: 'Search',
  filter_sort: 'Filter',
  result_item: 'Result',
  status_message: 'Status',
  site_logo: 'Site logo',
  site_nav: 'Site menu',
  section_nav: 'Section menu',
  breadcrumb: 'Breadcrumb',
  tabs: 'Tabs',
  pagination: 'Pages',
  back_link: 'Back',
  jump_link: 'Jump link',
  help_link: 'Help',
  contact_info: 'Contact',
  warning_notice: 'Warning',
  consent_notice: 'Consent notice',
  popup: 'Popup',
  advertising: 'Ad',
  sponsored: 'Sponsored',
  upsell_promo: 'Promotion',
  newsletter_signup: 'Newsletter sign-up',
  teaser_other_content: 'Teaser for other stories',
  social_share: 'Share',
  comments: 'Comments',
  video_autoplay: 'Autoplay video',
  carousel: 'Carousel',
  account_utility: 'Account',
  legal_footer: 'Legal',
  decorative: 'Decoration',
  other: 'Other',
};

/**
 * Colour family for a fine role. Recipe roles use the content colour: they are what a recipe page exists to show.
 * Account, legal and decoration have no family in the six, so they use a neutral chip.
 */
export const FINE_FAMILY: Record<FineRole, FineFamily> = {
  page_title: 'content',
  headline: 'content',
  dek_summary: 'content',
  body_text: 'content',
  byline: 'content',
  dateline: 'content',
  lead_image: 'content',
  figure: 'content',
  caption: 'content',
  quote: 'content',
  key_fact: 'content',
  stat_value: 'data',
  stat_label: 'data',
  scoreboard: 'data',
  team_or_org_logo: 'data',
  data_table: 'data',
  table_row: 'data',
  chart: 'data',
  schedule_item: 'data',
  standings: 'data',
  price: 'data',
  rating: 'data',
  comparison_row: 'data',
  ingredient_list: 'content',
  instruction_steps: 'content',
  recipe_meta: 'content',
  form_field: 'task',
  primary_action: 'task',
  secondary_action: 'task',
  step_indicator: 'task',
  search_box: 'task',
  filter_sort: 'task',
  result_item: 'task',
  status_message: 'task',
  site_logo: 'navigation',
  site_nav: 'navigation',
  section_nav: 'navigation',
  breadcrumb: 'navigation',
  tabs: 'navigation',
  pagination: 'navigation',
  back_link: 'navigation',
  jump_link: 'navigation',
  help_link: 'help',
  contact_info: 'help',
  warning_notice: 'help',
  consent_notice: 'help',
  popup: 'help',
  advertising: 'distraction',
  sponsored: 'distraction',
  upsell_promo: 'distraction',
  newsletter_signup: 'distraction',
  teaser_other_content: 'distraction',
  social_share: 'distraction',
  comments: 'distraction',
  video_autoplay: 'distraction',
  carousel: 'distraction',
  account_utility: 'other',
  legal_footer: 'other',
  decorative: 'other',
  other: 'other',
};

/** 0 distraction, 1 minor, 2 secondary, 3 supporting, 4 essential. */
export const IMPORTANCE_WORD = ['Distraction', 'Minor', 'Secondary', 'Supporting', 'Essential'] as const;

const FINE_SET = new Set<string>(Object.keys(FINE_WORDS));
const PURPOSE_SET = new Set<string>(Object.keys(PURPOSE));

export function isFineRole(v: unknown): v is FineRole {
  return typeof v === 'string' && FINE_SET.has(v);
}

export function isPagePurpose(v: unknown): v is PagePurpose {
  return typeof v === 'string' && PURPOSE_SET.has(v);
}

const clamp01 = (p: number): number => Math.min(1, Math.max(0, p));

export function fmtP(p: number): string {
  return (Number.isFinite(p) ? clamp01(p) : 0).toFixed(2);
}

export function capFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Article and name for a purpose kind. Unknown kinds still get a readable phrase. */
export function purposeReading(kind: string): { article: string; name: string } {
  if (isPagePurpose(kind)) return PURPOSE[kind];
  const name = kind.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) return { article: 'a', name: 'page' };
  return { article: /^[aeiou]/i.test(name) ? 'an' : 'a', name };
}

export interface PurposeLine {
  article: string;
  /** "record and stats page" — the header italicises this. */
  name: string;
  p: number;
  /** "Jev read this as a record and stats page (0.97)" */
  sentence: string;
  /** Same sentence for a screen reader, naming Jev's probability. */
  spoken: string;
}

/** Header line, or null when the purpose field is missing or has no kind and no probability. */
export function purposeLine(purpose: PageUnderstanding['purpose'] | null | undefined): PurposeLine | null {
  if (!purpose || typeof purpose !== 'object') return null;
  const kind = typeof purpose.kind === 'string' ? purpose.kind.trim() : '';
  const p = purpose.p;
  if (!kind || typeof p !== 'number' || !Number.isFinite(p)) return null;
  const reading = purposeReading(kind);
  const num = fmtP(p);
  return {
    article: reading.article,
    name: reading.name,
    p: clamp01(p),
    sentence: `Jev read this as ${reading.article} ${reading.name} (${num})`,
    spoken: `Jev read this as ${reading.article} ${reading.name}, Jev's probability ${num}.`,
  };
}

export interface ProbBar {
  id: string;
  name: string;
  p: number;
}

/** Top purpose kinds by Jev's probability. Empty when the field is missing or has no numbers. */
export function purposeBars(purpose: PageUnderstanding['purpose'] | null | undefined, limit = 5): ProbBar[] {
  if (!purpose || typeof purpose !== 'object') return [];
  const rows: ProbBar[] = [];
  const probs = purpose.probs;
  if (probs && typeof probs === 'object') {
    for (const [id, v] of Object.entries(probs)) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
      rows.push({ id, name: capFirst(purposeReading(id).name), p: clamp01(v) });
    }
  }
  rows.sort((a, b) => b.p - a.p || a.name.localeCompare(b.name));
  if (rows.length === 0 && typeof purpose.kind === 'string' && purpose.kind && typeof purpose.p === 'number' && Number.isFinite(purpose.p) && purpose.p > 0) {
    rows.push({ id: purpose.kind, name: capFirst(purposeReading(purpose.kind).name), p: clamp01(purpose.p) });
  }
  return rows.slice(0, limit);
}

export interface RegionPick {
  id: string;
  p: number;
  runnerUp: { id: string; p: number } | null;
}

/**
 * The region Jev picked, and the next-highest different id.
 * `{ id: 'none', p: 0, probs: {} }` counts as empty: there is nothing to draw.
 */
export function mainRegionPick(region: PageUnderstanding['mainRegion'] | null | undefined): RegionPick | null {
  if (!region || typeof region !== 'object') return null;
  const id = typeof region.id === 'string' ? region.id : '';
  if (!id) return null;
  const p = typeof region.p === 'number' && Number.isFinite(region.p) ? clamp01(region.p) : 0;
  const probs = region.probs && typeof region.probs === 'object' ? region.probs : {};
  const ranked = Object.entries(probs)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const any = p > 0 || ranked.length > 0;
  if (!any) return null;
  const runner = ranked.find(([rid]) => rid !== id);
  return {
    id,
    p,
    runnerUp: runner ? { id: runner[0], p: clamp01(runner[1]) } : null,
  };
}

/** 0–4, or null when the score is missing or outside that scale. 0 is a real answer (distraction), not "empty". */
export function importanceScore(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  if (n < 0 || n > 4) return null;
  return n;
}

export function importanceWord(score: number): string {
  return IMPORTANCE_WORD[score] ?? 'Secondary';
}

/** Essential and supporting are solid, distractions dashed, the two middle scores a hairline. */
export function importanceWeight(score: number): OutlineWeight {
  if (score <= 0) return 'dashed';
  if (score >= 3) return 'solid';
  return 'hair';
}

export interface FineBar {
  role: FineRole;
  name: string;
  family: FineFamily;
  p: number;
}

function asFineProbs(j: ElementJudgment): Record<string, number> | null {
  const extra = (j as ElementJudgment & { fineProbs?: unknown }).fineProbs;
  if (!extra || typeof extra !== 'object') return null;
  return extra as Record<string, number>;
}

/**
 * Fine-role bars for the hover card, highest first, at most five.
 * A `fineProbs` map on the judgment (not in the shared contract yet) supplies the distribution.
 * Without it, the single `fine` / `fineP` answer is one bar. Missing both returns [].
 */
export function fineRoleBars(j: ElementJudgment | null | undefined, limit = 5): FineBar[] {
  if (!j) return [];
  const probs = asFineProbs(j);
  if (probs) {
    const rows: FineBar[] = [];
    for (const [role, v] of Object.entries(probs)) {
      if (!isFineRole(role) || typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
      rows.push({ role, name: FINE_WORDS[role], family: FINE_FAMILY[role], p: clamp01(v) });
    }
    rows.sort((a, b) => b.p - a.p || a.name.localeCompare(b.name));
    if (rows.length) return rows.slice(0, limit);
  }
  if (!isFineRole(j.fine)) return [];
  const p = typeof j.fineP === 'number' && Number.isFinite(j.fineP) ? clamp01(j.fineP) : 0;
  return [{ role: j.fine, name: FINE_WORDS[j.fine], family: FINE_FAMILY[j.fine], p }];
}

export interface SettledFine {
  fine: FineRole | null;
  fineP: number | null;
  fineName: string | null;
  family: FineFamily | null;
  importance: number | null;
  weight: OutlineWeight | null;
}

const EMPTY_FINE: SettledFine = {
  fine: null, fineP: null, fineName: null, family: null, importance: null, weight: null,
};

/** What the Lens draws for one judgment. All nulls when the round-7 fields are absent. */
export function settledFine(j: ElementJudgment | null | undefined): SettledFine {
  if (!j) return EMPTY_FINE;
  const importance = importanceScore(j.importance);
  let fine: FineRole | null = null;
  let fineP: number | null = null;
  if (isFineRole(j.fine)) {
    fine = j.fine;
    // A missing probability stays blank. 0 is a real answer and still shows.
    fineP = typeof j.fineP === 'number' && Number.isFinite(j.fineP) ? clamp01(j.fineP) : null;
  } else {
    const top = fineRoleBars(j, 1)[0];
    if (top) {
      fine = top.role;
      fineP = top.p;
    }
  }
  if (!fine && importance == null) return EMPTY_FINE;
  return {
    fine,
    fineP,
    fineName: fine ? FINE_WORDS[fine] : null,
    family: fine ? FINE_FAMILY[fine] : null,
    importance,
    weight: importance == null ? null : importanceWeight(importance),
  };
}

/** True when the side sheet has a Page tab to show. */
export function hasPageRead(u: PageUnderstanding | null | undefined): boolean {
  if (!u) return false;
  return purposeBars(u.purpose).length > 0 || mainRegionPick(u.mainRegion) != null;
}

/** Label for a region or element id, from the digest (elements, then regions) or "none of these". */
export function regionLabel(id: string, labels: ReadonlyMap<string, string>, digest: PageDigest | null): string {
  if (id === 'none') return 'none of these';
  const known = labels.get(id);
  if (known) return known;
  const ev = digest?.elements.find((e) => e.id === id) ?? digest?.regions?.find((e) => e.id === id);
  const raw = (ev?.label || '').trim();
  return raw && raw !== '·' ? raw : id;
}
