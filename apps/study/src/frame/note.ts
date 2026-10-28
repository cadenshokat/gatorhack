// The neutral note shown when a link is tapped, identical in both conditions: "Links are turned off. You can find the
// answer without them." It is drawn in the parent document over the bottom of the frame, so it is never part of
// the replica (the engine's reader, its checks and its late-content watch never see it) and is never scaled by the
// frame's zoom. Gator Hack tokens: white card, hairline, ink #16150f, 16 px text.

const TEXT = 'Links are turned off. You can find the answer without them.';
const SHOW_MS = 2600;

const CSS = `
:host { all: initial; }
.note {
  position: fixed; z-index: 2147483647; box-sizing: border-box; pointer-events: none;
  padding: 14px 18px; border-radius: 20px; background: #ffffff; color: #16150f;
  border: 1px solid #e6e3dc; box-shadow: 0 1px 2px rgba(22,21,15,.04), 0 12px 40px rgba(22,21,15,.10);
  font: 400 16px/22px system-ui, -apple-system, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-text-size-adjust: 100%; text-size-adjust: 100%;
  opacity: 0; transform: translateY(6px); transition: opacity .2s cubic-bezier(.2,.8,.2,1), transform .2s cubic-bezier(.2,.8,.2,1);
}
.note.on { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .note { transition: none; transform: none; } }
`;

interface Mounted {
  host: HTMLElement;
  card: HTMLElement;
  timer: number;
}

let mounted: Mounted | null = null;

/** The document to draw in: the parent's when it is ours (same origin), else this one. */
function drawingDoc(): { doc: Document; frame: Element | null } {
  try {
    const fe = window.frameElement;
    if (fe && window.parent !== window && window.parent.document) return { doc: window.parent.document, frame: fe };
  } catch {
    /* another origin */
  }
  return { doc: document, frame: null };
}

function mount(doc: Document): Mounted {
  const host = doc.createElement('study-link-note');
  host.setAttribute('aria-live', 'polite');
  const root = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = CSS;
  const card = doc.createElement('div');
  card.className = 'note';
  card.setAttribute('role', 'status');
  card.textContent = TEXT;
  root.append(style, card);
  (doc.body ?? doc.documentElement).append(host);
  return { host, card, timer: 0 };
}

/** Show the note over the bottom of the frame for a moment (a second tap restarts it). */
export function showLinkNote(): void {
  const { doc, frame } = drawingDoc();
  const view = doc.defaultView ?? window;
  if (!mounted || !mounted.host.isConnected || mounted.host.ownerDocument !== doc) {
    mounted?.host.remove();
    mounted = mount(doc);
  }
  const m = mounted;
  const box = frame ? frame.getBoundingClientRect() : { left: 0, right: view.innerWidth, bottom: view.innerHeight, width: view.innerWidth };
  const left = Math.max(0, box.left);
  const right = Math.min(view.innerWidth, box.right);
  const bottom = Math.min(view.innerHeight, box.bottom);
  const gutter = 16;
  m.card.style.left = `${Math.round(left + gutter)}px`;
  m.card.style.width = `${Math.max(120, Math.round(right - left - gutter * 2))}px`;
  m.card.style.bottom = `${Math.round(view.innerHeight - bottom + gutter)}px`;
  view.clearTimeout(m.timer);
  // Next frame, so the fade runs on the first show too.
  view.requestAnimationFrame(() => m.card.classList.add('on'));
  m.timer = view.setTimeout(() => m.card.classList.remove('on'), SHOW_MS);
}

export function removeLinkNote(): void {
  mounted?.host.remove();
  mounted = null;
}

// The note lives in the parent's document, but its hide timer belongs to this frame: take it down with the frame.
window.addEventListener('pagehide', removeLinkNote);
