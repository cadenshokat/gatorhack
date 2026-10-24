// Owner: P. The in-page chrome: pill, panel, Jev Lens, offers, toasts, overlay bar and chips, explain card, and the
// Calm view host.
import { createPortal } from 'preact/compat';
import type { ComponentChildren } from 'preact';
import { useEffect, useErrorBoundary, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { EngineApi, EngineState } from '../contracts';
import { watchSelection } from '../engine/select';
import { CalmView } from './calm/CalmView';
import { ExplainAffordance, type Explainable } from './explain/ExplainAffordance';
import { ExplainCard } from './explain/ExplainCard';
import { Lens } from './lens/Lens';
import { OfferCard } from './offers/OfferCard';
import { ConsentBar, OverlayChips, OverlayOffer, overlayView, type OverlayView } from './offers/Overlays';
import { Toasts } from './offers/Toasts';
import { pageOrigin } from './panel/format';
import { inEditable, shortcutFor } from './panel/keys';
import { chromeSizing, useEngineState, usePillSpot, useReducedMotion, useTabZoom } from './panel/hooks';
import { Panel } from './panel/Panel';
import { Pill } from './panel/Pill';
import { useTodayMeter } from './panel/today';
import { themeModeFor } from './tokens';

export interface AppProps {
  api: EngineApi;
  isOurUi: (t: EventTarget | null) => boolean;
  /** Full-screen element in our shadow root that holds the Calm view. */
  calmHost: HTMLElement;
  /** Render target inside the Calm host's own shadow root (the Calm view's styles live there). */
  calmMount: HTMLElement;
}

/**
 * Keeps one part's failure from taking the rest of the chrome with it: if the Calm view or the Lens throws while
 * rendering, the pill, panel and Undo stay. `resetKey` tries again when the part's input changes.
 */
function Guard({ name, resetKey, fallback, children }: { name: string; resetKey: string; fallback: ComponentChildren; children: ComponentChildren }) {
  const [error, reset] = useErrorBoundary((e: unknown) => console.warn(`[WebAble] ${name} could not be drawn`, e));
  const key = useRef(resetKey);
  useEffect(() => {
    if (key.current !== resetKey) {
      key.current = resetKey;
      if (error) reset();
    }
  }, [resetKey, error, reset]);
  return <>{error ? fallback : children}</>;
}

function CalmFallback({ api, s, broken = false }: { api: EngineApi; s: EngineState; broken?: boolean }) {
  const failed = broken || (!s.calm.loading && !s.calm.spec);
  return (
    <div class="wa-calm-loading" role="dialog" aria-modal="true" aria-label="Calm view">
      <div class="wa-calm-loading-card">
        {!failed && <span class="wa-spinner" aria-hidden="true" />}
        <h2>{failed ? 'Calm view is not ready for this page' : 'Arranging a calmer view'}</h2>
        <p>
          {failed
            ? 'The page stays as it is. Your other changes are still on.'
            : 'Same page, fewer distractions. Every button will still drive the page.'}
        </p>
        <button class="wa-btn" onClick={() => api.closeCalm()}>
          {failed ? 'Close' : 'Original page'}
        </button>
      </div>
    </div>
  );
}

export function App({ api, isOurUi, calmHost, calmMount }: AppProps) {
  const s = useEngineState(api);
  const origin = pageOrigin();
  const zoom = useTabZoom();
  const reduce = useReducedMotion(s.fit);
  const sz = chromeSizing(s.fit, zoom);
  const mode = themeModeFor(s.fit);
  const today = useTodayMeter(s);

  const rootRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [explainable, setExplainable] = useState<Explainable | null>(null);
  const [announce, setAnnounce] = useState('');
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [stackTop, setStackTop] = useState<number | null>(null);
  const [panelChrome, setPanelChrome] = useState(0);
  const announced = useRef(new Set<string>());

  const calmOpen = s.calm.open;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 16 * sz.u;

  // Overlays the engine moved out of the way: a docked cookie notice becomes a bar, tucked ones leave a chip.
  const views: OverlayView[] = (s.overlays ?? []).map(overlayView).filter((v) => !gone.has(v.id) && !v.revealed);
  const onPage = !calmOpen && !s.showingOriginal;
  const docked = onPage ? (views.find((v) => v.kind === 'consent' && v.action === 'docked') ?? null) : null;
  const tucked = onPage ? views.filter((v) => v.action === 'tucked') : [];
  const overlayOffer = onPage ? (views.find((v) => v.action === 'offered') ?? null) : null;
  const barH = Math.max(72 * sz.u, sz.targetPx + 20 * sz.u);
  const barReserve = docked ? margin + barH + 10 * sz.u : 0;

  const pillW = Math.round(150 * sz.u);
  const spot = usePillSpot({
    isOurUi,
    widthPx: pillW,
    heightPx: Math.round(sz.targetPx),
    marginPx: Math.round(margin),
    minBottomPx: Math.round(barReserve),
    frozen: panelOpen,
    recheckKey: `${s.showingOriginal}|${calmOpen}|${views.map((v) => `${v.id}:${v.action}`).join(',')}`,
  });
  const side = spot.side;
  const pillBottom = spot.bottom;
  // Chips sit on the side their overlay was tucked to: with the pill's stack, or in their own group opposite it.
  const far: 'left' | 'right' = side === 'right' ? 'left' : 'right';
  const farChips = tucked.filter((v) => v.edge === far);
  const nearChips = tucked.filter((v) => v.edge !== far);
  const stackBottom = pillBottom + sz.targetPx + 12 * sz.u;
  const panelW = Math.min(392 * sz.u, vw - 32 * sz.u);
  const roomBeside = vw >= panelW + 360 * sz.u + 64 * sz.u;
  const stackInset = panelOpen && roomBeside ? margin + panelW + 12 * sz.u : margin;
  const showStack = !calmOpen && (!panelOpen || roomBeside);

  // The panel body keeps at least 360 screen px when the tab is zoomed. When that does not fit above the pill,
  // the panel drops down over the pill (it has its own Close).
  const panelMin = 360 / (zoom > 0 ? zoom : 1) + (panelChrome > 0 ? panelChrome : 190 * sz.u);
  const panelOverPill = vh - stackBottom - margin < panelMin;
  const panelBottom = panelOverPill ? (docked ? margin + barH + 6 * sz.u : margin) : stackBottom;
  const showPill = !calmOpen && !(panelOpen && panelOverPill);

  // Keyboard: never inside text fields, never synthetic events, and the page still receives every key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.isTrusted || e.repeat) return;
      if (e.key === 'Escape') {
        setExplainable(null);
        return;
      }
      const act = shortcutFor(e);
      if (!act || inEditable(e)) return;
      const st = api.getState();
      if (act === 'lens') api.toggleLens(!st.lens.on);
      else if (act === 'calm') {
        if (st.calm.open) api.closeCalm();
        else void api.openCalm().catch(() => {});
      } else if (act === 'original') api.showOriginal(!st.showingOriginal);
      else if (!st.calm.open) {
        setPanelOpen((open) => {
          if (open) {
            requestAnimationFrame(() => {
              const root = rootRef.current?.getRootNode();
              if (root instanceof ShadowRoot && root.activeElement) {
                rootRef.current?.querySelector<HTMLButtonElement>('.wa-pill')?.focus({ preventScroll: true });
              }
            });
          }
          return !open;
        });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [api]);

  // "Explain" beside a long selection (the engine decides what counts as explainable). If AI is out of credits the
  // card says so plainly and shows the original.
  const explainOn = s.settings.explain && s.settings.enabled;
  useEffect(() => {
    if (!explainOn) return;
    let stop: () => void = () => {};
    try {
      stop = watchSelection({
        onExplainable: (text, rect) => {
          if (!text || !rect) return;
          setExplainable({ text, rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height } });
        },
        isOurUi,
      });
    } catch {
      /* selection watcher unavailable: no affordance */
    }
    const clear = () => setExplainable(null);
    const onSel = () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed) clear();
    };
    document.addEventListener('selectionchange', onSel);
    window.addEventListener('scroll', clear, { passive: true });
    return () => {
      try {
        stop();
      } catch {
        /* ignore */
      }
      document.removeEventListener('selectionchange', onSel);
      window.removeEventListener('scroll', clear);
    };
  }, [explainOn, isOurUi]);

  // Calm view host: the Calm view renders into its own shadow root; we only show, focus and close it.
  const calmReady = Boolean(s.calm.open && s.calm.spec && s.outline && s.fit);
  const wasCalm = useRef(false);
  useLayoutEffect(() => {
    calmHost.classList.toggle('is-open', calmReady);
    calmHost.setAttribute('data-mode', mode);
    const has = calmReady && calmMount.childElementCount > 0;
    calmHost.classList.toggle('has-content', has);
    if (calmReady && !wasCalm.current) {
      const root = calmMount.getRootNode() as ShadowRoot | Document;
      const focused = 'activeElement' in root ? root.activeElement : null;
      if (!focused) calmHost.focus({ preventScroll: true });
    }
    wasCalm.current = calmReady;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && api.getState().calm.open) {
        e.stopPropagation();
        api.closeCalm();
      }
    };
    calmHost.addEventListener('keydown', onKey);
    return () => calmHost.removeEventListener('keydown', onKey);
  }, [api, calmHost]);

  // The Calm view takes the whole screen, and the Lens needs the whole page: get the panel out of their way.
  useEffect(() => {
    if (s.calm.open) setPanelOpen(false);
  }, [s.calm.open]);
  useEffect(() => {
    if (s.lens.on) setPanelOpen(false);
  }, [s.lens.on]);

  // Overlays brought back stay hidden here until the engine forgets them.
  useEffect(() => {
    if (gone.size === 0) return;
    const ids = new Set((s.overlays ?? []).filter((o) => o.action === 'docked' || o.action === 'tucked' || o.action === 'offered').map((o) => o.id));
    const keep = [...gone].filter((id) => ids.has(id));
    if (keep.length !== gone.size) setGone(new Set(keep));
  }, [s.overlays, gone]);
  const markGone = (id: string) => setGone((g) => new Set([...g, id]));

  // Announce each new offer, docked notice and toast once, politely.
  const offer = s.struggle.offers[0] ?? null;
  const lastToast = s.toasts[s.toasts.length - 1] ?? null;
  const dockedId = docked?.id ?? null;
  useEffect(() => {
    if (offer) {
      const k = `o:${offer.kind}:${offer.question}`;
      if (!announced.current.has(k)) {
        announced.current.add(k);
        setAnnounce(`Suggestion from WebAble: ${offer.question} ${offer.fact}`);
        return;
      }
    }
    if (dockedId) {
      const k = `c:${dockedId}`;
      if (!announced.current.has(k)) {
        announced.current.add(k);
        setAnnounce("This site asks about cookies. Its choices are in a bar at the bottom of the screen.");
        return;
      }
    }
    if (lastToast) {
      const k = `t:${lastToast.id}`;
      if (!announced.current.has(k)) {
        announced.current.add(k);
        setAnnounce(`${lastToast.text}${lastToast.undoOpId ? '. Undo is available.' : ''}`);
      }
    }
  }, [offer, lastToast, dockedId]);

  // "Why this?" grows the offer downward from where its top edge was, and the stack never runs off the screen.
  const offerKey = offer ? `${offer.kind}|${offer.question}` : '';
  const whyOpen = useRef(false);
  useEffect(() => {
    whyOpen.current = false;
    setStackTop(null);
  }, [offerKey, panelOpen, calmOpen]);
  const onWhy = (open: boolean) => {
    whyOpen.current = open;
    if (!open) {
      setStackTop(null);
      return;
    }
    const r = stackRef.current?.getBoundingClientRect();
    if (r) setStackTop(Math.max(margin, r.top));
  };
  const stackFloor = Math.max(margin, barReserve);
  useLayoutEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    if (stackTop === null) {
      el.removeAttribute('data-scroll');
      // Too tall to sit above the pill (a zoomed tab): keep it on screen by letting it slide down over the pill.
      if (el.scrollHeight > vh - stackBottom - margin + 1) setStackTop(Math.max(margin, vh - stackFloor - el.scrollHeight));
      return;
    }
    if (!whyOpen.current && el.scrollHeight <= vh - stackBottom - margin) {
      setStackTop(null);
      return;
    }
    const room = vh - stackFloor - stackTop;
    if (el.scrollHeight > room + 1) {
      const top = Math.max(margin, vh - stackFloor - el.scrollHeight);
      if (Math.abs(top - stackTop) > 1) setStackTop(top);
    }
    // Scroll inside the stack only when it truly does not fit (a scroller would clip the cards' shadows).
    const scroll = el.scrollHeight > el.clientHeight + 1;
    if (scroll) el.setAttribute('data-scroll', 'true');
    else el.removeAttribute('data-scroll');
  });

  const closePanel = () => {
    setPanelOpen(false);
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>('.wa-pill')?.focus({ preventScroll: true }));
  };

  const vars = { '--u': `${sz.u}px`, '--wa-target': `${Math.round(sz.targetPx)}px` };
  const inset = `${Math.round(stackInset)}px`;
  const stackStyle =
    stackTop === null
      ? { bottom: `${Math.round(stackBottom)}px`, right: side === 'right' ? inset : 'auto', left: side === 'left' ? inset : 'auto' }
      : {
          top: `${Math.round(stackTop)}px`,
          right: side === 'right' ? inset : 'auto',
          left: side === 'left' ? inset : 'auto',
          maxHeight: `${Math.round(vh - stackFloor - stackTop)}px`,
        };

  return (
    <div
      class="wa-root"
      ref={rootRef}
      data-mode={mode}
      data-motion={reduce ? 'reduce' : 'full'}
      data-calm={calmOpen ? 'open' : 'closed'}
      data-calm-open={calmOpen ? '' : undefined}
      style={vars}
    >
      {s.lens.on && !calmOpen && (
        <Guard name="Jev Lens" resetKey={`${s.lens.on}|${s.understanding ? 1 : 0}`} fallback={null}>
          <Lens api={api} s={s} reduce={reduce} bottomReserve={Math.round(stackBottom)} />
        </Guard>
      )}

      {s.explain.open && (
        <ExplainCard
          api={api}
          s={s}
          u={sz.u}
          pillReserve={Math.round(stackBottom)}
          pillWidth={Math.round(170 * sz.u)}
          pillSide={side}
          bottomReserve={Math.round(barReserve)}
        />
      )}
      {explainable && !s.explain.open && !calmOpen && (
        <ExplainAffordance api={api} item={explainable} onDone={() => setExplainable(null)} />
      )}

      {s.calm.open && !calmReady && <CalmFallback api={api} s={s} />}
      {calmReady && s.calm.spec && s.outline && s.fit && (
        <Guard name="Calm view" resetKey={`${s.calm.source}|${s.calm.spec ? 1 : 0}|${s.calm.open}`} fallback={<CalmFallback api={api} s={s} broken />}>
          {createPortal(<CalmView api={api} spec={s.calm.spec} outline={s.outline} fit={s.fit} />, calmMount)}
        </Guard>
      )}

      {docked && <ConsentBar api={api} view={docked} left={margin} right={margin} bottom={margin} onGone={markGone} />}

      {showStack && farChips.length > 0 && (
        <div
          class="wa-stack wa-stack-far"
          data-side={far}
          style={{ bottom: `${Math.round(Math.max(margin, barReserve))}px`, [far]: `${Math.round(margin)}px` }}
        >
          <OverlayChips api={api} views={farChips} onGone={markGone} />
        </div>
      )}

      {showStack && (offer || overlayOffer || s.toasts.length > 0 || nearChips.length > 0) && (
        <div
          class="wa-stack"
          ref={stackRef}
          data-side={side}
          data-pinned={stackTop !== null ? 'true' : 'false'}
          style={stackStyle}
        >
          <Toasts api={api} toasts={s.toasts} />
          {offer && <OfferCard api={api} offer={offer} onWhy={onWhy} />}
          {!offer && overlayOffer && <OverlayOffer api={api} view={overlayOffer} onGone={markGone} />}
          <OverlayChips api={api} views={nearChips} onGone={markGone} />
        </div>
      )}

      {panelOpen && !calmOpen && (
        <Panel
          api={api}
          s={s}
          origin={origin}
          side={side}
          bottomPx={panelBottom}
          minHeightPx={panelMin}
          reduce={reduce}
          today={today}
          onClose={closePanel}
          onChromeHeight={setPanelChrome}
        />
      )}
      {showPill && (
        <Pill s={s} open={panelOpen} side={side} bottomPx={pillBottom} onToggle={() => (panelOpen ? closePanel() : setPanelOpen(true))} />
      )}

      <div class="wa-sr" aria-live="polite" role="status">
        {announce}
      </div>
    </div>
  );
}
