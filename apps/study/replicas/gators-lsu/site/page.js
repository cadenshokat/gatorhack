// floridagators.com "Opponent History" (Sidearm on Nuxt/Vue): what the site's own scripts did, re-created for the
// frozen copy. Each change mirrors the live page's DOM change (classes, ARIA, tabindex, inserted markup), so the
// site's CSS draws every state. Markup that only exists after a tap was recorded at capture as inert
// <template data-g="…"> elements in <head> (replicas/gators-ky/gators.capture.mjs).
// No globals, storage, history changes or random timing. Links are never intercepted here.
// gators-ky/site/page.js and gators-lsu/site/page.js are the same file.

const ICON = /#icon-[\w-]+$/;

/** Points an svg <use> at another icon of the same sprite and swaps the svg's s-icon-* class. */
function swapIcon(svg, from, to) {
  if (!svg) return;
  svg.classList.replace(`s-icon-${from}`, `s-icon-${to}`);
  const use = svg.querySelector('use');
  for (const a of ['href', 'xlink:href']) {
    const v = use?.getAttribute(a);
    if (v && ICON.test(v)) use.setAttribute(a, v.replace(ICON, `#icon-${to}`));
  }
}

/** Elements recorded as <div data-g-tag="p"> because HTML can't nest them (a <p> inside a <p>) become real again. */
function retag(root) {
  for (const d of [...root.querySelectorAll('[data-g-tag]')]) {
    const el = d.ownerDocument.createElement(d.getAttribute('data-g-tag'));
    for (const a of [...d.attributes]) if (a.name !== 'data-g-tag') el.setAttribute(a.name, a.value);
    el.append(...d.childNodes);
    d.replaceWith(el);
  }
}

export function init(root) {
  const doc = root.ownerDocument || root;
  const templates = (kind) => [...doc.querySelectorAll(`template[data-g="${kind}"]`)];
  const byKey = (kind) => new Map(templates(kind).map((t) => [t.getAttribute('data-key'), t]));
  const clone = (t) => (t ? t.content.cloneNode(true) : null);

  // 1. Elements the live page keeps after <body> (the cookie notice's host, a hidden ad iframe) go back there.
  for (const el of [...doc.querySelectorAll('[data-g-after-body]')]) {
    el.removeAttribute('data-g-after-body');
    doc.documentElement.append(el);
  }

  const handles = [consent(doc, byKey('consent')), menus(doc, templates), calendar(doc, byKey('list')), links(doc, byKey('links')), tables(doc), videos(doc, templates('video'), clone), ads(doc)];
  return {
    destroy() {
      for (const h of handles) h.destroy();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Cookie notice (Transcend)                                           */
/* ------------------------------------------------------------------ */

function consent(doc, views) {
  const host = doc.getElementById('transcend-consent-manager');
  const sr = host?.shadowRoot;
  if (!sr) return { destroy() {} };
  retag(sr);
  const region = sr.querySelector('#consentManagerMainDialog') || sr.querySelector('.modal-container');
  const footer = () => [...doc.querySelectorAll('button.s-common-footer__links-link--transcend')];
  let view = region?.querySelector('.modal-container-inner') ? 'notice' : null;
  let back = 'notice';

  const show = (name) => {
    const t = views.get(name);
    if (!region || !t) return;
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', 'cookie consent banner');
    region.setAttribute('class', 'modal-container');
    region.setAttribute('id', 'consentManagerMainDialog');
    const inner = t.content.cloneNode(true);
    retag(inner);
    region.querySelector('.modal-container-inner')?.remove();
    region.append(inner);
    view = name;
    for (const b of footer()) b.setAttribute('aria-expanded', String(name !== 'notice'));
    focusFirst();
  };
  // Transcend moves focus to the element marked data-initialfocus whenever it draws a view.
  const focusFirst = () => sr.querySelector('[data-initialfocus="true"]')?.focus({ preventScroll: true });
  // As the live notice does when closed: its content goes and the region loses its role and name.
  const close = () => {
    if (!region) return;
    region.querySelector('.modal-container-inner')?.remove();
    region.setAttribute('role', '');
    region.removeAttribute('aria-label');
    region.removeAttribute('class');
    region.setAttribute('id', '');
    view = null;
    for (const b of footer()) b.setAttribute('aria-expanded', 'false');
  };

  const onShadowClick = (e) => {
    const b = e.target instanceof Element ? e.target.closest('button') : null;
    if (!b) return;
    if (b.matches('.privacy-policy-notice-with-close-button-close, .accept-all-reject-all-toggle-close')) close();
    else if (b.matches('.language-button')) {
      if (view === 'language' || view === 'dnsLanguage') show(back);
      else {
        back = view || 'notice';
        show(back === 'dns' ? 'dnsLanguage' : 'language');
      }
    } else if (b.closest('.language-options-container') || b.getAttribute('aria-label') === 'Go back') {
      // Choosing a language returns to the notice (still in English: the translations are not part of the copy).
      show(back);
    }
  };
  const onDocClick = (e) => {
    const b = e.target instanceof Element ? e.target.closest('button.s-common-footer__links-link--transcend') : null;
    if (!b) return;
    back = 'dns';
    show('dns');
  };
  sr.addEventListener('click', onShadowClick);
  doc.addEventListener('click', onDocClick);
  if (view) focusFirst();
  return {
    destroy() {
      sr.removeEventListener('click', onShadowClick);
      doc.removeEventListener('click', onDocClick);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Header menus: main menu, calendar, "More +" sport menu               */
/* ------------------------------------------------------------------ */

function menus(doc, templates) {
  const moreOpen = templates('more-open')[0];
  const moreClosed = templates('more-closed')[0];
  const panels = [
    {
      toggle: doc.getElementById('c-navigation__toggle-main-mobile'),
      panel: doc.getElementById('main-nav-mobile-offcanvas'),
      icon: 'menu',
      focusables: '.c-navigation__url--level-1, input, .c-navigation__close-trigger',
    },
    {
      // The calendar panel is shown and hidden with an inline display (Vue's v-show), not a class.
      toggle: doc.getElementById('s-events__toggle-main-mobile'),
      panel: doc.getElementById('s-events__toggle-main-mobile')?.parentElement ?? null,
      icon: 'calendar',
      focusables: '.s-events__close-trigger',
      shown: '.s-events__offcanvas',
    },
    {
      toggle: doc.getElementById('c-navigation__toggle-sport-mobile'),
      panel: doc.getElementById("'mobile-sportnav-offcanvas'") || doc.getElementById('mobile-sportnav-offcanvas'),
      focusables: '.c-navigation__url--level-1, .c-navigation__close-trigger',
      label: true,
    },
  ].filter((p) => p.toggle && p.panel);

  const set = (p, open) => {
    if (open === (p.toggle.getAttribute('aria-expanded') === 'true')) return;
    p.toggle.classList.toggle('is-toggled', open);
    p.toggle.setAttribute('aria-expanded', String(open));
    if (p.icon) swapIcon(p.toggle.querySelector('svg'), open ? p.icon : 'close', open ? 'close' : p.icon);
    if (p.label && moreOpen && moreClosed) p.toggle.replaceChildren((open ? moreOpen : moreClosed).content.cloneNode(true));
    if (p.shown) {
      const el = p.panel.querySelector(p.shown);
      if (el) el.style.display = open ? '' : 'none';
    } else p.panel.classList.toggle('is-open', open);
    for (const f of p.panel.querySelectorAll(p.focusables)) f.setAttribute('tabindex', open ? '0' : '-1');
    if (!open && p.onClose) p.onClose();
  };

  const onClick = (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const p = panels.find((x) => x.toggle.contains(t));
    if (p) {
      const open = p.toggle.getAttribute('aria-expanded') !== 'true';
      // One header panel at a time, as live.
      if (open) for (const o of panels) if (o !== p) set(o, false);
      set(p, open);
      return;
    }
    // Second level: Sports, Tickets… in the main menu; Facilities, Additional Links in the sport menu.
    const b = t.closest('button.c-navigation__url--level-1[aria-controls]');
    if (b) {
      const open = b.getAttribute('aria-expanded') !== 'true';
      // One open at a time within a menu, as live.
      if (open) {
        const menu = panels.find((x) => x.panel.contains(b))?.panel;
        for (const o of menu ? menu.querySelectorAll('button.c-navigation__url--level-1[aria-expanded="true"]') : []) setLevel(o, false);
      }
      setLevel(b, open);
    }
  };
  const setLevel = (b, open) => {
    const target = doc.getElementById(b.getAttribute('aria-controls'));
    b.classList.toggle('is-open', open);
    b.setAttribute('aria-expanded', String(open));
    if (target) {
      target.classList.toggle('is-open', open);
      for (const a of target.querySelectorAll('a, button')) a.setAttribute('tabindex', open ? '0' : '-1');
      // The submenu's sponsor slot is shown with it (empty, as the menu ads were at capture).
      for (const ad of target.querySelectorAll('.s-advert')) ad.style.display = open ? '' : 'none';
    }
    const li = b.closest('li.c-navigation__parent');
    if (li) li.classList.toggle('is-open', open);
  };
  doc.addEventListener('click', onClick);
  const cal = panels.find((p) => p.icon === 'calendar');
  if (cal) cal.onClose = () => closeEventToggles(doc);
  return { destroy: () => doc.removeEventListener('click', onClick) };
}

/** Closes every open event's media overlay in the calendar. */
function closeEventToggles(doc) {
  for (const b of doc.querySelectorAll('.c-events__toggle[aria-expanded="true"]')) setEventToggle(doc, b, false);
}

function setEventToggle(doc, b, open) {
  b.classList.toggle('is-toggled', open);
  b.setAttribute('aria-expanded', String(open));
  const o = doc.getElementById(b.getAttribute('aria-controls'));
  if (o) {
    o.classList.toggle('is-open', open);
    for (const a of o.querySelectorAll('a')) a.setAttribute('tabindex', open ? '0' : '-1');
  }
}

/* ------------------------------------------------------------------ */
/* Calendar: Upcoming / Results tabs, sport filter, event overlays      */
/* ------------------------------------------------------------------ */

function calendar(doc, lists) {
  const tabset = doc.getElementById('schedule-offcanvas-tabset');
  if (!tabset) return { destroy() {} };
  const onClick = (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t || !tabset.contains(t)) return;
    const tab = t.closest('[role="tab"]');
    if (tab) {
      for (const x of tabset.querySelectorAll('[role="tab"]')) {
        const on = x === tab;
        x.classList.toggle('s-tab--selected', on);
        x.setAttribute('aria-selected', String(on));
        x.setAttribute('tabindex', on ? '0' : '-1');
        const panel = doc.getElementById(x.getAttribute('aria-controls'));
        if (panel) {
          panel.classList.toggle('s-tab-item--selected', on);
          if (on) panel.style.removeProperty('display');
          else panel.style.setProperty('display', 'none');
        }
      }
      return;
    }
    const tg = t.closest('.c-events__toggle[aria-controls]');
    if (tg) {
      const open = tg.getAttribute('aria-expanded') !== 'true';
      if (open) closeEventToggles(doc);
      setEventToggle(doc, tg, open);
    }
  };
  // The sport filter: the site fetches that sport's events; the copy shows the list recorded for it.
  const onChange = (e) => {
    const sel = e.target;
    if (!(sel instanceof HTMLSelectElement) || !tabset.contains(sel)) return;
    const t = lists.get(`${sel.id}|${sel.value}`);
    const filter = sel.closest('[class*="__filter"]:not(select)');
    if (!t || !filter) return;
    const list = filter.parentElement;
    for (const c of [...list.children]) if (c !== filter) c.remove();
    list.append(t.content.cloneNode(true));
    const label = t.getAttribute('data-label');
    if (label) sel.setAttribute('aria-label', label);
  };
  doc.addEventListener('click', onClick);
  doc.addEventListener('change', onChange);
  return {
    destroy() {
      doc.removeEventListener('click', onClick);
      doc.removeEventListener('change', onChange);
    },
  };
}

/* ------------------------------------------------------------------ */
/* "Links" dropdowns in the results table (v-popper)                    */
/* ------------------------------------------------------------------ */

function links(doc, menus) {
  let open = null; // { btn, vp, pop }
  const PAD = 0; // the menu stays inside the table's scroll box
  const GAP = 10; // distance from the button (room for the arrow)

  /** The menu's containing block: its nearest positioned ancestor (offsetParent would stop at the table cell). */
  const containerOf = (el) => {
    for (let e = el.parentElement; e; e = e.parentElement) if (getComputedStyle(e).position !== 'static') return e;
    return doc.documentElement;
  };
  const place = (o) => {
    const { btn, pop } = o;
    const box = containerOf(pop);
    const br = btn.getBoundingClientRect();
    const or = box.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const cx = br.left + br.width / 2 - or.left - box.clientLeft + box.scrollLeft;
    let x = cx - w / 2;
    x = Math.max(box.scrollLeft + PAD, Math.min(x, box.scrollLeft + box.clientWidth - w - PAD));
    const below = br.bottom - or.top - box.clientTop + box.scrollTop + GAP;
    const above = br.top - or.top - box.clientTop + box.scrollTop - GAP - h;
    const flip = below + h > box.scrollHeight && above >= 0;
    pop.setAttribute('data-popper-placement', flip ? 'top' : 'bottom');
    pop.style.cssText = `position: absolute; transform: translate3d(${Math.round(x)}px, ${Math.round(flip ? above : below)}px, 0px);`;
    const arrow = pop.querySelector('.v-popper__arrow-container');
    if (arrow) arrow.style.left = `${Math.round((cx - x - 10) * 1000) / 1000}px`;
  };

  const close = () => {
    if (!open) return;
    open.pop.remove();
    open.vp.classList.remove('v-popper--shown');
    swapIcon(open.btn.querySelector('svg'), 'chevron-up', 'chevron-down');
    open = null;
  };

  const onClick = (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const btn = t.closest('.s-dropdown__button button');
    if (open && open.pop.contains(t)) return;
    if (!btn) {
      close();
      return;
    }
    const was = open && open.btn === btn;
    close();
    if (was) return;
    const tpl = menus.get(btn.getAttribute('aria-label'));
    const vp = btn.closest('.v-popper');
    if (!tpl || !vp) return;
    const frag = tpl.content.cloneNode(true);
    const pop = frag.firstElementChild;
    vp.append(frag);
    vp.classList.add('v-popper--shown');
    swapIcon(btn.querySelector('svg'), 'chevron-down', 'chevron-up');
    open = { btn, vp, pop };
    place(open);
  };
  const onResize = () => open && place(open);
  doc.addEventListener('click', onClick);
  window.addEventListener('resize', onResize);
  return {
    destroy() {
      doc.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Tables that scroll sideways: edge shadows follow the scroll          */
/* ------------------------------------------------------------------ */

function tables(doc) {
  const wraps = [...doc.querySelectorAll('.s-table > .s-table__wrapper')];
  const update = (w) => {
    const t = w.parentElement;
    t.classList.toggle('scroll-left', w.scrollLeft > 0);
    t.classList.toggle('scroll-right', w.scrollLeft + w.clientWidth < w.scrollWidth - 1);
  };
  const onScroll = (e) => update(e.currentTarget);
  const onResize = () => wraps.forEach(update);
  for (const w of wraps) w.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  return {
    destroy() {
      for (const w of wraps) w.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    },
  };
}

/* ------------------------------------------------------------------ */
/* "Related Videos": the player pop-up (its player is a picture)        */
/* ------------------------------------------------------------------ */

function videos(doc, list, clone) {
  const grid = doc.querySelector('.s-videos__content-grid');
  if (!grid || !list.length) return { destroy() {} };
  let modal = null;
  const close = () => {
    modal?.remove();
    modal = null;
  };
  const onClick = (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    if (modal) {
      if (t.closest('[data-test-id="s-base-modal__close-button-control"]') || !t.closest('.s-base-modal__wrapper')) close();
      return;
    }
    const b = t.closest('button');
    const card = b && grid.contains(b) ? b.closest('.s-card') : null;
    if (!card) return;
    const i = [...grid.querySelectorAll('.s-card')].indexOf(card);
    const tpl = list.find((x) => x.getAttribute('data-key') === String(i));
    if (!tpl) return;
    const frag = clone(tpl);
    modal = frag.firstElementChild;
    for (const f of modal.querySelectorAll('iframe[data-g-shot]')) {
      f.srcdoc = `<!doctype html><html><head><style>html,body{margin:0;padding:0;overflow:hidden;background:#000}img{display:block;width:100%;height:100%;object-fit:cover}</style></head><body><img src="${f.getAttribute('data-g-shot')}" alt=""></body></html>`;
    }
    doc.body.append(frag);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  doc.addEventListener('click', onClick);
  doc.addEventListener('keydown', onKey);
  return {
    destroy() {
      doc.removeEventListener('click', onClick);
      doc.removeEventListener('keydown', onKey);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Ads in the table: "Hide advertisement"                              */
/* ------------------------------------------------------------------ */

function ads(doc) {
  const onClick = (e) => {
    const b = e.target instanceof Element ? e.target.closest('.s-advert__hide-btn') : null;
    if (!b) return;
    b.setAttribute('aria-pressed', 'true');
    b.closest('.s-advert')?.style.setProperty('display', 'none');
    b.remove();
  };
  doc.addEventListener('click', onClick);
  return { destroy: () => doc.removeEventListener('click', onClick) };
}
