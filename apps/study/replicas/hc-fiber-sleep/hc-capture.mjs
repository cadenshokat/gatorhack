// Capture setup shared by the two Health.com news articles (hc-fiber-sleep, hc-yoga): same People Inc. (Dotdash
// Meredith) "healthdotcom-article--sc" article template as People's (people-article--sc), same hooks, same checks, so
// the pair carries the same page furniture: the fixed header (menu, Health logo, search), the byline with "Fact checked
// by", the "Add Us On Google" button, the green "AT A GLANCE" summary box, in-content display ads between paragraphs,
// the 320x50 adhesive ad fixed at the bottom, the Sources list, and the recirculation lists after the article.
// Adapted from ../pp-millie/pp-capture.mjs (the People setup).
//
// Each replica's capture.config.mjs calls hcConfig(). Page behaviours the shared modules don't cover are in
// site/page.js (the same file in both replicas).

// Late or occasional layers removed on the live page (stateNotes say why), the same list as People's: Flashtalking's
// full-screen interstitial ad (ftdiv/ftframe), Piano's subscription modal (it also locks the page's scrolling, undone
// here), Digioh's pop-up and its backdrop. None of them showed on Health.com in the trial loads; the list is a guard.
// Plus Health.com's continuous scroll (.mntl-continuous-scroll): on some pages it appends the next four articles below
// this one as you reach the end (hc-fiber-sleep's first capture did; hc-walking and hc-yoga had no such feed), which
// made the copy five articles long and stopped WebAble from opening its simplified page. Removed so every replica is
// the one article, as the trial pages were.
const RANDOM = '.mntl-continuous-scroll, [id^="ftdiv"], [id^="ftframe"], .piano-widget-container, .piano-modal-backdrop, .piano-modal-wrapper, .fb_lightbox-overlay, [id^="sidebar-overlay-lightbox"], body > [id^="lightbox-"]';

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

function layers() {
  const h = document.querySelector('#header_1-0');
  const ad = document.querySelector('#mm-ads-mob-adhesive-banner-fixed-ad_1-0');
  return {
    headerTop: Math.round(h.getBoundingClientRect().top),
    headerH: Math.round(h.getBoundingClientRect().height),
    adBottom: ad ? Math.round(ad.getBoundingClientRect().bottom) : -1,
    adH: ad ? Math.round(ad.getBoundingClientRect().height) : -1,
  };
}

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
          return {
            fullnav: document.querySelector('#header_1-0').classList.contains('is-fullnav'),
            overlay: document.documentElement.classList.contains('has-overlay'),
            navVisible: getComputedStyle(n).visibility,
            navTop: Math.round(r.top),
            navH: Math.round(r.height),
          };
        });
      await visible(page, '.mntl-header__menu-button').tap({ timeout: 8000 });
      await page.waitForTimeout(800);
      const open = await state();
      await visible(page, '.mntl-header__menu-button').tap({ timeout: 8000 });
      await page.waitForTimeout(800);
      const closed = await state();
      return { openFullnav: open.fullnav, openOverlay: open.overlay, openVisible: open.navVisible, openTop: open.navTop, openH: open.navH, closedFullnav: closed.fullnav, closedOverlay: closed.overlay, closedVisible: closed.navVisible };
    },
  },
  {
    name: 'fixed layers while scrolling: header, adhesive ad',
    run: async (page) => {
      const out = {};
      for (const y of [0, 900, 3000, 1500, 0]) {
        await scrollTo(page, y);
        await page.waitForTimeout(600);
        const s = await page.evaluate(layers);
        for (const [k, v] of Object.entries(s)) out[`y${y}_${k}`] = v;
      }
      return out;
    },
  },
];

/**
 * @param {{ id: string, url: string, stateNotes?: string[], validationNotes?: string[], removed?: string[] }} o
 */
export function hcConfig(o) {
  return {
    id: o.id,
    url: o.url,
    siteName: 'Health.com',
    sameSite: ['www.health.com', 'health.com'],
    licence:
      'Copyright Health.com (People Inc., formerly Dotdash Meredith); all rights reserved. Article text and photos belong to Health.com and the credited photographers and agencies. Copied for a closed, non-commercial research study (noindex, served only behind study links); not for redistribution. Ad creatives and third-party widgets belong to their owners.',
    attribution: `Health.com, ${o.url}. Changed: scripts removed; behaviours re-created as local scripts; ads frozen as captured; files stored locally; in the adapted condition WebAble changes the page.`,
    settleMs: 2500,
    networkIdleMs: 12000,
    blockHosts: BLOCK,
    referenceAfterScroll: true,
    stateNotes: [
      'The page after one scroll pass, back at the top: Health.com loads in-content ads and recirculation lists as you scroll. Live and copy are compared in this state.',
      'As a first-time visitor in the US sees it on a phone: the header fixed at the top and the 320x50 adhesive ad fixed at the bottom. No consent or "do not sell" notice is shown (none appeared on any load from New York time and en-US), and no app banner.',
      'Ad creatives frozen as captured (screenshots in each ad iframe\'s srcdoc; the iframe src is kept); Google Publisher Tag refresh stopped once the slots had filled. Live ads refresh and rotate.',
      'Removed before the reference: Health.com\'s continuous scroll (the feed that appends the next articles below this one as you reach the end; present on some pages only), so the copy is the one article. Guarded against (removed if they appear, as on People): Flashtalking\'s full-screen interstitial ad and Piano\'s subscription modal; outstream video players (Primis, Connatix, Teads) blocked at capture so both pages carry display ads in their slots.',
      ...(o.stateNotes ?? []),
    ],
    removed: ['continuous-scroll feed of further articles below this one (present on some pages only)', 'outstream video ad players (hosts blocked at capture)', ...(o.removed ?? [])],
    behaviourNotes: ['menu (header)', 'ad-slots (captured creatives in srcdoc)', 'fixed header and adhesive ad (CSS)'],
    validationNotes: [...(o.validationNotes ?? [])],
    async prepare(page, h) {
      await page.evaluate((sel) => {
        const rm = () => {
          let piano = false;
          for (const e of document.querySelectorAll(sel)) {
            if (/piano/.test(e.className)) piano = true;
            e.remove();
          }
          if (piano) {
            for (const e of [document.documentElement, document.body]) if (e.style.overflow === 'hidden') e.style.removeProperty('overflow');
          }
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
    // Lazy pictures the site never loaded keep their address on health.com in data-src / data-srcset; the copy shows
    // them blank, as captured, and must not point outside (WebAble's picture reader follows data-src). Anything a
    // site script appends straight under <html> goes to the start of <head> (HTML can't say it; renders the same).
    fixDom: (root) => {
      // Piano's scroll lock (overflow: hidden on <html> and <body>) belongs to the VIP modal removed in prepare; the
      // live page scrolls, so the copy must too.
      for (const e of [root, root.querySelector(':scope > body')]) if (e && e.style.overflow === 'hidden') e.style.removeProperty('overflow');
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
