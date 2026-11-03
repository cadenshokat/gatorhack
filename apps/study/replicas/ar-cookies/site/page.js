// Allrecipes recipe-page behaviours, mirroring what the site's own scripts do to the DOM (the site's CSS draws every
// state). The same file serves ar-banana-bread and ar-cookies. Listens on the document (delegation) so the engine's
// proxied clicks on the original elements work too; never stops propagation, never touches navigation.
//   - scrolling down past the header hides it (header--hidden) and shows the recipe utility bar
//     (recipe-utility-nav--visible); any scroll up brings the header back and hides the bar;
//   - the floating "Ingredients" button (visible-offset) shows while scrolling down from just past the ingredients
//     list to the middle of the directions; it opens and closes the ingredients overlay (is-active, aria-hidden,
//     aria-expanded, its label "Close");
//   - menus: the header's menu button toggles is-fullnav on the header; the utility bar's menu button toggles
//     fullscreen-nav-expanded, aria-expanded and the nav's aria-hidden;
//   - serving size 1/2x, 1x, 2x (radio inputs): every ingredient quantity is rescaled and written as the site writes it
//     ("1 ⅓", "¼"), units turn plural above 1 (cup/cups), the originals kept in data-original-quantity/-unit; both
//     adjusters (page and overlay) stay in step;
//   - the servings tooltip, "Keep Screen Awake", the Share row (expands once), the nutrition label, and "Jump to
//     Nutrition Facts" (the facts box ends 28 px below the top of the screen).

const FRACS = { '⅛': 1 / 8, '¼': 1 / 4, '⅓': 1 / 3, '⅜': 3 / 8, '½': 1 / 2, '⅝': 5 / 8, '⅔': 2 / 3, '¾': 3 / 4, '⅞': 7 / 8 };
const OUT = [
  [0, ''],
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
  [1, ''],
];
const PLURAL = {
  cup: 'cups',
  teaspoon: 'teaspoons',
  tablespoon: 'tablespoons',
  ounce: 'ounces',
  pound: 'pounds',
  quart: 'quarts',
  pint: 'pints',
  pinch: 'pinches',
  dash: 'dashes',
  clove: 'cloves',
  can: 'cans',
  package: 'packages',
  slice: 'slices',
  stick: 'sticks',
};
const SINGULAR = Object.fromEntries(Object.entries(PLURAL).map(([s, p]) => [p, s]));

/** "2", "½", "2 ½", "1/2", "1 1/2" -> number, or null. */
function parseQty(s) {
  const t = s.trim();
  if (!t) return null;
  let total = 0;
  let any = false;
  for (const part of t.split(/\s+/)) {
    let m;
    if (FRACS[part] !== undefined) total += FRACS[part];
    else if ((m = /^(\d+)([⅛¼⅓⅜½⅝⅔¾⅞])$/.exec(part))) total += Number(m[1]) + FRACS[m[2]];
    else if ((m = /^(\d+)\/(\d+)$/.exec(part))) total += Number(m[1]) / Number(m[2]);
    else if (/^\d+(\.\d+)?$/.test(part)) total += Number(part);
    else return null;
    any = true;
  }
  return any ? total : null;
}

function formatQty(v) {
  let whole = Math.floor(v + 1e-9);
  const rest = v - whole;
  let best = OUT[0];
  for (const o of OUT) if (Math.abs(o[0] - rest) < Math.abs(best[0] - rest)) best = o;
  if (best[0] === 1) {
    whole += 1;
    best = OUT[0];
  }
  if (!whole) return best[1] || '0';
  return best[1] ? `${whole} ${best[1]}` : String(whole);
}

/** "2 to 3", "2-3" and single amounts. */
function scaleText(text, f) {
  const parts = text.split(/(\s+to\s+|\s*-\s*)/);
  const out = [];
  let value = null;
  for (let i = 0; i < parts.length; i++) {
    if (i % 2) {
      out.push(parts[i]);
      continue;
    }
    const q = parseQty(parts[i]);
    if (q === null) return { text, value: null };
    value = q * f;
    out.push(formatQty(value));
  }
  return { text: out.join(''), value };
}

export function init(root) {
  const doc = root.ownerDocument || root;
  const off = [];
  const header = doc.querySelector('#header_1-0');
  const util = doc.querySelector('#recipe-utility-nav_1-0');
  const ovWrap = doc.querySelector('#mm-recipes-ingredients-overlay_1-0');
  const ovDialog = doc.querySelector('#mm-recipes-ingredients-overlay__ingredients_1-0');
  const ovButton = doc.querySelector('#mm-recipes-ingredients-overlay__button_1-0');
  const ovText = doc.querySelector('#mm-recipes-ingredients-overlay__button-text_1-0');
  const ingList = doc.querySelector('.mm-recipes-structured-ingredients:not(.mm-recipes-ingredients-overlay__ingredients)');
  const steps = doc.querySelector('.mm-recipes-steps');
  const absBottom = (e) => (e ? e.getBoundingClientRect().bottom + window.scrollY : 0);

  // Header / utility bar / Ingredients button from scroll position and direction.
  let lastY = window.scrollY;
  let upFrom = null;
  let overlayOpen = false;
  let raf = 0;
  const onFrame = () => {
    raf = 0;
    const y = window.scrollY;
    const prev = lastY;
    const down = y > prev;
    const up = y < prev;
    lastY = y;
    if (down) upFrom = null;
    else if (up && upFrom === null) upFrom = prev;
    if (down && y > 60) {
      header?.classList.add('header--hidden');
      util?.classList.add('recipe-utility-nav--visible');
    } else if (y <= 60 || (up && upFrom - y >= 570)) {
      // The header comes back near the top, or after scrolling up about 570 px.
      header?.classList.remove('header--hidden');
      util?.classList.remove('recipe-utility-nav--visible');
    }
    if (ovButton && !overlayOpen) {
      const inRange = y >= absBottom(ingList) - 300 && y < absBottom(steps) - 422;
      if (down) ovButton.classList.toggle('visible-offset', inRange);
      else if (up) ovButton.classList.remove('visible-offset');
    }
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(onFrame);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  off.push(() => window.removeEventListener('scroll', onScroll));

  const setOverlay = (open) => {
    if (!ovWrap || !ovDialog || !ovButton) return;
    overlayOpen = open;
    ovWrap.classList.toggle('is-active', open);
    ovDialog.setAttribute('aria-hidden', String(!open));
    ovButton.setAttribute('aria-expanded', String(open));
    if (ovText) ovText.textContent = open ? 'Close' : 'Ingredients';
    if (open) ovButton.classList.add('visible-offset');
  };

  // Serving size.
  const rescale = (f) => {
    for (const q of doc.querySelectorAll('[data-ingredient-quantity]')) {
      const li = q.parentElement;
      const u = li?.querySelector('[data-ingredient-unit]');
      if (!q.hasAttribute('data-original-quantity')) q.setAttribute('data-original-quantity', q.textContent);
      if (u && !u.hasAttribute('data-original-unit')) u.setAttribute('data-original-unit', u.textContent);
      const origQ = q.getAttribute('data-original-quantity');
      const origU = u ? u.getAttribute('data-original-unit') : '';
      if (f === 1) {
        q.textContent = origQ;
        if (u) u.textContent = origU;
        continue;
      }
      const s = scaleText(origQ, f);
      q.textContent = s.text;
      if (u && s.value !== null) {
        const key = origU.trim();
        const sing = SINGULAR[key] ?? (PLURAL[key] ? key : null);
        if (sing) u.textContent = s.value > 1 ? PLURAL[sing] : sing;
      }
    }
  };
  const onChange = (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.classList.contains('mm-recipes-serving-size-adjuster__input')) return;
    const f = Number(t.value) || 1;
    for (const r of doc.querySelectorAll('.mm-recipes-serving-size-adjuster__input')) r.checked = Number(r.value) === f;
    rescale(f);
  };
  doc.addEventListener('change', onChange);
  off.push(() => doc.removeEventListener('change', onChange));

  const onClick = (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('.mntl-header__menu-button')) {
      header?.classList.toggle('is-fullnav');
      return;
    }
    const um = t.closest('#mm-recipes-utility-nav__menu-button_1-0');
    if (um) {
      const open = um.getAttribute('aria-expanded') !== 'true';
      um.setAttribute('aria-expanded', String(open));
      util?.classList.toggle('fullscreen-nav-expanded', open);
      doc.querySelector('#mm-recipes-utility-nav__fullscreen-nav_1-0')?.setAttribute('aria-hidden', String(!open));
      return;
    }
    if (ovButton && t.closest('#mm-recipes-ingredients-overlay__button_1-0')) {
      setOverlay(!overlayOpen);
      return;
    }
    const tip = t.closest('.mm-recipes-serving-size-adjuster__meta-icon');
    if (tip) {
      const open = tip.getAttribute('aria-expanded') !== 'true';
      tip.setAttribute('aria-expanded', String(open));
      const box = doc.getElementById(tip.getAttribute('aria-controls'));
      if (open) for (const other of doc.querySelectorAll('.mm-recipes-serving-size-adjuster__tooltip')) if (other !== box) other.style.display = 'none';
      if (box) box.style.display = open ? 'block' : 'none';
      return;
    }
    const wake = t.closest('.mm-recipes-screen-wake__button');
    if (wake) {
      const on = wake.getAttribute('aria-pressed') !== 'true';
      for (const b of doc.querySelectorAll('.mm-recipes-screen-wake__button')) b.setAttribute('aria-pressed', String(on));
      for (const w of doc.querySelectorAll('.mm-recipes-screen-wake')) w.setAttribute('data-screen-wake-locked', String(on));
      return;
    }
    const share = t.closest('.mm-recipes-social-share__share-button');
    if (share) {
      share.setAttribute('aria-expanded', 'true');
      share.closest('.mm-recipes-social-share')?.classList.add('mm-recipes-social-share--expanded');
      // Like the site, bring the share icons into view: once the row has widened (a CSS transition), it scrolls
      // sideways to its end (fixed delays).
      const row = share.closest('.mm-recipes-social-share');
      if (row) {
        for (const ms of [400, 700]) {
          const t = setTimeout(() => (row.scrollLeft = row.scrollWidth), ms);
          off.push(() => clearTimeout(t));
        }
      }
      return;
    }
    const label = t.closest('.mm-recipes-nutrition-facts-label__button');
    if (label) {
      const show = label.classList.contains('mm-recipes-nutrition-facts-label__button--show');
      label.classList.remove('mm-recipes-nutrition-facts-label__button--show', 'mm-recipes-nutrition-facts-label__button--hide');
      label.classList.add(show ? 'mm-recipes-nutrition-facts-label__button--hide' : 'mm-recipes-nutrition-facts-label__button--show');
      (label.closest('.mm-recipes-nutrition-facts-label') ?? doc).querySelector('.mm-recipes-nutrition-facts-label__wrapper')?.classList.toggle('mm-recipes-nutrition-facts-label__wrapper--collapsed', !show);
      return;
    }
    if (t.closest('.mm-recipes-details__nutrition-link')) {
      const facts = doc.querySelector('.mm-recipes-nutrition-facts');
      if (facts) window.scrollTo({ top: facts.getBoundingClientRect().top + window.scrollY - 28, behavior: 'instant' });
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
