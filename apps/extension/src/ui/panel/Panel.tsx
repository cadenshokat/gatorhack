// Owner: P. The WebAble panel: what changed, Original page, Calm view, Lens toggle, Jev counter, signal gauges.
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
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
  /** Distance from the viewport bottom, CSS px. */
  bottomPx: number;
  /** The panel never gets shorter than this (CSS px), so its body stays readable when the tab is zoomed. */
  minHeightPx: number;
  reduce: boolean;
  today: TodayMeter | null;
  onClose: () => void;
  /** Reports the height of the header and footer (CSS px), so the panel can be placed with room for its body. */
  onChromeHeight?: (px: number) => void;
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
];

export function Panel({ api, s, origin, side, bottomPx, minHeightPx, reduce, today, onClose, onChromeHeight }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const lastChrome = useRef(0);
  useLayoutEffect(() => {
    const h = (headRef.current?.offsetHeight ?? 0) + (footRef.current?.offsetHeight ?? 0);
    if (h > 0 && Math.abs(h - lastChrome.current) > 1) {
      lastChrome.current = h;
      onChromeHeight?.(h);
    }
  });

  useEffect(() => {
    // The panel only opens from our own pill or shortcut; move focus to its heading.
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  const active = s.settings.enabled && !s.settings.pausedOrigins.includes(origin);
  const canCalm = active && Boolean(s.outline && s.outline.nodes.length > 0) && Boolean(s.fit);
  const calmBusy = s.calm.loading && !s.calm.open;
  const ai = aiLine(s);
  const maxH = `calc(100dvh - ${Math.round(bottomPx + 16)}px)`;

  return (
    <div
      class="wa-panel"
      ref={ref}
      role="region"
      aria-label="WebAble"
      data-side={side}
      style={{ bottom: `${Math.round(bottomPx)}px`, maxHeight: maxH, minHeight: `min(${Math.round(minHeightPx)}px, ${maxH})` }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div class="wa-panel-head" ref={headRef}>
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

      <div class="wa-panel-foot" ref={footRef}>
        <div class="wa-foot-row">
          <button class="wa-link" onClick={() => api.openFitting()}>
            {s.fit ? 'Run the fitting again' : 'Run the fitting'}
          </button>
          <span>Nothing you type is sent.</span>
        </div>
        <div class="wa-keys" role="note" aria-label={`Keyboard shortcuts: ${SHORTCUTS.map((k) => `${shortcutLabel(k.key)} ${k.long}`).join(', ')}`}>
          <span class="wa-kbd" aria-hidden="true">{modifierLabel()}</span>
          <ul aria-hidden="true">
            {SHORTCUTS.map((k) => (
              <li key={k.key} title={`${shortcutLabel(k.key)}: ${k.long}`}>
                <b>{k.key}</b> {k.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
