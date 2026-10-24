// Shared contracts for WebAble. Every package codes against these types.
// Change them only in the integration pass, never inside one work package.

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const SERVER_ORIGIN = 'http://127.0.0.1:41741';
export const JEV_MODEL = 'jev-1.14.0';
export const JEV_USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;
export const LAYOUT_MODEL = 'gpt-6-sol';
export const DEEP_LAYOUT_MODEL = 'gpt-6.1-sol';
export const EXPLAIN_MODEL = 'gpt-5.4-mini';

/* ------------------------------------------------------------------ */
/* The person's fit (from the fitting; never contains condition words) */
/* ------------------------------------------------------------------ */

export type InputClass = 'mouse' | 'trackpad' | 'touch' | 'other' | 'keyboard';
export type ContrastBand = 'N' | 'M' | 'S'; // floor 4.5:1, 7:1, maximum
export type Polarity = 'light' | 'dark' | 'none';
export type StructureLevel = 0 | 1 | 2; // 2 = open the calm layout on busy pages

export interface FitProfile {
  v: 'fit.1';
  createdAt: string; // ISO date
  inputClass: InputClass;
  text: {
    /** Comfortable body text size in CSS px at 100% zoom (system font). */
    bodyPx: number;
    /** Critical print size in CSS px, if measured. */
    cpsPx: number | null;
    largePrint: boolean;
    conf: number;
    source: 'measured' | 'stated' | 'default';
    override: number | null;
  };
  contrast: { band: ContrastBand; floor: number };
  polarity: { value: Polarity; stated: Polarity | null };
  weight: { floor: number };
  spacing: { lineHeight: number; wordEm: number; letterEm: number };
  measure: { targetCpl: number; maxCpl: number; minCpl: number };
  targets: { minPx: number | null; conf: number };
  clicks: {
    steady: { on: boolean; windowMs: number; radiusPx: number };
    debounce: boolean;
  };
  attention: {
    motion: { p: number; on: boolean };
    clutter: { p: number };
    structureLevel: StructureLevel;
  };
  /** The person's own baselines, so live signals compare them with themselves. */
  baselines: {
    searchSecMedian: number | null;
    slipRate: number;
    repeatRate: number;
    missRate: number;
  };
  calibration: { version: string; durationSec: number; skipped: string[] };
}

/** Raw results the fitting page hands to core's deriveFit(). */
export interface FittingRaw {
  inputClass: InputClass;
  durationSec: number;
  skipped: string[];
  reading: {
    seedPx: number | null; // R1 chosen size
    ladder: Array<{ px: number; ms: number; correct: boolean }>; // R2 trials
    faint: Array<{ contrast: number; correct: boolean }>; // R3 trials (contrast ratio shown)
    polarity: {
      lightMs: number[];
      darkMs: number[];
      stated: Polarity | null;
    };
  } | null;
  pointing: {
    blocks: Array<{ sizePx: number; presses: Array<{ dx: number; dy: number; hit: boolean; slipped: boolean }> }>;
  } | null;
  finding: {
    trials: Array<{ clutter: boolean; motion: boolean; ms: number; found: boolean }>;
    preferredCalm: number; // 0..2 votes for the calmer page in F2
    gotInWay: string[]; // F3 chips, e.g. 'moving things', 'popups', 'too much on the page'
  } | null;
  /** Every press anywhere in the flow, for click stability. */
  allPresses: Array<{ slipped: boolean; repeat: boolean }>;
}

/** Coarse, diagnosis-free summary a generative model may see. */
export interface FitSummaryForModel {
  text_need: 'none' | 'some' | 'large';
  target_need: 'none' | 'some' | 'large';
  clutter_tolerance: 'high' | 'medium' | 'low';
  structure_level: StructureLevel;
  motion: 'fine' | 'reduce';
  polarity: Polarity;
}

/* ------------------------------------------------------------------ */
/* Page digest for Jev (structure only, personal details replaced)     */
/* ------------------------------------------------------------------ */

export type Zone =
  | 'header_band' | 'left_rail' | 'center_column' | 'right_rail' | 'full_width_mid'
  | 'footer_band' | 'overlay_top' | 'overlay_bottom' | 'overlay_center' | 'overlay_corner';

/** One element's evidence. Key order matters to Jev: keep this order when serialising. */
export interface ElementEvidence {
  id: string; // 'n<k>', shared with OutlineNode ids
  tag: string;
  role_hint: string;
  label: string; // <= 15 words, redacted
  zone: Zone;
  landmark: string;
  size: string; // '220 x 48 px'
  position: string; // 'middle, below the form'
  fixed: boolean;
  class_words: string[]; // <= 6
  visual_weight: 'low' | 'medium' | 'high';
  iframe_kind?: string; // from a bundled host->category table, never the hostname
  link_target?: 'same page' | 'this website' | 'another website';
  text_chars?: number;
  cards?: number;
}

export interface PageDigest {
  v: 'digest.1';
  page: {
    title: string; // redacted
    url_path: string; // path only, ids and numbers replaced
    headings: string[];
    landmarks: string[];
    viewport: string; // 'desktop, 1280 x 800'
    element_count: number;
  };
  elements: ElementEvidence[]; // <= 40 per Jev call; server splits larger sets
  mainCandidates: string[]; // ids, DOM order, <= 30
  hasSensitiveFields: boolean; // password or payment fields: no generative AI on this page
  lang: string;
}

/* ------------------------------------------------------------------ */
/* Jev results                                                         */
/* ------------------------------------------------------------------ */

export type Role =
  | 'main_content' | 'form_field' | 'action_button' | 'navigation' | 'search' | 'advertising'
  | 'recommendations' | 'popup_overlay' | 'consent_notice' | 'help_contact' | 'account_utility'
  | 'legal_footer' | 'other';

export interface JevMetrics {
  model: string;
  calls: number;
  questions: number;
  inputTokens: number;
  wallMs: number;
  serverMs: number | null; // from x-envoy-upstream-service-time
  costUsd: number;
}

export interface ElementJudgment {
  id: string;
  role: Role;
  roleP: number;
  roleProbs: Partial<Record<Role, number>>;
  task: number; // P(part of the main job)
  main: number; // P(is the main action)
  help: number; // P(help or contact)
}

export interface PageUnderstanding {
  elements: ElementJudgment[];
  mainPick: { id: string | 'none'; p: number; probs: Record<string, number> };
  metrics: JevMetrics;
  cached: boolean;
}

export type Verdict = 'protect' | 'fold' | 'keep' | 'promote' | 'keep_popup';

export interface ElementDecision {
  id: string;
  verdict: Verdict;
  reasons: string[]; // short, human-readable, e.g. 'advertising 0.97, task 0.02'
  judgment: ElementJudgment;
}

/* ------------------------------------------------------------------ */
/* Live struggle signals                                               */
/* ------------------------------------------------------------------ */

export type StruggleKind =
  | 'pointing' | 'slipping' | 'accidental_repeat' | 'reading' | 'dense_text'
  | 'finding' | 'form' | 'deliberate' | 'site_fault';

/** Counts computed in the content script over one window. */
export interface StruggleCounts {
  windowMs: number;
  timeOnPageSec: number;
  clicks: number;
  nearMissClicks: number;
  lostClicks: number;
  repeatClicks: number;
  deadClicks: number;
  wrongThenUndone: number;
  pathWobble: number; // 0..1, code-computed
  zoomInEvents: number;
  zoomLevel: number; // current page zoom factor
  scrollBacks: number;
  sidewaysScrolls: number;
  longPausesOnShortText: number;
  textSelections: number;
  popupsDismissed: number;
  hoverHunts: number;
  longFieldDwells: number;
  typingCorrections: number;
  progress: 'none' | 'some' | 'steady';
}

/** What Jev sees: bands relative to the person's own baseline, plus short evidence sentences code wrote. */
export interface StruggleSignals {
  page_kind: string;
  time_on_page: string;
  task_progress: string;
  [signal: string]: string;
}

export interface StruggleJudgment {
  level: number; // 0..3, score expected value
  kinds: Record<StruggleKind, number>;
  metrics: JevMetrics;
}

export type OfferKind =
  | 'bigger_targets' | 'steady_clicks' | 'debounce' | 'larger_text' | 'explain'
  | 'calm_view' | 'main_actions' | 'explain_field';

export interface Offer {
  kind: OfferKind;
  question: string; // 'Make buttons bigger on this page?'
  fact: string; // 'Some buttons here are small (20 px).'
  why: string; // shows the code's numbers and Jev's answer
  p: number;
}

/* ------------------------------------------------------------------ */
/* Outline for the generative model, and the layout spec it returns    */
/* ------------------------------------------------------------------ */

export type OutlineKind =
  | 'heading' | 'text' | 'button' | 'link' | 'field' | 'select' | 'checkbox' | 'radio'
  | 'image' | 'list' | 'table' | 'region' | 'media' | 'notice';

export interface OutlineNode {
  id: string; // 'n<k>'
  kind: OutlineKind;
  level?: number; // heading level
  label: string; // allowlisted interface words; other words become '·'
  shape?: string; // 'price', 'date', 'paragraph x5', 'list x12'
  parent?: string;
  landmark?: string;
  zone?: Zone;
  jevRole?: Role;
  protected?: boolean; // help, consent, warnings, required fields, focused or filled fields
}

export interface PageOutline {
  v: 'outline.1';
  nodes: OutlineNode[];
  pageTypeHint?: string;
}

export type SectionLabel =
  | 'Overview' | 'Buy' | 'Choose options' | 'Delivery and returns' | 'Details' | 'Specifications'
  | 'Safety information' | 'Reviews' | 'Questions' | 'Related items' | 'Sponsored' | 'Offers'
  | 'Navigation' | 'Site links' | 'Account' | 'Help' | 'Legal' | 'Search' | 'Cookies' | 'Notice'
  | 'Your details' | 'Address' | 'Date' | 'What you need' | 'Billing' | 'Review and submit'
  | 'Contact' | 'Results' | 'Filters' | 'Article' | 'Comments' | 'Media' | 'More on this page' | 'Other';

export interface FitSection {
  heading_ref: string | null;
  label: SectionLabel;
  role:
    | 'primary' | 'orient' | 'supporting' | 'reference' | 'social_proof' | 'related' | 'navigation'
    | 'promo' | 'ads' | 'help' | 'legal' | 'consent' | 'alert' | 'other';
  nodes: string[];
  layout:
    | 'hero' | 'buy_box' | 'card_grid' | 'row_list' | 'reading' | 'facts' | 'form_steps'
    | 'chip_bar' | 'link_grid' | 'gallery' | 'as_is';
  emphasis: 'lead' | 'normal' | 'quiet';
  state: 'open' | 'collapsed' | 'end_drawer';
  why:
    | 'main_task' | 'needed_before_acting' | 'reassurance' | 'not_needed_for_task' | 'long_list'
    | 'promotion' | 'advertising' | 'reference_info' | 'navigation' | 'protected';
  show_first: 0 | 3 | 4 | 6 | 8 | 12;
}

export interface FitSpec {
  page_type:
    | 'product_detail' | 'search_results' | 'listing' | 'article' | 'form' | 'home_portal'
    | 'account_dashboard' | 'video' | 'docs' | 'inbox' | 'feed' | 'other';
  task:
    | 'buy' | 'compare' | 'read' | 'search' | 'fill_form' | 'sign_in' | 'watch' | 'book' | 'pay'
    | 'navigate' | 'contact' | 'other';
  strip: string[];
  sections: FitSection[];
  primary_action: string | null;
  form_steps: Array<{ label: SectionLabel; fields: string[] }>;
  density: 'airy' | 'comfortable';
}

export interface LayoutCandidate {
  name: 'focus' | 'guided' | 'overview' | 'heuristic' | 'deep';
  spec: FitSpec;
  repairs: string[]; // what the local checker fixed
  pEasier?: number;
  pHides?: number;
  fitScore?: number; // 0..4
  composite?: number;
}

export interface RedesignResult {
  chosen: LayoutCandidate['name'];
  candidates: LayoutCandidate[];
  autoApply: boolean; // P(easier) >= 0.70 and P(hides) < 0.50
  llm: { model: string; ms: number; costUsd: number };
  judge: JevMetrics;
}

/* ------------------------------------------------------------------ */
/* Explain on request                                                  */
/* ------------------------------------------------------------------ */

export interface ExplainRequest {
  passage: string; // redacted twice (background and server)
  pageKind: string;
}

export interface ExplainResult {
  ok: boolean;
  explanation: string | null;
  sentences: Array<{ original: string; covered: number }>; // Jev coverage per original sentence
  checks: { numbersKept: boolean; conditionWordsKept: boolean; addedFact: number; droppedFact: number };
  showOriginalInstead: string[]; // original sentences shown because coverage was low
  model: string;
  ms: number;
  jev: JevMetrics;
}

/* ------------------------------------------------------------------ */
/* Visual self-check (Jev image input, experimental since 1.14)        */
/* ------------------------------------------------------------------ */

export interface VisualVerifyRequest {
  before: string; // base64 PNG, long side <= 1568
  after: string;
  controls: string[]; // labels of form controls the DOM digest says are present
  help: string[]; // labels of help links
  mainLabel: string | null;
}

export interface VisualVerdict {
  keepsControls: number;
  keepsHelp: number;
  clipped: number;
  faint: number;
  mainVisible: number | null;
  mainBox: { top: number; bottom: number; left: number; right: number } | null;
  rollback: boolean;
  metrics: JevMetrics;
}

/* ------------------------------------------------------------------ */
/* Adaptations, verification and the ledger                            */
/* ------------------------------------------------------------------ */

export type OpKind =
  | 'page_zoom' | 'text_map' | 'spacing' | 'contrast' | 'weight' | 'measure' | 'targets'
  | 'steady_clicks' | 'debounce' | 'motion' | 'dim' | 'promote_main' | 'unpin_sticky'
  | 'focus_ring' | 'calm_view';

export interface OpRecord {
  id: string;
  kind: OpKind;
  scope: 'page' | 'element';
  targetIds: string[];
  status: 'applied' | 'offered' | 'reversed' | 'skipped';
  reason: string;
}

export type CheckName =
  | 'clipping' | 'overlap' | 'contrast' | 'reachability' | 'content_loss' | 'hierarchy'
  | 'overflow' | 'reading_position' | 'visual';

export interface CheckResult {
  name: CheckName;
  pass: boolean;
  detail: string;
  opId?: string;
}

export interface LedgerEntry {
  at: number; // ms since page start
  source: 'fit' | 'jev' | 'check' | 'signals' | 'layout' | 'explain' | 'person';
  title: string; // plain sentence, e.g. 'Folded the promo carousel'
  detail?: string;
  p?: number;
  action?: 'applied' | 'offered' | 'reversed' | 'kept' | 'skipped' | 'waiting' | 'protected';
  opId?: string;
}

/** Per-tab state the background keeps, readable by the popup and the eval harness. */
export interface TabReport {
  url: string;
  phase: 'idle' | 'reading' | 'tailored' | 'understood' | 'calm' | 'error';
  fitApplied: boolean;
  ops: OpRecord[];
  checks: CheckResult[];
  ledger: LedgerEntry[];
  understanding: { metrics: JevMetrics; decisions: number; folded: number; protected: number; mainId: string | null } | null;
  struggle: StruggleJudgment | null;
  redesign: { chosen: string; autoApply: boolean; ms: number } | null;
  errors: string[];
}

/* ------------------------------------------------------------------ */
/* Messaging: content <-> background <-> server                        */
/* ------------------------------------------------------------------ */

export type BgRequest =
  | { type: 'understand'; digest: PageDigest }
  | { type: 'struggle'; signals: StruggleSignals }
  | { type: 'redesign'; outline: PageOutline; fit: FitSummaryForModel; roles: Record<string, Role> }
  | { type: 'explain'; req: ExplainRequest }
  | { type: 'visualVerify'; controls: string[]; help: string[]; mainLabel: string | null; phase: 'before' | 'after' }
  | { type: 'setZoom'; factor: number }
  | { type: 'getZoom' }
  | { type: 'getFit' }
  | { type: 'getSettings' }
  | { type: 'report'; report: TabReport };

export interface Settings {
  enabled: boolean;
  pausedOrigins: string[];
  lens: boolean;
  aiLayouts: boolean; // consent for the generative layout model
  explain: boolean;
  serverOrigin: string;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  pausedOrigins: [],
  lens: false,
  aiLayouts: true,
  explain: true,
  serverOrigin: SERVER_ORIGIN,
};
