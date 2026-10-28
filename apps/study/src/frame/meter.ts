// The frame's measures (methods §3), the same in both conditions. Listeners go on window in the capture phase before
// anything else in the page (the replica's scripts and the engine load after this), so every raw tap and click is
// seen before the engine's debounce can swallow it. WebAble's own layer is measured through its open shadow roots
// (the frame bundle is built with --mode e2e). No text, no typed values and no pointer paths are kept.
//
// Every navigation is blocked here, in both conditions: links, form submits, window.open and, where the Navigation API
// exists, location changes. A jump within the page is left alone.

import type { FrameMetrics, LinkPick, TaskSpec } from '../contracts';
import { entryShown, findTextRange, linesShown } from './answer';
import { inWebAble, interactiveIn, linkIn, linkKey, linkKind, linkWords, missDistance, tagOf } from './hit';
import { ACTIVATE_MS, PROXY_MS, ScrollTrack, aggregate, isTap, type Tap } from './metrics';

export interface MeterHooks {
  note(kind: string, detail?: string): void;
  /** Show the "Links are turned off" note (a no-op when there is no study host). */
  linkNote(): void;
  /** 'go' tasks: the person tapped a link; the shell asks whether it is what they were looking for (no note then). */
  picked?(p: LinkPick): void;
}

/** WebAble's layer: <webable-ui>'s shadow root, and the simplified page's host and nested root inside it. */
export interface WebAbleLayer {
  outer: ShadowRoot;
  calmHost: HTMLElement | null;
  calm: ShadowRoot | null;
}

interface Down {
  x: number;
  y: number;
  t: number;
  maxMove: number;
  multi: boolean;
  hit: boolean;
  tag: string | undefined;
  webable: boolean;
}

interface PendingClick {
  at: number;
  el: Element | null;
  kind: 'leave' | 'fragment' | null;
  proxied: boolean;
  link: Element | null;
}

/** A person's own action (tap, key) makes an expand or a navigation theirs when it came within this. */
const PERSON_MS = 1000;
const ANSWER_POLL_MS = 250;

type Internal = Tap & { up: number };

export class Meter {
  private measuring = false;
  private t0 = 0;
  private taps: Internal[] = [];
  private c = { activations: 0, linkAttempts: 0, debounced: 0, expands: 0 };
  private tracks = new Map<object, ScrollTrack>();
  private lastY = new WeakMap<object, number>();
  private pointers = new Map<number, Down>();
  private lastUp: { t: number; webable: boolean } | null = null;
  private lastPersonAt = -Infinity;
  private lastExpandFor = Number.NaN;
  private answerSeenAt: number | null = null;
  /** Every element of the answer (for 'go', every link to the destination) and those on screen now. */
  private answerEls: Element[] = [];
  private answerShownEls = new Set<Element>();
  private answerMissingNoted = false;
  private pageAnswerShown = false;
  private io: IntersectionObserver | null = null;
  private layer: WebAbleLayer | null = null;
  private answerRange: Range | null = null;
  private rangeDirty = true;
  private poll = 0;
  private zoom: () => number = () => 1;
  private debounceOn: () => boolean = () => false;
  private sentinel = false;
  private passed = new WeakSet<Event>();
  private installed = false;

  constructor(private task: TaskSpec | null, private hooks: MeterHooks) {}

  /** Register every listener. Call first, before any other script in the frame adds its own. */
  install(): void {
    if (this.installed) return;
    this.installed = true;
    const cap = { capture: true };
    const capPassive = { capture: true, passive: true };
    window.addEventListener('pointerdown', this.onDown, cap);
    window.addEventListener('pointermove', this.onMove, capPassive);
    window.addEventListener('pointerup', this.onUp, cap);
    window.addEventListener('pointercancel', this.onCancel, cap);
    window.addEventListener('keydown', this.onKey, cap);
    window.addEventListener('click', this.onClick, cap);
    window.addEventListener('auxclick', this.onAuxClick, cap);
    window.addEventListener('submit', this.onSubmit, cap);
    window.addEventListener('toggle', this.onToggle, cap);
    document.addEventListener('scroll', this.onScroll, capPassive);
    this.lastY.set(document, window.scrollY);
    this.watchExpanded(document.documentElement);
    this.blockScriptNavigation();
  }

  /** The virtual zoom (adapted): tap positions and distances are kept in the shell's CSS px (frame px x zoom). */
  setZoom(fn: () => number): void {
    this.zoom = fn;
  }

  /** WebAble's layer is mounted (adapted): measure inside it too. */
  attachLayer(layer: WebAbleLayer): void {
    this.layer = layer;
    for (const root of [layer.outer, layer.calm]) {
      if (!root) continue;
      root.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
      root.addEventListener('toggle', this.onToggle, { capture: true });
      root.addEventListener('submit', this.onSubmit, { capture: true });
      this.watchExpanded(root);
    }
    if (layer.calm) {
      new MutationObserver(() => {
        this.rangeDirty = true;
      }).observe(layer.calm, { childList: true, subtree: true, characterData: true });
    }
  }

  /**
   * Adapted, once the engine has settled (its debounce listener is in place): a second window capture listener, after
   * the engine's, tells a click the debounce swallowed from one it let through.
   */
  armDebounceCheck(debounceOn: () => boolean): void {
    if (this.sentinel) return;
    this.sentinel = true;
    this.debounceOn = debounceOn;
    window.addEventListener('click', (e) => this.passed.add(e), { capture: true });
  }

  begin(): void {
    this.measuring = true;
    this.t0 = performance.now();
    this.taps = [];
    this.c = { activations: 0, linkAttempts: 0, debounced: 0, expands: 0 };
    this.tracks = new Map();
    this.answerSeenAt = null;
    this.findAnswer();
    window.clearInterval(this.poll);
    this.poll = window.setInterval(() => this.checkAnswer(), ANSWER_POLL_MS);
    this.checkAnswer();
  }

  end(): FrameMetrics {
    if (this.measuring) this.checkAnswer();
    this.measuring = false;
    window.clearInterval(this.poll);
    if (this.task && !this.answerEls.length && !this.answerMissingNoted) {
      this.answerMissingNoted = true;
      this.hooks.note('answer_selector_missing', this.task.answerSelector);
    }
    let scrollScreens = 0;
    let scrollReversals = 0;
    for (const t of this.tracks.values()) {
      scrollScreens += t.total;
      scrollReversals += t.reversals;
    }
    return aggregate(this.taps, {
      ...this.c,
      scrollScreens,
      scrollReversals,
      answerSeenMs: this.answerSeenAt,
      simplifiedAtEnd: this.covered(),
    });
  }

  isMeasuring(): boolean {
    return this.measuring;
  }

  /** The simplified page is open and drawn over the page. */
  covered(): boolean {
    const h = this.layer?.calmHost;
    return !!h && h.isConnected && h.classList.contains('is-open') && h.classList.contains('has-content');
  }

  /* ---------------- taps ---------------- */

  private onDown = (e: PointerEvent): void => {
    if (!e.isTrusted) return;
    const now = performance.now();
    this.lastPersonAt = now;
    const multi = this.pointers.size > 0;
    if (multi) for (const p of this.pointers.values()) p.multi = true;
    const path = e.composedPath();
    const hit = interactiveIn(path);
    this.pointers.set(e.pointerId, {
      x: e.clientX, y: e.clientY, t: now, maxMove: 0, multi, hit: !!hit, tag: tagOf(hit), webable: inWebAble(path),
    });
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p || !e.isTrusted) return;
    const d = Math.hypot(e.clientX - p.x, e.clientY - p.y);
    if (d > p.maxMove) p.maxMove = d;
  };

  private onCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.isTrusted) this.lastPersonAt = performance.now();
  };

  private onUp = (e: PointerEvent): void => {
    if (!e.isTrusted) return;
    const now = performance.now();
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    this.lastPersonAt = now;
    this.lastUp = { t: now, webable: inWebAble(e.composedPath()) };
    if (!p || !this.measuring || p.t < this.t0) return;
    if (!isTap({ dx: e.clientX - p.x, dy: e.clientY - p.y, maxMove: p.maxMove, ms: now - p.t, cancelled: false, multi: p.multi })) return;
    const z = this.zoom();
    let distPx: number | null = null;
    if (!p.hit) {
      const roots: Array<Document | ShadowRoot> = p.webable
        ? [this.layer?.outer ?? null, this.layer?.calm ?? null].filter((r): r is ShadowRoot => !!r)
        : [document];
      const d = missDistance(p.x, p.y, roots, { w: window.innerWidth, h: window.innerHeight });
      distPx = d === null ? null : d * z;
    }
    const tap: Internal = {
      t: p.t - this.t0, x: p.x * z, y: p.y * z, layer: p.webable ? 'webable' : 'page', hit: p.hit, activated: false,
      distPx, up: now,
    };
    if (p.tag) tap.tag = p.tag;
    this.taps.push(tap);
  };

  /** The tap a click belongs to: the latest whose pointerup came within 500 ms (300 ms for a proxied click). */
  private tapFor(at: number, proxied: boolean): Internal | null {
    const win = proxied ? PROXY_MS : ACTIVATE_MS;
    for (let i = this.taps.length - 1; i >= 0; i--) {
      const t = this.taps[i] as Internal;
      if (t.up > at) continue;
      return at - t.up <= win ? t : null;
    }
    return null;
  }

  /* ---------------- clicks and navigation ---------------- */

  private onClick = (e: MouseEvent): void => {
    const path = e.composedPath();
    const link = linkIn(path);
    const kind = link ? linkKind(link, location) : null;
    // Every navigation away is blocked, whoever clicked (the engine's own clicks included).
    if (kind === 'leave') e.preventDefault();
    const now = performance.now();
    // An untrusted click is the person's only when the simplified page passed on their tap (ui/proxy.ts).
    const proxied = !e.isTrusted;
    const person = e.isTrusted || (!!this.lastUp && this.lastUp.webable && now - this.lastUp.t <= PROXY_MS);
    if (!person) {
      if (kind === 'leave') this.hooks.note('navigation_blocked', 'page');
      return;
    }
    const pending: PendingClick = { at: now, el: interactiveIn(path) ?? link, kind, proxied, link };
    // Decided after the event has been dispatched: the engine's debounce (later on window capture) may drop it.
    window.setTimeout(() => this.settleClick(e, pending), 0);
  };

  /** A middle click would open a link in a new tab: blocked, not counted (phones have none). */
  private onAuxClick = (e: MouseEvent): void => {
    const link = linkIn(e.composedPath());
    if (link && linkKind(link, location) === 'leave') e.preventDefault();
  };

  private settleClick(e: MouseEvent, p: PendingClick): void {
    if (this.sentinel && e.isTrusted && e.detail > 0 && !this.passed.has(e) && this.debounceOn()) {
      if (this.measuring) this.c.debounced++;
      return;
    }
    const tap = this.tapFor(p.at, p.proxied);
    if (p.el) {
      if (tap) {
        if (!tap.activated) {
          tap.activated = true;
          const tag = tagOf(p.el);
          if (tag) tap.tag = tag;
          if (this.measuring) this.c.activations++;
        }
      } else if (this.measuring) {
        this.c.activations++;
      }
    }
    if (p.kind === 'leave') this.linkAttempt(tap, p.link);
  }

  /**
   * A person's tap on a link (blocked). On a 'go' task, while measuring, it is their pick: the shell asks whether it
   * is what they were looking for. Otherwise the "Links are turned off" note shows, the same in both conditions.
   */
  private linkAttempt(tap: Internal | null, link: Element | null = null): void {
    if (tap?.link) return;
    if (tap) tap.link = true;
    if (this.measuring) this.c.linkAttempts++;
    this.hooks.note('link_blocked');
    if (link && this.measuring && this.task?.kind === 'go' && this.hooks.picked) {
      this.hooks.picked({ href: linkKey(link, location), text: linkWords(link) });
      return;
    }
    this.hooks.linkNote();
  }

  private personNow(): boolean {
    return performance.now() - this.lastPersonAt <= PERSON_MS;
  }

  private latestTap(): Internal | null {
    const t = this.taps[this.taps.length - 1];
    return t && performance.now() - t.up <= PERSON_MS ? t : null;
  }

  private onSubmit = (e: Event): void => {
    e.preventDefault();
    if (this.personNow()) this.linkAttempt(this.latestTap());
    else this.hooks.note('navigation_blocked', 'submit');
  };

  /** window.open and, with the Navigation API, location changes and script submits. */
  private blockScriptNavigation(): void {
    try {
      const self = this;
      window.open = function blockedOpen(): null {
        if (self.personNow()) self.linkAttempt(self.latestTap());
        else self.hooks.note('navigation_blocked', 'window.open');
        return null;
      };
    } catch {
      this.hooks.note('navigation_unblocked', 'window.open');
    }
    type NavigateEvent = Event & { cancelable: boolean; hashChange: boolean; destination?: { sameDocument?: boolean } };
    const nav = (window as unknown as { navigation?: EventTarget }).navigation;
    if (!nav || typeof nav.addEventListener !== 'function') return;
    nav.addEventListener('navigate', (ev) => {
      const e = ev as NavigateEvent;
      if (e.hashChange || e.destination?.sameDocument) return;
      if (!e.cancelable) {
        this.hooks.note('navigation_unblocked', 'not cancelable');
        return;
      }
      e.preventDefault();
      if (this.personNow()) this.linkAttempt(this.latestTap());
      else this.hooks.note('navigation_blocked', 'script');
    });
  }

  /* ---------------- expands ---------------- */

  private onToggle = (e: Event): void => {
    const t = e.target as Element | null;
    if (!t || t.tagName !== 'DETAILS' || !(t as HTMLDetailsElement).open) return;
    this.expand();
  };

  private watchExpanded(root: Node): void {
    try {
      new MutationObserver((recs) => {
        for (const r of recs) {
          const el = r.target as Element;
          if (r.oldValue !== 'true' && el.getAttribute?.('aria-expanded') === 'true') this.expand();
        }
      }).observe(root, { attributes: true, subtree: true, attributeFilter: ['aria-expanded'], attributeOldValue: true });
    } catch {
      /* nothing to watch */
    }
  }

  /** One section opened by the person (within 1 s of their tap or key; one per action). */
  private expand(): void {
    if (!this.measuring || !this.personNow() || this.lastExpandFor === this.lastPersonAt) return;
    this.lastExpandFor = this.lastPersonAt;
    this.c.expands++;
  }

  /* ---------------- scrolling ---------------- */

  private onScroll = (e: Event): void => {
    const t = e.target;
    let scroller: object;
    let y: number;
    let screen = window.innerHeight;
    if (!t || t === document || t === document.documentElement || t === document.body && document.scrollingElement === document.body) {
      scroller = document;
      y = window.scrollY;
    } else if ((t as Node).nodeType === 1) {
      const el = t as Element;
      scroller = el;
      y = el.scrollTop;
      const root = el.getRootNode();
      // The simplified page scrolls inside WebAble's layer: a screen there is its own visible height.
      if (this.layer && (root === this.layer.outer || root === this.layer.calm) && el.clientHeight > 0) screen = el.clientHeight;
    } else {
      return;
    }
    const last = this.lastY.get(scroller) ?? 0;
    this.lastY.set(scroller, y);
    if (!this.measuring) return;
    let track = this.tracks.get(scroller);
    if (!track) {
      track = new ScrollTrack();
      this.tracks.set(scroller, track);
    }
    track.add(y - last, screen);
  };

  /* ---------------- answer seen ---------------- */

  private answerConnected(): boolean {
    return this.answerEls.some((el) => el.isConnected);
  }

  /** Every element the selector matches (a 'go' destination often has several links), each watched for being on screen. */
  private findAnswer(): void {
    if (!this.task || this.answerConnected()) return;
    let els: Element[] = [];
    try {
      els = Array.from(document.querySelectorAll(this.task.answerSelector));
    } catch {
      els = [];
    }
    if (!els.length) return;
    this.answerEls = els;
    this.answerShownEls.clear();
    this.pageAnswerShown = false;
    this.io?.disconnect();
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (entryShown(e)) this.answerShownEls.add(e.target);
        else this.answerShownEls.delete(e.target);
      }
      this.pageAnswerShown = this.answerShownEls.size > 0;
      if (this.measuring) this.checkAnswer();
    }, { threshold: [0, 0.05, 0.1, 0.25, 0.5, 0.75, 1] });
    for (const el of els) this.io.observe(el);
  }

  private checkAnswer(): void {
    if (!this.measuring || this.answerSeenAt !== null || !this.task) return;
    if (!this.answerConnected()) this.findAnswer();
    const covered = this.covered();
    let seen = !covered && this.pageAnswerShown && this.answerConnected();
    const inLayer = this.task.answerTextSimplified ?? this.task.answerText;
    if (!seen && covered && this.layer?.calm && inLayer) {
      if (this.rangeDirty || !this.answerRange || !this.answerRange.startContainer.isConnected) {
        this.answerRange = findTextRange(this.layer.calm, inLayer);
        this.rangeDirty = false;
      }
      if (this.answerRange) seen = linesShown(this.answerRange.getClientRects(), this.layerArea());
    }
    if (seen) {
      this.answerSeenAt = performance.now() - this.t0;
      window.clearInterval(this.poll);
    }
  }

  /** The part of the frame the simplified page shows: its host's box within the frame's viewport. */
  private layerArea(): { left: number; top: number; right: number; bottom: number } {
    const view = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const h = this.layer?.calmHost;
    if (!h) return view;
    const r = h.getBoundingClientRect();
    return { left: Math.max(view.left, r.left), top: Math.max(view.top, r.top), right: Math.min(view.right, r.right), bottom: Math.min(view.bottom, r.bottom) };
  }
}
