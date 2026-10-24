// Owner: D1. Step progress for a form split into steps. Steps can be visited in any order.
import type { JSX } from 'preact';

export function Stepper(props: { labels: string[]; current: number; onPick: (i: number) => void }): JSX.Element {
  return (
    <ol class="wa-steps" style={{ '--wa-steps': String(props.labels.length) }} aria-label="Steps">
      {props.labels.map((label, i) => (
        <li key={i}>
          <button
            type="button"
            class="wa-step"
            data-state={i < props.current ? 'done' : i === props.current ? 'current' : 'next'}
            aria-current={i === props.current ? 'step' : undefined}
            onClick={() => props.onPick(i)}
          >
            <span class="wa-step__bar" aria-hidden="true" />
            <span class="wa-step__label">
              <span class="wa-step__num">{i + 1}</span>
              <span>{label}</span>
            </span>
            <span class="wa-sr">{i < props.current ? ' (done)' : ''}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
