// Tiny looping illustrations of each step for the instruction card. Pure CSS; a still frame under reduced motion.

import type { JSX } from 'preact';
import { RING_COUNT, RING_ORDER } from '../logic/pointing';
import type { StepId } from '../logic/steps';

function Lines(props: { widths: number[] }): JSX.Element {
  return (
    <>
      {props.widths.map((w) => (
        <span class="dm-line" style={{ width: `${w}%` }} />
      ))}
    </>
  );
}

function SizeDemo(): JSX.Element {
  return (
    <div class="dm-col">
      <div class="dm-card dm-size">
        <div class="dm-size-text">
          <Lines widths={[100, 92, 70]} />
        </div>
      </div>
      <div class="dm-row">
        <span class="dm-pill">Smaller</span>
        <span class="dm-pill dm-press-b">Larger</span>
      </div>
    </div>
  );
}

function TrueFalseDemo(): JSX.Element {
  return (
    <div class="dm-col">
      <div class="dm-card dm-tf">
        <span class="dm-tf-text">
          <Lines widths={[100, 64]} />
        </span>
      </div>
      <div class="dm-row">
        <span class="dm-pill dm-press-a">True</span>
        <span class="dm-pill dm-press-b">False</span>
      </div>
    </div>
  );
}

function FaintDemo(): JSX.Element {
  return (
    <div class="dm-col">
      <div class="dm-card dm-faint">
        <span class="dm-faint-word">house</span>
      </div>
      <div class="dm-row">
        <span class="dm-pill">table</span>
        <span class="dm-pill dm-press-a">house</span>
        <span class="dm-pill">river</span>
        <span class="dm-pill">cloud</span>
      </div>
    </div>
  );
}

function LightDarkDemo(): JSX.Element {
  return (
    <div class="dm-row dm-ld">
      <div class="dm-card dm-ld-light">
        <Lines widths={[100, 86, 60]} />
      </div>
      <div class="dm-card dm-ld-dark">
        <Lines widths={[100, 86, 60]} />
      </div>
    </div>
  );
}

function DotsDemo(): JSX.Element {
  const R = 58;
  return (
    <div class="dm-ring" aria-hidden="true">
      {Array.from({ length: RING_COUNT }, (_, i) => {
        const a = -Math.PI / 2 + (i / RING_COUNT) * Math.PI * 2;
        const order = RING_ORDER.indexOf(i);
        return (
          <span
            class={`dm-dot ${order === 0 ? 'is-still' : ''}`}
            style={{
              left: `${70 + R * Math.cos(a) - 9}px`,
              top: `${70 + R * Math.sin(a) - 9}px`,
              animationDelay: `${order * 0.6}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function FindDemo(): JSX.Element {
  return (
    <div class="dm-col">
      <span class="dm-findchip">Find: Gift cards</span>
      <div class="dm-card dm-page">
        <span class="dm-page-head" />
        <div class="dm-page-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <span class={`dm-tile ${i === 5 ? 'is-target' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

const DEMOS: Record<StepId, () => JSX.Element> = {
  size: SizeDemo,
  truefalse: TrueFalseDemo,
  faint: FaintDemo,
  lightdark: LightDarkDemo,
  dots: DotsDemo,
  find: FindDemo,
};

export function Demo(props: { step: StepId }): JSX.Element {
  const D = DEMOS[props.step];
  return (
    <div class="dm" aria-hidden="true" data-step={props.step}>
      <D />
    </div>
  );
}
