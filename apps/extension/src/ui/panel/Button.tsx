// Owner: P. The WebAble button: a white circle at the bottom corner with the WebAble mark (a green dot in a ring).
// The ring turns green when WebAble changed something on this page. No count, no text. Alt+W opens the sheet.
import type { EngineState } from '../../contracts';
import { changedHere, sheetMode } from './model';

export function WaButton({ s, origin, open, onToggle }: { s: EngineState; origin: string; open: boolean; onToggle: () => void }) {
  const mode = sheetMode(s, origin);
  const changed = mode === 'on' && changedHere(s);
  const label = open
    ? 'Close WebAble'
    : mode === 'paused'
      ? 'WebAble, paused on this site'
      : mode === 'off'
        ? 'WebAble, turned off'
        : changed
          ? 'WebAble, changed this page for you'
          : 'WebAble';
  return (
    <button
      class="wa-fab"
      data-wa-chrome=""
      data-changed={changed ? '' : undefined}
      data-state={mode}
      aria-expanded={open}
      aria-label={label}
      title={`${label} (Alt+W)`}
      onClick={onToggle}
    >
      <span class="wa-mark" aria-hidden="true">
        <i />
      </span>
    </button>
  );
}
