// Named fits for the dev host and the recording matrix: core's three demo fits, plus two made by core's deriveFit from
// synthetic warm-up results on a phone, so the recording also covers bigger text and a low tolerance for clutter (the
// fit changes the meaning request and, a little, the simplified page's groups).

import { DEMO_FITS, deriveFit } from '@webable/core';
import type { FitProfile, FittingRaw } from '@webable/core';

const CREATED = '2026-10-27T00:00:00.000Z';

/** A ladder where sizes below `okPx` are read slowly and often wrongly. */
function ladder(okPx: number): FittingRaw['reading'] {
  const sizes = [12, 14, 16, 18, 20, 22, 24, 26, 28, 32];
  return {
    seedPx: okPx,
    ladder: sizes.map((px) => ({ px, ms: px >= okPx ? 2200 : 4800, correct: px >= okPx || px >= okPx - 2 && px % 4 === 0 })),
    faint: [
      { contrast: 7, correct: true }, { contrast: 4.5, correct: true }, { contrast: 3, correct: true }, { contrast: 2.2, correct: false },
    ],
    polarity: { lightMs: [2100, 2000, 2200], darkMs: [2300, 2250, 2400], stated: 'light' },
  };
}

function pointing(sizePx: number, hitRate: number): FittingRaw['pointing'] {
  const presses = Array.from({ length: 10 }, (_, i) => ({ dx: (i % 3) - 1, dy: (i % 2) * 2 - 1, hit: i / 10 < hitRate, slipped: false }));
  return { blocks: [{ sizePx, presses }, { sizePx: sizePx * 1.5, presses: presses.map((p) => ({ ...p, hit: true })) }] };
}

/** Bigger text: comfortable at 26 px, otherwise ordinary. */
export const RAW_LARGE: FittingRaw = {
  inputClass: 'touch',
  durationSec: 140,
  skipped: [],
  reading: ladder(26),
  pointing: pointing(44, 0.9),
  finding: {
    trials: [
      { clutter: false, motion: false, ms: 3200, found: true }, { clutter: true, motion: false, ms: 3900, found: true },
      { clutter: false, motion: true, ms: 3300, found: true }, { clutter: true, motion: true, ms: 4100, found: true },
    ],
    preferredCalm: 0,
    gotInWay: [],
  },
  allPresses: Array.from({ length: 30 }, () => ({ slipped: false, repeat: false })),
};

/** Low tolerance for clutter: busy pages took twice as long, the calmer page chosen twice, "too much on the page". */
export const RAW_CALM: FittingRaw = {
  inputClass: 'touch',
  durationSec: 150,
  skipped: [],
  reading: ladder(15),
  pointing: pointing(44, 0.9),
  finding: {
    trials: [
      { clutter: false, motion: false, ms: 3000, found: true }, { clutter: true, motion: false, ms: 7400, found: true },
      { clutter: false, motion: true, ms: 3400, found: true }, { clutter: true, motion: true, ms: 9800, found: false },
    ],
    preferredCalm: 2,
    gotInWay: ['too much on the page', 'popups'],
  },
  allPresses: Array.from({ length: 30 }, () => ({ slipped: false, repeat: false })),
};

export const FIT_NAMES = ['typical', 'rosa', 'reader', 'large', 'calm'] as const;
export type FitName = (typeof FIT_NAMES)[number];

export function fitByName(name: string): FitProfile | null {
  switch (name) {
    case 'typical':
    case 'rosa':
    case 'reader':
      return { ...structuredClone(DEMO_FITS[name]), createdAt: CREATED };
    case 'large':
      return { ...deriveFit(RAW_LARGE), createdAt: CREATED };
    case 'calm':
      return { ...deriveFit(RAW_CALM), createdAt: CREATED };
    default:
      return null;
  }
}
