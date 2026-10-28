# Shared replica behaviours

Small ES modules that re-create what a live page's own scripts did, served at `/_r/_shared/behaviours/<name>.js`.
Each exports `init(root, options)` and returns a handle with `destroy()` (some also expose `open`/`close`). No globals,
no prototype patches, no history changes, no storage, no randomness: the same taps and scroll give the same page
every time, in both conditions. Links are never intercepted here; the frame runtime handles navigation.

A replica uses them through `behaviours` in its `capture.config.mjs`; capture writes `site/behaviours.js`:

```js
import { init as accordion } from '/_r/_shared/behaviours/accordion.js';
accordion(document, { trigger: '[data-bs-toggle="collapse"]', panel: 'attr:data-bs-target', closed: 'class', openClass: 'show', triggerClosedClass: 'collapsed', exclusive: 'data-bs-parent' });
```

Options are plain JSON. Selectors are the site's own, so the site's CSS draws every state. Full option lists are in
each file's JSDoc.

| Module | What it does | Key options |
|---|---|---|
| `accordion` | A tap on a trigger opens or closes its panel; aria-expanded, the site's classes and the `hidden` attribute change as on the live site. With `closed: 'until-found'` closed panels are `hidden="until-found"`, so the browser's Find on Page finds their text; `beforematch` then opens the section properly. | `trigger`, `button`, `panel` (`aria-controls` / `attr:<name>` / `next` / selector in `item`), `closed` (`until-found` / `hidden` / `class`), `openClass`, `triggerClosedClass`, `icon`, `exclusive` (`true` or a panel attribute such as `data-bs-parent`), `ignore` |
| `consent` | A consent or cookie banner with its real buttons; any of them dismisses it and unlocks scrolling. Shown from the start (as captured) or after a fixed delay. Works inside an open shadow root. | `banner`, `dismiss`, `host`, `overlay`, `showAfterMs`, `hiddenClass`, `remove`, `lockClasses`, `clearLockStyles` |
| `sticky-header` | Header classes from scroll position: stuck past an offset, and optional hide on scroll down / show on scroll up. | `header`, `stuckClass`, `offset`, `hideClass`, `delta`, `pageClass` |
| `menu-drawer` | Hamburger menu: toggle opens, close button / backdrop / Escape close; aria-expanded and the site's classes. (Bootstrap menus are simpler as `accordion`.) | `toggle`, `drawer`, `close`, `backdrop`, `openClass`, `hidden`, `pageClass`, `toggleOpenClass` |
| `carousel` | Previous / next, dots and horizontal swipe; translate the track, toggle an active class, or scroll a scroll-snap track. Optional fixed-interval autoplay that stops at the first touch. | `carousel`, `slide`, `track`, `mode`, `prev`, `next`, `dot`, `activeClass`, `start`, `loop`, `autoplayMs`, `swipe` |
| `autoplay-video` | Muted, inline, looping autoplay of a local clip, so the page moves as the live one does. | `video`, `src`, `type`, `poster`, `loop` |
| `floating-video` | A player that floats in a corner once its slot leaves the screen (or at a fixed scroll position), with its close button; the slot keeps its height. | `player`, `slot`, `floatClass`, `box`, `atY`, `close` |
| `ad-slot` | What ad slots do over time: appear after a fixed delay (the live layout shift), an adhesion ad's close button, an optional local creative for slots captured empty. The creative itself comes from capture (iframe `srcdoc` snapshot, original `src` kept). | `slot`, `revealAfterMs`, `close`, `creative` |
| `reveal-on-scroll` | Content the live page adds late (kept with `hidden` by the capture's `fixDom`) appears once an element comes near the screen, at a fixed scroll position, or near the page end. | `target`, `near`, `marginPx`, `atY`, `nearEndPx` |

Page-specific behaviour goes in the replica's own `site/page.js` (`export function init(root) {}`), which capture
imports after the shared ones. Keep it to the same rules.

## Rules for a new module

- `export function init(root, options)`; `root` is usually `document`. Return `{ destroy() }`.
- Listen on `root` (delegation) so the engine's own clicks on the original elements (the simplified page proxies taps
  to them) work too. Don't stop propagation.
- Timers use fixed delays from the options; scroll-driven changes fire at fixed scroll positions.
- Mirror the live site's DOM changes (attributes, classes) rather than drawing new UI; the site's CSS stays in charge.
- No `localStorage`, cookies, `history`, globals or network requests.
