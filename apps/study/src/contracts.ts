// Contracts for the mobile study sandbox (apps/study). The shell (src/shell) runs the participant flow; each task's
// page is a frozen copy of a real website ("replica", replicas/<id>/) loaded in a same-origin iframe; the frame
// runtime (src/frame) measures what the person does there and, in the adapted condition, runs WebAble's real engine
// (apps/extension/src/engine + src/ui, unchanged) behind a chrome.* stand-in (src/shim) that replays model answers
// recorded once per replica (src/replay). Only the lead changes this file; others add optional fields and say so.

import type { FitProfile, FittingRaw, ReaderProfile } from '@webable/core';

export const PROTOCOL = 'mobile-replica-4.1.0';

/** The agreement's version, saved with "I agree to take part": the protocol's own number. */
export const CONSENT_VERSION = PROTOCOL.replace(/^mobile-replica-/, '');

/** The layout width every phone gets (shell viewport meta), so the fit, the replicas and the model answers agree. */
export const LAYOUT_WIDTH = 390;

export type Condition = 'original' | 'adapted';
export type SetId = 'A' | 'B';
export type FamilyId = 'news' | 'recipe' | 'sports' | 'gov';

/* ------------------------------------------------------------------ */
/* Replicas                                                            */
/* ------------------------------------------------------------------ */

/**
 * replicas/<id>/manifest.json. The page is served at `servePath` (the original site's own path, so the engine reads
 * the same url_path) from replicas/<id>/site/<file>; every other file of the copy is served at /_r/<id>/<path> from
 * replicas/<id>/site/<path>. The page's first <head> child is `<script type="module" src="/_study/frame.js"></script>`;
 * its own behaviour scripts are modules after it (so they run after the frame runtime).
 */
export interface ReplicaManifest {
  v: 'replica.1';
  id: string; // 'ap-vangogh'
  /** Path on the study origin, the same as the original page's path: '/article/van-gogh-starry-night-space-…'. */
  servePath: string;
  /** The HTML file inside replicas/<id>/site/ served at servePath. */
  file: string; // 'index.html'
  sourceUrl: string;
  originalHost: string; // 'apnews.com'
  siteName: string; // 'AP News'
  capturedAt: string; // ISO date-time
  capture: {
    tool: string;
    browser: string;
    viewport: { w: number; h: number; dpr: number };
    userAgent: string;
    /** What state the live page was in when captured (banners removed, sections closed, ads frozen…). */
    stateNotes?: string[];
  };
  licence: string;
  attribution: string;
  /** Behaviours re-implemented as local scripts: 'consent', 'sticky-header', 'ad-slot', 'video', 'accordion'… */
  behaviours: string[];
  /** What was removed from the live page: 'site scripts', 'trackers', 'live ad tags'… */
  removed: string[];
  /** sha256 over the served files, set by the capture/validate tooling. */
  contentHash: string;
  /** Live vs copy checks from validation (pixels, layout counts, behaviours). */
  validation?: Record<string, unknown>;
}

/**
 * One task on one replica (replicas/<id>/task.json). Two kinds:
 * - 'go' (protocol 2.1.0 on): reach a useful destination on the website. The person taps the link that would open it,
 *   on whatever route they like; the study asks "Is this what you were looking for?" and the task ends on Yes. Success
 *   is the outcome: the confirmed link goes to one of `targets`.
 * - 'find' (1.0.0 to 2.0.0): find a fact, then pick it from four choices (`choices`, `correct`).
 */
export interface TaskSpec {
  id: string; // 'news-A'
  replicaId: string;
  family: FamilyId | 'practice';
  set: SetId | 'practice';
  /** Absent means 'find' (task files from before protocol 2.1.0). */
  kind?: 'find' | 'go';
  /** The task as the bar under the website keeps it in view: 'Find the link that opens …, and tap it'. */
  prompt: string;
  /** The same task as a question, heading the answer sheet: 'What year did Kim go to France to look at the night sky?' */
  question?: string;
  /** The instruction page's heading: the goal in a few plain words ("Find more stories by the same reporter"). */
  title?: string;
  /**
   * What the person needs to know before opening the website, one short sentence per line: which website it is, the
   * situation to imagine, and "Your task: …".
   */
  context?: string;
  /** A 2 to 5 word reminder of the task (exports and logs). */
  short: string;
  /** The website in words, listed before a round's 10 statements: 'AP News, the story about a spacecraft going to Mars'. */
  label?: string;
  /** The same, shorter, for naming a round's websites in a list: 'the Mars story'. */
  tag?: string;
  /** 'find': four answers in display order ("I could not find it" is added by the shell), and the right one. */
  choices?: string[];
  correct?: number;
  /**
   * 'go': where the task is done. A link counts when where it goes (its path and query on the copy's site, or its full
   * address for another site; see linkKey in src/frame/hit.ts) equals one of these. Every route to it counts.
   */
  targets?: string[];
  /**
   * Words that identify the answer on the page, original or simplified, for "answer seen". For 'go', the words of a
   * link to the destination: "answer seen" then means a way to the destination was on screen.
   */
  answerText: string;
  /**
   * The same answer as WebAble's simplified page shows it, when that differs from `answerText` (its AI may lay a
   * sentence out as a short fact: "Time on Phobos: 100 days"). Checked against the recorded model answers by e2e.mjs.
   */
  answerTextSimplified?: string;
  /** CSS selector of the answer's element in the replica (original page); for 'go', every link to the destination. */
  answerSelector: string;
  /** Measured on the live page: how far down the answer sits, in screens of 844 px. */
  answerDepthScreens?: number;
}

/* ------------------------------------------------------------------ */
/* Shell <-> frame                                                     */
/* ------------------------------------------------------------------ */

/** What the frame learns about its trial: `window.parent.__studyHost.trial()`. */
export interface TrialConfig {
  trialId: string;
  task: TaskSpec;
  /** 'practice' behaves like 'original'. */
  condition: Condition | 'practice';
  fit: FitProfile;
  /** The iframe's base box in CSS px at zoom 1. */
  frame: { w: number; h: number };
  /** /_r/<replicaId>/fixtures.json */
  fixturesUrl: string;
  /**
   * 'record' only on the dev machine (scripts/record.mjs), with the server on 127.0.0.1:41741. 'live' (protocol 4.0.0,
   * adapted only): recorded page reads first, and the hosted server for what depends on the person (`ai`).
   */
  mode: 'replay' | 'record' | 'live';
  /** Live mode: the hosted WebAble server, and how this person likes to read (from the set-up questions). */
  ai?: { origin: string; reader: ReaderProfile | null };
  /** ReplicaManifest.originalHost: compose's page.host in record and live mode. */
  originalHost?: string;
}

/** The shell's side, set on the parent window as `__studyHost` before the iframe loads. */
export interface FrameHost {
  trial(): TrialConfig;
  /** Imitates tab zoom: the shell resizes the iframe to frame.w/f x frame.h/f and scales it by f. Returns f applied. */
  zoom(f: number): number;
  /** The page is ready to be shown (original: loaded, fonts, images; adapted: the engine has settled). */
  ready(info: { settleMs: number; late: boolean }): void;
  /** Something the protocol must know about (a replay miss, an engine error, a blocked navigation…). */
  note(kind: string, detail?: string): void;
  /**
   * 'go' tasks: the person tapped a link (on the page, or in WebAble's layer, which passes the tap to the page's own
   * link). Links never open; the shell asks whether this is what they were looking for.
   */
  picked?(p: LinkPick): void;
}

/** A link the person tapped: where it would go (linkKey) and its words (website text, never anything typed). */
export interface LinkPick {
  href: string;
  text: string;
}

/** The frame's side, set on the iframe window as `__studyFrame` once its runtime runs. */
export interface FrameApi {
  /** The participant pressed Start: measures count from now. */
  begin(): void;
  /** The participant ended the task: stop measuring and return what happened. */
  end(): FrameMetrics;
  /** Adapted only: what WebAble did on this page (the manipulation check). */
  delivery(): DeliveryRecord | null;
}

export interface TapRecord {
  /** ms since begin() */
  t: number;
  x: number;
  y: number;
  /** Where the tap landed: the replica page, or WebAble's own layer (the simplified page). */
  layer: 'page' | 'webable';
  /** The pointerdown hit an interactive element (link, button, control, summary, [role=button]…). */
  hit: boolean;
  /** Something was activated within 500 ms (a click on an interactive element, trusted or proxied). */
  activated: boolean;
  /** For a miss: distance in CSS px to the nearest visible interactive box; null for hits. */
  distPx: number | null;
  /** Tag of the activated or hit element ('a', 'button'…), never its text. */
  tag?: string;
}

/** Interaction measures from begin() to end(). No text, no typed values, no screenshots. */
export interface FrameMetrics {
  taps: number;
  misses: number;
  /** Misses within 24 CSS px of an interactive box (distances are kept in tapLog for 12/36 px checks). */
  nearMisses: number;
  activations: number;
  /** Taps on links: navigation is blocked and a neutral note shown, the same in both conditions. */
  linkAttempts: number;
  /** A second tap within 500 ms and 30 px of a tap that activated something. */
  repeatTaps: number;
  /** 3+ taps within 1000 ms, all within 30 px, at least one a miss or repeat. */
  rageEpisodes: number;
  /** Taps the engine's debounce swallowed (adapted only). */
  debounced: number;
  /** Sections opened (accordions, "show more"). */
  expands: number;
  /** Total scroll travel in screens, page and nested scrollers (the simplified page scrolls inside WebAble's layer). */
  scrollScreens: number;
  scrollReversals: number;
  /** The answer's sentence was on screen at some point. */
  answerSeen: boolean;
  answerSeenMs: number | null;
  /** The simplified page was showing at end(). */
  simplifiedAtEnd: boolean;
  tapLog: TapRecord[]; // first 400
}

/** What WebAble delivered on one adapted page view (from EngineState and the last TabReport). */
export interface DeliveryRecord {
  engineCommit: string;
  fixturesVersion: string;
  settleMs: number;
  phase: string;
  pageZoom: number;
  textZoom: number;
  /**
   * The engine's text map on a narrow screen whose width capped the zoom: every text size on the page × this factor
   * (body text is shown at textZoom × textScale). Absent when the zoom alone carried the size.
   */
  textScale?: number;
  /** Body text size in CSS px before and after (simplified page: the fit's size). */
  bodyPxBefore: number | null;
  bodyPxAfter: number | null;
  simplified: { open: boolean; auto: boolean };
  compose: { groups: number; laidOut: number; kept: number; failed: number };
  ops: Array<{ kind: string; status: string; reason?: string; source?: ChangeSource }>;
  checksFailed: number;
  decisions: { folded: number; protected: number; promoted: number };
  overlays: number;
  toasts: number;
  offers: number;
  replayMisses: Array<{ what: string; id?: string }>;
  /** At least one op stuck and something measurable changed. */
  delivered: boolean;
  /**
   * From protocol 4.0.0: the AI that answered live on this page. `layout`: 'used' = the AI-designed layout was on screen
   * from Start; 'chip' = it arrived after Start and was offered on the page; 'kept' = Jev kept the simple layout;
   * 'failed' = no AI layout came; 'none' = no simplified page or AI layouts off. `accepted`: offers the person said yes
   * to (bigger buttons, larger text…), which the next websites keep.
   */
  ai?: {
    live: boolean;
    reader: string | null;
    layout: 'used' | 'chip' | 'kept' | 'failed' | 'none';
    accepted: string[];
    calls: Array<{ what: string; ok: boolean; ms: number }>;
  };
}

/**
 * Who decided a change, from the engine's ledger: 'fit' = the person's own settings from the warm-up; 'jev' = the AI's
 * read of the page, recorded once per copy and replayed, so the same for everyone; 'check' = a safety check that held a
 * change back or undid it. Set on each of DeliveryRecord.ops from protocol 2.0.0.
 */
export type ChangeSource = 'fit' | 'jev' | 'check' | 'signals' | 'layout' | 'person';

/* ------------------------------------------------------------------ */
/* Session record (what is saved)                                      */
/* ------------------------------------------------------------------ */

export type Likert7 = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** A 1 to 10 rating; only the two ends carry words (protocol 3.0.0 to 4.0.0, the liking of each round). */
export type Rating10 = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface SusResponse {
  /** 1.2.0 (protocol 2.1.0): every one of the 7 answers carries words, not only the two ends. */
  instrument:
    | 'sus-brooke-1996-en-7pt-finstad-2010@1.0.0'
    | 'sus-brooke-1996-en-7pt-websites-awkward@1.1.0'
    | 'sus-brooke-1996-en-7pt-websites-awkward-all-labelled@1.2.0';
  /** Items 1..10 in the original order; null = not answered. */
  items: Array<Likert7 | null>;
  /** 0-100 (sum of contributions x 100/60); null unless all ten are answered. */
  score: number | null;
  answered: number;
  /** All ten identical, or two or more opposite pairs both answered 6+. */
  flagged: boolean;
  submittedAt: string | null;
}

/**
 * UMUX-Lite (Lewis, Utesch & Maher 2013): two statements, 1–7, every answer in words. Plain wording for this study:
 * "These websites let me do what I needed to do" (capabilities meet my requirements) and "These websites were easy
 * to use". Score = (item1 − 1 + item2 − 1) × 100 / 12, null unless both are answered.
 */
export interface UmuxResponse {
  instrument: 'umux-lite-lewis-2013-en-7pt-plain@1.0.0';
  items: [Likert7 | null, Likert7 | null];
  score: number | null;
  submittedAt: string | null;
}

/** 'chose': a 'go' task ended on "Yes, this is it" (see TrialRecord.chosen). */
export type EndAction = 'answered' | 'chose' | 'cant_find' | 'skipped' | 'technical';

/**
 * From protocol 4.0.0: how the person taps on the study's own question screens, before any website. The same simple
 * screens for everyone, so it is a baseline of their speed and accuracy (a covariate), and WebAble's AI compares their
 * tapping on the websites with it. A miss is a tap that lands on no button; `nearMisses` within 24 px of one.
 */
export interface TapBaseline {
  screens: number;
  taps: number;
  misses: number;
  nearMisses: number;
  /** A second tap within 500 ms and 30 px of the one before. */
  repeats: number;
  /** A tapped answer changed before Continue. */
  changes: number;
  /** Median ms from a question screen opening to its first answer tap. */
  medianAnswerMs: number | null;
  /** Median distance in px from a tap on an answer button to that button's centre. */
  medianOffCentrePx: number | null;
}

export interface TrialRecord {
  taskId: string;
  replicaId: string;
  family: TaskSpec['family'];
  set: TaskSpec['set'];
  condition: Condition | 'practice';
  /** 0 practice, 1 or 2 */
  round: 0 | 1 | 2;
  /** 1-based position in its round */
  position: number;
  startedAt: string;
  /** Visible time from Start to the end action (pauses and hidden time excluded). */
  activeMs: number;
  hiddenMs: number;
  hiddenEpisodes: number;
  endAction: EndAction;
  /** The task's kind (absent before protocol 2.1.0: 'find'). */
  kind?: 'find' | 'go';
  /** 'find': index into task.choices, -1 for "I couldn't find it", null when skipped. Always null for 'go'. */
  answer: number | null;
  /** From protocol 4.0.0: the 2 minutes on the website ran out, and the answer sheet opened by itself. */
  timedOut?: boolean;
  /** 'find': the right answer was picked. 'go': the confirmed link goes to a destination (chosen.meets). */
  correct: boolean;
  /**
   * 'go': every link the person tapped, in order: active ms at the tap, where it goes, its words, whether it reaches
   * the destination, and whether they confirmed it ("Yes, this is it") or went back ("No, keep looking").
   */
  picks?: Array<{ t: number; href: string; text: string; meets: boolean; confirmed: boolean }>;
  /** 'go': the link they confirmed, or null (gave up, skipped). */
  chosen?: { href: string; text: string; meets: boolean } | null;
  /**
   * Single Ease Question as asked: with seqScale 'easy-1', 1 = Very easy … 7 = Very hard (the owner's choice, 27 Oct
   * 2026). Without seqScale (earlier builds), 1 = Very difficult … 7 = Very easy. Null if left. From protocol 2.1.0
   * every answer has words (Very easy, Easy, Somewhat easy, Neither easy nor hard, Somewhat hard, Hard, Very hard).
   */
  seq: Likert7 | null;
  seqScale?: 'easy-1';
  /**
   * Pinch zoom on the shell during the task: zoomed = layout width ÷ visible width ≥ 1.10, and maxScale is that ratio
   * (1 = not zoomed). Before 28 Oct 2026 (late) it was visualViewport.scale, which reads above 1 at rest on phones wider
   * than 390 px (1.10 on 430 px phones), so those builds over-count pinch zoom on wide phones.
   */
  pinch: { used: boolean; maxScale: number; zoomedMs: number };
  /** From when the website started loading to when it was ready (behind its card, or behind earlier screens). */
  readyMs: number;
  /**
   * From protocol 4.1.0, live AI only: the website loaded behind the earlier screens for this long before its card came
   * up, so its AI work was under way. The wait at the card was about max(0, readyMs - preloadMs). Absent: it started
   * loading with its card.
   */
  preloadMs?: number;
  readyLate: boolean;
  orientationChanges: number;
  metrics: FrameMetrics | null;
  delivery: DeliveryRecord | null;
  error?: string;
}

/** The kinds of trouble with websites a person can say often happen to them (who the study is for, protocol 2.0.0). */
export type WebTrouble = 'getting_around' | 'finding' | 'understanding';

/** Race and ethnicity, the 2024 US federal categories (OMB SPD 15), any number of them. */
export type RaceEthnicity = 'aian' | 'asian' | 'black' | 'hispanic' | 'mena' | 'nhpi' | 'white';

export interface AboutYou {
  /**
   * Checks the person is 50 or over ('under_50' ends the study and nothing is saved). Asked before the agreement in
   * protocol 2.x, right after it from 3.0.0. Earlier builds asked any adult, with 'no_say'.
   */
  ageBand: '50-64' | '65-74' | '75-84' | '85+' | '18-29' | '30-49' | '75+' | 'no_say' | null;
  /** Asked with the age: what often happens to them on websites (at least one to take part). */
  troubles?: WebTrouble[];
  /** From 3.0.0, only to find anyone who took part twice. Never part of the results. */
  firstName?: string | null;
  /** From 3.0.0. */
  gender?: 'woman' | 'man' | 'another' | 'no_say' | null;
  /** From 3.0.0: ['no_say'] when they prefer not to say. */
  race?: Array<RaceEthnicity | 'no_say'> | null;
  /** From 3.0.0: comfort with phones, computers and websites, 1 = I rarely use them … 7 = Expert user. */
  techComfort?: Likert7 | null;
  zoomToRead: 'never' | 'sometimes' | 'often' | 'always' | null;
  tapWrong: 'never' | 'sometimes' | 'often' | 'always' | null;
  /** How they will hold the phone; they are asked to keep holding it that way. */
  held?: 'one_hand' | 'two_hands' | 'on_table' | 'other' | null;
}

export interface FinalAnswers {
  /** Which round they'd choose for browsing (before protocol 3.0.0; replaced by `liking`). */
  preferred?: 'round1' | 'round2' | 'same' | 'unsure' | null;
  /** "Did the 2 rounds feel different?" (from 27 Oct 2026; `noticed` is asked only after a yes). Asked blind. */
  different?: 'yes' | 'no' | 'unsure' | null;
  noticed: string;
  /**
   * From 3.0.0: how much they liked using each round's websites. Asked after "different", on screens that say which
   * round used WebAble. From 4.1.0, 7 answers in words, 1 = Disliked it a lot … 7 = Liked it a lot; before, 1 = Did not
   * like it at all … 10 = Liked it a great deal, with words only at the ends.
   */
  liking?: { 1: Likert7 | Rating10 | null; 2: Likert7 | Rating10 | null };
  /** "Anything that was hard to do", asked once at the end before protocol 2.0.0; now asked per round (`comments`). */
  difficulty?: string;
  /** F4 chips: 'helped', 'changed_setting', 'interrupted', 'broken', 'nothing'. */
  deviations: string[];
  other: string;
  /** Before 3.0.0: how much the copies looked and worked like the real websites, 1 = Not at all … 7 = Exactly. */
  realism?: Likert7 | null;
  /** From 3.0.0: how much the websites WebAble changed still looked and worked like the real ones (same words). */
  adaptedRealism?: Likert7 | null;
  /** "Should we use your answers?" (honesty check, Aust et al. 2013). Dropped in 3.0.0: the agreement covers it. */
  useMyData?: 'yes' | 'no' | null;
}

export interface DeviceInfo {
  userAgent: string;
  screen: { w: number; h: number; dpr: number };
  viewport: { w: number; h: number };
  touch: boolean;
  reducedMotion: boolean;
  darkMode: boolean;
  language: string;
  inputsSeen: Array<'touch' | 'mouse' | 'pen'>;
  /** Rendered height of a 16 px line: above 16 means the phone or browser enlarges text itself. */
  refLinePx?: number;
  coarse?: boolean;
  orientation?: string;
}

export interface SessionRecord {
  v: 'study-session.1';
  protocol: string;
  sessionId: string;
  /** From the invitation link; 'preview-…' for previews. */
  code: string;
  cohort: 'pilot' | 'main' | 'preview';
  sequence: 0 | 1 | 2 | 3;
  seed: number;
  engineCommit: string;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  stage: string;
  consent: { version: string; agreedAt: string } | null;
  /**
   * From 3.0.0 the agreement comes before the age questions: true once they show the person can take part. Nothing is
   * sent before this, so someone the study is not for still leaves with nothing recorded.
   */
  eligible?: boolean;
  about: AboutYou;
  device: DeviceInfo | null;
  calibration: { raw: FittingRaw | null; fit: FitProfile | null; durationSec: number; skipped: string[] } | null;
  /** From protocol 4.0.0: the set-up answers, and the reader the AI writes for (null without live AI). */
  setup?: {
    needs: Array<'small_text' | 'tap_wrong' | 'busy' | 'motion' | 'long_text'>;
    polarity: 'light' | 'dark';
    shape: 'steps' | 'points' | 'paragraphs';
    words: 'plain' | 'as_is';
    reader: ReaderProfile | null;
  };
  /** From protocol 4.0.0: tapping on the question screens before the first website. */
  baseline?: TapBaseline | null;
  /** From protocol 4.0.0: UMUX-Lite after each round, in place of the 10 SUS statements. */
  umux?: { 1: UmuxResponse | null; 2: UmuxResponse | null };
  trials: TrialRecord[];
  sus: { 1: SusResponse | null; 2: SusResponse | null };
  /** "What was it like to use these 3 websites?" after each round's statements (optional, from protocol 2.0.0). */
  comments?: { 1: string | null; 2: string | null };
  final: FinalAnswers | null;
  /** Deviations and technical notes, in order. */
  notes: Array<{ at: string; kind: string; detail?: string }>;
  withdrawn: boolean;
}
