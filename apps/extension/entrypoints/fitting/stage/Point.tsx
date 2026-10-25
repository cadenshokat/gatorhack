// Point: a 9-dot ring over the page. Click the lit dot; pressed dots stay filled, building the ring. The press point
// decides hit or miss, misses are data (no redo, no error effects), and every press also feeds Steady Clicks.

import type { JSX } from 'preact';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { RING_COUNT, RING_ORDER, ringDiameter, SequentialWalk } from '../logic/pointing';
import { Instruction } from './Frame';
import type { BlockProps } from './types';

interface Down {
  id: number;
  x: number;
  y: number;
  t: number;
  dx: number;
  dy: number;
  inside: boolean;
  idx: number;
}

export function PointBlock(props: BlockProps): JSX.Element {
  const { raw, plan } = props;
  const walk = useMemo(() => new SequentialWalk(plan.touch), []);
  const [size, setSize] = useState<number>(() => walk.current() ?? 44);
  const [step, setStep] = useState(0);
  const [filled, setFilled] = useState<number[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 900, h: 480 });
  const down = useRef<Down | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoom = raw.zoom || 1;
  const css = size / zoom;
  const D = Math.min(ringDiameter(box.w, box.h, plan.touch, css), Math.max(120, box.h - css - 24));
  const R = D / 2;
  const centers = useMemo(
    () =>
      Array.from({ length: RING_COUNT }, (_, i) => {
        const a = -Math.PI / 2 + (i / RING_COUNT) * Math.PI * 2;
        return { x: box.w / 2 + R * Math.cos(a), y: box.h / 2 + R * Math.sin(a) };
      }),
    [box.w, box.h, R],
  );
  const activeIdx = RING_ORDER[step % RING_COUNT] ?? 0;

  const local = (e: PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const onDown = (e: PointerEvent) => {
    if (props.paused || document.hidden || !e.isPrimary || down.current) return;
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    const p = local(e);
    const c = centers[activeIdx] ?? { x: 0, y: 0 };
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    down.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, dx, dy, inside: Math.hypot(dx, dy) <= css / 2, idx: activeIdx };
  };

  const onUp = (e: PointerEvent) => {
    const d = down.current;
    if (!d || e.pointerId !== d.id) return;
    down.current = null;
    const p = local(e);
    const c = centers[d.idx] ?? { x: 0, y: 0 };
    const slipped = d.inside && Math.hypot(p.x - c.x, p.y - c.y) > css / 2;
    raw.ringPress(d.x, d.y, d.t, e.clientX, e.clientY, e.timeStamp, slipped);
    walk.press({ dx: d.dx * zoom, dy: d.dy * zoom, hit: d.inside, slipped });
    setFilled((f) => (f.length + 1 >= RING_COUNT ? [] : [...f, d.idx]));
    setStep((s) => s + 1);
    if (walk.done) {
      raw.blocks = walk.blocks.map((b) => ({ sizePx: b.sizePx, presses: b.presses }));
      props.onDone({ trials: walk.scoredCount, stop: walk.stopReason ?? undefined });
      return;
    }
    const next = walk.current();
    if (next != null && next !== size) setSize(next);
  };

  const verb = plan.touch ? 'Tap' : 'Click';
  return (
    <>
      <Instruction>{verb} each dot when it lights up.</Instruction>
      <div class="wu-overlay is-veiled is-ring">
        <div
          ref={ref}
          class="wu-ring"
          data-ring=""
          data-block="point"
          data-size={size}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => (down.current = null)}
          role="application"
          aria-label={`${verb} the lit dot.`}
        >
          {centers.map((c, i) => (
            <span
              class={`wu-dot ${i === activeIdx ? 'is-lit' : ''} ${filled.includes(i) ? 'is-filled' : ''}`}
              data-lit={i === activeIdx ? '1' : undefined}
              style={{ left: `${c.x - css / 2}px`, top: `${c.y - css / 2}px`, width: `${css}px`, height: `${css}px` }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      <div class="wu-tray is-note" key="tray-point">
        <p class="wu-tray-note">Go at your usual pace. A miss is fine.</p>
      </div>
    </>
  );
}
