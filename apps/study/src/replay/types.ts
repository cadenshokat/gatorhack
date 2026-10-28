// Frozen model answers for one replica (replicas/<id>/fixtures.json), recorded once on the dev machine against the real
// server and replayed on every phone. Versioned: a re-record replaces the whole file with the next version number.
//
// Keys are chosen to survive what changes between phones and frame heights:
// - understand: per element, the reader's id plus a fingerprint of the evidence that does not depend on layout
//   (tag, role hint, label, landmark, class words, link target, iframe kind); size, position and zone are left out;
// - meaning: sha256 of the request as posted (it is structure only);
// - overlayClose: sha256 of the overlay's and its buttons' fingerprints; the pick is kept as a button fingerprint;
// - compose: the group id (already a hash of the group's text).

import type {
  ComposeResult, ElementJudgment, JevMetrics, MeaningVerdict, OverlayCloseResult, PageUnderstanding,
} from '@webable/core';
import type { DeliveryRecord } from '../contracts';

export const FIXTURES_V = 'study-fixtures.1';
export const RECORDED_V = 'study-recorded.1';

/** One element's frozen judgment (elements and content regions alike: the server judges regions as elements). */
export interface ElementEntry {
  /** The reader's id when it was recorded ('n12'). */
  id: string;
  /** elementFp() of its evidence. */
  fp: string;
  /** The fingerprint appeared once in the digest it was recorded from (so it can be matched by fingerprint alone). */
  uniq: boolean;
  j: ElementJudgment;
  from: 'canonical' | 'union';
}

/** The page call's answers from the first successful whole-page read. */
export interface PageFields {
  purpose?: PageUnderstanding['purpose'];
  mainRegion?: PageUnderstanding['mainRegion'];
  mainPick: PageUnderstanding['mainPick'];
  metrics: JevMetrics;
  /** Every id the page fields can name (regions and elements of that digest): id -> [fingerprint, unique]. */
  ids: Record<string, [string, boolean]>;
}

/** Jev's pick of an overlay's own close button, with the pick kept as a button fingerprint (ids are per page view). */
export interface OverlayEntry {
  result: Omit<OverlayCloseResult, 'pick'>;
  /** The picked candidate: its fingerprint and which of the candidates with that fingerprint it was (0-based). */
  pick: { fp: string; nth: number } | 'none';
}

export interface ComposeMeta {
  model: string;
  ms: number;
  jev: JevMetrics;
}

/** The answers one page view collected in record mode (window.__studyFrame.recorded()). */
export interface RecordedAnswers {
  v: typeof RECORDED_V;
  replicaId: string;
  fit: string;
  h: number;
  fresh: boolean;
  understand: { page: PageFields | null; elements: ElementEntry[] };
  meaning: Record<string, MeaningVerdict>;
  overlayClose: Record<string, OverlayEntry>;
  compose: Record<string, ComposeResult>;
  composeMeta: ComposeMeta | null;
  /** Requests that failed (they are not frozen; replay treats them as misses). */
  errors: Array<{ what: string; code: string; error: string }>;
  /** Requests posted to the server on this page view. */
  posted: Record<string, number>;
}

/** One configuration of the recording matrix, as run. */
export interface FixtureRun {
  fit: string;
  h: number;
  canonical: boolean;
  /** ISO time. */
  at: string;
  /** How many answers this run added to the file (first answer wins). */
  added: { elements: number; page: boolean; meaning: number; overlayClose: number; compose: number };
  errors: RecordedAnswers['errors'];
  delivery: DeliveryRecord | null;
}

export interface ReplicaFixtures {
  v: typeof FIXTURES_V;
  replicaId: string;
  /** Bumped on every re-record ('3'). */
  version: string;
  servePath: string;
  originalHost: string;
  /** ReplicaManifest.contentHash when recorded: a different hash now means the copy changed and needs recording again. */
  replicaHash?: string;
  engineCommit: string;
  serverCommit: string;
  models: { jev: string; compose: string };
  recordedAt: string;
  matrix: { fits: string[]; heights: number[]; engines: string[]; canonical: { fit: string; h: number } };
  understand: { page: PageFields | null; elements: ElementEntry[] };
  meaning: Record<string, MeaningVerdict>;
  overlayClose: Record<string, OverlayEntry>;
  compose: Record<string, ComposeResult>;
  composeMeta: ComposeMeta | null;
  runs: FixtureRun[];
}

/** A request replay could not answer from the fixtures (also DeliveryRecord.replayMisses). */
export interface ReplayMiss {
  what: 'element' | 'page' | 'mainPick' | 'mainRegion' | 'meaning' | 'overlayClose' | 'compose' | 'fixtures';
  id?: string;
}
