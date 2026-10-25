// Owner: P, U, F. The in-page chrome: pill, panel, Jev Lens, offers, toasts, overlay bar and chips, explain card, and the
// Calm view host.
//
// Steady size: every layer keeps its physical size whatever the page zoom; only the fit's UI scale sizes it.
// - The chrome layer (pill, panel, offers, toasts, chips, cookie bar, Calm loading screen) is one root with CSS
//   `zoom: scale ÷ page zoom`: inside it one CSS px is one design pixel and the viewport measures as at 100%.
// - The Calm view host gets `zoom: 1 ÷ page zoom`, so the view renders at the fit's sizes exactly.
// - The Lens and the Explain card follow page coordinates, so they stay unzoomed and size with --u (scale ÷ zoom).
// One corner dock holds the pill and everything that stacks above it, so they can never overlap.
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
import { dockHeights, planDock } from './panel/dock';
import { chromeSizing, useEngineState, usePillSpot, useReducedMotion } from './panel/hooks';
import { columnLabel, Panel, textSizeLabel, textZoomOf } from './panel/Panel';
import { Pill } from './panel/Pill';
import { useTodayMeter } from './panel/today';
import { themeModeFor } from './tokens';
import { usePageZoom, useViewport } from './zoom';

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
  const pageZoom = usePageZoom(api);
  const vp = useViewport();
  const reduce = useReducedMotion(s.fit);
  const sz = chromeSizing(s.fit, pageZoom);
  const mode = themeModeFor(s.fit);
  const today = useTodayMeter(s);

  const rootRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
  const mainColRef = useRef<HTMLDivElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [explainable, setExplainable] = useState<Explainable | null>(null);
  const [announce, setAnnounce] = useState('');
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [pillW, setPillW] = useState(150);
  const [barH, setBarH] = useState(0);
  const [dockBox, setDockBox] = useState<{ top: number; w: number } | null>(null);
  const announced = useRef(new Set<string>());
  /** The person just changed the text size or page width: say the new value once it lands (within 4 s). */
  const adjusting = useRef<{ what: 'text' | 'column'; at: number } | null>(null);
  const noteAdjust = (what: 'text' | 'column') => {
    adjusting.current = { what, at: performance.now() };
  };

  const calmOpen = s.calm.open;
  // The chrome layer's units: design pixels. Z converts them to the page's CSS px (and back).
  const Z = sz.zoom;
  const vw = vp.w / Z;
  const vh = vp.h / Z;
  const M = 16;
  const GAP = 8;

  // Overlays the engine moved out of the way: a docked cookie notice becomes a bar, tucked ones leave a chip.
  const views: OverlayView[] = (s.overlays ?? []).map(overlayView).filter((v) => !gone.has(v.id) && !v.revealed);
  const onPage = !calmOpen && !s.showingOriginal;
  const docked = onPage ? (views.find((v) => v.kind === 'consent' && v.action === 'docked') ?? null) : null;
  const tucked = onPage ? views.filter((v) => v.action === 'tucked') : [];
  const overlayOffer = onPage ? (views.find((v) => v.action === 'offered') ?? null) : null;
  const offer = s.struggle.offers[0] ?? null;
  const hasItems = !calmOpen && Boolean(offer || overlayOffer || s.toasts.length > 0 || tucked.length > 0);

  const barMinH = Math.max(72, sz.target + 20);
  const plan = planDock({
    vw,
    vh,
    margin: M,
    gap: GAP + 2,
    pillW,
    pillH: sz.target,
    hasItems,
    itemsW: Math.min(360, vw - 2 * M),
    panelOpen,
    panelW: Math.min(392, vw - 2 * M),
    barH: docked ? Math.max(barH, barMinH) : null,
    barMaxW: 1080,
  });

  // The dock's corner: bottom right unless a site control sits there (the spot hook works in the page's CSS px).
  const spot = usePillSpot({
    isOurUi,
    widthPx: Math.round(pillW * Z),
    heightPx: Math.round(sz.target * Z),
    marginPx: Math.round(M * Z),
    minBottomPx: Math.round(plan.minBottom * Z),
    frozen: panelOpen,
    recheckKey: `${s.showingOriginal}|${calmOpen}|${views.map((v) => `${v.id}:${v.action}`).join(',')}|${Math.round(Z * 100)}`,
  });
  const side = spot.side;
  const bottom = Math.max(plan.minBottom, spot.bottom / Z);
  const heights = dockHeights(vh, bottom, M, sz.target, GAP, panelOpen);
  const showPill = !calmOpen && heights.pillWithPanel;
  const showItems = hasItems && (!panelOpen || plan.itemsBeside);
  const itemsMax = panelOpen ? vh - bottom - M : heights.aboveMax;

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
      else if (act === 'narrower' || act === 'wider') {
        if (st.calm.open || st.showingOriginal) return;
        noteAdjust('column');
        api.adjustColumn(act === 'narrower' ? -1 : 1);
      } else if (!st.calm.open) {
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

  // Calm view host: the Calm view renders into its own shadow root; we only show, focus, size and close it.
  // It is zoomed by 1 ÷ page zoom, so it renders at the fit's own sizes (its tokens are computed at zoom 1), and it
  // gets the viewport in its own units for the few lengths that would otherwise use vw / vh.
  const calmReady = Boolean(s.calm.open && s.calm.spec && s.outline && s.fit);
  const wasCalm = useRef(false);
  useLayoutEffect(() => {
    calmHost.classList.toggle('is-open', calmReady);
    calmHost.setAttribute('data-mode', mode);
    const has = calmReady && calmMount.childElementCount > 0;
    calmHost.classList.toggle('has-content', has);
    const cz = String(Math.round((1 / pageZoom) * 10000) / 10000);
    if (calmHost.style.getPropertyValue('zoom') !== cz) calmHost.style.setProperty('zoom', cz);
    calmHost.style.setProperty('--wa-vw', `${Math.round(vp.w * pageZoom)}px`);
    calmHost.style.setProperty('--wa-vh', `${Math.round(vp.h * pageZoom)}px`);
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

  // Announce each new offer, docked notice and toast once, politely; and the new size after the person changes it.
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
  const colLabel = columnLabel(s.column);
  const sizeLabel = textSizeLabel(textZoomOf(s, pageZoom));
  useEffect(() => {
    const a = adjusting.current;
    if (!a) return;
    adjusting.current = null;
    if (performance.now() - a.at > 4000) return;
    setAnnounce(a.what === 'column' ? `Page width: ${colLabel.toLowerCase()}.` : `Text size: ${sizeLabel}.`);
  }, [colLabel, sizeLabel]);

  // Measure what the layout needs: the pill's width (for the spot probe), and the dock's box in the page's CSS px
  // (for the Lens and the Explain card, which keep clear of it). The items column scrolls only when it truly does
  // not fit (a scroller would clip the cards' shadows).
  useLayoutEffect(() => {
    const p = mainColRef.current?.querySelector<HTMLElement>('.wa-pill');
    if (p && p.offsetWidth > 0 && Math.abs(p.offsetWidth - pillW) > 1) setPillW(p.offsetWidth);
    const d = dockRef.current?.getBoundingClientRect();
    const next = d && d.width > 0 ? { top: Math.round(d.top), w: Math.round(d.width) } : null;
    if ((next?.top ?? -1) !== (dockBox?.top ?? -1) || (next?.w ?? -1) !== (dockBox?.w ?? -1)) setDockBox(next);
    // Natural heights (offsetHeight ignores the entry animation's transform, which scrollHeight would count).
    const el = itemsRef.current;
    if (el) {
      const kids = Array.from(el.children) as HTMLElement[];
      const need = kids.reduce((a, c) => a + c.offsetHeight, 0) + GAP * Math.max(0, kids.length - 1);
      const scroll = need > itemsMax + 1;
      if (scroll !== el.hasAttribute('data-scroll')) {
        if (scroll) {
          el.setAttribute('data-scroll', 'true');
          // Start at the bottom: the offer's buttons and the chips sit next to the pill; toasts above can wait.
          el.scrollTop = el.scrollHeight;
        } else el.removeAttribute('data-scroll');
      }
    }
  });

  const closePanel = () => {
    setPanelOpen(false);
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>('.wa-pill')?.focus({ preventScroll: true }));
  };

  // The page layer (Lens, Explain) keeps clear of the dock and the bar, in the page's CSS px.
  const dockReserve = dockBox ? Math.max(0, Math.round(vp.h - dockBox.top)) : Math.round((bottom + sz.target) * Z);
  const dockWidth = dockBox ? dockBox.w : Math.round((pillW + M) * Z);
  const barReserve = docked ? Math.round((M + Math.max(barH, barMinH) + GAP) * Z) : 0;

  const r2 = (n: number) => `${Math.round(n * 100) / 100}px`;
  const uiVars = {
    zoom: String(Math.round(Z * 10000) / 10000),
    '--u': '1px',
    '--wa-target': r2(sz.target),
    '--wa-vw': r2(vw),
    '--wa-vh': r2(vh),
  };
  const pageVars = { '--u': `${sz.u}px`, '--wa-target': `${Math.round(sz.targetPx)}px` };
  const edge = `${M}px`;
  const items = showItems ? (
    <div class="wa-dock-items" ref={itemsRef} data-wa-chrome="" style={{ maxHeight: r2(Math.max(0, itemsMax)) }}>
      <Toasts api={api} toasts={s.toasts} />
      {offer && <OfferCard api={api} offer={offer} passive={s.passive ?? null} />}
      {!offer && overlayOffer && <OverlayOffer api={api} view={overlayOffer} onGone={markGone} />}
      <OverlayChips api={api} views={tucked} onGone={markGone} />
    </div>
  ) : null;

  return (
    <>
      <div
        class="wa-root"
        data-layer="page"
        data-mode={mode}
        data-motion={reduce ? 'reduce' : 'full'}
        data-calm={calmOpen ? 'open' : 'closed'}
        data-calm-open={calmOpen ? '' : undefined}
        style={pageVars}
      >
        {s.lens.on && !calmOpen && (
          <Guard name="Jev Lens" resetKey={`${s.lens.on}|${s.understanding ? 1 : 0}`} fallback={null}>
            <Lens api={api} s={s} reduce={reduce} bottomReserve={dockReserve} />
          </Guard>
        )}

        {s.explain.open && (
          <ExplainCard
            api={api}
            s={s}
            u={sz.u}
            pillReserve={dockReserve + Math.round(GAP * Z)}
            pillWidth={dockWidth}
            pillSide={side}
            bottomReserve={barReserve}
          />
        )}
        {explainable && !s.explain.open && !calmOpen && (
          <ExplainAffordance api={api} item={explainable} onDone={() => setExplainable(null)} />
        )}

        {calmReady && s.calm.spec && s.outline && s.fit && (
          <Guard name="Calm view" resetKey={`${s.calm.source}|${s.calm.spec ? 1 : 0}|${s.calm.open}`} fallback={<CalmFallback api={api} s={s} broken />}>
            {createPortal(<CalmView api={api} spec={s.calm.spec} outline={s.outline} fit={s.fit} />, calmMount)}
          </Guard>
        )}
      </div>

      <div
        class="wa-root"
        data-layer="ui"
        ref={rootRef}
        data-mode={mode}
        data-motion={reduce ? 'reduce' : 'full'}
        data-calm={calmOpen ? 'open' : 'closed'}
        data-calm-open={calmOpen ? '' : undefined}
        style={uiVars}
      >
        {s.calm.open && !calmReady && <CalmFallback api={api} s={s} />}

        {docked && (
          <ConsentBar
            api={api}
            view={docked}
            left={M}
            right={M}
            bottom={M}
            onGone={markGone}
            layoutKey={String(Math.round(vw))}
            onHeight={setBarH}
          />
        )}

        {!calmOpen && (showPill || panelOpen || items) && (
          <div
            class="wa-dock"
            ref={dockRef}
            data-side={side}
            style={{ bottom: r2(bottom), right: side === 'right' ? edge : 'auto', left: side === 'left' ? edge : 'auto', maxHeight: r2(vh - bottom - M) }}
          >
            <div class="wa-dock-col" ref={mainColRef} style={{ maxHeight: r2(vh - bottom - M) }}>
              {!panelOpen && items}
              {panelOpen && (
                <Panel
                  api={api}
                  s={s}
                  origin={origin}
                  side={side}
                  maxHeightPx={heights.aboveMax}
                  pageZoom={pageZoom}
                  reduce={reduce}
                  today={today}
                  onClose={closePanel}
                  onAdjust={noteAdjust}
                />
              )}
              {showPill && <Pill s={s} open={panelOpen} side={side} onToggle={() => (panelOpen ? closePanel() : setPanelOpen(true))} />}
            </div>
            {/* The pill's column comes first so it stays at the screen edge (the dock is a row, reversed on the right). */}
            {panelOpen && plan.itemsBeside && <div class="wa-dock-col">{items}</div>}
          </div>
        )}

        <div class="wa-sr" aria-live="polite" role="status">
          {announce}
        </div>
      </div>
    </>
  );
}
