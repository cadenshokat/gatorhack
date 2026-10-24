// Owner: P. The demo keyboard shortcuts: Alt+Shift+L Jev Lens, Alt+Shift+C Calm view, Alt+Shift+O original page,
// Alt+Shift+W the panel, Alt+Shift+[ and Alt+Shift+] page width narrower and wider. Alt+J stays as an older Lens
// alias. They never fire while focus is in a text field. Keys are matched by `code` (the physical key), so the
// brackets work whatever character Option+Shift types on a Mac.

export type ShortcutAction = 'lens' | 'calm' | 'original' | 'panel' | 'narrower' | 'wider';

type KeyLike = Pick<KeyboardEvent, 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'code'>;

export function shortcutFor(e: KeyLike): ShortcutAction | null {
  if (!e.altKey || e.ctrlKey || e.metaKey) return null;
  if (!e.shiftKey) return e.code === 'KeyJ' ? 'lens' : null;
  switch (e.code) {
    case 'KeyL':
      return 'lens';
    case 'KeyC':
      return 'calm';
    case 'KeyO':
      return 'original';
    case 'KeyW':
      return 'panel';
    case 'BracketLeft':
      return 'narrower';
    case 'BracketRight':
      return 'wider';
    default:
      return null;
  }
}

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image']);

/** True when the key event comes from a place where letters are typed (never take those keys). */
export function inEditable(e: Event): boolean {
  const t = (e.composedPath?.()[0] ?? e.target) as Element | null;
  if (!t || typeof (t as Element).getAttribute !== 'function') return false;
  const tag = t.tagName?.toLowerCase();
  if (tag === 'input') return !NON_TEXT_INPUTS.has(((t as HTMLInputElement).type || 'text').toLowerCase());
  if (tag === 'textarea' || tag === 'select') return true;
  if ((t as HTMLElement).isContentEditable) return true;
  const role = t.getAttribute('role');
  return role === 'textbox' || role === 'searchbox' || role === 'combobox';
}
