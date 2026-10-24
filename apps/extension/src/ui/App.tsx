// Owner: D2. The in-page chrome: pill, panel, Jev Lens, offers, toasts, explain card, and the Calm view host.
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { EngineApi, EngineState } from '../contracts';
import { watchSelection } from '../engine/select';
import { CalmView } from './calm/CalmView';
import { ExplainAffordance, type Explainable } from './explain/ExplainAffordance';
import { ExplainCard } from './explain/ExplainCard';
import { Lens } from './lens/Lens';
import { useTodayMeter } from './lens/today';
import { OfferCard } from './offers/OfferCard';
import { Toasts } from './offers/Toasts';
import { pageOrigin } from './panel/format';
import { chromeSizing, useEngineState, useFreeSpot, useReducedMotion, useTabZoom } from './panel/hooks';
import { IconSpark } from './panel/icons';
import { Panel } from './panel/Panel';
import { Pill } from './panel/Pill';
import { themeModeFor } from './tokens';

export interface AppProps {
  api: EngineApi;
  isOurUi: (t: EventTarget | null) => boolean;
  /** Full-screen element in our shadow root that holds the Calm view. */
  calmHost: HTMLElement;
  /** Render target inside the Calm host's own shadow root (D1's styles live there). */
  calmMount: HTMLElement;
}

function inEditable(e: Event): boolean {
  const t = (e.composedPath?.()[0] ?? e.target) as Element | null;
  if (!t || !(t instanceof Element)) return false;
  if (t instanceof HTMLInputElement) {
    const type = (t.type || 'text').toLowerCase();
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(type);
  }
  if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true;
  return t instanceof HTMLElement && t.isContentEditable;
}

function CalmFallback({ api, s }: { api: EngineApi; s: EngineState }) {
  const failed = !s.calm.loading && !s.calm.spec;
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [explainable, setExplainable] = useState<Explainable | null>(null);
  const [aiChipHidden, setAiChipHidden] = useState(false);
  const [announce, setAnnounce] = useState('');
  const announced = useRef(new Set<string>());

  const pillBottom = useFreeSpot({
    isOurUi,
    widthPx: Math.round(150 * sz.u),
    heightPx: Math.round(sz.targetPx),
    marginPx: Math.round(16 * sz.u),
    frozen: panelOpen,
  });
  const stackBottom = pillBottom + sz.targetPx + 12 * sz.u;
  const vw = window.innerWidth;
  const panelW = Math.min(392 * sz.u, vw - 32 * sz.u);
  const roomBeside = vw >= panelW + 360 * sz.u + 64 * sz.u;
  const stackRight = panelOpen && roomBeside ? 16 * sz.u + panelW + 12 * sz.u : 16 * sz.u;
  const showStack = !panelOpen || roomBeside;

  // Keyboard: Alt+J Lens, Alt+Shift+C Calm view, Alt+Shift+F original page. Never inside text fields,
  // never synthetic events, and the page still receives every key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;
      if (e.key === 'Escape') {
        setExplainable(null);
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey || inEditable(e)) return;
      const st = api.getState();
      if (e.code === 'KeyJ' && !e.shiftKey) api.toggleLens(!st.lens.on);
      else if (e.code === 'KeyC' && e.shiftKey) {
        if (st.calm.open) api.closeCalm();
        else void api.openCalm().catch(() => {});
      } else if (e.code === 'KeyF' && e.shiftKey) api.showOriginal(!st.showingOriginal);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [api]);

  // "Explain" beside a long selection (C2 decides what counts as explainable).
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

  // Calm view host: D1's CalmView renders into its own shadow root; we only show, focus and close it.
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
  useEffect(() => {
    if (!s.calm.aiReady) setAiChipHidden(false);
  }, [s.calm.aiReady]);
  // The Calm view takes the whole screen: get the panel out of its way.
  useEffect(() => {
    if (s.calm.open) setPanelOpen(false);
  }, [s.calm.open]);

  // Announce each new offer and toast once, politely.
  const offer = s.struggle.offers[0] ?? null;
  const lastToast = s.toasts[s.toasts.length - 1] ?? null;
  useEffect(() => {
    if (offer) {
      const k = `o:${offer.kind}:${offer.question}`;
      if (!announced.current.has(k)) {
        announced.current.add(k);
        setAnnounce(`Suggestion from WebAble: ${offer.question} ${offer.fact}`);
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
  }, [offer, lastToast]);

  const closePanel = () => {
    setPanelOpen(false);
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>('.wa-pill')?.focus({ preventScroll: true }));
  };

  const vars = { '--u': `${sz.u}px`, '--wa-target': `${Math.round(sz.targetPx)}px` };

  return (
    <div class="wa-root" ref={rootRef} data-mode={mode} data-motion={reduce ? 'reduce' : 'full'} style={vars}>
      {s.lens.on && !s.calm.open && (
        <Lens api={api} s={s} reduce={reduce} today={today} bottomReserve={Math.round(stackBottom)} />
      )}

      {s.explain.open && (
        <ExplainCard api={api} s={s} u={sz.u} pillReserve={Math.round(stackBottom)} pillWidth={Math.round(170 * sz.u)} />
      )}
      {explainable && !s.explain.open && !s.calm.open && (
        <ExplainAffordance api={api} item={explainable} onDone={() => setExplainable(null)} />
      )}

      {s.calm.open && !calmReady && <CalmFallback api={api} s={s} />}
      {calmReady && s.calm.spec && s.outline && s.fit &&
        createPortal(<CalmView api={api} spec={s.calm.spec} outline={s.outline} fit={s.fit} />, calmMount)}
      {calmReady && s.calm.aiReady && !aiChipHidden && (
        <div class="wa-floatchip" role="status">
          <IconSpark size={16} />
          <span>A new layout is ready, checked by Jev.</span>
          <button class="wa-btn wa-btn-sm wa-btn-primary" onClick={() => api.useAiLayout()}>
            Use it
          </button>
          <button class="wa-btn wa-btn-sm" onClick={() => setAiChipHidden(true)}>
            Keep this one
          </button>
        </div>
      )}
      {calmReady && s.calm.loading && !s.calm.aiReady && (
        <div class="wa-floatchip wa-floatchip-quiet" role="status">
          <span class="wa-dot" data-state="working" aria-hidden="true" />
          Checking an AI layout with Jev…
        </div>
      )}

      {showStack && (offer || s.toasts.length > 0) && (
        <div class="wa-stack" style={{ bottom: `${Math.round(stackBottom)}px`, right: `${Math.round(stackRight)}px` }}>
          <Toasts api={api} toasts={s.toasts} />
          {offer && <OfferCard api={api} offer={offer} />}
        </div>
      )}

      {panelOpen && (
        <Panel
          api={api}
          s={s}
          origin={origin}
          bottomPx={Math.round(stackBottom)}
          reduce={reduce}
          onClose={closePanel}
        />
      )}
      <Pill s={s} open={panelOpen} bottomPx={pillBottom} onToggle={() => (panelOpen ? closePanel() : setPanelOpen(true))} />

      <div class="wa-sr" aria-live="polite" role="status">
        {announce}
      </div>
    </div>
  );
}
