// Owner: D1. The Calm view: the same page re-presented as one calm column, sized to the person's fit.
//
// Input is a FitSpec (enums and ids only, from the heuristic or the AI layout model). Every word shown is read from the
// live page at render time on this device, and every control drives its original element (src/ui/proxy.ts), so the
// page keeps working and nothing is sent anywhere. The original page is one click away ("Original page").
import type { FitProfile, FitSpec, PageOutline } from '@webable/core';
import { Fragment, type JSX } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { EngineApi, EngineState } from '../../contracts';
import { calmCss } from '../base.css';
import { focusOriginal, proxyClick, proxyKey } from '../proxy';
import { calmMetrics, structureParams, themeModeFor, tokensFor, tokensToStyle } from '../tokens';
import { Blocks, PrimaryAction } from './Blocks';
import { Calm, type CalmCtx } from './context';
import * as I from './icons';
import { tickNow, useCalmStyles, useDomVersion, useEngineState, useReducedMotion, useZoom } from './live';
import { type Block, controlFor, isShown, newCtx, pagePopups, readBlocks, textOf } from './model';
import { type CalmPlan, buildPlan } from './plan';
import { HelpCard } from './sections/layouts';
import { Drawer, SectionView } from './sections/Section';
import { Strip, SubStrip } from './Strip';

/** The person's Text − / Text + step, kept while the content script lives. */
let sessionScale = 1;

const specIds = new WeakMap<object, number>();
let specN = 0;
function specKey(s: object): number {
  let k = specIds.get(s);
  if (!k) {
    k = ++specN;
    specIds.set(s, k);
  }
  return k;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function fmt(p: number | undefined): string {
  return typeof p === 'number' && Number.isFinite(p) ? p.toFixed(2) : '–';
}

function Intro({ plan, state }: { plan: CalmPlan; state: EngineState }): JSX.Element {
  const rd = state.calm.redesign;
  const chosen = rd?.candidates.find((c) => c.name === rd.chosen);
  let how = '';
  if (state.calm.source === 'cached') how = 'Layout from your last visit.';
  if (state.calm.source === 'ai' && rd && chosen) {
    how = `Layout chosen by Jev from ${rd.candidates.length} designs: easier ${fmt(chosen.pEasier)}, hides something needed ${fmt(chosen.pHides)}.`;
  }
  const n = plan.drawer.length;
  const moved = n ? `${n} ${n === 1 ? 'part' : 'parts'} moved to “More on this page”.` : '';
  const cookies = plan.hoisted.some((p) => p.notice === 'consent') ? 'The cookie question is below the main task.' : '';
  const more = [moved, cookies, how].filter(Boolean).join(' ');
  return (
    <div class="wa-note">
      <span class="wa-dot" aria-hidden="true" />
      <div class="wa-note__body">
        <span>
          <b>Calm view.</b> Same page, one thing at a time. Buttons here press the real ones.
        </span>
        {more && <span>{more}</span>}
      </div>
    </div>
  );
}

/**
 * The page's main action, docked at the bottom of the view while its place in the column (the end of the last
 * step) is off screen, so it is always one press away. It is the same two-press button that drives the page's own,
 * and it hides while the in-column one is visible, so the action never shows twice at once.
 */
function PrimaryDock({ plan, rootRef, api, decisions }: {
  plan: CalmPlan | null; rootRef: { current: HTMLDivElement | null }; api: EngineApi; decisions: EngineState['decisions'];
}): JSX.Element | null {
  // Docked only when Jev named this the page's main action (promote: main pick >= 0.90), never on a guess.
  const confirmed = useMemo(() => {
    const pa = plan?.primary;
    if (!pa) return false;
    return decisions.some((d) => {
      if (d.verdict !== 'promote') return false;
      const el = api.elementFor(d.id);
      return !!el && (el === pa || el.contains(pa) || pa.contains(el));
    });
  }, [plan?.primary, decisions, api]);
  const block = useMemo(() => (plan?.primary && confirmed ? controlFor(plan.primary, newCtx()) : null), [plan?.primary, confirmed]);
  const [inColumn, setInColumn] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !block) return;
    let raf = 0;
    const check = (): void => {
      raf = 0;
      const el = root.querySelector('.wa-page [data-primary]');
      if (!el) return setInColumn(false);
      const r = el.getBoundingClientRect();
      const box = root.getBoundingClientRect();
      setInColumn(r.height > 0 && r.bottom > box.top + 60 && r.top < box.bottom - 40);
    };
    const later = (): void => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    root.addEventListener('scroll', later, { passive: true });
    root.addEventListener('click', later, true);
    const t = window.setInterval(check, 800);
    return () => {
      root.removeEventListener('scroll', later);
      root.removeEventListener('click', later, true);
      window.clearInterval(t);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rootRef, block]);
  if (!block || inColumn) return null;
  return (
    <div class="wa-dock" role="region" aria-label="Main action on this page">
      <div class="wa-dock__in">
        <PrimaryAction b={block} />
      </div>
    </div>
  );
}

export function CalmView(props: { api: EngineApi; spec: FitSpec; outline: PageOutline; fit: FitProfile }): JSX.Element {
  const { api, spec, outline, fit } = props;
  const state = useEngineState(api);
  const zoom = useZoom();
  const version = useDomVersion();
  const sysReduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const needInline = useCalmStyles(rootRef);
  const [scale, setScaleState] = useState(sessionScale);
  const setScale = (s: number): void => {
    sessionScale = s;
    setScaleState(s);
  };

  const level = (fit?.attention?.structureLevel ?? 0) as 0 | 1 | 2;
  const params = structureParams(level);
  const mode = themeModeFor(fit);
  const reduceMotion = sysReduce || !!fit?.attention?.motion?.on;
  const tokens = useMemo(() => tokensFor(fit, mode, { zoom, density: spec.density, scale }), [fit, mode, zoom, spec.density, scale]);
  const style = useMemo(() => tokensToStyle(tokens), [tokens]);

  const plan = useMemo<CalmPlan | null>(() => {
    try {
      return buildPlan({ spec, outline, elementFor: (id) => api.elementFor(id), decisions: state.decisions ?? [], listFirst: params.listFirst, stepMax: params.stepMax });
    } catch (e) {
      console.warn('[WebAble] Calm view could not read this page', e);
      return null;
    }
    // `version` re-reads the live page after it changes.
  }, [api, spec, outline, state.decisions, version, params.listFirst, params.stepMax]);

  /* ---------- what the page shows after the primary action, and popups the person opened ---------- */

  const [resultRoots, setResultRoots] = useState<Element[]>([]);
  const watch = useRef<MutationObserver | null>(null);
  const [popup, setPopup] = useState<Element | null>(null);

  const watchPopups = useCallback((before: Set<Element>) => {
    const check = (): void => {
      const fresh = pagePopups().filter((p) => !before.has(p));
      if (fresh.length) setPopup(fresh[fresh.length - 1]!);
    };
    window.setTimeout(check, 350);
    window.setTimeout(check, 1200);
  }, []);

  const watchResult = useCallback(() => {
    watch.current?.disconnect();
    setResultRoots([]);
    const found: Element[] = [];
    const mo = new MutationObserver((recs) => {
      for (const r of recs) {
        const nodes = r.type === 'childList' ? Array.from(r.addedNodes) : [r.target];
        for (const n of nodes) {
          const e = n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement;
          if (!e || e.closest('webable-ui') || found.some((f) => f.contains(e))) continue;
          for (let i = found.length - 1; i >= 0; i--) if (e.contains(found[i]!)) found.splice(i, 1);
          found.push(e);
        }
      }
      setResultRoots(found.slice());
    });
    mo.observe(document.body ?? document.documentElement, { childList: true, subtree: true, characterData: true });
    watch.current = mo;
    window.setTimeout(() => {
      if (watch.current === mo) {
        mo.disconnect();
        watch.current = null;
      }
    }, 5000);
  }, []);
  useEffect(() => () => watch.current?.disconnect(), []);

  const ctx = useMemo<CalmCtx>(
    () => ({
      api,
      splitN: params.splitSentences,
      groupSize: params.groupSize,
      explainOn: state.settings?.explain !== false,
      reduceMotion,
      click: (el) => {
        const before = new Set(pagePopups());
        proxyClick(el);
        tickNow();
        watchPopups(before);
      },
      pressPrimary: (el) => {
        const before = new Set(pagePopups());
        watchResult();
        proxyClick(el);
        tickNow();
        watchPopups(before);
      },
      peek: (el) => {
        api.closeCalm();
        window.setTimeout(() => focusOriginal(el), 80);
      },
    }),
    [api, params.splitSentences, params.groupSize, state.settings?.explain, reduceMotion, watchPopups, watchResult],
  );

  // New page content outside every placed part (a toast, a confirmation appended to the body) shows in a result card;
  // content inside a placed part already shows in place.
  const result = useMemo<Block[] | null>(() => {
    if (!plan || !resultRoots.length) return null;
    const roots = resultRoots.filter((r) => {
      if (!r.isConnected || plan.roots.some((p) => p === r || p.contains(r))) return false;
      const t = textOf(r);
      return t.length > 0 && t.length < 600 && isShown(r);
    });
    const blocks = roots.slice(0, 3).flatMap((r) => readBlocks(r, newCtx()));
    return blocks.length ? blocks : null;
  }, [plan, resultRoots, version]);
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [!!result]);

  const popupBlocks = useMemo<Block[] | null>(() => {
    if (!popup || !popup.isConnected || !isShown(popup)) return null;
    const b = readBlocks(popup, newCtx());
    return b.length ? b : null;
  }, [popup, version]);
  useEffect(() => {
    if (popup && !popupBlocks) setPopup(null);
  }, [popup, popupBlocks]);
  // A warning the page opens by itself while the view is open (a session-timeout dialog) is mirrored at once,
  // so nothing urgent stays hidden under the view.
  const seenPopups = useRef<Set<Element> | null>(null);
  useEffect(() => {
    const now = pagePopups();
    if (!seenPopups.current) {
      seenPopups.current = new Set(now);
      return;
    }
    const urgent = (p: Element): boolean =>
      p.matches('[role=alertdialog]') || !!p.querySelector('[role=alert]') ||
      (p.matches('[aria-modal=true],[role=dialog]') && /\b(session|time ?out|expir\w*|signed out|warning|error)\b/i.test(textOf(p)));
    const fresh = now.filter((p) => !seenPopups.current!.has(p) && urgent(p));
    now.forEach((p) => seenPopups.current!.add(p));
    if (fresh.length && !popup) setPopup(fresh[fresh.length - 1]!);
  }, [version]);
  const closePopup = (): void => {
    if (popup) proxyKey(popup, 'Escape');
    setPopup(null);
  };

  /* ---------- focus, keys, and telling the engine the person is using the view ---------- */

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  const interacted = useRef(false);
  const signalInteraction = (): void => {
    if (interacted.current) return;
    interacted.current = true;
    rootRef.current?.dispatchEvent(new CustomEvent('webable:calm-interact', { bubbles: true, composed: true }));
  };
  const onScroll = (e: Event): void => {
    if ((e.currentTarget as HTMLElement).scrollTop > 100) signalInteraction();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (popup) closePopup();
      else api.closeCalm();
      return;
    }
    if (e.key !== 'Tab') return;
    const root = rootRef.current?.getRootNode() as ShadowRoot | Document | undefined;
    if (!root) return;
    const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    if (!all.length) return;
    const active = (root as ShadowRoot).activeElement ?? document.activeElement;
    const i = all.indexOf(active as HTMLElement);
    if (e.shiftKey && i === 0) {
      e.preventDefault();
      all[all.length - 1]!.focus();
    } else if (!e.shiftKey && i === all.length - 1) {
      e.preventDefault();
      all[0]!.focus();
    }
  };

  /* ---------- render ---------- */

  const m = calmMetrics(fit, { zoom, density: spec.density, scale });
  const helpAfter = plan ? Math.max(0, plan.main.findIndex((p) => p.isPrimary)) : 0;
  // Alerts come first; the page's cookie question comes right after the main task (still open, every choice kept).
  const alerts = plan ? plan.hoisted.filter((p) => p.notice === 'alert') : [];
  const consents = plan ? plan.hoisted.filter((p) => p.notice !== 'alert') : [];
  const afterPrimary = plan ? (
    <>
      {plan.help.length > 0 && (
        <section class="wa-band wa-band--tight" aria-label="Help">
          <HelpCard blocks={plan.help} />
        </section>
      )}
      {consents.map((p) => (
        <SectionView key={p.key} p={p} />
      ))}
    </>
  ) : null;
  const empty = !plan || (!plan.main.length && !plan.hoisted.length && !plan.drawer.length);

  return (
    <div
      ref={rootRef}
      class="wa-calm"
      role="region"
      aria-label="Calm view"
      lang={document.documentElement.lang || undefined}
      data-scheme={tokens.scheme}
      data-mode={mode}
      data-motion={reduceMotion ? 'reduce' : undefined}
      data-f={String(m.F)}
      style={style}
      onKeyDown={onKeyDown}
      onScroll={onScroll}
      onPointerDown={signalInteraction}
      onInput={signalInteraction}
    >
      {needInline && <style>{calmCss}</style>}
      <Calm.Provider value={ctx}>
        <Strip api={api} plan={plan} scale={scale} setScale={setScale} />
        <main ref={mainRef} class="wa-page" tabIndex={-1}>
          <div class={`wa-col${reduceMotion ? '' : ' wa-fade'}`} key={specKey(spec)}>
            {empty || !plan ? (
              <div class="wa-empty wa-stack" style={{ alignItems: 'center' }}>
                <p>This page has nothing the Calm view can show here.</p>
                <button type="button" class="wa-btn wa-btn--accent" onClick={() => api.showOriginal(true)}>
                  Original page
                </button>
              </div>
            ) : (
              <>
                <SubStrip plan={plan} />
                <Intro plan={plan} state={state} />
                {result && (
                  <div class="wa-band wa-band--tight" ref={resultRef}>
                    <div class="wa-result wa-fade" role="status">
                      <span class="wa-eyebrow">The page now shows</span>
                      <Blocks blocks={result} />
                    </div>
                  </div>
                )}
                {alerts.map((p) => (
                  <SectionView key={p.key} p={p} />
                ))}
                {plan.main.map((p, i) => (
                  <Fragment key={p.key}>
                    <SectionView p={p} />
                    {i === helpAfter && afterPrimary}
                  </Fragment>
                ))}
                {!plan.main.length && afterPrimary}
                <Drawer plan={plan} />
                <footer class="wa-foot">
                  <span>Words and controls come from this page. Shown by WebAble.</span>
                  <button type="button" class="wa-btn wa-btn--quiet" onClick={() => api.showOriginal(true)}>
                    Original page
                  </button>
                </footer>
              </>
            )}
          </div>
        </main>
        {!empty && <PrimaryDock plan={plan} rootRef={rootRef} api={api} decisions={state.decisions ?? []} />}
        {popupBlocks && (
          <div class="wa-popup" role="dialog" aria-label="From the page">
            <div class="wa-popup__head">
              <span class="wa-eyebrow">From the page</span>
              <button type="button" class="wa-btn wa-btn--quiet" onClick={closePopup} aria-label="Close this">
                <I.Close />
              </button>
            </div>
            <Blocks blocks={popupBlocks} />
          </div>
        )}
      </Calm.Provider>
    </div>
  );
}
