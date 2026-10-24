// Owner: D2. Jev Lens: every element Jev judged gets an outline and a chip (role, probability bar,
// colour by verdict). A header strip shows the call's own numbers; a drawer lists every decision and the raw answers.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ElementDecision } from '@webable/core';
import type { EngineApi, EngineState } from '../../contracts';
import { fmtCost, fmtCount, fmtMs, fmtP, fmtTokens } from '../panel/format';
import { useTweened } from '../panel/hooks';
import { IconClose, IconDiamond, IconFold, IconPin, IconShield, IconStar } from '../panel/icons';
import { VERDICT } from '../panel/css-util';
import { placeChips, type PlaceInput, type Rect } from './place';
import { RawJson } from './RawJson';
import type { TodayMeter } from './today';
import { bandOf, chipFor, verdictCounts, type ChipModel, type ChipVerdict } from './verdict';

const PRIORITY: Record<ChipVerdict, number> = { promote: 5, protect: 4, keep_popup: 3, fold: 2, keep: 1, pending: 0 };
const OUTSET = 3;
/** Element key: a chip is re-created when its verdict lands, so the cascade replays. */
const elKey = (c: ChipModel) => `${c.id}|${c.verdict}`;

function ChipIcon({ v }: { v: ChipVerdict }) {
  const s = 12;
  if (v === 'promote') return <IconStar size={s} />;
  if (v === 'protect') return <IconShield size={s} />;
  if (v === 'fold') return <IconFold size={s} />;
  if (v === 'keep_popup') return <IconPin size={s} />;
  return null;
}

function chipText(c: ChipModel): string {
  if (c.verdict === 'pending') return 'reading…';
  return c.role;
}

interface Props {
  api: EngineApi;
  s: EngineState;
  reduce: boolean;
  today: TodayMeter | null;
  /** Px kept free at the bottom right for the pill and its stack. */
  bottomReserve: number;
}

export function Lens({ api, s, reduce, today, bottomReserve }: Props) {
  const elements = s.digest?.elements ?? [];
  const byId = useMemo(() => {
    const m = new Map<string, ElementDecision>();
    for (const d of s.decisions) m.set(d.id, d);
    return m;
  }, [s.decisions]);
  const chips = useMemo(
    () => elements.map((ev) => chipFor(ev, byId.get(ev.id), s.understanding)),
    [elements, byId, s.understanding],
  );
  const sig = chips.map((c) => `${c.id}:${c.verdict}`).join('|');

  const [drawer, setDrawer] = useState<null | 'log' | 'raw'>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const [scanOn, setScanOn] = useState(!reduce);

  const boxRefs = useRef(new Map<string, HTMLDivElement>());
  const chipRefs = useRef(new Map<string, HTMLDivElement>());
  const headRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const sizes = useRef(new Map<string, { w: number; h: number; sig: string }>());
  const lastStyle = useRef(new Map<string, string>());
  const latest = useRef(chips);
  latest.current = chips;
  const orderRef = useRef(new Map<string, number>());

  // Cascade order: top-to-bottom reading order of the elements at the moment the answers land.
  useMemo(() => {
    const rows: Array<{ id: string; y: number; x: number }> = [];
    for (const c of chips) {
      const el = api.elementFor(c.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      rows.push({ id: c.id, y: r.top, x: r.left });
    }
    rows.sort((a, b) => a.y - b.y || a.x - b.x);
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(r.id, Math.min(i, 60)));
    orderRef.current = m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  // Replay the scan line when Jev's answers arrive.
  const answered = s.decisions.length > 0;
  useEffect(() => {
    if (reduce) return;
    setScanKey((k) => k + 1);
    setScanOn(true);
    const t = window.setTimeout(() => setScanOn(false), 1300);
    return () => window.clearTimeout(t);
  }, [answered, reduce]);

  // Position boxes and chips every frame (reads first, then writes; ≤ 40 elements).
  useEffect(() => {
    let raf = 0;
    let alive = true;
    const layout = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const reserved: Rect[] = [];
      const hr = headRef.current?.getBoundingClientRect();
      if (hr) reserved.push({ x: hr.left - 6, y: hr.top - 6, w: hr.width + 12, h: hr.height + 12 });
      const dr = drawerRef.current?.getBoundingClientRect();
      if (dr) reserved.push({ x: dr.left - 6, y: dr.top, w: dr.width + 12, h: dr.height });
      const inputs: PlaceInput[] = [];
      const rects = new Map<string, DOMRect>();
      const keyOf = new Map<string, string>();
      const missing: string[] = [];
      for (const c of latest.current) {
        const k = elKey(c);
        const chipEl = chipRefs.current.get(k);
        if (!chipEl) continue;
        keyOf.set(c.id, k);
        const el = api.elementFor(c.id);
        if (!el || !el.isConnected) {
          missing.push(k);
          continue;
        }
        const r = el.getBoundingClientRect();
        rects.set(c.id, r);
        const ssig = `${c.role}|${fmtP(c.p)}|${c.word}`;
        let sz = sizes.current.get(k);
        if (!sz || sz.sig !== ssig || sz.w === 0) {
          sz = { w: chipEl.offsetWidth, h: chipEl.offsetHeight, sig: ssig };
          sizes.current.set(k, sz);
        }
        inputs.push({
          id: c.id,
          box: { x: r.left - OUTSET, y: r.top - OUTSET, w: r.width + 2 * OUTSET, h: r.height + 2 * OUTSET },
          chipW: sz.w,
          chipH: sz.h,
          priority: PRIORITY[c.verdict] * 10 + (c.p ?? 0),
        });
      }
      const placed = placeChips(inputs, vw, vh, reserved);
      const write = (key: string, el: HTMLElement | undefined, css: string) => {
        if (!el || lastStyle.current.get(key) === css) return;
        lastStyle.current.set(key, css);
        el.style.cssText = css;
      };
      for (const p of placed) {
        const k = keyOf.get(p.id);
        if (!k) continue;
        const r = rects.get(p.id);
        const boxEl = boxRefs.current.get(k);
        const chipEl = chipRefs.current.get(k);
        const i = orderRef.current.get(p.id) ?? 0;
        if (!p.visible || !r) {
          write(`b${k}`, boxEl, `--i:${i}`);
          write(`c${k}`, chipEl, `--i:${i}`);
          continue;
        }
        const bx = Math.round(r.left - OUTSET);
        const by = Math.round(r.top - OUTSET);
        write(`b${k}`, boxEl, `visibility:visible;--i:${i};transform:translate3d(${bx}px,${by}px,0);width:${Math.round(r.width + 2 * OUTSET)}px;height:${Math.round(r.height + 2 * OUTSET)}px`);
        write(`c${k}`, chipEl, `visibility:visible;--i:${i};transform:translate3d(${Math.round(p.x)}px,${Math.round(p.y)}px,0)`);
      }
      for (const k of missing) {
        write(`b${k}`, boxRefs.current.get(k), '');
        write(`c${k}`, chipRefs.current.get(k), '');
      }
    };
    const frame = () => {
      if (!alive) return;
      if (!document.hidden) {
        try {
          layout();
        } catch {
          /* an element vanished mid-frame; next frame catches up */
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [api]);

  // New answers: new elements and a new order, so every style is written again.
  useEffect(() => {
    lastStyle.current.clear();
  }, [sig]);

  const u = s.understanding;
  const m = u?.metrics ?? null;
  const counts = verdictCounts(s.decisions);
  // Counts up from zero as the chips cascade in.
  // A changing number is not motion, so it counts even with reduced motion.
  const decisionsShown = useTweened(m ? Number(m.questions) || 0 : 0, 900, false, 0);
  const main = s.decisions.find((d) => d.verdict === 'promote');
  const mainChip = main ? chips.find((c) => c.id === main.id) : undefined;
  const pendingText = !s.digest
    ? 'Reading the page…'
    : s.phase === 'reading' || s.phase === 'tailored'
      ? `Asking Jev about ${elements.length} elements…`
      : 'Jev did not answer for this page. Only page-wide changes from the fit are applied.';

  const scrollTo = (id: string) => {
    const el = api.elementFor(id);
    if (!el) return;
    try {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    } catch {
      el.scrollIntoView();
    }
    setHot(id);
  };

  const groups: Array<{ title: string; items: ChipModel[] }> = [
    { title: 'Main action', items: chips.filter((c) => c.verdict === 'promote') },
    { title: 'Protected: never folded or hidden', items: chips.filter((c) => c.verdict === 'protect') },
    { title: 'Kept in view', items: chips.filter((c) => c.verdict === 'keep_popup') },
    { title: 'Folded (dimmed, still there)', items: chips.filter((c) => c.verdict === 'fold') },
    { title: 'Kept as is', items: chips.filter((c) => c.verdict === 'keep' && !c.dashed) },
    { title: 'Left alone: Jev was not sure enough to act', items: chips.filter((c) => c.verdict === 'keep' && c.dashed) },
    { title: 'Waiting for Jev', items: chips.filter((c) => c.verdict === 'pending') },
  ].filter((g) => g.items.length > 0);
  for (const g of groups) g.items.sort((a, b) => (b.p ?? 0) - (a.p ?? 0));

  const raw = u
    ? {
        model: m?.model,
        cached: u.cached,
        metrics: m,
        mainPick: u.mainPick,
        elements: u.elements,
        decisions: s.decisions.map((d) => ({ id: d.id, verdict: d.verdict, reasons: d.reasons })),
      }
    : null;

  return (
    <div class="wa-lens" data-wa-lens="">
      {scanOn && !reduce && <div class="wa-lscan" key={scanKey} aria-hidden="true" />}
      <div aria-hidden="true">
        {chips.map((c) => (
            <div
              key={`b${elKey(c)}`}
              class="wa-lbox"
              data-v={c.verdict}
              data-dashed={String(c.dashed)}
              data-hot={String(hot === c.id)}
              ref={(el) => {
                if (el) boxRefs.current.set(elKey(c), el);
                else boxRefs.current.delete(elKey(c));
              }}
            />
        ))}
        {chips.map((c) => {
          const band = bandOf(c.p);
          return (
            <div
              key={`c${elKey(c)}`}
              class="wa-lchip"
              data-v={c.verdict}
              data-band={band}
              data-dashed={String(c.dashed)}
              data-hot={String(hot === c.id)}
              ref={(el) => {
                if (el) chipRefs.current.set(elKey(c), el);
                else chipRefs.current.delete(elKey(c));
              }}
            >
              <ChipIcon v={c.verdict} />
              <span>{chipText(c)}</span>
              {c.p != null && <span class="wa-lchip-p">· {fmtP(c.p)}</span>}
              {(c.verdict === 'protect' || c.verdict === 'fold' || c.dashed) && c.verdict !== 'pending' && (
                <span class="wa-lchip-word">· {c.word}</span>
              )}
              {c.p != null && (
                <span class="wa-lbar">
                  <i style={{ width: `${Math.round(Math.max(0.04, Math.min(1, c.p)) * 100)}%` }} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div
        class="wa-lhead"
        data-drawer={drawer ? 'open' : undefined}
        ref={headRef}
        role="region"
        aria-label="Jev Lens"
        onKeyDown={(e) => {
          if (e.key === 'Escape') api.toggleLens(false);
        }}
      >
        <div class="wa-lhead-row">
          <span class="wa-lbrand">
            <IconDiamond size={18} />
            Jev Lens
          </span>
          {m ? (
            <span class="wa-lstats">
              <span>{m.model}</span>
              <span class="wa-sep">·</span>
              <span>
                <b class="wa-num">{fmtCount(decisionsShown)}</b> decisions
              </span>
              <span class="wa-sep">·</span>
              <span>all in parallel{m.calls > 1 ? ` (${m.calls} calls)` : ''}</span>
              <span class="wa-sep">·</span>
              <b class="wa-num">{fmtMs(m.wallMs)}</b>
              {m.serverMs != null && <span>(server {fmtMs(m.serverMs)})</span>}
              <span class="wa-sep">·</span>
              <b class="wa-num">{fmtCost(m.costUsd)}</b>
              {u?.cached && <span class="wa-badge">cached answers</span>}
            </span>
          ) : (
            <span class="wa-lstats">
              <span class="wa-dot" data-state="working" /> {pendingText}
            </span>
          )}
          <span class="wa-lhead-btns">
            <button
              class="wa-btn wa-btn-sm"
              aria-pressed={drawer === 'log'}
              onClick={() => setDrawer(drawer === 'log' ? null : 'log')}
            >
              Decisions
            </button>
            <button
              class="wa-btn wa-btn-sm"
              aria-pressed={drawer === 'raw'}
              disabled={!raw}
              onClick={() => setDrawer(drawer === 'raw' ? null : 'raw')}
            >
              View raw answers
            </button>
            <button class="wa-iconbtn" aria-label="Close Jev Lens" title="Close (Alt+J)" onClick={() => api.toggleLens(false)}>
              <IconClose size={16} />
            </button>
          </span>
        </div>
        <div class="wa-lhead-row">
          <span class="wa-legend" aria-label="Bands">
            <span class="wa-legend-item"><i class="wa-sw" /> act ≥ 0.85</span>
            <span class="wa-legend-item"><i class="wa-sw wa-sw-offer" /> offer 0.5–0.85</span>
            <span class="wa-legend-item"><i class="wa-sw wa-sw-leave" /> leave &lt; 0.5</span>
          </span>
          <span class="wa-lhead-sep" aria-hidden="true" />
          {s.decisions.length > 0 ? (
            <span class="wa-lsummary">
              {mainChip ? (
                <span class="wa-vkey">
                  <i style={{ background: VERDICT.promote }} /> main action <b>“{mainChip.label}”</b> {fmtP(mainChip.p)}
                </span>
              ) : (
                <span class="wa-vkey">
                  <i style={{ background: VERDICT.promote }} /> no main action (Jev was not sure)
                </span>
              )}
              <span class="wa-vkey"><i style={{ background: VERDICT.protect }} /><b>{counts.protected}</b> protected</span>
              <span class="wa-vkey"><i style={{ background: VERDICT.fold }} /><b>{counts.folded}</b> folded</span>
              {counts.keptPopup > 0 && (
                <span class="wa-vkey"><i style={{ background: VERDICT.keep_popup }} /><b>{counts.keptPopup}</b> kept in view</span>
              )}
              <span class="wa-vkey"><i style={{ background: '#fff', boxShadow: 'inset 0 0 0 1px #86868B' }} /><b>{counts.leftAlone}</b> left alone</span>
              {m && <span>{fmtTokens(m.inputTokens)}</span>}
            </span>
          ) : (
            <span class="wa-legend" aria-label="Colours">
              <span class="wa-vkey"><i style={{ background: VERDICT.promote }} /> main action</span>
              <span class="wa-vkey"><i style={{ background: VERDICT.protect }} /> protected</span>
              <span class="wa-vkey"><i style={{ background: VERDICT.fold }} /> folded</span>
              <span class="wa-vkey"><i style={{ background: '#fff', boxShadow: 'inset 0 0 0 1px #86868B' }} /> left alone</span>
            </span>
          )}
        </div>
      </div>

      {drawer && (
        <div
          class="wa-ldrawer"
          ref={drawerRef}
          style={{ bottom: `${Math.round(bottomReserve)}px` }}
          role="region"
          aria-label={drawer === 'log' ? 'Jev decisions' : 'Raw answers'}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setDrawer(null);
            }
          }}
        >
          <div class="wa-ldrawer-head">
            <h3>{drawer === 'log' ? `${chips.length} elements` : 'Raw answers'}</h3>
            <button class="wa-iconbtn" aria-label="Close drawer" onClick={() => setDrawer(null)}>
              <IconClose size={16} />
            </button>
          </div>
          <div class="wa-tabs" role="tablist">
            <button class="wa-tab" role="tab" aria-selected={drawer === 'log'} onClick={() => setDrawer('log')}>
              Decisions
            </button>
            <button class="wa-tab" role="tab" aria-selected={drawer === 'raw'} onClick={() => setDrawer('raw')} disabled={!raw}>
              Raw answers
            </button>
          </div>
          <div class="wa-ldrawer-body" onMouseLeave={() => setHot(null)}>
            {drawer === 'log' ? (
              groups.length === 0 ? (
                <p class="wa-empty">{pendingText}</p>
              ) : (
                groups.map((g) => (
                  <div key={g.title}>
                    <div class="wa-lgroup">
                      {g.title} · {g.items.length}
                    </div>
                    <ul class="wa-lrows">
                      {g.items.map((c, idx) => {
                        const colour = c.verdict === 'pending' ? VERDICT.pending : VERDICT[c.verdict];
                        return (
                          <li key={c.id}>
                            <button
                              class="wa-lrow"
                              style={{ '--i': String(Math.min(idx, 30)) }}
                              onMouseEnter={() => setHot(c.id)}
                              onFocus={() => setHot(c.id)}
                              onClick={() => scrollTo(c.id)}
                              title="Scroll to this element"
                            >
                              <span class="wa-lrow-dot" style={{ background: colour }} />
                              <span class="wa-lrow-label">“{c.label}”</span>
                              <span class="wa-lrow-p">{fmtP(c.p)}</span>
                              <span class="wa-lrow-sub">
                                <span>{c.role}</span>
                                <span>· {c.word}</span>
                                <span>· {c.tag}</span>
                                {c.reasons[0] && <span>· {c.reasons.slice(0, 2).join('; ')}</span>}
                              </span>
                              <span class="wa-lrow-bar">
                                <i style={{ width: `${Math.round((c.p ?? 0) * 100)}%`, background: colour }} />
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )
            ) : (
              <>
                <p class="wa-raw-note">
                  Jev's typed answers for this page, as returned. Labels were shortened and personal details removed on
                  this device before anything was sent.
                </p>
                <RawJson value={raw} />
              </>
            )}
          </div>
        </div>
      )}

      {today && today.decisions > 0 && (
        <div class="wa-ltoday" aria-hidden="true">
          Today: <b>{fmtCount(today.decisions)}</b> decisions · <b>{fmtCost(today.usd)}</b>
          {today.pages > 0 && <span>· {fmtCount(today.pages)} pages</span>}
        </div>
      )}
    </div>
  );
}
