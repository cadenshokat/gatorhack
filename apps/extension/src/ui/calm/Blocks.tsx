// Owner: C. Draws the block model. Every control proxies its original; every word is the page's own visible text.
import type { JSX } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { proxyCheck, proxyClick, proxyCommit, proxyInput, proxyKey, proxySelect, proxySubmit, renderLiveValue } from '../proxy';
import { isIrreversible, useCalm } from './context';
import * as I from './icons';
import { tickNow, useLive } from './live';
import {
  type Block, type CardLinkBlock, type ChoiceBlock, type ChoicesBlock, type ControlBlock, type FieldBlock, type FlowBlock,
  type ImageBlock, type Inline, type LinkPart, type ListBlock, type PeekBlock, type RichTableBlock, type SelectBlock, type TableBlock,
  PRICE_RE, isDense, splitParts, stripMarker,
} from './model';

export type Variant = 'default' | 'quiet' | 'prose';

/** Blocks in page order; runs of adjacent buttons or links share one wrapping row. */
export function Blocks({ blocks, variant = 'default' }: { blocks: Block[]; variant?: Variant }): JSX.Element {
  const out: JSX.Element[] = [];
  let run: ControlBlock[] = [];
  let cards: CardLinkBlock[] = [];
  const flushCards = (): void => {
    if (cards.length) {
      const thumbs = cards.filter((c) => c.image && keepImage(c.image, true)).length * 2 >= cards.length;
      out.push(
        <div class="wa-rows" key={`${cards[0]!.key}c`}>
          {cards.map((c) => (
            <CardLinkRow key={c.key} b={c} thumbs={thumbs} />
          ))}
        </div>,
      );
    }
    cards = [];
  };
  const flush = (): void => {
    flushCards();
    if (run.length === 1) out.push(<BlockView key={run[0]!.key} b={run[0]!} variant={variant} />);
    else if (run.length > 1) {
      out.push(
        <div class="wa-actions" key={`${run[0]!.key}r`}>
          {run.map((c) => (
            <ControlView key={c.key} b={c} />
          ))}
        </div>,
      );
    }
    run = [];
  };
  for (const b of blocks) {
    if (b.b === 'cardlink') {
      if (run.length) flush();
      cards.push(b);
      continue;
    }
    if (b.b === 'control' && !b.primary) {
      flushCards();
      run.push(b);
      continue;
    }
    flush();
    out.push(<BlockView key={b.key} b={b} variant={variant} />);
  }
  flush();
  return <>{out}</>;
}

export function BlockView({ b, variant = 'default' }: { b: Block; variant?: Variant }): JSX.Element | null {
  switch (b.b) {
    case 'heading': {
      if (b.level <= 1) return <h2 class="wa-h-section">{b.text}</h2>;
      if (b.level <= 3) return <h3 class="wa-h-title">{b.text}</h3>;
      return <h4 class="wa-label">{b.text}</h4>;
    }
    case 'flow': return <FlowView b={b} quiet={variant === 'quiet'} />;
    case 'control': return <ControlView b={b} />;
    case 'field': return <FieldView b={b} />;
    case 'select': return <SelectView b={b} />;
    case 'choices': return <ChoicesView b={b} />;
    case 'choice': return <ChoicesView b={{ b: 'choices', type: b.type, items: [b], key: `${b.key}g`, src: b.src }} />;
    case 'image': return keepImage(b, false) ? <ImageView b={b} /> : null;
    case 'list': return <ListView b={b} variant={variant} />;
    case 'table': return <TableView b={b} />;
    case 'rtable': return <RichTableView b={b} />;
    case 'group':
      return (
        <div class="wa-group" role="group" aria-label={b.legend || undefined}>
          {b.legend && <h3 class="wa-h-title">{b.legend}</h3>}
          <Blocks blocks={b.blocks} variant={variant} />
        </div>
      );
    case 'cardlink': return <CardLinkView b={b} />;
    case 'peek': return <PeekView b={b} />;
    default: return null;
  }
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

export function InlineLink({ p }: { p: LinkPart }): JSX.Element {
  const ctx = useCalm();
  const press = (e: MouseEvent): void => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // our own href opens a new tab
    e.preventDefault();
    ctx.click(p.el);
  };
  if (!p.href) {
    return (
      <button type="button" class="wa-inline-link" onClick={() => ctx.click(p.el)}>
        {p.text}
      </button>
    );
  }
  return (
    <a class="wa-inline-link" href={p.href} onClick={press}>
      {p.text}
    </a>
  );
}

function renderParts(parts: Inline[]): JSX.Element[] {
  return parts.map((p, i) => {
    if (p.t === 'text') return <span key={i}>{p.text}</span>;
    if (p.t === 'br') return <br key={i} />;
    return <InlineLink key={i} p={p} />;
  });
}

export function FlowView({ b, quiet = false, pageline = false }: { b: FlowBlock; quiet?: boolean; pageline?: boolean }): JSX.Element {
  const ctx = useCalm();
  const ref = useRef<HTMLDivElement>(null);
  const price = b.text.length <= 40 && PRICE_RE.test(b.text);
  const dense = ctx.explainOn && isDense(b.text);
  const paras: Inline[][] = Number.isFinite(ctx.splitN) && b.text.length > 160 ? splitParts(b.parts, ctx.splitN) : [b.parts];
  const links = b.parts.filter((p) => p.t === 'link').length;
  const plain = b.parts.map((p) => (p.t === 'text' ? p.text : '')).join('');
  const crumbs = links >= 2 && b.text.length <= 120 && /[›»>/|]/.test(plain);
  const cls = `wa-p${quiet || pageline ? ' wa-p--quiet' : ''}${price ? ' wa-p--price' : ''}${crumbs ? ' wa-crumbs' : ''}`;
  const explain = (): void => {
    const r = ref.current?.getBoundingClientRect();
    void ctx.api.explainSelection(b.text, r ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: 0, y: 0, w: 0, h: 0 });
  };
  if (paras.length === 1 && !dense) {
    return <p class={cls}>{renderParts(paras[0]!)}</p>;
  }
  return (
    <div class="wa-para" ref={ref}>
      {paras.map((ps, i) => (
        <p key={i} class={cls}>
          {renderParts(ps)}
        </p>
      ))}
      {dense && (
        <button type="button" class="wa-btn wa-btn--soft wa-explain" onClick={explain}>
          <span class="wa-dot" aria-hidden="true" />
          Explain in plain words
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

function liveLabel(v: ReturnType<typeof renderLiveValue>, fallback: string): string {
  if (v.kind === 'control' && v.label) return v.label.length > 160 ? `${v.label.slice(0, 157)}…` : v.label;
  return fallback;
}

/** Page tools (Print, Save, Listen): quiet icon links, never grey pills. */
export const TOOL_RE = /^(print( this)?( page)?|save( to (my )?list)?|share( this)?|listen|play( pronunciation| audio)?|email( this)?( page)?|bookmark|download( pdf)?)$/i;

export function ToolIcon({ text }: { text: string }): JSX.Element {
  if (/print/i.test(text)) return <I.Print />;
  if (/listen|play/i.test(text)) return <I.Speaker />;
  if (/email/i.test(text)) return <I.Mail />;
  return <I.Bookmark />;
}

function ToolButton({ b }: { b: ControlBlock }): JSX.Element {
  const ctx = useCalm();
  return (
    <button type="button" class="wa-btn wa-btn--tool" onClick={() => ctx.click(b.el)}>
      <ToolIcon text={b.text} />
      <span>{b.text}</span>
    </button>
  );
}

export function ControlView({ b, variant }: { b: ControlBlock; variant?: 'pill' | 'chip' | 'link' | 'quiet' }): JSX.Element | null {
  // The page's main action lives in the dock (one filled button on screen at most).
  if (b.primary) return null;
  if (TOOL_RE.test(b.text.trim())) return <ToolButton b={b} />;
  if (variant === 'chip') return <PillButton b={b} cls="wa-chip" />;
  if (b.role === 'link' || variant === 'link') return <LinkButton b={b} />;
  return <PillButton b={b} cls={variant === 'quiet' ? 'wa-btn--quiet' : ''} />;
}

export function PillButton({ b, cls = '' }: { b: ControlBlock; cls?: string }): JSX.Element | null {
  const ctx = useCalm();
  const live = useLive(b.el);
  if (live.kind === 'gone') return null;
  const disabled = (live.kind === 'control' || live.kind === 'check' || live.kind === 'text') && live.disabled;
  const pressed = live.kind === 'control' ? live.pressed : null;
  const expanded = live.kind === 'control' ? live.expanded : null;
  const selected = b.selected || pressed === true;
  return (
    <button
      type="button"
      class={`wa-btn ${cls}`}
      data-selected={selected || undefined}
      disabled={disabled}
      aria-pressed={pressed === null ? undefined : pressed}
      aria-expanded={expanded === null ? undefined : expanded}
      onClick={() => ctx.click(b.el)}
    >
      <span>{liveLabel(live, b.text)}</span>
    </button>
  );
}

export function LinkButton({ b, cls = '' }: { b: ControlBlock; cls?: string }): JSX.Element {
  const ctx = useCalm();
  const tel = b.href?.startsWith('tel:');
  const mail = b.href?.startsWith('mailto:');
  const press = (e: MouseEvent): void => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    ctx.click(b.el);
  };
  const body = (
    <>
      {tel && <I.Phone />}
      {mail && <I.Mail />}
      <span>{b.text}</span>
      {!tel && !mail && <I.ChevronRight />}
    </>
  );
  if (!b.href) {
    return (
      <button type="button" class={`wa-btn wa-btn--link ${cls}`} data-selected={b.selected || undefined} onClick={() => ctx.click(b.el)}>
        {body}
      </button>
    );
  }
  return (
    <a class={`wa-btn wa-btn--link ${cls}`} href={b.href} data-selected={b.selected || undefined} aria-current={b.selected ? 'page' : undefined} onClick={press}>
      {body}
    </a>
  );
}

/** The page's main action: the only filled blue pill, full width, at the person's target size. */
export function PrimaryAction({ b }: { b: ControlBlock }): JSX.Element | null {
  const ctx = useCalm();
  const live = useLive(b.el);
  const [armed, setArmed] = useState(false);
  const hint = useId();
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 6000);
    return () => window.clearTimeout(t);
  }, [armed]);
  if (live.kind === 'gone') return null;
  const label = liveLabel(live, b.text);
  const disabled = (live.kind === 'control' || live.kind === 'text') && live.disabled;
  const twice = isIrreversible(label);
  const press = (): void => {
    if (disabled) return;
    if (twice && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    ctx.pressPrimary(b.el);
  };
  return (
    <div class="wa-primary">
      <button
        type="button"
        class="wa-btn wa-btn--primary"
        data-primary="true"
        data-armed={armed || undefined}
        disabled={disabled}
        aria-describedby={hint}
        onClick={press}
      >
        {label}
      </button>
      <p id={hint} class="wa-primary__hint" aria-live="polite">
        {armed
          ? `Press again to confirm. This presses “${label}” on the page.`
          : disabled
            ? 'The page has this button turned off for now.'
            : ''}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */

export function FieldView({ b, compact = false }: { b: FieldBlock; compact?: boolean }): JSX.Element | null {
  const live = useLive(b.el);
  const id = useId();
  const hintId = useId();
  if (live.kind === 'gone') return null;
  const value = live.kind === 'text' ? live.value : '';
  const disabled = live.kind === 'text' && live.disabled;
  const readOnly = live.kind === 'text' && live.readOnly;
  const label = (b.required ? stripMarker(b.label) : b.label) || 'Text field';
  const onInput = (e: Event): void => proxyInput(b.el, (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value);
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' || b.multiline) return;
    e.preventDefault();
    if (b.search) proxySubmit(b.el);
    else proxyKey(b.el, 'Enter');
  };
  const ac = (b.el.getAttribute('autocomplete') ?? '').toLowerCase();
  const width =
    /postal-code|cc-csc|bday-(day|month|year)/.test(ac) || /\b(zip|postcode|postal)\b/i.test(label) || (b.el instanceof HTMLInputElement && b.el.maxLength > 0 && b.el.maxLength <= 5)
      ? ' wa-input--10'
      : b.type === 'tel' || /\btel\b/.test(ac) || (b.el instanceof HTMLInputElement && b.el.maxLength > 0 && b.el.maxLength <= 12)
        ? ' wa-input--20'
        : b.type === 'email' || /\bemail\b/.test(ac)
          ? ' wa-input--30'
          : '';
  const common = {
    id,
    'data-k': b.key,
    class: `wa-input${b.multiline ? '' : width}`,
    value,
    disabled,
    readOnly,
    'aria-describedby': b.hint ? hintId : undefined,
    'aria-required': b.required || undefined,
    'aria-invalid': b.el.getAttribute('aria-invalid') === 'true' || undefined,
    autoComplete: b.el.getAttribute('autocomplete') ?? undefined,
    inputMode: (b.el.getAttribute('inputmode') ?? undefined) as JSX.HTMLAttributes['inputMode'],
    onInput,
    onBlur: () => proxyCommit(b.el),
  };
  return (
    <div class="wa-field">
      <label class={compact ? 'wa-sr' : 'wa-label'} for={id}>
        {label}
        {b.required && <span class="wa-req"> (required)</span>}
      </label>
      {b.multiline ? (
        <textarea {...common} rows={4} />
      ) : (
        <input {...common} type={b.type} onKeyDown={onKey} placeholder={compact ? label : undefined} />
      )}
      {b.hint && (
        <span id={hintId} class="wa-hint">
          {b.hint}
        </span>
      )}
    </div>
  );
}

export function SelectView({ b }: { b: SelectBlock }): JSX.Element | null {
  const live = useLive(b.el);
  const id = useId();
  if (live.kind !== 'select') return null;
  return (
    <div class="wa-field">
      <label class="wa-label" for={id}>
        {(b.required ? stripMarker(b.label) : b.label) || 'Choose one'}
        {b.required && <span class="wa-req"> (required)</span>}
      </label>
      <div class="wa-selectwrap">
        <select
          id={id}
          data-k={b.key}
          class="wa-input"
          value={String(live.index)}
          disabled={live.disabled}
          onChange={(e) => {
            proxySelect(b.el, Number((e.currentTarget as HTMLSelectElement).value));
            tickNow();
          }}
        >
          {live.options.map((o, i) => (
            <option key={i} value={String(i)}>
              {o || '—'}
            </option>
          ))}
        </select>
        <I.ChevronDown />
      </div>
      {b.hint && <span class="wa-hint">{b.hint}</span>}
    </div>
  );
}

export function ChoicesView({ b }: { b: ChoicesBlock }): JSX.Element {
  const group = useId();
  return (
    <div class="wa-choices" role={b.type === 'radio' ? 'radiogroup' : undefined}>
      {b.items.map((c) => (
        <ChoiceRow key={c.key} c={c} name={b.type === 'radio' ? `wa${group}` : undefined} />
      ))}
    </div>
  );
}

function ChoiceRow({ c, name }: { c: ChoiceBlock; name?: string }): JSX.Element | null {
  const live = useLive(c.el);
  if (live.kind === 'gone') return null;
  const checked = live.kind === 'check' && live.checked;
  const disabled = live.kind === 'check' && live.disabled;
  const onChange = (e: Event): void => {
    const input = e.currentTarget as HTMLInputElement;
    if (c.el instanceof HTMLInputElement) proxyCheck(c.el);
    else proxyClick(c.el);
    const now = renderLiveValue(c.el);
    input.checked = now.kind === 'check' ? now.checked : false;
    tickNow();
  };
  return (
    <>
      <label class="wa-choice" data-checked={checked || undefined} data-disabled={disabled || undefined}>
        <input class="wa-sr" type={c.type} name={name} checked={checked} disabled={disabled} onChange={onChange} data-k={c.key} />
        <span class={`wa-box${c.type === 'radio' ? ' wa-box--radio' : ''}`} aria-hidden="true">
          {c.type === 'radio' ? <span class="wa-box__dot" /> : <I.Check />}
        </span>
        <span class="wa-choice__text">
          <span class="wa-choice__title">{stripMarker(c.title)}</span>
          {c.meta.map((m, i) => (
            <span key={i} class="wa-choice__meta">
              {m}
            </span>
          ))}
        </span>
      </label>
      {c.extra.length > 0 && (
        <div class="wa-choice__extra">
          <Blocks blocks={c.extra} />
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Media, lists, tables, cards                                         */
/* ------------------------------------------------------------------ */

/* Pictures: shown only once they decode (within 1.5 s, at least 48 px wide), never as an empty box. */
const decoded = new Map<string, boolean>();

function useDecoded(url: string): boolean | null {
  const [ok, setOk] = useState<boolean | null>(() => decoded.get(url) ?? null);
  useEffect(() => {
    const known = decoded.get(url);
    if (known !== undefined) {
      setOk(known);
      return;
    }
    let alive = true;
    const img = new Image();
    img.decoding = 'async';
    const done = (v: boolean): void => {
      decoded.set(url, v);
      if (alive) setOk(v);
    };
    const timer = window.setTimeout(() => done(false), 1500);
    img.src = url;
    img
      .decode()
      .then(() => done(img.naturalWidth >= 48))
      .catch(() => done(false))
      .finally(() => window.clearTimeout(timer));
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [url]);
  return ok;
}

/**
 * Which pictures earn a place: never logos (the site's name is in the top bar) or wide stock banners; a picture with no
 * description only when it is a product, a gallery or tile picture (`framed`), a captioned figure or an image-only link.
 */
export function keepImage(b: ImageBlock, framed: boolean): boolean {
  if (b.logo) return false;
  if (b.caption || /\b(chart|graph|map|diagram|figure)\b/i.test(b.alt)) return true;
  // Wide stock pictures in heroes and carousels carry no part of the task.
  if (b.banner && b.w >= 360) return false;
  if (framed) return true;
  if (b.w >= 560 && b.w / Math.max(1, b.h) >= 1.45) return false;
  return !!b.alt || b.linked;
}

export function ImageView({ b, well = false }: { b: ImageBlock; well?: boolean }): JSX.Element | null {
  const ok = useDecoded(b.url);
  if (!ok) return null;
  const img = <img src={b.url} alt={b.alt} decoding="async" />;
  if (well) return <div class="wa-well" data-fit={b.fit}>{img}</div>;
  return (
    <figure class={`wa-figure${Math.max(b.w, b.h) < 120 ? ' wa-figure--icon' : ''}`}>
      {img}
      {b.caption && <figcaption class="wa-meta">{b.caption}</figcaption>}
    </figure>
  );
}

function onlyControls(items: Block[][]): ControlBlock[] | null {
  const out: ControlBlock[] = [];
  for (const it of items) {
    if (it.length !== 1 || it[0]!.b !== 'control') return null;
    out.push(it[0] as ControlBlock);
  }
  return out;
}

function ListView({ b, variant }: { b: ListBlock; variant: Variant }): JSX.Element {
  // A list of card links is one grouped list of rows.
  if (b.items.length >= 2 && b.items.every((it) => it.length === 1 && it[0]!.b === 'cardlink')) {
    const cards = b.items.map((it) => it[0] as CardLinkBlock);
    const thumbs = cards.filter((c) => c.image && keepImage(c.image, true)).length * 2 >= cards.length;
    return (
      <div class="wa-rows">
        {cards.map((c) => (
          <CardLinkRow key={c.key} b={c} thumbs={thumbs} />
        ))}
      </div>
    );
  }
  const links = variant !== 'prose' ? onlyControls(b.items) : null;
  if (links && links.length && links.every((l) => l.role === 'link')) {
    return (
      <div class="wa-rows">
        {links.map((l) => (
          <RowLink key={l.key} b={l} />
        ))}
      </div>
    );
  }
  if (links && links.length) {
    return (
      <div class="wa-actions">
        {links.map((l) => (
          <ControlView key={l.key} b={l} />
        ))}
      </div>
    );
  }
  const Tag = b.ordered ? 'ol' : 'ul';
  // Bullets for lists of words only; a list of cards, pictures or buttons is drawn without them.
  const plain = b.items.some((it) => it.some((x) => x.b !== 'flow' && x.b !== 'control'));
  return (
    <Tag class={`wa-list${b.ordered ? ' wa-list--ol' : ''}${plain ? ' wa-list--plain' : ''}`}>
      {b.items.map((it, i) => (
        <li key={it[0]?.key ?? i} class="wa-stack" style={{ gap: '6px' }}>
          <Blocks blocks={it} variant={variant} />
        </li>
      ))}
    </Tag>
  );
}

export function RowLink({ b }: { b: ControlBlock }): JSX.Element {
  const ctx = useCalm();
  const press = (e: MouseEvent): void => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    ctx.click(b.el);
  };
  const inner = (
    <>
      <span class="wa-row__main">
        <span class="wa-row__title">{b.text}</span>
      </span>
      <I.ChevronRight class="wa-row__chev" />
    </>
  );
  if (b.href) {
    return (
      <a class="wa-row" href={b.href} onClick={press}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" class="wa-row" onClick={() => ctx.click(b.el)}>
      {inner}
    </button>
  );
}

function TableView({ b }: { b: TableBlock }): JSX.Element {
  const [head, ...rest] = b.head ? b.rows : [null, ...b.rows];
  return (
    <div class="wa-table-wrap">
      <table class="wa-table">
        {head && (
          <thead>
            <tr>
              {head.map((c, i) => (
                <th key={i} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rest.map((r, i) =>
            r ? (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ) : null,
          )}
        </tbody>
      </table>
    </div>
  );
}

function RichTableView({ b }: { b: RichTableBlock }): JSX.Element {
  const wide = b.rows.filter((r) => r.cells.length > 2).length > b.rows.length / 2;
  if (wide) {
    return (
      <div class="wa-table-wrap">
        <table class="wa-table">
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>
                {r.cells.map((c, j) =>
                  r.head ? (
                    <th key={j} scope="col">
                      <Blocks blocks={c} />
                    </th>
                  ) : (
                    <td key={j}>
                      <Blocks blocks={c} />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div class="wa-facts">
      {b.rows.map((r, i) =>
        r.cells.length === 1 ? (
          <div key={i} class={`wa-fact wa-fact--one${r.head ? ' wa-fact--head' : ''}`}>
            <div class="wa-stack">
              <Blocks blocks={r.cells[0]!} />
            </div>
          </div>
        ) : (
          <div key={i} class="wa-fact">
            <div class="wa-fact__k wa-stack">
              <Blocks blocks={r.cells[0]!} variant="quiet" />
            </div>
            <div class="wa-stack" style={{ gap: '6px' }}>
              {r.cells.slice(1).map((c, j) => (
                <Blocks key={j} blocks={c} />
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

/** A small picture in a soft well; shown only once it decodes. */
export function Thumb({ img }: { img: ImageBlock }): JSX.Element | null {
  const ok = useDecoded(img.url);
  if (!ok || img.logo) return null;
  return (
    <span class="wa-well wa-row__thumb" data-fit={img.fit}>
      <img src={img.url} alt={img.alt} decoding="async" />
    </span>
  );
}

function CardLinkRow({ b, thumbs = true }: { b: CardLinkBlock; thumbs?: boolean }): JSX.Element {
  const ctx = useCalm();
  const press = (e: MouseEvent): void => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    ctx.click(b.el);
  };
  const inner = (
    <>
      {thumbs && b.image && keepImage(b.image, true) && <Thumb img={b.image} />}
      <span class="wa-row__main">
        <span class="wa-row__title">{b.title}</span>
        {b.lines.map((l, i) => (
          <span key={i} class={PRICE_RE.test(l) && l.length < 40 ? 'wa-p--price' : 'wa-meta'}>
            {l}
          </span>
        ))}
      </span>
      <I.ChevronRight class="wa-row__chev" />
    </>
  );
  return b.href ? (
    <a class="wa-row" href={b.href} onClick={press}>
      {inner}
    </a>
  ) : (
    <button type="button" class="wa-row" onClick={() => ctx.click(b.el)}>
      {inner}
    </button>
  );
}

export function CardLinkView({ b }: { b: CardLinkBlock }): JSX.Element {
  return (
    <div class="wa-rows">
      <CardLinkRow b={b} />
    </div>
  );
}

const PEEK_COPY: Record<PeekBlock['why'], { title: string; line: string; button: string }> = {
  sensitive: { title: 'Private field', line: 'Type this on the page itself. WebAble does not copy it.', button: 'Type it on the page' },
  media: { title: 'Video or audio', line: 'Play it on the page.', button: 'Play it on the page' },
  editor: { title: 'Text editor', line: 'Type in it on the page.', button: 'Use it on the page' },
  file: { title: 'Control', line: 'This control works best on the page.', button: 'Use it on the page' },
  frame: { title: 'Embedded part of the page', line: 'It is shown on the page itself.', button: 'Show it on the page' },
  rest: { title: 'The rest of this part', line: 'This part is long. The rest is on the page.', button: 'Show it on the page' },
};

function PeekView({ b }: { b: PeekBlock }): JSX.Element {
  const ctx = useCalm();
  const copy = PEEK_COPY[b.why];
  const Icon = b.why === 'sensitive' ? I.Lock : b.why === 'media' ? I.Play : I.ChevronRight;
  return (
    <div class="wa-peek">
      <span class="wa-help__icon" aria-hidden="true">
        <Icon />
      </span>
      <span class="wa-peek__text">
        <span class="wa-label">{b.label || copy.title}</span>
        <span class="wa-meta">{copy.line}</span>
      </span>
      <button type="button" class="wa-btn" onClick={() => ctx.peek(b.el)}>
        {copy.button}
      </button>
    </div>
  );
}
