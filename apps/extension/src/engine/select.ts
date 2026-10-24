// Owner: C2. Offers "Explain" for a selection of running text (research-redesign.md §10.5:
// "Any text selection of >= 12 words also offers it"). Explanation itself is never automatic.

import { wordCount } from './signals';

export const SELECT_MIN_WORDS = 12;
/** Longer selections cannot be explained (research-redesign.md §10.3), so the affordance is not offered. */
export const SELECT_MAX_CHARS = 2000;
/** Quiet time after the last scroll event before a still-selected passage is offered again. */
export const SETTLE_MS = 220;

/** Selections inside these are controls, menus or fields, not running text. */
const NOT_RUNNING_TEXT = [
  'input', 'textarea', 'select', 'option', 'button', '[role=button]', '[contenteditable=""]', '[contenteditable=true]',
  'nav', '[role=navigation]', '[role=menu]', '[role=menubar]', '[role=toolbar]', '[role=tablist]', '[role=listbox]',
].join(',');
const FIELDISH = 'input,textarea,select,[contenteditable=""],[contenteditable=true]';
const LINKISH = 'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[role=option],label,option';

export function normalizeSelection(text: string): string {
  return String(text ?? '').replace(/[​-‍⁠﻿]/g, '').replace(/\s+/g, ' ').trim();
}

/** Enough words to be worth explaining, and short enough to send. Pure. */
export function isExplainableText(text: string): boolean {
  const t = normalizeSelection(text);
  return t.length <= SELECT_MAX_CHARS && wordCount(t) >= SELECT_MIN_WORDS;
}

/** At least half of the selected words sit outside links, buttons and labels (a paragraph, not a list of links). */
function mostlyRunningText(range: Range): boolean {
  const root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) {
    const p = root.parentElement;
    return !!p && !p.closest(LINKISH);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  let linky = 0;
  let seen = 0;
  for (let n = walker.nextNode(); n && seen < 800; n = walker.nextNode()) {
    seen++;
    if (!range.intersectsNode(n)) continue;
    const words = wordCount(n.textContent ?? '');
    if (!words) continue;
    total += words;
    if (n.parentElement?.closest(LINKISH)) linky += words;
  }
  return total > 0 && linky / total < 0.5;
}

/**
 * The selection's box (viewport coordinates) from its line boxes. A triple-click in Chrome selects up to the start
 * of the next block, whose empty line box would stretch the plain bounding box down over the next element.
 */
export function selectionBox(rects: ArrayLike<{ left: number; top: number; right: number; bottom: number; width: number; height: number }>): DOMRect | null {
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (let i = 0; i < rects.length; i++) {
    const x = rects[i];
    if (!x || x.width < 2 || x.height < 2) continue;
    l = Math.min(l, x.left);
    t = Math.min(t, x.top);
    r = Math.max(r, x.right);
    b = Math.max(b, x.bottom);
  }
  if (!Number.isFinite(l)) return null;
  if (typeof DOMRect === 'function') return new DOMRect(l, t, r - l, b - t);
  return { x: l, y: t, left: l, top: t, right: r, bottom: b, width: r - l, height: b - t, toJSON: () => ({}) } as DOMRect;
}

/**
 * After mouseup / keyup / touchend, a selection of >= 12 words inside running text calls `onExplainable` with the
 * selected text and its rectangle (viewport coordinates). The same selection is offered once until it is cleared
 * or made again (a new press starts over, so re-selecting the same paragraph offers Explain again).
 */
export function watchSelection(host: {
  onExplainable(text: string, rect: DOMRect): void;
  isOurUi(t: EventTarget | null): boolean;
}): () => void {
  let lastKey = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const ours = (t: EventTarget | null): boolean => {
    try { return host.isOurUi(t); } catch { return false; }
  };

  const check = (): void => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      lastKey = '';
      return;
    }
    const range = sel.getRangeAt(0);
    const anc = range.commonAncestorContainer;
    const el = anc instanceof Element ? anc : anc.parentElement;
    if (!el || ours(el) || el.closest(NOT_RUNNING_TEXT)) return;
    const active = document.activeElement;
    if (active && active.matches(FIELDISH)) return;
    const text = normalizeSelection(sel.toString());
    if (!isExplainableText(text) || !mostlyRunningText(range)) return;
    const rect = selectionBox(range.getClientRects()) ?? range.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const key = `${text.length}:${text.slice(0, 60)}:${Math.round(rect.top + window.scrollY)}:${Math.round(rect.left)}`;
    if (key === lastKey) return;
    lastKey = key;
    // Scrolled out of view: remember it, offer it when it is back in view (see onScroll).
    if (rect.bottom < 0 || rect.top > (window.innerHeight || document.documentElement.clientHeight)) return;
    host.onExplainable(text, rect);
  };

  const schedule = (e: Event): void => {
    if (stopped || !e.isTrusted || ours(e.target)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (stopped) return;
      try { check(); } catch { /* never break the page */ }
    }, 30);
  };

  // A new press or a cleared selection forgets the last offer, so the same text can be offered again.
  const forget = (e: Event): void => {
    if (!ours(e.target)) {
      lastKey = '';
      dismissedKey = '';
    }
  };
  // The in-page UI hides the pill while the page scrolls (it would float away from the text). Trackpad momentum,
  // smooth scrolling and drag auto-scroll keep sending scroll events after the mouse is up, which hid the pill as
  // soon as it appeared. When scrolling settles, offer the same selection again at its new place, unless the
  // person dismissed it (Escape).
  let dismissedKey = '';
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  const onScroll = (): void => {
    if (stopped || !lastKey) return;
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      scrollTimer = null;
      if (stopped || !lastKey || lastKey === dismissedKey) return;
      const was = lastKey;
      lastKey = '';
      try { check(); } catch { /* never break the page */ }
      if (!lastKey) lastKey = was;
    }, SETTLE_MS);
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') dismissedKey = lastKey;
  };
  const onSelectionChange = (): void => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed) lastKey = '';
  };

  const opt = { capture: true, passive: true } as const;
  const types = ['mouseup', 'keyup', 'touchend'] as const;
  for (const t of types) document.addEventListener(t, schedule, opt);
  document.addEventListener('mousedown', forget, opt);
  document.addEventListener('touchstart', forget, opt);
  document.addEventListener('selectionchange', onSelectionChange);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('keydown', onKeyDown, opt);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (scrollTimer) clearTimeout(scrollTimer);
    timer = null;
    scrollTimer = null;
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('keydown', onKeyDown, opt);
    for (const t of types) document.removeEventListener(t, schedule, opt);
    document.removeEventListener('mousedown', forget, opt);
    document.removeEventListener('touchstart', forget, opt);
    document.removeEventListener('selectionchange', onSelectionChange);
  };
}
