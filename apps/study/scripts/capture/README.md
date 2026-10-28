# Capturing a replica

These scripts turn a live mobile page into a frozen copy under `apps/study/replicas/<id>/`, check it against the live
page, and help write its task. Run everything from `apps/study/`. Playwright 1.64.1 and its Chromium are already
installed there.

```
node scripts/capture/capture.mjs <id>              # live page -> replicas/<id>/ (about 1 minute)
node scripts/capture/validate.mjs <id>             # copy vs live reference -> manifest.validation
node scripts/capture/find.mjs <id> "4:30 p.m." --tap '<css of the section button>'   # depth + selector for task.json
node scripts/capture/roundtrip.mjs <id>            # re-run the HTML round-trip check alone
node scripts/capture/capture.mjs <id> --checks-only   # re-run only the live behaviour checks after editing them
```

Set `STUDY_REPLICAS=/some/scratch/dir` to capture into another folder for a dry run (the config then lives in
`<dir>/<id>/capture.config.mjs`; the shared behaviours still come from the repo).

Look at the screenshots yourself afterwards: `reference/live-top.png` vs `reference/copy-top.png`,
`reference/diff-top.png`, `reference/diff-full.png`, and `reference/copy-w195.png` for the narrowest layout.

## What capture does

The phone is fixed (`lib/context.mjs`): iPhone 15 user agent, 390×844 CSS px, DPR 3, touch, `en-US`,
`America/New_York`, light scheme, Chromium.

1. Loads the page, waits for `load`, then for the network to go quiet (capped at `networkIdleMs`), fonts, and
   `settleMs`. Every stylesheet, image, font and media body the page loads is kept.
2. Runs your `prepare(page, h)` hook: choose the start state (dismiss nothing by default).
3. Saves the **live reference** in that state: `reference/live-top.png` (first screen, DPR 3), `live-full.png` (full
   page, CSS scale), `live-metrics.json`, and a HAR of the load (`live.har.zip`).
4. Runs your `expand(page, h)` hook (open collapsed regions so their lazy content loads), scrolls the whole page,
   screenshots every visible iframe and video (fixed layers hidden while shooting), then runs `restore(page, h)` to
   return to the start state.
5. Freezes the DOM (`lib/inpage.mjs`):
   - loaded images without both `width` and `height` get them, **only** where that changes no box at 390 px and at
     195 px wide;
   - `data-rid` on every element (document order);
   - styles that exist only in the CSSOM (`insertRule`, adopted sheets, `new FontFace(...)`) are written back as text;
   - open shadow roots become `<template shadowrootmode="open">`;
   - scripts, `noscript`, `on*` handlers, preload/prefetch/preconnect hints, `meta[http-equiv]`, `<base>`, `nonce`,
     `integrity` and unusual `<link>`s are removed;
   - same-site links (`sameSite` hosts) become root-relative (`/ever/planyourvisit/fees.htm`) so the engine reads
     them as "this website"; other sites' links stay absolute. Links are **not** intercepted: the frame runtime blocks
     navigation in both conditions.
6. Runs your `fixDom(root, document)` hook on the clone (see "Round trip").
7. Stores every referenced file once under its content hash: `site/assets/<sha1>.<ext>`, referenced as
   `/_r/<id>/assets/<sha1>.<ext>`. That covers `src`, the `srcset` candidates the page actually loaded (or one picked
   for DPR 3), posters, icons, SVG `<use>`/`<image>`, inline `style` and `<style>` `url()`s, and every stylesheet,
   rewritten first so its own `url()`/`@import` (fonts, icons, backgrounds) point at stored files. Anything that can't
   be fetched becomes `url("data:,")` or a removed attribute, never an outside URL. Web fonts come along with their
   CSS.
8. **Iframes keep their original `src`** (the engine classifies ad, video and map frames by it) and get a `srcdoc`
   holding the live screenshot (or an empty page), so nothing loads from the other host. **Videos** lose their stream
   (`data-capture-src` keeps the original) and get the screenshot as `poster`; give them a local clip with the
   `autoplay-video` behaviour.
9. Writes `site/<file>` with `<script type="module" src="/_study/frame.js"></script>` as the **first child of
   `<head>`**, then `meta robots` and an `html{-webkit-text-size-adjust:100%}` style, and
   `<script type="module" src="/_r/<id>/behaviours.js">` as the last element of `<body>`.
10. Writes `site/behaviours.js` from `behaviours` in the config (plus `site/page.js` if you wrote one),
    `manifest.json`, `ATTRIBUTION.md` (only if missing: edit it by hand), `reference/live-tree.json`, then reloads
    the live page to record the layouts at 390/312/260/223/195 px (`live-widths.json`, `live-w*.png`) and run your
    `checks` (`live-checks.json`). Finally it runs the round-trip check.

Capture owns `site/<file>`, `site/behaviours.js` and `site/assets/` and rewrites them every run. Hand-made files go in
`site/page.js` (a module exporting `init(root)`) and `site/local/` (clips, creatives), which capture never touches.
`reference/` is gitignored and never served.

## The config: `replicas/<id>/capture.config.mjs`

```js
export default {
  id: 'nps-ever-basic',                       // must match the folder
  url: 'https://www.nps.gov/ever/planyourvisit/basicinfo.htm',
  servePath: '/ever/planyourvisit/basicinfo.htm', // default: the URL's path. The original page's exact path.
  file: 'index.html',                         // default
  siteName: 'National Park Service',          // default: og:site_name, else the host
  licence: '…', attribution: '…',             // copied into manifest.json
  sameSite: ['www.nps.gov', 'nps.gov'],       // default: the host and its www twin
  settleMs: 1500, networkIdleMs: 15000,       // defaults
  srcset: 'loaded',                           // default; keeps the candidates the page loaded
  blockHosts: [],                             // regexes of hosts to abort during capture (e.g. ad bidders)
  maxScrollScreens: 40,
  referenceAfterScroll: false,                // true: take the live reference after one scroll pass (pages that add
                                              // modules/ads while you scroll, which the copy then has from the start)
  stateNotes: ['…'],                          // what start state you chose and why (manifest.capture.stateNotes)
  removed: ['…'],                             // extra notes for manifest.removed
  behaviourNotes: ['…'],                      // extra names for manifest.behaviours
  validationNotes: ['…'],                     // honest notes copied into manifest.validation.notes

  // Hooks (all optional). `h` = { sleep, log, scrollThrough(step, delay), clickAll(sel), removeAll(sel) }.
  async prepare(page, h) {},                  // after load, before the live reference: choose the start state
  async expand(page, h) {},                   // open collapsed regions so lazy content loads
  async restore(page, h) {},                  // back to the start state before the snapshot
  fixDom: (root, document) => {},             // runs IN THE PAGE on the detached clone (<html> element); arrow or
                                              // function syntax; no closures over config variables

  behaviours: [{ use: 'accordion', options: { … } }],   // replicas/_shared/README.md lists them
  checks: [{ name: 'open hours', run: async (page, h) => ({ expanded: 'true', growth: 149 }), tolerancePx: 2 }],
};
```

**Checks** are the behaviour checklist. Each `run` gets a fresh load (after `prepare` on the live side, and one scroll
pass down and back unless `scrollFirst: false`) and returns a flat object. Validation compares the copy's values with
the live ones: numbers within `tolerancePx` (default 2) or `tolerancePct`, everything else exactly. Use real taps
(`page.locator(…).tap()`), and return states the site exposes: `aria-expanded`, heights, page growth, scroll position.

## Choosing the start state

Pick it on purpose, the same for every participant and both conditions, and write it in `stateNotes`:
- **Consent and cookie notices:** keep them showing (they're part of the real page, and WebAble's handling of them is
  one of its effects). Recreate dismissal with the `consent` behaviour. Never click Accept during capture unless the
  task needs the consented page.
- **Random or rotating content** (app banners, A/B variants, ad rotation): remove or pin it in `prepare`, or re-capture
  until you get the common state. Nothing in the copy may change between loads.
- **Content that appears late** ("Related articles", newsletter modals): either remove it in `fixDom`, or keep it with
  the `hidden` attribute in `fixDom` and bring it back with `reveal-on-scroll` (fixed scroll position) or a fixed delay.
  Then the live reference (taken before the scroll) and the copy agree.

## Round trip

Scripts can build trees the HTML parser can't: an `<a>` inside an `<a>`, a block inside a `<p>`, a `<tr>` without
`<tbody>`. After serialising, the parser moves those elements and the copy renders differently.

- **Links inside links are handled for you.** Capture moves the part of the outer link that holds the inner link to
  just after it (so the HTML parses as written) and `behaviours.js` puts it back with DOM calls when the page loads,
  so the running page has the live tree (`renest-links` in `manifest.behaviours`). Wikipedia's map attribution needed
  it (an earlier practice page, no longer in the study).
- **Anything else:** `roundtrip.mjs` re-parses the saved HTML and compares the tree with `reference/live-tree.json`.
  It prints the root causes with their `data-rid`, a path, the likely cause and a fix. Fix them in `fixDom` (it runs
  on the clone, so `root.querySelector` works) and capture again until it reports 0. For example, a block inside a
  `<p>`: `fixDom: (root) => { for (const p of root.querySelectorAll('p.byline:has(div)')) { const d = document.createElement('div'); d.className = p.className; d.append(...p.childNodes); p.replaceWith(d); } }`.

## Validation (rule 8)

`validate.mjs` serves the copy from its own small server (same routes as `vite.config.ts`, with `/_study/frame.js`
stubbed so the copy is judged on its own) or from a running dev server with `--base http://127.0.0.1:<port>`. It
blocks and counts every request to another origin and records missing files. It then measures, at 390×844 DPR 3:

| Check | Target |
|---|---|
| Requests to other origins / missing files | 0 / 0 (hard failure) |
| Frame runtime tag first in `<head>` (file and DOM) | yes (hard failure) |
| First-screen pixels (channel delta > 24) | ≤ 0.5% |
| Full-page pixels (CSS scale) | ≤ 2%; `bandsCssPx` lists where the differences are |
| Scroll height, links | within 1% |
| Headings (count and order), tap targets, targets under 44 and 24 px | equal |
| Body and paragraph font size, text under 16 px | equal / within 1 point |
| Fixed-layer cover at load and 1.5 screens down | within 1 point |
| Widths 390/312/260/223/195 | no sideways scroll beyond what the live page has |
| Behaviour checks | equal within tolerance |

Results go to `manifest.validation` (summary) and `reference/validation.json` (with full metrics), screenshots to
`reference/copy-*.png` and `reference/diff-*.png`. If the live page changed since capture or a target can't be met,
say so in `validationNotes` rather than loosening the check.

## Task authoring

`find.mjs` loads the copy (or `--live`), runs `--tap` selectors in order (open the section first), and prints every
element containing the phrase with its depth in 844 px screens, `data-rid`, a unique CSS selector and visibility. Use
the selector for `answerSelector` and the live depth (`--live`) for `answerDepthScreens`. `answerText` should be the
fact itself plus 2-3 neighbouring words, so it survives in the simplified page.

## Gotchas found so far

- `scroll-behavior: smooth` on the site makes `scrollTo` animate; the scripts always scroll with
  `behavior: 'instant'`. Do the same in hooks and checks.
- `content-visibility: auto` makes `scrollHeight` depend on what has been scrolled past. Checks scroll the page once
  first for this reason; compare heights after the same scroll on both sides.
- `expand` can make the page very long (Wikipedia with every section open is ~60,000 px), and the automatic scroll
  pass stops at `maxScrollScreens`. Content that loads only near the end ("Related articles") then never loads: scroll
  again in `restore`, once the page is short again: close the sections you opened, then `h.scrollThrough()` and wait
  for the network.
- Campaign banners, app-install prompts and A/B content appear on some loads only. Remove them in `prepare` (a
  `MutationObserver` there keeps late ones out too) and say so in `stateNotes`.
- Pages that add content while you scroll (AP adds modules, teasers and ads; 1 visible heading at load, 8 after a
  scroll) end up with that content in the copy from the start, so a reference taken at load won't match. Either set
  `referenceAfterScroll: true` (the copy is then "the page after one scroll", and say so in `stateNotes`), or hide the
  late content in `fixDom` and bring it back with `reveal-on-scroll`.
- Live pages vary between loads. Capture and validation compare against the reference saved in the same capture run,
  never against a fresh live load.
- Site CSS that 404s on the live page also has no file in the copy (`url("data:,")`), so both render the same.
- Pages that keep the network busy (ads) hit `networkIdleMs`; that's expected. Use `blockHosts` only if you accept that
  those ads then won't appear in the copy.
