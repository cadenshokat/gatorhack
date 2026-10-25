// Find: four made-up sites, each shown calm and busy. Every page has the same 24 links in its calm and busy versions;
// only decoration changes.

import { TEMPLATES, type TemplateId } from '../content/mock';
import { pick, shuffle, type Rng } from './rand';

export type MotionSource = 'carousel' | 'ticker' | 'live';

export interface FindTrial {
  index: number;
  template: TemplateId;
  clutter: boolean;
  motion: boolean; // moving parts (or, under Reduce motion, one bright still promo)
  sources: MotionSource[];
  mirror: boolean;
  tiles: string[]; // tile labels in display order
  target: string;
  firstAdvanceMs: number;
}

export const FIND_TIMEOUT_MS = 12_000;

function trialOn(template: TemplateId, tiles: string[], target: string, clutter: boolean, motion: boolean, rng: Rng): FindTrial {
  return {
    index: 0,
    template,
    clutter,
    motion,
    sources: motion ? shuffle(['carousel', 'ticker', 'live'] as MotionSource[], rng).slice(0, 2) : [],
    mirror: false,
    tiles,
    target,
    firstAdvanceMs: 500 + Math.floor(rng() * 1000),
  };
}

/** Tile order with the target among the first eight (the first two rows), so every search starts with it on screen. */
function placeTarget(tiles: readonly string[], target: string, rng: Rng): string[] {
  const rest = tiles.filter((l) => l !== target);
  rest.splice(Math.floor(rng() * 8), 0, target);
  return rest;
}

/**
 * Find (onboarding spec, F1): 1 practice plus 8 trials, busy × moving (2 × 2, two of each). Trials are yoked: each
 * made-up site shows up once calm and once busy, so the busy page is compared with its own calm twin. Two sites
 * carry the moving parts and two stay still. Two pages of the same site never come back to back.
 */
export function planFind(rng: Rng): { practice: FindTrial; trials: FindTrial[] } {
  const templates = shuffle(Object.keys(TEMPLATES) as TemplateId[], rng);
  const trials: FindTrial[] = [];
  const used = new Map<TemplateId, string[]>();
  templates.forEach((tpl, k) => {
    const t = TEMPLATES[tpl];
    const motion = k % 2 === 1;
    const targets = shuffle(t.tiles, rng).slice(0, 2);
    used.set(tpl, targets);
    for (const [j, clutter] of [false, true].entries()) {
      const target = targets[j] as string;
      trials.push(trialOn(tpl, placeTarget(t.tiles, target, rng), target, clutter, motion, rng));
    }
  });
  let order = shuffle(trials, rng);
  for (let tries = 0; tries < 60 && order.some((x, i) => i > 0 && order[i - 1]?.template === x.template); tries++) {
    order = shuffle(trials, rng);
  }
  const pTpl = templates[0] as TemplateId;
  const pTiles = TEMPLATES[pTpl].tiles;
  const pTarget = pick(pTiles.filter((l) => !(used.get(pTpl) ?? []).includes(l)), rng);
  const practice = trialOn(pTpl, placeTarget(pTiles, pTarget, rng), pTarget, false, false, rng);
  return { practice, trials: order.map((x, i) => ({ ...x, index: i + 1 })) };
}
