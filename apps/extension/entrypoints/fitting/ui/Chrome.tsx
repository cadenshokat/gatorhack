// The quiet frame around every step: the top bar with the Reading · Pointing · Finding ruler, and the
// "What we've learned" slip (a chip on narrow windows).

import type { JSX } from 'preact';
import type { LearnedLine, PartId } from '../logic/steps';

export function CheckIcon(props: { size?: number }): JSX.Element {
  const s = props.size ?? 16;
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true" class="fl-check">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function Wordmark(): JSX.Element {
  return (
    <div class="fl-wordmark">
      <span class="fl-wordmark-dot" aria-hidden="true" />
      WebAble
    </div>
  );
}

export function TopBar(props: {
  parts: Array<{ id: PartId; label: string }> | null;
  current: PartId | null;
  done: ReadonlySet<PartId>;
  /** A soft check on the current part, just after an answer. */
  ticking: boolean;
  onSkip: (() => void) | null;
}): JSX.Element {
  return (
    <header class="fl-top">
      <Wordmark />
      {props.parts ? (
        <nav class="fl-ruler" aria-label="Progress">
          <ol>
            {props.parts.map((p, i) => {
              const done = props.done.has(p.id);
              const current = !done && p.id === props.current;
              const state = done ? 'is-done' : current ? 'is-current' : 'is-next';
              return (
                <>
                  {i > 0 ? <li class={`fl-rule ${done || current ? 'is-past' : ''}`} aria-hidden="true" /> : null}
                  <li class={`fl-seg ${state}`} aria-current={current ? 'step' : undefined}>
                    <span class={`fl-seg-mark ${current && props.ticking ? 'is-ticking' : ''}`} aria-hidden="true">
                      <span class="fl-seg-dot" />
                      <CheckIcon size={16} />
                    </span>
                    <span class="fl-seg-label">{p.label}</span>
                    {done ? <span class="visually-hidden">, done</span> : null}
                  </li>
                </>
              );
            })}
          </ol>
        </nav>
      ) : (
        <span />
      )}
      <div class="fl-top-end">
        {props.onSkip ? (
          <button type="button" class="btn-text fl-skip" onClick={props.onSkip} data-answer="skip-all">
            Skip for now
          </button>
        ) : null}
      </div>
    </header>
  );
}

function LineValue(props: { line: LearnedLine }): JSX.Element {
  const l = props.line;
  return (
    <span class="fl-line-value">
      {l.from ? <span class="fl-line-from">{l.from} → </span> : null}
      <b class={l.changed ? 'is-changed' : ''}>{l.value}</b>
    </span>
  );
}

/** The tailor's slip: one line per finished step. Never changes while a step is running. */
export function Rail(props: { lines: LearnedLine[] }): JSX.Element {
  return (
    <aside class="fl-rail card" aria-label="What we've learned">
      <h2 class="fl-rail-title">What we’ve learned</h2>
      {props.lines.length ? (
        <ul class="fl-lines">
          {props.lines.map((l) => (
            <li class="fl-line" key={`${l.id}:${l.value}`}>
              <span class="fl-line-label">{l.label}</span>
              <LineValue line={l} />
            </li>
          ))}
        </ul>
      ) : (
        <p class="fl-rail-empty">What we learn about you shows up here, one line at a time.</p>
      )}
    </aside>
  );
}

/** Under 1180 px the newest line rides on the next instruction card instead. */
export function Chip(props: { line: LearnedLine }): JSX.Element {
  return (
    <p class="fl-chip">
      <span class="fl-chip-label">{props.line.label}</span>
      <LineValue line={props.line} />
    </p>
  );
}
