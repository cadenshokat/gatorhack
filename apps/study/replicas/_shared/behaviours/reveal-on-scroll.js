// Content the live page adds late, on scroll ("Related articles", "More stories"). The capture keeps it in the page
// with the hidden attribute (see fixDom in the README); this reveals it once the reader scrolls to a fixed position,
// the same for everyone.

/**
 * @param {Document | Element} root
 * @param {object} o
 * @param {string} o.target selector of the hidden element(s)
 * @param {string} [o.near] reveal once this element's top is within `marginPx` below the bottom of the screen
 *   (follows the element when sections above it open or close)
 * @param {number} [o.marginPx] for `near` (default 0)
 * @param {number} [o.atY] or: reveal once scrollY >= atY (CSS px)
 * @param {number} [o.nearEndPx] or: reveal once the bottom of the screen is within this many px of the page end
 *   (default 600 when neither `near` nor `atY` is given)
 */
export function init(root, o) {
  const doc = root.ownerDocument || root;
  const targets = [...root.querySelectorAll(o.target)];
  if (!targets.length) return { destroy() {} };
  let done = false;
  let raf = 0;
  const check = () => {
    raf = 0;
    if (done) return;
    const y = window.scrollY;
    const anchor = o.near ? root.querySelector(o.near) : null;
    const hit = anchor
      ? anchor.getBoundingClientRect().top <= window.innerHeight + (o.marginPx ?? 0)
      : o.atY !== undefined
        ? y >= o.atY
        : y + window.innerHeight >= doc.documentElement.scrollHeight - (o.nearEndPx ?? 600);
    if (!hit) return;
    done = true;
    for (const t of targets) t.removeAttribute('hidden');
    window.removeEventListener('scroll', onScroll);
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(check);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return {
    destroy() {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
