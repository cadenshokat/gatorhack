// The card that opens every section. The person has to press Start.
// The little example loops, and sits on one frame when motion is reduced.

import type { JSX } from 'preact';
import { copy, type SectionCopy, type SectionId } from '../content/copy';
import { Button, useFocusTrap } from './bits';

function Example(props: { id: SectionId }): JSX.Element {
  if (props.id === 'read') {
    return (
      <div class="ob-ex ob-ex-read" aria-hidden="true">
        <span>Read this.</span>
        <span>Read this.</span>
        <span>Read this.</span>
      </div>
    );
  }
  if (props.id === 'faint') {
    return (
      <div class="ob-ex ob-ex-faint" aria-hidden="true">
        <span>river</span>
      </div>
    );
  }
  if (props.id === 'bubbles') {
    return (
      <div class="ob-ex ob-ex-bubbles" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    );
  }
  if (props.id === 'find') {
    return (
      <div class="ob-ex ob-ex-find" aria-hidden="true">
        <span>Weather</span>
        <span class="is-target">Train times</span>
        <span>Lunch</span>
        <b>Live</b>
      </div>
    );
  }
  return (
    <div class="ob-ex ob-ex-colours" aria-hidden="true">
      <i /><i /><i /><i /><i />
    </div>
  );
}

function Task(props: { text: string }): JSX.Element {
  const mark = copy.read.done;
  const at = props.text.indexOf(mark);
  if (at < 0) return <>{props.text}</>;
  return (
    <>
      {props.text.slice(0, at)}
      <strong>{mark}</strong>
      {props.text.slice(at + mark.length)}
    </>
  );
}

export function Instruction(props: { id: SectionId; onStart: () => void; onSkip: () => void }): JSX.Element {
  const words = copy.sections[props.id] as SectionCopy;
  const trap = useFocusTrap(true);
  return (
    <div class="ob-modal" role="dialog" aria-modal="true" aria-labelledby="ob-card-title" ref={trap.ref}>
      <div class="ob-card">
        <Example id={props.id} />
        <h1 id="ob-card-title" class="ob-title ob-title-card">{words.title}</h1>
        <p class="ob-lede"><Task text={words.task} /></p>
        {words.before ? (
          <p class="ob-before"><span class="ob-kicker">{copy.before}</span> {words.before}</p>
        ) : null}
        <p class="ob-success">{words.success}</p>
        {words.keyboard ? <p class="ob-keyboard">{words.keyboard}</p> : null}
        <div class="ob-actions">
          <Button kind="primary" onClick={props.onStart} data="start" focus>
            {copy.start}
          </Button>
          <Button kind="quiet" onClick={props.onSkip} data="skip-section">
            {copy.skip}
          </Button>
        </div>
      </div>
    </div>
  );
}
