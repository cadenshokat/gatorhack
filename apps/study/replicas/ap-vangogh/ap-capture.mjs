// Capture setup shared by the two AP News articles (ap-vangogh, ap-mars). Same template, same hooks, same checks, so
// the pair carries the same page furniture: an 80 px sticky header, the lead video playing muted in a gallery, a
// leaderboard and in-story display ads, a Primis video player floating bottom right, the UsableNet accessibility
// button bottom left, a Nativo unit, a Dianomi feed and Viafoura comments.
//
// Each replica's capture.config.mjs calls apConfig(). The restore hook also records the two moving videos (the lead
// video and the floating player) from the live screen into site/local/*.mp4 with ffmpeg, right before the snapshot,
// so the clips match the player state the copy freezes.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Hosts aborted during capture (stateNotes say why): Wunderkind/BounceX adds a 260-300 px ad above the header after
// the first scroll on some loads only; Teads outstream video fills some in-story slots on some loads only.
const BLOCK = ['(^|\\.)bounceexchange\\.com$', '(^|\\.)bx-cloud\\.com$', '(^|\\.)wknd\\.ai$', '(^|\\.)teads\\.(tv|com)$'];
const RANDOM = '[id^="bx-campaign"], [id^="bx-shroud"], [id^="bx-hover-shroud"], [class*="bx-group-placeholder"], .teads-inread';

const CLIP_SECONDS = 12;

/** Keeps the lead video playing and away from its end, so the copy freezes the "playing" state (JW Player API). */
async function keepLeadPlaying(page, margin = 25) {
  return page.evaluate((margin) => {
    const el = document.querySelector('.jwplayer');
    const jw = window.jwplayer;
    if (!el || typeof jw !== 'function') return 'no player';
    const p = jw(el);
    try {
      const d = p.getDuration();
      if (p.getState() === 'complete' || (d > 0 && p.getPosition() > d - margin)) p.seek(0);
      p.play();
      return `${p.getState()} ${Math.round(p.getPosition())}/${Math.round(d)}`;
    } catch (e) {
      return String(e);
    }
  }, margin);
}

/**
 * Live page only, during capture: JW pauses the lead video while it is scrolled out of view and resumes it a moment
 * after it comes back. Resume at once, so the reference taken right after the scroll pass shows it playing, as a
 * reader sees it.
 */
async function holdLeadPlaying(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.jwplayer');
    const jw = window.jwplayer;
    if (!el || typeof jw !== 'function') return 'no player';
    const p = jw(el);
    p.on('pause', () => setTimeout(() => p.play(), 30));
    p.on('complete', () => setTimeout(() => (p.seek(0), p.play()), 30));
    return 'held';
  });
}

/**
 * Live page only, during capture: ad slots in and right after the story (the leaderboard, the FreeStar boxes, the Nativo
 * unit) that are still empty (no ad, or a blocked outstream) are asked for an ad once more, so both pages carry a full
 * ad load.
 * Returns the empty slot ids before the retry.
 */
async function refillEmptySlots(page) {
  return page.evaluate(() => {
    const g = window.googletag;
    if (!g || typeof g.pubads !== 'function') return [];
    const pa = g.pubads();
    const filled = (el) => [...el.querySelectorAll('iframe')].some((f) => f.getBoundingClientRect().height >= 40);
    const empty = pa.getSlots().filter((s) => {
      const el = document.getElementById(s.getSlotElementId());
      return !!el && !!el.closest('.RichTextStoryBody, .LeaderBoardAd-Mobile, [class*="ntv-below-article"]') && !filled(el);
    });
    if (empty.length) pa.refresh(empty);
    return empty.map((s) => s.getSlotElementId());
  });
}

/**
 * Live page only, during capture: once every slot has filled, stop Google Publisher Tag from refreshing or replacing
 * ads, so the reference, the creative screenshots and the snapshot all show the same ads. Returns a summary with the
 * in-story slots still empty.
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
    const boxes = [...document.querySelectorAll('.RichTextStoryBody > .FreeStar, .LeaderBoardAd-Mobile, [class*="ntv-below-article"]')];
    const empty = boxes.filter((b) => ![...b.querySelectorAll('iframe')].some((f) => f.getBoundingClientRect().height >= 40)).length;
    return `froze ${n} GPT slots; ${boxes.length - empty} of ${boxes.length} story ad boxes filled`;
  });
}

/**
 * The floating player is playing a video with at least `left` seconds still to go (between videos it shows a still
 * thumbnail; video ads end after 15-30 s). Its own videos come first, then ads. Returns the video or null.
 */
function floatVideo(left) {
  const n = document.querySelector('[id^="native_playerSekindo"]');
  if (!n) return null;
  const ok = (v) =>
    !v.paused &&
    v.currentTime > 0.3 &&
    (!(v.duration > 0) || v.duration === Infinity || v.duration - v.currentTime > left) &&
    v.getBoundingClientRect().width > 40 &&
    v.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  const vids = [...n.querySelectorAll('video')];
  return vids.find((v) => ok(v) && v.closest('#videoContainerDiv')) ?? vids.find(ok) ?? null;
}

/**
 * Records the visible lead video and floating-player video from the screen (a loop of CDP screenshots) and writes
 * <outDir>/lead.mp4 and <outDir>/float.mp4 (H.264, muted, 2x). Marks the floating player's visible video with
 * data-study-clip="float" so the copy knows which element gets the clip.
 */
async function recordClips(page, outDir, log, keep = []) {
  const boxes = await page.evaluate((src) => {
    const box = (e) => {
      const r = e.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const shown = (v) => {
      const r = v.getBoundingClientRect();
      return r.width > 40 && r.height > 40 && r.bottom > 0 && r.top < innerHeight && v.readyState >= 2;
    };
    const out = {};
    const lead = document.querySelector('video.jw-video');
    if (lead && shown(lead)) out.lead = box(lead);
    const fl = (0, eval)(`(${src})`)(0);
    if (fl) {
      fl.setAttribute('data-study-clip', 'float');
      out.float = box(fl);
    }
    // Only the video pixels: hide the players' own controls and labels (the copy keeps them as DOM) and fixed layers.
    const st = document.createElement('style');
    st.id = '__ap-clip';
    st.textContent = [
      '.jwplayer * { visibility: hidden !important; }',
      '.jwplayer video.jw-video { visibility: visible !important; background: #000 !important; }',
      '.CarouselControls { visibility: hidden !important; }',
      '[id^="native_playerSekindo"] * { visibility: hidden !important; }',
      '[id^="native_playerSekindo"] video[data-study-clip] { visibility: visible !important; }',
      '#usntA40Toggle { visibility: hidden !important; }',
    ].join('\n');
    document.head.append(st);
    return out;
  }, floatVideo.toString());
  log(`clips: ${JSON.stringify(boxes)}`);
  for (const n of ['lead', 'float']) if (!keep.includes(n)) rmSync(join(outDir, `${n}.mp4`), { force: true });
  const tmp = join(outDir, '.frames');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  // Screenshots of the region holding both videos, as fast as they come (about 25-30 a second), at 2x.
  const S = 2;
  const all = Object.values(boxes);
  const top = Math.floor(Math.min(...all.map((b) => b.y)));
  const bottom = Math.ceil(Math.max(...all.map((b) => b.y + b.h)));
  const clip = { x: 0, y: top, width: 390, height: bottom - top, scale: S };
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  const t0 = Date.now();
  // Each frame also notes whether each video was still on screen and playing; a clip stops at its first bad frame.
  const state = () =>
    page.evaluate(() => {
      const ok = (v) => !!v && v.isConnected && !v.paused && v.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      return { lead: ok(document.querySelector('video.jw-video')), float: ok(document.querySelector('video[data-study-clip="float"]')) };
    });
  while (Date.now() - t0 < CLIP_SECONDS * 1000 + 500) {
    const t = Date.now() / 1000;
    const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, clip, optimizeForSpeed: true });
    frames.push({ t, data: r.data, ok: await state() });
  }
  await cdp.detach().catch(() => {});
  await page.evaluate(() => document.getElementById('__ap-clip')?.remove());
  if (frames.length < 10) {
    log(`clips: only ${frames.length} frames; not written`);
    return { lead: 0, float: 0 };
  }
  // Frame files plus a concat list with each frame's real duration.
  const lines = [];
  frames.forEach((f, i) => {
    const name = `f${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(join(tmp, name), Buffer.from(f.data, 'base64'));
    const next = frames[i + 1]?.t ?? f.t + 1 / 30;
    lines.push(`file '${name}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  lines.push(`file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'`);
  writeFileSync(join(tmp, 'list.txt'), lines.join('\n') + '\n');
  const even = (n) => Math.max(2, Math.floor(n / 2) * 2);
  const lengths = {};
  for (const [name, b] of Object.entries(boxes)) {
    const bad = frames.findIndex((f) => !f.ok[name]);
    const secs = Math.min(CLIP_SECONDS, (bad < 0 ? frames.at(-1).t : frames[bad].t) - frames[0].t);
    lengths[name] = Math.round(secs * 10) / 10;
    if (secs < 4) {
      lengths[name] = 0;
      log(`clips: ${name} played for only ${secs.toFixed(1)} s; not written`);
      continue;
    }
    if (keep.includes(name)) continue;
    const crop = `crop=${even(b.w * S)}:${even(b.h * S)}:${Math.round(b.x * S)}:${Math.round((b.y - top) * S)}`;
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-vf', `${crop},fps=30`, '-an', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'slow', '-movflags', '+faststart', '-t', secs.toFixed(2), join(outDir, `${name}.mp4`)]);
  }
  const fps = (frames.length / (frames.at(-1).t - frames[0].t)).toFixed(1);
  log(`clips: ${frames.length} frames at ${fps} fps (${S}x), seconds ${JSON.stringify(lengths)}`);
  rmSync(tmp, { recursive: true, force: true });
  return { lead: lengths.lead ?? 0, float: lengths.float ?? 0 };
}

// ------------------------------------------------------------------ checks

const visible = (page, sel) => page.locator(sel).filter({ visible: true }).first();
const toTop = (page) => page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

function menuState() {
  const w = document.querySelector('.Page-header-hamburger-menu-wrapper');
  const r = w.getBoundingClientRect();
  return {
    toggle: document.documentElement.getAttribute('data-toggle-header'),
    expanded: [...document.querySelectorAll('.Page-header.mobile-header .Page-header-menu-trigger')].map((b) => b.getAttribute('aria-expanded')).join(),
    left: Math.round(r.left),
    shown: getComputedStyle(w).visibility,
  };
}

function playerState() {
  const n = document.querySelector('[id^="native_playerSekindo"]');
  const r = n.getBoundingClientRect();
  const v = n.querySelector('video[data-study-clip]') ?? [...n.querySelectorAll('video')].find((x) => !x.paused);
  return {
    position: getComputedStyle(n).position,
    left: Math.round(r.left),
    bottomGap: Math.round(innerHeight - r.bottom),
    w: Math.round(r.width),
    h: Math.round(r.height),
    close: getComputedStyle(document.querySelector('#closeContainer')).display,
    playing: !!v && !v.paused,
  };
}

const checks = [
  {
    name: 'menu opens and closes',
    run: async (page) => {
      await toTop(page);
      await page.waitForTimeout(300);
      const t = visible(page, '.Page-header.mobile-header .Page-header-menu-trigger');
      await t.tap({ timeout: 8000 });
      await page.waitForTimeout(900);
      const open = await page.evaluate(menuState);
      await t.tap({ timeout: 8000 });
      await page.waitForTimeout(900);
      const closed = await page.evaluate(menuState);
      return { openToggle: open.toggle, openExpanded: open.expanded, openLeft: open.left, openShown: open.shown, closedToggle: closed.toggle, closedExpanded: closed.expanded, closedLeft: closed.left, closedShown: closed.shown };
    },
  },
  {
    name: 'lead gallery next and back',
    run: async (page) => {
      await toTop(page);
      await page.waitForTimeout(300);
      const slides = () =>
        page.evaluate(() =>
          [...document.querySelector('bsp-carousel.Carousel').querySelectorAll('.Carousel-slide')].map((s) => ({ sel: s.classList.contains('is-selected'), left: Math.round(s.getBoundingClientRect().left) })),
        );
      await visible(page, '.CarouselControls-nav--next button').tap({ timeout: 8000 });
      await page.waitForTimeout(1200);
      const a = await slides();
      await visible(page, '.CarouselControls-nav--prev button').tap({ timeout: 8000 });
      await page.waitForTimeout(1200);
      const b = await slides();
      return { nextSelected: a.findIndex((s) => s.sel), nextSlide2Left: a[1].left, backSelected: b.findIndex((s) => s.sel), backSlide1Left: b[0].left };
    },
  },
  {
    name: 'caption Read More',
    run: async (page) => {
      await toTop(page);
      await page.waitForTimeout(300);
      const rm = () =>
        page.evaluate(() => {
          const e = document.querySelector('bsp-carousel-read-more');
          return { status: e.getAttribute('data-carousel-readmore-status'), expanded: e.classList.contains('ReadMore-expand'), h: Math.round(e.getBoundingClientRect().height) };
        });
      const before = await rm();
      await visible(page, '.ReadMore-more-button').tap({ timeout: 8000 });
      await page.waitForTimeout(800);
      const after = await rm();
      return { beforeStatus: before.status, beforeH: before.h, afterStatus: after.status, afterExpanded: after.expanded, afterH: after.h };
    },
  },
  {
    name: 'Share sheet opens and closes',
    run: async (page) => {
      await toTop(page);
      await page.waitForTimeout(300);
      const state = () =>
        page.evaluate(() => {
          const pa = [...document.querySelectorAll('bsp-page-actions')].find((e) => e.getBoundingClientRect().height > 0);
          const w = pa.querySelector('.Page-actions-menu-wrap');
          const b = pa.querySelector('button[data-action-clicked="clickShareIcon"]');
          return { display: getComputedStyle(w).display, h: Math.round(w.getBoundingClientRect().height), state: JSON.parse(b.getAttribute('data-collapse-toggle') || '{}').state ?? null };
        });
      await visible(page, 'button.Page-actions-trigger[data-action-clicked="clickShareIcon"]').tap({ timeout: 8000 });
      await page.waitForTimeout(900);
      const open = await state();
      await visible(page, '.Page-actions-menu-title svg[data-collapse-close]').tap({ timeout: 8000 });
      await page.waitForTimeout(900);
      const closed = await state();
      return { openDisplay: open.display, openH: open.h, openState: open.state, closedDisplay: closed.display, closedState: closed.state };
    },
  },
  {
    name: 'floating player: floats, docks at its slot, close docks it',
    tolerancePx: 2,
    run: async (page) => {
      await toTop(page);
      await page.waitForTimeout(800);
      const top = await page.evaluate(playerState);
      const slotY = await page.evaluate(() => Math.round(document.querySelector('#placeHolder').getBoundingClientRect().top + scrollY));
      await page.evaluate((y) => window.scrollTo({ top: y - 300, behavior: 'instant' }), slotY);
      await page.waitForTimeout(1200);
      const atSlot = await page.evaluate(playerState);
      await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
      await page.waitForTimeout(1200);
      const away = await page.evaluate(playerState);
      await page.locator('#closeIconHit').first().tap({ force: true, timeout: 8000 });
      await page.waitForTimeout(1200);
      const closed = await page.evaluate(playerState);
      await page.evaluate(() => window.scrollTo({ top: 2500, behavior: 'instant' }));
      await page.waitForTimeout(800);
      const later = await page.evaluate(playerState);
      return {
        topPosition: top.position, topLeft: top.left, topBottomGap: top.bottomGap, topW: top.w, topH: top.h, topClose: top.close, topPlaying: top.playing,
        slotPosition: atSlot.position, slotW: atSlot.w, slotH: atSlot.h, slotClose: atSlot.close,
        awayPosition: away.position, awayW: away.w,
        closedPosition: closed.position, closedW: closed.w, closedClose: closed.close,
        laterPosition: later.position,
      };
    },
  },
  {
    name: 'accessibility button, sticky header, lead video box',
    run: async (page) => {
      await toTop(page);
      await page.waitForTimeout(1000);
      // Whether the lead video is playing is not compared: live plays it once (27-97 s) and then stops, the copy loops.
      const lead = await page.evaluate(() => {
        const v = document.querySelector('video.jw-video');
        const r = v.getBoundingClientRect();
        return { leadMuted: v.muted, leadW: Math.round(r.width), leadH: Math.round(r.height) };
      });
      const w0 = await page.evaluate(() => Math.round(document.querySelector('#usntA40Toggle').getBoundingClientRect().width));
      await page.locator('#usntA40Toggle').tap({ timeout: 8000 });
      await page.waitForTimeout(1000);
      const a11y = await page.evaluate(() => {
        const t = document.querySelector('#usntA40Toggle');
        const r = t.getBoundingClientRect();
        return { a11yExpanded: t.classList.contains('usntA40Expanded'), a11yW: Math.round(r.width), a11yLeft: Math.round(r.left), a11yBottomGap: Math.round(innerHeight - r.bottom) };
      });
      await page.evaluate(() => window.scrollTo({ top: 3000, behavior: 'instant' }));
      await page.waitForTimeout(600);
      const hdr = await page.evaluate(() => {
        const r = document.querySelector('.Page-header-stickyWrap').getBoundingClientRect();
        return { headerTop: Math.round(r.top), headerH: Math.round(r.height) };
      });
      return { ...lead, a11yW0: w0, ...a11y, ...hdr };
    },
  },
];

/**
 * @param {{ id: string, url: string, localDir: string, keepFloatClip?: boolean, stateNotes?: string[], validationNotes?: string[], removed?: string[] }} o
 *   localDir: absolute path of replicas/<id>/site/local (where the clips go)
 *   keepFloatClip: keep the hand-placed site/local/float.mp4 instead of recording one (the floating player's video
 *   element is still marked from the live page)
 */
export function apConfig(o) {
  const clip = (name) => `/_r/${o.id}/local/${name}.mp4`;
  return {
    id: o.id,
    url: o.url,
    siteName: 'AP News',
    sameSite: ['apnews.com', 'www.apnews.com'],
    licence:
      'Copyright The Associated Press; all rights reserved. Copied for a closed, non-commercial research study (noindex, served only behind study links); not for redistribution. Ad creatives, video frames and third-party widgets belong to their owners.',
    attribution: `The Associated Press, ${o.url}. Changed: scripts removed; behaviours re-created as local scripts; ads and video frozen as captured (local creatives and clips); files stored locally; in the adapted condition WebAble changes the page.`,
    settleMs: 2500,
    networkIdleMs: 12000,
    blockHosts: BLOCK,
    referenceAfterScroll: true,
    stateNotes: [
      'The page after one scroll pass, back at the top: AP adds modules, ads and comments while you scroll, and the Primis player starts floating (bottom right) at the first scroll. Live and copy are compared in this state.',
      'Lead video (JW Player) playing muted in the gallery; the copy loops a 12 s muted clip recorded from the live screen at capture, with its burned-in captions. Live plays the whole AP video once (paused while scrolled out of view), then shows its "More Videos" panel; JW\'s "Next Up" card (shown near a video\'s end) is removed from the copy.',
      'Floating Primis player: the copy loops a 12 s muted clip of what it was playing at capture (live: AP videos and video ads in turn).',
      'Ad creatives frozen as captured (screenshots in each ad iframe\'s srcdoc; the iframe src is kept). Live ads refresh and rotate.',
      'Removed because they appear on some loads only: Wunderkind/BounceX\'s ad above the header (blocked) and Teads outstream video in the in-story slots (blocked, so both pages carry display ads there).',
      ...(o.stateNotes ?? []),
    ],
    removed: ['Wunderkind/BounceX top ad and Teads outstream (hosts blocked at capture; appear on some loads only)', 'live video streams (replaced by local clips)', ...(o.removed ?? [])],
    behaviourNotes: ['sticky-header (site CSS)', 'ad-slots (captured creatives in srcdoc)', 'menu', 'caption-read-more', 'share-sheet', 'floating-player dock and close', 'accessibility-button expand'],
    validationNotes: [
      'Pixel diffs include the two moving videos (lead video and floating player), whose frames differ by design; reference/validation-masked.json gives the same diffs with those two boxes masked.',
      ...(o.validationNotes ?? []),
    ],
    async prepare(page, h) {
      await page.evaluate((sel) => {
        for (const e of document.querySelectorAll(sel)) e.remove();
        new MutationObserver(() => {
          for (const e of document.querySelectorAll(sel)) e.remove();
        }).observe(document.documentElement, { childList: true, subtree: true });
      }, RANDOM);
      h.log(`lead video: ${await keepLeadPlaying(page)}, ${await holdLeadPlaying(page)}`);
      // Load every lazy ad and module, let the ads fill, then freeze them.
      await h.scrollThrough(400, 250, 40);
      await h.sleep(6000);
      await h.scrollThrough(700, 120, 40);
      await h.sleep(3000);
      const empty = await refillEmptySlots(page);
      if (empty.length) {
        h.log(`ads: asked again for ${empty.length} empty slot(s): ${empty.join(', ')}`);
        await h.scrollThrough(400, 200, 40);
        await h.sleep(9000);
      }
      h.log(`ads: ${await freezeAds(page)}`);
      // GPT renders a fetched ad only once its slot nears the screen: one slow pass so every pending creative paints
      // before the reference.
      await h.scrollThrough(300, 300, 40);
      await h.sleep(4000);
    },
    async restore(page, h) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(800);
      mkdirSync(o.localDir, { recursive: true });
      // The floating player starts a video only after some scrolling, and between videos shows a still thumbnail. Its
      // own AP clips run about 10 s, the video ads between them 15-30 s. Nudge the page until one plays with time to
      // spare, then record both videos; try again if either stops too soon. Look at float.mp4 after a capture: ads
      // there can be political campaign ads, which the study should not show (capture again).
      const pick = (left, own) => page.evaluate(([src, left, own]) => {
        const v = (0, eval)(`(${src})`)(left);
        return !!v && (!own || !!v.closest('#videoContainerDiv'));
      }, [floatVideo.toString(), left, own]);
      let got = { lead: 0, float: 0 };
      for (let attempt = 1; attempt <= 3 && (got.lead < 8 || got.float < 6); attempt++) {
        const t0 = Date.now();
        let kind = '';
        while (!kind && Date.now() - t0 < 150000) {
          // With a kept clip (an ad), wait for an ad so the player's layout matches the clip.
          if (!o.keepFloatClip && (await pick(7, true))) kind = 'its own clip';
          else if ((o.keepFloatClip || Date.now() - t0 > 45000) && (await pick(CLIP_SECONDS + 3, false)) && !(await pick(CLIP_SECONDS + 3, true))) kind = 'a video AD';
          else if ((Date.now() - t0) % 6000 < 500) {
            await page.evaluate(() => window.scrollTo({ top: 160, behavior: 'instant' }));
            await page.waitForTimeout(300);
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
            // Waiting for an ad: every 30 s, move the player on to its next clip (ads play between clips).
            if (o.keepFloatClip && Date.now() - t0 > 30000 && (Date.now() - t0) % 30000 < 6000) {
              await page.evaluate(() => document.querySelector('[id^="native_playerSekindo"] #nextBtn')?.click());
            }
          }
          await page.waitForTimeout(250);
        }
        h.log(`attempt ${attempt}: floating player playing ${kind || 'NOTHING'} after ${Math.round((Date.now() - t0) / 1000)} s; lead ${await keepLeadPlaying(page, CLIP_SECONDS + 4)}`);
        await page.waitForTimeout(1200);
        await page.evaluate(() => document.querySelectorAll('[data-study-clip]').forEach((v) => v.removeAttribute('data-study-clip')));
        got = await recordClips(page, o.localDir, h.log, o.keepFloatClip ? ['float'] : []);
      }
    },
    // The lead video plays mid-way through in the copy: drop JW's "Next Up" card, which shows near a video's end.
    fixDom: (root) => {
      for (const e of root.querySelectorAll('.jw-flag-nextup, .jw-nextup-container-visible, .jw-nextup-sticky')) {
        e.classList.remove('jw-flag-nextup', 'jw-nextup-container-visible', 'jw-nextup-sticky');
      }
    },
    behaviours: [
      { use: 'autoplay-video', options: { video: 'video.jw-video', src: clip('lead'), type: 'video/mp4' } },
      { use: 'autoplay-video', options: { video: 'video[data-study-clip="float"]', src: clip('float'), type: 'video/mp4' } },
      {
        use: 'carousel',
        options: {
          carousel: 'bsp-carousel.Carousel',
          slide: '.Carousel-slide',
          track: '.flickity-slider',
          prev: '.CarouselControls-nav--prev button',
          next: '.CarouselControls-nav--next button',
          activeClass: 'is-selected',
          loop: false,
        },
      },
    ],
    checks,
  };
}
