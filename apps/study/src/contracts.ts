// Contracts for the mobile study sandbox (apps/study). The shell (src/shell) runs the participant flow; each task's
// page is a frozen copy of a real website ("replica", replicas/<id>/) loaded in a same-origin iframe; the frame
// runtime (src/frame) measures what the person does there and, in the adapted condition, runs WebAble's real engine
// (apps/extension/src/engine + src/ui, unchanged) behind a chrome.* stand-in (src/shim) that replays model answers
// recorded once per replica (src/replay). Only the lead changes this file; others add optional fields and say so.

import type { FitProfile, FittingRaw } from '@webable/core';

export const PROTOCOL = 'mobile-replica-2.0.0';

/** The layout width every phone gets (shell viewport meta), so the fit, the replicas and the model answers agree. */
export const LAYOUT_WIDTH = 390;

export type Condition = 'original' | 'adapted';
export type SetId = 'A' | 'B';
export type FamilyId = 'news' | 'sports' | 'gov';

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

/** A find-the-fact task on one replica. replicas/<id>/task.json holds the replica's task. */
export interface TaskSpec {
  id: string; // 'news-A'
  replicaId: string;
  family: FamilyId | 'practice';
  set: SetId | 'practice';
  /** The task, as said before and during the website: 'Find out what year Kim went to France to look at the night sky'. */
  prompt: string;
  /** The same task as a question, heading the answer sheet: 'What year did Kim go to France to look at the night sky?' */
  question?: string;
  /** At most one sentence the card shows before the steps ("This weather forecast was saved on …"). */
  context?: string;
  /** A 2 to 5 word reminder of the task (exports and logs). */
  short: string;
  /** The website in words, listed before a round's 10 statements: 'AP News, the story about a spacecraft going to Mars'. */
  label?: string;
  /** The same, shorter, for naming a round's websites in a list: 'the Mars story'. */
  tag?: string;
  /** Four answers in display order. "I couldn't find it" is added by the shell. */
  choices: string[];
  correct: number;
  /** Words that identify the answer's sentence on the page, original or simplified, for "answer seen". */
  answerText: string;
  /**
   * The same answer as WebAble's simplified page shows it, when that differs from `answerText` (its AI may lay a
   * sentence out as a short fact: "Time on Phobos: 100 days"). Checked against the recorded model answers by e2e.mjs.
   */
  answerTextSimplified?: string;
  /** CSS selector of the answer's element in the replica (original page). */
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
  /** 'record' only on the dev machine (scripts/record.mjs), with the server on 127.0.0.1:41741. */
  mode: 'replay' | 'record';
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

export interface SusResponse {
  instrument: 'sus-brooke-1996-en-7pt-finstad-2010@1.0.0' | 'sus-brooke-1996-en-7pt-websites-awkward@1.1.0';
  /** Items 1..10 in the original order; null = not answered. */
  items: Array<Likert7 | null>;
  /** 0-100 (sum of contributions x 100/60); null unless all ten are answered. */
  score: number | null;
  answered: number;
  /** All ten identical, or two or more opposite pairs both answered 6+. */
  flagged: boolean;
  submittedAt: string | null;
}

export type EndAction = 'answered' | 'cant_find' | 'skipped' | 'technical';

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
  /** Index into task.choices, -1 for "I couldn't find it", null when skipped. */
  answer: number | null;
  correct: boolean;
  /**
   * Single Ease Question as asked: with seqScale 'easy-1', 1 = Very easy … 7 = Very hard (the owner's choice, 27 Oct
   * 2026). Without seqScale (earlier builds), 1 = Very difficult … 7 = Very easy. Null if left.
   */
  seq: Likert7 | null;
  seqScale?: 'easy-1';
  /**
   * Pinch zoom on the shell during the task: zoomed = layout width ÷ visible width ≥ 1.10, and maxScale is that ratio
   * (1 = not zoomed). Before 28 Oct 2026 (late) it was visualViewport.scale, which reads above 1 at rest on phones wider
   * than 390 px (1.10 on 430 px phones), so those builds over-count pinch zoom on wide phones.
   */
  pinch: { used: boolean; maxScale: number; zoomedMs: number };
  readyMs: number;
  readyLate: boolean;
  orientationChanges: number;
  metrics: FrameMetrics | null;
  delivery: DeliveryRecord | null;
  error?: string;
}

/** The kinds of trouble with websites a person can say often happen to them (who the study is for, protocol 2.0.0). */
export type WebTrouble = 'getting_around' | 'finding' | 'understanding';

export interface AboutYou {
  /**
   * From protocol 2.0.0 asked before the agreement, to check the person is 50 or over ('under_50' ends the study and
   * nothing is saved). Earlier builds asked any adult, with 'no_say'.
   */
  ageBand: '50-64' | '65-74' | '75-84' | '85+' | '18-29' | '30-49' | '75+' | 'no_say' | null;
  /** Asked with the age, before the agreement: what often happens to them on websites (at least one to take part). */
  troubles?: WebTrouble[];
  zoomToRead: 'never' | 'sometimes' | 'often' | 'always' | null;
  tapWrong: 'never' | 'sometimes' | 'often' | 'always' | null;
  /** How they will hold the phone; they are asked to keep holding it that way. */
  held?: 'one_hand' | 'two_hands' | 'on_table' | 'other' | null;
}

export interface FinalAnswers {
  /** Which round they'd choose for browsing. */
  preferred: 'round1' | 'round2' | 'same' | 'unsure' | null;
  /** "Did the 2 rounds feel different?" (from 27 Oct 2026; `noticed` is asked only after a yes). */
  different?: 'yes' | 'no' | 'unsure' | null;
  noticed: string;
  /** "Anything that was hard to do", asked once at the end before protocol 2.0.0; now asked per round (`comments`). */
  difficulty?: string;
  /** F4 chips: 'helped', 'changed_setting', 'interrupted', 'broken', 'nothing'. */
  deviations: string[];
  other: string;
  /** How real the pages felt, 1 = Not at all like the real websites … 7 = Exactly like them. */
  realism: Likert7 | null;
  /** "Should we use your answers?" (honesty check, Aust et al. 2013) */
  useMyData: 'yes' | 'no' | null;
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
  about: AboutYou;
  device: DeviceInfo | null;
  calibration: { raw: FittingRaw | null; fit: FitProfile | null; durationSec: number; skipped: string[] } | null;
  trials: TrialRecord[];
  sus: { 1: SusResponse | null; 2: SusResponse | null };
  /** "What was it like to use these 3 websites?" after each round's statements (optional, from protocol 2.0.0). */
  comments?: { 1: string | null; 2: string | null };
  final: FinalAnswers | null;
  /** Deviations and technical notes, in order. */
  notes: Array<{ at: string; kind: string; detail?: string }>;
  withdrawn: boolean;
}
