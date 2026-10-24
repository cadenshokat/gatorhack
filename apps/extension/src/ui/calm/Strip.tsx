// Owner: C. The frosted top bar: the site's short name, the provenance chip ("Calm view · Arranged by Jev") with a
// popover that says how the layout was chosen, the page's help link, text size, "Original page" and Close.
// The page's own search, account and cart sit in a small row under the task (SubStrip).
import type { JSX } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { EngineApi, EngineState } from '../../contracts';
import { proxyInput, proxySubmit } from '../proxy';
import { PillButton } from './Blocks';
import { useCalm } from './context';
import * as I from './icons';
import { useLive } from './live';
import type { Block, ControlBlock, FieldBlock } from './model';
import type { CalmPlan } from './plan';
import { leaves } from './sections/layouts';

function StripLink({ b, cls = 'wa-btn' }: { b: ControlBlock; cls?: string }): JSX.Element {
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
    <a class={cls} href={b.href} onClick={press}>
      {body}
    </a>
  ) : (
    <button type="button" class={cls} onClick={() => ctx.click(b.el)}>
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

function StripItem({ blocks, skip, skipText }: { blocks: Block[]; skip: Element | null; skipText: string }): JSX.Element {
  const ls = leaves(blocks);
  const field = ls.find((b): b is FieldBlock => b.b === 'field');
  const controls = ls.filter((b): b is ControlBlock => b.b === 'control' && b.el !== skip && b.text.trim().toLowerCase() !== skipText);
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

/** The page's own search, account and cart controls (under the task, unless the task is to search or find a page). */
export function SubStrip({ plan }: { plan: CalmPlan | null }): JSX.Element | null {
  if (!plan?.strip.length) return null;
  const skip = plan.helpLink?.el ?? null;
  const helpText = plan.helpLink?.text.trim().toLowerCase() ?? '';
  // The same link twice (a header "Contact Us" and a footer one) is shown once.
  const seen = new Set<string>();
  const items = plan.strip.filter((s) => {
    const ls = leaves(s.blocks).filter((b) => !(b.b === 'control' && (b.el === skip || b.text.trim().toLowerCase() === helpText)));
    const names = ls.filter((b): b is ControlBlock => b.b === 'control').map((c) => c.text.trim().toLowerCase()).filter(Boolean);
    const fresh = ls.some((b) => b.b === 'field') || (names.length > 0 && names.some((n) => !seen.has(n)));
    names.forEach((n) => seen.add(n));
    return fresh;
  });
  if (!items.length) return null;
  return (
    <nav class="wa-band wa-band--tight wa-substrip" aria-label="From the top of this page">
      {items.map((s) => (
        <StripItem key={s.key} blocks={s.blocks} skip={skip} skipText={helpText} />
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Provenance chip                                                     */
/* ------------------------------------------------------------------ */

function inTen(p: number | undefined): number | null {
  return typeof p === 'number' && Number.isFinite(p) ? Math.max(0, Math.min(10, Math.round(p * 10))) : null;
}

function Bar({ label, p, tone }: { label: string; p: number; tone: 'good' | 'risk' }): JSX.Element {
  return (
    <div class="wa-pbar" data-tone={tone}>
      <div class="wa-pbar__row">
        <span>{label}</span>
        <b>{p} in 10</b>
      </div>
      <span class="wa-pbar__track" aria-hidden="true">
        <span class="wa-pbar__fill" style={{ width: `${p * 10}%` }} />
      </span>
    </div>
  );
}

function chipText(s: EngineState): string {
  if (s.calm.source === 'ai') return 'Arranged by Jev';
  if (s.calm.source === 'cached') return 'Your last layout';
  return 'Arranged on this device';
}

function Popover({ s, plan, onClose, anchor }: { s: EngineState; plan: CalmPlan | null; onClose: () => void; anchor: HTMLElement | null }): JSX.Element {
  const ctx = useCalm();
  const ref = useRef<HTMLDivElement>(null);
  const title = useId();
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
      anchor?.focus({ preventScroll: true });
    };
    const onDown = (e: PointerEvent): void => {
      const path = e.composedPath();
      if (ref.current && !path.includes(ref.current) && (!anchor || !path.includes(anchor))) onClose();
    };
    const root = ref.current?.getRootNode() as ShadowRoot | Document | undefined;
    root?.addEventListener('keydown', onKey as EventListener, true);
    root?.addEventListener('pointerdown', onDown as EventListener, true);
    return () => {
      root?.removeEventListener('keydown', onKey as EventListener, true);
      root?.removeEventListener('pointerdown', onDown as EventListener, true);
    };
  }, []);
  const rd = s.calm.redesign;
  const n = rd?.candidates.length ?? 0;
  const shown = rd ? (s.calm.source === 'heuristic' ? rd.candidates.find((c) => c.name === 'heuristic') : rd.candidates.find((c) => c.name === rd.chosen)) : undefined;
  const easier = inTen(shown?.pEasier);
  const hides = inTen(shown?.pHides);
  const parts = plan?.drawer.length ?? 0;
  // "4 layouts" when they came from several places; "4 layouts made on this device" when no AI took part.
  const src = rd?.sources;
  const what = src && src.ai === 0 ? `${n} layouts made on this device` : src && src.ai > 0 && src.local > 0 ? `${n} layouts (${src.local} made on this device, ${src.ai} by AI)` : `${n} layouts`;
  let lead: string;
  if (s.calm.source === 'ai' && rd) lead = `Jev compared ${what} and picked this one.`;
  else if (s.calm.source === 'cached') lead = 'This is the layout Jev picked for this page last time.';
  else if (rd && n > 1 && rd.chosen !== 'heuristic') lead = `Jev compared ${what} and found one that may be easier. It is ready when you are.`;
  else if (rd && n > 1) lead = `Jev compared ${what} and kept this one.`;
  else lead = 'Arranged on this device from the page’s own parts, in the page’s order.';
  const visualOk = !!s.calm.visual && !s.calm.visual.rollback;
  return (
    <div class="wa-popover" role="dialog" aria-labelledby={title} tabIndex={-1} ref={ref}>
      <p class="wa-popover__title" id={title}>
        {lead}
      </p>
      {easier !== null && hides !== null && (
        <div class="wa-stack" style={{ gap: '14px' }}>
          <Bar label="Likely easier for you" p={easier} tone="good" />
          <Bar label="Might hide something you need" p={hides} tone="risk" />
        </div>
      )}
      {s.calm.source === 'heuristic' && s.calm.loading && <p class="wa-meta">Jev is comparing layouts for this page now.</p>}
      {s.calm.source === 'heuristic' && !s.calm.loading && !rd && s.ai === 'no_credits' && (
        <p class="wa-meta">AI layouts are paused right now, so this one was arranged on this device.</p>
      )}
      <div class="wa-popover__row">
        <p>
          Nothing is removed.{' '}
          {parts > 0 ? `${parts} ${parts === 1 ? 'part is' : 'parts are'} in More on this page.` : 'Every part of the page is in this view.'}
        </p>
        {parts > 0 && (
          <button
            type="button"
            class="wa-btn wa-btn--soft"
            onClick={() => {
              onClose();
              ctx.showDrawer();
            }}
          >
            Show
          </button>
        )}
      </div>
      {visualOk && <p class="wa-meta">Jev checked before-and-after screenshots.</p>}
    </div>
  );
}

function ProvenanceChip({ api, s, plan }: { api: EngineApi; s: EngineState; plan: CalmPlan | null }): JSX.Element {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const text = chipText(s);
  return (
    <div class="wa-prov">
      <button
        type="button"
        ref={btn}
        class="wa-provchip"
        aria-expanded={open}
        aria-haspopup="dialog"
        data-loading={s.calm.loading || undefined}
        onClick={() => setOpen(!open)}
      >
        <span class="wa-provchip__dot" aria-hidden="true" />
        {s.calm.aiReady ? (
          <span>Calm view</span>
        ) : (
          <span>
            Calm view <span aria-hidden="true">·</span>{' '}
            <span class="wa-provchip__src" key={text}>
              {text}
            </span>
          </span>
        )}
      </button>
      {s.calm.aiReady && (
        <button type="button" class="wa-btn wa-btn--soft wa-aiready" onClick={() => api.useAiLayout()}>
          <I.Spark />
          <span>New layout ready · Use it</span>
        </button>
      )}
      {open && <Popover s={s} plan={plan} anchor={btn.current} onClose={() => setOpen(false)} />}
    </div>
  );
}

export function Strip(props: {
  api: EngineApi;
  state: EngineState;
  plan: CalmPlan | null;
  scale: number;
  setScale: (s: number) => void;
}): JSX.Element {
  const { api, plan, state } = props;
  const step = (d: number): void => props.setScale(Math.round(Math.min(1.6, Math.max(0.85, props.scale + d)) * 100) / 100);
  const name = plan?.siteName ?? location.hostname;
  return (
    <header class="wa-strip">
      <div class="wa-strip__in">
        <div class="wa-brand">
          <span class="wa-dot" aria-hidden="true" />
          <span class="wa-brand__name" title={name}>
            {name}
          </span>
        </div>
        <ProvenanceChip api={api} s={state} plan={plan} />
        <div class="wa-strip__tools">
          {plan?.helpLink && (
            <span class="wa-strip__help">
              <StripLink b={plan.helpLink} cls="wa-btn wa-btn--quiet wa-btn--helplink" />
            </span>
          )}
          <div class="wa-seg" role="group" aria-label="Text size in this view">
            <button type="button" class="wa-btn" aria-label="Smaller text" disabled={props.scale <= 0.85} onClick={() => step(-0.15)}>
              A−
            </button>
            <button type="button" class="wa-btn" aria-label="Larger text" disabled={props.scale >= 1.6} onClick={() => step(0.15)}>
              A+
            </button>
          </div>
          <button type="button" class="wa-btn wa-btn--tonal" onClick={() => api.showOriginal(true)}>
            Original page
          </button>
          <button type="button" class="wa-btn wa-btn--quiet wa-close" aria-label="Close Calm view" title="Close Calm view" onClick={() => api.closeCalm()}>
            <I.Close />
          </button>
        </div>
      </div>
    </header>
  );
}
