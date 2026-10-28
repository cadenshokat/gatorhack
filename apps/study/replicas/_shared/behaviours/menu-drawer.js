// Menu drawer (hamburger). The toggle opens the drawer; the close button, the backdrop or Escape closes it. Mirrors
// the site's classes and aria-expanded so its own CSS draws the open state.

/**
 * @param {Document | Element} root
 * @param {object} o
 * @param {string} o.toggle selector of the button(s) that open (and, when open, close) the drawer
 * @param {string} o.drawer selector of the drawer element
 * @param {string} [o.close] selector of close buttons inside the drawer
 * @param {string} [o.backdrop] selector of a backdrop that closes the drawer when tapped
 * @param {string} [o.openClass] class on the drawer while open
 * @param {boolean} [o.hidden] toggle the drawer's hidden attribute
 * @param {{ el: 'html' | 'body', name: string }} [o.pageClass] class on html/body while open (scroll lock)
 * @param {string} [o.toggleOpenClass] class on the toggle while open
 */
export function init(root, o) {
  const doc = root.ownerDocument || root;
  const drawer = root.querySelector(o.drawer);
  if (!drawer) return { destroy() {} };
  let open = false;
  const set = (v) => {
    open = v;
    for (const t of root.querySelectorAll(o.toggle)) {
      t.setAttribute('aria-expanded', String(v));
      if (o.toggleOpenClass) t.classList.toggle(o.toggleOpenClass, v);
    }
    if (o.openClass) drawer.classList.toggle(o.openClass, v);
    if (o.hidden) drawer.hidden = !v;
    if (o.pageClass) (o.pageClass.el === 'html' ? doc.documentElement : doc.body).classList.toggle(o.pageClass.name, v);
  };
  const onClick = (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest(o.toggle)) {
      e.preventDefault();
      set(!open);
    } else if (open && o.close && t.closest(o.close) && drawer.contains(t)) {
      e.preventDefault();
      set(false);
    } else if (open && o.backdrop && t.closest(o.backdrop)) {
      set(false);
    }
  };
  const onKey = (e) => {
    if (open && e.key === 'Escape') set(false);
  };
  root.addEventListener('click', onClick);
  doc.addEventListener('keydown', onKey);
  return {
    open: () => set(true),
    close: () => set(false),
    destroy() {
      root.removeEventListener('click', onClick);
      doc.removeEventListener('keydown', onKey);
    },
  };
}
