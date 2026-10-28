// The experiment: which replica each participant sees, in which condition and order. Within-subjects, two blocked
// rounds (the websites as they are vs. with WebAble), each with one page from every family. Condition order and content
// set are counterbalanced over four sequences (a Latin square); invitations hand them out in shuffled blocks of four.
// Family order inside each round is shuffled from the participant's seed.

import { makeRng, shuffle } from '../../../extension/entrypoints/fitting/logic/rand';
import type { Condition, FamilyId, ReplicaManifest, SetId, TaskSpec } from '../contracts';

const manifests = import.meta.glob<ReplicaManifest>('../../replicas/*/manifest.json', { eager: true, import: 'default' });
const taskFiles = import.meta.glob<TaskSpec>('../../replicas/*/task.json', { eager: true, import: 'default' });

export const REPLICAS: Record<string, ReplicaManifest> = Object.fromEntries(
  Object.values(manifests).map((m) => [m.id, m]),
);
export const TASKS: TaskSpec[] = Object.values(taskFiles);

export const FAMILIES: FamilyId[] = ['news', 'sports', 'gov'];

export interface RoundPlan {
  condition: Condition;
  set: SetId;
}

/** Sequence → [round 1, round 2]. */
export const SEQUENCES: ReadonlyArray<readonly [RoundPlan, RoundPlan]> = [
  [{ condition: 'original', set: 'A' }, { condition: 'adapted', set: 'B' }],
  [{ condition: 'adapted', set: 'A' }, { condition: 'original', set: 'B' }],
  [{ condition: 'original', set: 'B' }, { condition: 'adapted', set: 'A' }],
  [{ condition: 'adapted', set: 'B' }, { condition: 'original', set: 'A' }],
];

export interface PlannedTask {
  task: TaskSpec;
  condition: Condition | 'practice';
  round: 0 | 1 | 2;
  position: number;
}

export interface StudyPlan {
  practice: PlannedTask | null;
  rounds: [PlannedTask[], PlannedTask[]];
  conditions: [Condition, Condition];
  /** Families with no replica yet (a build that is still being filled in). */
  missing: string[];
}

export function taskFor(family: FamilyId, set: SetId): TaskSpec | null {
  return TASKS.find((t) => t.family === family && t.set === set && REPLICAS[t.replicaId]) ?? null;
}

export function planFor(sequence: 0 | 1 | 2 | 3, seed: number): StudyPlan {
  const rng = makeRng(seed ^ 0x5eed);
  const seq = SEQUENCES[sequence] ?? SEQUENCES[0]!;
  const missing: string[] = [];
  const rounds = seq.map((r, i) => {
    const order = shuffle(FAMILIES, rng);
    const tasks: PlannedTask[] = [];
    for (const f of order) {
      const task = taskFor(f, r.set);
      if (!task) {
        missing.push(`${f}-${r.set}`);
        continue;
      }
      tasks.push({ task, condition: r.condition, round: (i + 1) as 1 | 2, position: tasks.length + 1 });
    }
    return tasks;
  }) as [PlannedTask[], PlannedTask[]];
  const p = TASKS.find((t) => t.family === 'practice' && REPLICAS[t.replicaId]);
  return {
    practice: p ? { task: p, condition: 'practice', round: 0, position: 1 } : null,
    rounds,
    conditions: [seq[0].condition, seq[1].condition],
    missing,
  };
}

/** Where the trial's page lives on the study site. */
export function pageUrl(task: TaskSpec): string {
  const m = REPLICAS[task.replicaId];
  return m ? m.servePath : '/';
}
