// Find: four made-up pages, one per calm/busy × still/moving cell, each a different site so no page is learned
// (fitting brief round 4 §3). Every page has the same 24 links in its calm and busy versions; only decoration changes.

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

const CELLS: Array<{ clutter: boolean; motion: boolean }> = [
  { clutter: false, motion: false },
  { clutter: false, motion: true },
  { clutter: true, motion: false },
  { clutter: true, motion: true },
];

export function planFind(rng: Rng): FindTrial[] {
  const templates = shuffle(Object.keys(TEMPLATES) as TemplateId[], rng);
  const cells = shuffle(CELLS, rng);
  return cells.map((cell, k) => {
    const tpl = templates[k % templates.length] as TemplateId;
    const t = TEMPLATES[tpl];
    const target = pick(t.tiles, rng);
    const rest = shuffle(
      t.tiles.filter((l) => l !== target),
      rng,
    );
    // Targets sit in the first two tile rows, so every search starts with the target on screen.
    rest.splice(Math.floor(rng() * 8), 0, target);
    return {
      index: k,
      template: tpl,
      clutter: cell.clutter,
      motion: cell.motion,
      sources: cell.motion ? shuffle(['carousel', 'ticker', 'live'] as MotionSource[], rng).slice(0, 2) : [],
      mirror: rng() < 0.5,
      tiles: rest,
      target,
      firstAdvanceMs: 500 + Math.floor(rng() * 1000),
    };
  });
}
