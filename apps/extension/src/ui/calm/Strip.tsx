// Owner: D1. The frosted top bar: site name, the page's own search / account / cart / help, and WebAble's controls
// (Original page, Close). WebAble's own controls are fern; the site's are neutral.
import type { JSX } from 'preact';
import type { EngineApi } from '../../contracts';
import { proxyInput, proxySubmit } from '../proxy';
import { PillButton } from './Blocks';
import { useCalm } from './context';
import * as I from './icons';
import { useLive } from './live';
import type { Block, ControlBlock, FieldBlock } from './model';
import type { CalmPlan } from './plan';
import { leaves } from './sections/layouts';

function StripLink({ b }: { b: ControlBlock }): JSX.Element {
  const ctx = useCalm();
  const press = (e: MouseEvent): void => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    ctx.click(b.el);
  };
  const body = (
    <>
      {b.help && b.href?.startsWith('tel:') ? <I.Phone /> : b.help ? <I.Help /> : null}
      <span>{b.text}</span>
    </>
  );
  return b.href ? (
    <a class="wa-btn" href={b.href} onClick={press}>
      {body}
    </a>
  ) : (
    <button type="button" class="wa-btn" onClick={() => ctx.click(b.el)}>
      {body}
    </button>
  );
}

function SearchPill({ field, submit }: { field: FieldBlock; submit: ControlBlock | null }): JSX.Element | null {
  const ctx = useCalm();
  const live = useLive(field.el);
  if (live.kind !== 'text') return null;
  return (
    <form
      class="wa-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (submit) ctx.click(submit.el);
        else proxySubmit(field.el);
      }}
    >
      <label class="wa-search__field">
        <span class="wa-sr">{field.label || 'Search'}</span>
        <I.Search />
        <input
          type="search"
          value={live.value}
          placeholder={field.label && field.label.length <= 22 ? field.label : 'Search'}
          onInput={(e) => proxyInput(field.el, (e.currentTarget as HTMLInputElement).value)}
        />
      </label>
      {submit && (
        <button type="submit" class="wa-btn">
          {submit.text}
        </button>
      )}
    </form>
  );
}

function StripItem({ blocks }: { blocks: Block[] }): JSX.Element {
  const ls = leaves(blocks);
  const field = ls.find((b): b is FieldBlock => b.b === 'field');
  const controls = ls.filter((b): b is ControlBlock => b.b === 'control');
  if (field) {
    const submit = controls.find((c) => c.role === 'button') ?? null;
    const others = controls.filter((c) => c !== submit);
    return (
      <>
        <SearchPill field={field} submit={submit} />
        {others.map((c) => (
          <span key={c.key} class="wa-strip__item">
            {c.role === 'link' ? <StripLink b={c} /> : <PillButton b={c} />}
          </span>
        ))}
      </>
    );
  }
  return (
    <>
      {controls.slice(0, 3).map((c) => (
        <span key={c.key} class="wa-strip__item">
          {c.role === 'link' ? <StripLink b={c} /> : <PillButton b={c} />}
        </span>
      ))}
    </>
  );
}

/** The page's own search, account, cart and help controls, just under the bar (scrolls with the page). */
export function SubStrip({ plan }: { plan: CalmPlan | null }): JSX.Element | null {
  if (!plan?.strip.length) return null;
  // The same link twice (a header "Contact Us" and a footer one) is shown once.
  const seen = new Set<string>();
  const items = plan.strip.filter((s) => {
    const ls = leaves(s.blocks);
    const names = ls.filter((b): b is ControlBlock => b.b === 'control').map((c) => c.text.trim().toLowerCase()).filter(Boolean);
    const fresh = ls.some((b) => b.b === 'field') || !names.length || names.some((n) => !seen.has(n));
    names.forEach((n) => seen.add(n));
    return fresh;
  });
  return (
    <nav class="wa-substrip" aria-label="From the top of this page">
      {items.map((s) => (
        <StripItem key={s.key} blocks={s.blocks} />
      ))}
    </nav>
  );
}

export function Strip(props: {
  api: EngineApi;
  plan: CalmPlan | null;
  scale: number;
  setScale: (s: number) => void;
}): JSX.Element {
  // The "new layout is ready" chip is drawn by the in-page chrome (D2), not here, so it never shows twice.
  const { api, plan } = props;
  const step = (d: number): void => props.setScale(Math.round(Math.min(1.6, Math.max(0.85, props.scale + d)) * 100) / 100);
  return (
    <header class="wa-strip">
      <div class="wa-strip__in">
        <div class="wa-brand">
          <span class="wa-dot" aria-hidden="true" />
          <span class="wa-brand__name">{plan?.siteName ?? document.title}</span>
          <span class="wa-brand__tag">Calm view</span>
        </div>
        <div class="wa-strip__tools">
          <div class="wa-seg" role="group" aria-label="Text size in this view">
            <button type="button" class="wa-btn" aria-label="Smaller text" disabled={props.scale <= 0.85} onClick={() => step(-0.15)}>
              A−
            </button>
            <button type="button" class="wa-btn" aria-label="Larger text" disabled={props.scale >= 1.6} onClick={() => step(0.15)}>
              A+
            </button>
          </div>
          <button type="button" class="wa-btn wa-btn--accent" onClick={() => api.showOriginal(true)}>
            Original page
          </button>
          <button type="button" class="wa-btn wa-btn--quiet" aria-label="Close Calm view" onClick={() => api.closeCalm()}>
            <I.Close />
            <span>Close</span>
          </button>
        </div>
      </div>
    </header>
  );
}
