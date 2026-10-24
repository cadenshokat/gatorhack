// Owner: D1. Turns a FitSpec (enums and ids only) plus the live page into what the Calm view draws.
// Guarantees enforced here, whatever the spec says:
// - nothing is deleted: every placed part renders open, in place behind a disclosure, or in "More on this page";
//   top-level outline nodes no section placed go to the end drawer too;
// - help stays visible: help links inside folded parts are lifted into an always-open help band;
// - consent notices and alerts are open and shown first; the primary action renders exactly once.
import type { ElementDecision, FitSection, FitSpec, PageOutline, SectionLabel } from '@webable/core';
import {
  type Block, type ControlBlock, controlFor, flatten, keyOf, newCtx, readBlocks, recordsOf, siteName, textOf,
} from './model';

export type Layout = FitSection['layout'];

export interface PlanStep { label: string; blocks: Block[]; synthetic: boolean }

/** One placed element of a section whose elements are not alike (a promo bar, a menu, a product rail). */
export interface PlanPart { key: string; blocks: Block[]; records: Block[][] | null; before: Block[]; after: Block[] }

export interface PlanSection {
  key: string;
  index: number;
  sec: FitSection;
  layout: Layout;
  label: SectionLabel;
  title: string | null;
  titleSize: 'page' | 'section';
  state: 'open' | 'collapsed' | 'end_drawer';
  hoist: boolean;
  /** How a hoisted section is drawn: a warning the page shows (alert, task-relevant popup) or a consent question. */
  notice: 'alert' | 'consent' | null;
  lead: boolean;
  isPrimary: boolean;
  blocks: Block[];
  records: Block[][] | null;
  before: Block[];
  after: Block[];
  parts: PlanPart[] | null;
  steps: PlanStep[] | null;
  count: number;
  showFirst: number; // 0 = all
}

export interface DrawerPart { key: string; label: string; blocks: Block[]; section: PlanSection | null }

export interface CalmPlan {
  siteName: string;
  strip: Array<{ key: string; blocks: Block[] }>;
  hoisted: PlanSection[];
  main: PlanSection[];
  drawer: DrawerPart[];
  help: Block[];
  primary: Element | null;
  /** Every element the view placed (sections, strip, lifted help, folded parts): new page content inside them shows in place. */
  roots: Element[];
  drawerLabels: string[];
  stats: { sections: number; blocks: number; ms: number; folded: number; lifted: number; leftovers: number };
}

export interface PlanInput {
  spec: FitSpec;
  outline: PageOutline;
  elementFor: (id: string) => Element | null;
  decisions: ElementDecision[];
  listFirst: number;
  /** Most fields in one step (structure level 2: 5, level 1: 8). */
  stepMax?: number;
}

const FIELDISH = 'input:not([type=hidden]),select,textarea,[role=checkbox],[role=radio],[role=switch],[role=textbox],[role=combobox]';

function within(root: Element, el: Element): boolean {
  return root === el || root.contains(el);
}

function dedupe(els: Array<Element | null>): Element[] {
  const list = els.filter((e): e is Element => !!e);
  const uniq = Array.from(new Set(list));
  return uniq.filter((e) => !uniq.some((o) => o !== e && o.contains(e)));
}

function docOrder(a: Node, b: Node): number {
  if (a === b) return 0;
  const p = a.compareDocumentPosition(b);
  if (p & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (p & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function related(field: Element, n: Node): boolean {
  return field === n || field.contains(n) || n.contains(field);
}

/** Small strip parts only: a control, or a little group (search form) with few controls and few words. */
function stripWorthy(el: Element): boolean {
  const tag = el.localName;
  if (['a', 'button', 'input', 'select'].includes(tag) || el.getAttribute('role') === 'button') return true;
  const controls = el.querySelectorAll('a[href],button,input:not([type=hidden]),select').length;
  return controls >= 1 && controls <= 3 && textOf(el).length <= 80;
}

function titleSizeOf(el: Element | null, layout: Layout): 'page' | 'section' {
  if (layout === 'hero') return 'page';
  if (!el) return 'section';
  return el.localName === 'h1' || el.getAttribute('aria-level') === '1' ? 'page' : 'section';
}

const FIELD_UNITS = new Set(['choices', 'field', 'select']);

function fieldCount(b: Block): number {
  if (b.b === 'choices') return b.items.length;
  if (b.b === 'field' || b.b === 'select') return 1;
  if (b.b === 'peek') return b.why === 'sensitive' || b.why === 'file' ? 1 : 0;
  if (b.b === 'group') return b.blocks.reduce((a, x) => a + fieldCount(x), 0);
  if (b.b === 'list') return b.items.reduce((a, it) => a + it.reduce((c, x) => c + fieldCount(x), 0), 0);
  if (b.b === 'rtable') return b.rows.reduce((a, r) => a + r.cells.reduce((c, cell) => c + cell.reduce((d, x) => d + fieldCount(x), 0), 0), 0);
  return 0;
}

function isFieldUnit(b: Block): boolean {
  return FIELD_UNITS.has(b.b) || fieldCount(b) > 0;
}

function pageWords(b: Block | undefined): string | null {
  if (!b) return null;
  const t = b.b === 'group' ? b.legend : b.b === 'heading' ? b.text : '';
  return t && t.length <= 44 ? t : null;
}

/** The page's own words for a step: a heading before its first field, or the legend of a fieldset it starts with. */
function leadWords(bs: Block[]): string | null {
  for (const b of bs) {
    if (b.b === 'heading') return pageWords(b);
    if (b.b === 'group') return fieldCount(b) > 0 ? pageWords(b) : null;
    if (isFieldUnit(b)) return null;
  }
  return null;
}

/** Labels: the page's own legend or heading for the step, else the spec's label; duplicates get a fitting template. */
function finishSteps(steps: Array<PlanStep & { words: string | null; kinds: Set<string> }>): PlanStep[] | null {
  const kept = steps.filter((s) => s.synthetic || s.blocks.some(isFieldUnit));
  if (kept.filter((s) => !s.synthetic).length < 1 || kept.length < 2) return null;
  const used = new Set<string>();
  for (const s of kept) {
    let label = s.words ?? s.label;
    if (used.has(label) && !s.words) label = s.kinds.has('field') || s.kinds.has('select') ? 'Your details' : 'Choose options';
    if (used.has(label)) label = `${label} (${kept.indexOf(s) + 1})`;
    used.add(label);
    s.label = label;
  }
  return kept.map(({ label, blocks, synthetic }) => ({ label, blocks, synthetic }));
}

/**
 * Split a form's blocks into steps. The spec's steps are followed when they keep each field group whole; otherwise
 * (a fieldset split across steps, or an empty step) steps are rebuilt in page order: one per fieldset, other fields in
 * runs of at most `maxFields`. Content after the last field becomes "Review and submit" with the primary action.
 */
export function buildSteps(blocks: Block[], spec: FitSpec['form_steps'], el: (id: string) => Element | null, maxFields = 5): PlanStep[] | null {
  const specSteps = spec
    .map((st) => ({ label: st.label as string, fields: st.fields.map(el).filter((x): x is Element => !!x).sort(docOrder) }))
    .filter((s) => s.fields.length > 0);
  if (!specSteps.length || blocks.filter(isFieldUnit).length < 1) return null;
  const n = specSteps.length;
  const kindsOf = (bs: Block[]): Set<string> => new Set(flatten(bs).map((b) => b.b));
  const lastField = blocks.reduce((a, b, i) => (isFieldUnit(b) ? i : a), -1);
  const trailing = blocks.slice(lastField + 1);
  const body = blocks.slice(0, lastField + 1);

  // 1. Follow the spec.
  const touching = (b: Block): Set<number> => {
    const ks = new Set<number>();
    specSteps.forEach((st, k) => {
      if (st.fields.some((f) => related(f, b.src))) ks.add(k);
    });
    return ks;
  };
  const split = body.some((b) => isFieldUnit(b) && touching(b).size > 1);
  const bySpec: Block[][] = specSteps.map(() => []);
  let k = 0;
  for (const b of body) {
    const t = touching(b);
    if (t.size) k = Math.min(...Array.from(t));
    else if (b.b === 'heading' && k + 1 < n && bySpec[k]!.some(isFieldUnit)) k++;
    bySpec[k]!.push(b);
  }
  const empty = bySpec.some((bs) => !bs.some(isFieldUnit));
  let steps: Array<PlanStep & { words: string | null; kinds: Set<string> }>;
  if (!split && !empty) {
    steps = bySpec.map((bs, i) => ({
      label: specSteps[i]!.label, blocks: bs, synthetic: false, kinds: kindsOf(bs), words: leadWords(bs),
    }));
  } else {
    // 2. Rebuild in page order.
    steps = [];
    let pending: Block[] = [];
    let cur: (PlanStep & { words: string | null; kinds: Set<string>; fields: number; closed: boolean }) | null = null;
    for (const b of body) {
      if (!isFieldUnit(b)) {
        if (b.b === 'heading') {
          pending.push(b);
          if (cur) cur.closed = true;
        } else if (cur && !pending.length) cur.blocks.push(b);
        else pending.push(b);
        continue;
      }
      const count = fieldCount(b);
      const group = b.b === 'group';
      if (!cur || cur.closed || group || cur.fields + count > maxFields) {
        const words = pageWords(group ? b : pending.find((x) => x.b === 'heading'));
        cur = { label: '', blocks: [], synthetic: false, words, kinds: new Set(), fields: 0, closed: false };
        steps.push(cur);
      }
      cur.blocks.push(...pending, b);
      pending = [];
      cur.fields += count;
      if (group) cur.closed = true;
    }
    if (pending.length && cur) cur.blocks.push(...pending);
    for (const st of steps) {
      st.kinds = kindsOf(st.blocks);
      // Keep the spec's label only for a step that holds all of that spec step's fields.
      const whole = specSteps.find((sp) => sp.fields.every((f) => st.blocks.some((b) => related(f, b.src))));
      st.label = whole?.label ?? (st.kinds.has('field') || st.kinds.has('select') ? 'Your details' : 'Choose options');
    }
  }
  if (trailing.length) {
    const last = steps[steps.length - 1];
    if (last && last.label === 'Review and submit') last.blocks.push(...trailing);
    else steps.push({ label: 'Review and submit', blocks: trailing, synthetic: true, words: null, kinds: kindsOf(trailing) });
  }
  return finishSteps(steps);
}

export function buildPlan(o: PlanInput): CalmPlan {
  const t0 = performance.now();
  const el = (id: string | null | undefined): Element | null => {
    if (!id) return null;
    try {
      const e = o.elementFor(id);
      return e && e.isConnected ? e : null;
    } catch {
      return null;
    }
  };
  const ids = new Set(o.outline.nodes.map((n) => n.id));
  const primary = el(o.spec.primary_action);

  // Help and protected parts, from the outline and Jev's decisions.
  const help = new Set<Element>();
  const protectedEls = new Set<Element>();
  for (const n of o.outline.nodes) {
    const e = el(n.id);
    if (!e) continue;
    if (n.jevRole === 'help_contact') help.add(e);
    if (n.protected) protectedEls.add(e);
  }
  for (const d of o.decisions) {
    const e = el(d.id);
    if (!e) continue;
    if (d.verdict === 'protect') protectedEls.add(e);
    if (d.verdict === 'protect' && d.judgment.role === 'help_contact') help.add(e);
  }

  // Placement: strip first, then sections in order; an element renders in exactly one place.
  const placed = new Map<Element, string>();
  const stripRoots = dedupe(o.spec.strip.map(el)).filter(stripWorthy).slice(0, 6);
  for (const e of stripRoots) placed.set(e, 'strip');
  const secs = o.spec.sections.map((sec, i) => {
    const hEl = el(sec.heading_ref);
    return { sec, i, hEl, roots: dedupe(sec.nodes.map(el)).filter((r) => r !== hEl) };
  });
  for (const s of secs) for (const r of s.roots) if (!placed.has(r)) placed.set(r, `s${s.i}`);
  for (const s of secs) s.roots = s.roots.filter((r) => placed.get(r) === `s${s.i}`);

  // The form owns its primary action (it renders in the last step).
  const stepFieldEls = o.spec.form_steps.flatMap((st) => st.fields.map(el)).filter((x): x is Element => !!x);
  const formSec =
    secs.find((s) => s.sec.layout === 'form_steps' && s.roots.length) ??
    (stepFieldEls.length ? secs.find((s) => s.roots.some((r) => stepFieldEls.some((f) => within(r, f)))) : undefined);
  if (primary && formSec && placed.get(primary) !== `s${formSec.i}`) {
    const owner = placed.get(primary);
    if (owner && owner !== 'strip') {
      placed.delete(primary);
      for (const s of secs) s.roots = s.roots.filter((r) => r !== primary);
    }
  }

  // Popups that affect the task (Jev keep_popup, e.g. a session-timeout warning) are shown first, like alerts.
  const keepPopups = o.decisions.filter((d) => d.verdict === 'keep_popup').map((d) => el(d.id)).filter((x): x is Element => !!x);

  // Effective state.
  const eff = secs.map((s) => {
    const role = s.sec.role;
    const popupAlert = s.roots.some((r) => keepPopups.some((k) => within(r, k) || within(k, r)));
    const notice: 'alert' | 'consent' | null = role === 'alert' || popupAlert ? 'alert' : role === 'consent' ? 'consent' : null;
    const hoist = notice !== null;
    let state = s.sec.state;
    if (hoist || role === 'help' || role === 'primary' || s === formSec) state = 'open';
    if (primary && s.roots.some((r) => within(r, primary))) state = 'open';
    return { hoist, notice, state };
  });

  // Folded parts keep protected things visible: lift help, open sections holding fields, notices or safety text.
  let lifted = 0;
  const liftedEls: Element[] = [];
  secs.forEach((s, i) => {
    const e = eff[i]!;
    if (e.state === 'open') return;
    for (const r of s.roots) {
      if (help.has(r)) {
        e.state = 'open';
        return;
      }
      for (const p of protectedEls) {
        if (!within(r, p) || help.has(p)) continue;
        if (p.matches(FIELDISH) || p.querySelector(FIELDISH) || p.matches('[role=alert],[role=status],[aria-live]')) {
          e.state = 'open';
          return;
        }
      }
    }
    for (const r of s.roots) {
      const cands = Array.from(help).filter((h) => h !== r && r.contains(h));
      r.querySelectorAll('a[href^="tel:"],a[href^="mailto:"]').forEach((a) => cands.push(a));
      for (const h of cands) {
        if (placed.has(h) || liftedEls.some((x) => within(x, h))) continue;
        placed.set(h, 'help');
        liftedEls.push(h);
        lifted++;
      }
    }
  });

  // Jev-folded distractions inside open parts move to the end drawer (never protected, help or the primary action).
  const folded = new Set<Element>();
  const foldLabel = new Map<Element, SectionLabel>();
  const placedRoots = Array.from(placed.keys());
  const consider = (e: Element, label: SectionLabel): void => {
    if (placed.has(e) || folded.has(e)) return;
    if (primary && within(e, primary)) return;
    for (const p of protectedEls) if (within(e, p)) return;
    for (const h of help) if (within(e, h)) return;
    for (const r of placedRoots) if (e.contains(r)) return;
    if (e.matches(FIELDISH) || e.querySelector('input:not([type=hidden]),select,textarea')) return;
    folded.add(e);
    foldLabel.set(e, label);
  };
  for (const d of o.decisions) {
    if (d.verdict !== 'fold') continue;
    const e = el(d.id);
    if (e) consider(e, d.judgment.role === 'advertising' ? 'Sponsored' : 'Offers');
  }
  for (const n of o.outline.nodes) {
    if (n.protected || (n.jevRole !== 'advertising' && n.jevRole !== 'recommendations')) continue;
    const e = el(n.id);
    if (e) consider(e, n.jevRole === 'advertising' ? 'Sponsored' : 'Related items');
  }

  const ctx = newCtx({ placed, primary, help, folded });
  const read = (key: string, roots: Element[], foldOn: boolean): Block[] => {
    ctx.current = key;
    const keep = ctx.folded;
    if (!foldOn) ctx.folded = new Set();
    const out = roots.flatMap((r) => readBlocks(r, ctx));
    ctx.folded = keep;
    return out;
  };
  for (const s of secs) if (s.hEl) ctx.skip.add(s.hEl);

  // Read sections (open ones first, so Jev folds inside them are collected before the drawer is built).
  const order = secs.map((_, i) => i).sort((a, b) => Number(eff[a]!.state !== 'open') - Number(eff[b]!.state !== 'open') || a - b);
  const built = new Map<number, PlanSection>();
  for (const i of order) {
    const s = secs[i]!;
    const e = eff[i]!;
    const key = `s${i}`;
    const foldOn = e.state === 'open' && !['promo', 'ads', 'related', 'consent'].includes(s.sec.role);
    let title: string | null = s.hEl ? textOf(s.hEl) || null : null;
    let titleEl: Element | null = s.hEl;
    let blocks: Block[] = [];
    let records: Block[][] | null = null;
    let before: Block[] = [];
    let afterB: Block[] = [];
    const layout = s.sec.layout;
    let parts: PlanPart[] | null = null;
    if ((layout === 'card_grid' || layout === 'row_list' || layout === 'facts') && s.roots.length) {
      const split = recordsOf(s.roots);
      if (split.heading && !title) {
        title = textOf(split.heading) || null;
        titleEl = split.heading;
        ctx.skip.add(split.heading);
      }
      if (split.uniform) {
        const recs = split.records.map((r) => read(key, [r], foldOn)).filter((b) => b.length);
        if (recs.length >= 2 || (recs.length === 1 && s.roots.length === 1 && split.records[0] !== s.roots[0])) {
          records = recs;
          const head = split.heading && split.heading !== titleEl ? [split.heading] : [];
          before = read(key, [...head, ...split.before], foldOn);
          afterB = read(key, split.after, foldOn);
        } else {
          blocks = recs.flat();
        }
      } else if (s.roots.length >= 2) {
        // Unlike parts: each keeps its own shape; a part that is itself a list of alike records stays a collection.
        parts = s.roots
          .map((r): PlanPart => {
            const sp = recordsOf([r]);
            if (sp.uniform && sp.records.length >= 3) {
              const recs = sp.records.map((x) => read(key, [x], foldOn)).filter((b) => b.length);
              return {
                key: keyOf(r, 'p'), blocks: [], records: recs,
                before: read(key, [...(sp.heading ? [sp.heading] : []), ...sp.before], foldOn), after: read(key, sp.after, foldOn),
              };
            }
            return { key: keyOf(r, 'p'), blocks: read(key, [r], foldOn), records: null, before: [], after: [] };
          })
          .filter((pt) => pt.blocks.length || pt.records?.length || pt.before.length || pt.after.length);
      } else {
        blocks = read(key, s.roots, foldOn);
      }
    } else {
      blocks = read(key, s.roots, foldOn);
    }
    if (!title && !records && blocks[0]?.b === 'heading') {
      const h = blocks.shift() as Extract<Block, { b: 'heading' }>;
      title = h.text;
      titleEl = h.el;
    }
    const steps = s === formSec ? buildSteps(blocks, o.spec.form_steps, el, o.stepMax ?? 5) : null;
    const count = records ? records.length : parts ? parts.length : flatten(blocks).filter((b) => b.b === 'control' || b.b === 'cardlink').length;
    built.set(i, {
      key, index: i, sec: s.sec, layout, label: s.sec.label, title, titleSize: titleSizeOf(titleEl, layout),
      state: e.state, hoist: e.hoist, notice: e.notice, lead: s.sec.emphasis === 'lead' || s.sec.role === 'primary' || s === formSec,
      isPrimary: s.sec.role === 'primary' || (!!primary && s.roots.some((r) => within(r, primary))) || s === formSec,
      blocks, records, before, after: afterB, parts, steps, count,
      showFirst: s.sec.show_first || (records && records.length > o.listFirst ? o.listFirst : 0),
    });
  }

  // The primary action renders exactly once: if no section reached it, add it to the form's last step or the primary part.
  if (primary && !ctx.primarySeen) {
    const b = controlFor(primary, ctx);
    if (b) {
      b.primary = true;
      const host =
        (formSec && built.get(formSec.i)) ??
        Array.from(built.values()).find((p) => p.sec.role === 'primary') ??
        Array.from(built.values()).find((p) => p.state === 'open' && !p.hoist);
      if (host?.steps) host.steps[host.steps.length - 1]!.blocks.push(b);
      else if (host?.records) host.after.push(b);
      else if (host) host.blocks.push(b);
    }
  }

  const sections = secs.map((s) => built.get(s.i)!).filter((p) => p.blocks.length || p.records?.length || p.parts?.length || p.before.length || p.after.length);
  // One page-size title: the first one that qualifies; titles over 70 characters drop to section size.
  let pageTitleUsed = false;
  for (const p of sections) {
    if (p.hoist || p.state !== 'open') {
      p.titleSize = 'section';
      continue;
    }
    if (p.titleSize === 'page' && !pageTitleUsed && (p.title?.length ?? 0) <= 70) pageTitleUsed = true;
    else p.titleSize = 'section';
  }

  const strip = stripRoots.map((r) => ({ key: keyOf(r, 'strip'), blocks: read('strip', [r], false) })).filter((x) => x.blocks.length);
  const helpBlocks = liftedEls.length ? read('help', liftedEls, false) : [];

  // Drawer: end_drawer sections, Jev-folded parts, then anything no section placed.
  const drawer: DrawerPart[] = sections
    .filter((p) => p.state === 'end_drawer')
    .map((p) => ({ key: p.key, label: p.title ?? p.label, blocks: [], section: p }));
  const hitsByLabel = new Map<SectionLabel, Element[]>();
  for (const h of Array.from(new Set(ctx.foldedHits))) {
    const label = foldLabel.get(h) ?? 'Offers';
    const g = hitsByLabel.get(label);
    if (g) g.push(h);
    else hitsByLabel.set(label, [h]);
  }
  let foldedCount = 0;
  for (const [label, els] of hitsByLabel) {
    const blocks = read(`fold-${label}`, els, false);
    foldedCount += els.length;
    if (blocks.length) drawer.push({ key: `fold-${label}`, label, blocks, section: null });
  }
  const allPlaced = [...Array.from(placed.keys()), ...Array.from(folded)];
  const leftoverEls = o.outline.nodes
    .filter((n) => !n.parent || !ids.has(n.parent))
    .map((n) => el(n.id))
    .filter((e): e is Element => !!e && !e.closest('webable-ui'))
    .filter((e) => !allPlaced.some((r) => within(r, e)) && !allPlaced.some((r) => e.contains(r)));
  const leftovers = leftoverEls.length ? read('left', dedupe(leftoverEls), false) : [];
  if (leftovers.length) drawer.push({ key: 'left', label: 'More on this page', blocks: leftovers, section: null });

  const labels: string[] = [];
  for (const d of drawer) {
    const l = d.section ? d.section.label : d.label;
    if (l && l !== 'More on this page' && l !== 'Other' && !labels.includes(l)) labels.push(l);
  }

  const totalBlocks = sections.reduce((a, p) => a + flatten(allBlocks(p)).length, 0);
  return {
    siteName: siteName(),
    strip,
    hoisted: sections.filter((p) => p.hoist),
    main: sections.filter((p) => !p.hoist && p.state !== 'end_drawer'),
    drawer,
    help: helpBlocks,
    primary,
    roots: [...Array.from(placed.keys()), ...Array.from(folded), ...leftoverEls],
    drawerLabels: labels.slice(0, 4),
    stats: { sections: sections.length, blocks: totalBlocks, ms: Math.round(performance.now() - t0), folded: foldedCount, lifted, leftovers: leftoverEls.length },
  };
}

/** Every block of a section, in order (parts and records opened up). */
export function allBlocks(p: Pick<PlanSection, 'before' | 'blocks' | 'records' | 'after' | 'parts'>): Block[] {
  return [
    ...p.before,
    ...p.blocks,
    ...(p.records ?? []).flat(),
    ...(p.parts ?? []).flatMap((pt) => [...pt.before, ...pt.blocks, ...(pt.records ?? []).flat(), ...pt.after]),
    ...p.after,
  ];
}

/** Pull the primary action and the buttons beside it out of a step, so the last step ends with them. */
export function splitActions(blocks: Block[]): { rest: Block[]; primary: ControlBlock | null; secondary: ControlBlock[] } {
  const idx = blocks.findIndex((b) => b.b === 'control' && b.primary);
  if (idx < 0) return { rest: blocks, primary: null, secondary: [] };
  const primary = blocks[idx] as ControlBlock;
  const row = primary.el.parentElement;
  const secondary: ControlBlock[] = [];
  const rest: Block[] = [];
  blocks.forEach((b, i) => {
    if (i === idx) return;
    if (b.b === 'control' && !b.help && row && (b.el.parentElement === row || row.contains(b.el) || b.el.parentElement?.parentElement === row.parentElement) && Math.abs(i - idx) <= 3) {
      secondary.push(b);
      return;
    }
    rest.push(b);
  });
  return { rest, primary, secondary };
}
