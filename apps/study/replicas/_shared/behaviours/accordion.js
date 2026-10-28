// Accordion / section toggle. A tap on a trigger opens or closes its panel, mirroring the live site's own state
// changes (aria-expanded, its classes, the hidden attribute) so the site's CSS does the rest. Closed panels that are
// hidden="until-found" stay findable with the browser's Find on Page: the browser removes `hidden` and fires
// `beforematch`, and the section opens as on the live site (NPS).

/**
 * @param {Document | Element} root where triggers live (usually `document`)
 * @param {object} o
 * @param {string} o.trigger selector of the elements a tap toggles (a button, or a whole heading)
 * @param {string} [o.button] inside a trigger, the element carrying aria-expanded / aria-controls (default: the trigger)
 * @param {string} [o.panel] how to find the panel: 'aria-controls' (default), 'attr:<name>' (an id or selector in that
 *   attribute of the button, e.g. 'attr:data-bs-target'), 'next' (next sibling), or a selector inside `o.item`
 * @param {string} [o.item] closest container of trigger and panel, for selector panels
 * @param {'until-found' | 'hidden' | 'class'} [o.closed] how a closed panel is hidden: hidden="until-found" (default),
 *   the plain hidden attribute, or only by the site's classes (the hidden attribute is left alone)
 * @param {string} [o.openClass] class on an open panel ('show' for Bootstrap)
 * @param {string} [o.triggerClosedClass] class on a closed button ('collapsed' for Bootstrap)
 * @param {string} [o.triggerOpenClass] class on an open button
 * @param {{ selector: string, open: string, closed: string }} [o.icon] icon class swap inside the trigger
 * @param {boolean | string} [o.exclusive] one open at a time: true (within `o.group`), or the panel attribute naming
 *   the group ('data-bs-parent')
 * @param {string} [o.group] container for `exclusive: true`
 * @param {string} [o.ignore] taps inside these never toggle (an edit link inside a heading)
 */
export function init(root, o) {
  const doc = root.ownerDocument || root;
  const buttonOf = (t) => (o.button && t.querySelector(o.button)) || t;
  const byRef = (v) => {
    if (!v) return null;
    if (v.startsWith('#')) return doc.getElementById(decodeURIComponent(v.slice(1)));
    try {
      return doc.querySelector(v);
    } catch {
      return doc.getElementById(v);
    }
  };
  const panelOf = (t) => {
    const how = o.panel || 'aria-controls';
    const b = buttonOf(t);
    if (how === 'aria-controls') return doc.getElementById(b.getAttribute('aria-controls') || '');
    if (how === 'next') return t.nextElementSibling;
    if (how.startsWith('attr:')) return byRef(b.getAttribute(how.slice(5)) || '');
    const item = o.item ? t.closest(o.item) : t.parentElement;
    return item ? item.querySelector(how) : null;
  };
  const isOpen = (t) => buttonOf(t).getAttribute('aria-expanded') === 'true';
  const triggers = () => [...root.querySelectorAll(o.trigger)];

  const set = (t, open) => {
    const b = buttonOf(t);
    b.setAttribute('aria-expanded', String(open));
    if (o.triggerClosedClass) b.classList.toggle(o.triggerClosedClass, !open);
    if (o.triggerOpenClass) b.classList.toggle(o.triggerOpenClass, open);
    if (o.icon) {
      for (const i of t.querySelectorAll(o.icon.selector)) {
        i.classList.toggle(o.icon.open, open);
        i.classList.toggle(o.icon.closed, !open);
      }
    }
    const p = panelOf(t);
    if (!p) return;
    if (o.openClass) p.classList.toggle(o.openClass, open);
    const closed = o.closed || 'until-found';
    if (closed === 'until-found') {
      if (open) p.removeAttribute('hidden');
      else p.setAttribute('hidden', 'until-found');
    } else if (closed === 'hidden') {
      p.hidden = !open;
    }
  };

  const groupOf = (t) => {
    if (o.exclusive === true) {
      const g = o.group ? t.closest(o.group) : null;
      return triggers().filter((x) => (g ? g.contains(x) : true));
    }
    const p = panelOf(t);
    const key = p && p.getAttribute(String(o.exclusive));
    if (!key) return [];
    return triggers().filter((x) => panelOf(x)?.getAttribute(String(o.exclusive)) === key);
  };

  const toggle = (t, open) => {
    if (open && o.exclusive) for (const x of groupOf(t)) if (x !== t && isOpen(x)) set(x, false);
    set(t, open);
  };

  const onClick = (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const t = target.closest(o.trigger);
    if (!t || !root.contains(t)) return;
    if (o.ignore && target.closest(o.ignore)) return;
    e.preventDefault();
    toggle(t, !isOpen(t));
  };
  // Find on Page found text in a closed panel: the browser has already removed `hidden`; open its section properly.
  const onMatch = (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    for (const t of triggers()) {
      const p = panelOf(t);
      if (p && p.contains(target) && !isOpen(t)) toggle(t, true);
    }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('beforematch', onMatch, true);
  return {
    open: (t) => toggle(t, true),
    close: (t) => toggle(t, false),
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('beforematch', onMatch, true);
    },
  };
}
