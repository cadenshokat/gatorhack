// Owner: P. The WebAble pill, at the bottom of the corner dock (App places the dock where no site control sits). Fern dot = WebAble changed something on this page.
import type { EngineState } from '../../contracts';
import type { PillSide } from './hooks';

export type DotState = 'idle' | 'working' | 'changed' | 'original' | 'error';

export function dotState(s: EngineState): DotState {
  if (s.showingOriginal) return 'original';
  if (s.phase === 'error') return 'error';
  if (s.phase === 'reading' || (s.phase === 'tailored' && !s.understanding)) return 'working';
  if (s.ops.some((o) => o.status === 'applied') || s.calm.open) return 'changed';
  return 'idle';
}

export function Pill(props: { s: EngineState; open: boolean; side: PillSide; onToggle: () => void }) {
  const { s, open, side, onToggle } = props;
  const changed = s.ops.filter((o) => o.status === 'applied').length;
  const state = dotState(s);
  const label =
    state === 'original'
      ? 'WebAble: showing the original page'
      : changed > 0
        ? `WebAble: ${changed} ${changed === 1 ? 'change' : 'changes'} on this page`
        : 'WebAble';
  return (
    <button
      class="wa-pill"
      data-side={side}
      data-wa-chrome=""
      aria-expanded={open}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <span class="wa-dot" data-state={state} aria-hidden="true" />
      <span>{state === 'original' ? 'Original' : 'WebAble'}</span>
      {changed > 0 && state !== 'original' && (
        <span class="wa-pill-count" aria-hidden="true">
          {changed}
        </span>
      )}
    </button>
  );
}
