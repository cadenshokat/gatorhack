// A word appears in grey. The person picks it from three. Contrast follows a 2-down, 1-up staircase,
// then one question asks whether light or dark is easier.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContrastBand, Polarity } from '@webable/core';
import { copy } from '../content/copy';
import { FAINT_WORDS } from '../content/sentences';
import { shuffle, type Rng } from '../logic/rand';
import { ContrastStaircase } from '../logic/staircase';
import { Button } from '../ui/bits';

interface FaintTrial {
  ratio: number;
  correct: boolean;
}

export function FaintGame(props: {
  rng: Rng;
  onDone: (result: { trials: FaintTrial[]; band: ContrastBand; polarity: Polarity; stop: string }) => void;
}): JSX.Element {
  const stair = useRef(new ContrastStaircase());
  const trials = useRef<FaintTrial[]>([]);
  const [stim, setStim] = useState(() => stair.current.current());
  const [choices, setChoices] = useState<string[]>(() => options(props.rng, FAINT_WORDS[0] as string));
  const [word, setWord] = useState(FAINT_WORDS[0] as string);
  const [phase, setPhase] = useState<'word' | 'theme'>('word');
  const group = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = props.rng();
    const w = FAINT_WORDS[Math.floor(first * FAINT_WORDS.length)] ?? 'house';
    setWord(w);
    setChoices(options(props.rng, w));
  }, [props.rng]);

  useEffect(() => {
    const btn = group.current?.querySelector('button');
    if (btn instanceof HTMLElement) btn.focus();
  }, [word, phase, stim.gray]);

  const pick = (choice: string | null) => {
    const correct = choice != null && choice === word;
    const ratio = stim.ratio;
    trials.current = [...trials.current, { ratio, correct }];
    stair.current.record(correct);
    if (stair.current.finished || trials.current.length >= 12) {
      setPhase('theme');
      return;
    }
    const nextWord = FAINT_WORDS[Math.floor(props.rng() * FAINT_WORDS.length)] ?? word;
    setWord(nextWord);
    setChoices(options(props.rng, nextWord));
    setStim(stair.current.current());
  };

  const chooseTheme = (polarity: Polarity) => {
    props.onDone({
      trials: trials.current,
      band: stair.current.band(),
      polarity,
      stop: stair.current.finished ? 'reversal' : 'max',
    });
  };

  const onKeys = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const buttons = [...(group.current?.querySelectorAll('button') ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = buttons[i + (e.key === 'ArrowRight' ? 1 : -1)];
    next?.focus();
  };

  if (phase === 'theme') {
    return (
      <section class="ob-game" aria-labelledby="ob-theme-title">
        <h1 id="ob-theme-title" class="ob-hint">{copy.faint.easier}</h1>
        <div class="ob-polarity" ref={group} onKeyDown={onKeys}>
          <button type="button" class="ob-swatch is-light" data-answer="light" onClick={() => chooseTheme('light')}>
            <span>{copy.faint.sample}</span>
            <span class="ob-swatch-name">{copy.faint.thisOne}</span>
          </button>
          <button type="button" class="ob-swatch is-dark" data-answer="dark" onClick={() => chooseTheme('dark')}>
            <span>{copy.faint.sample}</span>
            <span class="ob-swatch-name">{copy.faint.thisOne}</span>
          </button>
        </div>
        <Button kind="quiet" onClick={() => chooseTheme('none')} data="both">{copy.faint.both}</Button>
      </section>
    );
  }

  return (
    <section class="ob-game" aria-labelledby="ob-game-title">
      <h1 id="ob-game-title" class="ob-sr">{copy.sections.faint.name}</h1>
      <p class="ob-hint">{copy.faint.prompt}</p>
      <p class="ob-word" style={{ color: `rgb(${stim.gray} ${stim.gray} ${stim.gray})` }} aria-live="polite">{word}</p>
      <div class="ob-choices" role="group" aria-label={copy.faint.prompt} ref={group} onKeyDown={onKeys}>
        {choices.map((choice) => (
          <Button key={choice} kind="choice" onClick={() => pick(choice)} data={choice}>{choice}</Button>
        ))}
      </div>
      <Button kind="quiet" onClick={() => pick(null)} data="cant-tell">{copy.faint.cant}</Button>
    </section>
  );
}

function options(rng: Rng, word: string): string[] {
  const rest = shuffle(FAINT_WORDS.filter((w) => w !== word), rng).slice(0, 2);
  return shuffle([word, ...rest], rng);
}
