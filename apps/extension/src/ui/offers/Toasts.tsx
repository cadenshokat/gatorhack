// Owner: D2. Toasts state what changed. Plain notes leave after 6 s; toasts with an Undo after 12 s (the Undo stays
// in the panel). Hover or focus holds either.
import { useEffect, useState } from 'preact/hooks';
import type { EngineApi, Toast } from '../../contracts';
import { IconCheck, IconClose, IconUndo } from '../panel/icons';

const SHOW = 3;
const PLAIN_MS = 6000;
const UNDO_MS = 12000;

function ToastItem({ api, t }: { api: EngineApi; t: Toast }) {
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold) return;
    const tm = window.setTimeout(() => api.dismissToast(t.id), t.undoOpId ? UNDO_MS : PLAIN_MS);
    return () => window.clearTimeout(tm);
  }, [api, t.id, t.undoOpId, hold]);

  return (
    <div
      class="wa-toast"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocusIn={() => setHold(true)}
      onFocusOut={() => setHold(false)}
    >
      <span class="wa-toast-icon" aria-hidden="true">
        <IconCheck size={14} />
      </span>
      <span class="wa-toast-text">{t.text}</span>
      {t.undoOpId && (
        <button
          class="wa-btn wa-btn-sm wa-toast-undo"
          onClick={() => {
            if (t.undoOpId) api.undoOp(t.undoOpId);
            api.dismissToast(t.id);
          }}
        >
          <IconUndo size={14} />
          Undo
        </button>
      )}
      <button class="wa-iconbtn wa-toast-x" aria-label="Dismiss" title="Dismiss (Undo stays in the panel)" onClick={() => api.dismissToast(t.id)}>
        <IconClose size={14} />
      </button>
    </div>
  );
}

export function Toasts({ api, toasts }: { api: EngineApi; toasts: Toast[] }) {
  const shown = toasts.slice(-SHOW);
  if (shown.length === 0) return null;
  return (
    <div class="wa-toasts">
      {shown.map((t) => (
        <ToastItem key={t.id} api={api} t={t} />
      ))}
    </div>
  );
}
