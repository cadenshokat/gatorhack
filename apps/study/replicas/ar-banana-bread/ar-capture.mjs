// Capture setup shared by the two Allrecipes recipe pages (ar-banana-bread, ar-cookies). Same template, same hooks,
// same checks, so the pair carries the same page furniture: the header that gives way to the recipe's sticky utility
// bar once you scroll down, a 320x50 adhesive ad fixed at the bottom, in-content display ads, the Digioh "send this
// recipe to yourself" box, the serving-size adjuster (1/2x, 1x, 2x), the floating "Ingredients" button and its
// overlay, reviews and "You'll also love" cards. Neither page has a video player in its recipe.
//
// Each replica's capture.config.mjs calls arConfig(). Page behaviours the shared modules don't cover are in
// site/page.js (the same file in both replicas).

// Late or occasional layers removed on the live page (stateNotes say why): Digioh's full-screen pop-up
// (sidebar-overlay-lightbox, shown after some time on the page on some visits) and its dimmed backdrop.
const RANDOM = '.fb_lightbox-overlay, [id^="sidebar-overlay-lightbox"], body > [id^="lightbox-"]';

// Hosts aborted during capture: outstream video players that take over in-content ad slots on some loads only, so
// both pages carry display ads there.
const BLOCK = ['(^|\\.)primis\\.tech$', '(^|\\.)connatix\\.com$', '(^|\\.)teads\\.(tv|com)$'];

/**
 * Live page only, during capture: once every slot has filled, stop Google Publisher Tag from refreshing or replacing
 * ads, so the reference, the creative screenshots and the snapshot all show the same ads.
 */
async function freezeAds(page) {
  return page.evaluate(() => {
    const g = window.googletag;
    if (!g || typeof g.pubads !== 'function') return 'no googletag';
    const pa = g.pubads();
    const n = pa.getSlots().length;
    pa.refresh = () => {};
    g.display = () => {};
    g.destroySlots = () => false;
    return `froze ${n} GPT slots`;
  });
}

// ------------------------------------------------------------------ checks

const visible = (page, sel) => page.locator(sel).filter({ visible: true }).first();
const scrollTo = (page, y) => page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);

/** Where the recipe's own ingredients list and directions sit (page px). */
function recipeBoxes() {
  const ing = document.querySelector('.mm-recipes-structured-ingredients:not(.mm-recipes-ingredients-overlay__ingredients)').getBoundingClientRect();
  const dir = document.querySelector('.mm-recipes-steps').getBoundingClientRect();
  return { ingTop: Math.round(ing.top + scrollY), ingBottom: Math.round(ing.bottom + scrollY), dirTop: Math.round(dir.top + scrollY), dirBottom: Math.round(dir.bottom + scrollY) };
}

function barsState() {
  const h = document.querySelector('#header_1-0');
  const u = document.querySelector('#recipe-utility-nav_1-0');
  const b = document.querySelector('#mm-recipes-ingredients-overlay__button_1-0');
  return {
    headerHidden: h.classList.contains('header--hidden'),
    headerTop: Math.round(h.getBoundingClientRect().top),
    utilVisible: u.classList.contains('recipe-utility-nav--visible'),
    utilTop: Math.round(u.getBoundingClientRect().top),
    ingButton: b.classList.contains('visible-offset'),
    ingButtonOpacity: getComputedStyle(b).opacity,
  };
}

const ingredientsText = () =>
  [...document.querySelectorAll('.mm-recipes-structured-ingredients:not(.mm-recipes-ingredients-overlay__ingredients) .mm-recipes-structured-ingredients__list-item')]
    .map((li) => li.textContent.trim().replace(/\s+/g, ' '))
    .join(' | ');
const metaText = () =>
  [...document.querySelectorAll('.mm-recipes-serving-size-adjuster__meta')].map((m) => m.textContent.trim().replace(/\s+/g, ' ').replace(/^.*Note that not all recipes scale perfectly\.\s*/, '')).join(' || ');

const checks = [
  {
    name: 'menu opens and closes',
    run: async (page) => {
      await scrollTo(page, 0);
      await page.waitForTimeout(400);
      const state = () =>
        page.evaluate(() => {
          const n = document.querySelector('#header_1-0 .mntl-fullscreen-nav');
          const r = n.getBoundingClientRect();
          return { fullnav: document.querySelector('#header_1-0').classList.contains('is-fullnav'), navVisible: getComputedStyle(n).visibility, navTop: Math.round(r.top), navH: Math.round(r.height) };
        });
      await visible(page, '.mntl-header__menu-button').tap({ timeout: 8000 });
      await page.waitForTimeout(800);
      const open = await state();
      await visible(page, '.mntl-header__menu-button').tap({ timeout: 8000 });
      await page.waitForTimeout(800);
      const closed = await state();
      return { openFullnav: open.fullnav, openVisible: open.navVisible, openTop: open.navTop, openH: open.navH, closedFullnav: closed.fullnav, closedVisible: closed.navVisible };
    },
  },
  {
    name: 'scrolling: utility bar replaces the header, Ingredients button shows past the list',
    run: async (page) => {
      await scrollTo(page, 0);
      await page.waitForTimeout(500);
      const b = await page.evaluate(recipeBoxes);
      const at = async (y) => {
        await scrollTo(page, y);
        await page.waitForTimeout(700);
        return page.evaluate(barsState);
      };
      const top = await page.evaluate(barsState);
      const down = await at(400);
      const inList = await at(b.ingTop);
      const pastList = await at(b.dirTop + 100);
      const pastSteps = await at(b.dirBottom + 600);
      const up = await at(b.dirBottom + 300);
      const back = await at(0);
      const out = {};
      for (const [k, s] of Object.entries({ top, down, inList, pastList, pastSteps, up, back })) {
        out[`${k}HeaderHidden`] = s.headerHidden;
        out[`${k}HeaderTop`] = s.headerTop;
        out[`${k}UtilVisible`] = s.utilVisible;
        out[`${k}UtilTop`] = s.utilTop;
        out[`${k}IngButton`] = s.ingButton;
        out[`${k}IngButtonOpacity`] = s.ingButtonOpacity;
      }
      return out;
    },
  },
  {
    name: 'Ingredients button opens and closes the overlay',
    run: async (page) => {
      const b = await page.evaluate(recipeBoxes);
      await scrollTo(page, 0);
      await page.waitForTimeout(400);
      await scrollTo(page, b.dirTop + 100);
      await page.waitForTimeout(900);
      const state = () =>
        page.evaluate(() => {
          const o = document.querySelector('#mm-recipes-ingredients-overlay__ingredients_1-0');
          const r = o.getBoundingClientRect();
          const btn = document.querySelector('#mm-recipes-ingredients-overlay__button_1-0');
          return { hidden: o.getAttribute('aria-hidden'), expanded: btn.getAttribute('aria-expanded'), top: Math.round(r.top), h: Math.round(r.height), vis: getComputedStyle(o).visibility, text: btn.textContent.trim() };
        });
      await page.locator('#mm-recipes-ingredients-overlay__button_1-0').tap({ timeout: 8000 });
      await page.waitForTimeout(900);
      const open = await state();
      await page.locator('#mm-recipes-ingredients-overlay__button_1-0').tap({ timeout: 8000 });
      await page.waitForTimeout(900);
      const closed = await state();
      return { openHidden: open.hidden, openExpanded: open.expanded, openTop: open.top, openH: open.h, openVis: open.vis, openText: open.text, closedHidden: closed.hidden, closedExpanded: closed.expanded, closedTop: closed.top, closedVis: closed.vis, closedText: closed.text };
    },
  },
  {
    name: 'servings 2x and 1/2x rescale the ingredients',
    run: async (page) => {
      await scrollTo(page, 0);
      await page.waitForTimeout(400);
      const sel = (m) => `.mm-recipes-serving-size-adjuster:not(.mm-recipes-ingredients-overlay__ingredients *) label[for^="serving-size-${m}_"]`;
      const one = await page.evaluate(ingredientsText);
      await visible(page, sel('2x')).tap({ timeout: 8000 });
      await page.waitForTimeout(800);
      const two = await page.evaluate(ingredientsText);
      const twoMeta = await page.evaluate(metaText);
      await visible(page, sel('0.5x')).tap({ timeout: 8000 });
      await page.waitForTimeout(800);
      const half = await page.evaluate(ingredientsText);
      const halfMeta = await page.evaluate(metaText);
      await visible(page, sel('1x')).tap({ timeout: 8000 });
      await page.waitForTimeout(800);
      const back = await page.evaluate(ingredientsText);
      const backMeta = await page.evaluate(metaText);
      return { one, two, twoMeta, half, halfMeta, back, backMeta };
    },
  },
  {
    name: 'Share row, nutrition label, Jump to Nutrition Facts',
    run: async (page) => {
      await scrollTo(page, 0);
      await page.waitForTimeout(400);
      const share = () =>
        page.evaluate(() => ({
          expanded: document.querySelector('#recipe-social-share_1-0').classList.contains('mm-recipes-social-share--expanded'),
          aria: document.querySelector('#mm-recipes-social-share__share-button-1-0').getAttribute('aria-expanded'),
          firstIcon: Math.round(document.querySelector('#recipe-social-share_1-0 .share-item').getBoundingClientRect().left),
        }));
      await visible(page, '#mm-recipes-social-share__share-button-1-0').tap({ timeout: 8000 });
      await page.waitForTimeout(800);
      const sOpen = await share();
      await page.evaluate(() => document.querySelector('#mm-recipes-social-share__share-button-1-0').click());
      await page.waitForTimeout(800);
      const sClosed = await share();
      await scrollTo(page, 0);
      await page.waitForTimeout(400);
      await visible(page, '.mm-recipes-details__nutrition-link').tap({ timeout: 8000 });
      await page.waitForTimeout(1500);
      const jump = await page.evaluate(() => ({ y: Math.round(scrollY), factsTop: Math.round(document.querySelector('.mm-recipes-nutrition-facts').getBoundingClientRect().top) }));
      const label = () =>
        page.evaluate(() => {
          const b = document.querySelector('.mm-recipes-nutrition-facts-label__button');
          const box = document.querySelector('.mm-recipes-nutrition-facts');
          return { cls: b.className, h: Math.round(box.getBoundingClientRect().height) };
        });
      const l0 = await label();
      await visible(page, '.mm-recipes-nutrition-facts-label__button').tap({ timeout: 8000 });
      await page.waitForTimeout(800);
      const l1 = await label();
      return { shareOpen: sOpen.expanded, shareOpenAria: sOpen.aria, shareOpenIconLeft: sOpen.firstIcon, shareClosed: sClosed.expanded, shareClosedAria: sClosed.aria, jumpFactsTop: jump.factsTop, labelCls0: l0.cls, labelH0: l0.h, labelCls1: l1.cls, labelH1: l1.h };
    },
  },
];

/**
 * @param {{ id: string, url: string, dish: string, stateNotes?: string[], validationNotes?: string[], removed?: string[] }} o
 */
export function arConfig(o) {
  return {
    id: o.id,
    url: o.url,
    siteName: 'Allrecipes',
    sameSite: ['www.allrecipes.com', 'allrecipes.com'],
    licence:
      'Copyright Allrecipes (People Inc., formerly Dotdash Meredith); all rights reserved. Recipe text by its submitter as published by Allrecipes; photos and reviews belong to their authors. Copied for a closed, non-commercial research study (noindex, served only behind study links); not for redistribution. Ad creatives and third-party widgets belong to their owners.',
    attribution: `Allrecipes, ${o.url}. Changed: scripts removed; behaviours re-created as local scripts; ads frozen as captured; files stored locally; in the adapted condition WebAble changes the page.`,
    settleMs: 2500,
    networkIdleMs: 12000,
    blockHosts: BLOCK,
    referenceAfterScroll: true,
    stateNotes: [
      'The page after one scroll pass, back at the top: Allrecipes loads reviews, cards and in-content ads as you scroll. Live and copy are compared in this state.',
      'As a first-time visitor in the US sees it: no consent or "do not sell" notice is shown (none appeared on any load from New York time and en-US). Header at the top; the recipe utility bar (Menu, Save, Rate) takes its place once you scroll down and gives way to it again when you scroll up; the floating "Ingredients" button shows while scrolling down past the ingredients list.',
      'Ad creatives frozen as captured (screenshots in each ad iframe\'s srcdoc; the iframe src is kept); Google Publisher Tag refresh stopped once the slots had filled. Live ads refresh and rotate. The 320x50 adhesive ad stays fixed at the bottom, as live.',
      'Removed because it appears on some visits only, after some time on the page: Digioh\'s full-screen pop-up. Outstream video players (Primis, Connatix, Teads) blocked at capture so both pages carry display ads in their slots.',
      'Serving size 1x, "Keep Screen Awake" off, nutrition label collapsed, as the page loads.',
      ...(o.stateNotes ?? []),
    ],
    removed: ['Digioh full-screen pop-up (appears late, on some visits only)', 'outstream video ad players (hosts blocked at capture)', ...(o.removed ?? [])],
    behaviourNotes: ['header / utility bar on scroll', 'ad-slots (captured creatives in srcdoc)', 'menu (header and utility bar)', 'serving-size adjuster', 'ingredients overlay button', 'share row', 'nutrition label', 'jump to nutrition', 'keep screen awake toggle', 'tooltip'],
    validationNotes: [
      'Full-page pixel bands are the in-content 300x250 / 300x600 ad slots: in the live full-page screenshot, cross-origin ad frames below the first screen paint empty (only the "Advertisement" label shows), while the copy shows each slot\'s creative as it looked on screen at capture. On a phone, live shows the creative when the slot is scrolled into view.',
      '"Jump to Nutrition Facts" is compared by where the facts box lands (28 px from the top), not the scroll offset: on a fresh live load an unfilled ad slot above it can make the page shorter.',
      'Round trip: the stylesheet <link> a site script puts straight under <html> is moved to the start of <head> by fixDom (renders the same; roundtrip.mjs counts it as 1 root cause, parent html vs head).',
      ...(o.validationNotes ?? []),
    ],
    async prepare(page, h) {
      await page.evaluate((sel) => {
        const rm = () => {
          for (const e of document.querySelectorAll(sel)) e.remove();
        };
        rm();
        new MutationObserver(rm).observe(document.documentElement, { childList: true, subtree: true });
      }, RANDOM);
      // Load every lazy ad and module, let the ads fill, then freeze them; one slow pass so pending creatives paint.
      await h.scrollThrough(400, 200, 40);
      await h.sleep(5000);
      h.log(`ads: ${await freezeAds(page)}`);
      await h.scrollThrough(300, 220, 40);
      await h.sleep(3000);
    },
    // A site script appends a stylesheet <link> straight under <html>, before <head>; HTML can't say that (the parser
    // would open <head> early and the frame runtime tag would no longer come first). Move it to the start of <head>,
    // which keeps the stylesheet order (it renders the same; roundtrip.mjs reports its parent as html vs head).
    // Lazy pictures the site never loaded keep their address on allrecipes.com in data-src / data-srcset; the copy
    // shows them blank, as captured, and must not point outside (WebAble's picture reader follows data-src).
    fixDom: (root) => {
      for (const img of root.querySelectorAll('img[data-src],img[data-srcset],source[data-srcset]')) {
        for (const a of ['data-src', 'data-srcset']) {
          if (/(^|,\s*)https?:/i.test(img.getAttribute(a) ?? '')) img.removeAttribute(a);
        }
      }
      const head = root.querySelector(':scope > head');
      if (!head) return;
      const stray = [...root.children].filter((e) => e !== head && e.tagName !== 'BODY');
      head.prepend(...stray);
    },
    behaviours: [],
    checks,
  };
}
