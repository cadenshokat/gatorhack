// Capture setup shared by the two People.com news articles (pp-millie, pp-karin): same Dotdash Meredith article
// template, same hooks, same checks, so the pair carries the same page furniture: the AppsFlyer "The PEOPLE app"
// banner fixed at the top (with its close button), the fixed header under it (menu, Subscribe, account, bell), the
// "Need to Know" box, in-content display ads between paragraphs, the 320x50 adhesive ad fixed at the bottom, the
// "VIPs Get More" and newsletter boxes, Related Stories and the recirculation lists after the article.
// Adapted from ../ar-banana-bread/ar-capture.mjs (the Allrecipes setup, also Dotdash Meredith).
//
// Each replica's capture.config.mjs calls ppConfig(). Page behaviours the shared modules don't cover are in
// site/page.js (the same file in both replicas).

// Late or occasional layers removed on the live page (stateNotes say why): Flashtalking's full-screen interstitial ad
// (ftdiv/ftframe, shown on some loads only, after some scrolling), Piano's "Become a PEOPLE VIP" subscription modal
// (shown after some time on the page; it also locks the page's scrolling, undone here), Digioh's pop-up and its
// backdrop.
const RANDOM = '[id^="ftdiv"], [id^="ftframe"], .piano-widget-container, .piano-modal-backdrop, .piano-modal-wrapper, .fb_lightbox-overlay, [id^="sidebar-overlay-lightbox"], body > [id^="lightbox-"]';

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
  const sb = document.querySelector('#smart-banner');
  const ab = document.querySelector('#appsflyer-banner_1-0');
  const ad = document.querySelector('#mm-ads-mob-adhesive-banner-fixed-ad_1-0');
  return {
    headerTop: Math.round(h.getBoundingClientRect().top),
    headerH: Math.round(h.getBoundingClientRect().height),
    banner: !!sb && getComputedStyle(sb).display !== 'none',
    bannerTop: sb ? Math.round(sb.getBoundingClientRect().top) : -1,
    bannerBoxH: ab ? Math.round(ab.getBoundingClientRect().height) : -1,
    adBottom: ad ? Math.round(ad.getBoundingClientRect().bottom) : -1,
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
      return { openFullnav: open.fullnav, openOverlay: open.overlay, openTop: open.navTop, openH: open.navH, closedFullnav: closed.fullnav, closedOverlay: closed.overlay, closedH: closed.navH };
    },
  },
  {
    name: 'fixed layers while scrolling: app banner, header, adhesive ad',
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
  {
    name: 'app banner close button',
    run: async (page) => {
      await scrollTo(page, 0);
      await page.waitForTimeout(400);
      const before = await page.evaluate(layers);
      const h0 = await page.evaluate(() => document.documentElement.scrollHeight);
      await visible(page, '#smart-banner [aria-label="Close banner"]').tap({ timeout: 8000 });
      await page.waitForTimeout(900);
      const after = await page.evaluate(layers);
      const h1 = await page.evaluate(() => document.documentElement.scrollHeight);
      return { beforeBanner: before.banner, beforeHeaderTop: before.headerTop, afterBanner: after.banner, afterHeaderTop: after.headerTop, afterBoxH: after.bannerBoxH, heightChange: h1 - h0 };
    },
  },
];

/**
 * @param {{ id: string, url: string, stateNotes?: string[], validationNotes?: string[], removed?: string[] }} o
 */
export function ppConfig(o) {
  return {
    id: o.id,
    url: o.url,
    siteName: 'PEOPLE',
    sameSite: ['people.com', 'www.people.com'],
    licence:
      'Copyright PEOPLE (People Inc., formerly Dotdash Meredith); all rights reserved. Article text and photos belong to PEOPLE and the credited photographers and agencies. Copied for a closed, non-commercial research study (noindex, served only behind study links); not for redistribution. Ad creatives and third-party widgets belong to their owners.',
    attribution: `PEOPLE, ${o.url}. Changed: scripts removed; behaviours re-created as local scripts; ads frozen as captured; files stored locally; in the adapted condition WebAble changes the page.`,
    settleMs: 2500,
    networkIdleMs: 12000,
    blockHosts: BLOCK,
    referenceAfterScroll: true,
    stateNotes: [
      'The page after one scroll pass, back at the top: PEOPLE loads in-content ads, related stories and recirculation lists as you scroll. Live and copy are compared in this state.',
      'As a first-time visitor in the US sees it on a phone: the AppsFlyer "The PEOPLE app" banner fixed at the top (shown on every load; its close button works), the header fixed under it, and the 320x50 adhesive ad fixed at the bottom. No consent or "do not sell" notice is shown (none appeared on any load from New York time and en-US).',
      'EX.CO\'s video player floats at the bottom of the screen from the start, as live; frozen as captured (a still of the player; the video is not copied). Its close button (X) hides it (site/page.js).',
      'Ad creatives frozen as captured (screenshots in each ad iframe\'s srcdoc; the iframe src is kept); Google Publisher Tag refresh stopped once the slots had filled. Live ads refresh and rotate.',
      'Removed because it appears on some loads only, after some scrolling: Flashtalking\'s full-screen interstitial ad (it covered the whole screen on 3 of 4 trial loads, with an "X"). Removed because it appears late, after some time on the page: Piano\'s full-screen "Become a PEOPLE VIP" subscription modal (it locks scrolling, undone with it; it did not appear in four short trial loads, it did during the longer capture load). Outstream video players (Primis, Connatix, Teads) blocked at capture so both pages carry display ads in their slots.',
      ...(o.stateNotes ?? []),
    ],
    removed: ['Flashtalking full-screen interstitial ad (appears on some loads only, after scrolling)', 'Piano "Become a PEOPLE VIP" subscription modal (appears after some time on the page)', 'outstream video ad players (hosts blocked at capture)', ...(o.removed ?? [])],
    behaviourNotes: ['app banner close', 'menu (header)', 'floating video close', 'ad-slots (captured creatives in srcdoc)', 'fixed header and adhesive ad (CSS)'],
    validationNotes: [
      'First-screen pixels (about 4.5-5%, target 0.5%): all of it is the band 746-844 CSS px, the EX.CO video player floating at the bottom of the screen. Live shows a frame of its playing video; the copy shows the player as captured (a still; the video stream is not copied). The rest of the first screen matches.',
      'Full-page pixel bands are the in-content ad slots (each about 250 px tall): the live full-page screenshot and the copy\'s captured creatives differ there (ads rotate and cross-origin frames paint differently in a full-page shot).',
      'The app banner is 117 or 119 px tall depending on the load (its text wraps differently); the checks compare within 2 px.',
      ...(o.validationNotes ?? []),
    ],
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
    // Lazy pictures the site never loaded keep their address on people.com in data-src / data-srcset; the copy shows
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
