// What WebAble did for this person in the round that used it, for the thank-you page, in two plain lists: what came
// from their own warm-up, and what came from the AI's read of each website (recorded once before the study, so its
// decisions were the same for everyone). Only changes the delivery records show, and only ones the person could see:
// while the simplified page is open it covers the website, so changes to the website under it are left out.

import type { DeliveryRecord, TrialRecord } from '../contracts';

type Op = DeliveryRecord['ops'][number];

/** Where a change came from when the delivery record has no source (builds before protocol 2.0.0, or no ledger line). */
const FROM_WARMUP_KINDS = new Set([
  'page_zoom', 'text_map', 'spacing', 'contrast', 'weight', 'measure', 'targets', 'steady_clicks', 'debounce', 'motion',
  'focus_ring', 'heading_scale', 'column',
]);

/**
 * Each change a person can notice on a phone, as a list item. Text size is said from the measured sizes instead; the
 * focus ring, steady clicks and the narrower page do nothing on a phone.
 */
const SAID: Partial<Record<string, string>> = {
  contrast: 'made the text darker',
  weight: 'made the text darker',
  spacing: 'put more space between lines of text',
  measure: 'made lines of text shorter',
  heading_scale: 'made headings bigger',
  targets: 'made buttons and links bigger',
  debounce: 'ignored a second tap that came very quickly after the first',
  motion: 'stopped things on the website from moving by themselves',
  unobstruct: 'moved boxes that covered the website out of the way',
  unpin_sticky: 'stopped the bar at the top of the website from following you down the page',
  dim: 'made less important parts of the website paler',
  promote_main: 'put an outline around the main button',
};

function sourceOf(op: Op): 'warmup' | 'ai' | null {
  if (op.source === 'fit') return 'warmup';
  if (op.source === 'jev') return 'ai';
  if (op.source) return null;
  return FROM_WARMUP_KINDS.has(op.kind) ? 'warmup' : 'ai';
}

export interface Debrief {
  /** List items after "From your warm-up, WebAble:". */
  warmup: string[];
  /** List items after "WebAble's AI looked at each website once … On your websites, it:". */
  ai: string[];
}

export function debriefFor(trials: TrialRecord[]): Debrief {
  const ds = trials
    .filter((t) => t.condition === 'adapted' && t.delivery)
    .map((t) => ({ family: t.family, d: t.delivery! }));
  const warmup = new Set<string>();
  const ai = new Set<string>();

  const bigger = ds.some(
    ({ d }) =>
      (d.textScale ?? 1) > 1.04 ||
      (d.bodyPxAfter != null && d.bodyPxBefore != null && d.bodyPxAfter > d.bodyPxBefore + 0.5),
  );
  if (bigger) warmup.add('made the text bigger');
  for (const { d } of ds) {
    if (d.simplified.open) continue;
    for (const op of d.ops) {
      const words = op.status === 'applied' ? SAID[op.kind] : undefined;
      const from = words ? sourceOf(op) : null;
      if (words && from) (from === 'warmup' ? warmup : ai).add(words);
    }
  }
  // The simplified page opens after the AI's check that it keeps the page's meaning. A story is "the story".
  const simpler = new Set(ds.filter(({ d }) => d.simplified.open).map(({ family }) => family));
  if (simpler.has('news')) ai.add('showed a simpler version of the news story');
  if (simpler.has('sports')) ai.add('showed a simpler version of the sports website');
  if (simpler.has('gov')) ai.add('showed a simpler version of the park website');

  return { warmup: [...warmup], ai: [...ai] };
}
