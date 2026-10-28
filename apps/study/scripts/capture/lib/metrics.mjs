// Page measures used for live vs copy checks (rule 8). Runs inside the page; must stay self-contained.
// Same function for the live page (at capture) and the copy (at validation), so the numbers compare like for like.

export async function metricsInPage() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
  const visible = (e) => {
    if (typeof e.checkVisibility === 'function' && !e.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const px = (v) => Math.round(parseFloat(v) * 10) / 10;
  const mode = (hist) => {
    let best = null;
    let n = -1;
    for (const [k, v] of Object.entries(hist)) if (v > n) [best, n] = [k, v];
    return best === null ? null : Number(best);
  };

  const all = [...document.querySelectorAll('body *')];
  const vis = all.filter(visible);

  // Tap targets: outermost interactive elements. Inline links inside running text are counted apart (WCAG 2.5.8).
  const SEL =
    'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=switch],[role=option]';
  const targets = [...document.querySelectorAll(SEL)].filter((t) => !t.parentElement?.closest(SEL)).filter(visible);
  const inline = (t) => {
    if (t.tagName !== 'A' || getComputedStyle(t).display !== 'inline') return false;
    const p = t.parentElement;
    return !!p && (p.textContent || '').trim().length > (t.textContent || '').trim().length + 20;
  };
  const block = targets.filter((t) => !inline(t));
  const shortSide = (t) => {
    const r = t.getBoundingClientRect();
    return Math.min(r.width, r.height);
  };

  // Character-weighted font sizes: body text (outside links, buttons, headings, nav, header, footer, captions) and
  // paragraphs of 60+ characters.
  const bodyHist = {};
  const paraHist = {};
  const allHist = {};
  let chars = 0;
  const SKIP = 'a,button,h1,h2,h3,h4,h5,h6,nav,header,footer,figcaption,label,[role=navigation],[role=banner],[role=contentinfo]';
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = (n.textContent || '').trim();
    const p = n.parentElement;
    if (!t || !p || !visible(p)) continue;
    const tag = p.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
    const fs = px(getComputedStyle(p).fontSize);
    allHist[fs] = (allHist[fs] || 0) + t.length;
    chars += t.length;
    if (!p.closest(SKIP)) bodyHist[fs] = (bodyHist[fs] || 0) + t.length;
  }
  for (const p of document.querySelectorAll('p')) {
    const t = (p.textContent || '').trim();
    if (t.length >= 60 && visible(p)) {
      const fs = px(getComputedStyle(p).fontSize);
      paraHist[fs] = (paraHist[fs] || 0) + t.length;
    }
  }
  const under16 = Object.entries(allHist).reduce((s, [k, v]) => s + (Number(k) < 16 ? v : 0), 0);

  // Share of the screen whose top element sits in a fixed or sticky layer, at load and 1.5 screens down.
  const covered = () => {
    let hit = 0;
    let n = 0;
    for (let y = 5; y < innerHeight; y += 10) {
      for (let x = 5; x < innerWidth; x += 10) {
        n++;
        let e = document.elementFromPoint(x, y);
        while (e && e !== document.body && e !== document.documentElement) {
          const pos = getComputedStyle(e).position;
          if (pos === 'fixed' || pos === 'sticky') {
            hit++;
            break;
          }
          e = e.parentElement;
        }
      }
    }
    return Math.round((1000 * hit) / Math.max(1, n)) / 10;
  };
  const startY = scrollY;
  window.scrollTo({ top: 0, behavior: 'instant' });
  await frame();
  const coverTop = covered();
  window.scrollTo({ top: Math.round(innerHeight * 1.5), behavior: 'instant' });
  await sleep(250);
  await frame();
  const coverMid = covered();
  window.scrollTo({ top: startY, behavior: 'instant' });
  await sleep(150);

  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible);
  const imgs = [...document.images];
  const fams = new Set();
  document.fonts.forEach((f) => {
    if (f.status === 'loaded') fams.add(f.family.replace(/"/g, ''));
  });
  const firstScreen = vis
    .filter((e) => {
      const r = e.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > 0 && e.children.length === 0;
    })
    .map((e) => (e.textContent || '').trim())
    .filter(Boolean)
    .join('|');
  let h = 7;
  for (const c of firstScreen) h = (h * 31 + c.charCodeAt(0)) >>> 0;

  return {
    title: document.title,
    elements: all.length,
    visibleElements: vis.length,
    links: document.querySelectorAll('a[href]').length,
    visibleLinks: [...document.querySelectorAll('a[href]')].filter(visible).length,
    tapTargets: targets.length,
    tapTargetsBlock: block.length,
    tapTargetsInline: targets.length - block.length,
    tapUnder44: block.filter((t) => shortSide(t) < 44).length,
    tapUnder24: block.filter((t) => shortSide(t) < 24).length,
    headings: headings.length,
    headingList: headings.map((e) => `${e.tagName.toLowerCase()} ${(e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}`),
    bodyFontPx: mode(bodyHist),
    paraFontPx: mode(paraHist),
    textUnder16Pct: chars ? Math.round((1000 * under16) / chars) / 10 : 0,
    visibleTextChars: chars,
    fixedCoverTopPct: coverTop,
    fixedCoverMidPct: coverMid,
    images: imgs.length,
    imagesLoaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    imagesVisible: imgs.filter(visible).length,
    iframes: document.querySelectorAll('iframe').length,
    videos: document.querySelectorAll('video').length,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
    viewport: { w: innerWidth, h: innerHeight },
    loadedFontFamilies: [...fams].sort(),
    bodyFontFamily: getComputedStyle(document.body).fontFamily,
    firstScreenText: `${firstScreen.length}:${h}`,
  };
}

/** Layout at one width: horizontal overflow and the elements that cause it. Runs in the page. */
export function overflowInPage() {
  const w = document.documentElement.clientWidth;
  const out = [];
  const clipped = (e) => {
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) return true;
    }
    return false;
  };
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > w + 1 && !clipped(e)) {
      const s = getComputedStyle(e);
      if (s.position === 'fixed' && r.left >= w) continue; // an off-canvas drawer
      out.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : ''} ${Math.round(r.right)}`);
    }
  }
  return {
    width: w,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    overflowing: out.length,
    sample: out.slice(0, 6),
  };
}
