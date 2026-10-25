// Owner: C, U (round 6: the strip never overlaps). The frosted top bar: the site's short name, the provenance chip
// ("Calm view · Arranged by Jev") with a popover that says how the layout was chosen, the page's help link, text size,
// "Original page" and Close. The page's own search, account and cart sit in a small row under the task (SubStrip).
//
// The bar never overlaps or clips. It measures itself and, when space runs short, collapses in this order (the
// lowest priority first): the site name shrinks (at most about 20 characters, with an ellipsis); the chip becomes a
// dot and "Calm view"; A− / A+ move into a small "⋯" menu; then the help link; then the site name leaves. Close and
// "Original page" are always there. "New layout ready · Use it" is never in the bar: it is a slim line under it.
import type { JSX } from 'preact';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
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

function ProvenanceChip({ s, plan, short }: { s: EngineState; plan: CalmPlan | null; short: boolean }): JSX.Element {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const text = chipText(s);
  const full = !s.calm.aiReady && !short;
  return (
    <div class="wa-prov">
      <button
        type="button"
        ref={btn}
        class="wa-provchip"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={full ? undefined : `Calm view · ${text}`}
        data-loading={s.calm.loading || undefined}
        onClick={() => setOpen(!open)}
      >
        <span class="wa-provchip__dot" aria-hidden="true" />
        {full ? (
          <span>
            Calm view <span aria-hidden="true">·</span>{' '}
            <span class="wa-provchip__src" key={text}>
              {text}
            </span>
          </span>
        ) : (
          <span>Calm view</span>
        )}
      </button>
      {open && <Popover s={s} plan={plan} anchor={btn.current} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** The slim line under the bar when Jev's layout is ready (never inside the bar, where it crowded the buttons). */
function AiReadyLine({ api }: { api: EngineApi }): JSX.Element {
  return (
    <div class="wa-strip__note" role="status">
      <div class="wa-strip__notein">
        <I.Spark />
        <span class="wa-strip__notetext">New layout ready</span>
        <button type="button" class="wa-btn wa-btn--link wa-strip__use" onClick={() => api.useAiLayout()}>
          Use it
        </button>
      </div>
    </div>
  );
}

/** Close on Escape or a press outside (shared by the "⋯" menu). */
function useDismiss(ref: { current: HTMLElement | null }, anchor: HTMLElement | null, onClose: () => void): void {
  useEffect(() => {
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
}

function TextSize({ scale, step }: { scale: number; step: (d: number) => void }): JSX.Element {
  return (
    <div class="wa-seg" role="group" aria-label="Text size in this view">
      <button type="button" class="wa-btn" aria-label="Smaller text" disabled={scale <= 0.85} onClick={() => step(-0.15)}>
        A−
      </button>
      <button type="button" class="wa-btn" aria-label="Larger text" disabled={scale >= 1.6} onClick={() => step(0.15)}>
        A+
      </button>
    </div>
  );
}

function MoreMenu({ help, scale, step }: { help: ControlBlock | null; scale: number; step: (d: number) => void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  return (
    <div class="wa-strip__more">
      <button
        type="button"
        ref={btn}
        class="wa-btn wa-btn--quiet wa-strip__dots"
        aria-label="More: text size and help"
        title="More"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && <MenuPanel id={id} menu={menu} anchor={btn.current} help={help} scale={scale} step={step} onClose={() => setOpen(false)} />}
    </div>
  );
}

function MenuPanel(props: {
  id: string;
  menu: { current: HTMLDivElement | null };
  anchor: HTMLElement | null;
  help: ControlBlock | null;
  scale: number;
  step: (d: number) => void;
  onClose: () => void;
}): JSX.Element {
  useDismiss(props.menu, props.anchor, props.onClose);
  return (
    <div class="wa-menu" id={props.id} ref={props.menu} role="group" aria-label="More">
      <div class="wa-menu__row">
        <span>Text size</span>
        <TextSize scale={props.scale} step={props.step} />
      </div>
      {props.help && (
        <div class="wa-menu__row wa-menu__help">
          <StripLink b={props.help} cls="wa-btn wa-btn--link wa-btn--helplink" />
        </div>
      )}
    </div>
  );
}

/** Collapse levels, lowest priority first (see the header). */
const LEVEL_MAX = 4;

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
  const help = plan?.helpLink ?? null;
  const inRef = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState(0);
  const width = useRef(0);
  // What the bar holds: when it changes, measure again from the fullest bar.
  const content = `${name}|${chipText(state)}|${state.calm.aiReady ? 1 : 0}|${help?.text ?? ''}`;
  const seen = useRef(content);
  useLayoutEffect(() => {
    if (seen.current === content) return;
    seen.current = content;
    setLevel(0);
  }, [content]);
  // After every render: if the last item reaches past the bar's edge, take the next step down. (The site name
  // shrinks first by itself: it is the only item that may, down to its CSS min-width.)
  useLayoutEffect(() => {
    const el = inRef.current;
    if (!el || level >= LEVEL_MAX) return;
    const last = el.lastElementChild as HTMLElement | null;
    if (!last) return;
    const box = el.getBoundingClientRect();
    // Rects are in the zoomed space (the host is CSS-zoomed by 1 ÷ page zoom); computed padding is not.
    const k = el.offsetWidth > 0 ? box.width / el.offsetWidth : 1;
    const pad = (parseFloat(getComputedStyle(el).paddingRight) || 0) * k;
    if (last.getBoundingClientRect().right > box.right - pad + 0.5 * k) setLevel(level + 1);
  });
  // A wider or narrower window: start again from the fullest bar.
  useEffect(() => {
    const el = inRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (Math.abs(w - width.current) < 0.5) return;
      width.current = w;
      setLevel(0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const shortChip = level >= 1;
  const sizeInMenu = level >= 2;
  const helpInMenu = level >= 3;
  const noBrand = level >= 4;
  return (
    <header class="wa-strip" data-level={level}>
      <div class="wa-strip__in" ref={inRef}>
        {!noBrand && (
          <div class="wa-brand">
            <span class="wa-dot" aria-hidden="true" />
            <span class="wa-brand__name" title={name}>
              {name}
            </span>
          </div>
        )}
        <ProvenanceChip s={state} plan={plan} short={shortChip} />
        <div class="wa-strip__tools">
          {help && !helpInMenu && (
            <span class="wa-strip__help">
              <StripLink b={help} cls="wa-btn wa-btn--quiet wa-btn--helplink" />
            </span>
          )}
          {!sizeInMenu && <TextSize scale={props.scale} step={step} />}
          {sizeInMenu && <MoreMenu help={helpInMenu ? help : null} scale={props.scale} step={step} />}
          <button type="button" class="wa-btn wa-btn--tonal wa-strip__orig" onClick={() => api.showOriginal(true)}>
            Original page
          </button>
          <button type="button" class="wa-btn wa-btn--quiet wa-close" aria-label="Close Calm view" title="Close Calm view" onClick={() => api.closeCalm()}>
            <I.Close />
          </button>
        </div>
      </div>
      {state.calm.aiReady && <AiReadyLine api={api} />}
    </header>
  );
}
