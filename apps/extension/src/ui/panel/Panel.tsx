// Owner: P, U. The WebAble panel: text size and page width first, then Original page, Calm view, Lens toggle, what
// changed, the Jev counter and the signal gauges.
import { useEffect, useRef } from 'preact/hooks';
import type { EngineApi, EngineState } from '../../contracts';
import { phaseLine } from './format';
import { Gauges } from './Gauges';
import { modifierLabel, shortcutLabel, type PillSide } from './hooks';
import { IconClose, IconLayout, IconLens, IconSpark } from './icons';
import { JevCounter } from './JevCounter';
import { Ledger } from './Ledger';
import type { TodayMeter } from './today';

interface Props {
  api: EngineApi;
  s: EngineState;
  origin: string;
  side: PillSide;
  /** The tallest the panel may be, in the chrome layer's CSS px (design pixels). Its body scrolls inside. */
  maxHeightPx: number;
  /** The tab's page zoom, shown as the text size. */
  pageZoom: number;
  reduce: boolean;
  today: TodayMeter | null;
  onClose: () => void;
  /** Called before the person changes the text size or page width here, so the change can be announced. */
  onAdjust?: (what: 'text' | 'column') => void;
}

/** "960 px column" or "Full width", for the panel and for announcements. */
export function columnLabel(col: EngineState['column'] | undefined): string {
  if (!col || !col.on || col.widthPx == null || !Number.isFinite(col.widthPx)) return 'Full width';
  return `${Math.round(col.widthPx)} px column`;
}

/** "150%": the size the page is shown at (the tab's zoom). */
/** The zoom text is shown at: the tab's zoom without the page column's share (see EngineState.textZoom). */
export function textZoomOf(s: Pick<EngineState, 'pageZoom' | 'textZoom'>, pageZoom: number): number {
  const ratio = s.textZoom && s.pageZoom > 0 ? s.textZoom / s.pageZoom : 1;
  return pageZoom * (Number.isFinite(ratio) && ratio > 0 ? ratio : 1);
}

export function textSizeLabel(pageZoom: number): string {
  return `${Math.round((Number.isFinite(pageZoom) && pageZoom > 0 ? pageZoom : 1) * 100)}%`;
}

/** What the page-width buttons can do right now. */
export function columnButtons(col: EngineState['column'] | undefined): { narrower: boolean; wider: boolean; full: boolean } {
  const on = Boolean(col?.on && col.widthPx != null);
  const w = col?.widthPx ?? null;
  return {
    narrower: !on || w === null || col!.minPx == null || w > col!.minPx + 0.5,
    wider: on && w !== null && (col!.maxPx == null || w < col!.maxPx - 0.5),
    full: !on,
  };
}

/** Text size and page width, at the top of the panel, in plain words. */
export function PageControls({ api, s, pageZoom, onAdjust }: { api: EngineApi; s: EngineState; pageZoom: number; onAdjust?: Props['onAdjust'] }) {
  const col = s.column;
  const can = columnButtons(col);
  const text = (step: -1 | 1) => {
    onAdjust?.('text');
    api.adjustText(step);
  };
  const width = (step: -1 | 0 | 1 | 'off') => {
    onAdjust?.('column');
    api.adjustColumn(step);
  };
  return (
    <section class="wa-card wa-pagectl" aria-label="This page">
      <div class="wa-prow">
        <div class="wa-prow-head">
          <span class="wa-prow-title">Text size</span>
          <span class="wa-prow-val">{textSizeLabel(textZoomOf(s, pageZoom))}</span>
        </div>
        <div class="wa-seg" role="group" aria-label={`Text size, now ${textSizeLabel(textZoomOf(s, pageZoom))}`}>
          <button class="wa-segbtn" aria-label="Smaller text" title="Smaller text" onClick={() => text(-1)}>
            <span class="wa-glyph" aria-hidden="true">
              <span class="wa-glyph-s">A</span>−
            </span>
            Smaller
          </button>
          <button class="wa-segbtn" aria-label="Larger text" title="Larger text" onClick={() => text(1)}>
            <span class="wa-glyph" aria-hidden="true">
              <span class="wa-glyph-l">A</span>+
            </span>
            Larger
          </button>
        </div>
      </div>
      <div class="wa-prow">
        <div class="wa-prow-head">
          <span class="wa-prow-title">Page width</span>
          <span class="wa-prow-val">{columnLabel(col)}</span>
        </div>
        <div class="wa-seg" role="group" aria-label={`Page width, now ${columnLabel(col).toLowerCase()}`}>
          <button class="wa-segbtn" disabled={!can.narrower} title={`Narrower (${shortcutLabel('[')})`} onClick={() => width(-1)}>
            Narrower
          </button>
          <button class="wa-segbtn" disabled={!can.wider} title={`Wider (${shortcutLabel(']')})`} onClick={() => width(1)}>
            Wider
          </button>
          <button
            class="wa-segbtn"
            aria-pressed={can.full}
            title={can.full ? 'Back to a column when the page is enlarged' : 'Let the page use the whole width'}
            onClick={() => width(can.full ? 0 : 'off')}
          >
            Full width
          </button>
        </div>
      </div>
    </section>
  );
}

/** "AI layouts off: no credits" and friends, from the server's health. Null when AI layouts are working. */
export function aiLine(s: EngineState): string | null {
  if (!s.settings.aiLayouts) return null;
  if (s.ai === 'no_credits') return 'AI layouts off: no credits. Calm view uses layouts made on this device, and Jev still picks between them.';
  if (s.ai === 'off') return 'AI layouts off. Calm view uses layouts made on this device, and Jev still picks between them.';
  return null;
}

export const SHORTCUTS: Array<{ key: string; label: string; long: string }> = [
  { key: 'L', label: 'Lens', long: 'Jev Lens' },
  { key: 'C', label: 'Calm', long: 'Calm view' },
  { key: 'O', label: 'Original', long: 'Original page' },
  { key: 'W', label: 'Panel', long: 'This panel' },
  { key: '[ ]', label: 'Width', long: 'Page narrower and wider' },
];

/** 'Alt+Shift+L', and for the bracket pair 'Alt+Shift+[ and ]'. */
function keyName(key: string): string {
  return key === '[ ]' ? `${shortcutLabel('[')} and ]` : shortcutLabel(key);
}

export function Panel({ api, s, origin, side, maxHeightPx, pageZoom, reduce, today, onClose, onAdjust }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // The panel only opens from our own pill or shortcut; move focus to its heading.
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  const active = s.settings.enabled && !s.settings.pausedOrigins.includes(origin);
  const canCalm = active && Boolean(s.outline && s.outline.nodes.length > 0) && Boolean(s.fit);
  const calmBusy = s.calm.loading && !s.calm.open;
  const ai = aiLine(s);

  return (
    <div
      class="wa-panel"
      ref={ref}
      role="region"
      aria-label="WebAble"
      data-side={side}
      data-wa-chrome=""
      style={{ maxHeight: `${Math.max(120, Math.round(maxHeightPx))}px` }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div class="wa-panel-head">
        <div class="wa-panel-title">
          <h2 ref={titleRef} tabIndex={-1}>
            <span class="wa-dot" data-state={s.showingOriginal ? 'original' : s.ops.some((o) => o.status === 'applied') ? 'changed' : 'idle'} />
            WebAble
          </h2>
          <p>{phaseLine(s, origin)}</p>
        </div>
        <button class="wa-iconbtn" aria-label="Close panel" onClick={onClose}>
          <IconClose size={16} />
        </button>
      </div>

      <div class="wa-panel-body">
        {active && <PageControls api={api} s={s} pageZoom={pageZoom} onAdjust={onAdjust} />}
        <div class="wa-card">
          <div class="wa-actions">
            <button
              class={`wa-btn ${s.showingOriginal ? 'wa-btn-accent' : ''}`}
              aria-pressed={s.showingOriginal}
              onClick={() => api.showOriginal(!s.showingOriginal)}
              disabled={!active && !s.showingOriginal}
            >
              {s.showingOriginal ? 'Back to fitted' : 'Original page'}
            </button>
            <button
              class="wa-btn wa-btn-primary"
              disabled={!canCalm || calmBusy}
              aria-pressed={s.calm.open}
              onClick={() => {
                if (s.calm.open) api.closeCalm();
                else void api.openCalm().catch(() => {});
              }}
            >
              <IconLayout size={16} />
              {s.calm.open ? 'Close Calm view' : calmBusy ? 'Arranging…' : 'Calm view'}
            </button>
          </div>
          {ai && (
            <p class="wa-ailine" role="status">
              <span class="wa-ailine-icon" aria-hidden="true">
                <IconSpark size={14} />
              </span>
              <span>{ai}</span>
            </p>
          )}
          <div class="wa-hr" />
          <button class="wa-switch" role="switch" aria-checked={s.lens.on} onClick={() => api.toggleLens(!s.lens.on)}>
            <IconLens size={20} />
            <span class="wa-switch-text">
              <span class="wa-switch-title">Show how Jev read this page</span>
              <span class="wa-switch-sub">
                Jev's probabilities and what WebAble did with them <span class="wa-kbd">{shortcutLabel('L')}</span>
              </span>
            </span>
            <span class="wa-track" aria-hidden="true" />
          </button>
        </div>

        <JevCounter s={s} reduce={reduce} today={today} />
        <Ledger api={api} s={s} />
        <Gauges s={s} />
      </div>

      <div class="wa-panel-foot">
        <div class="wa-foot-row">
          <button class="wa-link" onClick={() => api.openFitting()}>
            {s.fit ? 'Run the fitting again' : 'Run the fitting'}
          </button>
          <span>Nothing you type is sent.</span>
        </div>
        <div class="wa-keys" role="note" aria-label={`Keyboard shortcuts: ${SHORTCUTS.map((k) => `${keyName(k.key)} ${k.long}`).join(', ')}`}>
          <span class="wa-kbd" aria-hidden="true">{modifierLabel()}</span>
          <ul aria-hidden="true">
            {SHORTCUTS.map((k) => (
              <li key={k.key} title={`${keyName(k.key)}: ${k.long}`}>
                <b>{k.key}</b> {k.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
