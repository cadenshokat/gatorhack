import type { BrowserSettings, FitProfile } from '@webable/core';
import type { Env } from '../logic/env';
import type { BlockPlan } from '../logic/plan';
import type { RawCollector } from '../logic/raw';
import type { Rng } from '../logic/rand';

export interface BlockOutcome {
  trials: number;
  stop?: string;
}

/** What every block gets from the stage. A block renders its instruction, its overlay on the stage and its tray. */
export interface BlockProps {
  raw: RawCollector;
  env: Env;
  plan: BlockPlan;
  settings: BrowserSettings | null;
  /** The fit so far (the page shows the parts that have landed). */
  fit: FitProfile;
  paused: boolean;
  rng: Rng;
  onDone: (o: BlockOutcome) => void;
  /** Find's Stop press pauses the stage page's motion too. */
  onStopMotion?: () => void;
}
