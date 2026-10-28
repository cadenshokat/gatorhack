// Carousel / slider. Previous and next buttons, dots and a horizontal swipe move between slides. Autoplay, when the
// live page has it, runs on a fixed interval and stops for good at the first touch.

/**
 * @param {Document | Element} root
 * @param {object} o
 * @param {string} o.carousel selector of each carousel's outer element
 * @param {string} o.slide selector of the slides, inside the carousel
 * @param {string} [o.track] selector of the element that moves (mode 'transform') or scrolls (mode 'scroll')
 * @param {'transform' | 'class' | 'scroll'} [o.mode] how a slide is shown: translate the track (default), toggle
 *   `activeClass` on slides (the site's CSS hides the others), or scroll a scroll-snap track
 * @param {string} [o.prev] selector of the previous button
 * @param {string} [o.next] selector of the next button
 * @param {string} [o.dot] selector of dot buttons, in slide order
 * @param {string} [o.activeClass] class on the current slide and dot (default 'is-active')
 * @param {number} [o.start] index shown at load (default: the slide that has activeClass, else 0)
 * @param {boolean} [o.loop] wrap around at the ends (default true)
 * @param {number} [o.autoplayMs] advance every N ms until the first interaction (0: off)
 * @param {boolean} [o.swipe] horizontal swipe on the carousel (default true; mode 'scroll' swipes natively)
 */
export function init(root, o) {
  const handles = [...root.querySelectorAll(o.carousel)].map((c) => one(c, o));
  return {
    destroy() {
      for (const h of handles) h.destroy();
    },
  };
}

function one(c, o) {
  const mode = o.mode || 'transform';
  const active = o.activeClass || 'is-active';
  const slides = [...c.querySelectorAll(o.slide)];
  const track = o.track ? c.querySelector(o.track) : slides[0]?.parentElement;
  const dots = o.dot ? [...c.querySelectorAll(o.dot)] : [];
  if (!slides.length || !track) return { destroy() {} };
  let index = o.start ?? Math.max(0, slides.findIndex((s) => s.classList.contains(active)));
  let timer = 0;

  const go = (i) => {
    const n = slides.length;
    index = o.loop === false ? Math.max(0, Math.min(n - 1, i)) : ((i % n) + n) % n;
    const x = slides[index].offsetLeft - slides[0].offsetLeft;
    if (mode === 'transform') track.style.transform = `translate3d(${-x}px, 0, 0)`;
    else if (mode === 'scroll') track.scrollTo({ left: x, behavior: 'smooth' });
    slides.forEach((s, k) => {
      s.classList.toggle(active, k === index);
      s.setAttribute('aria-hidden', String(k !== index));
    });
    dots.forEach((d, k) => {
      d.classList.toggle(active, k === index);
      if (d.hasAttribute('aria-selected')) d.setAttribute('aria-selected', String(k === index));
      if (d.hasAttribute('aria-current')) d.setAttribute('aria-current', String(k === index));
    });
  };
  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = 0;
  };
  const onClick = (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (o.prev && t.closest(o.prev)) {
      e.preventDefault();
      stop();
      go(index - 1);
    } else if (o.next && t.closest(o.next)) {
      e.preventDefault();
      stop();
      go(index + 1);
    } else if (o.dot) {
      const d = t.closest(o.dot);
      const k = d ? dots.indexOf(d) : -1;
      if (k >= 0) {
        e.preventDefault();
        stop();
        go(k);
      }
    }
  };
  let startX = null;
  let startY = 0;
  const onDown = (e) => {
    startX = e.clientX;
    startY = e.clientY;
  };
  const onUp = (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      stop();
      go(index + (dx < 0 ? 1 : -1));
    }
  };
  c.addEventListener('click', onClick);
  const swipe = o.swipe !== false && mode !== 'scroll';
  if (swipe) {
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointerup', onUp);
  }
  if (mode !== 'scroll') go(index);
  if (o.autoplayMs && o.autoplayMs > 0) timer = window.setInterval(() => go(index + 1), o.autoplayMs);
  return {
    destroy() {
      stop();
      c.removeEventListener('click', onClick);
      if (swipe) {
        c.removeEventListener('pointerdown', onDown);
        c.removeEventListener('pointerup', onUp);
      }
    },
  };
}
