// Pick: the same made-up page, busy and calm, side by side → This one · This one · About the same.
// Calm → Calm view offered; calm + Stop, or busy searches ≥ 1.5× slower → Calm view on busy pages (core decides).

import type { JSX } from 'preact';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { planFind, type FindTrial } from '../logic/finding';
import { MockPage } from '../screens/MockPage';
import { Btn, useKeys, useTrialClock } from '../ui/common';
import { Instruction } from './Frame';
import type { BlockProps } from './types';

const NATURAL = 1040;

function Thumb(props: { trial: FindTrial; reduced: boolean; label: string }): JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [h, setH] = useState(260);
  useLayoutEffect(() => {
    const b = box.current;
    const p = page.current;
    if (!b || !p) return;
    const measure = () => {
      const s = b.clientWidth / NATURAL;
      setScale(s);
      setH(Math.min(p.scrollHeight * s, b.parentElement ? b.parentElement.clientHeight - 96 : 9999));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(p);
    return () => ro.disconnect();
  }, []);
  return (
    <div class="wu-thumb-box" ref={box} style={{ height: `${h}px` }} aria-label={props.label} role="img">
      <div class="wu-thumb-page" ref={page} style={{ width: `${NATURAL}px`, transform: `scale(${scale})` }}>
        <MockPage trial={props.trial} still salientInsteadOfMotion={props.reduced} fontPx={16} targetPx={32} interactive={false} />
      </div>
    </div>
  );
}

export function PickBlock(props: BlockProps): JSX.Element {
  const { raw } = props;
  const base = useMemo(() => planFind(props.rng)[0] as FindTrial, []);
  const calmLeft = useMemo(() => props.rng() < 0.5, []);
  const clock = useTrialClock(props.paused, 0);
  const calm: FindTrial = { ...base, clutter: false, motion: false, sources: [] };
  const busy: FindTrial = { ...base, clutter: true, motion: false, sources: [] };
  const [left, right] = calmLeft ? [calm, busy] : [busy, calm];

  const choose = (v: 'left' | 'right' | 'same') => {
    if (props.paused || !clock.armed()) return;
    const choseCalm = (v === 'left' && calmLeft) || (v === 'right' && !calmLeft);
    raw.preferredCalm = v === 'same' ? 0.5 : choseCalm ? 2 : 0;
    props.onDone({ trials: 1, stop: 'person' });
  };

  useKeys(!props.paused, (key) => {
    if (key === 'ArrowLeft') choose('left');
    else if (key === 'ArrowRight') choose('right');
  });

  return (
    <>
      <Instruction>Which page is easier on your eyes?</Instruction>
      <div class="wu-overlay is-page is-pick" data-block="pick" data-calm={calmLeft ? 'left' : 'right'}>
        <div class="wu-pick">
          <div class="wu-pick-col">
            <Thumb trial={left} reduced={props.plan.stillOnly} label="The first page" />
            <Btn kind="answer" onClick={() => choose('left')} data="left" class="wu-pick-btn">
              This one
            </Btn>
          </div>
          <div class="wu-pick-col">
            <Thumb trial={right} reduced={props.plan.stillOnly} label="The second page" />
            <Btn kind="answer" onClick={() => choose('right')} data="right" class="wu-pick-btn">
              This one
            </Btn>
          </div>
        </div>
      </div>
      <div class="wu-tray" key="tray-pick">
        <Btn kind="quiet" onClick={() => choose('same')} data="same" class="wu-btn-pill">
          About the same
        </Btn>
      </div>
    </>
  );
}
