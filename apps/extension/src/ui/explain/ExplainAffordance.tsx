// Owner: D2. The "Explain" pill that appears beside a long text selection. Explaining is never automatic.
import type { EngineApi } from '../../contracts';
import { IconSpark } from '../panel/icons';

export interface Explainable {
  text: string;
  rect: { x: number; y: number; w: number; h: number };
}

export function ExplainAffordance({ api, item, onDone }: { api: EngineApi; item: Explainable; onDone: () => void }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = 132;
  const left = Math.max(8, Math.min(vw - w - 8, item.rect.x + item.rect.w - w));
  const below = item.rect.y + item.rect.h + 8;
  const top = below + 52 < vh ? below : Math.max(8, item.rect.y - 52);
  return (
    <button
      class="wa-ex-pill"
      style={{ left: `${Math.round(left)}px`, top: `${Math.round(top)}px` }}
      title="Explain this in plain words. Sends this passage, with personal details removed, to OpenAI. The original stays."
      // Keep the page's selection while pressing our button.
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => {
        void api.explainSelection(item.text, item.rect).catch(() => {});
        onDone();
      }}
    >
      <IconSpark size={15} />
      Explain
    </button>
  );
}
