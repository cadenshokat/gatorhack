// A video player that floats in a corner once its slot scrolls out of view (news sites), with its close button.
// Floats at a fixed scroll position or when the slot leaves the screen; the slot keeps its height so nothing jumps.

/**
 * @param {Document | Element} root
 * @param {object} o
 * @param {string} o.player selector of the element that floats
 * @param {string} [o.slot] selector of its in-flow slot (default: the player's parent)
 * @param {string} [o.floatClass] the site's own class for the floating state; without it, inline fixed styles are used
 * @param {{ right?: number, bottom?: number, left?: number, top?: number, width?: number, zIndex?: number }} [o.box]
 *   floating position and width in CSS px (default right 8, bottom 8, width 200, z-index 1000)
 * @param {number} [o.atY] float once scrollY >= atY; default: once the slot's bottom has left the screen
 * @param {string} [o.close] selector of the close button (inside the player); closing stops it floating for good
 */
export function init(root, o) {
  const player = root.querySelector(o.player);
  if (!player) return { destroy() {} };
  const slot = (o.slot && root.querySelector(o.slot)) || player.parentElement;
  const box = { right: 8, bottom: 8, width: 200, zIndex: 1000, ...(o.box || {}) };
  let floating = false;
  let closed = false;
  let raf = 0;
  const saved = player.getAttribute('style');

  const set = (v) => {
    if (v === floating) return;
    floating = v;
    if (v && slot) slot.style.minHeight = `${slot.getBoundingClientRect().height}px`;
    if (!v && slot) slot.style.removeProperty('min-height');
    if (o.floatClass) {
      player.classList.toggle(o.floatClass, v);
      return;
    }
    if (v) {
      const ratio = player.getBoundingClientRect().height / Math.max(1, player.getBoundingClientRect().width);
      Object.assign(player.style, { position: 'fixed', width: `${box.width}px`, height: `${Math.round(box.width * ratio)}px`, zIndex: String(box.zIndex) });
      for (const k of ['right', 'bottom', 'left', 'top']) if (box[k] !== undefined) player.style[k] = `${box[k]}px`;
    } else if (saved === null) player.removeAttribute('style');
    else player.setAttribute('style', saved);
  };
  const check = () => {
    raf = 0;
    if (closed) return;
    const out = o.atY !== undefined ? window.scrollY >= o.atY : !!slot && slot.getBoundingClientRect().bottom < 0;
    set(out);
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(check);
  };
  const onClick = (e) => {
    const t = e.target;
    if (!(t instanceof Element) || !o.close || !t.closest(o.close) || !player.contains(t)) return;
    e.preventDefault();
    closed = true;
    set(false);
    player.style.setProperty('display', 'none');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  player.addEventListener('click', onClick);
  check();
  return {
    destroy() {
      window.removeEventListener('scroll', onScroll);
      player.removeEventListener('click', onClick);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
