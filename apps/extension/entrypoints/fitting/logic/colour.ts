// Sort the colours: a shortened Farnsworth D-15.
// One chip stays put as the start. The rest are placed in hue order.
// A jump of three or more steps is a crossing. Jumps between red and green, or yellow and blue,
// are noted as confusion axes. The score is how much help telling colours apart would be, from 0 to 100.
// FitProfile has no field for this yet. It is kept as an optional extra on the saved fit.

export interface ColourChip {
  id: string;
  hue: number;
  index: number;
}

export const CHIPS: readonly ColourChip[] = [
  { id: 'pilot', hue: 20, index: 0 },
  { id: 'c1', hue: 48, index: 1 },
  { id: 'c2', hue: 78, index: 2 },
  { id: 'c3', hue: 115, index: 3 },
  { id: 'c4', hue: 158, index: 4 },
  { id: 'c5', hue: 198, index: 5 },
  { id: 'c6', hue: 235, index: 6 },
  { id: 'c7', hue: 300, index: 7 },
];

export const PILOT: ColourChip = CHIPS[0] as ColourChip;
export const MOVABLE: readonly ColourChip[] = CHIPS.slice(1);

export type ConfusionAxis = 'red-green' | 'blue-yellow';

export interface ColourNeed {
  crossings: number;
  /** 0 = already in order. 100 = several crossings. */
  score: number;
  axes: ConfusionAxis[];
}

const byId = new Map(CHIPS.map((c) => [c.id, c]));

export function chipById(id: string): ColourChip | null {
  return byId.get(id) ?? null;
}

export function chipColor(hue: number): string {
  return `hsl(${hue} 68% 42%)`;
}

function axisOf(h1: number, h2: number): ConfusionAxis | null {
  const red = (h: number) => h <= 35 || h >= 345;
  const green = (h: number) => h >= 140 && h <= 180;
  const yellow = (h: number) => h >= 50 && h <= 95;
  const blue = (h: number) => h >= 200 && h <= 255;
  if ((red(h1) && green(h2)) || (green(h1) && red(h2))) return 'red-green';
  if ((yellow(h1) && blue(h2)) || (blue(h1) && yellow(h2))) return 'blue-yellow';
  return null;
}

/** `placedIds` is the row to the right of the fixed starting chip, from left to right. */
export function scoreArrangement(placedIds: readonly string[]): ColourNeed {
  const order = [PILOT.id, ...placedIds];
  let crossings = 0;
  const axes = new Set<ConfusionAxis>();
  for (let i = 0; i < order.length - 1; i++) {
    const a = chipById(order[i] as string);
    const b = chipById(order[i + 1] as string);
    if (!a || !b) continue;
    if (Math.abs(a.index - b.index) >= 3) {
      crossings += 1;
      const axis = axisOf(a.hue, b.hue);
      if (axis) axes.add(axis);
    }
  }
  // One or two crossings can be a slip. The petal grows only on a clear run of them.
  const score = crossings >= 3 ? Math.min(100, 55 + (crossings - 3) * 15) : 0;
  return { crossings, score, axes: [...axes] };
}
