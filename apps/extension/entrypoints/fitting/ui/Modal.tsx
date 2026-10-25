// The instruction card before every step: eyebrow, title, one sentence on what to do, one on what counts as success,
// a tiny looping picture of the step, then "Skip this one" and Start. Enter starts; focus lands on the title.

import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { LearnedLine, StepId, StepWords } from '../logic/steps';
import { CheckIcon, Chip } from './Chrome';
import { Demo } from './Demo';
import { useKeys } from './hooks';

export function Instruction(props: {
  step: StepId;
  eyebrow: string;
  words: StepWords;
  setLine: string | null;
  chip: LearnedLine | null;
  onStart: () => void;
  onSkip: () => void;
}): JSX.Element {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, [props.step]);

  useKeys(true, (key, e) => {
    if (key !== 'Enter') return;
    // Enter on a focused button does that button's job.
    if (e.target instanceof HTMLButtonElement) return;
    e.preventDefault();
    props.onStart();
  });

  return (
    <div class="fl-modal-wrap">
      <div class="fl-modal" role="dialog" aria-modal="true" aria-labelledby="fl-modal-title" aria-describedby="fl-modal-desc">
        {props.setLine || props.chip ? (
          <div class="fl-modal-reward">
            {props.setLine ? (
              <p class="fl-modal-set">
                <CheckIcon size={18} />
                {props.setLine}
              </p>
            ) : null}
            {props.chip ? <Chip line={props.chip} /> : null}
          </div>
        ) : null}
        <p class="fl-eyebrow">{props.eyebrow}</p>
        <h2 id="fl-modal-title" class="fl-modal-title" ref={title} tabIndex={-1}>
          {props.words.title}
        </h2>
        <div id="fl-modal-desc" class="fl-modal-text">
          <p class="fl-modal-todo">{props.words.todo}</p>
          <p class="fl-modal-success">{props.words.success}</p>
        </div>
        <Demo step={props.step} />
        <div class="fl-modal-actions">
          <button type="button" class="btn-text" onClick={props.onSkip} data-answer="skip-step">
            Skip this one
          </button>
          <button type="button" class="btn btn-primary fl-btn-wide" onClick={props.onStart} data-answer="start-step">
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
