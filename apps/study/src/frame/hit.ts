// What counts as interactive, what a tap pressed, where a link would go, and how far a miss was from the nearest
// control. Works on composedPath(), so it sees inside WebAble's open shadow roots (the simplified page).

/** methods §3.1: the pilot logger's ACT selector plus ARIA roles. */
export const INTERACTIVE = [
  'a[href]', 'area[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea', 'summary', 'label',
  '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]', '[role="checkbox"]', '[role="switch"]',
  '[onclick]', '[tabindex]:not([tabindex^="-"])',
].join(', ');

export const WEBABLE_TAG = 'WEBABLE-UI';

function isElement(x: EventTarget | null | undefined): x is Element {
  return !!x && (x as Node).nodeType === 1;
}

/** The first interactive element on the event's path (the pressed or activated control), or null. */
export function interactiveIn(path: readonly EventTarget[]): Element | null {
  for (const t of path) {
    if (!isElement(t)) continue;
    if (t.tagName === WEBABLE_TAG) return null;
    try {
      if (t.matches(INTERACTIVE)) return t;
    } catch {
      /* odd elements in odd documents */
    }
  }
  return null;
}

/** The path goes through WebAble's own layer (its host element). */
export function inWebAble(path: readonly EventTarget[]): boolean {
  return path.some((t) => isElement(t) && t.tagName === WEBABLE_TAG);
}

/** The first link on the path (a[href] or area[href]). */
export function linkIn(path: readonly EventTarget[]): HTMLAnchorElement | HTMLAreaElement | null {
  for (const t of path) {
    if (!isElement(t)) continue;
    const tag = t.tagName;
    if ((tag === 'A' || tag === 'AREA') && t.hasAttribute('href')) return t as HTMLAnchorElement | HTMLAreaElement;
  }
  return null;
}

/**
 * Where activating this link would go: 'leave' for any other document (another page, a new tab, a download, a reload),
 * 'fragment' for a jump within this page, null when it does not navigate (javascript:, no href).
 */
export function linkKind(link: Element, here: { href: string }): 'leave' | 'fragment' | null {
  const raw = (link.getAttribute('href') ?? '').trim();
  if (!raw || /^javascript:/i.test(raw)) return null;
  if (link.hasAttribute('download')) return 'leave';
  const target = (link.getAttribute('target') ?? '').trim().toLowerCase();
  if (target && target !== '_self') return 'leave';
  let url: URL;
  let cur: URL;
  try {
    cur = new URL(here.href);
    url = new URL(raw, cur);
  } catch {
    return null;
  }
  const same = url.origin === cur.origin && url.pathname === cur.pathname && url.search === cur.search;
  if (same && url.hash && url.hash !== '#') return 'fragment';
  if (same && raw.startsWith('#')) return 'fragment';
  return 'leave';
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Euclidean distance from a point to a box's border; 0 inside. */
export function boxDistance(x: number, y: number, b: Box): number {
  const dx = x < b.left ? b.left - x : x > b.right ? x - b.right : 0;
  const dy = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0;
  return Math.hypot(dx, dy);
}

/** The nearest box to a point, as a distance; null when there are none. */
export function nearestDistance(x: number, y: number, boxes: Iterable<Box>): number | null {
  let best: number | null = null;
  for (const b of boxes) {
    const d = boxDistance(x, y, b);
    if (best === null || d < best) best = d;
    if (best === 0) break;
  }
  return best;
}

/**
 * A control's border boxes when it is shown on screen (each at least 2 x 2, not hidden, opacity above 0.05): one per
 * line for a link that wraps, so a tap between its lines is not counted as inside it.
 */
export function shownBoxes(el: Element, view: { w: number; h: number }, margin = 80): Box[] {
  const all = Array.from(el.getClientRects()).filter((r) => r.width >= 2 && r.height >= 2);
  const near = all.filter((r) => !(r.bottom < -margin || r.top > view.h + margin || r.right < -margin || r.left > view.w + margin));
  if (!near.length) return [];
  try {
    const cv = (el as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility;
    if (typeof cv === 'function' && !cv.call(el, { opacityProperty: true, visibilityProperty: true })) return [];
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) <= 0.05) return [];
  } catch {
    /* computed style unavailable: count it */
  }
  return near.map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
}

/** Distance from a point to the nearest shown interactive box among these roots (CSS px of the frame). */
export function missDistance(x: number, y: number, roots: Array<Document | ShadowRoot>, view: { w: number; h: number }): number | null {
  const boxes: Box[] = [];
  for (const root of roots) {
    let list: Element[] = [];
    try {
      list = Array.from(root.querySelectorAll(INTERACTIVE));
    } catch {
      list = [];
    }
    for (const el of list) boxes.push(...shownBoxes(el, view));
  }
  return nearestDistance(x, y, boxes);
}

/** Lower-case tag of an element, never its text. */
export function tagOf(el: Element | null): string | undefined {
  return el ? el.tagName.toLowerCase() : undefined;
}
