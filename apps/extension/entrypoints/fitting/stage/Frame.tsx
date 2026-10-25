// The window frame around the stage page: a quiet bar that names the made-up site.

import type { ComponentChildren, JSX } from 'preact';

export function FrameBar(props: { site: string; note?: string }): JSX.Element {
  return (
    <div class="wu-framebar" aria-hidden="true">
      <span class="wu-framebar-dots">
        <i />
        <i />
        <i />
      </span>
      <span class="wu-framebar-site">
        {props.site}
        {props.note ? <span class="wu-framebar-note"> · {props.note}</span> : null}
      </span>
      <span class="wu-framebar-dots is-spacer" />
    </div>
  );
}

/** Instruction line: one sentence, the screen's heading. Announced when it changes. */
export function Instruction(props: { children: ComponentChildren; sub?: ComponentChildren; id?: string }): JSX.Element {
  return (
    <div class="wu-instr">
      <h1 class="wu-instr-h" tabIndex={-1} id={props.id ?? 'wu-instr'} aria-live="polite">
        {props.children}
      </h1>
      {props.sub ? <p class="wu-instr-sub">{props.sub}</p> : null}
    </div>
  );
}
