// Sticky header states driven by scroll position: a class once the page has scrolled past a fixed offset, and
// optionally hide-on-scroll-down / show-on-scroll-up. Same scroll, same state, every time.

/**
 * @param {Document | Element} root
 * @param {object} o
 * @param {string} o.header selector of the header element
 * @param {string} [o.stuckClass] class added while scrollY > offset
 * @param {number} [o.offset] px scrolled before the header counts as stuck (default 0)
 * @param {string} [o.hideClass] hide-on-down: class added while scrolling down past `offset`, removed on scroll up
 * @param {number} [o.delta] px of movement that counts as a direction change (default 8)
 * @param {{ el: 'html' | 'body', name: string }} [o.pageClass] also toggle this class on html/body with stuckClass
 */
export function init(root, o) {
  const doc = root.ownerDocument || root;
  const header = root.querySelector(o.header);
  if (!header) return { destroy() {} };
  const offset = o.offset ?? 0;
  const delta = o.delta ?? 8;
  let lastY = window.scrollY;
  let raf = 0;
  const update = () => {
    raf = 0;
    const y = window.scrollY;
    const stuck = y > offset;
    if (o.stuckClass) header.classList.toggle(o.stuckClass, stuck);
    if (o.pageClass) (o.pageClass.el === 'html' ? doc.documentElement : doc.body).classList.toggle(o.pageClass.name, stuck);
    if (o.hideClass && Math.abs(y - lastY) >= delta) {
      header.classList.toggle(o.hideClass, y > lastY && y > offset);
      lastY = y;
    }
    if (!stuck && o.hideClass) header.classList.remove(o.hideClass);
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  update();
  return {
    destroy() {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
