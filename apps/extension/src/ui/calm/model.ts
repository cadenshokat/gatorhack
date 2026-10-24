// Owner: D1. Reads the live page into a small block model for the Calm view.
// Read-only: nothing here writes to the page. Every word comes from the page's visible text at render time, on the device.
// Controls keep a reference to their original element so the view can proxy them.

export interface LinkPart { t: 'link'; el: Element; text: string; href: string | null; help: boolean }
export type Inline = { t: 'text'; text: string } | LinkPart | { t: 'br' };

interface Base { key: string; src: Node }
export interface HeadingBlock extends Base { b: 'heading'; level: number; text: string; el: Element }
export interface FlowBlock extends Base { b: 'flow'; parts: Inline[]; text: string; help: boolean }
export interface ControlBlock extends Base {
  b: 'control'; el: Element; role: 'button' | 'link'; text: string; href: string | null;
  primary: boolean; help: boolean; selected: boolean; popup: boolean;
}
export interface FieldBlock extends Base {
  b: 'field'; el: HTMLInputElement | HTMLTextAreaElement; label: string; hint: string; required: boolean;
  multiline: boolean; type: string; search: boolean;
}
export interface ChoiceBlock extends Base {
  b: 'choice'; el: Element; type: 'checkbox' | 'radio'; name: string; title: string; meta: string[]; extra: Block[];
}
export interface ChoicesBlock extends Base { b: 'choices'; type: 'checkbox' | 'radio'; items: ChoiceBlock[] }
export interface SelectBlock extends Base { b: 'select'; el: HTMLSelectElement; label: string; hint: string; required: boolean }
export interface ImageBlock extends Base { b: 'image'; url: string; alt: string; w: number; h: number; fit: 'cover' | 'contain' }
export interface ListBlock extends Base { b: 'list'; ordered: boolean; items: Block[][] }
export interface TableBlock extends Base { b: 'table'; rows: string[][]; head: boolean }
/** A table whose cells hold links or controls: each cell keeps its blocks. */
export interface RichTableBlock extends Base { b: 'rtable'; rows: Array<{ cells: Block[][]; head: boolean }> }
export interface GroupBlock extends Base { b: 'group'; legend: string; blocks: Block[] }
export interface CardLinkBlock extends Base {
  b: 'cardlink'; el: Element; href: string | null; title: string; lines: string[]; image: ImageBlock | null;
}
export interface PeekBlock extends Base {
  b: 'peek'; el: Element; label: string; why: 'sensitive' | 'media' | 'editor' | 'file' | 'frame' | 'rest';
}
export type Block =
  | HeadingBlock | FlowBlock | ControlBlock | FieldBlock | ChoiceBlock | ChoicesBlock | SelectBlock | ImageBlock
  | ListBlock | TableBlock | RichTableBlock | GroupBlock | CardLinkBlock | PeekBlock;

export interface ReadCtx {
  /** Element → placement key. An element placed in another placement is skipped here (it renders there). */
  placed: Map<Element, string>;
  current: string;
  /** Never rendered inline (for example headings used as section titles). */
  skip: Set<Element>;
  /** Jev-folded parts met inside an open section: moved to the end drawer, never deleted. */
  folded: Set<Element>;
  foldedHits: Element[];
  primary: Element | null;
  primarySeen: boolean;
  help: Set<Element>;
  budget: { left: number };
}

export function newCtx(partial: Partial<ReadCtx> = {}): ReadCtx {
  return {
    placed: new Map(), current: '', skip: new Set(), folded: new Set(), foldedHits: [], primary: null,
    primarySeen: false, help: new Set(), budget: { left: 4000 }, ...partial,
  };
}

/* ------------------------------------------------------------------ */
/* Stable keys (so mirrors keep focus across re-reads)                */
/* ------------------------------------------------------------------ */

const keys = new WeakMap<Node, string>();
let keyN = 0;
export function keyOf(n: Node, suffix = ''): string {
  let k = keys.get(n);
  if (!k) {
    k = `k${++keyN}`;
    keys.set(n, k);
  }
  return suffix ? `${k}${suffix}` : k;
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

export function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/[\s ​]+/g, ' ').trim();
}

export function textOf(el: Element): string {
  const h = el as HTMLElement;
  return clean(typeof h.innerText === 'string' ? h.innerText : el.textContent);
}

export function linesOf(el: Element): string[] {
  const h = el as HTMLElement;
  const raw = typeof h.innerText === 'string' ? h.innerText : (el.textContent ?? '');
  return raw.split(/\n+/).map(clean).filter(Boolean);
}

function labelledBy(el: Element): string {
  const ids = el.getAttribute('aria-labelledby');
  if (!ids) return '';
  const doc = el.ownerDocument;
  return clean(
    ids
      .split(/\s+/)
      .map((id) => doc.getElementById(id))
      .filter((x): x is HTMLElement => !!x)
      .map((x) => textOf(x))
      .join(' '),
  );
}

function describedBy(el: Element): string {
  const ids = el.getAttribute('aria-describedby');
  if (!ids) return '';
  const doc = el.ownerDocument;
  return clean(
    ids
      .split(/\s+/)
      .map((id) => doc.getElementById(id))
      .filter((x): x is HTMLElement => !!x)
      .map((x) => textOf(x))
      .join(' '),
  );
}

/** A label's visible words without the text of controls inside it (a select's options, for example). */
function labelText(label: Element): string[] {
  if (!label.querySelector('input,select,textarea,button')) return linesOf(label);
  const c = label.cloneNode(true) as Element;
  c.querySelectorAll('input,select,textarea,button,datalist,option').forEach((x) => x.remove());
  return (c.textContent ?? '').split(/\n+/).map(clean).filter(Boolean);
}

type FormEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function labelLinesOf(el: Element): string[] {
  const lb = labelledBy(el);
  if (lb) return [lb];
  const labels = (el as FormEl).labels ? Array.from((el as FormEl).labels ?? []) : [];
  const lines = labels.flatMap((l) => labelText(l));
  if (lines.length) return lines;
  for (const a of ['aria-label', 'placeholder', 'title']) {
    const v = clean(el.getAttribute(a));
    if (v) return [v];
  }
  return [];
}

export function labelOf(el: Element): string {
  return labelLinesOf(el).join(' ');
}

/** The visible name of a button or link. */
export function nameOf(el: Element): string {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'image') return clean(el.alt) || clean(el.getAttribute('aria-label'));
    if (['button', 'submit', 'reset'].includes(el.type)) {
      return clean(el.value) || clean(el.getAttribute('aria-label')) || (el.type === 'submit' ? 'Submit' : el.type === 'reset' ? 'Reset' : '');
    }
  }
  const t = textOf(el);
  const aria = clean(el.getAttribute('aria-label')) || labelledBy(el) || clean(el.getAttribute('title'));
  // A glyph ("–", "×", "›") or a bare badge count ("1") says less than the control's own accessible name.
  if (t && (!aria || /\p{L}/u.test(t))) return t.length > 160 ? `${t.slice(0, 157)}…` : t;
  if (aria) return aria;
  if (t) return t;
  const img = el.querySelector('img[alt]');
  if (img) return clean(img.getAttribute('alt'));
  const st = el.querySelector('svg title');
  return st ? clean(st.textContent) : '';
}

const ABBREV_END = /\b(?:Mr|Mrs|Ms|Dr|St|No|Nos|Rx|Inc|Ltd|Co|Corp|vs|etc|e\.g|i\.e|approx|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|U\.S|a\.m|p\.m|[A-Z])\.$/;

/** Split running text into sentences (never inside "$4.00", "e.g." or "Dr."). */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /([.!?]+["\u201d\u2019)\]]*)\s+(?=["\u201c(\[]?[A-Z0-9])/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + (m[1]?.length ?? 0);
    const piece = text.slice(start, end);
    if (ABBREV_END.test(piece)) continue;
    const t = piece.trim();
    if (t) out.push(t);
    start = re.lastIndex;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out.length ? out : [text.trim()];
}

/** Indexes in `text` where a new sentence starts. */
export function sentenceBreaks(text: string): number[] {
  const out: number[] = [];
  const re = /([.!?]+["\u201d\u2019)\]]*)\s+(?=["\u201c(\[]?[A-Z0-9])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + (m[1]?.length ?? 0);
    if (ABBREV_END.test(text.slice(Math.max(0, end - 14), end))) continue;
    out.push(re.lastIndex);
  }
  return out;
}

/** Split inline parts into paragraphs of at most n sentences; links stay inside their sentence. */
export function splitParts(parts: Inline[], n: number): Inline[][] {
  if (!Number.isFinite(n) || n < 1) return [parts];
  const paras: Inline[][] = [[]];
  let count = 0;
  for (const p of parts) {
    if (p.t !== 'text') {
      paras[paras.length - 1]!.push(p);
      continue;
    }
    let rest = p.text;
    let offset = 0;
    for (const at of sentenceBreaks(p.text)) {
      count++;
      if (count % n !== 0) continue;
      const head = p.text.slice(offset, at);
      paras[paras.length - 1]!.push({ t: 'text', text: head.trimEnd() });
      paras.push([]);
      offset = at;
      rest = p.text.slice(at);
    }
    if (rest) paras[paras.length - 1]!.push({ t: 'text', text: offset ? rest.trimStart() : rest });
  }
  return paras.filter((ps) => ps.some((x) => x.t !== 'text' || /\S/.test(x.text)));
}

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

/** Dense text gets an "Explain" offer: ≥ 40 words and (mean sentence ≥ 25 words or ≥ 15% words of 3+ syllables). */
export function isDense(text: string): boolean {
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  if (words.length < 40) return false;
  const sentences = splitSentences(text).length || 1;
  const long = words.filter((w) => syllables(w) >= 3).length;
  return words.length / sentences >= 25 || long / words.length >= 0.15;
}

export const PRICE_RE = /(?:[$€£¥]\s?\d|\d[\d,.]*\s?(?:USD|EUR|GBP))/;
export const HELP_RE = /\b(help|contact( us)?|support|customer (service|care)|faqs?|call (us|your|our)|chat with( us)?)\b/i;

/* ------------------------------------------------------------------ */
/* Visibility                                                          */
/* ------------------------------------------------------------------ */

const IGNORE = new Set([
  'script', 'style', 'noscript', 'template', 'link', 'meta', 'head', 'title', 'base', 'datalist', 'option', 'optgroup',
  'param', 'track', 'source', 'map', 'area', 'webable-ui', 'legend',
]);
const INLINE = new Set(['inline', 'inline-block', 'inline-flex', 'inline-grid', 'contents', 'ruby', 'inline-table']);

function hidden(el: Element, cs: CSSStyleDeclaration): boolean {
  if (cs.display === 'none') return true;
  if (cs.display === 'contents') return false;
  if (cs.opacity === '0') return true;
  if (cs.contentVisibility === 'hidden') return true;
  if (cs.position === 'absolute' || cs.position === 'fixed') {
    const r = el.getBoundingClientRect();
    if (r.width <= 2 && r.height <= 2) return true; // screen-reader-only text
    if (r.right + window.scrollX <= 0 || r.bottom + window.scrollY <= 0) return true; // parked off-screen
  }
  return false;
}

export function isShown(el: Element): boolean {
  if (!el.isConnected) return false;
  const cs = getComputedStyle(el);
  if (hidden(el, cs)) return false;
  if (cs.display === 'contents') return true;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0 && el.childElementCount === 0) return false;
  return typeof (el as HTMLElement).checkVisibility === 'function'
    ? (el as HTMLElement).checkVisibility({ checkVisibilityCSS: true, checkOpacity: true } as CheckVisibilityOptions)
    : true;
}

function safeHref(el: Element): string | null {
  const raw = (el as HTMLAnchorElement).href;
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const u = new URL(raw, location.href);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol)) return null;
    if (u.origin === location.origin && u.pathname === location.pathname && u.search === location.search && u.hash) return null;
    return u.href;
  } catch {
    return null;
  }
}

export function safeImageUrl(u: string): boolean {
  if (!u) return false;
  try {
    const url = new URL(u, location.href);
    if (url.protocol === 'https:') return true;
    if (url.protocol === 'data:') return /^data:image\//i.test(u);
    if (url.protocol === 'http:' || url.protocol === 'blob:') return url.origin === location.origin;
    return false;
  } catch {
    return false;
  }
}

function svgDataUrl(svg: SVGSVGElement, r: DOMRect): string | null {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('script,foreignObject,use').forEach((n) => n.remove());
  for (const n of [clone, ...Array.from(clone.querySelectorAll('*'))]) {
    for (const a of Array.from(n.attributes)) if (/^on/i.test(a.name) || /href$/i.test(a.name)) n.removeAttribute(a.name);
  }
  // Nothing left to draw (icons drawn through <use> or page CSS): show no picture rather than an empty well.
  if (!clone.querySelector('path,rect,circle,ellipse,line,polyline,polygon,text,image')) return null;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(Math.round(r.width)));
  clone.setAttribute('height', String(Math.round(r.height)));
  const cs = getComputedStyle(svg);
  clone.setAttribute('color', cs.color);
  if (!clone.getAttribute('fill') && cs.fill && cs.fill !== 'rgb(0, 0, 0)') clone.setAttribute('fill', cs.fill);
  const xml = new XMLSerializer().serializeToString(clone);
  if (xml.length > 80_000) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

/** The image's real address: what it shows now, else its srcset or lazy-load source (placeholders skipped). */
function bestSrc(img: HTMLImageElement): string | null {
  const placeholder = (u: string): boolean => !u || (/^data:image\/(gif|png|svg)/i.test(u) && u.length < 400);
  if (img.currentSrc && !placeholder(img.currentSrc) && img.naturalWidth > 2) return img.currentSrc;
  const set = img.getAttribute('srcset') || img.getAttribute('data-srcset') || img.closest('picture')?.querySelector('source')?.getAttribute('srcset') || '';
  if (set) {
    const cands = set.split(/,\s+(?=\S)/).map((c) => c.trim().split(/\s+/)[0] ?? '').filter(Boolean);
    const pick = cands[Math.min(cands.length - 1, 1)] ?? cands[0];
    if (pick && !placeholder(pick)) {
      try {
        return new URL(pick, location.href).href;
      } catch {
        /* ignore */
      }
    }
  }
  for (const a of ['data-src', 'data-lazy-src', 'data-original']) {
    const v = img.getAttribute(a);
    if (v && !placeholder(v)) {
      try {
        return new URL(v, location.href).href;
      } catch {
        /* ignore */
      }
    }
  }
  return placeholder(img.src) ? null : img.src;
}

function imageFor(el: Element): ImageBlock | null {
  let img: Element = el;
  if (el.localName === 'picture') img = el.querySelector('img') ?? el;
  const r = img.getBoundingClientRect();
  if (r.width < 32 || r.height < 32) return null;
  if (img instanceof HTMLImageElement) {
    const url = bestSrc(img);
    if (!url || !safeImageUrl(url)) return null;
    // Photos fill their well; cut-outs, drawings and near-square product shots sit inside it.
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : r.width / Math.max(1, r.height);
    const art = /\.(png|svg|gif)(\?|#|$)|^data:image\/(png|svg|gif)/i.test(url) || (ratio > 0.8 && ratio < 1.25);
    return { b: 'image', url, alt: clean(img.alt), w: r.width, h: r.height, fit: art ? 'contain' : 'cover', key: keyOf(img), src: img };
  }
  if (img instanceof SVGSVGElement) {
    if (r.width < 40 || r.height < 40) return null;
    const url = svgDataUrl(img, r);
    if (!url) return null;
    const alt = clean(img.getAttribute('aria-label')) || clean(img.querySelector('title')?.textContent);
    return { b: 'image', url, alt, w: r.width, h: r.height, fit: 'contain', key: keyOf(img), src: img };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

const BUTTON_ROLES = new Set(['button', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'switch', 'option', 'treeitem', 'link']);
const CHECKABLE = 'input[type=checkbox],input[type=radio]';
const ROW_STOP = new Set(['form', 'fieldset', 'ul', 'ol', 'table', 'tbody', 'thead', 'main', 'body', 'html', 'section', 'article', 'nav', 'header', 'footer', 'aside', 'dialog']);
const TEXTLIKE = new Set(['text', 'email', 'tel', 'url', 'number', 'search', 'date', 'time', 'datetime-local', 'month', 'week', '']);

function isHeading(el: Element): number {
  const m = /^h([1-6])$/.exec(el.localName);
  if (m) return Number(m[1]);
  if (el.getAttribute('role') === 'heading') return Math.min(6, Math.max(1, Number(el.getAttribute('aria-level')) || 2));
  return 0;
}

function isButtonLike(el: Element): boolean {
  const tag = el.localName;
  if (tag === 'button' || tag === 'summary') return true;
  if (tag === 'input') return ['button', 'submit', 'reset', 'image'].includes((el as HTMLInputElement).type);
  const role = el.getAttribute('role');
  return !!role && BUTTON_ROLES.has(role) && tag !== 'a';
}

function sensitiveField(el: HTMLInputElement): boolean {
  if (el.type === 'password') return true;
  const ac = (el.getAttribute('autocomplete') ?? '').toLowerCase();
  if (/\bcc-|one-time-code|current-password|new-password/.test(ac)) return true;
  return /(card.?num|cardnumber|cvc|cvv|csc|securitycode|iban)/i.test(`${el.name} ${el.id}`);
}

function countFormControls(el: Element): number {
  return el.querySelectorAll('input:not([type=hidden]),select,textarea').length;
}

interface Prep {
  rows: Map<Element, Element>; // row element → its checkbox / radio
  consumed: Set<Element>; // labels drawn as part of their control
}

function prepare(root: Element): Prep {
  const rows = new Map<Element, Element>();
  const consumed = new Set<Element>();
  const inputs: Element[] = root.matches(CHECKABLE) ? [root] : Array.from(root.querySelectorAll(CHECKABLE));
  for (const input of inputs) {
    let row: Element = input;
    const lab = (input as HTMLInputElement).labels?.[0];
    if (lab && lab.contains(input) && root.contains(lab)) row = lab;
    while (row !== root && row.parentElement) {
      const p = row.parentElement;
      if (!root.contains(p) || ROW_STOP.has(p.localName)) break;
      if (countFormControls(p) !== 1) break;
      if (p.querySelector('h1,h2,h3,h4,h5,h6,[role=heading]')) break;
      if (textOf(p).length > 360) break;
      row = p;
    }
    rows.set(row, input);
  }
  root.querySelectorAll('label').forEach((l) => {
    if ((l as HTMLLabelElement).control) consumed.add(l);
  });
  if (root instanceof HTMLLabelElement && root.control) consumed.add(root);
  return { rows, consumed };
}

/* ------------------------------------------------------------------ */
/* The reader                                                          */
/* ------------------------------------------------------------------ */

class Run {
  out: Block[] = [];
  parts: Inline[] = [];
  flowSrc: Node | null = null;
  constructor(readonly ctx: ReadCtx, readonly prep: Prep, readonly root: Element) {}

  push(b: Block): void {
    if (this.ctx.budget.left <= 0) return;
    this.ctx.budget.left--;
    this.out.push(b);
  }

  close(): void {
    if (!this.parts.length) return;
    const parts = this.parts;
    const src = this.flowSrc ?? this.root;
    this.parts = [];
    this.flowSrc = null;
    for (const b of finishFlow(parts, src)) this.push(b);
  }

  text(s: string, node: Node): void {
    if (!s) return;
    if (!/\S/.test(s)) {
      if (this.parts.length) this.parts.push({ t: 'text', text: ' ' });
      return;
    }
    if (!this.flowSrc) this.flowSrc = node;
    this.parts.push({ t: 'text', text: s.replace(/[\s ]+/g, ' ') });
  }

  visitChildren(el: Element | ShadowRoot, vis: boolean): void {
    const kids: Node[] = [];
    if (el instanceof Element && el.shadowRoot) kids.push(...Array.from(el.shadowRoot.childNodes));
    else kids.push(...Array.from(el.childNodes));
    for (const k of kids) {
      if (this.ctx.budget.left <= 0) return;
      this.visit(k, vis);
    }
  }

  visit(node: Node, vis: boolean): void {
    if (node.nodeType === Node.TEXT_NODE) {
      if (vis) this.text((node as Text).data, node);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const ctx = this.ctx;
    if (IGNORE.has(el.localName)) return;
    if (el !== this.root) {
      const p = ctx.placed.get(el);
      if (p !== undefined && p !== ctx.current) return;
      if (ctx.skip.has(el)) return;
      if (ctx.folded.has(el)) {
        this.close();
        ctx.foldedHits.push(el);
        return;
      }
    }
    if (el.localName === 'slot') {
      for (const n of (el as HTMLSlotElement).assignedNodes({ flatten: true })) this.visit(n, vis);
      return;
    }
    const cs = getComputedStyle(el);
    if (hidden(el, cs)) return;
    const v = cs.visibility === 'visible' ? true : cs.visibility === 'hidden' || cs.visibility === 'collapse' ? false : vis;
    const block = !INLINE.has(cs.display);

    // Choice rows: a checkbox or radio with its label and meta lines.
    const rowInput = this.prep.rows.get(el);
    if (rowInput && v) {
      this.close();
      this.push(this.choice(el, rowInput));
      return;
    }
    if (this.prep.consumed.has(el)) {
      // Drawn by its control; still reach controls nested inside it.
      el.querySelectorAll('input,select,textarea,button,a[href],[role=button]').forEach((c) => this.visit(c, v));
      return;
    }

    const level = isHeading(el);
    if (level) {
      if (!v) return;
      const t = textOf(el);
      if (!t) return;
      this.close();
      this.push({ b: 'heading', level, text: t, el, key: keyOf(el), src: el });
      return;
    }

    const tag = el.localName;
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      if (!v) return;
      this.close();
      const b = this.formControl(el as FormEl);
      if (b) this.push(b);
      return;
    }
    const role = el.getAttribute('role');
    if (role === 'checkbox' || role === 'radio' || role === 'switch') {
      if (!v) return;
      this.close();
      this.push(this.choice(el, el));
      return;
    }
    if (isButtonLike(el) || (ctx.primary === el && tag !== 'a')) {
      if (!v) return;
      this.close();
      const b = this.control(el, role === 'link' ? 'link' : 'button');
      if (b) this.push(b);
      return;
    }
    if (tag === 'a' && (el.hasAttribute('href') || el.hasAttribute('onclick') || el.hasAttribute('tabindex'))) {
      if (!v) return;
      if (ctx.primary === el || ctx.primary && el.contains(ctx.primary)) {
        this.close();
        const b = this.control(el, 'link');
        if (b) this.push(b);
        return;
      }
      // A link wrapping a card (picture, headline and summary) is one tappable card, whatever its own display.
      if (block || el.querySelector('h1,h2,h3,h4,h5,h6,p,div,img,picture')) {
        const media = el.querySelector('img,picture,svg');
        const lines = linesOf(el);
        if ((media && imageFor(media)) || (lines.length >= 2 && lines.join(' ').length > 24)) {
          this.close();
          const b = this.cardLink(el);
          if (b) this.push(b);
          return;
        }
      }
      const text = nameOf(el);
      if (!text) return;
      if (!this.flowSrc) this.flowSrc = el;
      this.parts.push({ t: 'link', el, text, href: safeHref(el), help: this.isHelp(el, text) });
      return;
    }
    if (tag === 'img' || tag === 'picture' || tag === 'svg') {
      if (!v) return;
      const img = imageFor(el);
      if (img) {
        this.close();
        this.push(img);
      }
      return;
    }
    if (tag === 'video' || tag === 'audio' || tag === 'iframe' || tag === 'embed' || tag === 'object' || tag === 'canvas') {
      if (!v) return;
      const r = el.getBoundingClientRect();
      if (r.width < 80 || r.height < 50) return;
      this.close();
      const label = clean(el.getAttribute('aria-label')) || clean(el.getAttribute('title'));
      const why = tag === 'video' || tag === 'audio' || tag === 'canvas' ? 'media' : 'frame';
      this.push({ b: 'peek', el, label, why, key: keyOf(el), src: el });
      return;
    }
    if ((el as HTMLElement).isContentEditable && el.getAttribute('contenteditable') !== null) {
      if (!v) return;
      this.close();
      this.push({ b: 'peek', el, label: clean(el.getAttribute('aria-label')), why: 'editor', key: keyOf(el), src: el });
      return;
    }
    if (tag === 'br') {
      if (v) this.parts.push({ t: 'br' });
      return;
    }
    if (tag === 'hr') {
      this.close();
      return;
    }
    if (tag === 'ul' || tag === 'ol' || role === 'list') {
      this.close();
      const items: Block[][] = [];
      for (const li of Array.from(el.children)) {
        if (IGNORE.has(li.localName)) continue;
        const lp = ctx.placed.get(li);
        if ((lp !== undefined && lp !== ctx.current) || ctx.skip.has(li)) continue;
        if (ctx.folded.has(li)) {
          ctx.foldedHits.push(li);
          continue;
        }
        const lcs = getComputedStyle(li);
        if (hidden(li, lcs)) continue;
        const lv = lcs.visibility === 'visible' ? true : lcs.visibility === 'hidden' ? false : v;
        const blocks = readBlocksFrom(li, this.ctx, li, lv);
        if (blocks.length) items.push(blocks);
      }
      if (items.length) this.push({ b: 'list', ordered: tag === 'ol', items, key: keyOf(el), src: el });
      return;
    }
    if (tag === 'table' && v && !el.querySelector('input,select,textarea,button,a[href]')) {
      const rows = Array.from((el as HTMLTableElement).rows)
        .slice(0, 120)
        .map((r) => Array.from(r.cells).slice(0, 12).map((c) => textOf(c)))
        .filter((r) => r.some(Boolean));
      if (rows.length && rows.every((r) => r.every((c) => c.length < 400))) {
        this.close();
        const first = (el as HTMLTableElement).rows[0];
        const head = !!(el as HTMLTableElement).tHead || (!!first && Array.from(first.cells).every((c) => c.localName === 'th'));
        this.push({ b: 'table', rows, head, key: keyOf(el), src: el });
        return;
      }
    }
    if (tag === 'table' && v) {
      const trs = Array.from((el as HTMLTableElement).rows).slice(0, 120);
      const big = trs.some((r) => Array.from(r.cells).some((c) => textOf(c).length > 600));
      if (trs.length && !big) {
        this.close();
        const rows: Array<{ cells: Block[][]; head: boolean }> = [];
        for (const tr of trs) {
          const tcs = getComputedStyle(tr);
          if (hidden(tr, tcs)) continue;
          const cells = Array.from(tr.cells)
            .slice(0, 12)
            .map((c) => readBlocksFrom(c, this.ctx, c, v))
            .filter((b) => b.length);
          if (cells.length) rows.push({ cells, head: Array.from(tr.cells).every((c) => c.localName === 'th') });
        }
        if (rows.length) this.push({ b: 'rtable', rows, key: keyOf(el), src: el });
        return;
      }
    }
    if (tag === 'fieldset' || role === 'radiogroup' || role === 'group' && el.querySelector(CHECKABLE)) {
      this.close();
      const legendEl = tag === 'fieldset' ? el.querySelector(':scope > legend') : null;
      const legend = legendEl ? textOf(legendEl) : labelledBy(el) || clean(el.getAttribute('aria-label'));
      const blocks = readBlocksFrom(el, this.ctx, el, v, legendEl);
      if (blocks.length) this.push({ b: 'group', legend, blocks, key: keyOf(el), src: el });
      return;
    }

    if (block) this.close();
    this.visitChildren(el, v);
    if (block) this.close();
  }

  isHelp(el: Element, text: string): boolean {
    if (this.ctx.help.has(el)) return true;
    for (const h of this.ctx.help) if (h.contains(el)) return true;
    const href = (el as HTMLAnchorElement).href;
    if (typeof href === 'string' && /^(tel|mailto):/i.test(href)) return true;
    return HELP_RE.test(text) && text.length <= 60;
  }

  control(el: Element, role: 'button' | 'link'): ControlBlock | null {
    const text = nameOf(el);
    const primary = this.ctx.primary === el || (!!this.ctx.primary && el.contains(this.ctx.primary));
    if (!text && !primary) return null; // a nameless icon control has no words to show
    if (primary) this.ctx.primarySeen = true;
    const selected =
      el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true' ||
      (el.getAttribute('aria-current') ?? 'false') !== 'false';
    const popup = el.hasAttribute('aria-haspopup') || el.hasAttribute('aria-expanded') || el.getAttribute('role') === 'combobox';
    return {
      b: 'control', el, role, text: text || 'Main button on this page', href: role === 'link' ? safeHref(el) : null,
      primary, help: this.isHelp(el, text), selected, popup, key: keyOf(el), src: el,
    };
  }

  cardLink(el: Element): CardLinkBlock | null {
    const lines = linesOf(el);
    const media = el.querySelector('img,picture,svg');
    const image = media ? imageFor(media) : null;
    const title = clean(el.getAttribute('aria-label')) || lines[0] || (image?.alt ?? '');
    if (!title) return null;
    return {
      b: 'cardlink', el, href: safeHref(el), title, lines: lines.filter((l) => l !== title).slice(0, 6), image,
      key: keyOf(el), src: el,
    };
  }

  choice(row: Element, input: Element): ChoiceBlock {
    const isInput = input instanceof HTMLInputElement;
    const role = input.getAttribute('role');
    const type: 'checkbox' | 'radio' = isInput ? ((input as HTMLInputElement).type === 'radio' ? 'radio' : 'checkbox') : role === 'radio' ? 'radio' : 'checkbox';
    const extrasEls = row === input ? [] : Array.from(row.querySelectorAll('a[href],button,[role=button]')).filter((e) => !e.contains(input));
    const extraTexts = new Set(extrasEls.map((e) => nameOf(e)));
    const labelLines = isInput ? labelLinesOf(input) : [nameOf(input)].filter(Boolean);
    const rowLines = row === input ? [] : linesOf(row).filter((l) => !extraTexts.has(l));
    const title = labelLines[0] ?? rowLines[0] ?? '';
    const meta: string[] = [];
    for (const l of [...labelLines.slice(1), ...rowLines]) {
      if (l !== title && !meta.includes(l) && !title.includes(l)) meta.push(l);
    }
    const extra: Block[] = [];
    for (const e of extrasEls) {
      const b = this.control(e, e.localName === 'a' ? 'link' : 'button');
      if (b) extra.push(b);
    }
    return {
      b: 'choice', el: input, type, name: isInput ? (input as HTMLInputElement).name : '', title: title || 'Option',
      meta: meta.slice(0, 4), extra, key: keyOf(input), src: row,
    };
  }

  formControl(el: FormEl): Block | null {
    const key = keyOf(el);
    if (el instanceof HTMLSelectElement) {
      if (el.multiple) return { b: 'peek', el, label: labelOf(el), why: 'file', key, src: el };
      return { b: 'select', el, label: labelOf(el), hint: describedBy(el), required: el.required || el.getAttribute('aria-required') === 'true', key, src: el };
    }
    if (el instanceof HTMLTextAreaElement) {
      return {
        b: 'field', el, label: labelOf(el), hint: describedBy(el), required: el.required || el.getAttribute('aria-required') === 'true',
        multiline: true, type: 'text', search: false, key, src: el,
      };
    }
    const type = el.type;
    if (type === 'hidden') return null;
    if (type === 'checkbox' || type === 'radio') return this.choice(el, el);
    if (['button', 'submit', 'reset', 'image'].includes(type)) return this.control(el, 'button');
    if (sensitiveField(el)) return { b: 'peek', el, label: labelOf(el), why: 'sensitive', key, src: el };
    if (!TEXTLIKE.has(type)) return { b: 'peek', el, label: labelOf(el), why: 'file', key, src: el };
    const search = type === 'search' || el.getAttribute('role') === 'searchbox' || !!el.closest('[role=search],search');
    return {
      b: 'field', el, label: labelOf(el), hint: describedBy(el), required: el.required || el.getAttribute('aria-required') === 'true',
      multiline: false, type: type || 'text', search, key, src: el,
    };
  }
}

function finishFlow(parts: Inline[], src: Node): Block[] {
  const merged: Inline[] = [];
  for (const p of parts) {
    const last = merged[merged.length - 1];
    if (p.t === 'text' && last?.t === 'text') last.text += p.text;
    else merged.push(p.t === 'text' ? { t: 'text', text: p.text } : p);
  }
  while (merged.length && (merged[0]!.t === 'br' || (merged[0]!.t === 'text' && !/\S/.test((merged[0] as { text: string }).text)))) merged.shift();
  while (merged.length) {
    const l = merged[merged.length - 1]!;
    if (l.t === 'br' || (l.t === 'text' && !/\S/.test(l.text))) merged.pop();
    else break;
  }
  if (!merged.length) return [];
  const first = merged[0]!;
  if (first.t === 'text') first.text = first.text.replace(/^\s+/, '');
  const lastPart = merged[merged.length - 1]!;
  if (lastPart.t === 'text') lastPart.text = lastPart.text.replace(/\s+$/, '');
  const links = merged.filter((p): p is LinkPart => p.t === 'link');
  const plain = clean(merged.filter((p) => p.t === 'text').map((p) => (p as { text: string }).text).join(' '));
  if (links.length && /^[\s·•|/,–—\-:]*$/.test(plain)) {
    return links.map((l) => ({
      b: 'control', el: l.el, role: 'link', text: l.text, href: l.href, primary: false, help: l.help,
      selected: (l.el.getAttribute('aria-current') ?? 'false') !== 'false', popup: false, key: keyOf(l.el), src: l.el,
    }));
  }
  const text = clean(merged.map((p) => (p.t === 'br' ? ' ' : p.text)).join(''));
  if (!text) return [];
  const help = links.some((l) => l.help && /^(tel|mailto):/i.test(l.href ?? '')) || (links.some((l) => l.help) && text.length < 200);
  return [{ b: 'flow', parts: merged, text, help, key: keyOf(src, 'f'), src }];
}

/** Group consecutive choices into one grouped list (radios by name). */
function groupChoices(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.b === 'choice') {
      const last = out[out.length - 1];
      if (last?.b === 'choices' && last.type === b.type && (b.type === 'checkbox' || last.items[0]?.name === b.name)) {
        last.items.push(b);
        continue;
      }
      out.push({ b: 'choices', type: b.type, items: [b], key: `${b.key}g`, src: b.src });
      continue;
    }
    if (b.b === 'group') b.blocks = groupChoices(b.blocks);
    if (b.b === 'list') b.items = b.items.map(groupChoices);
    out.push(b);
  }
  return out;
}

function readBlocksFrom(el: Element, ctx: ReadCtx, root: Element, vis: boolean, skipChild: Element | null = null): Block[] {
  const run = new Run(ctx, prepare(root), root);
  const rowInput = run.prep.rows.get(root);
  if (rowInput && vis) {
    run.push(run.choice(root, rowInput));
    return groupChoices(run.out);
  }
  for (const k of Array.from(el.shadowRoot ? el.shadowRoot.childNodes : el.childNodes)) {
    if (k === skipChild) continue;
    run.visit(k, vis);
  }
  run.close();
  return groupChoices(run.out);
}

/** Read one placed element (and its subtree) into blocks. */
export function readBlocks(root: Element, ctx: ReadCtx): Block[] {
  if (!root.isConnected) return [];
  const run = new Run(ctx, prepare(root), root);
  run.visit(root, true);
  run.close();
  if (ctx.budget.left <= 0 && root.isConnected) {
    run.out.push({ b: 'peek', el: root, label: '', why: 'rest', key: keyOf(root, 'rest'), src: root });
  }
  return groupChoices(run.out);
}

/** A control block for one element outside a read (the primary action when no section reached it). */
export function controlFor(el: Element, ctx: ReadCtx): ControlBlock | null {
  if (!el.isConnected) return null;
  const run = new Run(ctx, { rows: new Map(), consumed: new Set() }, el);
  return run.control(el, el.localName === 'a' || el.getAttribute('role') === 'link' ? 'link' : 'button');
}

function visibleChildren(el: Element): Element[] {
  const out: Element[] = [];
  for (const k of Array.from(el.children)) {
    if (IGNORE.has(k.localName)) continue;
    const cs = getComputedStyle(k);
    if (cs.display === 'contents') {
      out.push(...visibleChildren(k));
      continue;
    }
    if (hidden(k, cs)) continue;
    if (!textOf(k) && !k.querySelector('img,svg,picture,input,select,textarea,button')) continue;
    out.push(k);
  }
  return out;
}

function signature(el: Element): string {
  return `${el.localName}.${(el.getAttribute('class') ?? '').trim().split(/\s+/)[0] ?? ''}`;
}

/**
 * Split placed roots into repeated records (cards, rows) and the rest (a heading, a "See all" link).
 * Records are the largest group of look-alike children; order is the page's own.
 */
export function recordsOf(roots: Element[]): { records: Element[]; heading: Element | null; before: Element[]; after: Element[]; uniform: boolean } {
  const alike = (els: Element[]): Element[] => {
    const groups = new Map<string, Element[]>();
    for (const k of els) {
      const s = signature(k);
      const g = groups.get(s);
      if (g) g.push(k);
      else groups.set(s, [k]);
    }
    let best: Element[] = [];
    for (const g of groups.values()) if (g.length > best.length) best = g;
    return best;
  };
  if (roots.length >= 2) {
    const best = alike(roots);
    return { records: roots, heading: null, before: [], after: [], uniform: best.length >= 2 && best.length >= 0.6 * roots.length };
  }
  let el = roots[0];
  if (!el) return { records: [], heading: null, before: [], after: [], uniform: false };
  let heading: Element | null = null;
  for (let depth = 0; depth < 6; depth++) {
    const kids = visibleChildren(el);
    const nonHead = kids.filter((k) => {
      if (isHeading(k)) {
        heading ??= k;
        return false;
      }
      return true;
    });
    if (nonHead.length === 1 && kids.length <= 2) {
      el = nonHead[0]!;
      continue;
    }
    if (nonHead.length >= 2) {
      const best = alike(nonHead);
      if (best.length < 2 || best.length < 0.5 * nonHead.length) return { records: [el], heading: null, before: [], after: [], uniform: false };
      const firstIdx = nonHead.indexOf(best[0]!);
      const lastIdx = nonHead.indexOf(best[best.length - 1]!);
      const set = new Set(best);
      return {
        records: best,
        heading,
        before: nonHead.slice(0, firstIdx),
        after: nonHead.slice(lastIdx + 1).concat(nonHead.slice(firstIdx, lastIdx + 1).filter((k) => !set.has(k))),
        uniform: true,
      };
    }
    break;
  }
  return { records: [el], heading, before: [], after: [], uniform: false };
}

/** Everything a block tree contains, flattened (for counting, recaps and finding controls). */
export function flatten(blocks: Block[]): Block[] {
  const out: Block[] = [];
  const walk = (bs: Block[]): void => {
    for (const b of bs) {
      out.push(b);
      if (b.b === 'group') walk(b.blocks);
      else if (b.b === 'list') b.items.forEach(walk);
      else if (b.b === 'choices') walk(b.items);
      else if (b.b === 'choice') walk(b.extra);
      else if (b.b === 'rtable') b.rows.forEach((r) => r.cells.forEach(walk));
    }
  };
  walk(blocks);
  return out;
}

/** Plain words of a block tree (for coverage checks and recaps). */
export function wordsOf(blocks: Block[]): string {
  return flatten(blocks)
    .map((b) => {
      switch (b.b) {
        case 'heading': case 'flow': case 'control': return b.text;
        case 'choice': return [b.title, ...b.meta].join(' ');
        case 'field': case 'select': return b.label;
        case 'table': return b.rows.map((r) => r.join(' ')).join(' ');
        case 'group': return b.legend;
        case 'cardlink': return [b.title, ...b.lines].join(' ');
        case 'image': return b.alt;
        default: return '';
      }
    })
    .filter(Boolean)
    .join(' ');
}

/** Visible dialogs and menus the page shows right now (to mirror a popup the person opened through a proxy). */
export function pagePopups(): Element[] {
  const out: Element[] = [];
  document.querySelectorAll('[role=dialog],[role=alertdialog],[role=listbox],[role=menu],[aria-modal=true],dialog[open]').forEach((el) => {
    if (el.closest('webable-ui')) return;
    if (!isShown(el)) return;
    if (out.some((o) => o.contains(el))) return;
    out.push(el);
  });
  return out;
}

/** The site's name for the strip: og:site_name, application-name, the title's last part, or the host. */
export function siteName(): string {
  const meta = (sel: string): string => clean(document.querySelector<HTMLMetaElement>(sel)?.content);
  const og = meta('meta[property="og:site_name"]') || meta('meta[name="application-name"]');
  if (og) return og.slice(0, 40);
  const title = clean(document.title);
  const parts = title.split(/\s+[|–—·•-]\s+/).map(clean).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!;
    if (last.length <= 40) return last;
  }
  return location.hostname.replace(/^www\./, '') || title.slice(0, 40);
}
