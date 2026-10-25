// Sentences step down in size, three lines each. Every third one, a yes or no checks that it was read.

import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { copy } from '../content/copy';
import { READ_LINES, threeLines } from '../content/lines';
import { readingLadder, readingShouldStop, readingStartPx, type SpeedTrial } from '../logic/reading';
import { shuffle, type Rng } from '../logic/rand';
import { useTrialClock } from '../ui/common';
import { Button } from '../ui/bits';

export function ReadGame(props: {
  rng: Rng;
  onDone: (result: { trials: SpeedTrial[]; stop: 'drop' | 'max' | 'time' }) => void;
}): JSX.Element {
  const lines = useMemo(() => shuffle(READ_LINES, props.rng), [props.rng]);
  const ladder = useMemo(() => readingLadder(readingStartPx(window.innerWidth)), []);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'read' | 'check' | 'stop'>('read');
  const trials = useRef<SpeedTrial[]>([]);
  const nudged = useRef(false);
  const sent = useRef(false);
  const opened = useRef(performance.now());
  const root = useRef<HTMLElement>(null);
  const clock = useTrialClock(phase !== 'read', `${step}-${phase}`);
  const line = lines[step % lines.length] ?? lines[0];
  const px = ladder[Math.min(step, ladder.length - 1)] ?? 16;

  useEffect(() => {
    const btn = root.current?.querySelector<HTMLElement>('[data-answer="done-reading"], [data-answer="yes"]');
    btn?.focus();
  }, [step, phase]);

  if (!line) return <div />;

  const finish = (stop: 'drop' | 'max' | 'time') => {
    if (sent.current) return;
    sent.current = true;
    setPhase('stop');
    const snapshot = trials.current.map((t) => ({ ...t }));
    window.setTimeout(() => props.onDone({ trials: snapshot, stop }), 1100);
  };
  const stopNow = () => readingShouldStop(trials.current, ladder.length, performance.now() - opened.current);

  const advance = (trial: SpeedTrial) => {
    trials.current = [...trials.current, trial];
    const stop = stopNow();
    if (stop) {
      finish(stop);
      return;
    }
    const next = step + 1;
    if (next >= ladder.length) {
      finish('max');
      return;
    }
    nudged.current = false;
    setPhase('read');
    setStep(next);
  };

  const doneReading = () => {
    const ms = clock.elapsed();
    if (ms < 500 && !nudged.current) {
      nudged.current = true;
      return;
    }
    if (step % 3 === 2) {
      trials.current = [...trials.current, { px, ms, correct: true, chars: line.text.length }];
      setPhase('check');
      return;
    }
    advance({ px, ms, correct: true, chars: line.text.length });
  };

  const answer = (yes: boolean) => {
    const last = trials.current[trials.current.length - 1];
    if (last) last.correct = yes === line.dog;
    const stop = stopNow();
    if (stop) {
      finish(stop);
      return;
    }
    if (step + 1 >= ladder.length) {
      finish('max');
      return;
    }
    nudged.current = false;
    setPhase('read');
    setStep(step + 1);
  };

  const cant = () => {
    trials.current = [...trials.current, { px, ms: clock.elapsed(), correct: false, chars: line.text.length }];
    finish('drop');
  };

  return (
    <section class="ob-game" aria-labelledby="ob-game-title" ref={root}>
      <h1 id="ob-game-title" class="ob-sr">{copy.sections.read.name}</h1>
      {phase === 'stop' ? <p class="ob-title ob-stop" aria-live="polite">{copy.read.stop}</p> : null}
      {phase === 'read' ? (
        <>
          <p class="ob-sentence" style={{ fontSize: `${px}px` }} aria-live="polite">
            {threeLines(line.text).map((part) => <span class="ob-line" key={part}>{part}</span>)}
          </p>
          <Button kind="primary" onClick={doneReading} data="done-reading">{copy.read.done}</Button>
          <button type="button" class="ob-link" data-answer="cant-read" onClick={cant}>{copy.read.cant}</button>
        </>
      ) : null}
      {phase === 'check' ? (
        <div class="ob-check">
          <p class="ob-question" aria-live="polite">{copy.read.question(copy.read.thing)}</p>
          <div class="ob-actions">
            <Button kind="choice" onClick={() => answer(true)} data="yes">{copy.read.yes}</Button>
            <Button kind="choice" onClick={() => answer(false)} data="no">{copy.read.no}</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
