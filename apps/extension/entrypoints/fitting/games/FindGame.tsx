// Three rounds of the same task. A clean page, a busy page that sits still, then that page with one moving banner.
// The banner is not something to press. How long each round takes is the signal.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { copy } from '../content/copy';
import { Button } from '../ui/bits';

export interface FindResult {
  cleanMs: number;
  busyMs: number;
  movingMs: number;
  cleanFound: boolean;
  busyFound: boolean;
  movingFound: boolean;
}

export function FindGame(props: { reducedMotion: boolean; onDone: (result: FindResult) => void }): JSX.Element {
  const [round, setRound] = useState(0);
  const [ready, setReady] = useState(false);
  const [cant, setCant] = useState(false);
  const started = useRef(performance.now());
  const done = useRef<Array<{ ms: number; found: boolean }>>([]);
  const sent = useRef(false);

  useEffect(() => {
    setReady(false);
    setCant(false);
    const reveal = window.setTimeout(() => {
      started.current = performance.now();
      setReady(true);
    }, round === 0 ? 500 : 900);
    const help = window.setTimeout(() => setCant(true), (round === 0 ? 500 : 900) + 20_000);
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(help);
    };
  }, [round]);

  const finish = (found: boolean) => {
    if (!ready || sent.current) return;
    const next = [...done.current, { ms: performance.now() - started.current, found }];
    done.current = next;
    if (round < 2) {
      setRound(round + 1);
      return;
    }
    sent.current = true;
    const clean = next[0] ?? { ms: 1000, found: false };
    const busy = next[1] ?? { ms: 1000, found: false };
    const moving = next[2] ?? { ms: 1000, found: false };
    props.onDone({
      cleanMs: clean.ms,
      busyMs: busy.ms,
      movingMs: moving.ms,
      cleanFound: clean.found,
      busyFound: busy.found,
      movingFound: moving.found,
    });
  };

  const prompt = copy.find.prompt;
  return (
    <section class="ob-game" aria-labelledby="ob-game-title">
      <h1 id="ob-game-title" class="ob-sr">{copy.sections.find.name}</h1>
      {!ready ? <p class="ob-round" aria-live="polite">{copy.find.round(round + 1)}</p> : null}
      {ready ? (
        <>
          <p class="ob-hint">{prompt}</p>
          {round === 0 ? <Clean onFind={() => finish(true)} /> : <Busy moving={round === 2} reducedMotion={props.reducedMotion} onFind={() => finish(true)} />}
          {cant ? <Button kind="quiet" onClick={() => finish(false)} data="missing">{copy.find.cant}</Button> : null}
        </>
      ) : null}
    </section>
  );
}

function Clean(props: { onFind: () => void }): JSX.Element {
  return (
    <div class="ob-find is-clean">
      <h2>Saturday out</h2>
      <ul>
        <li><button type="button" onClick={() => undefined}>Weather</button></li>
        <li><button type="button" data-answer="train-times" onClick={props.onFind}>{copy.find.target}</button></li>
        <li><button type="button" onClick={() => undefined}>Lunch spot</button></li>
        <li><button type="button" onClick={() => undefined}>Museum hours</button></li>
      </ul>
    </div>
  );
}

function Busy(props: { moving: boolean; reducedMotion: boolean; onFind: () => void }): JSX.Element {
  return (
    <div class="ob-find is-busy">
      {props.moving ? (
        <div class={`ob-banner ${props.reducedMotion ? 'is-still' : ''}`} aria-hidden="true">
          <span class="ob-dot is-pulse" /> Live deals this hour
        </div>
      ) : null}
      <div class="ob-find-grid">
        <article>
          <span class="ob-ad">Ad</span>
          <h2>A weekend by the water</h2>
          <p>Rooms with a view of the harbor.</p>
        </article>
        <article>
          <h2>Saturday out</h2>
          <ul>
            <li><button type="button" onClick={() => undefined}>Weather</button></li>
            <li><button type="button" onClick={() => undefined}>Photos</button></li>
            <li><button type="button" data-answer="train-times" onClick={props.onFind}>{copy.find.target}</button></li>
            <li><button type="button" onClick={() => undefined}>Lunch spot</button></li>
          </ul>
        </article>
        <aside>
          <h2>You might also like</h2>
          <p>Five cafes near the station</p>
          <p>What to pack for a day out</p>
          <p>A map of the old town</p>
        </aside>
      </div>
    </div>
  );
}
