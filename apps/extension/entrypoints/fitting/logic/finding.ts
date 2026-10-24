// F1 "Find it": the trial plan. 1 practice + 8 scored trials in 2 mini-blocks of 4. Every mini-block holds
// each clutter x motion cell once, and every page template is seen twice, differing in exactly one factor,
// so F2 can show a fair pair: the same page calm and busy, and the same page still and moving.

import { TEMPLATES, type TemplateId } from '../content/mock';
import { pick, shuffle, type Rng } from './rand';

export type MotionSource = 'carousel' | 'ticker' | 'live';

export interface FindTrial {
  index: number; // 0 = practice
  practice: boolean;
  template: TemplateId;
  clutter: boolean;
  motion: boolean; // moving things (or, under reduced motion, one bright still promo)
  sources: MotionSource[];
  mirror: boolean;
  tiles: string[]; // tile labels in display order
  target: string;
  firstAdvanceMs: number;
}

export interface FindPlan {
  trials: FindTrial[];
  /** Template shown calm and busy (both still): F2 question (a). */
  clutterPair: TemplateId;
  /** Template shown still and moving (both calm): F2 question (b). */
  motionPair: TemplateId;
}

type Cell = { clutter: boolean; motion: boolean };
const CS: Cell = { clutter: false, motion: false };
const BS: Cell = { clutter: true, motion: false };
const CM: Cell = { clutter: false, motion: true };
const BM: Cell = { clutter: true, motion: true };

export function planFinding(rng: Rng): FindPlan {
  const ids = shuffle(Object.keys(TEMPLATES) as TemplateId[], rng);
  const [A, B, C, D] = ids as [TemplateId, TemplateId, TemplateId, TemplateId];
  // A: clutter pair (still). B: clutter pair (moving). C: motion pair (calm). D: motion pair (busy).
  const block1: Array<[TemplateId, Cell]> = [[A, CS], [B, BM], [C, CM], [D, BS]];
  const block2: Array<[TemplateId, Cell]> = [[A, BS], [B, CM], [C, CS], [D, BM]];
  const order = [...shuffle(block1, rng), ...shuffle(block2, rng)];

  // Each template's two pages keep the target in the same grid cell but mirrored left/right.
  const cellFor = new Map<TemplateId, number>();
  const mirrorFor = new Map<TemplateId, boolean>();
  const seen = new Map<TemplateId, string>();
  const trials: FindTrial[] = [];

  const practiceTpl = pick(ids, rng);
  const practice = makeTrial(0, true, practiceTpl, CS, rng, Math.floor(rng() * 12), false);
  trials.push(practice);
  seen.set(practiceTpl, practice.target);

  order.forEach(([tpl, cell], k) => {
    const cellIndex = cellFor.get(tpl) ?? Math.floor(rng() * 12);
    cellFor.set(tpl, cellIndex);
    const prevMirror = mirrorFor.get(tpl);
    const mirror = prevMirror === undefined ? rng() < 0.5 : !prevMirror;
    mirrorFor.set(tpl, mirror);
    const t = makeTrial(k + 1, false, tpl, cell, rng, cellIndex, mirror, seen.get(tpl));
    seen.set(tpl, t.target);
    trials.push(t);
  });

  return { trials, clutterPair: A, motionPair: C };
}

function makeTrial(
  index: number,
  practice: boolean,
  tpl: TemplateId,
  cell: Cell,
  rng: Rng,
  cellIndex: number,
  mirror: boolean,
  avoid?: string,
): FindTrial {
  const t = TEMPLATES[tpl];
  const pool = t.tiles.filter((l) => l !== avoid);
  const target = pick(pool, rng);
  const rest = shuffle(
    t.tiles.filter((l) => l !== target),
    rng,
  );
  rest.splice(cellIndex, 0, target);
  const sources = shuffle(['carousel', 'ticker', 'live'] as MotionSource[], rng).slice(0, 2);
  return {
    index,
    practice,
    template: tpl,
    clutter: cell.clutter,
    motion: cell.motion,
    sources: cell.motion ? sources : [],
    mirror,
    tiles: rest,
    target,
    firstAdvanceMs: 500 + Math.floor(rng() * 1000),
  };
}

export const FIND_TIMEOUT_MS = 12_000;
