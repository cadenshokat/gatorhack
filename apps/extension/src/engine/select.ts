// Owner: C2. Offers "Explain" for a selection of running text (research-redesign.md §10.5:
// "Any text selection of >= 12 words also offers it"). Explanation itself is never automatic.

import { wordCount } from './signals';

export const SELECT_MIN_WORDS = 12;
/** Longer selections cannot be explained (research-redesign.md §10.3), so the affordance is not offered. */
export const SELECT_MAX_CHARS = 2000;

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
 * After mouseup / keyup / touchend, a selection of >= 12 words inside running text calls `onExplainable` with the
 * selected text and its rectangle (viewport coordinates). The same selection is offered once.
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
    let rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      const rects = range.getClientRects();
      rect = rects[rects.length - 1] ?? rect;
    }
    if (!rect.width && !rect.height) return;
    const key = `${text.length}:${text.slice(0, 60)}:${Math.round(rect.top + window.scrollY)}:${Math.round(rect.left)}`;
    if (key === lastKey) return;
    lastKey = key;
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

  const opt = { capture: true, passive: true } as const;
  const types = ['mouseup', 'keyup', 'touchend'] as const;
  for (const t of types) document.addEventListener(t, schedule, opt);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    for (const t of types) document.removeEventListener(t, schedule, opt);
  };
}
