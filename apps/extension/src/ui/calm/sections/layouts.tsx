// Owner: D1. One renderer per FitSpec layout. Each arranges some parts specially and draws the rest in order, so no
// visible word or control from the placed part is dropped.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Blocks, BlockView, ControlView, FlowView, ImageView, PillButton, Thumb } from '../Blocks';
import { useCalm } from '../context';
import * as I from '../icons';
import {
  type Block, type CardLinkBlock, type ControlBlock, type FlowBlock, type ImageBlock, PRICE_RE,
} from '../model';
import { type PlanPart, type PlanSection, allBlocks } from '../plan';

/* ---------- helpers ---------- */

/** Leaf blocks in order (lists and groups opened up; a group's legend becomes a heading). */
export function leaves(blocks: Block[]): Block[] {
  const out: Block[] = [];
  const walk = (bs: Block[]): void => {
    for (const b of bs) {
      if (b.b === 'list') b.items.forEach(walk);
      else if (b.b === 'group') {
        if (b.legend) out.push({ b: 'heading', level: 3, text: b.legend, el: b.src as Element, key: `${b.key}l`, src: b.src });
        walk(b.blocks);
      } else out.push(b);
    }
  };
  walk(blocks);
  return out;
}

const BADGE_RE = /^(new|sale|sponsored|ad|advertisement|best ?seller|popular|limited|exclusive|featured|deal|top rated|\d+% off|save \S+)$/i;
function isBadge(t: string): boolean {
  return t.length <= 22 && (BADGE_RE.test(t) || (/[A-Z]/.test(t) && t === t.toUpperCase() && t.split(' ').length <= 3));
}

interface TileParts {
  image: ImageBlock | null;
  eyebrow: string[];
  title: string | null;
  link: ControlBlock | CardLinkBlock | null;
  lines: string[];
  meta: FlowBlock[];
  actions: ControlBlock[];
  other: Block[];
}

function tileParts(blocks: Block[]): TileParts {
  const t: TileParts = { image: null, eyebrow: [], title: null, link: null, lines: [], meta: [], actions: [], other: [] };
  for (const b of leaves(blocks)) {
    if (b.b === 'image' && !t.image) t.image = b;
    else if (b.b === 'cardlink' && !t.title) {
      t.title = b.title;
      t.link = b;
      t.lines = b.lines;
      if (b.image && !t.image) t.image = b.image;
    } else if (b.b === 'heading' && !t.title) t.title = b.text;
    else if (b.b === 'control' && b.role === 'link' && !b.primary && !t.title) {
      t.title = b.text;
      t.link = b;
    } else if (b.b === 'flow') {
      if (!t.title && isBadge(b.text)) t.eyebrow.push(b.text);
      else if (!t.title && b.text.length <= 120 && !PRICE_RE.test(b.text)) t.title = b.text;
      else t.meta.push(b);
    } else if (b.b === 'control') t.actions.push(b);
    else t.other.push(b);
  }
  return t;
}

function TitleLink({ link, text }: { link: ControlBlock | CardLinkBlock; text: string }): JSX.Element {
  const ctx = useCalm();
  const press = (e: MouseEvent): void => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    ctx.click(link.el);
  };
  if (!link.href) {
    return (
      <button type="button" class="wa-inline-link" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => ctx.click(link.el)}>
        {text}
      </button>
    );
  }
  return (
    <a href={link.href} onClick={press}>
      {text}
    </a>
  );
}

function Meta({ f }: { f: FlowBlock }): JSX.Element {
  const price = f.text.length <= 40 && PRICE_RE.test(f.text);
  return price ? <FlowView b={f} /> : <FlowView b={f} quiet />;
}

/** Show the first n, then "Show all N" (n = 0 shows everything). */
function useShowFirst<T>(items: T[], n: number): { shown: T[]; more: JSX.Element | null } {
  const [all, setAll] = useState(false);
  if (!n || items.length <= n) return { shown: items, more: null };
  const more = (
    <div class="wa-more">
      <button type="button" class="wa-btn wa-btn--block" aria-expanded={all} onClick={() => setAll(!all)}>
        {all ? 'Show fewer' : `Show all ${items.length}`}
      </button>
    </div>
  );
  return { shown: all ? items : items.slice(0, n), more };
}

function chunk<T>(xs: T[], n: number): T[][] {
  if (!Number.isFinite(n) || n <= 0) return [xs];
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/* ---------- collections ---------- */

function Tile({ blocks }: { blocks: Block[] }): JSX.Element {
  const t = tileParts(blocks);
  return (
    <article class="wa-tile">
      {t.image && <ImageView b={t.image} well />}
      {t.eyebrow.map((e, i) => (
        <span key={i} class="wa-tile__eyebrow">
          {e}
        </span>
      ))}
      {t.title && <h3 class="wa-tile__title">{t.link ? <TitleLink link={t.link} text={t.title} /> : t.title}</h3>}
      {t.lines.map((l, i) => (
        <span key={`l${i}`} class={PRICE_RE.test(l) && l.length < 40 ? 'wa-p--price' : 'wa-meta'}>
          {l}
        </span>
      ))}
      {t.meta.map((f) => (
        <Meta key={f.key} f={f} />
      ))}
      <Blocks blocks={t.other} />
      {t.actions.length > 0 && (
        <div class="wa-tile__actions">
          {t.actions.map((a) => (
            <ControlView key={a.key} b={a} />
          ))}
        </div>
      )}
    </article>
  );
}

export function CardGrid({ p }: { p: PlanSection }): JSX.Element {
  const records = p.records ?? [];
  const { shown, more } = useShowFirst(records, p.showFirst);
  if (!p.records) return <Generic p={p} />;
  const controls = onlyControls(allBlocks(p));
  if (controls && controls.length >= 2) return <ChipList controls={controls} />;
  return (
    <div class="wa-stack" style={{ gap: 'var(--wa-card-gap)' }}>
      <Blocks blocks={p.before} />
      <div class="wa-grid">
        {shown.map((r) => (
          <Tile key={r[0]?.key} blocks={r} />
        ))}
      </div>
      {more}
      <Blocks blocks={p.after} />
    </div>
  );
}

function RecordRow({ blocks }: { blocks: Block[] }): JSX.Element {
  const ctx = useCalm();
  const t = tileParts(blocks);
  const thumb = t.image && <Thumb img={t.image} />;
  const body = (
    <span class="wa-row__main">
      {t.eyebrow.map((e, i) => (
        <span key={i} class="wa-tile__eyebrow">
          {e}
        </span>
      ))}
      {t.title && <span class="wa-row__title">{t.title}</span>}
      {t.lines.map((l, i) => (
        <span key={`l${i}`} class="wa-meta">
          {l}
        </span>
      ))}
      {t.meta.map((f) => (
        <Meta key={f.key} f={f} />
      ))}
      <Blocks blocks={t.other} />
    </span>
  );
  if (t.link && !t.actions.length && !t.other.length) {
    const link = t.link;
    const press = (e: MouseEvent): void => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      ctx.click(link.el);
    };
    const inner = (
      <>
        {thumb}
        {body}
        <I.ChevronRight class="wa-row__chev" />
      </>
    );
    return link.href ? (
      <a class="wa-row" href={link.href} onClick={press}>
        {inner}
      </a>
    ) : (
      <button type="button" class="wa-row" onClick={() => ctx.click(link.el)}>
        {inner}
      </button>
    );
  }
  return (
    <div class="wa-row">
      {thumb}
      {body}
      {(t.actions.length > 0 || t.link) && (
        <span class="wa-row__aside">
          {t.link && t.link.b === 'control' && <ControlView b={t.link} variant="link" />}
          {t.actions.map((a) => (
            <ControlView key={a.key} b={a} />
          ))}
        </span>
      )}
    </div>
  );
}

export function RowList({ p }: { p: PlanSection }): JSX.Element {
  const ctx = useCalm();
  const records = p.records ?? [];
  const { shown, more } = useShowFirst(records, p.showFirst);
  if (!p.records) return <Generic p={p} />;
  return (
    <div class="wa-stack" style={{ gap: 'var(--wa-card-gap)' }}>
      <Blocks blocks={p.before} />
      <div class="wa-groupgap">
        {chunk(shown, ctx.groupSize).map((g, gi) => (
          <div key={gi} class="wa-rows">
            {g.map((r) => (
              <RecordRow key={r[0]?.key} blocks={r} />
            ))}
          </div>
        ))}
      </div>
      {more}
      <Blocks blocks={p.after} />
    </div>
  );
}

function textBlocks(bs: Block[]): { k: string; rest: Block[] } | null {
  const ls = leaves(bs);
  const first = ls.find((b) => b.b === 'flow' || b.b === 'heading');
  if (!first) return null;
  return { k: (first as { text: string }).text, rest: ls.filter((b) => b !== first) };
}

export function Facts({ p }: { p: PlanSection }): JSX.Element {
  let rows: Array<{ key: string; k: string; rest: Block[] }> | null = [];
  if (p.records) {
    for (const r of p.records) {
      const t = textBlocks(r);
      if (t) rows.push({ key: r[0]!.key, ...t });
    }
  } else {
    const ls = leaves(p.blocks);
    if (ls.length >= 2 && ls.every((b) => b.b === 'flow' || b.b === 'heading')) {
      for (let i = 0; i < ls.length; i += 2) {
        const a = ls[i] as { text: string; key: string };
        const b = ls[i + 1];
        rows.push({ key: a.key, k: a.text, rest: b ? [b] : [] });
      }
    } else rows = null;
  }
  const { shown, more } = useShowFirst(rows ?? [], p.showFirst);
  if (!rows || p.parts) return <Generic p={p} />;
  return (
    <div class="wa-stack" style={{ gap: 'var(--wa-card-gap)' }}>
      <Blocks blocks={p.before} />
      <div class="wa-facts">
        {shown.map((r) => (
          <div key={r.key} class="wa-fact">
            <span class="wa-fact__k">{r.k}</span>
            <span class="wa-stack" style={{ gap: '4px' }}>
              <Blocks blocks={r.rest} />
            </span>
          </div>
        ))}
      </div>
      {more}
      <Blocks blocks={p.after} />
    </div>
  );
}

function split(p: PlanSection, pick: (b: Block) => boolean): { picked: Block[]; rest: Block[] } {
  const all = leaves(allBlocks(p));
  return { picked: all.filter(pick), rest: all.filter((b) => !pick(b)) };
}

export function ChipBar({ p }: { p: PlanSection }): JSX.Element {
  const { picked, rest } = split(p, (b) => b.b === 'control' && !b.primary);
  const { shown, more } = useShowFirst(picked, p.showFirst);
  return (
    <div class="wa-stack">
      <div class="wa-chips">
        {shown.map((c) => (
          <PillButton key={c.key} b={c as ControlBlock} cls="wa-chip" />
        ))}
      </div>
      {more}
      <Blocks blocks={rest} />
    </div>
  );
}

export function LinkGrid({ p }: { p: PlanSection }): JSX.Element {
  const { picked, rest } = split(p, (b) => b.b === 'control' && !b.primary);
  return (
    <div class="wa-stack">
      <div class="wa-linkgrid">
        {picked.map((c) => (
          <ControlView key={c.key} b={c as ControlBlock} variant="link" />
        ))}
      </div>
      {rest.length > 0 && (
        <div class="wa-stack">
          <Blocks blocks={rest} variant="quiet" />
        </div>
      )}
    </div>
  );
}

export function Gallery({ p }: { p: PlanSection }): JSX.Element {
  const { picked, rest } = split(p, (b) => b.b === 'image');
  const { shown, more } = useShowFirst(picked, p.showFirst);
  return (
    <div class="wa-stack">
      <div class="wa-gallery">
        {shown.map((b) => (
          <ImageView key={b.key} b={b as ImageBlock} well />
        ))}
      </div>
      {more}
      <Blocks blocks={rest} />
    </div>
  );
}

/* ---------- content ---------- */

/** Sections made of unlike parts: each part keeps its own card; a part that is a list of alike records stays one. */
export function Parts({ p }: { p: PlanSection }): JSX.Element {
  return (
    <div class="wa-stack" style={{ gap: 'var(--wa-card-gap)' }}>
      {(p.parts ?? []).map((pt) => (
        <PartView key={pt.key} pt={pt} rows={p.layout === 'row_list'} />
      ))}
    </div>
  );
}

function ChipList({ controls }: { controls: ControlBlock[] }): JSX.Element {
  return (
    <div class="wa-chips">
      {controls.map((c) =>
        c.primary ? <ControlView key={c.key} b={c} /> : <PillButton key={c.key} b={c} cls="wa-chip" />,
      )}
    </div>
  );
}

function onlyControls(bs: Block[]): ControlBlock[] | null {
  const ls = leaves(bs);
  return ls.length && ls.every((b) => b.b === 'control') ? (ls as ControlBlock[]) : null;
}

function PartView({ pt, rows }: { pt: PlanPart; rows: boolean }): JSX.Element {
  const ctx = useCalm();
  const controls = onlyControls([...pt.before, ...pt.blocks, ...(pt.records ?? []).flat(), ...pt.after]);
  if (controls && controls.length >= 2) return <ChipList controls={controls} />;
  if (!pt.records) {
    return (
      <div class="wa-frame">
        <Blocks blocks={pt.blocks} />
      </div>
    );
  }
  return (
    <div class="wa-stack" style={{ gap: 'var(--wa-gap)' }}>
      <Blocks blocks={pt.before} />
      {rows ? (
        <div class="wa-groupgap">
          {chunk(pt.records, ctx.groupSize).map((g, gi) => (
            <div key={gi} class="wa-rows">
              {g.map((r) => (
                <RecordRow key={r[0]?.key} blocks={r} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div class="wa-grid">
          {pt.records.map((r) => (
            <Tile key={r[0]?.key} blocks={r} />
          ))}
        </div>
      )}
      <Blocks blocks={pt.after} />
    </div>
  );
}

export function Generic({ p, variant }: { p: PlanSection; variant?: 'default' | 'quiet' | 'prose' }): JSX.Element {
  if (p.parts) return <Parts p={p} />;
  return (
    <div class="wa-stack">
      <Blocks blocks={p.before} variant={variant} />
      <Blocks blocks={p.records ? p.records.flat() : p.blocks} variant={variant} />
      <Blocks blocks={p.after} variant={variant} />
    </div>
  );
}

export function Reading({ p }: { p: PlanSection }): JSX.Element {
  return (
    <div class="wa-sheet">
      <div class="wa-prose">
        <Blocks blocks={allBlocks(p)} variant="prose" />
      </div>
    </div>
  );
}

export function AsIs({ p }: { p: PlanSection }): JSX.Element {
  return (
    <div class="wa-frame">
      <Generic p={p} />
    </div>
  );
}

export function Hero({ p }: { p: PlanSection }): JSX.Element {
  const ls = leaves(allBlocks(p));
  let title = p.title;
  let rest = ls;
  if (!title) {
    const h = ls.find((b) => b.b === 'heading');
    if (h && h.b === 'heading') {
      title = h.text;
      rest = ls.filter((b) => b !== h);
    }
  }
  const lead: FlowBlock[] = [];
  while (rest[0]?.b === 'flow' && lead.length < 2) lead.push(rest.shift() as FlowBlock);
  const controls = rest.filter((b): b is ControlBlock => b.b === 'control' && !b.primary);
  const others = rest.filter((b) => !(b.b === 'control' && !b.primary));
  return (
    <div class="wa-stack" style={{ gap: 'var(--wa-head-gap)' }}>
      {title && <h1 class={p.titleSize === 'page' ? 'wa-h-page' : 'wa-h-section'}>{title}</h1>}
      {lead.map((f) => (
        <FlowView key={f.key} b={f} pageline />
      ))}
      <Blocks blocks={others} />
      {controls.length > 0 && (
        <div class="wa-actions">
          {controls.map((c) => (
            <ControlView key={c.key} b={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BuyBox({ p }: { p: PlanSection }): JSX.Element {
  const ls = leaves(allBlocks(p));
  const media = ls.find((b): b is ImageBlock => b.b === 'image');
  const rest = ls.filter((b) => b !== media);
  return (
    <div class="wa-buy">
      {media && (
        <div class="wa-buy__media">
          <ImageView b={media} well />
        </div>
      )}
      <div class="wa-buy__info">
        {rest.map((b) => (b.b === 'flow' ? <Meta key={b.key} f={b} /> : <BlockView key={b.key} b={b} />))}
      </div>
    </div>
  );
}

/** Consent notices and alerts: every choice kept, all at the same size, none highlighted. */
export function Notice({ p }: { p: PlanSection }): JSX.Element {
  const ls = leaves(allBlocks(p));
  const controls = ls.filter((b): b is ControlBlock => b.b === 'control' && !b.primary);
  const rest = ls.filter((b) => !(b.b === 'control' && !b.primary));
  const alert = p.notice === 'alert';
  return (
    <div class={`wa-notice${alert ? ' wa-notice--alert' : ''}`}>
      <div class="wa-notice__title">
        {alert ? <I.Alert /> : <I.Shield />}
        <span>{p.title ?? p.label}</span>
      </div>
      <Blocks blocks={rest} />
      {controls.length > 0 && (
        <div class="wa-equal">
          {controls.map((c) => (
            <PillButton key={c.key} b={c} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Help is always open: a quiet card with a help icon. */
export function HelpCard({ blocks, title }: { blocks: Block[]; title?: string | null }): JSX.Element {
  return (
    <div class="wa-help">
      <span class="wa-help__icon" aria-hidden="true">
        <I.Help />
      </span>
      <div class="wa-help__body">
        {title && <span class="wa-label">{title}</span>}
        <div class="wa-actions" style={{ gap: '4px 16px' }}>
          <Blocks blocks={blocks} />
        </div>
      </div>
    </div>
  );
}
