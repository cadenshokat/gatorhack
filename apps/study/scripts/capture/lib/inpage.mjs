// Functions that run inside the live page during a capture. Each must stay self-contained (Playwright serialises
// them), so small helpers are repeated rather than shared.

/**
 * Freezes the live page into a detached clone kept on window.__cap:
 * - loaded images get width/height attributes where that changes no box (at 390 px and at 195 px wide);
 * - every element gets data-rid (document order);
 * - styles inserted from script (insertRule, adopted sheets, FontFace) are written back as text;
 * - open shadow roots become declarative <template shadowrootmode>;
 * - the clone loses scripts, handlers, preload hints, http-equiv meta, <base>, SRI;
 * - same-site links become root-relative; other links stay absolute.
 * Returns the resource references the clone needs and its inline CSS, for the node side to store.
 */
export function snapshotInPage(o) {
  const doc = document;
  const abs = (u, base) => {
    try {
      return new URL(u, base || doc.baseURI).href;
    } catch {
      return null;
    }
  };
  const bare = (u) => (u ? u.split('#')[0] : u);
  const have = new Set(o.have);
  const sameSite = new Set(o.sameSite.map((h) => h.toLowerCase()));

  // 1. Image boxes (rule 5). Sizes only; positions may shift as neighbours change.
  const imgs = [...doc.images].filter(
    (i) => i.complete && i.naturalWidth > 0 && !(i.hasAttribute('width') && i.hasAttribute('height')) && i.getClientRects().length > 0,
  );
  const sizeOf = (i) => {
    const r = i.getBoundingClientRect();
    return [r.width, r.height];
  };
  const html = doc.documentElement;
  const htmlStyle = html.getAttribute('style');
  const a390 = imgs.map(sizeOf);
  html.style.setProperty('width', '195px', 'important');
  const a195 = imgs.map(sizeOf);
  const added = imgs.map((i) => {
    const had = [i.getAttribute('width'), i.getAttribute('height')];
    i.setAttribute('width', String(i.naturalWidth));
    i.setAttribute('height', String(i.naturalHeight));
    return had;
  });
  const b195 = imgs.map(sizeOf);
  if (htmlStyle === null) html.removeAttribute('style');
  else html.setAttribute('style', htmlStyle);
  const b390 = imgs.map(sizeOf);
  const same = (a, b) => Math.abs(a[0] - b[0]) <= 0.5 && Math.abs(a[1] - b[1]) <= 0.5;
  let sized = 0;
  imgs.forEach((img, k) => {
    if (same(a390[k], b390[k]) && same(a195[k], b195[k])) {
      sized++;
      return;
    }
    const [w, h] = added[k];
    if (w === null) img.removeAttribute('width');
    else img.setAttribute('width', w);
    if (h === null) img.removeAttribute('height');
    else img.setAttribute('height', h);
  });

  // 2. Stable ids.
  let rid = 0;
  for (const el of doc.querySelectorAll('*')) el.setAttribute('data-rid', String(++rid));

  // 3. Styles that exist only in the CSSOM.
  const ruleText = (sheet) => {
    try {
      return [...sheet.cssRules].map((r) => r.cssText).join('\n');
    } catch {
      return null;
    }
  };
  const countRules = (text) => {
    try {
      const s = new CSSStyleSheet();
      s.replaceSync(text.replace(/@import[^;]+;/g, ''));
      return s.cssRules.length;
    } catch {
      return 0;
    }
  };
  let frozen = 0;
  for (const st of doc.querySelectorAll('style')) {
    if (!st.sheet) continue;
    const rules = [...(st.sheet.cssRules || [])].filter((r) => !(r instanceof CSSImportRule)).length;
    const text = st.textContent || '';
    if (rules > 0 && (text.trim() === '' || rules > countRules(text))) {
      const t = ruleText(st.sheet);
      if (t) {
        st.textContent = t;
        frozen++;
      }
    }
  }
  const extraHead = [];
  if (doc.adoptedStyleSheets && doc.adoptedStyleSheets.length) {
    extraHead.push({ kind: 'adopted', css: doc.adoptedStyleSheets.map(ruleText).filter(Boolean).join('\n') });
  }
  const faces = (window.__capFontFaces || []).filter((f) => /url\(/.test(f.source));
  if (faces.length) {
    const css = faces
      .map((f) => {
        const d = Object.entries(f.descriptors || {})
          .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}:${v};`)
          .join('');
        return `@font-face{font-family:${JSON.stringify(f.family)};src:${f.source};${d}}`;
      })
      .join('\n');
    extraHead.push({ kind: 'fontface', css });
  }

  // 4. What the clone can't keep by itself: chosen image sources, canvas pixels, shadow roots.
  const current = {};
  for (const img of doc.images) if (img.currentSrc && !img.currentSrc.startsWith('data:')) current[img.dataset.rid] = img.currentSrc;
  for (const v of doc.querySelectorAll('video,audio')) if (v.currentSrc) current[v.dataset.rid] = v.currentSrc;
  const canvases = [];
  for (const c of doc.querySelectorAll('canvas')) {
    if (!c.width || !c.height || !c.getClientRects().length) continue;
    try {
      canvases.push({ rid: c.dataset.rid, data: c.toDataURL('image/png') });
    } catch {
      /* tainted */
    }
  }
  const shadows = [];
  const openRoots = (root) => {
    const out = [];
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) out.push(el.shadowRoot, ...openRoots(el.shadowRoot));
    return out;
  };
  for (const el of doc.querySelectorAll('*')) {
    const sr = el.shadowRoot;
    if (!sr) continue;
    const inner = typeof sr.getHTML === 'function' ? sr.getHTML({ shadowRoots: openRoots(sr) }) : sr.innerHTML;
    const adopted = (sr.adoptedStyleSheets || []).map(ruleText).filter(Boolean).join('\n');
    shadows.push({ rid: el.dataset.rid, html: (adopted ? `<style>${adopted}</style>` : '') + inner });
  }

  // 5. The clone.
  const root = html.cloneNode(true);
  const byRid = (r) => root.querySelector(`[data-rid="${r}"]`) || (root.getAttribute('data-rid') === r ? root : null);
  for (const s of shadows) {
    const host = byRid(s.rid);
    if (!host) continue;
    const t = doc.createElement('template');
    t.setAttribute('shadowrootmode', 'open');
    t.innerHTML = s.html;
    host.prepend(t);
  }
  const head = root.querySelector('head');
  for (const x of extraHead) {
    const st = doc.createElement('style');
    st.setAttribute('data-capture', x.kind);
    st.textContent = x.css;
    head.append(st);
  }
  const all = (node) => {
    const out = [];
    for (const el of node.querySelectorAll('*')) {
      out.push(el);
      if (el.tagName === 'TEMPLATE') out.push(...all(el.content));
    }
    return out;
  };

  // 6. Strip.
  const removed = { scripts: 0, noscript: 0, hints: 0, httpEquiv: 0, handlers: 0, base: 0, otherLinks: 0 };
  const hosts = {};
  for (const el of doc.querySelectorAll('script[src]')) {
    const u = abs(el.getAttribute('src'));
    if (u) {
      const h = new URL(u).host;
      if (!sameSite.has(h)) hosts[h] = (hosts[h] || 0) + 1;
    }
  }
  // <link>s that make the browser fetch something on their own; the rest (canonical, alternate, Parsoid's
  // mw:PageProp links in the body…) stay as they are.
  const FETCHING = /(^|\s)(manifest|search|import|pingback)(\s|$)/i;
  const HINT = /(^|\s)(preload|modulepreload|prefetch|preconnect|dns-prefetch|prerender)(\s|$)/i;
  for (const el of all(root)) {
    const tag = el.tagName;
    if (tag === 'SCRIPT') {
      el.remove();
      removed.scripts++;
      continue;
    }
    if (tag === 'NOSCRIPT') {
      el.remove();
      removed.noscript++;
      continue;
    }
    if (tag === 'BASE') {
      el.remove();
      removed.base++;
      continue;
    }
    if (tag === 'META' && el.hasAttribute('http-equiv')) {
      el.remove();
      removed.httpEquiv++;
      continue;
    }
    if (tag === 'LINK') {
      const rel = el.getAttribute('rel') || '';
      if (HINT.test(rel)) {
        el.remove();
        removed.hints++;
        continue;
      }
      if (FETCHING.test(rel)) {
        el.remove();
        removed.otherLinks++;
        continue;
      }
    }
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name)) {
        el.removeAttribute(a.name);
        removed.handlers++;
      }
    }
    el.removeAttribute('nonce');
    el.removeAttribute('integrity');
    // Links: same site -> root-relative (the engine reads them as "this website"); other sites stay absolute.
    const linkAttr = tag === 'A' || tag === 'AREA' ? 'href' : tag === 'FORM' ? 'action' : null;
    if (linkAttr && el.hasAttribute(linkAttr)) {
      const v = (el.getAttribute(linkAttr) || '').trim();
      if (v && !v.startsWith('#') && !/^(javascript|mailto|tel|sms|data):/i.test(v)) {
        const u = abs(v);
        if (u && /^https?:/.test(u)) {
          const p = new URL(u);
          el.setAttribute(linkAttr, sameSite.has(p.hostname.toLowerCase()) ? p.pathname + p.search + p.hash : p.href);
        }
      }
    }
  }

  // Trees the parser can't rebuild and the browser never draws: elements a script put in <head> (an <iframe> there
  // would push the rest of <head> into <body>), and elements inside an <iframe> (parsed as text).
  const HEAD_OK = new Set(['BASE', 'LINK', 'META', 'NOSCRIPT', 'SCRIPT', 'STYLE', 'TEMPLATE', 'TITLE']);
  removed.headStrays = 0;
  removed.iframeChildren = 0;
  for (const el of [...root.querySelector('head').children]) {
    if (!HEAD_OK.has(el.tagName)) {
      el.remove();
      removed.headStrays++;
    }
  }
  for (const f of root.querySelectorAll('iframe')) {
    if (f.children.length) {
      removed.iframeChildren += f.children.length;
      f.replaceChildren();
    }
  }

  // Links inside links (built by script; the parser can't hold them). Each child of the outer link that holds an
  // inner link moves to just after the outer link, so the HTML parses as written; behaviours.js puts it back with DOM
  // calls at load. Entries: [outer rid, child rid, rid of the child's next element sibling or null].
  const renest = [];
  for (const outer of root.querySelectorAll('a')) {
    if (!outer.querySelector('a')) continue;
    for (const child of [...outer.children]) {
      if (child.tagName !== 'A' && !child.querySelector('a')) continue;
      const next = child.nextElementSibling;
      renest.push([outer.getAttribute('data-rid'), child.getAttribute('data-rid'), next ? next.getAttribute('data-rid') : null]);
    }
  }
  for (const [o, c] of [...renest].reverse()) {
    const outer = root.querySelector(`[data-rid="${o}"]`);
    const child = root.querySelector(`[data-rid="${c}"]`);
    if (outer && child) outer.after(child);
  }

  // 7. References to store. srcset keeps the candidates the live page loaded (or one fetched for DPR 3).
  const refs = new Set();
  const inlineCss = [];
  const keep = {};
  const parseSrcset = (v) =>
    v
      .split(/,(?=\s*\S)/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const m = p.match(/^(\S+)(?:\s+(.+))?$/);
        return m ? { url: m[1], d: (m[2] || '').trim() } : null;
      })
      .filter(Boolean);
  const pick = (cands) => {
    // The candidate a DPR-3, 390 px phone would choose: >= 3x or >= 1170w, else the largest.
    const score = (c) => {
      const m = c.d.match(/^([\d.]+)([wx])$/);
      if (!m) return 1;
      return m[2] === 'x' ? Number(m[1]) : Number(m[1]) / 390;
    };
    const s = cands.map((c) => ({ c, s: score(c) })).sort((a, b) => a.s - b.s);
    return (s.find((x) => x.s >= 3) || s[s.length - 1]).c;
  };
  const addRef = (u) => {
    if (u && /^https?:/.test(u)) refs.add(bare(u));
  };
  const srcsetRefs = (el, attr, key, cur) => {
    const v = el.getAttribute(attr);
    if (!v) return;
    const cands = parseSrcset(v)
      .map((c) => ({ ...c, abs: abs(c.url) }))
      .filter((c) => c.abs && /^https?:/.test(c.abs));
    let k = cands.filter((c) => have.has(bare(c.abs)) || (cur && bare(c.abs) === bare(cur)));
    if (!k.length && cands.length) k = [pick(cands)];
    keep[key] = k.map((c) => ({ abs: c.abs, d: c.d }));
    for (const c of k) addRef(c.abs);
  };
  for (const el of all(root)) {
    const tag = el.tagName;
    const r = el.getAttribute('data-rid') || '';
    const cur = current[r];
    if (tag === 'IMG') {
      if (cur) addRef(cur);
      else if (el.getAttribute('src')) addRef(abs(el.getAttribute('src')));
      srcsetRefs(el, 'srcset', r + ':srcset', cur);
    } else if (tag === 'SOURCE') {
      const parentCur = el.parentElement ? current[el.parentElement.querySelector('img')?.getAttribute('data-rid') || ''] : null;
      srcsetRefs(el, 'srcset', r + ':srcset', parentCur);
      if (el.getAttribute('src')) addRef(abs(el.getAttribute('src')));
    } else if (tag === 'VIDEO' || tag === 'AUDIO') {
      if (el.getAttribute('poster')) addRef(abs(el.getAttribute('poster')));
    } else if (tag === 'INPUT' && (el.getAttribute('type') || '').toLowerCase() === 'image') {
      addRef(abs(el.getAttribute('src') || ''));
    } else if (tag === 'LINK' && /stylesheet|icon/i.test(el.getAttribute('rel') || '')) {
      addRef(abs(el.getAttribute('href') || ''));
    } else if (tag === 'image' || tag === 'use' || tag === 'feImage' || tag === 'IMAGE' || tag === 'USE') {
      const h = el.getAttribute('href') || el.getAttribute('xlink:href');
      if (h && !h.startsWith('#')) addRef(abs(h));
    } else if (tag === 'OBJECT') {
      if (el.getAttribute('data')) addRef(abs(el.getAttribute('data')));
    } else if (tag === 'EMBED') {
      if (el.getAttribute('src')) addRef(abs(el.getAttribute('src')));
    }
    if (el.hasAttribute('background')) addRef(abs(el.getAttribute('background')));
    if (tag === 'STYLE') {
      inlineCss.push({ key: 'text:' + r, css: el.textContent || '' });
    } else {
      const st = el.getAttribute('style');
      if (st && /url\(|image-set\(/i.test(st)) inlineCss.push({ key: 'attr:' + r, css: st });
    }
  }
  // Late-added <style> elements without a rid (shadow templates, extra head styles) get one.
  let extra = 0;
  for (const el of all(root)) {
    if (el.tagName === 'STYLE' && !el.getAttribute('data-rid')) {
      const k = 'x' + ++extra;
      el.setAttribute('data-cap-key', k);
      inlineCss.push({ key: 'text:' + k, css: el.textContent || '' });
    }
  }

  const frames = [];
  for (const f of all(root)) {
    if (f.tagName !== 'IFRAME') continue;
    frames.push({ rid: f.getAttribute('data-rid'), src: f.getAttribute('src') ? abs(f.getAttribute('src')) : '', shot: f.getAttribute('data-cap-shot') });
  }

  window.__cap = { root, keep, current };
  return {
    refs: [...refs],
    inlineCss,
    frames,
    canvases,
    removed,
    renest,
    thirdPartyScriptHosts: hosts,
    rids: rid,
    imagesSized: sized,
    imagesChecked: imgs.length,
    stylesFrozen: frozen,
    shadowRoots: shadows.length,
    doctype: doc.doctype ? new XMLSerializer().serializeToString(doc.doctype) : '',
    baseURI: doc.baseURI,
  };
}

/**
 * Points the clone at the stored files, fills iframes with local snapshots, adds the study's head and body tags,
 * and serialises. Returns the HTML and the clone's tree signature (for the round-trip check).
 */
export function rewriteInPage(o) {
  const doc = document;
  const { root, keep, current } = window.__cap;
  const map = o.map; // absolute URL without hash -> local path
  const abs = (u) => {
    try {
      return new URL(u, doc.baseURI).href;
    } catch {
      return null;
    }
  };
  const local = (u) => {
    if (!u) return null;
    const a = abs(u);
    if (!a) return null;
    const [b, h] = a.split('#');
    const l = map[b];
    return l ? l + (h !== undefined ? '#' + h : '') : null;
  };
  const all = (node) => {
    const out = [];
    for (const el of node.querySelectorAll('*')) {
      out.push(el);
      if (el.tagName === 'TEMPLATE') out.push(...all(el.content));
    }
    return out;
  };
  const missing = new Set();
  const swap = (el, attr) => {
    const v = el.getAttribute(attr);
    if (!v || v.startsWith('data:') || v.startsWith('#')) return;
    const l = local(v);
    if (l) el.setAttribute(attr, l);
    else {
      missing.add(abs(v) || v);
      el.removeAttribute(attr);
    }
  };
  const writeSrcset = (el, attr, key) => {
    if (!el.hasAttribute(attr)) return;
    const k = (keep[key] || []).map((c) => (map[c.abs.split('#')[0]] ? `${map[c.abs.split('#')[0]]}${c.d ? ' ' + c.d : ''}` : null)).filter(Boolean);
    if (k.length) el.setAttribute(attr, k.join(', '));
    else el.removeAttribute(attr);
  };
  const css = o.css; // key -> rewritten css
  for (const el of all(root)) {
    const tag = el.tagName;
    const r = el.getAttribute('data-rid') || '';
    if (tag === 'IMG') {
      const cur = current[r];
      const l = cur ? local(cur) : null;
      if (l) el.setAttribute('src', l);
      else swap(el, 'src');
      writeSrcset(el, 'srcset', r + ':srcset');
    } else if (tag === 'SOURCE') {
      writeSrcset(el, 'srcset', r + ':srcset');
      if (el.hasAttribute('src')) swap(el, 'src');
    } else if (tag === 'VIDEO' || tag === 'AUDIO') {
      const src = el.getAttribute('src') || current[r];
      if (src) el.setAttribute('data-capture-src', abs(src) || src);
      el.removeAttribute('src');
      for (const s of el.querySelectorAll('source')) {
        if (s.getAttribute('src')) s.setAttribute('data-capture-src', abs(s.getAttribute('src')));
        s.removeAttribute('src');
      }
      if (el.hasAttribute('poster')) swap(el, 'poster');
      const shot = el.getAttribute('data-cap-shot');
      if (!el.hasAttribute('poster') && shot && o.shots[shot]) el.setAttribute('poster', o.shots[shot]);
    } else if (tag === 'TRACK') {
      swap(el, 'src');
    } else if (tag === 'INPUT' && (el.getAttribute('type') || '').toLowerCase() === 'image') {
      swap(el, 'src');
    } else if (tag === 'LINK' && /stylesheet|icon/i.test(el.getAttribute('rel') || '')) {
      swap(el, 'href');
      if (!el.hasAttribute('href')) el.remove();
    } else if (tag === 'image' || tag === 'use' || tag === 'feImage' || tag === 'IMAGE' || tag === 'USE') {
      for (const a of ['href', 'xlink:href']) if (el.hasAttribute(a)) swap(el, a);
    } else if (tag === 'OBJECT') {
      swap(el, 'data');
    } else if (tag === 'EMBED') {
      swap(el, 'src');
    } else if (tag === 'IFRAME') {
      // The engine reads the iframe's src (ad network, video, map…); srcdoc makes sure nothing loads from it.
      const src = el.getAttribute('src');
      if (src) el.setAttribute('src', abs(src) || src);
      const shot = el.getAttribute('data-cap-shot');
      const img = shot && o.shots[shot];
      el.setAttribute(
        'srcdoc',
        img
          ? `<!doctype html><html><head><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}img{display:block;width:100%;height:100%}</style></head><body><img src="${img}" alt=""></body></html>`
          : '<!doctype html><html><head><style>html,body{margin:0;background:transparent}</style></head><body></body></html>',
      );
    } else if (tag === 'CANVAS' && o.canvases[r]) {
      el.style.setProperty('background', `url("${o.canvases[r]}") 0 0 / 100% 100% no-repeat`);
    }
    if (el.hasAttribute('background')) swap(el, 'background');
    if (tag === 'STYLE') {
      const k = 'text:' + (el.getAttribute('data-cap-key') || r);
      if (css[k] !== undefined) el.textContent = css[k];
      el.removeAttribute('data-cap-key');
    } else if (css['attr:' + r] !== undefined) {
      el.setAttribute('style', css['attr:' + r]);
    }
    el.removeAttribute('data-cap-shot');
  }

  // The study's tags: the frame runtime first in <head>; the behaviours module last in <body>.
  const head = root.querySelector('head');
  const meta = doc.createElement('meta');
  meta.setAttribute('name', 'robots');
  meta.setAttribute('content', 'noindex, nofollow, noarchive');
  head.insertBefore(meta, head.firstChild);
  const tsa = doc.createElement('style');
  tsa.setAttribute('data-study', 'text-size-adjust');
  tsa.textContent = 'html{-webkit-text-size-adjust:100%;text-size-adjust:100%}';
  head.insertBefore(tsa, meta.nextSibling);
  const frame = doc.createElement('script');
  frame.setAttribute('type', 'module');
  frame.setAttribute('src', '/_study/frame.js');
  head.insertBefore(frame, head.firstChild);
  const body = root.querySelector('body');
  if (o.behavioursSrc) {
    const s = doc.createElement('script');
    s.setAttribute('type', 'module');
    s.setAttribute('src', o.behavioursSrc);
    body.append(s);
  }

  // Tree signature: rid -> [tag, parent rid, index among element children, element child count].
  const sig = {};
  const sign = (el) => {
    const r = el.getAttribute('data-rid');
    if (!r) return;
    const p = el.parentElement;
    sig[r] = [el.tagName.toLowerCase(), p ? p.getAttribute('data-rid') || '' : '', p ? [...p.children].indexOf(el) : 0, el.children.length];
  };
  sign(root);
  for (const el of root.querySelectorAll('[data-rid]')) sign(el);

  return { html: (o.doctype ? o.doctype + '\n' : '') + root.outerHTML + '\n', signature: sig, missing: [...missing] };
}

/** The tree signature of an HTML string as the HTML parser builds it (runs in a blank page). */
export function reparseSignature(html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  const sig = {};
  const extra = [];
  for (const el of d.querySelectorAll('*')) {
    const r = el.getAttribute('data-rid');
    const p = el.parentElement;
    if (!r) {
      const ours =
        el.tagName === 'SCRIPT' ||
        (el.tagName === 'META' && el.getAttribute('name') === 'robots') ||
        (el.tagName === 'TEMPLATE' && el.hasAttribute('shadowrootmode')) ||
        el.hasAttribute('data-study') ||
        el.hasAttribute('data-capture');
      if (!ours) extra.push([el.tagName.toLowerCase(), p ? p.getAttribute('data-rid') || '' : '']);
      continue;
    }
    sig[r] = [el.tagName.toLowerCase(), p ? p.getAttribute('data-rid') || '' : '', p ? [...p.children].indexOf(el) : 0, el.children.length];
  }
  return { sig, extra };
}
