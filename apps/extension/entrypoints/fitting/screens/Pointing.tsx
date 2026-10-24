// Part 2, Pointing: a 9-dot ring, up to 3 blocks walking the size ladder (fitting brief §4).
// The press point decides hit or miss. Misses are data: no redo, and no hit effects.

import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { median } from '../logic/rand';
import { PointingWalk, RING_COUNT, RING_ORDER, ringDiameter, type RingPress } from '../logic/pointing';
import { Deck, Heading } from '../ui/common';
import type { ScreenProps } from './types';

interface Down {
  id: number;
  x: number;
  y: number;
  t: number;
  dx: number;
  dy: number;
  inside: boolean;
  type: string;
}

export function Dots(props: ScreenProps): JSX.Element {
  const touch = props.raw.inputClass === 'touch';
  const walk = useMemo(() => new PointingWalk(touch, props.raw.express ? 2 : 3), []);
  const [size, setSize] = useState<number>(() => walk.current() ?? 44); // effective px
  const [step, setStep] = useState(0); // 0..RING_COUNT-1 within the block
  const [blockNo, setBlockNo] = useState(1);
  const [flash, setFlash] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(640);
  const presses = useRef<RingPress[]>([]);
  const moveMs = useRef<number[]>([]);
  const lastUpT = useRef<number | null>(null);
  const down = useRef<Down | null>(null);
  const blockType = useRef<string | null>(null);

  const zoom = props.raw.zoom || 1;
  const cssSize = size / zoom;
  // The stage is 400 px where there is room; on short screens it shrinks (never below what the ring needs, and the
  // ring's diameter does not change) so Pause and Skip stay on the first screen.
  const want = Math.max(400, Math.round(ringDiameter(stageW, 9999, touch, cssSize) + cssSize + 72));
  const need = Math.round(ringDiameter(stageW, 400, touch, cssSize) + cssSize + 72);
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const stageH = Math.max(need, Math.min(want, Math.round(window.innerHeight - 20 * remPx)));
  const D = ringDiameter(stageW, stageH, touch, cssSize);
  const R = D / 2;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const centers = useMemo(() => {
    const cx = stageW / 2;
    const cy = stageH / 2;
    return Array.from({ length: RING_COUNT }, (_, i) => {
      const a = -Math.PI / 2 + (i / RING_COUNT) * Math.PI * 2;
      return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
    });
  }, [stageW, stageH, R]);

  const activeIdx = RING_ORDER[step] ?? 0;

  useEffect(() => {
    props.onProgress(walk.progress() + step / RING_COUNT / 3);
  }, [step, blockNo]);

  const local = (e: PointerEvent): { x: number; y: number } => {
    const r = stageRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const onDown = (e: PointerEvent) => {
    if (props.paused || document.hidden || !e.isPrimary || down.current) return;
    e.preventDefault();
    stageRef.current?.setPointerCapture(e.pointerId);
    const p = local(e);
    const c = centers[activeIdx] ?? { x: 0, y: 0 };
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const inside = Math.hypot(dx, dy) <= cssSize / 2;
    down.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, dx, dy, inside, type: e.pointerType };
    if (!inside) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 100);
    }
  };

  const onUp = (e: PointerEvent) => {
    const d = down.current;
    if (!d || e.pointerId !== d.id) return;
    down.current = null;
    const p = local(e);
    const c = centers[activeIdx] ?? { x: 0, y: 0 };
    const slipped = d.inside && Math.hypot(p.x - c.x, p.y - c.y) > cssSize / 2;
    props.raw.ringPress(d.x, d.y, d.t, e.clientX, e.clientY, e.timeStamp, slipped);

    // A pointer type change inside a block voids that press (brief §2).
    blockType.current ??= d.type;
    const valid = d.type === blockType.current;
    if (step > 0 && valid) {
      presses.current.push({ dx: d.dx * zoom, dy: d.dy * zoom, hit: d.inside, slipped });
      if (lastUpT.current !== null) moveMs.current.push(e.timeStamp - lastUpT.current);
    }
    lastUpT.current = e.timeStamp;

    if (step + 1 < RING_COUNT) {
      setStep(step + 1);
      return;
    }
    // Block finished.
    const mt = median(moveMs.current);
    walk.record(size, presses.current, Number.isFinite(mt) ? mt : 0);
    if (walk.blocks.length === 1 && mt > 2500 && walk.maxBlocks > 2) {
      walk.maxBlocks = 2;
      props.raw.express = true;
    }
    presses.current = [];
    moveMs.current = [];
    lastUpT.current = null;
    blockType.current = null;
    const next = walk.current();
    if (next === null) {
      props.raw.blocks = walk.blocks.map((b) => ({ sizePx: b.sizePx, presses: b.presses }));
      props.raw.roughTargetPx = walk.roughMinTarget();
      props.raw.complete('P1');
      props.onDone();
      return;
    }
    setSize(next);
    setStep(0);
    setBlockNo((b) => b + 1);
  };

  const onCancel = () => {
    down.current = null;
  };

  const verb = touch ? 'Tap' : 'Click';
  return (
    <div>
      <Heading>{verb} each dot as it fills in.</Heading>
      <Deck>
        Go at your usual pace.
        {blockNo > 1 ? ` Set ${blockNo}, with ${size > (walk.blocks.at(-1)?.sizePx ?? size) ? 'larger' : 'smaller'} dots.` : ''}
      </Deck>
      <div
        ref={stageRef}
        class="fx-stage fx-stage-ring"
        data-ring=""
        style={{ height: `${stageH}px` }}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        role="application"
        aria-label={`${verb} the filled dot. ${RING_COUNT - step} left in this set.`}
      >
        {centers.map((c, i) => (
          <span
            class={`fx-dot ${i === activeIdx ? 'is-active' : ''} ${i === activeIdx && flash ? 'is-miss' : ''}`}
            style={{ left: `${c.x - cssSize / 2}px`, top: `${c.y - cssSize / 2}px`, width: `${cssSize}px`, height: `${cssSize}px` }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
