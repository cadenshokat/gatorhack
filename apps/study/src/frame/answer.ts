// "Answer seen": was the answer's sentence on screen at some point. In the page, by the task's selector; in WebAble's
// layer (the simplified page), by finding the task's answer words in the text of its open shadow roots. Nothing is
// stored but a time.

/** Lower case, one space between words, plain quotes and dashes. */
export function normalizeText(s: string): string {
  return s
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG']);

/**
 * A Range over the first place the needle appears in the root's text (whitespace and case ignored), across inline
 * elements and nested open shadow roots, or null.
 */
export function findTextRange(root: Node, needle: string): Range | null {
  const want = normalizeText(needle).trim();
  if (!want) return null;
  const doc = (root.ownerDocument ?? (root as Document)) as Document;
  // The text, normalized as it is read, and for each normalized character the text node and offset it came from.
  let text = '';
  const nodes: Text[] = [];
  const offs: number[] = [];
  let lastSpace = true;
  const visit = (n: Node) => {
    if (n.nodeType === 3) {
      const t = n as Text;
      const raw = t.data;
      for (let i = 0; i < raw.length; i++) {
        let ch = normalizeText(raw[i] as string);
        if (ch === ' ' || ch === '\n' || ch === '\t') {
          if (lastSpace) continue;
          ch = ' ';
        }
        lastSpace = ch === ' ';
        // Lower-casing can lengthen a character ('İ'): every normalized character maps back to its source.
        for (let k = 0; k < ch.length; k++) {
          text += ch[k];
          nodes.push(t);
          offs.push(i);
        }
      }
      return;
    }
    if (n.nodeType === 1) {
      const el = n as Element;
      if (SKIP.has(el.tagName.toUpperCase())) return;
      const sr = (el as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
      if (sr) visit(sr);
    }
    for (let c = n.firstChild; c; c = c.nextSibling) visit(c);
  };
  visit(root);
  const at = text.indexOf(want);
  if (at < 0) return null;
  const end = at + want.length - 1;
  try {
    const r = doc.createRange();
    r.setStart(nodes[at] as Text, offs[at] as number);
    r.setEnd(nodes[end] as Text, (offs[end] as number) + 1);
    return r;
  } catch {
    return null;
  }
}

export interface Area {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Most of the sentence's lines are inside the visible area (at least half of them, by count). */
export function linesShown(rects: ArrayLike<{ left: number; top: number; right: number; bottom: number; width: number; height: number }>, area: Area): boolean {
  let lines = 0;
  let shown = 0;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    if (r.width < 1 || r.height < 1) continue;
    lines++;
    const visH = Math.min(r.bottom, area.bottom) - Math.max(r.top, area.top);
    const visW = Math.min(r.right, area.right) - Math.max(r.left, area.left);
    if (visW > 0 && visH >= r.height * 0.6) shown++;
  }
  return lines > 0 && shown * 2 >= lines;
}

/** An IntersectionObserver entry counts when at least half the element, or 40 px of it, is in view. */
export function entryShown(e: { isIntersecting: boolean; intersectionRect: { height: number; width: number }; boundingClientRect: { height: number } }): boolean {
  if (!e.isIntersecting || e.intersectionRect.width <= 0) return false;
  return e.intersectionRect.height >= Math.min(e.boundingClientRect.height * 0.5, 40);
}
