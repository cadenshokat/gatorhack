// Owner: F. "What helps you": the words WebAble shows for what it has learned, built from the passive fit state.
// Pure, so the panel, the offer card and the popup say exactly the same thing, and the tests can check it.
//
// WebAble learns the need, never the cause. Every sentence here is about something that happened on a page or
// something the person chose ("you zoomed in on 4 sites this week"), never about the person's body, age or health.
import type { DimensionBelief, FitDimension, Offer, OfferKind, PassiveEvidence, PassiveFitState } from '@webable/core';

export const DIM_ORDER: readonly FitDimension[] = [
  'text_size', 'contrast', 'targets', 'steady_clicks', 'motion', 'clutter', 'reading_support', 'colors',
];

/** Short names, for headings and screen readers. */
export const DIM_LABEL: Readonly<Record<FitDimension, string>> = {
  text_size: 'Text size',
  contrast: 'Contrast',
  targets: 'Click areas',
  steady_clicks: 'Steady clicks',
  motion: 'Motion',
  clutter: 'Busy pages',
  reading_support: 'Reading help',
  colors: 'Colors',
};

export type HelpStatus = 'on' | 'suggested' | 'asking';
export type Dots = 1 | 2 | 3 | 4;

export interface HelpRow {
  dim: FitDimension;
  label: string;
  /** One plain sentence in the person's own actions (the belief's explanation, or a plain fallback). */
  sentence: string;
  source: DimensionBelief['source'];
  /** "From your Chrome settings", "From your warm-up", "Learned on 4 sites this week", "You set this". */
  chip: string;
  /** Filled dots out of four; never shown as a percentage. */
  dots: Dots;
  /** The dots in words, for screen readers and the tooltip. */
  sure: string;
  status: HelpStatus;
  /** "On", "Suggested", "Not sure". */
  statusLabel: string;
  /** "22 px" for text size and click areas, else null. */
  value: string | null;
  locked: boolean;
  canConfirm: boolean;
  canNotRight: boolean;
  canForget: boolean;
}

const STATUS_LABEL: Record<HelpStatus, string> = { on: 'On', suggested: 'Suggested', asking: 'Not sure' };
const STATUS_RANK: Record<HelpStatus, number> = { on: 0, suggested: 1, asking: 2 };

/** Needs the operating system sets (Reduce motion, Increase contrast, high-contrast colors), not Chrome. */
const SYSTEM_DIMS: ReadonlySet<FitDimension> = new Set<FitDimension>(['motion', 'contrast', 'colors']);

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function timeOf(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function dayStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole calendar days between `t` and `now` in local time (0 = today, 1 = yesterday). */
export function daysAgo(t: number, now: Date): number {
  return Math.round((dayStart(now.getTime()) - dayStart(t)) / 86_400_000);
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "today", "yesterday", "Tuesday" (within the week), else "Oct 12". */
export function relDay(iso: string | undefined | null, now: Date): string {
  const t = timeOf(iso);
  if (t === null) return '';
  const d = daysAgo(t, now);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  const date = new Date(t);
  if (d < 7) return WEEKDAY[date.getDay()] ?? '';
  return `${MONTH[date.getMonth()]} ${date.getDate()}`;
}

/** Hostname without "www.", for counting distinct sites. */
function siteOf(e: PassiveEvidence): string | null {
  const s = (e.site ?? '').trim().toLowerCase().replace(/^www\./, '');
  return s || null;
}

/** The evidence that pointed toward the need (what happened), most recent first. */
function supporting(b: DimensionBelief): PassiveEvidence[] {
  return (b.evidence ?? []).filter((e) => finite(e.weight) && e.weight > 0);
}

/** "today", "since yesterday", "this week" or "in the last 12 days": the span of the evidence. */
export function periodOf(evidence: PassiveEvidence[], now: Date, fallbackIso?: string): string {
  const times = evidence.map((e) => timeOf(e.at)).filter((t): t is number => t !== null);
  if (times.length === 0) {
    const t = timeOf(fallbackIso);
    if (t === null) return '';
    times.push(t);
  }
  const oldest = daysAgo(Math.min(...times), now);
  if (oldest <= 0) return 'today';
  if (oldest === 1) return 'since yesterday';
  if (oldest < 7) return 'this week';
  return `in the last ${oldest + 1} days`;
}

/** The belief's own count of sites (the engine's window), else the distinct sites in its evidence. */
function distinctSites(b: DimensionBelief, ev: PassiveEvidence[]): number {
  if (finite(b.sites) && b.sites > 0) return Math.round(b.sites);
  return new Set(ev.map(siteOf).filter((s): s is string => s !== null)).size;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Learned on 4 sites this week", "Learned on 1 site today", or "Learned from what you did". */
export function learnedChip(b: DimensionBelief, now: Date): string {
  const ev = supporting(b);
  const n = distinctSites(b, ev);
  const when = periodOf(ev, now, b.updatedAt);
  if (n <= 0) return 'Learned from what you did';
  return `Learned on ${plural(n, 'site')}${when ? ` ${when}` : ''}`;
}

/** Where a setting came from: the evidence says it best; otherwise Chrome for sizes, the system for the rest. */
function settingChip(b: DimensionBelief, mac: boolean): string {
  const said = `${b.evidence?.[0]?.what ?? ''} ${b.explanation ?? ''}`;
  const system = mac ? 'From your Mac settings' : "From your computer's settings";
  if (/\bChrome\b/.test(said)) return 'From your Chrome settings';
  if (/\b(Mac|macOS)\b/.test(said)) return 'From your Mac settings';
  if (/\b(touch ?screen|pointer)\b/i.test(said)) return 'From your device';
  if (/\b(Windows|system|computer|device)\b/i.test(said)) return system;
  return SYSTEM_DIMS.has(b.dim) ? system : 'From your Chrome settings';
}

export function sourceChip(b: DimensionBelief, now: Date, mac = false): string {
  switch (b.source) {
    case 'setting':
      return settingChip(b, mac);
    case 'warmup':
      return 'From your warm-up';
    case 'person':
      return 'You set this';
    case 'learned':
      return learnedChip(b, now);
    default:
      return 'Standard';
  }
}

/** Filled dots out of four, and the same in words. A setting or the person's own choice is certain. */
export function confidenceOf(b: Pick<DimensionBelief, 'p' | 'source' | 'locked'>): { dots: Dots; sure: string } {
  if (b.locked || b.source === 'person') return { dots: 4, sure: 'You chose this' };
  if (b.source === 'setting') return { dots: 4, sure: 'Set in your settings' };
  const p = finite(b.p) ? b.p : 0;
  if (p >= 0.9) return { dots: 4, sure: 'Very sure' };
  if (p >= 0.7) return { dots: 3, sure: 'Fairly sure' };
  if (p >= 0.4) return { dots: 2, sure: 'Not sure yet' };
  return { dots: 1, sure: 'A first guess' };
}

function statusOf(b: DimensionBelief): HelpStatus | null {
  if (b.action === 'apply') return 'on';
  if (b.action === 'offer') return 'suggested';
  if (b.action === 'ask') return 'asking';
  // A choice the person locked in stays listed (so it can be forgotten) even when nothing needs doing.
  return b.locked && b.source === 'person' && finite(b.p) && b.p >= 0.5 ? 'on' : null;
}

const FALLBACK_ON: Record<FitDimension, (v: number | null) => string> = {
  text_size: (v) => (v ? `Text is shown at ${Math.round(v)} px.` : 'Text is larger.'),
  contrast: () => 'Text is darker, so it stands out more.',
  targets: (v) => (v ? `Click areas are at least ${Math.round(v)} px.` : 'Click areas are bigger.'),
  steady_clicks: () => 'A small slip still clicks what you pressed.',
  motion: () => 'Moving parts are paused.',
  clutter: () => 'Busy pages open in Calm view.',
  reading_support: () => 'Explain is ready for hard passages.',
  colors: () => 'Colors are left to your own color settings.',
};

const FALLBACK_MAYBE: Record<FitDimension, string> = {
  text_size: 'Larger text may help.',
  contrast: 'Darker text may help.',
  targets: 'Bigger click areas may help.',
  steady_clicks: 'Steady clicks may help.',
  motion: 'Pausing moving parts may help.',
  clutter: 'Calm view may help on busy pages.',
  reading_support: 'Plain-words explanations may help.',
  colors: 'Labels beside colors may help.',
};

/**
 * A suggestion whose sentence is only the fact ("18 of your last 80 clicks landed just beside a button.") also says
 * what would change ("Bigger click areas may help."), so the row reads as a suggestion, not a verdict.
 */
function withSuggestion(said: string, b: Pick<DimensionBelief, 'dim' | 'source'>, status: HelpStatus): string {
  // Only learning suggests; a setting, the warm-up or the person's own choice states what is already so.
  if (!said || status === 'on' || b.source !== 'learned' || /\b(help|helps|would|may|might)\b|\?/i.test(said)) return said;
  const maybe = FALLBACK_MAYBE[b.dim];
  return maybe ? `${/[.!]$/.test(said) ? said : `${said}.`} ${maybe}` : said;
}

function valueOf(b: DimensionBelief): string | null {
  if (!finite(b.value) || b.value <= 0) return null;
  if (b.dim === 'text_size' || b.dim === 'targets') return `${Math.round(b.value)} px`;
  return null;
}

export function helpRow(b: DimensionBelief, now: Date, mac = false): HelpRow | null {
  const status = statusOf(b);
  if (!status) return null;
  const { dots, sure } = confidenceOf(b);
  const said = withSuggestion((b.explanation ?? '').replace(/\s+/g, ' ').trim(), b, status);
  const locked = Boolean(b.locked);
  return {
    dim: b.dim,
    label: DIM_LABEL[b.dim] ?? b.dim,
    sentence: said || (status === 'on' ? FALLBACK_ON[b.dim]?.(finite(b.value) ? b.value : null) : FALLBACK_MAYBE[b.dim]) || DIM_LABEL[b.dim],
    source: b.source,
    chip: sourceChip(b, now, mac),
    dots,
    sure,
    status,
    statusLabel: STATUS_LABEL[status],
    value: valueOf(b),
    locked,
    canConfirm: status !== 'on' && !locked,
    canNotRight: true,
    canForget: true,
  };
}

/** One row per need that is not 'none': what is on first, then suggestions, then open questions. */
export function helpRows(passive: PassiveFitState | null | undefined, now: Date = new Date(), mac = false): HelpRow[] {
  if (!passive || !passive.beliefs) return [];
  const rows: HelpRow[] = [];
  for (const dim of DIM_ORDER) {
    const b = passive.beliefs[dim];
    if (!b || typeof b !== 'object') continue;
    const row = helpRow({ ...b, dim }, now, mac);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || DIM_ORDER.indexOf(a.dim) - DIM_ORDER.indexOf(b.dim));
}

export type FeedbackAction = 'not_right' | 'forget' | 'confirm';

/** What a row says right after a correction of something WebAble learned (the usual case). */
export const FEEDBACK_NOTE: Readonly<Record<FeedbackAction, string>> = {
  not_right: 'Noted. WebAble will hold back on this.',
  forget: 'Forgotten. WebAble cleared what it learned here.',
  confirm: 'Done. This stays on until you change it.',
};

/**
 * What a row says right after the person corrects it, true to what the engine does with that correction: learning is
 * turned down (−2) or cleared; a need taken from Chrome, the system or the warm-up is turned off on every site, and the
 * setting itself is never touched; a choice the person made is released.
 */
export function feedbackNote(row: Pick<HelpRow, 'source' | 'chip'>, action: FeedbackAction): string {
  if (action === 'confirm') return FEEDBACK_NOTE.confirm;
  switch (row.source) {
    case 'setting': {
      const from = /^From (.+)$/.exec(row.chip)?.[1] ?? 'your settings';
      const what = from === 'your device' ? 'your device settings' : from;
      return `Turned off on every site. ${what.charAt(0).toUpperCase()}${what.slice(1)} are unchanged.`;
    }
    case 'warmup':
      return 'Turned off on every site. A new warm-up can turn it back on.';
    case 'person':
      return action === 'forget'
        ? 'Forgotten. Your choice and what WebAble learned here are cleared.'
        : 'Noted. Your choice is cleared, and WebAble will hold back on this.';
    default:
      return FEEDBACK_NOTE[action];
  }
}

/** The person has taken the warm-up (some need came from it), as far as the passive state shows. */
export function hasWarmup(passive: PassiveFitState | null | undefined): boolean {
  if (!passive?.beliefs) return false;
  return Object.values(passive.beliefs).some((b) => b && b.source === 'warmup');
}

/** What WebAble read from Chrome and the system, as short phrases ("20 px default text", "Reduce motion"). */
export function settingsLine(passive: PassiveFitState | null | undefined, mac = false): string | null {
  const s = passive?.settings;
  if (!s) return null;
  const parts: string[] = [];
  if (finite(s.defaultFontPx) && Math.round(s.defaultFontPx) !== 16) parts.push(`${Math.round(s.defaultFontPx)} px default text`);
  if (finite(s.defaultZoom) && Math.abs(s.defaultZoom - 1) > 0.01) parts.push(`${Math.round(s.defaultZoom * 100)}% default zoom`);
  if (finite(s.minFontPx) && s.minFontPx > 0) parts.push(`${Math.round(s.minFontPx)} px smallest text`);
  if (s.reducedMotion) parts.push('Reduce motion');
  if (s.contrastMore) parts.push('Increase contrast');
  if (s.forcedColors) parts.push('High-contrast colors');
  if (s.reducedTransparency) parts.push('Reduce transparency');
  if (parts.length === 0) return null;
  return `${mac ? 'From Chrome and your Mac' : 'From Chrome and your computer'}: ${parts.join(', ')}.`;
}

/* ------------------------------------------------------------------ offers */

/** The need an offer acts on, so its "Why this?" can show what the person did. */
export function offerDim(kind: OfferKind): FitDimension {
  switch (kind) {
    case 'larger_text':
      return 'text_size';
    case 'bigger_targets':
      return 'targets';
    case 'steady_clicks':
    case 'debounce':
      return 'steady_clicks';
    case 'explain':
    case 'explain_field':
      return 'reading_support';
    case 'calm_view':
    case 'main_actions':
    default:
      return 'clutter';
  }
}

const EVERY_SITE = /\b(every site|every website|all sites|all websites|everywhere|other sites|every page|across sites)\b/i;

/** An offer from what WebAble learned across sites (not from this page's struggle check). */
export function isPassiveOffer(o: Pick<Offer, 'question'>): boolean {
  return EVERY_SITE.test(o.question ?? '');
}

/**
 * The yes button of a learned offer: the action, short enough for one line (the question already says "on every
 * site"), so the two buttons stay equal and calm.
 */
const PASSIVE_PRIMARY: Record<OfferKind, string> = {
  larger_text: 'Make larger',
  bigger_targets: 'Make bigger',
  steady_clicks: 'Turn on',
  debounce: 'Turn on',
  calm_view: 'Use Calm view',
  explain: 'Turn on',
  main_actions: 'Show them',
  explain_field: 'Turn on',
};

export function passivePrimary(kind: OfferKind): string {
  return PASSIVE_PRIMARY[kind] ?? 'Yes';
}

export interface EvidenceLine {
  what: string;
  when: string;
}

/** What the person did that led here, most recent first: "You zoomed in to 150% on cnn.com" · "today". */
export function evidenceLines(b: DimensionBelief | null | undefined, now: Date, max = 4): { lines: EvidenceLine[]; more: number } {
  if (!b) return { lines: [], more: 0 };
  const ev = supporting(b)
    .slice()
    .sort((x, y) => (timeOf(y.at) ?? 0) - (timeOf(x.at) ?? 0));
  const seen = new Set<string>();
  const lines: EvidenceLine[] = [];
  for (const e of ev) {
    const what = (e.what ?? '').replace(/\s+/g, ' ').trim().replace(/\.$/, '');
    if (!what) continue;
    const when = relDay(e.at, now);
    const key = `${what}|${when}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({ what, when });
  }
  return { lines: lines.slice(0, max), more: Math.max(0, lines.length - max) };
}

/**
 * A fact for an offer in the person's own actions, built from the evidence: "You zoomed in on 2 sites today."
 * Used only when the engine's fact does not already speak about what the person did.
 */
export function actionFact(b: DimensionBelief | null | undefined, now: Date): string | null {
  if (!b) return null;
  const ev = supporting(b);
  if (ev.length === 0) return null;
  const n = distinctSites(b, ev);
  const when = periodOf(ev, now, b.updatedAt);
  const on = n > 0 ? ` on ${plural(n, 'site')}` : '';
  const tail = when ? ` ${when}` : '';
  switch (b.dim) {
    case 'text_size':
      return `You zoomed in${on}${tail}.`;
    case 'targets':
    case 'steady_clicks': {
      // Page records read "5 of 22 clicks on cvs.com landed just beside a button": add up the misses.
      let misses = 0;
      for (const e of ev) {
        const m = /(\d+) of \d+ clicks/.exec(e.what ?? '');
        misses += m ? Number(m[1]) : 1;
      }
      const verb = b.dim === 'targets' ? 'landed just beside a button' : 'slipped off what you pressed';
      return `${plural(misses, 'click')} ${verb}${on}${tail}.`;
    }
    case 'clutter':
      return `You closed pop-ups or skipped past clutter${on}${tail}.`;
    case 'reading_support':
      return `You went back over passages${on}${tail}.`;
    default:
      return null;
  }
}

/** The offer's fact, keeping the engine's when it already names the person's actions. */
export function offerFact(o: Pick<Offer, 'fact'>, b: DimensionBelief | null | undefined, now: Date): string {
  const fact = (o.fact ?? '').trim();
  if (/\b(you|your)\b/i.test(fact)) return fact;
  return actionFact(b, now) ?? fact;
}
