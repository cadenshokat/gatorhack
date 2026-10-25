// The fit strip: five marks (Text · Contrast · Clicks · Calm · Colours) that fill with a check and a value as each
// block ends, like a ring closing. No percentages, timers or scores.

import type { JSX } from 'preact';
import type { MarkState } from '../logic/fitview';
import { MARKS, type MarkId } from '../logic/plan';

export interface StripMark {
  state: MarkState;
  value: string | null;
}

const R = 10;
const C = 2 * Math.PI * R;

function Ring(props: { state: MarkState }): JSX.Element {
  const s = props.state;
  return (
    <svg class={`wu-mark-ring is-${s}`} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle class="wu-ring-track" cx="12" cy="12" r={R} />
      {s === 'done' || s === 'setting' ? (
        <circle class="wu-ring-fill" cx="12" cy="12" r={R} style={{ strokeDasharray: C, strokeDashoffset: 0 }} transform="rotate(-90 12 12)" />
      ) : null}
      {s === 'done' ? <circle class="wu-ring-disc" cx="12" cy="12" r={R - 0.5} /> : null}
      {s === 'done' || s === 'setting' ? (
        <path class="wu-ring-check" d="M7.6 12.3l2.9 2.9 5.9-6.4" pathLength={1} />
      ) : s === 'active' ? (
        <circle class="wu-ring-dot" cx="12" cy="12" r="3.2" />
      ) : s === 'skipped' ? (
        <path class="wu-ring-dash" d="M8 12h8" />
      ) : null}
    </svg>
  );
}

const STATE_WORDS: Record<MarkState, string> = {
  pending: 'not yet',
  active: 'now',
  done: 'from your warm-up',
  setting: 'from your browser settings',
  skipped: 'skipped',
};

export function Strip(props: { marks: Record<MarkId, StripMark> }): JSX.Element {
  return (
    <ol class="wu-strip" aria-label="Your fit">
      {MARKS.map((m) => {
        const mk = props.marks[m.id];
        return (
          <li class={`wu-mark is-${mk.state}`} aria-current={mk.state === 'active' ? 'step' : undefined}>
            <Ring state={mk.state} />
            <span class="wu-mark-text">
              <span class="wu-mark-label">{m.label}</span>
              <span class="wu-mark-value" aria-label={`${mk.value ?? ''} ${STATE_WORDS[mk.state]}`}>
                {mk.state === 'skipped' ? 'Skipped' : (mk.value ?? '')}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
