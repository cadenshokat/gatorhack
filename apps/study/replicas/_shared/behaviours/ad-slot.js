// Ad slots. The capture keeps each ad iframe's src (so WebAble reads it as an ad network) and fills it from a local
// srcdoc snapshot, so nothing loads from the ad host. This module adds what the slots do over time: filling after a
// fixed delay (the layout shift a live page has), an adhesion ad's close button, and an optional local creative for
// slots captured empty.

/**
 * @param {Document | Element} root
 * @param {object} o
 * @param {string} o.slot selector of the ad slot elements
 * @param {number} [o.revealAfterMs] slots start collapsed (display:none) and appear after this fixed delay
 * @param {string} [o.close] selector of a close button inside a slot (adhesion ads); closing removes that slot
 * @param {{ src: string, width: number, height: number, alt?: string }} [o.creative] fill slots that have no iframe,
 *   image or video with this local image
 */
export function init(root, o) {
  const doc = root.ownerDocument || root;
  const slots = [...root.querySelectorAll(o.slot)];
  let timer = 0;
  if (o.creative) {
    for (const s of slots) {
      if (s.querySelector('iframe, img, video')) continue;
      const img = doc.createElement('img');
      img.src = o.creative.src;
      img.width = o.creative.width;
      img.height = o.creative.height;
      img.alt = o.creative.alt ?? 'Advertisement';
      s.append(img);
    }
  }
  if (o.revealAfterMs && o.revealAfterMs > 0) {
    for (const s of slots) s.style.setProperty('display', 'none');
    timer = window.setTimeout(() => {
      for (const s of slots) s.style.removeProperty('display');
    }, o.revealAfterMs);
  }
  const onClick = (e) => {
    const t = e.target;
    if (!(t instanceof Element) || !o.close) return;
    const b = t.closest(o.close);
    const s = b && slots.find((x) => x.contains(b));
    if (!s) return;
    e.preventDefault();
    s.remove();
  };
  root.addEventListener('click', onClick);
  return {
    destroy() {
      window.clearTimeout(timer);
      root.removeEventListener('click', onClick);
    },
  };
}
