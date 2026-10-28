// Consent or cookie banner with the site's own buttons. Any of its buttons (accept, reject, close) dismisses it and
// unlocks scrolling. Nothing is remembered: every page load starts with the banner, as for a first-time visitor.

/**
 * @param {Document | Element} root
 * @param {object} o
 * @param {string} o.banner selector of the banner (or dialog) element
 * @param {string} [o.host] selector of a shadow host when the banner lives in its (open) shadow root
 * @param {string} o.dismiss selector, inside the banner, of every button that closes it
 * @param {string} [o.overlay] selector of a backdrop to hide with it
 * @param {number} [o.showAfterMs] 0 or absent: shown from the start (as captured); otherwise hidden at load and shown
 *   after this fixed delay
 * @param {string} [o.hiddenClass] class that hides the banner on the site; default: inline display:none
 * @param {boolean} [o.remove] remove the banner from the DOM instead of hiding it
 * @param {{ el: 'html' | 'body', name: string }[]} [o.lockClasses] scroll-lock classes to remove on dismiss
 * @param {boolean} [o.clearLockStyles] clear inline overflow/position/top on html and body on dismiss
 */
export function init(root, o) {
  const doc = root.ownerDocument || root;
  const scope = o.host ? root.querySelector(o.host)?.shadowRoot : root;
  const banner = scope ? scope.querySelector(o.banner) : null;
  if (!banner) return { destroy() {} };
  const overlay = o.overlay ? scope.querySelector(o.overlay) : null;

  const hide = (el) => {
    if (!el) return;
    if (o.remove) el.remove();
    else if (o.hiddenClass) el.classList.add(o.hiddenClass);
    else el.style.setProperty('display', 'none', 'important');
  };
  const show = (el) => {
    if (!el) return;
    if (o.hiddenClass) el.classList.remove(o.hiddenClass);
    else el.style.removeProperty('display');
  };

  let timer = 0;
  if (o.showAfterMs && o.showAfterMs > 0) {
    hide(banner);
    hide(overlay);
    timer = window.setTimeout(() => {
      show(banner);
      show(overlay);
    }, o.showAfterMs);
  }

  const onClick = (e) => {
    // composedPath reaches into shadow roots, where e.target is only the host.
    const btn = e.composedPath().find((n) => n instanceof Element && n.matches(o.dismiss));
    if (!btn || !banner.contains(btn)) return;
    e.preventDefault();
    window.clearTimeout(timer);
    hide(banner);
    hide(overlay);
    for (const c of o.lockClasses || []) (c.el === 'html' ? doc.documentElement : doc.body).classList.remove(c.name);
    if (o.clearLockStyles) {
      for (const el of [doc.documentElement, doc.body]) for (const p of ['overflow', 'position', 'top', 'height']) el.style.removeProperty(p);
    }
  };
  // Capture phase: some banners live in shadow roots or stop propagation in their own markup.
  root.addEventListener('click', onClick, true);
  return {
    destroy() {
      window.clearTimeout(timer);
      root.removeEventListener('click', onClick, true);
    },
  };
}
