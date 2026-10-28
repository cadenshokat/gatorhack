// Capture helpers shared by the two floridagators.com "Opponent History" replicas (gators-ky, gators-lsu). Both pages
// are the same Sidearm (Nuxt) template, so one config builder serves both; each replica's capture.config.mjs calls
// gatorsConfig() with its own URL, names and checks.
//
// What the live page does that a frozen copy can't without help, and how this handles it:
// - The Transcend cookie notice lives in a CLOSED shadow root on <div id="transcend-consent-manager">, a child of
//   <html> after <body>. The capture only keeps open shadow roots, so `expand` reads the closed root over CDP and
//   writes it into the host as <template shadowrootmode="open">. `fixDom` moves the host (and the hidden
//   iframe#google_esf, also after <body>) to the end of <body> so the HTML parses as written; page.js moves both back
//   at load, so the page has the live tree (the engine walks <body> and never reaches the notice, as on live).
// - Things that only exist after a tap (the "Links" dropdowns of each game, the calendar's results per sport, the
//   notice's language and "Do Not Sell" views, the video player pop-ups, "More -"): `expand` opens each one in a
//   second, throwaway page and stores what it drew as inert <template data-g="…"> elements in <head>; page.js puts
//   them in place on the same taps.
// - Ads in the results table are lazy (data-lazy-pixels="1200") and fill at random: over ~30 loads here every pattern
//   came up (none at all on about half, a 300x250 or a 320x50 in any of the three ad rows). `prepare` (first load of a
//   capture run only) reloads until the first or second ad row holds a 300x250, empties the other rows, and pins that
//   one to the copy's timing: hidden until its row comes within 1200 px of the screen. `fixDom` does the same to the
//   snapshot, and reveal-on-scroll brings the creative back in the copy. So the live reference and the copy are the
//   same page at every scroll position, and each Gators page carries a single 300x250 in its table.
// - Transcend's airgap.js patches the DOM methods and tags every element inserted afterwards with data-airgap-id, which
//   would also tag the study's own <script> tags that the capture adds. An init script keeps the native methods, and
//   they are put back before the snapshot.
import { PHONE, settle } from '../../scripts/capture/lib/context.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Heights of the three ad rows in the results table (34 px when empty). */
const adRowHeights = (page) =>
  page.evaluate(() => [...document.querySelectorAll('tr.s-table-body__row--ad')].map((t) => Math.round(t.getBoundingClientRect().height)));

/** The state the replicas keep: a 300x250 creative (284 px with its padding) in the first or second ad row. */
const adsFilled = (hs) => hs.length === 3 && (hs[0] > 250 || hs[1] > 250);

/** Saved at document start, before airgap.js patches them: the native DOM descriptors. */
function savePristine() {
  if (window.top !== window) return;
  const saved = [];
  for (const name of ['EventTarget', 'Node', 'Element', 'HTMLElement', 'HTMLScriptElement', 'Document', 'CharacterData', 'ShadowRoot', 'DocumentFragment', 'HTMLTemplateElement', 'HTMLIFrameElement', 'HTMLLinkElement', 'HTMLImageElement']) {
    const p = window[name] && window[name].prototype;
    if (!p) continue;
    for (const k of Object.getOwnPropertyNames(p)) {
      const d = Object.getOwnPropertyDescriptor(p, k);
      if (d && d.configurable) saved.push([p, k, d]);
    }
  }
  Object.defineProperty(window, '__gPristine', { value: saved });
}

/** Puts the native DOM methods back (airgap's patches tag inserted elements); returns how many were patched. */
const restorePristine = (page) =>
  page.evaluate(() => {
    let n = 0;
    for (const [p, k, d] of window.__gPristine || []) {
      const cur = Object.getOwnPropertyDescriptor(p, k);
      if (!cur || cur.value !== d.value || cur.get !== d.get || cur.set !== d.set) {
        Object.defineProperty(p, k, d);
        n++;
      }
    }
    return window.__gPristine ? n : -1;
  });

/** Scrolls far enough for the first ad row to load (ads are lazy), waits for the auction, returns to the top. */
async function scrollForAds(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const row = document.querySelector('tr.s-table-body__row--ad');
    const end = row ? row.getBoundingClientRect().top + window.scrollY : 3000;
    for (let y = 0; y < end; y += 400) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await sleep(200);
    }
  });
  await sleep(4000);
  const hs = await adRowHeights(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  return hs;
}

/** Live page: the ad state the copy keeps (see the header); the first row's creative appears 1200 px early. */
const pinLiveAds = (page) =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr.s-table-body__row--ad')];
    const keep = rows.findIndex((tr, i) => i < 2 && tr.getBoundingClientRect().height > 250);
    rows.forEach((tr, i) => {
      const gpt = tr.querySelector('.htl-ad-gpt');
      const filled = !!(gpt && gpt.querySelector('iframe'));
      if (i === keep) {
        tr.setAttribute('data-g-keep', '');
        const els = [tr.querySelector('.s-advert__hide-btn'), gpt].filter(Boolean);
        for (const el of els) el.setAttribute('hidden', '');
        const check = () => {
          if (tr.getBoundingClientRect().top > window.innerHeight + 1200) return;
          for (const el of els) el.removeAttribute('hidden');
          window.removeEventListener('scroll', check);
        };
        window.addEventListener('scroll', check, { passive: true });
      } else if (filled) {
        tr.querySelector('.s-advert__hide-btn')?.remove();
        gpt.style.display = 'none';
        gpt.querySelector('iframe')?.remove();
      }
    });
  });

let firstPrepare = true;

/**
 * Opens every tap-only state in a separate page (shadow roots forced open there) and returns their HTML:
 * { links: {ariaLabel: popperHtml}, lists: {selectId: {value: {html, label}}}, consent: {notice, language, dns, css},
 *   more: {open, closed}, videos: [{key, html}] }.
 */
async function gatherStates(page, url, h) {
  const ctx = await page.context().browser().newContext({ ...PHONE, bypassCSP: true });
  await ctx.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    } catch {
      /* defined */
    }
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) {
      return orig.call(this, { ...init, mode: 'open' });
    };
  });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await settle(p, { networkIdleMs: 15000, settleMs: 2000 });

  const out = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const res = { links: {}, lists: {}, consent: {}, more: {} };

    // "Links" dropdown of every game row (Box Score, Recap, Notes…). The resize-observer <object> is dropped.
    for (const b of document.querySelectorAll('button[aria-label^="Links for game"]')) {
      b.click();
      await sleep(300);
      const vp = b.closest('.v-popper');
      const pop = vp && vp.querySelector('.v-popper__popper');
      if (pop) {
        const c = pop.cloneNode(true);
        for (const ro of c.querySelectorAll('.resize-observer')) ro.remove();
        c.removeAttribute('style');
        c.removeAttribute('id');
        c.querySelector('.v-popper__arrow-container')?.removeAttribute('style');
        res.links[b.getAttribute('aria-label')] = c.outerHTML;
      }
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      document.body.click();
      if (vp && vp.querySelector('.v-popper__popper--shown')) b.click();
      await sleep(250);
    }

    // Calendar: the event list for every sport in both tabs (the site fetches them; the copy keeps what it drew).
    for (const sel of document.querySelectorAll('#schedule-offcanvas-tabset select')) {
      const filter = sel.closest('[class*="__filter"]:not(select)');
      const list = filter.parentElement;
      const start = sel.value;
      const lists = {};
      const read = () => [...list.children].filter((c) => c !== filter).map((c) => c.outerHTML).join('');
      for (const opt of [...sel.options]) {
        const before = read();
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        for (let i = 0; i < 30; i++) {
          await sleep(150);
          if (read() !== before && i > 3) break;
        }
        await sleep(500);
        lists[opt.value] = { html: read(), label: sel.getAttribute('aria-label') };
      }
      sel.value = start;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(1500);
      res.lists[sel.id] = lists;
    }

    // "More +" becomes "More -" while the sport menu is open.
    const more = document.getElementById('c-navigation__toggle-sport-mobile');
    res.more.closed = more.innerHTML;
    more.click();
    await sleep(500);
    res.more.open = more.innerHTML;
    more.click();
    await sleep(500);

    // The cookie notice's other views: language list, and "Do Not Sell…" (opened from the footer once closed).
    const sr = document.getElementById('transcend-consent-manager').shadowRoot;
    // A <p> holding a <p> can't be written as HTML: record it as <div data-g-tag="p"> (page.js turns it back).
    const detag = (el) => {
      for (const p of [...el.querySelectorAll('p')].filter((x) => x.querySelector('p, div, ul, ol, table'))) {
        const d = document.createElement('div');
        for (const a of [...p.attributes]) d.setAttribute(a.name, a.value);
        d.setAttribute('data-g-tag', 'p');
        d.append(...p.childNodes);
        p.replaceWith(d);
      }
      return el;
    };
    const inner = () => {
      const el = sr.querySelector('.modal-container-inner');
      return el ? detag(el.cloneNode(true)).outerHTML : null;
    };
    res.consent.notice = inner();
    sr.querySelector('button.language-button').click();
    await sleep(700);
    res.consent.language = inner();
    [...sr.querySelectorAll('button')].find((b) => /go back/i.test(b.textContent))?.click();
    await sleep(500);
    sr.querySelector('button.privacy-policy-notice-with-close-button-close').click();
    await sleep(700);
    document.querySelectorAll('button.s-common-footer__links-link--transcend')[1].click();
    await sleep(1500);
    res.consent.dns = inner();
    sr.querySelector('button.language-button')?.click();
    await sleep(700);
    res.consent.dnsLanguage = inner();
    // Every rule the notice's CSS-in-JS inserted while drawing those views.
    const rules = (s) => {
      try {
        return [...s.cssRules].map((r) => r.cssText).join('\n');
      } catch {
        return '';
      }
    };
    res.consent.css = [...sr.querySelectorAll('style')].map((s) => (s.sheet ? rules(s.sheet) : '')).concat((sr.adoptedStyleSheets || []).map(rules)).join('\n');
    return res;
  });

  // Video pop-ups: the dialog with a picture of its player (the stream itself can't be kept). The cookie notice is
  // hidden first, or it would be in the picture.
  await p.evaluate(() => document.getElementById('transcend-consent-manager')?.style.setProperty('visibility', 'hidden'));
  out.videos = [];
  const n = await p.locator('button.s-btn--play').count();
  for (let i = 0; i < n; i++) {
    const key = await p.evaluate((i) => {
      const b = document.querySelectorAll('button.s-btn--play')[i];
      const card = b.closest('li, article, .s-video-card, [class*="video"]') || b.parentElement;
      b.click();
      return (card.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    }, i);
    await sleep(2500);
    const player = p.locator('.s-base-modal iframe').first();
    let shot = null;
    if (await player.count()) {
      shot = await player
        .screenshot({ type: 'jpeg', quality: 82, timeout: 8000 })
        .then((b) => `data:image/jpeg;base64,${b.toString('base64')}`)
        .catch(() => null);
    }
    const html = await p.evaluate((shot) => {
      const m = document.querySelector('.s-base-modal');
      if (!m) return null;
      const c = m.cloneNode(true);
      // The player's iframe keeps its src (the engine reads it); page.js fills it with this picture when it opens.
      for (const f of c.querySelectorAll('iframe')) if (shot) f.setAttribute('data-g-shot', shot);
      for (const s of c.querySelectorAll('script, video, audio, object')) s.remove();
      return c.outerHTML;
    }, shot);
    out.videos.push({ key, html });
    await p.keyboard.press('Escape');
    await sleep(800);
    await p.evaluate(() => document.querySelector('.s-base-modal [aria-label*="lose" i]')?.click());
    await sleep(600);
  }
  await ctx.close();
  h.log(
    `gathered: ${Object.keys(out.links).length} link menus, ${Object.values(out.lists).map((l) => Object.keys(l).length).join('+')} calendar lists, ${out.videos.filter((v) => v.html).length} video pop-ups, consent views ${Object.keys(out.consent).filter((k) => out.consent[k]).join('/')}`,
  );
  return out;
}

/** Writes the gathered states into <head> as inert templates of the live page (the capture then keeps them). */
function writeTemplates(page, states) {
  return page.evaluate((s) => {
    const add = (kind, key, html, extra = {}) => {
      if (!html) return;
      const t = document.createElement('template');
      t.setAttribute('data-g', kind);
      if (key !== null) t.setAttribute('data-key', key);
      for (const [k, v] of Object.entries(extra)) t.setAttribute(k, v);
      t.innerHTML = html;
      document.head.append(t);
    };
    for (const [k, v] of Object.entries(s.links)) add('links', k, v);
    for (const [id, lists] of Object.entries(s.lists)) for (const [v, l] of Object.entries(lists)) add('list', `${id}|${v}`, l.html, { 'data-label': l.label ?? '' });
    add('more-open', null, s.more.open);
    add('more-closed', null, s.more.closed);
    for (const k of ['notice', 'language', 'dns', 'dnsLanguage']) add('consent', k, s.consent[k]);
    s.videos.forEach((v, i) => add('video', String(i), v.html, { 'data-title': v.key }));
  }, states);
}

/** Copies the notice's closed shadow root into its host as an open declarative one (with every inserted rule). */
async function openConsentRoot(page, extraCss) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { result } = await cdp.send('Runtime.evaluate', { expression: "document.getElementById('transcend-consent-manager')" });
    if (!result.objectId) return false;
    const { node } = await cdp.send('DOM.describeNode', { objectId: result.objectId, depth: 1, pierce: true });
    const sr = node.shadowRoots && node.shadowRoots[0];
    if (!sr) return false;
    const { object } = await cdp.send('DOM.resolveNode', { backendNodeId: sr.backendNodeId });
    await cdp.send('Runtime.callFunctionOn', {
      objectId: object.objectId,
      arguments: [{ value: extraCss || '' }],
      functionDeclaration: `function (extra) {
        const rules = (s) => { try { return [...s.cssRules].map((r) => r.cssText).join('\\n'); } catch { return ''; } };
        const c = document.createElement('div');
        for (const n of this.childNodes) c.append(n.cloneNode(true));
        // A <p> holding a <p> can't be written as HTML: record it as <div data-g-tag="p"> (page.js turns it back).
        for (const p of [...c.querySelectorAll('p')].filter((x) => x.querySelector('p, div, ul, ol, table'))) {
          const d = document.createElement('div');
          for (const a of [...p.attributes]) d.setAttribute(a.name, a.value);
          d.setAttribute('data-g-tag', 'p');
          d.append(...p.childNodes);
          p.replaceWith(d);
        }
        // Rules the notice inserted from script exist only in the CSSOM: write them out as text.
        const live = [...this.querySelectorAll('style')];
        [...c.querySelectorAll('style')].forEach((st, i) => {
          const sh = live[i] && live[i].sheet;
          if (sh && sh.cssRules.length) st.textContent = rules(sh);
        });
        const adopted = (this.adoptedStyleSheets || []).map(rules).join('\\n');
        const t = document.createElement('template');
        t.setAttribute('shadowrootmode', 'open');
        t.innerHTML = (adopted ? '<style data-g="adopted">' + adopted + '</style>' : '') +
          (extra ? '<style data-g="views">' + extra + '</style>' : '') + c.innerHTML;
        this.host.prepend(t);
        return true;
      }`,
    });
    return true;
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/**
 * Runs in the page on the detached clone (no closures): moves the two elements that live after <body> into it (marked
 * for page.js), keeps the selects' live values, and hides the filled ad creatives until their rows come near.
 */
function fixDom(root, document) {
  const body = root.querySelector('body');
  for (const el of [...root.children]) {
    if (el.tagName === 'HEAD' || el.tagName === 'BODY') continue;
    el.setAttribute('data-g-after-body', '');
    body.append(el);
  }
  // <select> values are properties, not attributes: write the live choice as `selected`.
  for (const s of document.querySelectorAll('select')) {
    const c = root.querySelector(`select[data-rid="${s.getAttribute('data-rid')}"]`);
    if (!c) continue;
    c.querySelectorAll('option').forEach((o, i) => {
      if (i === s.selectedIndex) o.setAttribute('selected', '');
      else o.removeAttribute('selected');
    });
  }
  // Ads: the kept row's creative (marked by prepare on the live page) is hidden until the row is near the screen
  // (reveal-on-scroll, 1200 px like the site's lazy loader); the other rows go back to the unfilled state, so each
  // Gators page carries a single 300x250.
  const rows = [...root.querySelectorAll('tr.s-table-body__row--ad')];
  let keep = rows.findIndex((tr) => tr.hasAttribute('data-g-keep'));
  if (keep < 0) keep = rows.findIndex((tr) => !!tr.querySelector('.htl-ad-gpt iframe[width="300"]'));
  rows.forEach((tr, i) => {
    tr.removeAttribute('data-g-keep');
    tr.setAttribute('data-g-adrow', String(i + 1));
    const gpt = tr.querySelector('.htl-ad-gpt');
    const filled = !!(gpt && gpt.querySelector('iframe'));
    if (i === keep && filled) {
      for (const el of [tr.querySelector('.s-advert__hide-btn'), gpt]) {
        if (!el) continue;
        el.setAttribute('hidden', '');
        el.setAttribute('data-g-ad', '1');
      }
    } else if (filled) {
      tr.querySelector('.s-advert__hide-btn')?.remove();
      for (const c of [...gpt.classList]) if (c.startsWith('htl-size-')) gpt.classList.remove(c);
      gpt.setAttribute('style', 'display: none;');
      const box = gpt.querySelector('[id^="google_ads_iframe_"][id$="__container__"]');
      if (box) {
        box.replaceChildren();
        box.setAttribute('style', 'border: 0pt; margin: auto; text-align: center; width: 320px; height: 0px;');
      }
    }
  });
}

/** Live and copy: what the cookie notice shows (the live root is closed, so this reads the screen instead). */
const consentState = (page) =>
  page.evaluate(() => {
    const h = document.getElementById('transcend-consent-manager');
    // The top element in the notice's area: the host (the notice is showing) or the page.
    const at = (x, y) => document.elementFromPoint(x, y) === h;
    let cover = 0;
    let n = 0;
    for (let y = 5; y < innerHeight; y += 20)
      for (let x = 5; x < innerWidth; x += 20) {
        n++;
        if (at(x, y)) cover++;
      }
    return { hostParent: h ? h.parentElement.tagName : null, coverPct: Math.round((cover / n) * 100) };
  });

/** Checks shared by both replicas (rule 8's behaviour checklist). `y` = a game row label for the Links check. */
export function gatorsChecks({ linksFor }) {
  const tap = (sel) => async (page) => {
    await page.locator(sel).first().tap();
    await page.waitForTimeout(800);
  };
  return [
    {
      name: 'cookie notice: shown at load, X closes it',
      scrollFirst: false,
      run: async (page) => {
        const before = await consentState(page);
        // The live root is closed: tap where its X is drawn (same place in the copy).
        await page.touchscreen.tap(350, 528);
        await page.waitForTimeout(900);
        const after = await consentState(page);
        return { parent: before.hostParent, coverBefore: before.coverPct, coverAfter: after.coverPct };
      },
      tolerancePx: 1,
    },
    {
      name: 'menu: open, "Tickets", then "Sports"',
      run: async (page) => {
        await tap('#c-navigation__toggle-main-mobile')(page);
        const a = await page.evaluate(() => ({
          expanded: document.querySelector('#c-navigation__toggle-main-mobile').getAttribute('aria-expanded'),
          open: document.querySelector('#main-nav-mobile-offcanvas').classList.contains('is-open'),
          icon: document.querySelector('#c-navigation__toggle-main-mobile svg').getAttribute('class'),
        }));
        await tap('#level-1-2')(page);
        const t = await page.evaluate(() => document.querySelector('#level-1-2').getAttribute('aria-expanded'));
        await tap('#level-1-1')(page);
        const b = await page.evaluate(() => {
          const l2 = document.querySelector('#level-2-Sports-1');
          return {
            sportsExpanded: document.querySelector('#level-1-1').getAttribute('aria-expanded'),
            ticketsExpandedAfter: document.querySelector('#level-1-2').getAttribute('aria-expanded'),
            sportsOpen: l2.classList.contains('is-open'),
            l2Height: Math.round(l2.getBoundingClientRect().height),
          };
        });
        return { ...a, ticketsExpanded: t, ...b };
      },
    },
    {
      name: 'calendar: open, "Results" tab',
      run: async (page) => {
        await tap('#s-events__toggle-main-mobile')(page);
        const a = await page.evaluate(() => ({
          expanded: document.querySelector('#s-events__toggle-main-mobile').getAttribute('aria-expanded'),
          icon: document.querySelector('#s-events__toggle-main-mobile svg').getAttribute('class'),
        }));
        await tap('#v-3-0-tab-1')(page);
        const b = await page.evaluate(() => ({
          resultsSelected: document.querySelector('#v-3-0-tab-1').getAttribute('aria-selected'),
          upcomingShown: getComputedStyle(document.querySelector('#v-3-0-panel-0')).display !== 'none',
          resultsShown: getComputedStyle(document.querySelector('#v-3-0-panel-1')).display !== 'none',
          results: document.querySelectorAll('#v-3-0-panel-1 li').length,
        }));
        return { ...a, ...b };
      },
    },
    {
      name: 'calendar: filter Upcoming by "Baseball", then "All Sports"',
      run: async (page) => {
        await tap('#s-events__toggle-main-mobile')(page);
        const list = () =>
          page.evaluate(() => {
            const p = document.querySelector('#v-3-0-panel-0');
            const sel = p.querySelector('select');
            return { value: sel.value, label: sel.getAttribute('aria-label'), items: p.querySelectorAll('li').length, first: (p.querySelector('li')?.textContent || p.querySelector('p')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) };
          });
        const start = await list();
        const sel = page.locator('#v-3-0-panel-0 select');
        await sel.selectOption({ label: 'Baseball' });
        await page.waitForTimeout(2500);
        const baseball = await list();
        await sel.selectOption({ index: 0 });
        await page.waitForTimeout(2500);
        const all = await list();
        return { startValue: start.value, startItems: start.items, baseballLabel: baseball.label, baseballItems: baseball.items, baseballFirst: baseball.first, allItems: all.items, allFirst: all.first };
      },
    },
    {
      name: '"More +" opens the sport menu, then "Facilities"',
      run: async (page) => {
        await tap('#c-navigation__toggle-sport-mobile')(page);
        const a = await page.evaluate(() => ({
          label: document.querySelector('#c-navigation__toggle-sport-mobile').textContent.replace(/\s+/g, ' ').trim(),
          expanded: document.querySelector('#c-navigation__toggle-sport-mobile').getAttribute('aria-expanded'),
          open: document.querySelector('[id="\'mobile-sportnav-offcanvas\'"], #mobile-sportnav-offcanvas')?.classList.contains('is-open') ?? null,
        }));
        await tap('#sport-level-1-157')(page);
        const b = await page.evaluate(() => {
          const d = document.querySelector('#mobile-sportnav-dropdown-157');
          return { facilitiesExpanded: document.querySelector('#sport-level-1-157').getAttribute('aria-expanded'), dropdownOpen: d.classList.contains('is-open'), dropdownHeight: Math.round(d.getBoundingClientRect().height) };
        });
        return { ...a, ...b };
      },
    },
    {
      name: 'results table scrolls sideways (shadow classes)',
      run: async (page) =>
        page.evaluate(async () => {
          const w = document.querySelectorAll('.s-table__wrapper')[1];
          const t = w.closest('.s-table');
          const cls = () => ['scroll-left', 'scroll-right'].filter((c) => t.classList.contains(c)).join(' ');
          const r0 = cls();
          w.scrollLeft = 150;
          await new Promise((r) => setTimeout(r, 400));
          const r1 = cls();
          w.scrollLeft = 2000;
          await new Promise((r) => setTimeout(r, 400));
          return { atStart: r0, middle: r1, atEnd: cls(), maxScroll: w.scrollLeft, tableWidth: Math.round(w.querySelector('table').getBoundingClientRect().width) };
        }),
    },
    {
      name: `"Links" menu of ${linksFor}`,
      run: async (page) => {
        const b = page.locator(`button[aria-label="Links for game on ${linksFor}"]`);
        await b.scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollBy({ top: -150, behavior: 'instant' }));
        await b.tap();
        await page.waitForTimeout(900);
        return page.evaluate((label) => {
          const btn = document.querySelector(`button[aria-label="${label}"]`);
          const pop = btn.closest('.v-popper').querySelector('.v-popper__popper');
          const br = btn.getBoundingClientRect();
          const pr = pop ? pop.getBoundingClientRect() : null;
          return {
            shown: !!pop && pop.classList.contains('v-popper__popper--shown'),
            items: pop ? [...pop.querySelectorAll('a')].map((a) => a.textContent.trim()).join(', ') : '',
            chevron: btn.querySelector('svg').getAttribute('class'),
            dx: pr ? Math.round(pr.left - br.left) : null,
            dy: pr ? Math.round(pr.top - br.bottom) : null,
            width: pr ? Math.round(pr.width) : null,
            height: pr ? Math.round(pr.height) : null,
          };
        }, `Links for game on ${linksFor}`);
      },
      tolerancePx: 3,
    },
    {
      name: 'video pop-up opens and closes',
      run: async (page) => {
        const b = page.locator('button.s-btn--play').first();
        await b.scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollBy({ top: -200, behavior: 'instant' }));
        await b.tap();
        await page.waitForTimeout(2500);
        const open = await page.evaluate(() => {
          const m = document.querySelector('.s-base-modal');
          const d = m && m.querySelector('[role="dialog"], .s-base-modal__container, .s-base-modal__inner') ;
          const r = (d || m)?.getBoundingClientRect();
          return { modal: !!m, title: m ? (m.querySelector('h2, h3, [class*="title"]')?.textContent || '').trim().slice(0, 60) : '', top: r ? Math.round(r.top) : null, height: r ? Math.round(r.height) : null };
        });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1200);
        return { ...open, closed: !(await page.evaluate(() => !!document.querySelector('.s-base-modal'))) };
      },
      tolerancePx: 4,
    },
  ];
}

/**
 * The config for one Opponent History page. `linksFor` names a game whose "Links" menu the checks open
 * ("September 10, 2022").
 */
export function gatorsConfig({ id, url, opponent, linksFor, stateNotes = [], validationNotes = [] }) {
  return {
    id,
    url,
    siteName: 'Florida Gators',
    sameSite: ['floridagators.com', 'www.floridagators.com'],
    licence:
      'Copyrighted: page design, text, photos and logos (c) University of Florida Athletic Association / LEARFIELD / Sidearm Sports; opponent logos belong to their schools; the cookie notice is Transcend\'s. Game scores and dates are facts. Copied only for a private, non-commercial research study, not redistributed. Fonts: the site\'s own Adobe Fonts (Typekit) files, self-hosted for the same study.',
    attribution: `Florida Gators (floridagators.com), "Football History vs ${opponent}", ${url}`,
    settleMs: 2500,
    networkIdleMs: 15000,
    stateNotes: [
      'Start state as a first-time visitor sees it: the Transcend cookie notice showing (bottom, 39% of the first screen) and answered by nobody; menus, calendar and dropdowns closed; scrolled to the top',
      'The cookie notice is a closed shadow root on a host after <body> on the live page; the copy holds it as an open declarative shadow root and page.js moves the host back after <body> at load, so the engine sees what it sees live (a fixed host it cannot look inside) while the study can still measure taps on its buttons',
      'Ads: one 300x250 creative in the results table (the first of its first two ad rows that filled at capture), the other ad rows unfilled. Live fills are random (none on about half the loads here; otherwise a 300x250 or 320x50 in any row). It appears when its row comes within 1200 px of the screen, as the site\'s lazy loader does; no rotation (the live slots refresh every 30 s)',
      'The calendar\'s Upcoming/Results lists, the game "Links" menus, the video pop-ups and the cookie notice\'s other views are the ones the live site drew during capture',
      ...stateNotes,
    ],
    removed: ['ad refresh and rotation (frozen to one creative per slot)', 'video streams (a pop-up shows its player as a picture)'],
    behaviourNotes: ['consent (page.js: X closes; language and "Do Not Sell" views)', 'menus and calendar (page.js)', 'tabs and sport filter (page.js)', 'links-dropdowns (page.js)', 'table-scroll-shadow (page.js)', 'video-popup (page.js)', 'ad-hide (page.js)', 'sticky-header (CSS only, as live)'],
    validationNotes: [
      'Ads are pinned on both sides: the live reference comes from a load whose 300x250 filled where the copy keeps it, with the other ad rows emptied and the same 1200 px lazy reveal applied, so heights and pixels compare like for like. A fresh live load differs in its ads (random fills, none on about half the loads).',
      'The copy focuses the notice\'s close button at load, as Transcend does (data-initialfocus); the focus ring is part of the first-screen match.',
      '"Hide advertisement" is not in the live/copy checks (fresh live loads rarely have an ad): on a filled live load it sets aria-pressed="true", hides the .s-advert and removes the button; the copy does the same (row back to 34 px), tapped in the dev-server test.',
      'Tapped in the copy but not compared with live by the checks: the notice\'s language list and "Go back", the footer "Do Not Sell or Share My Personal Information" view and its close, a calendar event\'s media overlay, the video pop-up\'s close button and backdrop.',
      'Not reproduced: choosing a language (the notice stays in English), playing a video (the pop-up shows a picture of its player), the menu\'s search box (no results); the calendar lists and related videos are as the site drew them on 2026-10-27.',
      'Measured in Chromium only, not in WebKit or on a real phone.',
      ...validationNotes,
    ],

    // Start state. On the capture's own first load only: reload (at least once, so the native DOM methods are saved
    // before airgap.js runs) until the first ad row holds a 300x250, then pin the ads as the copy has them. The later
    // loads (behaviour checks) keep whatever ads come; no check depends on them.
    async prepare(page, h) {
      if (!firstPrepare) return h.sleep(500);
      firstPrepare = false;
      await page.context().addInitScript(savePristine);
      let hs = [];
      for (let i = 1; i <= 30 && !adsFilled(hs); i++) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
        await settle(page, { networkIdleMs: 8000, settleMs: 2500 });
        hs = await scrollForAds(page);
        h.log(`load ${i}: ad rows ${hs.join('/')}`);
      }
      if (!adsFilled(hs)) h.log(`WARNING: no 300x250 in the first two ad rows after 30 loads (${hs.join('/')})`);
      await pinLiveAds(page);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await h.sleep(800);
    },

    // Gather the tap-only states in a second page, then write them and the notice's shadow root into this page for
    // the snapshot (with the native DOM methods back, so airgap doesn't tag what is written).
    async expand(page, h) {
      const states = await gatherStates(page, url, h);
      const n = await restorePristine(page);
      h.log(`native DOM methods restored: ${n}`);
      await writeTemplates(page, states);
      const ok = await openConsentRoot(page, states.consent.css);
      if (!ok) h.log('WARNING: could not read the cookie notice\'s shadow root');
      // The capture hides fixed layers in <body> while it photographs iframes (the ad); the notice sits after <body>,
      // so hide it here too, or it ends up inside the ad's picture.
      await page.evaluate(() => {
        const host = document.getElementById('transcend-consent-manager');
        if (!host) return;
        host.setAttribute('data-g-style', host.getAttribute('style') ?? '');
        host.style.visibility = 'hidden';
      });
    },

    // The notice comes back for the snapshot. The capture's own scroll pass may have filled the other ad rows (fixDom
    // empties them); make sure the DOM methods are still the native ones for the snapshot.
    async restore(page) {
      await restorePristine(page);
      await page.evaluate(() => {
        const host = document.getElementById('transcend-consent-manager');
        if (!host || !host.hasAttribute('data-g-style')) return;
        host.setAttribute('style', host.getAttribute('data-g-style'));
        host.removeAttribute('data-g-style');
      });
    },

    fixDom,

    behaviours: [{ use: 'reveal-on-scroll', options: { target: '[data-g-ad="1"]', near: '[data-g-adrow]:has([data-g-ad="1"])', marginPx: 1200 } }],
    checks: gatorsChecks({ linksFor }),
  };
}
