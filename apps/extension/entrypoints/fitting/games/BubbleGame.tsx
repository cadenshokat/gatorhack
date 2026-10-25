// One bubble at a time, in three sizes. A click on the bubble pops it. A click on the empty area counts too.
// Keyboard: the bubble is a button, so Enter pops it.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { copy } from '../content/copy';
import { nextBubble, type BubbleSize, type BubbleTap } from '../logic/bubbles';
import type { Rng } from '../logic/rand';

export function BubbleGame(props: { rng: Rng; onDone: (result: { taps: BubbleTap[]; reason: 'sure' | 'max' }) => void }): JSX.Element {
  const taps = useRef<BubbleTap[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState<BubbleSize>(72);
  const [at, setAt] = useState({ x: 50, y: 46 });
  const [pop, setPop] = useState(0);
  const [popped, setPopped] = useState(0);
  const down = useRef<{ t: number; inside: boolean; reentries: number; left: boolean } | null>(null);
  const lastUp = useRef(0);
  const lock = useRef(false);

  useEffect(() => {
    bubble.current?.focus();
  }, [pop, size]);

  const placeNext = (nextSize: BubbleSize) => {
    const root = stage.current;
    const rect = root?.getBoundingClientRect();
    const w = rect?.width ?? 520;
    const h = rect?.height ?? 380;
    const dist = [88, 168, 250][taps.current.length % 3] ?? 140;
    const angle = props.rng() * Math.PI * 2;
    const cx = (at.x / 100) * w;
    const cy = (at.y / 100) * h;
    let x = cx + Math.cos(angle) * dist;
    let y = cy + Math.sin(angle) * dist;
    const pad = nextSize / 2 + 12;
    x = Math.min(w - pad, Math.max(pad, x));
    y = Math.min(h - pad, Math.max(pad, y));
    setAt({ x: (x / w) * 100, y: (y / h) * 100 });
    setSize(nextSize);
    setPop((n) => n + 1);
    lock.current = false;
    down.current = null;
  };

  const commit = (tap: BubbleTap) => {
    if (lock.current) return;
    const all = [...taps.current, tap];
    taps.current = all;
    setPopped(all.filter((t) => t.hit).length);
    // A miss leaves the same bubble where it is. There is nothing to say about it.
    if (!tap.hit) return;
    lock.current = true;
    const plan = nextBubble(all);
    if (plan.done && plan.reason) {
      props.onDone({ taps: all, reason: plan.reason });
      return;
    }
    placeNext(plan.size);
  };

  const center = () => {
    const rect = bubble.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const onStageDown = (e: PointerEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('.ob-bubble')) return;
    const c = center();
    commit({
      sizePx: size,
      dx: e.clientX - c.x,
      dy: e.clientY - c.y,
      hit: false,
      slipped: false,
      reentries: 0,
      holdMs: 0,
      gapMs: lastUp.current ? e.timeStamp - lastUp.current : 800,
      via: 'pointer',
    });
    lastUp.current = e.timeStamp;
  };

  return (
    <section class="ob-game" aria-labelledby="ob-game-title">
      <h1 id="ob-game-title" class="ob-sr">{copy.sections.bubbles.name}</h1>
      <p class="ob-count" aria-live="polite">{copy.bubbles.count(popped, copy.bubbles.total)}</p>
      <div
        class="ob-stage"
        ref={stage}
        onPointerDown={onStageDown}
        role="group"
        aria-label={copy.sections.bubbles.name}
      >
        <button
          key={pop}
          type="button"
          class="ob-bubble"
          ref={bubble}
          data-answer="bubble"
          style={{ width: `${size}px`, height: `${size}px`, left: `${at.x}%`, top: `${at.y}%` }}
          aria-label={copy.bubbles.pop}
          onPointerDown={(e) => {
            e.stopPropagation();
            down.current = { t: e.timeStamp, inside: true, reentries: 0, left: false };
          }}
          onPointerLeave={() => {
            if (down.current) down.current.left = true;
          }}
          onPointerEnter={() => {
            const d = down.current;
            if (d?.left) {
              d.reentries += 1;
              d.left = false;
            }
          }}
          onPointerUp={(e) => {
            const d = down.current;
            const c = center();
            const rect = bubble.current?.getBoundingClientRect();
            const inside = rect ? e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom : true;
            commit({
              sizePx: size,
              dx: e.clientX - c.x,
              dy: e.clientY - c.y,
              hit: inside,
              slipped: !inside,
              reentries: d?.reentries ?? 0,
              holdMs: d ? Math.max(0, e.timeStamp - d.t) : 0,
              gapMs: lastUp.current ? e.timeStamp - lastUp.current : 800,
              via: 'pointer',
            });
            lastUp.current = e.timeStamp;
          }}
          onClick={(e) => {
            if (e.detail !== 0) return;
            commit({
              sizePx: size,
              dx: 0,
              dy: 0,
              hit: true,
              slipped: false,
              reentries: 0,
              holdMs: 0,
              gapMs: 800,
              via: 'key',
            });
          }}
        />
      </div>
    </section>
  );
}
