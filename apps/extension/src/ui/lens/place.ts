// Owner: D2. Greedy chip placement: keep each chip next to its element and off the other chips.

export interface Rect { x: number; y: number; w: number; h: number }
export interface PlaceInput { id: string; box: Rect; chipW: number; chipH: number; priority: number }
export interface Placed { id: string; x: number; y: number; visible: boolean }

const GAP = 3;
const EDGE = 4;

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Elements that are off screen or have no size get no chip. Higher priority places first
 * (main action, then protected, then folded), so the chips that matter never get pushed.
 * `reserved` are areas chips must avoid (our header strip and drawer).
 */
export function placeChips(items: PlaceInput[], vw: number, vh: number, reserved: Rect[] = []): Placed[] {
  const order = [...items].sort((a, b) => b.priority - a.priority || a.box.y - b.box.y || a.box.x - b.box.x);
  const taken: Rect[] = [...reserved];
  const out: Placed[] = [];
  for (const it of order) {
    const { box, chipW: w, chipH: h } = it;
    const onScreen = box.w >= 2 && box.h >= 2 && box.x + box.w > 0 && box.y + box.h > 0 && box.x < vw && box.y < vh;
    if (!onScreen) {
      out.push({ id: it.id, x: 0, y: 0, visible: false });
      continue;
    }
    const clampX = (x: number) => Math.max(EDGE, Math.min(vw - w - EDGE, x));
    const clampY = (y: number) => Math.max(EDGE, Math.min(vh - h - EDGE, y));
    const inside = box.h >= h + 2 * GAP && box.w >= w + 2 * GAP;
    const cands: Array<[number, number]> = [
      [box.x, box.y - h - GAP], // above, left-aligned
      ...(inside ? [[box.x + GAP, box.y + GAP] as [number, number]] : []), // inside top-left
      [box.x + box.w - w, box.y - h - GAP], // above, right-aligned
      [box.x, box.y + box.h + GAP], // below
      [box.x + box.w + GAP, box.y], // right
      [box.x - w - GAP, box.y], // left
    ];
    let best: Rect | null = null;
    let bestCost = Infinity;
    let bestUnderReserved = false;
    for (const [cx, cy] of cands) {
      const r: Rect = { x: clampX(cx), y: clampY(cy), w, h };
      let cost = 0;
      let underReserved = false;
      for (const t of reserved) {
        const o = overlap(r, t);
        if (o > 0) underReserved = true;
        cost += o * 4; // our own header and drawer sit on top: a chip under them is worse than a chip on a chip
      }
      for (let k = reserved.length; k < taken.length; k++) cost += overlap(r, taken[k]!);
      // Prefer the earlier candidates when overlap ties (they read as "this chip belongs to that box").
      if (cost === 0) {
        best = r;
        bestCost = 0;
        bestUnderReserved = false;
        break;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = r;
        bestUnderReserved = underReserved;
      }
    }
    // A chip that could only sit under our own header or drawer is hidden rather than half-covered.
    if (!best || bestUnderReserved) {
      out.push({ id: it.id, x: 0, y: 0, visible: false });
      continue;
    }
    taken.push(best);
    out.push({ id: it.id, x: best.x, y: best.y, visible: true });
  }
  return out;
}
