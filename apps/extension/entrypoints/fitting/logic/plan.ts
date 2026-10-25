// The block queue, planned from what the browser already said (fitting brief round 4 §1 and §3). Settings answer what
// they can first; the warm-up only asks the page what is left.

import { textPriorPx, type BrowserSettings, type InputClass, type WarmupBlock } from '@webable/core';

export type BlockId = Exclude<WarmupBlock, 'confirm'>;
export const BLOCK_ORDER: BlockId[] = ['read', 'faint', 'point', 'find', 'pick'];

/** The five marks on the fit strip. */
export type MarkId = 'text' | 'contrast' | 'clicks' | 'calm' | 'colours';
export const MARKS: Array<{ id: MarkId; label: string }> = [
  { id: 'text', label: 'Text' },
  { id: 'contrast', label: 'Contrast' },
  { id: 'clicks', label: 'Clicks' },
  { id: 'calm', label: 'Calm' },
  { id: 'colours', label: 'Colours' },
];
export const MARK_OF: Record<BlockId, MarkId> = { read: 'text', faint: 'contrast', point: 'clicks', find: 'calm', pick: 'calm' };

export interface BlockPlan {
  queue: BlockId[];
  /** Blocks the settings answered (not shown), with the plain reason. */
  prefilled: Partial<Record<BlockId, string>>;
  /** Blocks left out for this person (e.g. Point for keyboard users). */
  notRun: BlockId[];
  /** Read's prior and starting size (effective px at 100%). */
  textPriorPx: number | null;
  readStartPx: number;
  /** Faint trials after the first easy one: 6, or 3 to check for the strongest band under "More contrast". */
  faintTrials: number;
  /** Find shows still pages only (Reduce motion). */
  stillOnly: boolean;
  /** Point starts at 44 px, or 56 px on touch. */
  touch: boolean;
  /** Colours pre-selected on the last screen. */
  colours: 'light' | 'dark' | 'none';
}

export function planBlocks(s: BrowserSettings | null, input: InputClass): BlockPlan {
  const prefilled: BlockPlan['prefilled'] = {};
  const notRun: BlockId[] = [];
  const queue: BlockId[] = [];
  const prior = textPriorPx(s);
  for (const b of BLOCK_ORDER) {
    if (b === 'faint' && s?.forcedColors) {
      prefilled.faint = 'Your system colours are kept.';
      continue;
    }
    if (b === 'point' && input === 'keyboard') {
      notRun.push('point');
      continue;
    }
    queue.push(b);
  }
  return {
    queue,
    prefilled,
    notRun,
    textPriorPx: prior,
    readStartPx: prior ? Math.min(96, Math.max(40, Math.round(2 * prior))) : 40,
    faintTrials: s?.contrastMore ? 3 : 6,
    stillOnly: !!s?.reducedMotion,
    touch: input === 'touch',
    colours: s?.forcedColors ? 'none' : s?.colorScheme === 'dark' ? 'dark' : 'light',
  };
}
