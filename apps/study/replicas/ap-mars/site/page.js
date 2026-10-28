// AP News article behaviours the shared modules don't cover, mirroring what AP's own scripts do to the DOM (the site's
// CSS draws every state). The same file serves ap-vangogh and ap-mars. Listens on the document (delegation) so the
// engine's proxied clicks on the original elements work too; never stops propagation, never touches navigation.
//   - menu: the hamburger sets data-toggle-header on <html>, <body> and the header, and aria-expanded;
//   - caption "Read More": ReadMore-expand + data-carousel-readmore-status;
//   - floating video player (Primis): fixed bottom right while its slot is off screen, back in its slot while the
//     slot is on screen; its close button puts it back in the slot for good;
//   - Share: opens the share sheet (data-collapse-toggle state "expanded" on the button and its row); its close
//     button and its Copy / Print items (data-collapse-close) close it;
//   - accessibility button (UsableNet): the first tap expands it (its panel itself is not part of the copy).

const FLOAT = {
  position: 'fixed',
  width: '199px',
  height: '112px',
  'border-radius': '1px',
  'z-index': '2147483647',
  overflow: 'visible',
  'box-shadow': 'rgba(0, 0, 0, 0.4) 1px 1px 6px 3px',
  right: '10px',
  bottom: '10px',
  top: 'initial',
  left: 'initial',
};
const DOCK = {
  position: 'relative',
  width: '350px',
  height: '197px',
  'border-radius': '0px',
  'z-index': '0',
  overflow: 'hidden',
  'box-shadow': 'initial',
  right: 'initial',
  bottom: 'initial',
  top: 'initial',
  left: 'initial',
};

export function init(root) {
  const doc = root.ownerDocument || root;
  const off = [];

  // Menu.
  const header = doc.querySelector('bsp-header#Page-header-trending-zephr');
  const setMenu = (open) => {
    for (const el of [doc.documentElement, doc.body, header]) {
      if (!el) continue;
      if (open) el.setAttribute('data-toggle-header', 'hamburger-menu');
      else el.removeAttribute('data-toggle-header');
    }
    if (header) {
      if (open) header.setAttribute('data-toggle-zephr-header', 'hamburger-menu-zephr');
      else header.removeAttribute('data-toggle-zephr-header');
    }
    if (open) doc.body.setAttribute('top-position', '0');
    for (const b of doc.querySelectorAll('.Page-header-menu-trigger')) b.setAttribute('aria-expanded', String(open));
  };

  // Floating player.
  const native = doc.querySelector('[id^="native_playerSekindo"]');
  const holder = doc.querySelector('#placeHolder');
  const closeBox = native?.querySelector('#closeContainer');
  // Its video box and the ad slot inside it are sized in px: 199 x 112 floating, 350 x 197 in the slot.
  const sized = native ? [...native.querySelectorAll('*')].filter((e) => e instanceof HTMLElement && e.style.width === '199px' && e.style.height === '112px') : [];
  const spinner = holder?.firstElementChild;
  let floating = null;
  let closed = false;
  const setFloating = (v) => {
    if (!native || !holder || v === floating) return;
    floating = v;
    for (const [k, val] of Object.entries(v ? FLOAT : DOCK)) native.style.setProperty(k, val);
    holder.style.setProperty('position', v ? 'relative' : 'absolute');
    if (spinner) spinner.style.setProperty('display', v ? 'block' : 'none');
    if (closeBox) closeBox.style.setProperty('display', v ? 'block' : 'none');
    for (const e of sized) {
      e.style.setProperty('width', v ? '199px' : '350px');
      e.style.setProperty('height', v ? '112px' : '197px');
    }
  };
  let raf = 0;
  const check = () => {
    raf = 0;
    if (!holder || closed) return;
    const r = holder.getBoundingClientRect();
    setFloating(!(r.bottom > 0 && r.top < window.innerHeight));
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(check);
  };
  if (native && holder) {
    floating = getComputedStyle(native).position === 'fixed';
    window.addEventListener('scroll', onScroll, { passive: true });
    off.push(() => window.removeEventListener('scroll', onScroll));
    check();
  }

  // Lead gallery: the shared carousel module moves the slides; like flickity, disable "previous" on the first slide
  // and "next" on the last.
  for (const c of doc.querySelectorAll('bsp-carousel.Carousel')) {
    const slides = [...c.querySelectorAll('.Carousel-slide')];
    const prev = c.querySelector('.CarouselControls-nav--prev button');
    const next = c.querySelector('.CarouselControls-nav--next button');
    if (!slides.length || !prev || !next) continue;
    const sync = () => {
      const i = slides.findIndex((s) => s.classList.contains('is-selected'));
      prev.disabled = i <= 0;
      next.disabled = i >= slides.length - 1;
    };
    const mo = new MutationObserver(sync);
    for (const s of slides) mo.observe(s, { attributes: true, attributeFilter: ['class'] });
    off.push(() => mo.disconnect());
  }

  const onClick = (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const menu = t.closest('.Page-header-menu-trigger');
    if (menu) {
      setMenu(menu.getAttribute('aria-expanded') !== 'true');
      return;
    }
    const share = t.closest('button[data-action-clicked="clickShareIcon"]');
    const shut = t.closest('bsp-page-actions [data-collapse-close]');
    if (share || shut) {
      const actions = (share || shut).closest('bsp-page-actions');
      const state = share ? 'expanded' : 'collapsed';
      for (const el of actions ? actions.querySelectorAll('[data-collapse-toggle]') : []) {
        el.setAttribute('data-collapse-toggle', JSON.stringify({ collapsed: true, selGroup: false, active: true, state }));
      }
      return;
    }
    const more = t.closest('.ReadMore-more-button, .ReadMore-less-button');
    if (more) {
      const box = more.closest('bsp-carousel-read-more');
      if (!box) return;
      const open = box.getAttribute('data-carousel-readmore-status') !== 'isexpanded';
      box.classList.toggle(box.getAttribute('data-expand') || 'ReadMore-expand', open);
      box.setAttribute('data-carousel-readmore-status', open ? 'isexpanded' : 'unexpanded');
      return;
    }
    if (native && !closed && t.closest('#closeIconHit, #closeIcon') && native.contains(t)) {
      closed = true;
      setFloating(false);
      return;
    }
    const a11y = t.closest('#usntA40Toggle');
    if (a11y && !a11y.classList.contains('usntA40Expanded')) {
      e.preventDefault();
      a11y.classList.add('usntA40Touch', 'usntA40Expanded');
    }
  };
  doc.addEventListener('click', onClick);
  off.push(() => doc.removeEventListener('click', onClick));

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      for (const f of off) f();
    },
  };
}
