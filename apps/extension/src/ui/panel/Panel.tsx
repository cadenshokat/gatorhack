// Owner: D2. The WebAble panel: what changed, Original page, Calm view, Lens toggle, Jev counter, signal gauges.
import { useEffect, useRef } from 'preact/hooks';
import type { EngineApi, EngineState } from '../../contracts';
import { phaseLine } from './format';
import { Gauges } from './Gauges';
import { IconClose, IconLayout, IconLens } from './icons';
import { JevCounter } from './JevCounter';
import { Ledger } from './Ledger';

interface Props {
  api: EngineApi;
  s: EngineState;
  origin: string;
  bottomPx: number;
  reduce: boolean;
  onClose: () => void;
}

export function Panel({ api, s, origin, bottomPx, reduce, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // The panel only opens from our own pill, so focus is already in our UI; move it to the heading.
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  const active = s.settings.enabled && !s.settings.pausedOrigins.includes(origin);
  const canCalm = active && Boolean(s.outline && s.outline.nodes.length > 0) && Boolean(s.fit);
  const calmBusy = s.calm.loading && !s.calm.open;

  return (
    <div
      class="wa-panel"
      ref={ref}
      role="region"
      aria-label="WebAble"
      style={{ bottom: `${bottomPx}px`, maxHeight: `calc(100dvh - ${bottomPx + 16}px)` }}
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
          <div class="wa-hr" />
          <button
            class="wa-switch"
            role="switch"
            aria-checked={s.lens.on}
            onClick={() => api.toggleLens(!s.lens.on)}
          >
            <IconLens size={20} />
            <span class="wa-switch-text">
              <span class="wa-switch-title">Show how Jev read this page</span>
              <span class="wa-switch-sub">
                Role, probability and what WebAble did, on every element <span class="wa-kbd">Alt J</span>
              </span>
            </span>
            <span class="wa-track" aria-hidden="true" />
          </button>
        </div>

        <JevCounter s={s} reduce={reduce} />
        <Ledger api={api} s={s} />
        <Gauges s={s} />
      </div>

      <div class="wa-panel-foot">
        <button class="wa-link" onClick={() => api.openFitting()}>
          {s.fit ? 'Run the fitting again' : 'Run the fitting'}
        </button>
        <span>Nothing you type is sent.</span>
      </div>
    </div>
  );
}
